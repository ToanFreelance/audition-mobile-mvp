/* Isolated GLB review. Dependencies: Three 0.180.0, Playwright, Chromium. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const pageHTML = `<!doctype html><html><style>*{margin:0}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const renderer = new T.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setSize(720,800); document.body.append(renderer.domElement);
const scene=new T.Scene(); scene.background=new T.Color(0x505061);
const camera=new T.OrthographicCamera(-.18585,.18585,.2065,-.2065,.01,10);
camera.position.set(0,1.547,1); camera.lookAt(0,1.535,0);
scene.add(new T.HemisphereLight(0xfff5fc,0xa49cbd,1.50));
for (const [x,y,z,p] of [[-.6,.7,.8,2],[.5,.4,.6,1],[.4,.8,-.7,1.5]]) {
 const light=new T.DirectionalLight(0xfff8fc,p);light.position.set(x,y,z);scene.add(light);
}
const { scene:avatar }=await new GLTFLoader().loadAsync('/avatar.glb');
scene.add(avatar); const items=[]; 
avatar.traverse(o=>{if(o.isMesh) items.push({name:o.name,skinned:o.isSkinnedMesh??false,triangles:o.geometry.index.count/3,morphs:o.morphTargetInfluences?.length??0});});
await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
const gl=renderer.getContext();
window.review={three:T.REVISION,context:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),triangles:renderer.info.render.triangles,meshes:items,error:gl.getError()};
</script></html>`;
(async()=>{
 const server=http.createServer((req,res)=>{
   if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(pageHTML);return;}
   const three=path.join(root,'work/three');
   const f=req.url==='/avatar.glb'?path.join(root,'out/Vita-Style04-Hair-POC-V1.glb'):path.resolve(three,'.'+decodeURI(req.url.slice(6)));
   if((req.url!=='/avatar.glb'&&!f.startsWith(three+'/'))||!fs.existsSync(f)){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'model/gltf-binary');fs.createReadStream(f).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
    const page=await browser.newPage({viewport:{width:720,height:800}});
    page.on('pageerror',e=>console.error(e));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.review,{},{timeout:90000});
    const result=await page.evaluate(()=>window.review);
    if(result.error||result.triangles<1000)throw new Error('WebGL draw failed');
    fs.writeFileSync(path.join(root,'review/webgl.json'),JSON.stringify(result,null,2));
    await page.screenshot({path:path.join(root,'review/11-three-webgl2-front.png')});
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
