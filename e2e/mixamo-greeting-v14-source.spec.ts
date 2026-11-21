import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";

/** No WebGL/browser required: validates the EXACT committed owner FBX bake. */
test("V14 Greeting source has authentic extrinsic-xyz Mixamo arm pose and 30Hz timeline",()=>{
  const encoded=readFileSync("public/m3-qa/standing_greeting_2_v14.b64","utf8").trim();
  expect(encoded).toHaveLength(7740);
  const compressed=Buffer.from(encoded,"base64");
  expect(compressed.byteLength).toBe(5805);
  expect(createHash("sha256").update(compressed).digest("hex"))
    .toBe("2dae169d4df3b6ceaff7b229b1ec78af7a3b68d0aa23f14ca97654b696220e9b");
  const bytes=gunzipSync(compressed);
  expect(bytes.toString("ascii",0,4)).toBe("SG11");
  expect(bytes.readUInt16LE(4)).toBe(154);
  expect(bytes.readUInt8(6)).toBe(52);
  expect(bytes.readUInt8(7)).toBe(1);
  const bones=[
    "hips","spine","chest","upper_chest","neck","head",
    ...(["L","R"] as const).flatMap(side=>[
      ...["shoulder","upper_arm","lower_arm","hand"].map(part=>part+"."+side),
      ...["index","little","middle","ring","thumb"].flatMap(part=>
        ["proximal","intermediate","distal"].map(seg=>part+"."+seg+"."+side)),
    ]),
    ...(["L","R"] as const).flatMap(side=>
      ["upper_leg","lower_leg","foot","toes"].map(part=>part+"."+side)),
  ];
  expect(bones).toHaveLength(52);
  const tracks=new Map<string,{frame:number;x:number;y:number;z:number}[]>();
  let at=8;
  for(const name of bones){
    const count=bytes.readUInt16LE(at);at+=2;
    const keys=[];
    for(let i=0;i<count;i++){
      const frame=bytes.readUInt8(at);
      const x=bytes.readInt16LE(at+1)/32767;
      const y=bytes.readInt16LE(at+3)/32767;
      const z=bytes.readInt16LE(at+5)/32767;
      keys.push({frame,x,y,z});at+=7;
    }
    tracks.set(name,keys);
    if(count){
      expect(keys[0].frame).toBe(0);
      expect(keys[keys.length-1].frame).toBe(153);
    }
  }
  const root=bytes.readUInt16LE(at);at+=2;
  expect(root).toBe(154);
  at+=root*7;
  expect(at).toBe(bytes.byteLength);
  const qAt=(name:string,frame:number)=>{
    const keys=tracks.get(name)!;
    const before=keys.filter(x=>x.frame<=frame).at(-1)!;
    const after=keys.find(x=>x.frame>=frame)!;
    const asQuat=(k:typeof before)=>{
      const w=Math.sqrt(Math.max(0,1-k.x*k.x-k.y*k.y-k.z*k.z));
      return [k.x,k.y,k.z,w];
    };
    const a=asQuat(before),b=asQuat(after);
    const dot=a.reduce((sum,n,i)=>sum+n*b[i],0);
    if(dot<0)for(let i=0;i<4;i++)b[i]=-b[i];
    const t=after.frame===before.frame?0:(frame-before.frame)/(after.frame-before.frame);
    const cosine=Math.abs(dot);
    const angle=Math.acos(Math.min(1,Math.max(-1,cosine)));
    const lerp=angle<.001;
    const wa=lerp?1-t:Math.sin((1-t)*angle)/Math.sin(angle);
    const wb=lerp?t:Math.sin(t*angle)/Math.sin(angle);
    return a.map((n,i)=>n*wa+b[i]*wb);
  };
  // Authored original source from scipy Rotation.from_euler('xyz') (EXTRINSIC).
  // Intrinsic 'XYZ' baked by V11 had right upper arm q ~= (0.17,0.38,0.15),
  // a completely different wave and should fail this source regression gate.
  const arm=qAt("upper_arm.R",60);
  const hand=qAt("hand.R",60);
  expect(Math.abs(arm[0]-(-.447))).toBeLessThan(.03);
  expect(Math.abs(arm[1]-.105)).toBeLessThan(.03);
  expect(Math.abs(hand[0]-(-.642))).toBeLessThan(.03);
  expect(Math.abs(hand[1]-.593)).toBeLessThan(.03);
  expect(Math.abs(hand[2]-(-.346))).toBeLessThan(.03);
});