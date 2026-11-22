"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {AnimeLiteV2Scene,type AriaState,type AriaDiagnostic,type AriaCamera,type AriaHair,type AriaOutfit,type AriaEye} from "./AnimeLiteV2Scene";
import styles from "./style.module.css";
const initial:AriaState={camera:"full",hair:"long",outfit:"dress",eye:"honey",dancing:false};
const views:[AriaCamera,string][]=[
 ["full","Full Body"],["front","Front"],["left","3/4 Left"],
 ["right","3/4 Right"],["face","Face Close-up"],
];
export default function AnimeLiteHeroineV2(){
 const viewport=useRef<HTMLDivElement|null>(null);
 const engine=useRef<AnimeLiteV2Scene|null>(null);
 const [state,setState]=useState<AriaState>(initial);
 const [progress,setProgress]=useState("Đang khởi tạo 3D viewer...");
 const [diag,setDiag]=useState<AriaDiagnostic|null>(null);
 const update=(patch:Partial<AriaState>)=>setState(s=>({...s,...patch}));
 useEffect(()=>{
  if(!viewport.current)return;
  const v=new AnimeLiteV2Scene(viewport.current,setProgress,setDiag);
  engine.current=v;
  void v.loadAll();
  return ()=>{v.dispose();if(engine.current===v)engine.current=null};
 },[]);
 useEffect(()=>{engine.current?.setState(state)},[state]);
 return <main className={styles.page}>
  <header className={styles.header}>
   <div className={styles.kicker}>AUDITION MOBILE MVP · ISOLATED CHARACTER QA</div>
   <h1>Anime Lite <span>Heroine V2</span></h1>
   <p>Option A — một base nhân vật 3D mới hoàn toàn, độc lập với VRoid V1. Mục tiêu là form mặt, mũi, má và tóc có chiều sâu sạch, theo tinh thần Audition nhưng anime nhẹ.</p>
   <div className={styles.links}>
    <Link href="/tools/unified-heroine-v1">So sánh với Unified Heroine V1</Link>
    <span>V2 chỉ là candidate · chưa áp dụng vào Character Catalog</span>
   </div>
  </header>
  <div className={styles.layout}>
   <div className={styles.viewer}>
    <div ref={viewport} className={styles.viewport} aria-label="3D Anime Lite heroine preview"/>
    <div className={styles.tag}>NEW BASE · 53 bones · CC0 · REAL 3D</div>
    <div className={styles.overlay}>
     <strong>Anime Lite V2 · Sculpted face / native rig</strong>
     <small>{progress}</small>
    </div>
   </div>
   <div className={styles.panel}>
    <section>
     <h2>01 · Camera — đánh giá khối 3D</h2>
     <div className={styles.grid}>{views.map(([key,label])=>
      <button key={key} className={state.camera===key?styles.active:styles.button} aria-pressed={state.camera===key} onClick={()=>update({camera:key})}>{label}</button>)}</div>
     <small>Vuốt để xoay nhân vật, chụm để zoom. Kiểm tra đặc biệt góc 3/4 — đường sống mũi, má, cằm và thể tích tóc.</small>
    </section>
    <section>
     <h2>02 · Hair — mesh 3D riêng</h2>
     <div className={styles.grid}>
      {([["long","Soft Long"],["bob","French Bob"]] as [AriaHair,string][]).map(([k,label])=>
       <button key={k} className={state.hair===k?styles.active:styles.button} onClick={()=>update({hair:k})} aria-pressed={state.hair===k}>{label}</button>)}
     </div>
    </section>
    <section>
     <h2>03 · Outfit — skinned modules</h2>
     <div className={styles.grid}>
      {([["dress","Rose Dress"],["street","Street Fashion"]] as [AriaOutfit,string][]).map(([k,label])=>
       <button key={k} className={state.outfit===k?styles.active:styles.button} onClick={()=>update({outfit:k})} aria-pressed={state.outfit===k}>{label}</button>)}
     </div>
     <small>Trang phục và tóc dùng chính skeleton V2, không tạo thêm nhân vật khác khi đổi.</small>
    </section>
    <section>
     <h2>04 · Eye / Expression</h2>
     <div className={styles.grid}>
      {([["honey","Honey"],["hazel","Hazel"],["violet","Violet"]] as [AriaEye,string][]).map(([k,label])=>
       <button key={k} className={state.eye===k?styles.active:styles.button} onClick={()=>update({eye:k})} aria-pressed={state.eye===k}>{label}</button>)}
     </div>
     <button className={styles.secondary} onClick={()=>engine.current?.blinkOnce()}>Blink Test</button>
     <small>Đây là đổi material/morph cơ bản, chưa phải Eye Pack Premium hay Character Creation production.</small>
    </section>
    <section>
     <h2>05 · Rig / Animation</h2>
     <button className={styles.dance} onClick={()=>update({dancing:!state.dancing})}>{state.dancing?"Dừng Dance Preview":"▶ Dance / Skeleton Preview"}</button>
     <small>Dance QA do một AnimationMixer điều khiển. Không dùng WebAudio gameplay clock và không sửa timeline.</small>
    </section>
    <section>
     <h2>06 · Technical diagnostics</h2>
     <div className={styles.diagnostics}>
      <div>Actor UUID: {diag?.actorUUID??"loading"}</div>
      <div>Skinned meshes: {diag?.skinnedMeshes??0}</div>
      <div>Bones: {diag?.bones??0} / Runtime blink morphs: {diag?.faceMorphTargets??0} / Source morphs: 92</div>
      <div>AnimationMixer: {diag?.animationMixers??0} / FPS: {diag?.fps??"—"}</div>
      <div>Matched bone bindings: {diag?.matchedBones??0}</div>
      <div>Loaded: {diag?.loadedModules.join(", ")??"—"}</div>
      {diag?.errors.map((e,i)=><div key={i} className={styles.warning}>{e}</div>)}
     </div>
     <small>Performance trên iPhone cần kiểm chứng thực tế. Không đánh dấu Visual PASS trước khi bạn nghiệm thu.</small>
    </section>
   </div>
  </div>
  <footer className={styles.footer}>
   Asset base/hair/outfits CC0 từ <a href="https://github.com/kblood/CharacterCreator" target="_blank" rel="noreferrer">CharacterCreator / MakeHuman</a>.
   Đây là thử nghiệm candidate riêng trong PR #24, không thay nhân vật được chấp nhận trong game.
  </footer>
 </main>;
}

