import * as THREE from "three";
import type { StagePresentationCameraPreset } from "./stageCamera";
import {
  makeOldPlaster, makeOldFloor, makeChalkboard,
  makeGhostWindow, makeSpeakerFace, makeSchoolPaper,
  makeClassroomFloorReflections, makeWindowShaft,
} from "./haunted-classroom-textures";

/**
 * S2.5C Haunted Classroom visual prototype.
 * A REAL multi-part Three.js venue, not an image plane or video backdrop.
 * Floor centre deliberately empty for the 5-person ensemble.
 * No countries, national flags or readable Asian-language inscriptions.
 *
 * Authoritative gameplay clock and Three.js renderer remain in Stage3D.
 */
const STAGE_ID = "classroom-v1";
const PI2 = Math.PI * 2;
type Material = THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
type AnimationPart = { object: THREE.Object3D; phase: number; kind: "curtain" | "candle" | "wisp" };
const xyz=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);

function flatRing(parent: THREE.Group, x:number, z:number, radius:number, width:number,
  material: THREE.Material, from=0, extent=PI2, height=.018) {
  const n=Math.max(8,Math.ceil(110*Math.abs(extent)/PI2));
  const positions:number[]=[];
  const indices:number[]=[];
  for(let i=0;i<=n;i++){
    const a=from+extent*i/n,cs=Math.cos(a),sn=Math.sin(a);
    positions.push(x+(radius-width/2)*cs,height,z+(radius-width/2)*sn);
    positions.push(x+(radius+width/2)*cs,height,z+(radius+width/2)*sn);
    if(i<n){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,material);m.name="FadedChalkCirclePaint";parent.add(m);
}

function disposeTree(root:THREE.Object3D) {
  const materials=new Set<THREE.Material>();
  const textures=new Set<THREE.Texture>();
  const geo=new Set<THREE.BufferGeometry>();
  root.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh||obj instanceof THREE.Line||obj instanceof THREE.Points))return;
    const body=obj as THREE.Mesh;
    if(body.geometry instanceof THREE.BufferGeometry)geo.add(body.geometry);
    for(const mat of (Array.isArray(body.material)?body.material:[body.material])){
      if(!mat)continue;
      materials.add(mat);
      for(const field of Object.values(mat))if(field instanceof THREE.Texture)textures.add(field);
    }
  });
  geo.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
}

export class HauntedClassroomV1Environment {
  readonly root=new THREE.Group();
  private disposed=false;
  private loaded=false;
  private motions:AnimationPart[]=[];
  private candleGlow:THREE.PointLight[]=[];
  private initializedAt=0;

  constructor(){this.root.name="HauntedClassroomV1Environment";}

  async load(){
    if(this.disposed)throw new Error("Haunted Classroom disposed before load");
    if(!this.loaded){
      try{this.build();this.loaded=true;}
      catch(error){disposeTree(this.root);this.root.clear();throw error;}
    }
    return this.metrics();
  }

  private build(){
    const root=this.root;
    const mat=(color:number,roughness=.88,metalness=.02):Material=>
      new THREE.MeshStandardMaterial({color,roughness,metalness});
    const darkWood=mat(0x34252b,.75);
    const wornWood=mat(0x86605e,.58);
    const metal=mat(0x68717b,.48,.44);
    const darkMetal=mat(0x1c1b29,.48,.32);
    const trim=mat(0x19212e);
    const wax=mat(0xf7d9a9,.95);
    const paper=mat(0xb9ab9c);
    const violetGlow=new THREE.MeshBasicMaterial({color:0xcc78ff,toneMapped:false});
    const cyanGlow=new THREE.MeshBasicMaterial({color:0x78d8ff,toneMapped:false});
    const flameMat=new THREE.MeshBasicMaterial({color:0xffbf6d,toneMapped:false});
    const plaster=new THREE.MeshStandardMaterial({map:makeOldPlaster(),roughness:1});
    const woodTex=makeOldFloor();woodTex.wrapS=woodTex.wrapT=THREE.RepeatWrapping;woodTex.repeat.set(2,3);
    const floorMat=new THREE.MeshStandardMaterial({
      map:woodTex,roughness:.29,metalness:.13,
    });
    const paperTex=new THREE.MeshStandardMaterial({map:makeSchoolPaper(),roughness:.94,side:THREE.DoubleSide});

    const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,parent:THREE.Group=root)=>{
      const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
      obj.name=name;obj.position.set(x,y,z);parent.add(obj);return obj;
    };
    const plane=(name:string,x:number,y:number,z:number,w:number,h:number,m:THREE.Material,parent:THREE.Group=root)=>{
      const obj=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);
      obj.name=name;obj.position.set(x,y,z);parent.add(obj);return obj;
    };
    const rod=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Group=root)=>{
      const delta=b.clone().sub(a);
      const obj=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),m);
      obj.name=name;obj.position.copy(a).add(b).multiplyScalar(.5);
      obj.quaternion.setFromUnitVectors(xyz(0,1,0),delta.normalize());parent.add(obj);return obj;
    };
    const glowDisc=(name:string,x:number,y:number,z:number,r:number,m:THREE.Material,parent:THREE.Group=root)=>{
      const item=new THREE.Mesh(new THREE.CircleGeometry(r,28),m);
      item.name=name;item.position.set(x,y,z);parent.add(item);return item;
    };

    // Room shell. Side walls are actual 3D volumes, but the front is open
    // for Stage3D's accepted gameplay camera and Match intro shots.
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(22,33),floorMat);
    floor.name="FlatPlayableSchoolFloor";
    floor.rotation.x=-Math.PI/2;floor.position.set(0,-.035,1.6);root.add(floor);
    // Bring the side scenery inside the portrait frustum rather than having
    // nearly the entire classroom clipped offscreen at +/-12.9 units.
    const roomHalfWidth=9.05;
    box("RearWeatheredBlueWall",0,4.8,-12.5,19.0,9.9,.65,plaster);
    for(const side of [-1,1]){
      box("ThreeDimensionalClassroomSideWall",side*roomHalfWidth,4.7,-2.3,.50,9.6,22,plaster);
      box("TealDado",side*8.79,1.55,-2.3,.12,3.0,21,mat(0x376467));
      box("DadoBorder",side*8.77,3.03,-2.3,.13,.15,21,trim);
    }
    box("BackTealDado",0,1.55,-12.08,18.75,3.1,.12,mat(0x2e565f));
    box("BackDadoStrip",0,3.10,-12.02,18.8,.16,.2,trim);
    // Glossy, worn wood gets low-cost localized reflection decals instead of
    // a screen-space reflection/postprocessing pipeline on mobile GPU.
    const reflection=new THREE.Mesh(
      new THREE.PlaneGeometry(20,30),
      new THREE.MeshBasicMaterial({
        map:makeClassroomFloorReflections(),transparent:true,opacity:.91,
        depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
        toneMapped:false,
      }),
    );
    reflection.name="MoonlitFloorReflections";
    reflection.rotation.x=-Math.PI/2;reflection.position.set(0,.011,1.45);
    root.add(reflection);
    // Structural ceiling panels, supports, and suspended flickering LEDs.
    box("Ceiling",0,9.65,-2.0,19.0,.28,21,mat(0x344057));
    // Central overhead beam previously blocked the top third of iPhone view.
    for(const x of [-6.9,6.9])box("CeilingBeam",x,9.27,-2.0,.62,.48,21,mat(0x202b3c));
    for(const z of [-8,-2,4])box("CeilingCrossBeam",0,9.29,z,18.9,.33,.51,mat(0x29354b));
    const tubeHalo=new THREE.MeshBasicMaterial({
      color:0xb65aff,transparent:true,opacity:.22,depthWrite:false,
      side:THREE.DoubleSide,toneMapped:false,
    });
    for(const x of [-6.3,0,6.3]){
      for(const z of [-7,0]){
        box("FluorescentBlackHousing",x,8.93,z,3.15,.14,.47,trim);
        box("FluorescentPurpleLight",x,8.82,z,2.94,.08,.21,violetGlow);
        const glow=plane("FluorescentBloom",x,8.74,z,3.0,.36,tubeHalo);
        glow.rotation.x=-Math.PI/2;
        rod("SuspendedCeilingCable",xyz(x-1.2,8.91,z),xyz(x-1.2,9.4,z),.027,darkMetal);
      }
    }

    // Windows in far wall to preserve the central chalkboard silhouette.
    const skyMat=new THREE.MeshBasicMaterial({map:makeGhostWindow(),side:THREE.DoubleSide,toneMapped:false});
    const frameMat=mat(0x2c242e,.68,.13);
    const glass=new THREE.MeshBasicMaterial({color:0xd5d2fa,transparent:true,opacity:.065,depthWrite:false});
    const putWindow=(name:string,x:number,y:number,z:number,w:number,h:number,angle=0)=>{
      const windowGroup=new THREE.Group();windowGroup.name=name;
      windowGroup.position.set(x,y,z);windowGroup.rotation.y=angle;root.add(windowGroup);
      // Units measured in the window plane's own coordinates.
      box("OldWindowFrame",0,0,0,w+.5,h+.45,.22,frameMat,windowGroup);
      plane("MoonlitGhostWindow",0,0,.12,w,h,skyMat,windowGroup);
      plane("GlassyDust",0,0,.135,w,h,glass,windowGroup);
      for(const dx of [-w/2,0,w/2])box("DarkWoodMullion",dx,0,.17,.13,h,.13,frameMat,windowGroup);
      for(const dy of [-h/2,0,h/2])box("DarkWoodMullion",0,dy,.17,w,.10,.13,frameMat,windowGroup);
      box("WeatheredWindowSill",0,-h/2-.20,.35,w+.7,.16,.69,wornWood,windowGroup);
    };
    // V-shaped window bays remain honest 3D window assemblies, but are
    // brought into the camera's narrow portrait frame for readable silhouettes.
    for(const side of [-1,1]){
      putWindow("BackHauntedWindow",side*7.15,5.34,-11.92,3.15,5.68);
      for(const z of [-7,-1,3.9]){
        putWindow("SideHauntedWindow",side*8.69,5.39,z,3.0,5.50,
          side===-1 ? Math.PI/2 : -Math.PI/2);
      }
      // Angled bay toward the audience, preserving the illusion of windows
      // extending down the side corridors without leaving the gameplay view.
      putWindow("AngledPortraitWindowBay",side*7.25,5.20,-5.3,2.5,5.25,
        -side*.28);
    }
    const shaftMat=new THREE.MeshBasicMaterial({
      map:makeWindowShaft(),transparent:true,opacity:.50,depthWrite:false,
      side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      toneMapped:false,
    });
    for(const side of [-1,1]){
      const shaft=plane("MoonbeamsThroughDust",side*5.95,4.7,-5.05,3.1,7.2,shaftMat);
      shaft.rotation.y=-side*.17;
    }

    // Warm candle cabinets, art-room storage and trailing vegetation on the
    // edges recreate the lived-in haunted classroom depth of the reference.
    // These pieces occupy side/back lanes, not the playable centre.
    const cabinetBlue=mat(0x53637b,.69,.17);
    const lockerDark=mat(0x293346,.76,.09);
    const oxidizedMetal=mat(0x515562,.62,.22);
    for(const side of [-1,1]){
      const x=side*5.56;
      const cabinet=box("DistressedSchoolLocker",x,1.52,-10.95,1.53,3.03,.96,cabinetBlue);
      box("LockerRecessedPanel",x,1.71,-10.40,1.35,2.30,.10,lockerDark);
      for(const shift of [-.30,.30])
        for(const yy of [2.45,2.59,2.73])
          box("VentSlots",x+shift,yy,-10.326,.34,.055,.04,darkWood);
      box("LockerHandle",x+.43,1.17,-10.32,.085,.46,.09,oxidizedMetal);
      // Thin copper candle shelf at the window reveals + torn papers.
      box("WindowCandleShelf",side*7.42,2.02,-11.44,2.6,.13,.79,wornWood);
      for(let k=0;k<6;k++){
        const sx=side*7.42+(k-2.5)*.38;
        const cyl=new THREE.Mesh(new THREE.CylinderGeometry(.085,.103,.20+k%3*.08,7),wax);
        cyl.name="WindowSillCandles";cyl.position.set(sx,2.22,-11.12);root.add(cyl);
        const tip=new THREE.Mesh(new THREE.ConeGeometry(.06,.15,6),flameMat);
        tip.name="WarmCandleOnWindow";tip.position.set(sx,2.44+(k%3)*.04,-11.12);
        root.add(tip);this.motions.push({object:tip,phase:k*.78+(side+1)*4.2,kind:"candle"});
      }
      // Hanging old photo/bulletin board: pure scenery, no script/text.
      const board=box("TatteredNoticeBoard",side*6.28,7.93,-11.88,1.2,1.30,.11,darkWood);
      box("DustyBlankPoster",side*6.28,7.95,-11.81,.91,1.03,.025,paper);
      const blueInk=mat(0x6c768e);
      box("DiagonalPosterDamage",side*6.30,7.89,-11.785,.75,.035,.022,blueInk);
      // Twisting tendrils/ivy have individually shaded volumes, not a sticker.
      const stem=mat(0x283e38,.97);
      const leaves=[mat(0x345447,.94),mat(0x476856,.94),mat(0x4f6160,.94)];
      for(let vine=0;vine<4;vine++){
        const startX=side*(5.28+vine*.67);
        const startY=8.95-vine*.10;
        const z=-11.57+vine*.16;
        let prev=xyz(startX,startY,z);
        for(let seg=0;seg<9;seg++){
          const end=xyz(startX + side*(Math.sin(seg*.74+vine)*.23),
            startY-(seg+1)*(.35+vine*.017), z+seg*.045);
          rod("IvyStem",prev,end,.023,stem);
          if(seg%2===0){
            const leaf=new THREE.Mesh(new THREE.SphereGeometry(.18,6,4),leaves[(vine+seg)%3]);
            leaf.name="IvyLeaf";leaf.scale.set(.65,1.42,.26);
            leaf.position.set(end.x+side*.11,end.y,end.z);leaf.rotation.z=side*.5;
            root.add(leaf);
          }
          prev=end;
        }
      }
      // Ceiling-to-window web diagonals remain static, low-cost line segments.
      const webMat=new THREE.LineBasicMaterial({color:0xbfc6e2,transparent:true,opacity:.39});
      const a=xyz(side*8.55,9.12,-11.58);
      const b=xyz(side*7.18,8.85,-11.52);
      const d=xyz(side*8.5,7.2,-11.58);
      for(let n=0;n<7;n++){
        const t=n/6;
        const top=a.clone().lerp(b,t);
        const bottom=a.clone().lerp(d,t);
        const geo=new THREE.BufferGeometry().setFromPoints([top,bottom]);
        const cob=new THREE.Line(geo,webMat);cob.name="FineWindowCobweb";root.add(cob);
      }
      for(let n=1;n<=5;n++){
        const points:THREE.Vector3[]=[];
        for(let j=0;j<=8;j++){
          const u=j/8;
          points.push(a.clone().lerp(b,u*n/6).lerp(d,u*(1-n/6)));
        }
        const web=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),webMat);
        web.name="ArcWebThreads";root.add(web);
      }
    }
    // Chalkboard has its own authored texture: ghost/chalk symbols, NO text.
    const chalk= new THREE.MeshStandardMaterial({map:makeChalkboard(),roughness:.96});
    box("ChalkboardWoodFrame",0,4.9,-11.87,9.25,4.83,.24,wornWood);
    plane("NoTextChalkboard",0,4.91,-11.725,8.83,4.42,chalk);
    box("ChalkTray",0,2.44,-11.48,9.5,.12,.48,darkWood);
    for(let i=0;i<8;i++)box("UsedWhiteChalk",(i-4)*.33,2.54,-11.23,.18,.08,.10,paper);
    // Neutral framed landscape art: no flags / lettering anywhere.
    for(const x of [-5.6,5.65]){
      box("LandscapePhotoFrame",x,8.20,-12.02,1.8,1.15,.17,wornWood);
      plane("AbstractMoonlitLandscape",x,8.20,-11.915,1.55,.92,
        new THREE.MeshBasicMaterial({color:x<0?0x25354f:0x293146}));
    }
    // Plain clock face made of geometry and hands.
    const clock=new THREE.Group();clock.name="ClockWithoutLetters";clock.position.set(6.2,8.2,-11.8);root.add(clock);
    const clockRound=new THREE.Mesh(new THREE.CylinderGeometry(.52,.52,.09,32),trim);
    clockRound.rotation.x=Math.PI/2;clock.add(clockRound);
    glowDisc("ClockFace",0,0,.07,.43,paper,clock);
    rod("ClockHand",xyz(0,0,.13),xyz(-.22,.24,.13),.022,darkMetal,clock);
    rod("ClockMinuteHand",xyz(0,0,.13),xyz(.11,-.30,.13),.017,darkMetal,clock);

    const desk=(x:number,z:number,rotation:number,tip=false)=>{
      const d=new THREE.Group();d.name="OldClassroomDesk";d.position.set(x,0,z);d.rotation.y=rotation;
      d.rotation.z=tip?.09:0;root.add(d);
      box("ScratchedWoodDeskTop",0,1.55,0,2.05,.13,1.05,wornWood,d);
      box("DeskDrawer",0,1.37,.12,1.7,.26,.60,darkWood,d);
      for(const px of [-.88,.88])for(const pz of [-.37,.37])
        rod("MetalDeskLeg",xyz(px,.04,pz),xyz(px,1.47,pz),.044,metal,d);
      return d;
    };
    const chair=(x:number,z:number,rot:number)=>{
      const g=new THREE.Group();g.name="AbandonedSchoolChair";
      g.position.set(x,0,z);g.rotation.y=rot;root.add(g);
      box("OldChairSeat",0,.96,0,.99,.12,.90,wornWood,g);
      box("ChairBack",0,1.61,-.44,1.0,1.03,.12,wornWood,g);
      for(const xx of [-.42,.42])for(const zz of [-.35,.35])
        rod("ChairMetalLeg",xyz(xx,.03,zz),xyz(xx,.93,zz),.042,metal,g);
      rod("ChairBackSupport",xyz(-.40,.94,-.42),xyz(-.40,1.99,-.42),.039,metal,g);
      rod("ChairBackSupport",xyz(.40,.94,-.42),xyz(.40,1.99,-.42),.039,metal,g);
    };

    // Stage-safe blocking: props occupy the sides and back only.
    const deskPositions:[number,number,number][]=[
      [-7.2,-7.8,-.24],[-5.8,-6.7,.20],[-7.6,-2.0,.27],
      [-6.6,1.6,-.32],[-7.45,6.4,.20],
      [7.2,-7.8,.21],[5.85,-6.7,-.24],[7.5,-2.0,-.25],
      [6.6,1.6,.28],[7.45,6.4,-.27],
    ];
    deskPositions.forEach(([x,z,r],i)=>{
      desk(x,z,r,i===3);
      chair(x+(i%2?.55:-.33),z+1.18,r+(i%2?.3:-.2));
    });
    // Teacher podium and cabinet sit behind the chalkboard, not on dance floor.
    box("TeacherCabinet",0,1.0,-10.72,4.0,1.9,1.15,mat(0x354956,.85));
    for(const x of [-1.2,0,1.2])box("CabinetDoor",x,.94,-10.08,1.08,1.53,.09,mat(0x42556b));

    const speakerTexture=new THREE.MeshBasicMaterial({map:makeSpeakerFace(),toneMapped:false});
    const speaker=(x:number,z:number,scale=1)=>{
      const g=new THREE.Group();g.name="UVSpeakerStack";
      g.position.set(x,0,z);g.scale.setScalar(scale);root.add(g);
      box("BlackSpeakerBody",0,1.42,0,1.55,2.85,.85,darkMetal,g);
      plane("PurpleSpeakerFace",0,1.44,.445,1.42,2.66,speakerTexture,g);
      box("StackedSpeakerUnit",0,3.44,0,1.3,1.12,.82,darkMetal,g);
      plane("HighSpeakerDriver",0,3.44,.427,1.17,1.04,speakerTexture,g);
      return g;
    };
    for(const x of [-7.0,7.0])speaker(x,-7.1,1.12);
    for(const x of [-5.9,5.9])speaker(x,-9.25,.81);
    for(const x of [-7.45,7.45])speaker(x,1.4,.77);

    const bookMat=[mat(0x604758),mat(0x596b76),mat(0x897166),mat(0x3c415d)];
    // Some books and papers at edges provide lived-in classroom scale.
    const book=(x:number,y:number,z:number,i:number)=>{
      box("OldBookCover",x,y,z,.68,.08,.46,bookMat[i%bookMat.length]);
      box("OldBookPages",x,y+.062,z,.62,.05,.40,paper);
    };
    for(let i=0;i<35;i++){
      const side=i%2?-1:1;
      const x=side*(5.5+(i*11%23)/10);
      const z=-8+(i*17%150)/10;
      if(i<25)book(x,.1+(i%3)*.13,z,i);
      else{
        const p=new THREE.Mesh(new THREE.PlaneGeometry(.58,.40),paperTex);
        p.name="ScatteredPaperAlongWall";
        p.position.set(x,.032,z);p.rotation.set(-Math.PI/2,0,(i%7)*.39);root.add(p);
      }
    }
    // Candle arrangements. Emissive candle flame, 2 actual point lights only.
    const candleLocations:[number,number,number][]=[
      [-7.2,1.74,-8.0],[-6.5,1.79,-5.9],[-5.6,1.74,-7.2],
      [7.2,1.74,-8.0],[6.5,1.79,-5.9],[5.6,1.74,-7.2],
      [-7.5,.31,4.8],[7.5,.31,4.8],[-7.4,1.72,.4],[7.4,1.72,.4],
    ];
    candleLocations.forEach(([x,y,z],i)=>{
      const g=new THREE.Group();g.name="AnimatedCandle";g.position.set(x,y,z);root.add(g);
      box("ParaffinCandle",0,.17,0,.19,.38,.19,wax,g);
      const flame=new THREE.Mesh(new THREE.ConeGeometry(.105,.31,7),flameMat);
      flame.name="SmallFlame";flame.position.y=.52;g.add(flame);
      this.motions.push({object:flame,phase:i*.93,kind:"candle"});
      const halo=new THREE.Mesh(new THREE.SphereGeometry(.17,10,6),new THREE.MeshBasicMaterial({
        color:0xff8a44,transparent:true,opacity:.14,depthWrite:false,
      }));
      halo.position.y=.51;g.add(halo);
      if(i===0||i===3){
        const light=new THREE.PointLight(0xff8c4e,2.2,6,2);
        light.position.set(0,.63,0);g.add(light);this.candleGlow.push(light);
      }
    });

    // Loose dangling curtains and weathered cobwebs at window corners.
    const cloth=new THREE.MeshStandardMaterial({
      color:0xbdafcd,transparent:true,opacity:.57,roughness:.98,
      side:THREE.DoubleSide,depthWrite:false,
    });
    for(const x of [-7.8,7.8]){
      for(const z of [-10.8,-3.8]){
        const g=new THREE.Group();g.position.set(x,7.5,z);root.add(g);
        g.name="HangingTornCurtain";
        const vertices:number[]=[];const uv:number[]=[];const indices:number[]=[];
        const columns=9,rows=15;
        for(let iy=0;iy<=rows;iy++){
          for(let ix=0;ix<=columns;ix++){
            const u=ix/columns,t=iy/rows;
            const drop=2.75+(Math.sin(u*12+x)*.19)+ (u>.58?.68:0);
            vertices.push((u-.5)*2.0+Math.sin(t*5+u*7)*.075,-drop*t,Math.sin(u*15+t*9)*.10);
            uv.push(u,t);
            if(ix<columns&&iy<rows){
              const q=iy*(columns+1)+ix;
              indices.push(q,q+1,q+columns+1,q+1,q+columns+2,q+columns+1);
            }
          }
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
        geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);
        geo.computeVertexNormals();
        const m=new THREE.Mesh(geo,cloth);m.name="TornMoonlitCurtain";
        g.add(m);this.motions.push({object:g,phase:x+z,kind:"curtain"});
      }
    }
    const cobwebMat=new THREE.LineBasicMaterial({color:0x9ca6c7,transparent:true,opacity:.25});
    for(const side of [-1,1]){
      const points:number[]=[];
      const ax=side*8.6,ay=9.2;
      for(let i=0;i<14;i++){
        const t=i/13,zz=-11.4+i*.38;
        points.push(ax,ay,zz, ax-side*(1.6+t),ay-(1.1+t*.45),zz+.6);
      }
      const line=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position",new THREE.Float32BufferAttribute(points,3)),cobwebMat);
      line.name="CornerCobwebs";root.add(line);
    }

    // Animated wisp hoops and thin stage mist are presentation-only visual FX.
    const wispMat=new THREE.MeshBasicMaterial({color:0x8b8bff,transparent:true,opacity:.20,depthWrite:false,side:THREE.DoubleSide});
    for(let i=0;i<5;i++){
      const g=new THREE.Group();g.name="LowGhostWisp";
      g.position.set((i-2)*1.8,.1,-8.5+(i%2)*1.4);root.add(g);
      const m=new THREE.Mesh(new THREE.RingGeometry(.24,.5,28),wispMat);
      m.rotation.x=-Math.PI/2;g.add(m);
      this.motions.push({object:g,phase:i*1.83,kind:"wisp"});
    }
    const moonMist=new THREE.MeshBasicMaterial({color:0x8154af,transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide});
    for(let i=0;i<6;i++){
      const x=(i-2.5)*3.0;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(2.2,10),moonMist);
      m.name="FlatReflectedVioletStrip";
      m.rotation.x=-Math.PI/2;m.position.set(x,.025,-5+i*.8);
      root.add(m);
    }
    // Worn chalk-paint summoning-circle motif, FLAT and broken up to avoid tubes.
    const chalkPaint=new THREE.MeshBasicMaterial({color:0xc3a1aa,transparent:true,opacity:.41,depthWrite:false,side:THREE.DoubleSide});
    const redPaint=new THREE.MeshBasicMaterial({color:0xad4261,transparent:true,opacity:.33,depthWrite:false,side:THREE.DoubleSide});
    for(let seg=0;seg<28;seg++){
      if(seg%6===0||seg%9===0)continue;
      flatRing(root,0,.75,4.35,.085,chalkPaint,seg*PI2/28,PI2/28*.86);
    }
    for(let i=0;i<5;i++){
      const a=i*PI2/5-Math.PI/2,b=(i+2)*PI2/5-Math.PI/2;
      const p1=xyz(Math.cos(a)*3.65,.029,.75+Math.sin(a)*3.65);
      const p2=xyz(Math.cos(b)*3.65,.029,.75+Math.sin(b)*3.65);
      const delta=p2.clone().sub(p1),len=delta.length();
      // Use flat strips rather than cylinders; circles and pentagon are paint.
      const g=new THREE.PlaneGeometry(len,.09);
      const m=new THREE.Mesh(g,redPaint);
      m.name="FadedFloorSigilStroke";m.rotation.x=-Math.PI/2;
      m.rotation.z=0;
      m.rotation.set(-Math.PI/2,0,Math.atan2(p2.z-p1.z,p2.x-p1.x));
      m.position.copy(p1).add(p2).multiplyScalar(.5);root.add(m);
    }
    const purpleFill=new THREE.PointLight(0x8e49da,4.1,20,2);
    purpleFill.name="PurpleSpeakerAmbient";purpleFill.position.set(-5.8,5.2,-6);root.add(purpleFill);
    const magentaFill=new THREE.PointLight(0xcf41ba,3.1,17,2);
    magentaFill.name="MoonWindowFill";magentaFill.position.set(5.8,5.7,-6);root.add(magentaFill);
    const danceFill=new THREE.PointLight(0x779ce9,2.2,13,2);
    danceFill.name="SoftDancerFill";danceFill.position.set(0,7.4,3);root.add(danceFill);
  }

  update(renderTimeSeconds:number,_songTimeMs:number,_bpm:number,_isPlaying:boolean) {
    if(this.disposed||!this.loaded)return;
    // Wall-clock presentation ONLY, no beat sync and no animation mixer resets.
    // Large objects never move; only sub-degree cloth, flames and wisps.
    const t=Number.isFinite(renderTimeSeconds)?renderTimeSeconds:0;
    for(const {object,phase,kind} of this.motions){
      if(kind==="curtain")object.rotation.z=Math.sin(t*.60+phase)*.017;
      else if(kind==="candle")object.scale.set(1+Math.sin(t*5.7+phase)*.07,1+Math.sin(t*7+phase)*.14,1);
      else if(kind==="wisp")object.position.y=.11+Math.sin(t*.81+phase)*.08;
    }
    for(let i=0;i<this.candleGlow.length;i++)
      this.candleGlow[i].intensity=2.0+.20*Math.sin(t*5.8+i*2.3);
  }

  setPresentationCamera(_preset:StagePresentationCameraPreset){
    // Stage3D is the only camera owner.
  }

  private metrics(){
    let meshes=0,triangles=0;
    const materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    this.root.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;meshes++;
      const g=o.geometry;
      triangles+=Math.floor((g.index?.count??g.getAttribute("position")?.count??0)/3);
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        materials.add(m);
        for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);
      }
    });
    return {stageId:STAGE_ID,meshes,materials:materials.size,textures:textures.size,
      triangles,embeddedAnimations:0,reactiveMaterials:0};
  }

  dispose(){
    if(this.disposed)return;this.disposed=true;
    disposeTree(this.root);this.root.removeFromParent();this.root.clear();
    this.motions=[];this.candleGlow=[];this.loaded=false;
  }
}
