import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadRigData,createEyeRig} from '../female-golden-eye-v8/eye-rig.js';
import {loadMouthData,createMouthRig} from './mouth-rig.js';
const $=s=>document.querySelector(s),stage=$('#stage');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
const gl=renderer.getContext();if(!(gl instanceof WebGL2RenderingContext))throw Error('Cần WebGL2.');
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;stage.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#404044');scene.add(new THREE.AmbientLight('#ffffff',1.1));
const key=new THREE.DirectionalLight('#ffffff',1.4);key.position.set(-1.5,2,3);scene.add(key);const fill=new THREE.DirectionalLight('#ffffff',.6);fill.position.set(1,-.4,2);scene.add(fill);
const camera=new THREE.OrthographicCamera(-.5,.5,.5,-.5,.01,20),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minZoom=.5;controls.maxZoom=4;
let model,head,eye,mouth,loads=0,original=false,busy=false,view='front',resources,mouthData,nativeGeometry;
function resize(){const w=stage.clientWidth,h=stage.clientHeight,scale=view==='mouth'?.24:.94;renderer.setSize(w,h,false);camera.left=-scale*w/h/2;camera.right=scale*w/h/2;camera.top=scale/2;camera.bottom=-scale/2;camera.updateProjectionMatrix();}
function setView(id){view=id;const a={front:0,left35:-35,right35:35,profile:90,mouth:0}[id]*Math.PI/180,y=id==='mouth'?.335:.51;controls.target.set(0,y,0);camera.position.set(1.9*Math.sin(a),y,1.9*Math.cos(a));camera.zoom=1;camera.lookAt(controls.target);resize();controls.update();}
new ResizeObserver(resize).observe(stage);setView('front');function draw(){controls.update();renderer.render(scene,camera);}renderer.setAnimationLoop(draw);
function enabled(on){document.querySelectorAll('[data-mouth],#eyes,#blink,#expression,#original').forEach(e=>e.disabled=!on);}
function chooseMouth(id){mouth.setPreset(id);document.querySelectorAll('[data-mouth]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mouth===id)));$('#pose-name').textContent=mouthData.meta.styles.find(s=>s.id===id).label;}
function compare(on){original=on;eye.setOriginal(on);mouth.setOriginal(on);$('#original').setAttribute('aria-pressed',String(on));$('#blink').value=0;$('#expression').value=0;$('#pose-name').textContent=on?'Đầu gốc':mouthData.meta.styles.find(s=>s.id===mouth.state.preset).label;}
function dispose(root){const geos=new Set(),mats=new Set(),maps=new Set();root.traverse(o=>{if(o.isMesh){geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);for(const v of Object.values(m))if(v?.isTexture)maps.add(v);}}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());}
async function shared(){if(!resources)resources=Promise.all([loadRigData(new URL('../female-golden-eye-v8/',import.meta.url)),loadMouthData(),new THREE.TextureLoader().loadAsync('../female-golden-eye-v8/approved-iris-atlas.webp').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=true;return t;})]).catch(e=>{resources=null;throw e;});return resources;}
$('#file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file||busy)return;busy=true;enabled(false);let candidate,newEye,newMouth;
 try{
  $('#status').textContent='Đang đọc model và chín kiểu miệng…';const [ed,md,atlas]=await shared(),bytes=await file.arrayBuffer();
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(sha!==md.meta.sourceSha256||sha!==ed.meta.sourceSha256)throw Error('GLB khác nguồn đã xác minh.');
  const eyeIds=new Set(ed.indices);if(md.arrays.indices.some(i=>eyeIds.has(i)))throw Error('Vùng miệng giao với vùng mắt.');
  candidate=(await new GLTFLoader().parseAsync(bytes,'')).scene;let nextHead;candidate.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count===md.meta.vertexCount)nextHead=o;});if(!nextHead)throw Error('Không tìm thấy đầu native.');
  const nextNative=nextHead.geometry;newEye=createEyeRig(THREE,nextHead,ed,atlas);newEye.setStyle($('#eyes').value);newMouth=createMouthRig(THREE,nextHead,md);
  const staging=new THREE.Scene();staging.add(candidate);await renderer.compileAsync(staging,camera);staging.remove(candidate);
  if(model){mouth.dispose();eye.dispose();scene.remove(model);dispose(model);}
  model=candidate;candidate=null;head=nextHead;eye=newEye;newEye=null;mouth=newMouth;newMouth=null;mouthData=md;nativeGeometry=nextNative;scene.add(model);loads++;original=false;
  $('#original').setAttribute('aria-pressed','false');$('#blink').value=0;$('#expression').value=0;chooseMouth('natural');setView('front');draw();$('#status').textContent='Đã nạp chín miệng · mắt V8 độc lập.';$('#metrics').textContent=`${md.meta.styles.length} kiểu miệng · ${loads} lần nạp model`;
 }catch(err){newMouth?.dispose();newEye?.dispose();if(candidate)dispose(candidate);$('#status').textContent='Lỗi: '+err.message;console.error(err);}
 finally{busy=false;enabled(!!model);e.target.value='';}
});
document.querySelectorAll('[data-mouth]').forEach(b=>b.onclick=()=>{if(original)compare(false);chooseMouth(b.dataset.mouth);});
$('#eyes').onchange=e=>{eye.setStyle(e.target.value);mouth.setOriginal(false);mouth.reapply();original=false;$('#original').setAttribute('aria-pressed','false');$('#blink').value=0;$('#expression').value=0;};
$('#blink').oninput=e=>eye.setBlink(+e.target.value);$('#expression').oninput=e=>eye.setExpression(+e.target.value);$('#original').onclick=()=>compare(!original);document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
Object.defineProperty(window,'goldenMouthV4',{get:()=>({loads,busy,original,eye:eye?.state,mouth:mouth?.state,actorId:model?.uuid,headId:head?.uuid,webgl2:gl instanceof WebGL2RenderingContext,version:gl.getParameter(gl.VERSION),gpu:gl.getExtension('WEBGL_debug_renderer_info')?gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),triangles:renderer.info.render.triangles,programs:renderer.info.programs?.map(p=>({linked:gl.getProgramParameter(p.program,gl.LINK_STATUS),runnable:p.diagnostics?.runnable})),memory:renderer.info.memory,glError:gl.getError()})});
window.mouthV4Test={draw,pause:()=>renderer.setAnimationLoop(null),read:()=>({eyeWeights:head?.morphTargetInfluences?.slice(),position:head?.geometry.attributes.position.array.slice(),normal:head?.geometry.attributes.normal.array.slice(),index:head?.geometry.index.array.slice()}),captureIdentity:()=>{window.v4Refs={actor:model,head,geo:head.geometry,p:head.geometry.attributes.position.array,n:head.geometry.attributes.normal.array,index:head.geometry.index.array};},identityStable:()=>{const r=window.v4Refs;return r.actor===model&&r.head===head&&r.geo===head.geometry&&r.p===head.geometry.attributes.position.array&&r.n===head.geometry.attributes.normal.array&&r.index===head.geometry.index.array;},mouthError:()=>{const a=mouthData.arrays,k=mouthData.meta.styles.findIndex(s=>s.id===mouth.state.preset),p=head.geometry.attributes.position.array,base=nativeGeometry.attributes.position.array;let max=0;for(let i=0;i<a.indices.length;i++)for(let j=0;j<3;j++){const id=a.indices[i]*3+j,expected=Math.fround(base[id]+a.delta[k*a.indices.length*3+i*3+j]);max=Math.max(max,Math.abs(p[id]-expected));}return max;}};
