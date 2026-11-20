/** QA-only, baked 2D pelvis displacement correction for Mixamo Bored.
 * Computed from owner-provided FBX on M3 rig, not authored limb rotations.
 * Data are signed little-endian int16 X/Z offsets in 0.1mm units at 30 FPS.
 * This is NOT a replacement for manual visual QA or a stepping animation.
 */

export type StabilizationRig = "drophunter" | "neurohacker";
export const BORED_PELVIS_FRAMES = 321;
export const BORED_PELVIS_CAP_METERS = 0.024;
const PACKED: Record<StabilizationRig, string> = {
  drophunter: "AAAAAAAAAAAAAAAAAQAAAAEAAAACAP//AwD//wQA/v8FAPz/BwD5/wkA9f8LAO7/DQDl/w4A2/8OAM//DwDA/w8Arv8PAJv/EACH/xAAcf8RAFz/EQBI/xIANf8TACX/FAAX/xQAEf8UABH/FAAR/xQAEf8UABH/FAAR/xMAEf8SABn/EQAl/w8AMv8OAED/DABP/woAX/8IAG//BwB//wUAj/8DAJ//AQCt/wAAu//+/8n//f/V//z/4P/7/+v/+//0//v//P/7/wQA+/8KAPz/DwD8/xQA/f8XAP//GQAAABoAAgAaAAMAGQAFABcABwATAAgADwAJAAoACgADAAoA+v8KAPD/CgDl/wkA2P8IAMr/BwC6/wYAqf8FAJj/BACG/wMAdP8DAGL/AwBS/wMAQv8DADX/AwAp/wQAIf8EABv/BAAY/wQAGP8EABv/BAAh/wMAKP8DADL/AgA9/wEASf8BAFb/AABk////cv/+/4H//v+Q//3/nv/9/6v//P+4//z/w//8/87//P/X//z/3v/7/+X/+//q//v/7v/7//L/+//0//v/9v/7//f/+//4//v/+P/8//j//P/4//3/9//9//b//v/0//7/8f/+/+7//v/o//7/4f/9/9j//f/N//3/wP/8/7D//P+g//3/j//9/37//v9t//7/Xv///1H/AABG/wEAPf8CADf/AwA0/wMAM/8DADX/AwA5/wMAP/8DAEf/AgBR/wEAXf8AAGn///93//3/hf/8/5P/+/+h//r/r//6/7v/+f/H//n/0v/5/9z/+f/l//r/7f/6//X/+//9//v/BAD8/wsA/f8RAP3/FgD+/xoA//8eAP//IQAAACMAAQAkAAIAJQADACUABAAlAAYAJAAHACMACAAhAAoAHQALABkACwATAAwACwAMAAAADADy/wwA4f8MAM7/CwC3/wsAn/8LAIX/CwBq/wsATv8LADT/CwAa/woAEP8JABD/CAAQ/wcAEP8GABD/BQAQ/wQAEP8DABD/AgAQ/wEAEP8BABD/AAAQ/wAAEP///xD///8Q////EP/+/xD//v8Q//7/EP/+/xD//f8Q//3/EP/9/xD//f8Q//3/EP/9/xD//f8Q//3/EP/9/xD//v8Q//7/EP/+/xD//v8Q//7/EP/+/xD//v8Q//7/EP/9/xD//f8Q//3/EP/9/xD//f8Q//7/EP/+/xD//v8Q////EP///xD///8Q/wAAEP8AABD/AAAQ/wEAEP8BABD/AgAQ/wIAEP8DABD/AwAQ/wQAEP8EABD/BAAQ/wQAEP8DACL/AgA4/wEATv8AAGP/AAB3////iP8AAJf/AACj/wEArP8DALL/BAC2/wYAuv8IAL3/CgDA/wsAxP8MAMr/DgDR/w4A2f8PAOH/DwDr/w4A9P8OAP3/DQAGAAwADgALABUACgAbAAkAIQAIACQACAAnAAcAKQAGACkABQAnAAQAIwADAB4AAgAVAAEACQAAAPr////o//7/0v/+/7v//v+h//7/h//+/27//v9W//7/Qf/+/y////8i////GP8AABP/AAAS/wAAFv8AAB3///8n//7/NP/9/0P//P9V//r/aP/5/3z/+P+R//b/pf/2/7f/9f/I//X/1v/1/+H/9//s//n/9P/6//n/+//8//3//f/+/////v//////AAD//wAAAAAAAAAAAAAAAAAA",
  neurohacker: "AAAAAAAAAAAAAAAAAQAAAAEAAAACAP//AwD//wQA/f8GAPv/BwD4/wkA8/8LAOz/DgDi/w4A2P8PAMr/DwC6/xAAqP8QAJP/EAB9/xEAZv8RAE//EgA6/xMAJv8UABT/FAAR/xQAEf8UABH/EwAR/xMAEf8TABH/EwAR/xMAEf8SABH/EgAU/xAAIv8OADL/DQBC/wsAU/8JAGT/BwB1/wUAhv8DAJf/AQCn/wAAtv/+/8T//f/S//z/3v/7/+n/+v/z//r//P/6/wQA+/8KAPv/EAD8/xUA/f8YAP//GgABABsAAgAbAAQAGgAGABgABwAUAAkAEAAKAAoACgACAAsA+f8LAO//CgDi/wkA1f8IAMX/BwC0/wYAo/8EAJD/AwB9/wMAav8CAFf/AgBF/wIANP8DACb/AwAa/wMAEP8EABD/BAAQ/wQAEP8EABD/AwAQ/wMAGP8CACL/AgAu/wEAO/8AAEn///9Y////aP/+/3f//f+H//3/lv/8/6X//P+y//z/v//7/8r/+//T//v/3P/7/+P/+//o//r/7f/6//H/+v/z//r/9f/6//f/+//3//v/+P/7//j//P/3//z/9v/9//X//f/z//7/8P/+/+z//v/m//3/3//9/9X//P/J//z/uv/8/6r//P+Z//z/hv/8/3T//f9i//7/Uv///0T/AAA4/wEAL/8CACj/AgAl/wMAJP8DACb/AwAq/wMAMP8CADn/AgBE/wAAUP///17//v9t//3/fP/7/4v/+v+a//n/qf/5/7b/+P/D//j/zv/5/9n/+f/j//n/7P/6//X/+//9//v/BAD8/wsA/P8SAP3/FwD+/xwA//8gAP//IwAAACUAAQAmAAIAJwADACcABQAnAAYAJgAIACUACQAiAAoAHwALABoADAAUAAwACwAMAP//DADx/wwA3/8MAMr/DACy/wwAl/8LAHv/DABf/wwAQf8MACX/CwAQ/woAEP8JABD/CAAQ/wcAEP8FABD/BAAQ/wQAEP8DABD/AgAQ/wEAEP8BABD/AAAQ/wAAEP///xD///8Q////EP/+/xD//v8Q//7/EP/+/xD//f8Q//3/EP/9/xD//f8Q//3/EP/9/xD//f8Q//3/EP/9/xD//f8Q//7/EP/+/xD//v8Q//7/EP/+/xD//f8Q//3/EP/9/xD//f8Q//3/EP/9/xD//f8Q//3/EP/+/xD//v8Q//7/EP///xD///8Q////EP8AABD/AAAQ/wEAEP8BABD/AgAQ/wIAEP8DABD/AwAQ/wQAEP8EABD/BAAQ/wMAEP8DABL/AgAq/wEAQf8AAFj///9t////gP8AAI//AACc/wIApv8DAK3/BQCy/wcAtf8JALn/CgC8/wwAwf8OAMf/DwDO/xAA1v8QAOD/EADq/xAA9P8PAP7/DgAHAA0AEAAMABcACwAeAAoAIwAJACcACAAqAAcAKwAGACsABQAqAAQAJgADAB8AAgAWAAEACQAAAPn////m//7/z//+/7X//f+a//3/fv/9/2P//v9K//7/M////yD///8R////EP8AABD/AAAQ/wAAEP8AABD///8X////Jf/9/zX//P9I//r/Xf/4/3P/9/+I//b/nv/1/7H/9P/D//T/0v/1/9//9v/r//j/8//5//j/+//7//z//f/9//7//v//////AAD//wAAAAAAAAAAAAAAAAAA",
};

const cache = new Map<StabilizationRig, Int16Array>();
function curve(rig: StabilizationRig): Int16Array {
  const cached=cache.get(rig);
  if (cached) return cached;
  const encoded=atob(PACKED[rig]);
  if (encoded.length !== BORED_PELVIS_FRAMES * 2 * 2) throw new Error("Corrupt pelvis correction");
  const view=new DataView(new ArrayBuffer(encoded.length));
  for (let i=0;i<encoded.length;i++) view.setUint8(i,encoded.charCodeAt(i));
  const data=new Int16Array(BORED_PELVIS_FRAMES*2);
  for (let i=0;i<data.length;i++) data[i]=view.getInt16(i*2,true);
  cache.set(rig,data);
  return data;
}

/** Only adjust hip translation X/Z of Bored, after source retarget, before creating its clip. */
export function applyBoredPelvisCorrection(
  rig: StabilizationRig, gesture: string, positions: Float32Array, frames: number,
): boolean {
  if (gesture !== "bored") return false;
  if (frames !== BORED_PELVIS_FRAMES || positions.length !== frames*3)
    throw new Error("Unexpected Bored animation sample count");
  const data=curve(rig);
  for (let frame=0;frame<frames;frame++) {
    positions[frame*3]+=data[frame*2]/10000;
    positions[frame*3+2]+=data[frame*2+1]/10000;
  }
  return true;
}

export function getBoredPelvisOffset(rig: StabilizationRig, frame: number): readonly [number,number] {
  if (!Number.isInteger(frame) || frame<0 || frame>=BORED_PELVIS_FRAMES) throw new RangeError("Invalid frame");
  const d=curve(rig);
  return [d[frame*2]/10000,d[frame*2+1]/10000];
}