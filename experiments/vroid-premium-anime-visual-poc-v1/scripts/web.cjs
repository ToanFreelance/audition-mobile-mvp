const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),three=process.env.THREE_DIR||path.join(root,'work/three');
const stem=path.join(root,'out','Vita-Premium-Anime-V1-B');
const entries={'/':path.join(__dirname,'web.html'),'/asset.glb':stem+'.glb','/asset.vrm':stem+'.vrm','/vrm.js':path.join(root,'work/three-vrm/lib/three-vrm.module.min.js')};
(async()=>{
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost').pathname;
 const f=entries[u]||(u.startsWith('/three/')?path.resolve(three,'.'+u.slice(6)):null);
 if(!f||(!entries[u]&&!f.startsWith(three+'/'))||!fs.existsSync(f)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',u==='/'?'text/html':f.endsWith('.js')?'text/javascript':'model/gltf-binary');fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 for(const mode of ['vrm','glb']){
 const page=await browser.newPage({viewport:{width:530,height:620}});
 page.on('pageerror',e=>console.error(e));page.on('console',m=>{if(m.type()==='error')console.error(m.text())});
 await page.goto('http://127.0.0.1:'+server.address().port+'/?mode='+mode);
 await page.waitForFunction(()=>window.qa||window.failure,{}, {timeout:90000});
 const err=await page.evaluate(()=>window.failure);if(err)throw Error(err);
 const q=await page.evaluate(()=>window.qa);fs.writeFileSync(path.join(root,'review',mode+'-webgl2.json'),JSON.stringify(q,null,2));
 for(const [key,yaw,label] of [['neutral',0,'front'],['neutral',35,'35'],['happy',0,'smile'],['blink',0,'blink'],['aa',0,'open'],['surprised',0,'surprised']]){
 await page.evaluate(([k,a])=>window.setPortrait(k,a),[key,yaw]);
 await page.screenshot({path:path.join(root,'review',mode+'-'+label+'.png')});
 }
 if(q.glError||q.morphCount!==41||q.headMotionMetres<.0001||Object.entries(q.strengths).some(([n,v])=>n!=='neutral'&&v<.99))throw Error('Validation failed: '+JSON.stringify(q.strengths));
 await page.close();
 }
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
