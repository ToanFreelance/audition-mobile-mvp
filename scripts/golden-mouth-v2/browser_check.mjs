// Genuine WebGL2 framebuffer + shader/independence checks. Never implies iPhone QA.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const [url,source,playwrightPath,chromePath,threeRoot,output]=process.argv.slice(2);
const {chromium}=await import(pathToFileURL(path.resolve(playwrightPath)));fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:chromePath,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={pass:false,physicalIPhone:'NOT_TESTED',hardwareGPU:false,scope:process.env.M01_VISUAL_ONLY?'lighting/framebuffer/restore':'full focused regression'};
try{
 const page=await browser.newPage({viewport:{width:1100,height:930},deviceScaleFactor:1});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 // Same pinned r180 package, local transport avoids unrelated CDN availability.
 await page.route('https://cdn.jsdelivr.net/npm/three@0.180.0/**',async route=>{
  const rel=new URL(route.request().url()).pathname.split('/three@0.180.0/')[1];
  await route.fulfill({path:path.join(threeRoot,rel),contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.goto(url);await page.locator('#file').setInputFiles(source);
 await page.waitForFunction(()=>window.goldenMouthV2?.loads===1,null,{timeout:90000});
 assert.equal(await page.evaluate(()=>goldenMouthV2.webgl2),true);
 const initial=await page.evaluate(()=>goldenMouthV2);assert.ok(initial.triangles>400000);
 assert.equal(initial.mouth.morphCount,3);
 await page.evaluate(()=>{window.sig=async arr=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',arr.buffer)),b=>b.toString(16).padStart(2,'0')).join('');});
 const morphId=initial.mouth.geometryId;
 const eyeIds=process.env.M01_VISUAL_ONLY?[]:await page.locator('#eyes option').evaluateAll(es=>es.map(e=>e.value));
 let combinations=0;
 for(const id of eyeIds){
  await page.locator('#eyes').selectOption(id);
  await page.locator('#blink').fill('0.6');await page.locator('#blink').dispatchEvent('input');
  await page.locator('#expression').fill('0.4');await page.locator('#expression').dispatchEvent('input');
  const before=await page.evaluate(()=>({eye:goldenMouthV2.eye,weights:m01Test.read().eyeWeights}));
  assert.deepEqual(before.weights,[.36,.4,.24]);
  for(const sel of ['#native','#m01']){
   await page.locator(sel).click();
   const after=await page.evaluate(()=>({eye:goldenMouthV2.eye,weights:m01Test.read().eyeWeights,state:goldenMouthV2.mouth}));
   assert.deepEqual(after.eye,before.eye);assert.deepEqual(after.weights,before.weights);
   assert.equal(after.state.geometryId,morphId);assert.equal(after.state.morphCount,3);combinations++;
  }
 }
 await page.locator('#eyes').selectOption('natural');
 const m01Hash=await page.evaluate(()=>sig(m01Test.read().position));
 await page.locator('#native').click();const nativeHash=await page.evaluate(()=>sig(m01Test.read().position));assert.notEqual(nativeHash,m01Hash);
 await page.locator('#m01').click();assert.equal(await page.evaluate(()=>sig(m01Test.read().position)),m01Hash);
 await page.locator('#original').click();const restored=await page.evaluate(async()=>({vertices:m01Test.read().position.length/3,triangles:m01Test.read().index.length/3,hash:await sig(m01Test.read().position),normal:await sig(m01Test.read().normal)}));
 assert.equal(restored.vertices,292645);assert.equal(restored.triangles,499762);
 const bytes=fs.readFileSync(source),js=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),base=28+bytes.readUInt32LE(12),prim=js.meshes[0].primitives[0];
 const crypto=await import('node:crypto');
 for(const [key,hash] of [['POSITION',restored.hash],['NORMAL',restored.normal]]){const a=js.accessors[prim.attributes[key]],v=js.bufferViews[a.bufferView],chunk=bytes.subarray(base+(v.byteOffset||0)+(a.byteOffset||0),base+(v.byteOffset||0)+(a.byteOffset||0)+a.count*12);assert.equal(crypto.createHash('sha256').update(chunk).digest('hex'),hash);}
 await page.evaluate(()=>m01Test.draw());await page.locator('canvas').screenshot({path:path.join(output,'webgl-original.png')});
 await page.locator('#original').click();assert.equal(await page.evaluate(()=>sig(m01Test.read().position)),m01Hash);
 for(const view of ['front','left35','right35','mouth']){await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(350);await page.evaluate(()=>m01Test.draw());await page.locator('canvas').screenshot({path:path.join(output,`webgl-${view}.png`)});}
 const final=await page.evaluate(()=>goldenMouthV2);assert.equal(final.loads,1);assert.equal(final.glError,0);assert.deepEqual(errors,[]);
 assert.ok(final.programs.length>0&&final.programs.every(p=>p.linked&&p.runnable!==false));
 const shaderChecks=await page.evaluate(()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2');const pixels=new Uint8Array(64*64*4);g.readPixels(Math.floor(c.width/2)-32,Math.floor(c.height/2)-32,64,64,g.RGBA,g.UNSIGNED_BYTE,pixels);let lo=255,hi=0;for(let i=0;i<pixels.length;i+=4){lo=Math.min(lo,pixels[i]);hi=Math.max(hi,pixels[i]);}return{pixelRange:[lo,hi],error:g.getError()};});assert.ok(shaderChecks.pixelRange[1]-shaderChecks.pixelRange[0]>10);assert.equal(shaderChecks.error,0);
 Object.assign(report,{pass:true,browser:await browser.version(),renderer:final.gpu,webglVersion:final.version,eyeMouthSelections:combinations,originalRestored:restored,loads:final.loads,programs:final.programs,shaderChecks,errors,geometryIdStable:true,eyeWeightsPreserved:true});
 // Responsive layout check only; not physical Safari/GPU acceptance.
 await page.setViewportSize({width:390,height:844});await page.locator('[data-view="front"]').click();await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);await page.screenshot({path:path.join(output,'webgl-mobile-layout.png'),fullPage:true});
}catch(e){report.error=e.stack;throw e;}finally{fs.writeFileSync(path.join(output,'webgl-diagnostics.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
