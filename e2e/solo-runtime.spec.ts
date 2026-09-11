import { test, expect } from '@playwright/test';
import { RhythmRuntime } from '../game/runtime';
import { createChartFromMusicConfig } from '../game/chart';
import { DEFAULT_MUSIC_CONFIG, isPlayableMusicConfig } from '../game/music-config';
import { DEFAULT_SOLO_SETTINGS, createArrowCommand, oppositeDirection, planAfterFinish, repeatCycleTurns, seededRandom, soloCycle, targetSpaceMs, turnDurationMs, zoneExitMs } from '../game/solo-easy';
import { getGaugeTiming } from '../game/gauge-timing';
import { PERFECT_CENTER } from '../game/rhythm';

function fixture(durationMs = 600000, compact = false) {
  let time = 0;
  const chart = createChartFromMusicConfig({ ...DEFAULT_MUSIC_CONFIG, BPM_exact: 101.0544, spaceStartMs: 10060, durationMs,
    gameplay: { ...DEFAULT_MUSIC_CONFIG.gameplay, levelSequenceCounts: compact ? [1,1,1,1,1,1,1,1,1] : [1,2,3,4,5,6,6,6,6] } });
  const runtime = new RhythmRuntime(chart, {}, { seed: 123 });
  runtime.setTimeSource(() => time); runtime.start(false);
  const at = (ms: number) => { time = ms; runtime.advance(); };
  const show = () => at(Math.max(time, runtime.debug.revealAtMs + 0.001));
  const hit = (percent = PERFECT_CENTER) => {
    show(); runtime.arrowCommand.forEach(token => runtime.handleDirection(token.requiredDirection));
    at(runtime.currentTurn.targetSpaceMs + (percent - PERFECT_CENTER) / 100 * turnDurationMs(chart.bpm));
    return runtime.handleSpace();
  };
  return { runtime, chart, at, show, hit };
}

test('saved charts require all authored timing values; never fall back to display BPM', () => {
  for (const patch of [{ audioUrl:'' }, { title:' ' }, { BPM_exact:undefined }, { BPM_exact:0 }, { durationMs:0 }, { spaceStartMs:0 }]) {
    const invalid = { ...DEFAULT_MUSIC_CONFIG, ...patch };
    expect(isPlayableMusicConfig(invalid)).toBe(false);
    expect(() => createChartFromMusicConfig(invalid)).toThrow();
  }
});
for (const [name, bpm, start] of [['Aloha',101.0544,10060], ['Cannon Groove',105,10000], ['Please Tell Me Why',80.28,28870]] as const) {
  test(`${name}: exact phase through a full 10-minute grid and large absolute turn indexes`, () => {
    for (let n=0;n<=Math.ceil(600000/turnDurationMs(bpm));n++) {
      const target = targetSpaceMs(start,bpm,n);
      expect(target).toBeCloseTo(start+n*4*60000/bpm, 7);
      expect(getGaugeTiming({bpm,spaceStartMs:start},target).sliderPercent).toBeCloseTo(PERFECT_CENTER,7);
    }
    const n=100000;
    expect(targetSpaceMs(start,bpm,n)).toBe(start+n*turnDurationMs(bpm));
  });
}
test('sequence counts are global-turn budgets, command lengths are independent', () => {
  const cycle = soloCycle(1);
  expect(Array.from({length:9},(_,i)=>cycle.filter(x=>x.level===i+1).length)).toEqual([1,2,3,4,5,6,6,6,6]);
  expect(cycle.filter(x=>x.isFinish)).toHaveLength(1);
  expect(soloCycle(6)).toHaveLength(24);
  expect(createArrowCommand(9)).toHaveLength(9);
  expect(createArrowCommand(9,false,Math.random,[1,1,1,1,1,1,1,1,3])).toHaveLength(3);
});
test('countdown ends at authored Space Start and early incomplete SPACE cannot score', () => {
  const f=fixture(); f.show();
  expect(f.runtime.handleSpace()).toBeNull(); expect(f.runtime.stats.score).toBe(0);
  f.at(10060-500); expect(f.runtime.currentPhase).toBe('countdown');
  f.at(10060); expect(f.runtime.currentPhase).toBe('playing-command');
  expect(f.runtime.gaugePercent).toBeCloseTo(PERFECT_CENTER,8);
});
test('L1–5 success reveals immediately and sequence progression counts each appearance', () => {
  const f=fixture(); expect(f.hit()).toBe('perfect');
  expect(f.runtime.debug.commandVisible).toBe(true);
  expect(f.runtime.currentTurn).toMatchObject({level:2,sequenceIndex:0,absoluteTurn:1});
  f.hit(); expect(f.runtime.currentTurn).toMatchObject({level:2,sequenceIndex:1,absoluteTurn:2});
  f.hit(); expect(f.runtime.currentLevel).toBe(3);
});
test('L6–9 reveal is after the next zone-pass exit, not at target or frame-relative time', () => {
  const f=fixture(); for(let i=0;i<15;i++) f.hit();
  expect(f.runtime.currentLevel).toBe(6); const previous=f.runtime.currentTurn.absoluteTurn;
  f.hit(); expect(f.runtime.debug.commandVisible).toBe(false);
  const exit=zoneExitMs(targetSpaceMs(10060,f.chart.bpm,previous+1),f.chart.bpm);
  f.at(exit); expect(f.runtime.debug.commandVisible).toBe(false);
  f.at(exit+0.001); expect(f.runtime.debug.commandVisible).toBe(true);
  expect(f.runtime.currentTurn.absoluteTurn).toBe(previous+2);
});
for(const level of [1,6]) test(`L${level} Miss hides ${level===1?1:2} whole subsequent turns without recursive misses`,()=>{
  const f=fixture(); if(level===6) for(let i=0;i<15;i++)f.hit();
  f.show(); const previous=f.runtime.currentTurn.absoluteTurn; const hidden=level===1?1:2;
  f.at(zoneExitMs(f.runtime.currentTurn.targetSpaceMs,f.chart.bpm)+0.001);
  expect(f.runtime.stats.miss).toBe(1); expect(f.runtime.penaltyTurnsRemaining).toBe(hidden);
  for(let i=1;i<=hidden;i++){
    const exit=zoneExitMs(targetSpaceMs(10060,f.chart.bpm,previous+i),f.chart.bpm);
    f.at(exit); expect(f.runtime.debug.commandVisible).toBe(false); expect(f.runtime.handleSpace()).toBeNull();
    expect(f.runtime.stats.miss).toBe(1);
  }
  f.at(f.runtime.debug.revealAtMs+0.001);
  expect(f.runtime.debug.commandVisible).toBe(true); expect(f.runtime.stats.miss).toBe(1);
  expect(f.runtime.currentTurn.absoluteTurn).toBe(previous+hidden+1);
});
test('wrong direction resets input; all required directions must be completed',()=>{
  const f=fixture();f.show();const token=f.runtime.arrowCommand[0];
  expect(f.runtime.handleDirection(oppositeDirection(token.requiredDirection))).toBe(false);
  expect(f.runtime.awaitingTiming).toBe(false);expect(f.hit()).toBe('perfect');
});
test('Perfect streak is consecutive and resets on Great, Cool, Bad and Miss',()=>{
  for(const percent of [70,65,58,0]) {
    const f=fixture();f.hit();f.hit();expect(f.runtime.perfectStreak).toBe(2);
    f.hit(percent); expect(f.runtime.perfectStreak).toBe(0);
    f.hit();expect(f.runtime.perfectStreak).toBe(1);
  }
});
test('Finish guarantees reverse input and deterministic seeds reproduce commands',()=>{
  expect(['left','right','up','down'].map(d=>oppositeDirection(d as 'left'))).toEqual(['right','left','down','up']);
  const a=seededRandom(123),b=seededRandom(123);
  for(let i=0;i<100;i++){
    const tokens=createArrowCommand(9,true,a);expect(tokens).toEqual(createArrowCommand(9,true,b));
    expect(tokens.some(t=>t.reverse)).toBe(true);
    tokens.forEach(t=>expect(t.requiredDirection).toBe(t.reverse?oppositeDirection(t.displayDirection):t.displayDirection));
  }
});
test('Finish planner fits complete cycles, distributes rest, and drops repeats after miss cost',()=>{
  expect(repeatCycleTurns()).toBe(24);
  expect(planAfterFinish(60,182)).toMatchObject({repeatCycles:5,restTurns:2,nextAbsoluteTurn:63,finalFinish:false});
  expect(planAfterFinish(60,110)).toMatchObject({repeatCycles:2,restTurns:2});
  expect(planAfterFinish(60,110,DEFAULT_SOLO_SETTINGS,true).finalFinish).toBe(true);
  expect(planAfterFinish(60,83).finalFinish).toBe(true);
});
test('intermediate Finish remains Level 9, returns to L6, final Finish locks input until actual song end',()=>{
  const f=fixture(170000,true); let finishes=0; let guard=0;
  while(f.runtime.currentPhase!=='ending'&&guard++<100){
    if(f.runtime.currentTurn.isFinish){
      expect(f.runtime.currentLevel).toBe(9);expect(f.runtime.currentTurn.arrowCommand.some(t=>t.reverse)).toBe(true);finishes++;
      const final=f.runtime.finalFinish;f.hit();
      if(!final){expect(f.runtime.currentLevel).toBe(6);expect(f.runtime.currentPhase).toBe('post-finish-rest');}
    }else f.hit();
  }
  expect(finishes).toBeGreaterThan(1);expect(f.runtime.currentPhase).toBe('ending');
  expect(f.runtime.isFinished).toBe(false);const stats=f.runtime.stats;
  expect(f.runtime.handleSpace()).toBeNull();expect(f.runtime.handleDirection('left')).toBe(false);
  f.at(169999);expect(f.runtime.currentPhase).toBe('ending');expect(f.runtime.stats).toEqual(stats);
  f.at(170000);expect(f.runtime.currentPhase).toBe('song-finished');expect(f.runtime.isFinished).toBe(true);
});
test('dropped frames and all-miss play finish at song end with finite progression',()=>{
  const f=fixture(240000); f.at(240000);
  expect(f.runtime.isFinished).toBe(true);expect(f.runtime.stats.miss).toBeGreaterThan(0);
  expect(f.runtime.stats.miss).toBeLessThan(60);
});

test('saved Aloha: record complete perfect-run Finish decision without changing production rules', () => {
  let time = 0;
  const chart = createChartFromMusicConfig({...DEFAULT_MUSIC_CONFIG, title:'aloha', BPM_exact:101.0504, spaceStartMs:10083, durationMs:277432});
  const runtime = new RhythmRuntime(chart, {}, {seed:123});
  runtime.setTimeSource(()=>time); runtime.start(false);
  const snapshots = [];
  for(let guard=0; runtime.currentPhase!=='ending' && guard<100; guard++){
    time=Math.max(time,runtime.debug.revealAtMs+0.001);runtime.advance();
    if(runtime.currentTurn.isFinish) snapshots.push({when:'before Finish',...runtime.debug});
    runtime.arrowCommand.forEach(token=>runtime.handleDirection(token.requiredDirection));
    time=runtime.currentTurn.targetSpaceMs;runtime.advance();
    const finish=runtime.currentTurn.isFinish;
    expect(runtime.handleSpace()).toBe('perfect');
    if(finish) snapshots.push({when:'after Finish',...runtime.debug});
  }
  console.log('SAVED_ALOHA',JSON.stringify(snapshots));
  expect(runtime.currentPhase).toBe('ending');
  expect(runtime.isFinished).toBe(false);
  time=277432;runtime.advance();expect(runtime.isFinished).toBe(true);
});

test('full default repeat cycle consumes exactly its 24 global-turn budget',()=>{
  const cycle=soloCycle(6);
  expect(cycle.filter(a=>!a.isFinish)).toHaveLength(23);
  expect(cycle.filter(a=>a.isFinish)).toHaveLength(1);
  expect(cycle.filter(a=>a.level===6)).toHaveLength(6);
  expect(cycle.filter(a=>a.level===7)).toHaveLength(6);
  expect(cycle.filter(a=>a.level===8)).toHaveLength(6);
  expect(cycle.filter(a=>a.level===9)).toHaveLength(6);
  expect(repeatCycleTurns()).toBe(24);
});
test('default long-song progression completes repeat cycles and never resumes after final Finish',()=>{
  const f=fixture(600000);const finishes:number[]=[];
  for(let guard=0;guard<200&&f.runtime.currentPhase!=='ending';guard++){
    const wasFinish=f.runtime.currentTurn.isFinish;
    if(wasFinish)finishes.push(f.runtime.currentTurn.absoluteTurn);
    f.hit();
    if(wasFinish&&!f.runtime.finalFinish)expect(f.runtime.currentLevel).toBe(6);
  }
  expect(finishes.length).toBeGreaterThan(1);
  expect(finishes.slice(1).every((turn,i)=>turn-finishes[i]>=repeatCycleTurns())).toBe(true);
  const stats=f.runtime.stats;
  f.at(599999);expect(f.runtime.currentPhase).toBe('ending');expect(f.runtime.stats).toEqual(stats);
  f.at(600000);expect(f.runtime.isFinished).toBe(true);
  console.log('DEFAULT_LONG_SONG_FINISH_TURNS',finishes);
});
test('two players share identical global turns despite different penalties',()=>{
  const a=fixture(),b=fixture();a.hit();
  b.at(zoneExitMs(b.runtime.currentTurn.targetSpaceMs,b.chart.bpm)+1);
  for(const time of [15000,60000,120000,250000]){
    a.at(time);b.at(time);
    expect(a.runtime.debug.globalAbsoluteTurnIndex).toBe(b.runtime.debug.globalAbsoluteTurnIndex);
    expect(a.runtime.gaugePercent).toBe(b.runtime.gaugePercent);
  }
});
