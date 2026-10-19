import * as THREE from "three";

/**
 * Haunted Classroom V1: self-contained original procedural textures.
 * All Canvas textures are generated once when loading the environment.
 * Never paint or upload textures per frame. No external files or fonts.
 */
function randGen(seed: number) {
  let n = seed >>> 0;
  return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function canvasTexture(w: number, h: number, seed: number, paint: (c: CanvasRenderingContext2D, r: () => number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Haunted classroom texture canvas unavailable");
  paint(c, randGen(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
export function makeOldPlaster() {
  return canvasTexture(1024, 512, 401, (c, r) => {
    c.fillStyle = "#42566b"; c.fillRect(0, 0, 1024, 512);
    // Turquoise lower paint with ragged boundary and dried water damage.
    c.fillStyle = "#2e6067"; c.fillRect(0, 345, 1024, 167);
    for (let i = 0; i < 1500; i++) {
      const x = r() * 1024, y = r() * 512;
      c.fillStyle = r() > .56 ? "rgba(4,9,24,.11)" : "rgba(169,164,139,.07)";
      c.fillRect(x, y, 5+r()*34, r()*4+1);
    }
    for (let j = 0; j < 80; j++) {
      const x = r()*1024, y = r()*512;
      c.fillStyle = "rgba(13,20,25,.08)";
      c.beginPath(); c.ellipse(x,y, 2+r()*45,1+r()*20,r()*6,0,2*Math.PI); c.fill();
    }
    c.fillStyle = "rgba(203,200,175,.08)";
    c.fillRect(0,339,1024,7);
  });
}
export function makeOldFloor() {
  return canvasTexture(1024, 1024, 402, (c,r) => {
    c.fillStyle = "#55424b"; c.fillRect(0,0,1024,1024);
    const plank=77;
    for(let row=0;row<14;row++){
      const y=row*plank;
      c.fillStyle="rgba(9,12,24,.63)"; c.fillRect(0,y,1024,4);
      const offset=row%3===0 ? -290 : row%3===1 ? -520 : -90;
      for(let x=offset;x<1100;x+=370){
        const v=r();
        const a=v>.5 ? [105,73,73] : [76,57,66];
        const dr=Math.round((r()-.5)*29);
        c.fillStyle="rgb("+(a[0]+dr)+","+(a[1]+dr)+","+(a[2]+dr)+")";
        c.fillRect(x+4,y+5,365,70);
        c.fillStyle="rgba(205,157,132,.14)";
        c.fillRect(x+6,y+8,360,2);
        for(let line=0;line<15;line++){
          const ry=y+9+r()*58;
          c.strokeStyle=r()>.5 ? "rgba(20,16,22,.24)" : "rgba(212,164,142,.11)";
          c.lineWidth=.4+r()*1.5;
          c.beginPath(); c.moveTo(x+10,ry);
          c.bezierCurveTo(x+95,ry+3*r(),x+200,ry-4*r(),x+354,ry+(r()-.5)*4);
          c.stroke();
        }
        // Scratched varnish
        for(let i=0;i<23;i++){
          c.strokeStyle="rgba(211,172,158,.10)";
          c.lineWidth=.4+r();
          const xx=x+r()*360, yy=y+8+r()*60;
          c.beginPath(); c.moveTo(xx,yy); c.lineTo(xx+10+r()*42, yy+(r()-.5)*2); c.stroke();
        }
      }
    }
    // Dirty water blooms, uneven varnish, splitting joints and chalk dust:
    // broad wear reads like aged planks instead of uniform procedural dots.
    for(let i=0;i<125;i++){
      const x=r()*1024,y=r()*1024;
      const dark=r()>.42;
      c.fillStyle=dark?"rgba(24,23,29,.12)":"rgba(185,163,147,.095)";
      c.beginPath();c.ellipse(x,y,8+r()*58,1.3+r()*11,(r()-.5)*.25,0,Math.PI*2);c.fill();
    }
    for(let i=0;i<240;i++){
      const x=r()*1024,y=r()*1024;
      c.strokeStyle=r()>.45?"rgba(12,9,15,.27)":"rgba(221,194,174,.17)";
      c.lineWidth=.45+r()*1.05;
      c.beginPath();c.moveTo(x,y);
      c.lineTo(x+20+r()*124,y+(r()-.5)*8);
      c.stroke();
    }
    for(let i=0;i<28;i++){
      const x=r()*1024,y=r()*1024;
      c.fillStyle="rgba(19,17,24,.18)";
      c.fillRect(x,y,4+r()*55,1+r()*3);
      c.fillStyle="rgba(161,138,127,.08)";
      c.fillRect(x+2,y+2,2+r()*24,1+r()*2);
    }
    for(let i=0;i<1100;i++){
      c.fillStyle=r()>.5?"rgba(22,12,19,.13)":"rgba(255,235,209,.05)";
      c.fillRect(r()*1024,r()*1024,.3+r()*4,.3+r()*2);
    }
  });
}
export function makeChalkboard() {
  return canvasTexture(1536, 768, 403, (c,r) => {
    c.fillStyle="#15343d"; c.fillRect(0,0,1536,768);
    for(let i=0;i<900;i++){
      c.fillStyle=r()>.5 ? "rgba(218,229,225,.035)" : "rgba(1,8,10,.13)";
      c.fillRect(r()*1536,r()*768,8+r()*190,r()*7+.5);
    }
    c.save();
    c.globalAlpha=.77;
    c.strokeStyle="#a1b9c1"; c.lineWidth=5; c.lineCap="round";
    const ghost=(x:number,y:number,s:number)=>{
      c.save();c.translate(x,y);c.scale(s,s);
      c.beginPath();c.moveTo(-70,83);
      c.bezierCurveTo(-91,33,-100,-60,-48,-91);
      c.bezierCurveTo(15,-140,93,-77,82,-16);
      c.lineTo(83,88);c.lineTo(53,67);c.lineTo(30,91);c.lineTo(3,69);
      c.lineTo(-30,89);c.lineTo(-52,68);c.closePath();c.stroke();
      c.beginPath();c.moveTo(-39,-22);c.lineTo(-10,2);c.moveTo(-10,-22);c.lineTo(-39,2);
      c.moveTo(25,-22);c.lineTo(51,2);c.moveTo(51,-22);c.lineTo(25,2);c.stroke();
      c.beginPath();c.arc(6,39,15,0,Math.PI);c.stroke();
      c.beginPath();c.moveTo(-34,-123);c.lineTo(-14,-142);c.lineTo(10,-121);c.lineTo(32,-147);c.lineTo(53,-122);c.stroke();
      c.restore();
    };
    ghost(1030,390,1.42);
    ghost(380,400,.69);
    c.beginPath();c.arc(220,220,76,0,2*Math.PI);c.moveTo(320,260);
    c.lineTo(410,187);c.lineTo(470,216);c.stroke();
    c.beginPath();c.moveTo(400,603);c.bezierCurveTo(630,535,710,644,849,603);
    c.bezierCurveTo(970,556,1040,654,1220,616);c.stroke();
    for(let i=0;i<43;i++){
      const x=75+r()*1390,y=72+r()*604;
      c.globalAlpha=.13+r()*.36;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+17+r()*47,y+(r()-.5)*36);c.stroke();
    }
    for(let i=0;i<16;i++){
      const x=200+r()*1180,y=90+r()*580;
      c.beginPath();c.moveTo(x,y-15);c.lineTo(x+4,y+3);c.lineTo(x+19,y+7);
      c.lineTo(x-3,y+11);c.lineTo(x-15,y+3);c.closePath();c.stroke();
    }
    c.restore();
    // Absolutely no lettering or national symbols in the stage texture.
  });
}
export function makeGhostWindow() {
  return canvasTexture(512, 1024, 404, (c,r) => {
    const g=c.createLinearGradient(0,0,0,1024);
    g.addColorStop(0,"#160f2c");g.addColorStop(.27,"#79316f");
    g.addColorStop(.65,"#622766");g.addColorStop(1,"#171326");
    c.fillStyle=g;c.fillRect(0,0,512,1024);
    const moon=c.createRadialGradient(310,155,4,310,155,155);
    moon.addColorStop(0,"rgba(230,171,218,.65)");
    moon.addColorStop(.41,"rgba(199,129,183,.34)");
    moon.addColorStop(.74,"rgba(125,59,133,.12)");
    moon.addColorStop(1,"rgba(214,96,190,0)");
    c.fillStyle=moon;c.fillRect(0,0,512,440);
    c.fillStyle="rgba(207,162,211,.52)";
    c.beginPath();c.arc(310,155,76,0,2*Math.PI);c.fill();
    // Bent branches and scattered leaves
    for(let branch=0;branch<10;branch++){
      const x=branch%2 ? 512 : 0, y=95+r()*850;
      c.strokeStyle="rgba(15,13,28,.74)";
      c.lineWidth=5+r()*13;
      c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+(x? -70:70),y-38,x+(x?-130:130),y-70,x+(x?-235:235),y-20-r()*90);c.stroke();
      for(let k=0;k<10;k++){
        c.fillStyle="rgba(10,16,28,.59)";
        c.beginPath();c.ellipse(r()*512,r()*900,2+r()*10,3+r()*15,r()*6,0,2*Math.PI);c.fill();
      }
    }
    // Uncanny figures are decals BEHIND glass, not actors in the room.
    c.save();c.globalAlpha=.14;c.fillStyle="#d9e6ed";
    for(const q of [{x:106,y:565,s:1},{x:425,y:680,s:.65}]){
      c.save();c.translate(q.x,q.y);c.scale(q.s,q.s);
      c.beginPath();c.ellipse(0,-66,39,55,0,0,2*Math.PI);c.fill();
      c.beginPath();c.moveTo(-36,-24);c.bezierCurveTo(-91,30,-80,220,-98,247);
      c.lineTo(91,247);c.bezierCurveTo(63,180,78,38,36,-24);c.closePath();c.fill();
      c.restore();
    }
    c.restore();
    c.fillStyle="rgba(205,191,240,.07)"; c.fillRect(0,0,512,1024);
    for(let i=0;i<100;i++){
      c.strokeStyle="rgba(255,220,242,.06)";c.lineWidth=.4+r();
      const x=r()*512,y=r()*1024;c.beginPath();c.moveTo(x,y);c.lineTo(x+r()*60,y+r()*80);c.stroke();
    }
  });
}
/** Transparent specter that crosses a real window group behind its glass.
 * The texture is shared by all window instances and disposed with the stage.
 */
export function makePassingWindowGhost() {
  return canvasTexture(256, 512, 421, (c) => {
    c.clearRect(0,0,256,512);
    const haze=c.createRadialGradient(128,240,10,128,240,126);
    haze.addColorStop(0,"rgba(206,215,231,.28)");
    haze.addColorStop(.55,"rgba(151,164,197,.085)");
    haze.addColorStop(1,"rgba(126,141,187,0)");
    c.fillStyle=haze;c.fillRect(0,65,256,400);
    const body=c.createLinearGradient(0,90,0,500);
    body.addColorStop(0,"rgba(219,229,239,.73)");
    body.addColorStop(.38,"rgba(181,199,219,.63)");
    body.addColorStop(1,"rgba(132,145,184,0)");
    c.fillStyle=body;
    c.beginPath();c.ellipse(128,127,38,51,0,0,Math.PI*2);c.fill();
    c.beginPath();c.moveTo(95,170);
    c.bezierCurveTo(41,218,57,338,25,467);
    c.bezierCurveTo(72,425,91,481,115,453);
    c.bezierCurveTo(151,487,162,423,222,479);
    c.bezierCurveTo(180,341,208,229,157,170);
    c.closePath();c.fill();
    c.fillStyle="rgba(29,26,54,.43)";
    c.beginPath();c.ellipse(112,129,5,8,0,0,Math.PI*2);c.fill();
    c.beginPath();c.ellipse(147,128,5,8,0,0,Math.PI*2);c.fill();
  });
}

export function makeSpeakerFace() {
  return canvasTexture(256,512,405,(c,r)=>{
    c.fillStyle="#0c0d19";c.fillRect(0,0,256,512);
    for(let i=0;i<600;i++){c.fillStyle=r()>.5?"rgba(201,203,217,.04)":"rgba(0,0,0,.06)";
      c.fillRect(r()*256,r()*512,1+r()*4,1+r()*5);}
    const ring=(y:number,rad:number)=>{
      const g=c.createRadialGradient(128,y,rad*.13,128,y,rad*1.16);
      g.addColorStop(0,"#211331");
      g.addColorStop(.5,"#3f245e");
      g.addColorStop(.63,"#b271f0");
      g.addColorStop(.78,"#e3aaff");
      g.addColorStop(.86,"#38265f");
      g.addColorStop(1,"#100f1c");
      c.fillStyle=g;c.beginPath();c.arc(128,y,rad*1.16,0,2*Math.PI);c.fill();
      c.fillStyle="#15111e";c.beginPath();c.arc(128,y,rad*.42,0,2*Math.PI);c.fill();
      c.fillStyle="#a471d2";c.beginPath();c.arc(128,y,rad*.14,0,2*Math.PI);c.fill();
    };
    ring(148,90);ring(361,78);
  });
}
export function makeSchoolPaper() {
  return canvasTexture(256,256,406,(c,r)=>{
    c.fillStyle="#c8bbaf";c.fillRect(0,0,256,256);
    for(let y=19;y<245;y+=20){
      c.strokeStyle="rgba(57,75,91,.20)";c.lineWidth=1;
      c.beginPath();c.moveTo(18,y);c.lineTo(239,y);c.stroke();
    }
    for(let i=0;i<350;i++){
      c.fillStyle=r()>.5?"rgba(35,22,30,.06)":"rgba(241,230,204,.13)";
      c.fillRect(r()*256,r()*256,2+r()*15,r()*2+1);
    }
  });
}


/**
 * A lightweight pre-painted reflection decal, NOT another WebGL renderer
 * or a postprocessing pass. World-space plane over the glossy wood creates
 * the window/candle color streaks visible in the owner's reference.
 */
export function makeClassroomFloorReflections() {
  return canvasTexture(1024, 1024, 409, (c, r) => {
    c.clearRect(0, 0, 1024, 1024);
    const pools: Array<[number, number, number, number, string]> = [
      [95,210,180,200,"227,70,190"],
      [930,200,180,200,"229,67,199"],
      [180,570,205,235,"155,70,239"],
      [840,560,240,230,"182,70,228"],
      [320,860,155,150,"244,137,95"],
      [725,885,155,155,"253,144,92"],
      [500,405,200,165,"106,114,228"],
      [500,810,120,130,"155,62,162"],
    ];
    for (const [x,y,rx,ry,color] of pools) {
      c.save(); c.translate(x,y); c.scale(1,ry/rx);
      const g=c.createRadialGradient(0,0,8,0,0,rx);
      g.addColorStop(0,"rgba("+color+",.40)");
      g.addColorStop(.25,"rgba("+color+",.20)");
      g.addColorStop(.70,"rgba("+color+",.055)");
      g.addColorStop(1,"rgba("+color+",0)");
      c.fillStyle=g;c.beginPath();c.arc(0,0,rx,0,Math.PI*2);c.fill();
      c.restore();
    }
    // Directional, imperfect streaks; broken at plank grout lines.
    for (let i=0;i<580;i++) {
      const x=r()*1024,y=r()*1024, len=12+r()*100;
      const warm=r()>.75;
      c.strokeStyle=warm?"rgba(255,173,110,.09)":"rgba(229,121,239,.095)";
      c.lineWidth=.5+r()*2.5;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+len,y+(r()-.5)*3);c.stroke();
    }
  });
}
export function makeWindowShaft() {
  return canvasTexture(256,512,410,(c,r)=>{
    c.clearRect(0,0,256,512);
    const g=c.createLinearGradient(0,0,0,512);
    g.addColorStop(0,"rgba(242,125,255,.0)");
    g.addColorStop(.24,"rgba(232,124,255,.19)");
    g.addColorStop(.63,"rgba(195,108,244,.13)");
    g.addColorStop(1,"rgba(187,99,246,0)");
    c.fillStyle=g;
    c.beginPath();c.moveTo(75,0);c.lineTo(170,0);c.lineTo(255,512);
    c.lineTo(0,512);c.closePath();c.fill();
    for(let i=0;i<55;i++){
      c.fillStyle="rgba(244,214,255,"+(.015+r()*.035)+")";
      c.fillRect(r()*256,r()*512,1+r()*9,1+r()*3);
    }
  });
}


/** Aged painted acoustic ceiling. Tonal separation is subtle, not noisy. */
export function makeHauntedCeilingPanels() {
  return canvasTexture(512, 512, 519, (c, r) => {
    c.fillStyle="#596779"; c.fillRect(0,0,512,512);
    for(let i=0;i<800;i++){
      const x=r()*512,y=r()*512;
      c.fillStyle=r()>.5?"rgba(214,205,212,.06)":"rgba(22,26,47,.07)";
      c.fillRect(x,y,8+r()*65,.5+r()*4);
    }
    // Broad damp patches, no sharp repeated tiling symbols.
    for(let i=0;i<28;i++){
      const x=r()*512,y=r()*512;
      c.fillStyle="rgba(25,28,49,.075)";
      c.beginPath();c.ellipse(x,y,10+r()*40,6+r()*15,r()*3,0,2*Math.PI);c.fill();
    }
    for(let i=0;i<8;i++){
      c.strokeStyle="rgba(201,194,199,.085)";c.lineWidth=1+r();
      const y=r()*512;c.beginPath();c.moveTo(0,y);
      c.bezierCurveTo(170,y-15,365,y+19,512,y-11);c.stroke();
    }
  });
}

/** Grayscale PBR map; gives worn varnish patches real roughness variation. */
export function makeHauntedFloorRoughness() {
  const texture=canvasTexture(512,512,520,(c,r)=>{
    c.fillStyle="#888888";c.fillRect(0,0,512,512);
    for(let i=0;i<780;i++){
      const x=r()*512,y=r()*512;
      c.fillStyle=r()>.55?"rgba(240,240,240,.13)":"rgba(14,14,14,.09)";
      c.fillRect(x,y,5+r()*78,.8+r()*5);
    }
    for(let i=0;i<32;i++){
      c.fillStyle="rgba(235,235,235,.14)";
      c.beginPath();c.ellipse(r()*512,r()*512,6+r()*28,1+r()*9,r()*2,0,2*Math.PI);c.fill();
    }
  });
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(2,3);
  return texture;
}
