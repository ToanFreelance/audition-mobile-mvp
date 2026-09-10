import {test,expect} from '@playwright/test';
import {DEFAULT_MUSIC_CONFIG} from '../game/music-config';

function audioFixture(seconds:number){
  const rate=8000, count=seconds*rate, bytes=Buffer.alloc(44+count*2);
  bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
  bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
  bytes.write('data',36);bytes.writeUInt32LE(count*2,40);
  for(let i=0;i<count;i++)bytes.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*400),44+i*2);
  return bytes;
}
const chart={...DEFAULT_MUSIC_CONFIG,id:'qa-authored',title:'Authored QA audio',audioUrl:'/qa-audio.wav',BPM_exact:105,durationMs:35000,spaceStartMs:6000};
test.beforeEach(async({page})=>{
  await page.route('**/api/music-config',route=>route.fulfill({json:{configs:[chart,{...chart,id:'invalid',spaceStartMs:0}]}}));
  await page.route('**/qa-audio.wav',route=>route.fulfill({contentType:'audio/wav',body:audioFixture(35)}));
});
for(const width of [390,430])test(`portrait ${width}: authored chart, controls, command and gauge fit`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:932});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?debug=1&seed=123');
  await expect(page.getByRole('button',{name:'START',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'♫ SELECT SONG',exact:true}).click();
  await expect(page.locator('.song-picker-item')).toHaveCount(1);
  await page.getByRole('button',{name:'×',exact:true}).click();
  await page.getByRole('button',{name:'START',exact:true}).click();
  await expect.poll(async()=>JSON.parse(await page.getByTestId('rhythm-debug').innerText()).songTimeMs).toBeGreaterThan(200);
  await expect(page.locator('.command-key').first()).toBeVisible({timeout:10000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const direction of ['left','up','down','right']){
    const box=await page.getByRole('button',{name:direction,exact:true}).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(40);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
  const gauge=await page.getByRole('img',{name:'Audition timing gauge'}).boundingBox();
  expect(gauge!.width).toBeLessThanOrEqual(width);expect(errors).toEqual([]);
});
test('same action layer: incomplete SPACE cannot succeed, keyboard completes command, replay resets runtime',async({page})=>{
  await page.goto('/?debug=1&seed=123');
  await page.getByRole('button',{name:'START',exact:true}).click();
  await expect(page.locator('.command-key').first()).toBeVisible({timeout:10000});
  await page.keyboard.press('Space');
  expect(JSON.parse(await page.getByTestId('rhythm-debug').innerText()).lastJudgement).toBe(null);
  const direction=await page.locator('.command-key').first().getAttribute('data-direction');
  await page.keyboard.press('Arrow'+direction![0].toUpperCase()+direction!.slice(1));
  await expect(page.locator('.command-key.done')).toHaveCount(1);
  await page.getByRole('button',{name:'↻ REPLAY',exact:true}).click();
  await expect.poll(async()=>JSON.parse(await page.getByTestId('rhythm-debug').innerText()).playableAbsoluteTurn).toBe(0);
  expect(JSON.parse(await page.getByTestId('rhythm-debug').innerText()).perfectStreak).toBe(0);
});
test('normal UI hides rhythm diagnostics',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('button',{name:'START',exact:true})).toBeEnabled();
  await expect(page.getByTestId('rhythm-debug')).toHaveCount(0);
});
