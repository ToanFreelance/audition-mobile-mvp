"use client";
import {useEffect,useRef,useState} from "react";
import * as T from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./style.module.css";
type View="full"|"front"|"left"|"right"|"face";
type Opt="basic"|"premium";
type Hair="classic"|"pony";
type Eye="natural"|"doll"|"idol"|"heart";
type Stage={root:T.Group|null;scene:T.Scene;camera:T.PerspectiveCamera;renderer:T.WebGLRenderer;orbit:OrbitControls;
mixer:T.AnimationMixer|null;action:T.AnimationAction|null;rest:Map<T.Bone,T.Quaternion>;frame:number;accessory:T.Group|null};
const source="/characters/unified-heroine-v1/unified-heroine-v1.glb";
const angles:Record<View,{p:[number,number,number];t:[number,number,number]}> = {
full:{p:[0,1.43,5.8],t:[0,1.36,0]},front:{p:[0,1.7,3.5],t:[0,1.62,0]},
left:{p:[2.5,1.7,2.8],t:[0,1.61,0]},right:{p:[-2.5,1.7,2.8],t:[0,1.61,0]},
face:{p:[0,2.3,1.4],t:[0,2.34,0]}};
function camera(r:Stage,k:View){r.camera.position.set(...angles[k].p);r.orbit.target.set(...angles[k].t);r.orbit.update();}
function appearance(root:T.Group,outfit:Opt,hair:Hair,eye:Eye){
const color:{[K in Eye]:number|null}={natural:null,doll:0xd6a8fc,idol:0xb28afa,heart:0xf5a2c7};
root.traverse(n=>{
 if(!(n instanceof T.Mesh))return;
 const materials=Array.isArray(n.material)?n.material:[n.material];
 const basic=materials.some(m=>/(Tops_|Bottoms_|Shoes_)/.test(m.name)&&!/UHV1_FashionIdol/.test(m.name));
 if(n.name.startsWith("UHV1_Premium"))n.visible=outfit==="premium";
 else if(n.name.startsWith("UHV1_FashionPonytail"))n.visible=hair==="pony";
 else if(n.name==="Hair001")n.visible=hair==="classic";
 else if(n.name.startsWith("UHV1_Basic")||basic)n.visible=outfit==="basic";
 for(const m of materials){
  const mat=m as T.MeshStandardMaterial;
  if(/EyeIris/.test(mat.name)&&mat.color){
   if(!mat.userData.originalIris)mat.userData.originalIris=mat.color.clone();
   mat.color.copy(mat.userData.originalIris as T.Color);
   if(color[eye]!=null)mat.color.multiply(new T.Color(color[eye]!));
  }
 }
});
}
function danceSetup(root:T.Group){
const map=new Map<string,T.Bone>();root.traverse(n=>{if(n instanceof T.Bone&&!map.has(n.name))map.set(n.name,n);});
const wanted=["J_Bip_C_Hips","J_Bip_C_Spine","J_Bip_C_Chest","J_Bip_C_Head","J_Bip_L_UpperArm","J_Bip_R_UpperArm","J_Bip_L_LowerArm","J_Bip_R_LowerArm","J_Bip_L_UpperLeg","J_Bip_R_UpperLeg","J_Bip_L_LowerLeg","J_Bip_R_LowerLeg"];
const times=Array.from({length:33},(_,i)=>i/8),tracks:T.KeyframeTrack[]=[];
const rest=new Map<T.Bone,T.Quaternion>();
wanted.forEach((name,i)=>{
 const b=map.get(name);if(!b)return;const base=b.quaternion.clone();rest.set(b,base);
 const vals:number[]=[];
 times.forEach(t=>{
  const phase=t*Math.PI*2,s=Math.sin(phase),c=Math.cos(phase);
  const side=/J_Bip_R_/.test(name)?-1:1;
  const e=i<4?new T.Euler(.08*s,.09*Math.sin(t*Math.PI),.09*s):
   i<8?new T.Euler(side*(.15+.20*s),side*.08*s,side*.27*c):
   new T.Euler(side*.30*s,side*.045*s,side*.05*c);
  const q=base.clone().multiply(new T.Quaternion().setFromEuler(e));
  vals.push(q.x,q.y,q.z,q.w);
 });
 tracks.push(new T.QuaternionKeyframeTrack(name+".quaternion",times,vals));
});
const mixer=new T.AnimationMixer(root),action=mixer.clipAction(new T.AnimationClip("UnifiedHeroineDanceQA_8Beats",4,tracks));
action.setLoop(T.LoopRepeat,Infinity);return {mixer,action,rest,channels:tracks.length};
}
function headGear(r:Stage,glasses:boolean,ribbon:boolean){
if(r.accessory){
 r.accessory.parent?.remove(r.accessory);
 r.accessory.traverse(n=>{if(n instanceof T.Mesh){n.geometry.dispose();(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose());}});
 r.accessory=null;
}
if(!r.root||(!glasses&&!ribbon))return;
let bone:T.Bone|null=null;r.root.traverse(n=>{if(n instanceof T.Bone&&n.name==="J_Bip_C_Head")bone=n;});
if(!bone)return;
const group=new T.Group(),mat=new T.MeshStandardMaterial({color:0xe7c9fb,metalness:.65,roughness:.3});
if(glasses)for(const s of [-1,1]){
 const rim=new T.Mesh(new T.TorusGeometry(.065,.004,8,32),mat);rim.scale.y=.7;rim.position.set(s*.085,.075,-.16);group.add(rim);
}
if(ribbon)for(const s of [-1,1]){
 const clip=new T.Mesh(new T.TorusGeometry(.031,.006,8,24),mat);clip.scale.y=.55;clip.position.set(s*.14,.20,-.04);group.add(clip);
}
(bone as T.Bone).add(group);r.accessory=group;
}
export default function UnifiedHeroine(){
const viewport=useRef<HTMLDivElement>(null),runtime=useRef<Stage|null>(null);
const [status,setStatus]=useState("Đang tải GLB hợp nhất…"),[stats,setStats]=useState("");
const [uuid,setUuid]=useState(""),[view,setView]=useState<View>("full");
const [outfit,setOutfit]=useState<Opt>("basic"),[hair,setHair]=useState<Hair>("classic"),[eye,setEye]=useState<Eye>("natural");
const [glasses,setGlasses]=useState(false),[ribbon,setRibbon]=useState(false),[play,setPlay]=useState(false);
const [loadError,setLoadError]=useState(false),[retry,setRetry]=useState(0);
useEffect(()=>{
const el=viewport.current;if(!el)return;
setUuid("");setPlay(false);setLoadError(false);
setStatus("Đang kết nối để tải GLB…");setStats("17,7 MB · Kiểm tra kết nối và quyền truy cập Vercel Preview");
const scene=new T.Scene();scene.background=new T.Color(0x120d23);
const cam=new T.PerspectiveCamera(33,1,.05,50);
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;
renderer.domElement.style.display="block";
el.appendChild(renderer.domElement);
const orbit=new OrbitControls(cam,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=.75;orbit.maxDistance=9;
scene.add(new T.HemisphereLight(0xffe9ff,0x494062,2.5));
([[3,4,4,0xffe4ec,85],[-3,3,2,0xbab4ff,65],[1,4,-3,0xa994fa,100]] as number[][]).forEach(a=>{
const l=new T.PointLight(a[3],a[4]);l.position.set(a[0],a[1],a[2]);scene.add(l);});
const floor=new T.Mesh(new T.CircleGeometry(1.25,64),new T.MeshStandardMaterial({color:0x4c3659,roughness:.45}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
const r:Stage={root:null,scene,camera:cam,renderer,orbit,mixer:null,action:null,rest:new Map(),frame:0,accessory:null};
runtime.current=r;
const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2,Math.sqrt(2800000/(w*h))));
// Retina backing-store pixels differ from CSS pixels. Keep canvas CSS
// dimensions equal to its viewport or iPhone clips the centered actor.
renderer.setSize(w,h,true);cam.aspect=w/h;cam.updateProjectionMatrix();};
window.addEventListener("resize",resize);resize();camera(r,"full");
const clock=new T.Clock();let alive=true;
let watchdog:ReturnType<typeof setTimeout>|null=null;
const failLoad=(message:string)=>{
 if(!alive||r.root)return;
 if(watchdog)clearTimeout(watchdog);
 setLoadError(true);setStatus("Không tải được GLB");
 setStats(message);
};
const armWatchdog=()=>{
 if(watchdog)clearTimeout(watchdog);
 watchdog=setTimeout(()=>failLoad("Không nhận được dữ liệu trong 40 giây. Kiểm tra 4G/SSO rồi nhấn Thử lại."),40000);
};
armWatchdog();
const tick=()=>{if(!alive)return;r.mixer?.update(Math.min(clock.getDelta(),.065));orbit.update();renderer.render(scene,cam);r.frame=requestAnimationFrame(tick);};tick();
new GLTFLoader().load(source,g=>{
if(watchdog)clearTimeout(watchdog);
if(!alive)return;
const root=g.scene,box=new T.Box3().setFromObject(root),h=box.getSize(new T.Vector3()).y;
const scale=2.62/Math.max(h,.01);
root.scale.setScalar(scale);root.position.set(-box.getCenter(new T.Vector3()).x*scale,-box.min.y*scale,0);
root.rotation.y=Math.PI;scene.add(root);r.root=root;
let meshes=0,skins=0,bones=0,morphs=0;
root.traverse(n=>{if(n instanceof T.Mesh){meshes++;if(n instanceof T.SkinnedMesh)skins++;morphs+=n.morphTargetInfluences?.length??0;}if(n instanceof T.Bone)bones++;});
const d=danceSetup(root);r.mixer=d.mixer;r.action=d.action;r.rest=d.rest;
appearance(root,"basic","classic","natural");
setLoadError(false);setUuid(root.uuid);setStatus("VRoid A face × Fashion Idol B · Real GLB");
setStats(meshes+" meshes · "+skins+" skinned · "+bones+" bones · "+morphs+" morph weights · "+d.channels+" dance channels");
},event=>{
if(!alive||r.root)return;
armWatchdog();
if(event.lengthComputable&&event.total>0){
 const percent=Math.min(100,Math.floor(100*event.loaded/event.total));
 setStatus(percent>=100?"Đã tải xong GLB · đang giải mã và dựng nhân vật…":"Đang tải GLB · "+percent+"%");
 setStats((event.loaded/1048576).toFixed(1)+" / "+(event.total/1048576).toFixed(1)+" MiB · mạng hiện tại");
}else{
 setStatus("Đang tải GLB · "+(event.loaded/1048576).toFixed(1)+" MiB");
}
},e=>failLoad("Tải GLB lỗi: "+String(e)+". Kiểm tra SSO và thử lại."));
return()=>{alive=false;if(watchdog)clearTimeout(watchdog);cancelAnimationFrame(r.frame);window.removeEventListener("resize",resize);headGear(r,false,false);
orbit.dispose();r.mixer?.stopAllAction();renderer.dispose();renderer.domElement.remove();runtime.current=null;};
},[retry]);
useEffect(()=>{if(runtime.current?.root)appearance(runtime.current.root,outfit,hair,eye)},[outfit,hair,eye,uuid]);
useEffect(()=>{if(runtime.current)headGear(runtime.current,glasses,ribbon)},[glasses,ribbon,uuid]);
const changeCamera=(k:View)=>{setView(k);if(runtime.current)camera(runtime.current,k);};
const toggle=()=>{const r=runtime.current;if(!r?.action||!r.mixer)return;
if(play){r.action.stop();r.mixer.stopAllAction();r.rest.forEach((q,b)=>b.quaternion.copy(q));setPlay(false);}
else{r.action.reset().play();setPlay(true);}};
return <main className={styles.page}>
<header><div className={styles.eyebrow}>AUDITION MOBILE MVP · ISOLATED REAL 3D QA</div>
<h1>Unified Anime Heroine <span>V1 Candidate</span></h1>
<p>Một khuôn mặt Soft Mature, kết hợp mesh tóc/trang phục Fashion Idol trên armature hợp nhất. Không sử dụng nhân vật procedural.</p></header>
<div className={styles.layout}>
<section className={styles.viewer}><div className={styles.viewport} ref={viewport}/><div className={styles.tag}>● REAL GLB · VRoid sample A+B</div>
<div className={styles.info}>
 <strong role="status">{status}</strong><small>{stats}</small>
 {loadError&&<button type="button" className={styles.retry} onClick={()=>setRetry(n=>n+1)}>↻ Thử tải lại GLB</button>}
 </div></section>
<aside className={styles.panel}>
<section><h2>01 · Camera</h2><div className={styles.grid}>{([["full","Full Body"],["front","Front"],["left","3/4 Left"],["right","3/4 Right"],["face","Face Close-up"]] as [View,string][]).map(([k,label])=><button key={k} onClick={()=>changeCamera(k)} aria-pressed={view===k} className={view===k?styles.on:styles.off}>{label}</button>)}</div><small>Rotate / pinch zoom · iPhone portrait</small></section>
<section><h2>02 · Outfit</h2><div className={styles.grid}>{([["basic","Basic Soft"],["premium","Premium Fashion"]] as [Opt,string][]).map(([k,label])=><button key={k} onClick={()=>setOutfit(k)} aria-pressed={outfit===k} className={outfit===k?styles.on:styles.off}>{label}</button>)}</div><small>Mesh garment A/B thật. Premium còn cần artist fit và sculpt.</small></section>
<section><h2>03 · Eyes / Hair</h2><div className={styles.grid}>{([["natural","Natural"],["doll","Doll"],["idol","Idol"],["heart","Heart"]] as [Eye,string][]).map(([k,label])=><button key={k} onClick={()=>setEye(k)} aria-pressed={eye===k} className={eye===k?styles.on:styles.off}>{label}</button>)}</div>
<div className={styles.grid}>{([["classic","Classic A"],["pony","Fashion B"]] as [Hair,string][]).map(([k,label])=><button key={k} onClick={()=>setHair(k)} aria-pressed={hair===k} className={hair===k?styles.on:styles.off}>{label}</button>)}</div><small>Eye selection đang thay tint iris; chưa phải EyePack geometry.</small></section>
<section><h2>04 · Accessories</h2><label><input type="checkbox" checked={glasses} onChange={e=>setGlasses(e.target.checked)}/> Kính</label><label><input type="checkbox" checked={ribbon} onChange={e=>setRibbon(e.target.checked)}/> Hair clips</label></section>
<section><h2>05 · Dance QA</h2><button disabled={!uuid} className={styles.dance} onClick={toggle}>{play?"■ Stop / Reset":"▶ Dance loop · 8 beats"}</button>
<p className={styles.diag}>Actor UUID: {uuid||"loading"}</p><p className={styles.diag}>AnimationMixer: {uuid?"1 instance, persistent":"loading"} · {play?"PLAYING":"STOPPED"}</p>
<a href={source} download="unified-heroine-v1.glb">Tải real GLB candidate</a></section>
<section><h2>Giới hạn</h2><p>Chưa nghiệm thu visual hay skinning lúc nhảy. Không thay Character Catalog, gameplay hoặc WebAudio. Tài sản gốc: VRoid sample A/B của pixiv.</p></section>
</aside></div></main>;
}

