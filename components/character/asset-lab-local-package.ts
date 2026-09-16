export type LocalZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export class LocalAssetZip {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  readonly entries: ReadonlyMap<string, LocalZipEntry>;

  constructor(readonly buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.entries = parseCentralDirectory(this.view, this.bytes);
  }

  has(name: string) {
    return this.entries.has(name);
  }

  async extract(name: string): Promise<ArrayBuffer> {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`Package is missing ${name}`);

    const offset = entry.localHeaderOffset;
    if (this.view.getUint32(offset, true) !== LOCAL_SIGNATURE) {
      throw new Error(`Invalid local ZIP header for ${name}`);
    }

    const fileNameLength = this.view.getUint16(offset + 26, true);
    const extraLength = this.view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > this.bytes.byteLength) throw new Error(`ZIP entry ${name} is truncated`);

    const compressed = this.bytes.slice(dataStart, dataEnd);
    if (entry.compressionMethod === 0) return exactArrayBuffer(compressed);
    if (entry.compressionMethod !== 8) {
      throw new Error(`ZIP compression method ${entry.compressionMethod} is not supported for ${name}`);
    }

    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot decompress the private source package. Use current Safari/Chrome.");
    }

    const stream = new Blob([compressed]).stream().pipeThrough(
      new DecompressionStream("deflate-raw" as CompressionFormat),
    );
    const decompressed = await new Response(stream).arrayBuffer();
    if (decompressed.byteLength !== entry.uncompressedSize) {
      throw new Error(`ZIP entry ${name} extracted to an unexpected size`);
    }
    return decompressed;
  }
}

export async function readVerifiedAssetZip(file: File, expectedSha256: string) {
  const buffer = await file.arrayBuffer();
  const sha256 = await sha256Hex(buffer);
  if (sha256 !== expectedSha256.toLowerCase()) {
    throw new Error("Selected ZIP does not match the P3.7 private source package checksum.");
  }
  return { archive: new LocalAssetZip(buffer), sha256 };
}

async function sha256Hex(buffer: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 verification is unavailable in this browser.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

function parseCentralDirectory(view: DataView, bytes: Uint8Array) {
  const eocd = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, LocalZipEntry>();
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) {
      throw new Error(`Invalid ZIP central directory at entry ${index}`);
    }

    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = decoder.decode(bytes.slice(nameStart, nameEnd));

    entries.set(name, {
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    cursor = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView) {
  const minimum = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("Invalid ZIP: end-of-central-directory record not found");
}

function exactArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
