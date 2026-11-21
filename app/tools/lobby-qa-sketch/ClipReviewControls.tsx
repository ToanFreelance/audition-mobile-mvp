"use client";

import {useEffect,useState} from "react";
import {MIXAMO_GROUPS,type MixamoGesture,type MixamoRig} from "../../../components/character/mixamo-lobby-data";

type ReviewMark = "ok"|"slide";
const textName=(id:string)=>id.split("-").map(t=>t==="2"?"2":t.charAt(0).toUpperCase()+t.slice(1)).join(" ");
const typeName=(id:MixamoGesture,rig:MixamoRig)=>{
  const group=MIXAMO_GROUPS[rig];
  return group.base.includes(id)?"Idle (base)":
    group.emote.includes(id)?"Emote":"Manual";
};

export default function ClipReviewControls({
  family, pelvisFix, sideStepV6, contactV7, contactV8,
}:{
  family:MixamoRig;
  pelvisFix:boolean;
  sideStepV6:boolean;
  contactV7:boolean;
  contactV8:boolean;
}){
  const clips:MixamoGesture[]=[
    ...MIXAMO_GROUPS[family].base,
    ...MIXAMO_GROUPS[family].emote,
    ...MIXAMO_GROUPS[family].manual,
  ];
  const [current,setCurrent]=useState<MixamoGesture>(clips[0]);
  const [ready,setReady]=useState(false);
  const [time,setTime]=useState(0);
  const [duration,setDuration]=useState(0);
  const [slow,setSlow]=useState(false);
  const [side,setSide]=useState(false);
  const [expanded,setExpanded]=useState(true);
  const [marks,setMarks]=useState<Partial<Record<MixamoGesture,ReviewMark>>>({});
  const [copied,setCopied]=useState(false);
  const index=Math.max(0,clips.indexOf(current));
  const actorName=family==="drophunter"?"Nữ (M3 Drophunter)":"Nam (M3 Neurohacker)";

  function tell(command:string,id?:string,value?:string|number){
    window.dispatchEvent(new CustomEvent("m3-idle-review",{
      detail:{command,id,value},
    }));
  }
  function choose(id:MixamoGesture){
    if(!ready)return;
    setCurrent(id);
    setTime(0);
    tell("select",id);
  }
  function href(gender:"female"|"male",v8:boolean){
    const query=new URLSearchParams({
      m3:gender,mixamo:"1",clipReview:"1",contactV4:"1",
      pelvisFix:pelvisFix?"1":"0",sideStepV6:sideStepV6?"1":"0",
      contactV7:contactV7?"1":"0",contactV8:v8&&contactV7?"1":"0",
    });
    return "/tools/lobby-qa-sketch?"+query.toString();
  }

  useEffect(()=>{
    const stage=document.querySelector<HTMLElement>('[data-testid="waiting-room-stage"]');
    if(!stage)return;
    let selected=false;
    const update=()=>{
      const isReady=stage.dataset.stageReady==="1"
        && stage.dataset.m3IdleCount==="1"
        && stage.dataset.m3ClipReview==="1";
      setReady(isReady);
      if(!isReady)return;
      if(!selected){
        selected=true;
        // For a single-clip review, explicitly reset the first clip from t=0.
        // The Mixamo runtime blocks all shuffle and crossfades in this mode.
        tell("select",clips[0]);
      }
      const actual=stage.dataset.m3ActiveGestures;
      if(actual && clips.includes(actual as MixamoGesture))
        setCurrent(actual as MixamoGesture);
      const seconds=Number(stage.dataset.m3ReferenceTimes||"0");
      if(Number.isFinite(seconds))setTime(seconds);
      const total=Number(stage.dataset.m3ReviewClipDurations||"0");
      if(Number.isFinite(total))setDuration(total);
    };
    const observer=new MutationObserver(update);
    observer.observe(stage,{attributes:true,attributeFilter:[
      "data-stage-ready","data-m3-idle-count","data-m3-clip-review",
      "data-m3-active-gestures","data-m3-reference-times",
      "data-m3-review-clip-durations",
    ]});
    update();
    return ()=>observer.disconnect();
    // Navigation between male/female remounts this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[family]);

  async function copyMarks(){
    const rows=clips.map((id,i)=>`${i+1}. ${id}: ${marks[id]==="slide"?"TRƯỢT CHÂN":marks[id]==="ok"?"ỔN":"chưa kiểm tra"}`);
    const text=[`Audition M3 clip review — ${actorName}`,
      `V6: ${sideStepV6}, V7: ${contactV7}, V8: ${contactV8}`,
      ...rows].join("\n");
    try{
      await navigator.clipboard.writeText(text);
      setCopied(true);
    }catch{
      setCopied(false);
    }
  }
  const buttonStyle={
    border:"1px solid rgba(255,255,255,.33)",borderRadius:9,
    background:"#303c56",color:"white",minHeight:42,
    padding:"6px 10px",fontSize:14,fontWeight:600 as const,
  };
  return (
    <section
      data-testid="clip-review-controls"
      aria-label="Duyệt từng animation"
      style={{
        position:"fixed",top:"max(8px,env(safe-area-inset-top))",
        left:"50%",transform:"translateX(-50%)",
        zIndex:1200,width:"min(96vw,490px)",maxHeight:"min(52vh,450px)",
        overflowY:"auto",padding:10,borderRadius:14,
        background:"rgba(14,23,40,.96)",border:"1px solid #465573",
        color:"white",fontSize:13,boxShadow:"0 6px 24px #0007",
      }}
    >
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
        <div>
          <div style={{fontSize:12,opacity:.8}}>M3 · Review từng clip · {actorName}</div>
          <strong data-testid="clip-review-current" style={{fontSize:17}}>
            {index+1}/{clips.length} · {textName(current)}
          </strong>
          <div style={{fontSize:11,opacity:.75}}>
            {typeName(current,family)} · {time.toFixed(1)}/{duration.toFixed(1)}s ·
            {" "}{!ready?"Đang tải nhân vật":duration>0&&time>=duration-.05
              ?"Đã hết clip, bấm Phát lại":"Đang phát riêng một clip"}
          </div>
        </div>
        <button style={{...buttonStyle,minHeight:36,fontSize:12}}
          onClick={()=>setExpanded(v=>!v)} aria-label={expanded?"Thu gọn":"Mở điều khiển"}>
          {expanded?"Thu gọn":"Mở"}
        </button>
      </div>
      <div style={{display:"flex",gap:7,marginTop:9}}>
        <button aria-label="Back" disabled={!ready}
          style={{...buttonStyle,flex:1,opacity:ready?1:.45}}
          onClick={()=>choose(clips[(index+clips.length-1)%clips.length])}>
          ◀ Back
        </button>
        <button aria-label="Phát lại" disabled={!ready} style={{...buttonStyle,flex:1,opacity:ready?1:.45}}
          onClick={()=>choose(current)}>↺ Phát lại</button>
        <button aria-label="Next" disabled={!ready}
          style={{...buttonStyle,flex:1,background:"#385eac",opacity:ready?1:.45}}
          onClick={()=>choose(clips[(index+1)%clips.length])}>
          Next ▶
        </button>
      </div>
      {expanded && <>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:10}}>
          <label htmlFor="clip-review-choose">Chọn clip:</label>
          <select id="clip-review-choose" aria-label="Chọn animation"
            disabled={!ready} value={current}
            onChange={e=>choose(e.target.value as MixamoGesture)}
            style={{flex:"1 1 160px",minWidth:140,minHeight:38,padding:6,
              borderRadius:8,background:"#26374e",color:"#fff"}}>
            {clips.map(id=><option value={id} key={id}>{textName(id)}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
          <a href={href("female",contactV8)} aria-label="Nhân vật nữ"
            style={{color:family==="drophunter"?"#aaceff":"white",padding:5}}>
            {family==="drophunter"?"● ":""}Nữ
          </a>
          <a href={href("male",contactV8)} aria-label="Nhân vật nam"
            style={{color:family==="neurohacker"?"#aaceff":"white",padding:5}}>
            {family==="neurohacker"?"● ":""}Nam
          </a>
          <button style={{...buttonStyle,minHeight:35,fontSize:12}}
            onClick={()=>{
              const next=!side;setSide(next);tell("camera",undefined,next?"side":"front");
            }}>{side?"Góc trước":"Góc nghiêng"}</button>
          <button style={{...buttonStyle,minHeight:35,fontSize:12}}
            onClick={()=>{
              const next=!slow;setSlow(next);tell("speed",undefined,next?.25:1);
            }}>{slow?"1×":"0,25×"}</button>
        </div>
        <div style={{marginTop:8,fontSize:11,opacity:.86}}>
          Toàn bộ {clips.length} clip gốc trong catalog, kể cả clip đã loại ở V9.
          Không random, không crossfade; phát một lần rồi giữ frame cuối (không tự loop).
          V8 {contactV8?"bật":"tắt"}.
          {" "}<a href={href(family==="drophunter"?"female":"male",!contactV8)}
            style={{color:"#aed1ff"}}>{contactV8?"So sánh không V8":"Bật V8"}</a>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
          <button style={{...buttonStyle,minHeight:34,fontSize:12,background:marks[current]==="ok"?"#247a5b":"#303c56"}}
            onClick={()=>{setMarks(x=>({...x,[current]:"ok"}));setCopied(false);}}>✓ Chân ổn</button>
          <button style={{...buttonStyle,minHeight:34,fontSize:12,background:marks[current]==="slide"?"#994a4a":"#303c56"}}
            onClick={()=>{setMarks(x=>({...x,[current]:"slide"}));setCopied(false);}}>✕ Trượt chân</button>
          <button style={{...buttonStyle,minHeight:34,fontSize:12}}
            onClick={copyMarks}>{copied?"Đã copy":"Copy đánh giá"}</button>
        </div>
      </>}
    </section>
  );
}
