const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),three=process.env.THREE_DIR||path.join(root,'work/three');
const stem=path.join(root,'out','Vita-Premium-Cute-V11');
const entries={'/':path.join(__dirname,'web.html'),'/wardrobe.glb':path.join(root,'review/wardrobe.glb'),'/asset.glb':stem+'.glb','/asset.vrm':stem+'.vrm','/vrm.js':process.env.VRM_JS||path.join(root,'work/three-vrm/lib/three-vrm.module.min.js')};
(async()=>{
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost').pathname;
 const f=entries[u]||(u.startsWith('/three/')?path.resolve(three,'.'+u.slice(6)):null);
 if(!f||(!entries[u]&&!f.startsWith(three+'/'))||!fs.existsSync(f)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',u==='/'?'text/html':f.endsWith('.js')?'text/javascript':'model/gltf-binary');fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
if(process.argv.includes('--serve')){console.log('http://127.0.0.1:'+server.address().port);return;}
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 for(const mode of ['wardrobe','glb','vrm']){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:'+server.address().port+'/?photos=1&mode='+mode);
 await page.waitForFunction(()=>window.qa||window.failure,{}, {timeout:120000});
 const err=await page.evaluate(()=>window.failure);if(err)throw Error(err);
 const q=await page.evaluate(()=>window.qa);fs.writeFileSync(path.join(root,'review',mode+'-qa.json'),JSON.stringify(q,null,2));
 if(q.error||q.strengths.happy<.99||q.strengths.blink<.99||q.proof.some(s=>!s.faceRigAndExpressionStable))throw Error(JSON.stringify(q));
 const shot=name=>page.screenshot({path:path.join(root,'review',name+'.png')});
 await shot(mode+'-mobile');
 await page.evaluate(()=>frame(0,true));await shot(mode+'-face');
 if(mode==='wardrobe'){
  await page.evaluate(()=>{frame(20,true);expr('happy')});await shot('swap-bob-bow');
  await page.evaluate(()=>swap('HairSlot','swept-lob'));await shot('swap-lob-bow');
  await page.evaluate(()=>swap('HeadAccessorySlot','off'));await shot('swap-lob-off');
  await page.evaluate(()=>{frame(0,false);expr('neutral')});await shot('swap-club');
  await page.evaluate(()=>swap('OutfitSlot','vita-stage'));await shot('swap-vita');
 }
 await page.close();
 }
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
