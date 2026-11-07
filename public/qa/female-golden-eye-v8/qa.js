import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadRigData,createEyeRig} from './eye-rig.js';

const stage=document.querySelector('#stage'),status=document.querySelector('#status');
const descriptions={natural:'Tự nhiên · hổ phách ấm, iris tròn.',joyful:'Tươi cười · mí dưới cong lên, iris vẫn rõ.',sad:'Buồn · đầu mày nâng, đuôi mắt dịu.',playful:'Tinh nghịch · cả hai mắt nhìn sang phải của màn hình.',angry:'Giận dữ · chân mày hướng vào trong, mí trên sắc.',doll:'Búp bê · mở rộng viền mắt, iris lavender cân giữa.',idol:'Thần tượng · sapphire và họa tiết lấp lánh.',star:'Ngôi sao · sao vàng thẳng ở tâm iris.',heart:'Trái tim · trái tim hồng đầy đủ, đúng chiều.'};
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}
catch(e){status.textContent='Thiết bị/trình duyệt không tạo được WebGL. Chưa thể render model tại đây.';document.querySelector('#file').disabled=true;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;stage.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#f5eeff','#695173',2));
const key=new THREE.DirectionalLight('#fff1df',3);key.position.set(-1.5,2,3);scene.add(key);
const rim=new THREE.DirectionalLight('#ad9bff',1.5);rim.position.set(1,1,-2);scene.add(rim);
const camera=new THREE.PerspectiveCamera(36,1,.01,20);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=.35;controls.maxDistance=3.5;
let model=null,rig=null,current='natural',busy=false,quarter=false,zoom=false,loads=0;
function resize(){const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);resize();
function view(){if(!model)return;const yaw=quarter?Math.PI/5:0,d=zoom?.72:1.38;controls.target.set(0,zoom?.515:.56,zoom?.15:.02);camera.position.copy(controls.target).add(new THREE.Vector3(Math.sin(yaw)*d,0,Math.cos(yaw)*d));camera.lookAt(controls.target);controls.update();}
let resources;
async function getResources(){
 if(!resources)resources=Promise.all([loadRigData(),new THREE.TextureLoader().loadAsync('./approved-iris-atlas.webp').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=true;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;})]).catch(e=>{resources=null;throw e;});
 return resources;
}
function controlsEnabled(enabled){document.querySelectorAll('[data-look],#compare-original').forEach(b=>b.disabled=!enabled);}
function setStyle(id){if(!rig||busy)return;current=id;rig.setStyle(id);document.querySelector('#compare-original').setAttribute('aria-pressed','false');document.querySelectorAll('[data-look]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.look===id)));document.querySelector('#concept-note').textContent=descriptions[id];status.textContent='Đã chọn '+descriptions[id]+' Không tải lại GLB.';}
function disposeModel(root){
 if(!root)return;const maps=new Set(),materials=new Set(),geometries=new Set();
 root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)maps.add(v);}}});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());
}
document.querySelector('#file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file||busy)return;busy=true;controlsEnabled(false);let candidate=null,newRig=null;
 try{
  if(!file.name.toLowerCase().endsWith('.glb'))throw Error('Chỉ hỗ trợ GLB nguyên bản.');
  status.textContent='Đang đọc GLB trên thiết bị và chuẩn bị gói mắt…';
  const [data,atlas]=await getResources();const bytes=await file.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==data.meta.sourceSha256)throw Error('File khác Female_anime_origin.glb gốc đã kiểm tra. Model hiện có được giữ lại.');
  candidate=(await new GLTFLoader().parseAsync(bytes,'')).scene;let source=null;
  candidate.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count===data.meta.vertexCount)source=o;});
  if(!source)throw Error('Không tìm thấy mesh đầu tương thích.');
  newRig=createEyeRig(THREE,source,data,atlas);newRig.setStyle(current);
  // Compile before releasing the previous model; a failed load is recoverable.
  const staging=new THREE.Scene();staging.add(candidate);await renderer.compileAsync(staging,camera);staging.remove(candidate);
  if(rig)rig.dispose();if(model){scene.remove(model);disposeModel(model);}
  model=candidate;candidate=null;rig=newRig;newRig=null;scene.add(model);loads++;
  document.querySelector('#metrics').textContent=`${(file.size/1048576).toFixed(1)} MiB GLB cục bộ · 2 nhãn cầu + 2 iris cong · ${loads} lần nạp`;
  busy=false;setStyle(current);view();controlsEnabled(true);
 }catch(err){newRig?.dispose();disposeModel(candidate);status.textContent='Không mở được: '+(err.message||String(err));console.error(err);controlsEnabled(!!rig);}
 finally{busy=false;e.target.value='';}
});
document.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>setStyle(b.dataset.look)));
document.querySelector('#compare-original').addEventListener('click',e=>{if(!rig)return;const original=e.currentTarget.getAttribute('aria-pressed')!=='true';rig.setOriginal(original);e.currentTarget.setAttribute('aria-pressed',String(original));status.textContent=original?'Model gốc: khôi phục toàn bộ hình học, iris và chân mày.':'Đang xem Golden Eye V8 · '+descriptions[current];});
document.querySelector('#front').addEventListener('click',()=>{quarter=false;view();});document.querySelector('#quarter').addEventListener('click',()=>{quarter=true;view();});document.querySelector('#zoom').addEventListener('click',e=>{zoom=!zoom;e.currentTarget.setAttribute('aria-pressed',String(zoom));view();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='WebGL bị gián đoạn. Đợi khôi phục hoặc mở lại trang.';});
renderer.domElement.addEventListener('webglcontextrestored',()=>{status.textContent='WebGL đã khôi phục.';});
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
// Read-only diagnostics for focused automation; no other app state is exposed.
Object.defineProperty(window,'goldenEyeV8',{get:()=>({loads,busy,rig:rig?.state,renderer:renderer.info.render,programs:renderer.info.programs?.map(p=>({runnable:p.diagnostics?.runnable}))})});
