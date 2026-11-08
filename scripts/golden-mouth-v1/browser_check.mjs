// Optional real browser regression. Requires WebGL-capable Chromium and original local GLB.
// node browser_check.mjs https://preview/qa/female-golden-face-v1/index.html /path/original.glb /path/playwright/index.mjs
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import path from 'node:path';
const {chromium}=await import(pathToFileURL(path.resolve(process.argv[4])));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.argv[2]);await page.locator('#file').setInputFiles(process.argv[3]);await page.waitForFunction(()=>window.goldenFaceV1?.loads===1,null,{timeout:90000});
 await page.locator('#auto-blink').uncheck();await page.locator('#auto-motion').uncheck();
 const eyes=await page.locator('[data-look]').evaluateAll(a=>a.map(b=>b.dataset.look)),mouths=await page.locator('[data-mouth]').evaluateAll(a=>a.map(b=>b.dataset.mouth));assert.equal(eyes.length,9);assert.equal(mouths.length,9);
 for(const e of eyes){await page.locator(`[data-look="${e}"]`).click();for(const m of mouths){await page.locator(`[data-mouth="${m}"]`).click();await page.waitForFunction(()=>!window.goldenFaceV1.mouthAnimations.transition);const s=await page.evaluate(()=>window.goldenFaceV1);assert.equal(s.eyePresetId,e);assert.equal(s.mouthPresetId,m);assert.equal(s.loads,1);assert.equal(s.eyeAnimations.autoBlink,false);assert.equal(s.eyeAnimations.autoExpression,false);}}
 const before=await page.evaluate(()=>window.goldenFaceV1.memory);
 for(let i=0;i<30;i++){await page.locator(`[data-mouth="${mouths[i%9]}"]`).click();await page.locator(`[data-look="${eyes[i%9]}"]`).click();}
 await page.waitForTimeout(600);const after=await page.evaluate(()=>window.goldenFaceV1.memory);assert.ok(after.geometries<=before.geometries+2);assert.ok(after.textures<=before.textures+2);
 await page.locator('#auto-blink').check();await page.locator('#auto-motion').check();await page.locator('#auto-mouth').check();await page.locator('#blink-now').click();await page.waitForTimeout(1200);await page.locator('#auto-motion').uncheck();await page.locator('#auto-mouth').uncheck();await page.locator('#auto-blink').uncheck();
 let s=await page.evaluate(()=>window.goldenFaceV1);assert.equal(s.eye.blink,0);assert.equal(s.eye.neutral,0);assert.equal(s.mouth.weights[mouths.indexOf(s.mouthPresetId)],1);
 await page.locator('#compare-original').click();assert.equal(await page.evaluate(()=>window.goldenFaceV1.original),true);await page.locator('#compare-original').click();
 for(const id of ['front','quarter','zoom','mouth-zoom','whole-face'])await page.locator('#'+id).click();
 await page.locator('#file').setInputFiles(process.argv[3]);await page.waitForFunction(()=>window.goldenFaceV1.loads===2);
 s=await page.evaluate(()=>window.goldenFaceV1);assert.ok(s.programs.every(p=>p.runnable!==false));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,combinations:81,cycles:30,before,after,loads:s.loads,errors}));
}finally{await browser.close();}
