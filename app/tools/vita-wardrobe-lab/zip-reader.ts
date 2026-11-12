/** Browser-local, bounded ZIP reader for VRoid .vroidcustomitem intake.
 * No dependencies, extraction servers or speculative protobuf decoding.
 */
export type ZipEntry = {
  name: string;
  compressedSize: number;
  size: number;
  method: number;
  localOffset: number;
};

const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_ENTRY_BYTES = 24 * 1024 * 1024;
const MAX_TOTAL_BYTES = 96 * 1024 * 1024;
const MAX_ENTRIES = 512;
const decoder = new TextDecoder("utf-8");

function rejectUnsafePath(name: string): boolean {
  return name.startsWith("/") || name.startsWith("\\") || /^[A-Za-z]:/.test(name) ||
    name.split(/[\\/]/).some(part => part === "..");
}

export function inspectZip(bytes: ArrayBuffer): ZipEntry[] {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("ZIP vượt giới hạn 32 MB trên iPhone.");
  const v = new DataView(bytes);
  const len = bytes.byteLength;
  if (len < 22) throw new Error("Tệp ZIP không hợp lệ hoặc bị cắt.");
  let eocd = -1;
  for (let p = len - 22; p >= Math.max(0, len - 65557); p--) {
    if (v.getUint32(p, true) === 0x06054b50 && p + 22 + v.getUint16(p + 20, true) === len) {
      eocd = p;
      break;
    }
  }
  if (eocd < 0) throw new Error("Không tìm thấy ZIP central directory.");
  if (v.getUint16(eocd + 4, true) !== 0 || v.getUint16(eocd + 6, true) !== 0)
    throw new Error("Multi-disk ZIP chưa được hỗ trợ.");
  const count = v.getUint16(eocd + 10, true);
  if (count > MAX_ENTRIES) throw new Error("ZIP có quá nhiều file.");
  const directorySize = v.getUint32(eocd + 12, true);
  const directoryStart = v.getUint32(eocd + 16, true);
  if (directoryStart === 0xffffffff || directorySize === 0xffffffff)
    throw new Error("ZIP64 chưa được hỗ trợ.");
  if (directoryStart + directorySize > eocd) throw new Error("ZIP central directory nằm ngoài tệp.");
  const entries: ZipEntry[] = [];
  let p = directoryStart;
  let totalSize = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > len || v.getUint32(p, true) !== 0x02014b50)
      throw new Error("ZIP central directory bị lỗi.");
    const flags = v.getUint16(p + 8, true);
    if (flags & 0x1) throw new Error("ZIP được mã hóa; không thể đọc.");
    const method = v.getUint16(p + 10, true);
    const compressedSize = v.getUint32(p + 20, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOffset = v.getUint32(p + 42, true);
    if (p + 46 + nameLen + extraLen + commentLen > len) throw new Error("ZIP entry bị cắt.");
    const name = decoder.decode(new Uint8Array(bytes, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!name || rejectUnsafePath(name)) throw new Error("Tên file ZIP không an toàn.");
    if (size > MAX_ENTRY_BYTES || compressedSize > MAX_ARCHIVE_BYTES || localOffset === 0xffffffff)
      throw new Error("ZIP entry vượt giới hạn kích thước.");
    if (method !== 0 && method !== 8) throw new Error("ZIP chứa thuật toán nén chưa hỗ trợ.");
    totalSize += size;
    if (totalSize > MAX_TOTAL_BYTES) throw new Error("ZIP có nguy cơ giải nén quá lớn.");
    entries.push({ name, size, compressedSize, method, localOffset });
  }
  return entries;
}

export async function extractZipEntry(bytes: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const v = new DataView(bytes);
  const p = entry.localOffset;
  if (p < 0 || p + 30 > bytes.byteLength || v.getUint32(p, true) !== 0x04034b50)
    throw new Error("ZIP local header không hợp lệ.");
  const nameLength = v.getUint16(p + 26, true);
  const extraLength = v.getUint16(p + 28, true);
  const start = p + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > bytes.byteLength) throw new Error("ZIP payload bị cắt.");
  const data = bytes.slice(start, end);
  if (entry.method === 0) {
    if (data.byteLength !== entry.size) throw new Error("Kích thước ZIP entry không khớp.");
    return new Uint8Array(data);
  }
  if (typeof DecompressionStream === "undefined")
    throw new Error("Trình duyệt chưa hỗ trợ giải nén ZIP; hãy thử Safari mới nhất.");
  // Safari iOS 16.4+ supports deflate-raw. Keep entire operation browser-local.
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ENTRY_BYTES || total > entry.size) {
        await reader.cancel();
        throw new Error("Giải nén vượt giới hạn công bố.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== entry.size) throw new Error("Kích thước dữ liệu giải nén không khớp.");
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

export type WardrobeTexture = {
  name: string;
  width: number;
  height: number;
  bytes: number;
  url: string;
};

export type WardrobeIntake = {
  name: string;
  sourceFormat: ".vroidcustomitem";
  entries: number;
  kind: string;
  version: string;
  thumbnailUrl: string | null;
  textures: WardrobeTexture[];
  notes: string;
};

// A transferable is not a standalone mesh. These PNGs are actual VRoid
// clothing texture layers embedded in protobuf-like binary payloads.
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
function extractEmbeddedPngs(bytes: Uint8Array, basename: string, remaining: number): WardrobeTexture[] {
  const textures: WardrobeTexture[] = [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 33 <= bytes.length && textures.length < remaining; offset++) {
    if (bytes[offset] !== PNG_SIGNATURE[0] || PNG_SIGNATURE.some((value, i) => bytes[offset + i] !== value)) continue;
    if (dv.getUint32(offset + 8, false) !== 13 ||
        String.fromCharCode(...bytes.subarray(offset + 12, offset + 16)) !== "IHDR") continue;
    const width = dv.getUint32(offset + 16, false);
    const height = dv.getUint32(offset + 20, false);
    if (!width || !height || width > 4096 || height > 4096) continue;
    let pos = offset + 8, end = 0;
    for (let chunk = 0; chunk < 1000 && pos + 12 <= bytes.length; chunk++) {
      const length = dv.getUint32(pos, false);
      if (length > bytes.length - pos - 12) break;
      const isIend = bytes[pos + 4] === 73 && bytes[pos + 5] === 69 &&
        bytes[pos + 6] === 78 && bytes[pos + 7] === 68 && length === 0;
      pos += length + 12;
      if (isIend) { end = pos; break; }
    }
    if (!end || end - offset > MAX_ENTRY_BYTES) continue;
    const png = Uint8Array.from(bytes.subarray(offset, end));
    const url = URL.createObjectURL(new Blob([png], { type: "image/png" }));
    textures.push({ name: basename + " · PNG " + (textures.length + 1), width, height, bytes: png.byteLength, url });
    offset = end - 1;
  }
  return textures;
}

export function revokeWardrobeAssets(items: WardrobeIntake[]): void {
  for (const item of items) {
    if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
    for (const layer of item.textures) URL.revokeObjectURL(layer.url);
  }
}

function guessKind(name: string): string {
  if (/skirt|váy|bottom|pants|trousers|short/i.test(name)) return "Bottom / Skirt (dự đoán từ tên)";
  if (/shoe|boot|giày|sneaker/i.test(name)) return "Shoes (dự đoán từ tên)";
  if (/top|shirt|hoodie|jacket|blouse|áo/i.test(name)) return "Top / Jacket (dự đoán từ tên)";
  return "Chưa xác định loại — cần VRoid Studio xác nhận";
}

async function parseCustomItem(blob: ArrayBuffer, name: string): Promise<WardrobeIntake> {
  const entries = inspectZip(blob);
  const meta = entries.find(item => item.name === "meta.json");
  const preview = entries.find(item => /^thumbnails\/[^/]+\.(png|jpe?g)$/i.test(item.name));
  const rootMeta = entries.find(item => item.name === "v1customitem/meta.json");
  if (!meta || !rootMeta) throw new Error(`File ${name} không đúng cấu trúc .vroidcustomitem VRoid Stable đã biết.`);
  const info = JSON.parse(decoder.decode(await extractZipEntry(blob, meta))) as Record<string, unknown>;
  const version = [info.updateVroidVersionMajor, info.updateVroidVersionMinor, info.updateVroidVersionPatch].filter(x => typeof x === "number").join(".");
  const rootInfo = JSON.parse(decoder.decode(await extractZipEntry(blob, rootMeta))) as Record<string, unknown>;
  const groupType = typeof rootInfo.rootTransferableGroupTypeId === "string" ? rootInfo.rootTransferableGroupTypeId : "";
  const exactCategory = groupType.endsWith(".Tops") ? "Top / Jacket (VRoid metadata)" :
    groupType.endsWith(".Bottoms") ? "Bottom / Skirt (VRoid metadata)" :
    groupType.endsWith(".Shoes") ? "Shoes (VRoid metadata)" : guessKind(name);
  let thumbnailUrl: string | null = null;
  if (preview) {
    const image = await extractZipEntry(blob, preview);
    const mime = preview.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    thumbnailUrl = URL.createObjectURL(new Blob([Uint8Array.from(image)], { type: mime }));
  }
  const textures: WardrobeTexture[] = [];
  try {
    for (const entry of entries.filter(item => item.name.endsWith(".transferable"))) {
      if (textures.length >= 16) break;
      const payload = await extractZipEntry(blob, entry);
      textures.push(...extractEmbeddedPngs(payload, entry.name.split("/").pop() || entry.name, 16 - textures.length));
    }
    return {
      name,
      sourceFormat: ".vroidcustomitem",
      entries: entries.length,
      kind: exactCategory,
      version: version || "Không có phiên bản trong metadata",
      thumbnailUrl,
      textures,
      notes: "Đã trích xuất PNG thực từ .transferable. Đây là các lớp texture/template VRoid, CHƯA phải mesh hay quần áo đã skinning.",
    };
  } catch (error) {
    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    for (const layer of textures) URL.revokeObjectURL(layer.url);
    throw error;
  }
}

/** Reads both standalone custom-item files and creator ZIPs containing them. */
export async function inspectWardrobePackage(file: File): Promise<WardrobeIntake[]> {
  if (!/\.(zip|vroidcustomitem)$/i.test(file.name)) throw new Error("Chỉ hỗ trợ ZIP hoặc .vroidcustomitem ở bước kiểm tra nguồn.");
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("File vượt giới hạn 32 MB của bước thử nghiệm.");
  const buffer = await file.arrayBuffer();
  if (/\.vroidcustomitem$/i.test(file.name)) return [await parseCustomItem(buffer, file.name)];
  const entries = inspectZip(buffer).filter(e => /\.vroidcustomitem$/i.test(e.name));
  if (!entries.length) throw new Error("ZIP chưa có .vroidcustomitem. Hãy kiểm tra định dạng file trên BOOTH.");
  if (entries.length > 24) throw new Error("ZIP có quá 24 custom items, cần chia nhỏ trước khi thử.");
  const result: WardrobeIntake[] = [];
  for (const entry of entries) {
    const nested = await extractZipEntry(buffer, entry);
    result.push(await parseCustomItem(Uint8Array.from(nested).buffer, entry.name.split("/").pop() || entry.name));
  }
  return result;
}