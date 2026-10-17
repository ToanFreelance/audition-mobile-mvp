"use client";

import type { ReactNode } from "react";
import type { MatchStartSession } from "../../multiplayer/match-start-protocol";
import type { MatchParticipantSnapshot, RoomParticipant, RoomState } from "../../multiplayer/types";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import { getCharacterCatalogEntry } from "../character/character-catalog";
import styles from "./PreparingStagePanel.module.css";

type DisplaySession = Pick<MatchStartSession,
  "matchId" | "roomRevision" | "startRevision" | "startAtServerMs" | "participants" | "manifest">;

type Props = {
  phase: "start-intent" | "preloading" | "countdown" | "playing";
  room: RoomState | null;
  session: DisplaySession | null;
  localParticipantId: string;
  progressPercent: number;
  allParticipantsLoaded: boolean;
  audioScheduled: boolean;
  stageReady?: boolean;
  startDetail?: string | null;
  children?: ReactNode;
};

function CheckMark() {
  return <svg viewBox="0 0 34 34" fill="none" aria-hidden="true">
    <circle cx="17" cy="17" r="13" stroke="currentColor" strokeWidth="2.3"/>
    <path d="m10.3 17 4.6 4.6 8.5-9.1" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function Spinner() {
  return <svg className={styles.spinner} viewBox="0 0 34 34" fill="none" aria-hidden="true">
    <circle cx="17" cy="17" r="12.5" stroke="currentColor" strokeWidth="5" opacity=".24"/>
    <path d="M17 4.5a12.5 12.5 0 0 1 12.5 12.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
  </svg>;
}
function Crown() {
  return <svg className={styles.crown} viewBox="0 0 34 26" fill="none" aria-hidden="true">
    <path d="M3 7.5 11 14l6-11 6 11 8-6.5-3 14H6L3 7.5Z" fill="#ffd44a" stroke="#fff1ac" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M7 24h20" stroke="#ffe692" strokeWidth="2.3" strokeLinecap="round"/>
  </svg>;
}
function availableLevel(participant: RoomParticipant | MatchParticipantSnapshot | undefined): string {
  // The accepted concept illustrates Lv.25. RoomState does not store level:
  // never invent profile information in live multiplayer UI.
  if (participant && "level" in participant &&
    typeof participant.level === "number" && Number.isFinite(participant.level)) {
    return `Lv. ${participant.level}`;
  }
  return "DANCER";
}

type Step = {number: string; label: string; done: boolean; active: boolean};
const STEP_RECTS = [
  { x: 32, y: 160, width: 190, height: 94, radius: 40 },
  { x: 246, y: 160, width: 194, height: 94, radius: 40 },
  { x: 458, y: 160, width: 194, height: 94, radius: 40 },
  { x: 664, y: 160, width: 178, height: 94, radius: 37 },
] as const;

/**
 * Reference plate, traced against the owner's 873×644 processing sketch.
 * All decorative vectors share one immutable coordinate system, so they never
 * drift independently across iPhone/tablet/landscape. No text or fake
 * progress/roster information is baked into this SVG.
 */
function Chrome({steps, progressPercent}: {steps: readonly Step[]; progressPercent: number}) {
  const geometry = STEP_RECTS;
  return <svg className={styles.chrome} viewBox="0 0 873 644" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="c3-plate-bg" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#171956"/><stop offset=".4" stopColor="#101247"/><stop offset="1" stopColor="#100b3d"/>
      </linearGradient>
      <radialGradient id="c3-plate-glow" cx=".16" cy=".08" r=".92">
        <stop stopColor="#7258d8" stopOpacity=".25"/><stop offset="1" stopColor="#1a125a" stopOpacity="0"/>
      </radialGradient>
      <linearGradient id="c3-frame" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#b7ffff"/><stop offset=".3" stopColor="#8e8cff"/><stop offset=".69" stopColor="#fa79ff"/><stop offset="1" stopColor="#6de9ff"/>
      </linearGradient>
      <linearGradient id="c3-blue" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#187abd"/><stop offset=".6" stopColor="#124e9b"/><stop offset="1" stopColor="#24126b"/>
      </linearGradient>
      <linearGradient id="c3-purple" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#9632f5"/><stop offset=".64" stopColor="#6824be"/><stop offset="1" stopColor="#251069"/>
      </linearGradient>
      <linearGradient id="c3-dark-step" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#191861"/><stop offset=".6" stopColor="#121042"/><stop offset="1" stopColor="#080f32"/>
      </linearGradient>
      <linearGradient id="c3-track" x1="0" x2="1">
        <stop stopColor="#ff78ff"/><stop offset=".35" stopColor="#f68cf8"/><stop offset=".78" stopColor="#ffbafc"/><stop offset="1" stopColor="#fff4ff"/>
      </linearGradient>
      <filter id="c3-neon" x="-30%" y="-45%" width="160%" height="190%">
        <feGaussianBlur stdDeviation="5"/>
      </filter>
      <filter id="c3-soft" x="-18%" y="-20%" width="136%" height="140%">
        <feGaussianBlur stdDeviation="3"/>
      </filter>
    </defs>
    <rect x="6" y="7" width="861" height="630" rx="41" fill="#8040ff" opacity=".32" filter="url(#c3-neon)"/>
    <rect x="2.4" y="2.4" width="868.2" height="639.2" rx="41" fill="url(#c3-plate-bg)"
      stroke="url(#c3-frame)" strokeWidth="4"/>
    <rect x="7.8" y="7.8" width="857.4" height="627" rx="36" fill="url(#c3-plate-glow)"
      stroke="#8977fc" strokeWidth="1.2" strokeOpacity=".58"/>
    <path d="M45 4H829" stroke="#f1faff" strokeWidth="2" strokeOpacity=".68" filter="url(#c3-soft)"/>
    <path d="M90 80h18l5-12 7 24 6-35 6 44 6-21h19" stroke="#76ecff" strokeWidth="2.5"
      fill="none" opacity=".92"/>
    <path d="M90 80h18l5-12 7 24 6-35 6 44 6-21h19" stroke="#76ecff" strokeWidth="2.5"
      fill="none" transform="translate(866 0) scale(-1 1)" opacity=".92"/>
    <path d="M94 78H132M741 78H778" stroke="#53d8ff" strokeWidth="3" filter="url(#c3-soft)"/>
    <path d="M125 207H760" stroke="#cd6cff" strokeWidth="6" opacity=".8" filter="url(#c3-soft)"/>
    <path d="M125 207H760" stroke="#a7a3ff" strokeWidth="2" opacity=".87"/>
    {geometry.map((g,index) => {
      const step=steps[index];
      const on=step.done || step.active;
      const color=step.done
        ? index===1?"#e57aff":"#69efff"
        : step.active?"#d179ff":"#5c61a7";
      return <g key={index}>
        <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={g.radius} fill={color}
          opacity={on?".34":".1"} filter="url(#c3-neon)"/>
        <rect x={g.x+2} y={g.y+2} width={g.width-4} height={g.height-4} rx={g.radius-2}
          fill={step.done ? (index===1?"url(#c3-purple)":"url(#c3-blue)"):"url(#c3-dark-step)"}
          stroke={color} strokeWidth={on?3:2} />
        <rect x={g.x+6} y={g.y+6} width={g.width-12} height={g.height-12} rx={g.radius-6}
          fill="none" stroke={color} strokeOpacity={on?".52":".15"} strokeWidth="1.1"/>
      </g>;
    })}
    <rect x="50" y="281" width="682" height="37" rx="20" fill="#9164ff" opacity=".34" filter="url(#c3-soft)"/>
    <rect x="53" y="285" width="673" height="29" rx="15" fill="#0b0d43" stroke="#9f9eff" strokeWidth="2.4"/>
    {progressPercent>0 && <rect x="58" y="290" width={Math.max(0,Math.min(662,662*progressPercent/100))}
      height="19" rx="10" fill="url(#c3-track)" stroke="#fff0ff" strokeWidth=".7"/>}
    <rect x="33" y="373" width="806" height="253" rx="23" fill="#19146a" fillOpacity=".36"
      stroke="#7863ed" strokeWidth="1.7"/>
    <rect x="49" y="427" width="772" height="193" rx="18" fill="#080e40" fillOpacity=".55"
      stroke="#575ac4" strokeWidth="1.1"/>
    <path d="M47 376H825" stroke="#bb73ff" strokeWidth="2" opacity=".3" filter="url(#c3-soft)"/>
  </svg>;
}

export default function PreparingStagePanel({
  phase,room,session,localParticipantId,progressPercent,allParticipantsLoaded,
  audioScheduled,stageReady=false,startDetail,children,
}:Props) {
  const dancers=session?.participants??[];
  const loaded=dancers.filter(p=>p.state==="loaded").length;
  const localLoaded=dancers.some(p=>p.participantId===localParticipantId&&p.state==="loaded");
  const epochReady=session?.startAtServerMs!=null;
  const steps:Step[]=[
    {number:"01",label:"PRELOAD",done:localLoaded,active:Boolean(session)&&!localLoaded},
    {number:"02",label:"LOADED",done:allParticipantsLoaded,active:localLoaded&&!allParticipantsLoaded},
    {number:"03",label:"SYNC",done:epochReady,active:allParticipantsLoaded&&!epochReady},
    {number:"04",label:"STAGE READY",done:stageReady,active:epochReady&&!stageReady},
  ];
  const progress=Math.max(0,Math.min(100,progressPercent));
  return <section className={styles.panel} data-phase={phase}
    data-audio-scheduled={audioScheduled?"1":"0"}
    data-testid={session?"preload-state":"start-intent-state"} role="status">
    <div className={styles.plate}>
      <Chrome steps={steps} progressPercent={progress}/>
      <div className={styles.heading}><h2>PREPARING STAGE</h2></div>
      <p className={styles.subtitle}>Loading stage, characters, animations, and shared epoch…</p>
      <div className={styles.steps} data-testid="preload-steps" aria-label="Tiến trình chuẩn bị">
        {steps.map((step,index)=><div key={step.number} className={styles.step}
          data-step-state={step.done?"done":step.active?"active":"pending"}
          data-testid={`preload-step-${step.number}`}>
          <div className={styles.stepCopy}><b>{step.number}</b><small>{step.label}</small></div>
          <div className={styles.stepMark}>{step.done?<CheckMark/>:step.active?<Spinner/>:null}</div>
        </div>)}
      </div>
      <div className={styles.meterRow}>
        <div className={styles.meter} role="progressbar" aria-label="Tỷ lệ chuẩn bị thật"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}/>
        <output className={styles.percent}>{progress}%</output>
      </div>
      {session ? <div className={styles.metadata}>
        <span data-testid="preload-match-id" title={session.matchId}>{session.matchId}</span>
        <small>room r<span data-testid="preload-room-revision">{session.roomRevision}</span>
          {" · "}start r<span data-testid="preload-start-revision">{session.startRevision}</span>
          {epochReady && <><span className={styles.epoch}>
            {" · epoch "}<span data-testid="start-at-server-ms">{Math.round(session.startAtServerMs as number)}</span>
          </span></>}
        </small>
      </div> : <div className={styles.metadata} data-testid="start-intent-detail">
        {startDetail??"Đang xác nhận START…"}
      </div>}
      {session && <div className={styles.roster}>
        <div className={styles.rosterHeading}>
          <div className={styles.rosterHeadingMain}>
            <svg viewBox="0 0 32 24" fill="currentColor" aria-hidden="true">
              <circle cx="8" cy="6" r="3.6"/><circle cx="24" cy="6" r="3.6"/><circle cx="16" cy="4" r="4.2"/>
              <path d="M.8 21v-7c0-4 4.2-5.1 7.2-5.1 2.2 0 3.4.6 4.4 1.8-3.4 1.6-4 4-4 6.9V21Zm30.4 0v-7c0-4-4.2-5.1-7.2-5.1-2.2 0-3.4.6-4.4 1.8 3.4 1.6 4 4 4 6.9V21ZM10.6 22v-7c0-4.5 3-6 5.4-6 2.4 0 5.4 1.5 5.4 6v7Z"/>
            </svg>
            <strong>DANCERS READY</strong>
            <b data-testid="dancers-loaded-count">{loaded}/{dancers.length}</b>
          </div>
          <span className={styles.rosterStatus}>
            {allParticipantsLoaded?"All clients loaded":`${loaded}/${dancers.length} loaded`}
            {allParticipantsLoaded && <CheckMark/>}
          </span>
        </div>
        <div className={styles.rosterGrid} data-testid="preload-participants"
          style={{gridTemplateColumns:`repeat(${Math.max(1,dancers.length)},minmax(0,${dancers.length===1?"110px":"1fr"}))`}}>
          {dancers.map(person=>{
            const member=room?.participants.find(p=>p.participantId===person.participantId)
              ??session.manifest.participants.find(p=>p.participantId===person.participantId);
            const portrait=member?getCharacterCatalogEntry(avatarCharacterAssetId(member.avatar))?.portraitUrl:undefined;
            return <div className={styles.dancer} data-load-state={person.state}
              data-testid={`preload-participant-${person.participantId}`} key={person.participantId}>
              <div className={styles.avatarRing}>
                {portrait?<img src={portrait} alt="" aria-hidden="true"/>:
                  <span>{(member?.displayName??person.participantId).slice(0,2).toUpperCase()}</span>}
                {person.role==="host"&&<Crown/>}
              </div>
              <strong title={member?.displayName??person.participantId}>
                {member?.displayName??person.participantId}
              </strong>
              <small>{availableLevel(member)}</small>
              <div className={`${styles.loadBadge} ${person.state==="loaded"?styles.loadBadgeDone:""}`}>
                {person.state==="loaded"&&<CheckMark/>}
                {person.state==="loaded"?"LOADED":person.state.toUpperCase()}
              </div>
            </div>;
          })}
        </div>
      </div>}
    </div>
    <div className={styles.recovery}>{children}</div>
  </section>;
}
