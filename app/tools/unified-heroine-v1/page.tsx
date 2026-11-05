"use client";
import {useEffect,useRef,useState} from "react";
import * as T from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./style.module.css";
import {UnifiedEyePack,UNIFIED_EYE_ASSETS,type UnifiedEyeAssetId} from "./UnifiedEyePack";
import {SpiderQueenFangAccessory} from "./SpiderQueenFangAccessory";
import {HeroineStudioDepth,type HeroineLightingPreset} from "./HeroineStudioDepth";
type View="full"|"front"|"left"|"right"|"face"|"eyes"|"mouth";
type Opt="basic"|"premium";
type Hair="classic"|"pony";
type Eye=UnifiedEyeAssetId;
type Stage={root:T.Group|null;scene:T.Scene;camera:T.PerspectiveCamera;renderer:T.WebGLRenderer;orbit:OrbitControls;
mixer:T.AnimationMixer|null;action:T.AnimationAction|null;eyePack:UnifiedEyePack|null;lighting:HeroineStudioDepth;rest:Map<T.Bone,T.Quaternion>;frame:number;accessory:T.Group|null;fangAccessory:SpiderQueenFangAccessory|null};
const source="/characters/unified-heroine-v1/unified-heroine-v1-a41bb9e659e5.glb";
const angles:Record<View,{p:[number,number,number];t:[number,number,number]}> = {
full:{p:[0,1.43,5.8],t:[0,1.36,0]},front:{p:[0,1.7,3.5],t:[0,1.62,0]},
left:{p:[2.5,1.7,2.8],t:[0,1.61,0]},right:{p:[-2.5,1.7,2.8],t:[0,1.61,0]},
face:{p:[0,2.3,1.4],t:[0,2.34,0]},eyes:{p:[0,2.32,.69],t:[0,2.32,0]},mouth:{p:[0,2.18,.46],t:[0,2.18,0]}};
function camera(r:Stage,k:View){r.orbit.minDistance=k==="mouth"?.28:.75;r.camera.position.set(...angles[k].p);r.orbit.target.set(...angles[k].t);r.orbit.update();}
function appearance(root:T.Group,outfit:Opt,hair:Hair){
 const classic=root.getObjectByName("Hair001");
 const fashion=root.getObjectByName("UHV1_FashionPonytail_Skinned");
 if(classic)classic.visible=hair==="classic";
 if(fashion)fashion.visible=hair==="pony";
 root.traverse(n=>{
  if(!(n instanceof T.Mesh))return;
  const materials=Array.isArray(n.material)?n.material:[n.material];
  const basic=materials.some(m=>/(Tops_|Bottoms_|Shoes_)/.test(m.name)&&!/UHV1_FashionIdol/.test(m.name));
  if(n.name.startsWith("UHV1_Premium"))n.visible=outfit==="premium";
  else if(n.name.startsWith("UHV1_Basic")||basic)n.visible=outfit==="basic";
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
   // Maintain lateral clearance on cross-steps and avoid reverse knee bends.
   i<10?new T.Euler(side*.23*s,side*.025*s,-side*.06):
   new T.Euler(.11+side*.09*s,0,0);
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
if(glasses){
 for(const side of [-1,1]){
  const rim=new T.Mesh(new T.TorusGeometry(.032,.0028,8,32),mat);
  rim.scale.y=.78;rim.position.set(side*.043,.062,-.136);group.add(rim);
 }
 const bridge=new T.Mesh(new T.CylinderGeometry(.002,.002,.023,8),mat);
 bridge.rotation.z=Math.PI/2;bridge.position.set(0,.061,-.140);group.add(bridge);
}
if(ribbon)for(const side of [-1,1]){
 // Flat barrettes following the side bangs instead of floating halo rings.
 const clip=new T.Mesh(new T.BoxGeometry(.027,.007,.004),mat);
 clip.rotation.z=side*.36;clip.position.set(side*.084,.111,-.085);group.add(clip);
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
const [eyeStatus,setEyeStatus]=useState("Chưa tải Eye Pack"),[autoBlink,setAutoBlink]=useState(false);
const [fang,setFang]=useState(false),[fangSmile,setFangSmile]=useState(false);
const [fangStatus,setFangStatus]=useState("Spider Queen Fang · chưa trang bị");
const [lightingPreset,setLightingPreset]=useState<HeroineLightingPreset>("original");
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
const lighting=new HeroineStudioDepth(scene,renderer,window.innerWidth<=600);
const r:Stage={root:null,scene,camera:cam,renderer,orbit,mixer:null,action:null,eyePack:null,lighting,rest:new Map(),frame:0,accessory:null,fangAccessory:null};
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
const tick=()=>{if(!alive)return;const dt=Math.min(clock.getDelta(),.065);r.mixer?.update(dt);r.eyePack?.tick(dt);orbit.update();renderer.render(scene,cam);r.frame=requestAnimationFrame(tick);};tick();
new GLTFLoader().load(source,g=>{
if(watchdog)clearTimeout(watchdog);
if(!alive)return;
const root=g.scene,box=new T.Box3().setFromObject(root),h=box.getSize(new T.Vector3()).y;
const scale=2.62/Math.max(h,.01);
root.scale.setScalar(scale);root.position.set(-box.getCenter(new T.Vector3()).x*scale,-box.min.y*scale,0);
root.rotation.y=Math.PI;scene.add(root);r.root=root;
lighting.attachActor(root);
let meshes=0,skins=0,bones=0,morphs=0;
root.traverse(n=>{if(n instanceof T.Mesh){meshes++;if(n instanceof T.SkinnedMesh)skins++;morphs+=n.morphTargetInfluences?.length??0;}if(n instanceof T.Bone)bones++;});
const d=danceSetup(root);r.mixer=d.mixer;r.action=d.action;r.rest=d.rest;
appearance(root,"basic","classic");
try{
 r.eyePack=new UnifiedEyePack(root,ev=>setEyeStatus(ev.assetId+" · "+ev.status+" · loaded="+ev.loaded+" · morphMeshes="+ev.morphMeshes));
 void r.eyePack.select("natural");
}catch(e){setEyeStatus("Eye Pack unavailable: "+String(e));}
try {
 r.fangAccessory=new SpiderQueenFangAccessory(root,report=>
   setFangStatus(report.status+" · "+report.meshes+" mesh · "+report.message));
}catch(e){setFangStatus("Fang setup error: "+String(e));}
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
orbit.dispose();r.mixer?.stopAllAction();r.fangAccessory?.dispose();r.eyePack?.dispose();lighting.dispose();renderer.dispose();renderer.domElement.remove();runtime.current=null;};
},[retry]);
useEffect(()=>{if(runtime.current?.root)appearance(runtime.current.root,outfit,hair)},[outfit,hair,uuid]);
useEffect(()=>{const p=runtime.current?.eyePack;if(p)void p.select(eye).catch(e=>setEyeStatus("Eye asset load error: "+String(e)))},[eye,uuid]);
useEffect(()=>{runtime.current?.eyePack?.setAutoBlink(autoBlink)},[autoBlink,uuid]);
useEffect(()=>{if(runtime.current)headGear(runtime.current,glasses,ribbon)},[glasses,ribbon,uuid]);
useEffect(()=>{const module=runtime.current?.fangAccessory;
 if(module)void module.equip(fang).catch(e=>setFangStatus("Fang load error: "+String(e)));
},[fang,uuid]);
useEffect(()=>{runtime.current?.fangAccessory?.setMouthOpen(fangSmile)},[fangSmile,fang,uuid]);
useEffect(()=>{runtime.current?.lighting.setPreset(lightingPreset)},[lightingPreset,uuid]);
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
<section><h2>01 · Camera</h2><div className={styles.grid}>{([["full","Full Body"],["front","Front"],["left","3/4 Left"],["right","3/4 Right"],["face","Face Close-up"],["eyes","Eye Macro"],["mouth","Mouth Macro"]] as [View,string][]).map(([k,label])=><button key={k} onClick={()=>changeCamera(k)} aria-pressed={view===k} className={view===k?styles.on:styles.off}>{label}</button>)}</div><small>Rotate / pinch zoom · iPhone portrait</small></section>
<section><h2>01A · Lighting Depth QA</h2>
<div className={styles.grid}>
 {([["original","Original (Current)"],["studio","Studio 3D Depth"]] as [HeroineLightingPreset,string][]).map(([preset,label])=>
  <button key={preset} onClick={()=>setLightingPreset(preset)}
   aria-pressed={lightingPreset===preset} className={lightingPreset===preset?styles.on:styles.off}>{label}</button>)}
</div>
<small>Studio dùng key/fill/rim có hướng, bóng tóc trên mặt và giảm exposure. Bật/tắt trực tiếp trên cùng actor, cùng camera. Chỉ là QA ánh sáng; không sửa mesh, morph, gameplay. Ở iPhone nên so sánh cả Face Close-up và 3/4.</small>
</section>
<section><h2>02 · Outfit</h2><div className={styles.grid}>{([["basic","Basic Soft"],["premium","Premium Fashion"]] as [Opt,string][]).map(([k,label])=><button key={k} onClick={()=>setOutfit(k)} aria-pressed={outfit===k} className={outfit===k?styles.on:styles.off}>{label}</button>)}</div><small>Mesh garment A/B thật. Premium còn cần artist fit và sculpt.</small></section>
<section><h2>03 · Eye Pack V1 / Hair</h2><div className={styles.grid}>{UNIFIED_EYE_ASSETS.map(k=><button key={k.id} onClick={()=>setEye(k.id)} aria-pressed={eye===k.id} className={eye===k.id?styles.on:styles.off}>{k.label}</button>)}</div>
<p className={styles.eyeStats} role="status">{eyeStatus}</p>
<div className={styles.grid}><button className={styles.off} type="button" disabled={!uuid} onClick={()=>runtime.current?.eyePack?.blinkOnce()}>Blink Test</button><label className={styles.check}><input type="checkbox" checked={autoBlink} onChange={e=>setAutoBlink(e.target.checked)}/> Auto Blink</label></div>
<div className={styles.grid}>{([["classic","Classic A"],["pony","Fashion B"]] as [Hair,string][]).map(([k,label])=><button key={k} onClick={()=>setHair(k)} aria-pressed={hair===k} className={hair===k?styles.on:styles.off}>{label}</button>)}</div><small>5 texture atlas thật trên iris SkinnedMesh VRoid; Blink + expression morph. Không recreate actor. Lashes hiện dùng mesh gốc, chưa sculpt lash variations.</small></section>
<section><h2>04 · Accessories / Fang QA</h2>
<label><input type="checkbox" checked={glasses} onChange={e=>setGlasses(e.target.checked)}/> Kính</label>
<label><input type="checkbox" checked={ribbon} onChange={e=>setRibbon(e.target.checked)}/> Hair clips</label>
<label><input type="checkbox" checked={fang} onChange={e=>setFang(e.target.checked)}/>
 <strong>Spider Queen Fang · real 3D</strong></label>
<label><input type="checkbox" disabled={!fang} checked={fangSmile} onChange={e=>setFangSmile(e.target.checked)}/>
 Fang Smile · mouth morph QA</label>
<p className={styles.eyeStats} role="status">{fangStatus}</p>
<small>17 mesh GLB: nanh men ngọc, filigree, gemstone. Head-bone attached; một lần tải, bật/tắt không recreate actor.</small>
</section>
<section><h2>05 · Dance QA</h2><button disabled={!uuid} className={styles.dance} onClick={toggle}>{play?"■ Stop / Reset":"▶ Dance loop · 8 beats"}</button>
<p className={styles.diag}>Actor UUID: {uuid||"loading"}</p><p className={styles.diag}>AnimationMixer: {uuid?"1 instance, persistent":"loading"} · {play?"PLAYING":"STOPPED"}</p>
<a href={source} download="unified-heroine-v1.glb">Tải real GLB candidate</a></section>
<section><h2>Giới hạn</h2><p>Chưa nghiệm thu visual hay skinning lúc nhảy. Không thay Character Catalog, gameplay hoặc WebAudio. Tài sản gốc: VRoid sample A/B của pixiv.</p></section>
</aside></div></main>;
}

