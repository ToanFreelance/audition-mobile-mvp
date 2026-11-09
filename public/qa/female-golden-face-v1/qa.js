import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadRigData,createEyeRig} from '../female-golden-eye-v8/eye-rig.js';

import {loadMouthData,createMouthRig} from './mouth-rig.js';
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
let mouthRig=null,mouthData=null,mouthId='natural',mouthStart=-1,mouthOnce=false,transitionStart=-1,transitionFrom=null;
let model=null,rig=null,current='natural',busy=false,quarter=false,zoom=false,loads=0;
let blinkStart=-1,nextBlinkAt=0,showingOriginal=false;
let motionStart=-1,motionOnce=false;
const MOTION_CYCLE_MS=5300;
const expressionStyles=new Set(['joyful','sad','angry','doll']);
const motionDescriptions={
 natural:'Nhìn nhẹ hai bên khi bật diễn hoạt; dáng mắt Golden không đổi.',
 joyful:'Mí bình thường → nở nụ cười → trở lại bình thường.',
 sad:'Mí và chân mày bình thường → buồn dịu → trở lại bình thường.',
 playful:'Cả hai tròng mắt liếc phải → trái → phải, không kéo méo iris.',
 angry:'Mí và chân mày bình thường → giận dữ → trở lại bình thường.',
 doll:'Mí bình thường → mở to tròn → trở lại bình thường.',
 idol:'Liếc rất nhẹ để tạo cảm giác mắt sống động.',
 star:'Liếc nhẹ, ngôi sao luôn cùng xoay với iris 3D.',
 heart:'Liếc nhẹ, trái tim luôn cùng xoay với iris 3D.'
};
const autoBlink=()=>document.querySelector('#auto-blink').checked;
const autoMotion=()=>document.querySelector('#auto-motion').checked;
const BLINK_CLOSE_MS=120,BLINK_HOLD_MS=40,BLINK_OPEN_MS=170;
const BLINK_TOTAL_MS=BLINK_CLOSE_MS+BLINK_HOLD_MS+BLINK_OPEN_MS;
function smooth01(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
function scheduleNextBlink(now){nextBlinkAt=now+2600+Math.random()*2600;}
function animateBlink(now){
 if(!rig||busy||showingOriginal)return;
 if(blinkStart<0 && autoBlink() && now>=nextBlinkAt)blinkStart=now;
 if(blinkStart<0)return;
 const elapsed=now-blinkStart;
 if(elapsed>=BLINK_TOTAL_MS){rig.setBlink(0);blinkStart=-1;scheduleNextBlink(now);return;}
 let amount=1;
 if(elapsed<BLINK_CLOSE_MS)amount=smooth01(elapsed/BLINK_CLOSE_MS);
 else if(elapsed>=BLINK_CLOSE_MS+BLINK_HOLD_MS)
  amount=1-smooth01((elapsed-BLINK_CLOSE_MS-BLINK_HOLD_MS)/BLINK_OPEN_MS);
 rig.setBlink(amount);
}
function lerp(a,b,t){return a+(b-a)*smooth01(t);}
function stopMotion(){
 motionStart=-1;motionOnce=false;
 if(rig){rig.setExpression(0);rig.resetGaze();}
}
function restartMotion(now){
 motionStart=now;motionOnce=false;
 if(!rig)return;
 rig.setBlink(0);rig.resetGaze();
 rig.setExpression(expressionStyles.has(current)?1:0);
}
function animateMotion(now){
 if(!rig||busy||showingOriginal||motionStart<0)return;
 let elapsed=now-motionStart;
 if(elapsed>=MOTION_CYCLE_MS && motionOnce){
  if(autoMotion()){motionOnce=false;motionStart=now;elapsed=0;}
  else {stopMotion();return;}
 }
 const t=elapsed%MOTION_CYCLE_MS;
 if(expressionStyles.has(current)){
  let neutral=1;
  if(t>=700 && t<1250)neutral=1-smooth01((t-700)/550);
  else if(t>=1250 && t<2650)neutral=0;
  else if(t>=2650 && t<3350)neutral=smooth01((t-2650)/700);
  rig.setExpression(neutral);
  rig.resetGaze();
 }else if(current==='playful'){
  // Whole 3D iris + highlight turns as one; both pivots use identical yaw.
  let yaw=-.25;
  if(t>=650 && t<1300)yaw=lerp(-.25,.21,(t-650)/650);
  else if(t>=1300 && t<2100)yaw=.21;
  else if(t>=2100 && t<2750)yaw=lerp(.21,-.25,(t-2100)/650);
  else if(t>=3750 && t<4250)yaw=lerp(-.25,0,(t-3750)/500);
  else if(t>=4250)yaw=0;
  rig.setExpression(0);
  rig.setGaze(yaw);
 }else{
  // Subtle life for neutral / idol / star / heart, no altered texture.
  rig.setExpression(0);
  rig.setGaze(.055*Math.sin(t/MOTION_CYCLE_MS*Math.PI*2));
 }
}
function resize(){const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);resize();
let cameraMode='face';
function view(){if(!model)return;const yaw=quarter?Math.PI/5:0,d=cameraMode==='mouth'?.43:cameraMode==='eyes'?.72:1.38;controls.target.set(0,cameraMode==='mouth'?.335:cameraMode==='eyes'?.515:.56,cameraMode==='face'?.02:.23);camera.position.copy(controls.target).add(new THREE.Vector3(Math.sin(yaw)*d,0,Math.cos(yaw)*d));camera.lookAt(controls.target);controls.update();}
let resources;
async function getResources(){
 if(!resources)resources=Promise.all([loadRigData(new URL('../female-golden-eye-v8/',import.meta.url)),new THREE.TextureLoader().loadAsync('../female-golden-eye-v8/approved-iris-atlas.webp').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=true;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;}),loadMouthData(),new THREE.TextureLoader().loadAsync('./mouth-skin.webp').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;return t;})]).catch(e=>{resources=null;throw e;});
 return resources;
}
function controlsEnabled(enabled){document.querySelectorAll('[data-look],#compare-original,#blink-now,#motion-now,#auto-blink,#auto-motion,[data-mouth],#mouth-now,#auto-mouth').forEach(b=>b.disabled=!enabled);}
function setStyle(id){
 if(!rig||busy)return;
 current=id;rig.setStyle(id);mouthRig?.setOriginal(false);showingOriginal=false;blinkStart=-1;updateDebug();
 const now=performance.now();scheduleNextBlink(now);
 if(autoMotion())restartMotion(now);else stopMotion();
 document.querySelector('#compare-original').setAttribute('aria-pressed','false');
 document.querySelectorAll('[data-look]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.look===id)));
 document.querySelector('#concept-note').textContent=descriptions[id];
 document.querySelector('#motion-note').textContent=motionDescriptions[id]+' Iris/hoa văn giữ nguyên preset.';
 status.textContent='Đã chọn '+descriptions[id]+' Không tải lại GLB.';
}
function disposeModel(root){
 if(!root)return;const maps=new Set(),materials=new Set(),geometries=new Set();
 root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)maps.add(v);}}});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());
}
document.querySelector('#file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file||busy)return;busy=true;controlsEnabled(false);let candidate=null,newRig=null,newMouthRig=null;
 try{
  if(!file.name.toLowerCase().endsWith('.glb'))throw Error('Chỉ hỗ trợ GLB nguyên bản.');
  status.textContent='Đang đọc GLB trên thiết bị và chuẩn bị gói mắt…';
  const [data,atlas,md,skin]=await getResources();mouthData=md;const bytes=await file.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==data.meta.sourceSha256)throw Error('File khác Female_anime_origin.glb gốc đã kiểm tra. Model hiện có được giữ lại.');
  candidate=(await new GLTFLoader().parseAsync(bytes,'')).scene;let source=null;
  candidate.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count===data.meta.vertexCount)source=o;});
  if(!source)throw Error('Không tìm thấy mesh đầu tương thích.');
  newRig=createEyeRig(THREE,source,data,atlas);newRig.setStyle(current);newMouthRig=createMouthRig(THREE,source,md,skin);newMouthRig.setPreset(mouthId);
  // Compile before releasing the previous model; a failed load is recoverable.
  const staging=new THREE.Scene();staging.add(candidate);await renderer.compileAsync(staging,camera);staging.remove(candidate);
  if(mouthRig)mouthRig.dispose();if(rig)rig.dispose();if(model){scene.remove(model);disposeModel(model);}
  model=candidate;candidate=null;rig=newRig;newRig=null;mouthRig=newMouthRig;newMouthRig=null;mouthStart=-1;transitionStart=-1;scene.add(model);loads++;
  document.querySelector('#metrics').textContent=`${(file.size/1048576).toFixed(1)} MiB GLB cục bộ · mắt V8 + miệng V1 độc lập · ${loads} lần nạp`;
  busy=false;setStyle(current);view();controlsEnabled(true);
 }catch(err){newMouthRig?.dispose();newRig?.dispose();disposeModel(candidate);status.textContent='Không mở được: '+(err.message||String(err));console.error(err);controlsEnabled(!!rig);}
 finally{busy=false;e.target.value='';}
});
document.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>setStyle(b.dataset.look)));
document.querySelector('#compare-original').addEventListener('click',e=>{if(!rig)return;const original=e.currentTarget.getAttribute('aria-pressed')!=='true';rig.setOriginal(original);mouthRig.setOriginal(original);showingOriginal=original;stopMouth();blinkStart=-1;
 if(original){motionStart=-1;motionOnce=false;}
 else{const now=performance.now();scheduleNextBlink(now);if(autoMotion())restartMotion(now);else stopMotion();}e.currentTarget.setAttribute('aria-pressed',String(original));status.textContent=original?'Model gốc: khôi phục toàn bộ hình học, mắt và miệng gốc.':'Golden Face V1 · mắt '+current+' · miệng '+mouthId;});
document.querySelector('#blink-now').addEventListener('click',()=>{
 if(!rig||busy||showingOriginal)return;
 rig.setBlink(0);blinkStart=performance.now(); // Works with auto-blink unchecked.
});
document.querySelector('#auto-blink').addEventListener('change',e=>{
 blinkStart=-1;if(rig)rig.setBlink(0);
 if(e.target.checked)scheduleNextBlink(performance.now());
});
document.querySelector('#auto-motion').addEventListener('change',e=>{
 if(!rig||showingOriginal)return;
 if(e.target.checked)restartMotion(performance.now());else stopMotion();
});
document.querySelector('#motion-now').addEventListener('click',()=>{
 if(!rig||busy||showingOriginal)return;
 restartMotion(performance.now());motionOnce=true; // One full cycle, even if auto is OFF.
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden||!rig)return;
 blinkStart=-1;rig.setBlink(0);scheduleNextBlink(performance.now());
 if(autoMotion()&&!showingOriginal)restartMotion(performance.now());
});
document.querySelector('#front').addEventListener('click',()=>{quarter=false;view();});document.querySelector('#quarter').addEventListener('click',()=>{quarter=true;view();});document.querySelector('#zoom').addEventListener('click',e=>{cameraMode='eyes';view();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='WebGL bị gián đoạn. Đợi khôi phục hoặc mở lại trang.';});
renderer.domElement.addEventListener('webglcontextrestored',()=>{status.textContent='WebGL đã khôi phục.';});
renderer.setAnimationLoop((time)=>{animateBlink(time);animateMotion(time);animateMouth(time);controls.update();renderer.render(scene,camera);});
// Read-only diagnostics for focused automation; no other app state is exposed.
Object.defineProperty(window,'goldenEyeV8',{get:()=>({loads,busy,rig:rig?.state,blinkActive:blinkStart>=0,autoBlink:autoBlink(),autoMotion:autoMotion(),motionActive:motionStart>=0,renderer:renderer.info.render,programs:renderer.info.programs?.map(p=>({runnable:p.diagnostics?.runnable}))})});

function updateDebug(){document.querySelector('#active-presets').textContent=`eyePresetId: ${current} · mouthPresetId: ${mouthId}`;}
function stopMouth(){mouthStart=-1;mouthOnce=false;transitionStart=-1;if(mouthRig)mouthRig.setPreset(mouthId);}
function chooseMouth(id){
 if(!mouthRig||busy)return;
 // Exit original comparison without touching eye pose, gaze or checkbox states.
 if(showingOriginal){rig.setOriginal(false);mouthRig.setOriginal(false);showingOriginal=false;document.querySelector('#compare-original').setAttribute('aria-pressed','false');}
 const from=mouthRig.state.weights;mouthId=id;mouthRig.setPreset(id);mouthRig.setWeights(from);transitionFrom=from;transitionStart=performance.now();mouthStart=-1;
 document.querySelectorAll('[data-mouth]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mouth===id)));updateDebug();
 status.textContent='Miệng: '+mouthData.styles.find(s=>s.id===id).label+' · giữ nguyên mắt '+current;
}
function animateMouth(now){
 if(!mouthRig||busy||showingOriginal)return;
 if(transitionStart>=0){const t=smooth01((now-transitionStart)/280),k=mouthData.styles.findIndex(s=>s.id===mouthId);const w=transitionFrom.map((v,i)=>v*(1-t)+(i===k?t:0));mouthRig.setWeights(w);if(t>=1){transitionStart=-1;mouthRig.setPreset(mouthId);}return;}
 const auto=document.querySelector('#auto-mouth').checked;
 if(mouthStart<0){if(auto){mouthStart=now;mouthOnce=false;}else return;}
 const elapsed=now-mouthStart;
 if(elapsed>=3200&&mouthOnce&&!auto){stopMouth();return;}
 const t=elapsed%3200;let amount=t<650?1-smooth01(t/650):t<1150?0:t<1900?smooth01((t-1150)/750):1;
 // M01 previews its reversible Natural↔Soft Smile pair, preserving selected ID.
 if(mouthId==='natural'){const w=[amount,1-amount,0,0,0,0,0,0,0];mouthRig.setWeights(w);}else mouthRig.setAmount(amount);
}
document.querySelectorAll('[data-mouth]').forEach(b=>b.addEventListener('click',()=>chooseMouth(b.dataset.mouth)));
document.querySelector('#mouth-now').addEventListener('click',()=>{if(!mouthRig||showingOriginal)return;transitionStart=-1;mouthStart=performance.now();mouthOnce=true;});
document.querySelector('#auto-mouth').addEventListener('change',e=>{stopMouth();if(e.target.checked)mouthStart=performance.now();});
document.querySelector('#mouth-zoom').addEventListener('click',()=>{cameraMode='mouth';view();});
document.querySelector('#whole-face').addEventListener('click',()=>{cameraMode='face';view();});
Object.defineProperty(window,'goldenFaceV1',{get:()=>({eyePresetId:current,mouthPresetId:mouthId,loads,busy,original:showingOriginal,eye:rig?.state,mouth:mouthRig?.state,eyeAnimations:{autoBlink:autoBlink(),autoExpression:autoMotion()},mouthAnimations:{enabled:document.querySelector('#auto-mouth').checked,active:mouthStart>=0,transition:transitionStart>=0},memory:renderer.info.memory,programs:renderer.info.programs?.map(p=>({runnable:p.diagnostics?.runnable}))})});
updateDebug();
