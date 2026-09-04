"use client";

import { useEffect, useId, useRef } from "react";
import type { PointerEvent } from "react";
import { getGaugeTiming } from "../game/gauge-timing";
import { WAVEFORM_MEDIA_TIME_EVENT } from "./WaveformPlayer";

type AuditionGaugeProps = { value?:number; bpm:number; animationDelayMs?:number; onPointerDown?:(event:PointerEvent<HTMLDivElement>)=>void; className?:string; zoneStart?:number; zoneEnd?:number; perfectStart?:number; perfectEnd?:number; stretchRatio?:number; spaceStartMs?:number; currentTimeMs?:number };
const clamp=(n:number)=>Math.max(0,Math.min(100,n));

/** Visual gauge sampled from one deterministic media timeline. No realtime React render or CSS clock is required. */
export default function AuditionGauge({value,bpm,onPointerDown,className="",zoneStart=70,zoneEnd=90,perfectStart:_perfectStart=79,perfectEnd:_perfectEnd=81,stretchRatio=1.6,spaceStartMs,currentTimeMs}:AuditionGaugeProps){
 const id=useId().replace(/:/g,""); const sliderRef=useRef<SVGGElement|null>(null),breathRef=useRef<SVGGElement|null>(null),lastMediaMsRef=useRef(currentTimeMs??0);
 const safeZoneStart=clamp(Math.min(zoneStart,zoneEnd)),safeZoneEnd=clamp(Math.max(zoneStart,zoneEnd));
 const trackLeftX=20,trackWidth=460,trackCenterY=35,zoneHeight=30,zoneRadius=zoneHeight*.15,x=(p:number)=>trackLeftX+(trackWidth*p)/100;
 const zoneX=x(safeZoneStart),zoneRightX=x(safeZoneEnd),zoneWidth=zoneRightX-zoneX,zoneCenterX=zoneX+zoneWidth/2;
 const fallbackValue=clamp(value??80),fallbackTranslate=x(fallbackValue)-150;

 useEffect(()=>{if(currentTimeMs!==undefined)lastMediaMsRef.current=currentTimeMs},[currentTimeMs]);
 useEffect(()=>{
   const slider=sliderRef.current,breath=breathRef.current;if(!slider||!breath||spaceStartMs===undefined)return;
   const renderAt=(nowMs:number)=>{
     const timing=getGaugeTiming({bpm,spaceStartMs},nowMs),translate=x(timing.sliderPercent)-150;
     slider.setAttribute("transform",`translate(${translate} 0)`);
     // Deterministic visual phase. A subtle 4x-per-cycle breath follows each beat,
     // while only the cycle boundary (Perfect / beat 4) gets the strong two-edge stretch.
     const cyclePhase=timing.cycleMs>0?timing.cycleElapsedMs/timing.cycleMs:0;
     const beatPhase=(cyclePhase*4)%1;
     const breathWave=(1-Math.cos(beatPhase*Math.PI*2))/2; // 0..1, gentle inhale/exhale every beat
     const distanceToPerfect=Math.min(cyclePhase,1-cyclePhase);
     const pulseWindow=.09;
     const pulse=distanceToPerfect<pulseWindow?Math.pow(1-distanceToPerfect/pulseWindow,2):0;
     const scale=1+breathWave*.035+pulse*Math.max(0,stretchRatio-1);
     const opacity=.62+breathWave*.10+pulse*.28;
     const glow=4+breathWave*2+pulse*20;
     breath.setAttribute("transform",`translate(${zoneCenterX} ${trackCenterY}) scale(${scale} 1) translate(${-zoneCenterX} ${-trackCenterY})`);
     breath.setAttribute("opacity",String(Math.min(1,opacity)));
     breath.style.filter=`drop-shadow(0 0 ${glow.toFixed(1)}px #00f0ff)${pulse>.35?" drop-shadow(0 0 20px #fff)":""}`;
   };
   renderAt(lastMediaMsRef.current);
   const onMediaTime=(event:Event)=>{const ms=(event as CustomEvent<number>).detail;if(Number.isFinite(ms)){lastMediaMsRef.current=ms;renderAt(ms)}};
   window.addEventListener(WAVEFORM_MEDIA_TIME_EVENT,onMediaTime);
   return()=>window.removeEventListener(WAVEFORM_MEDIA_TIME_EVENT,onMediaTime);
 },[bpm,spaceStartMs,stretchRatio,zoneCenterX]);

 const cyanGradientId=`${id}-cyanToWhiteGrad`,redGradientId=`${id}-redCoreGrad`,blurGlowId=`${id}-blurGlow`,blurSoftId=`${id}-blurSoft`;
 return <div className={`audition-gauge-svg ${className}`} onPointerDown={onPointerDown} style={{width:"100%",aspectRatio:"464 / 56",lineHeight:0,touchAction:"manipulation",overflow:"visible"}}>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="18 0 464 70" width="100%" height="100%" preserveAspectRatio="none" style={{overflow:"visible"}} aria-label="Audition timing gauge">
   <defs><style>{`@keyframes redGlowPulse-${id}{0%,100%{opacity:.8;transform:scale(.96)}50%{opacity:1;transform:scale(1.06)}}.pulse-red-glow-${id}{transform-origin:150px ${trackCenterY}px;animation:redGlowPulse-${id} ${60000/Math.max(1,bpm)}ms ease-in-out infinite}`}</style>
    <filter id={blurGlowId} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter><filter id={blurSoftId} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.5"/></filter>
    <linearGradient id={cyanGradientId} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#00f0ff" stopOpacity="0"/><stop offset="12%" stopColor="#00d8ff" stopOpacity=".85"/><stop offset="25%" stopColor="#70f3ff" stopOpacity=".95"/><stop offset="35%" stopColor="#fff"/><stop offset="65%" stopColor="#fff"/><stop offset="75%" stopColor="#70f3ff" stopOpacity=".95"/><stop offset="88%" stopColor="#00d8ff" stopOpacity=".85"/><stop offset="100%" stopColor="#00f0ff" stopOpacity="0"/></linearGradient><radialGradient id={redGradientId}><stop offset="0%" stopColor="#fff"/><stop offset="35%" stopColor="#ff4d4d"/><stop offset="70%" stopColor="#e11d48"/><stop offset="100%" stopColor="#880015"/></radialGradient>
   </defs>
   <rect x="20" y="12" width="460" height="46" rx="23" fill="#fff" opacity=".07" filter={`url(#${blurSoftId})`}/><rect x="20" y="12" width="460" height="46" rx="23" fill="#0a0c14" fillOpacity=".12" stroke="#a1a1aa" strokeWidth="2"/><rect x="22" y="14" width="456" height="42" rx="21" fill="none" stroke="#000" strokeWidth="1.5" opacity=".55"/>
   <g ref={breathRef} style={{transformOrigin:`${zoneCenterX}px ${trackCenterY}px`}}><rect x={zoneX} y="20" width={zoneWidth} height={zoneHeight} rx={zoneRadius} fill="#00f0ff" filter={`url(#${blurGlowId})`} opacity=".5"/><rect x={zoneX} y="22" width={zoneWidth} height="26" rx={zoneRadius} fill={`url(#${cyanGradientId})`} filter={`url(#${blurSoftId})`}/></g>
   <g ref={sliderRef} transform={`translate(${fallbackTranslate} 0)`}><g transform="translate(150 35) scale(1 1.25) translate(-150 -35)"><g className={`pulse-red-glow-${id}`}><circle cx="150" cy="35" r="15" fill="#ff0044" filter={`url(#${blurGlowId})`} opacity=".5"/><circle cx="150" cy="35" r="14" fill="none" stroke="#e4e4e7" strokeWidth="2" opacity=".9"/><circle cx="150" cy="35" r="9" fill={`url(#${redGradientId})`}/><circle cx="150" cy="35" r="4" fill="#fff" opacity=".9"/></g></g></g>
  </svg>
 </div>;
}
