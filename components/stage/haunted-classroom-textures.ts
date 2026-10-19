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
    // Distinct branching cracks along damaged plank ends, drawn into the
    // albedo (no geometry protrusion or collision changes). Two-tone edges
    // keep the cracks visible at mobile size without looking like black paint.
    for(let crack=0;crack<48;crack++){
      const sx=20+r()*985,sy=17+r()*982;
      const direction=r()>.28 ? 1 : -1;
      const steps=4+Math.floor(r()*5);
      let x=sx,y=sy;
      c.strokeStyle="rgba(14,12,19,.52)";
      c.lineWidth=1.7+r()*1.6;
      c.beginPath();c.moveTo(x,y);
      const forks:Array<[number,number]>=[];
      for(let j=0;j<steps;j++){
        x+=direction*(7+r()*26);
        y+=(r()-.52)*10;
        c.lineTo(x,y);
        if(j>1&&j%3===0)forks.push([x,y]);
      }
      c.stroke();
      c.strokeStyle="rgba(205,172,160,.20)";
      c.lineWidth=.9;
      c.beginPath();c.moveTo(sx,sy+2);c.lineTo(x,y+1.4);c.stroke();
      for(const [bx,by] of forks){
        c.strokeStyle="rgba(18,13,19,.41)";
        c.lineWidth=1.0+r()*1.1;
        c.beginPath();c.moveTo(bx,by);
        c.lineTo(bx+direction*(8+r()*19),by+(r()>.5?1:-1)*(7+r()*13));
        c.lineTo(bx+direction*(13+r()*26),by+(r()-.5)*28);
        c.stroke();
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
    ghost(1190,425,1.12);
    ghost(330,425,.68);
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
    // A legible English hand-chalk title. No country flags or foreign scripts.
    c.save();
    c.translate(758,270);
    c.rotate(-.055);
    c.textAlign="center";
    c.textBaseline="middle";
    c.font="italic 700 164px cursive, sans-serif";
    c.lineJoin="round";
    c.strokeStyle="rgba(221,229,219,.26)";
    c.lineWidth=9;
    c.strokeText("Dance Up",0,0,855);
    c.fillStyle="rgba(230,228,218,.89)";
    c.fillText("Dance Up",0,0,855);
    c.globalAlpha=.29;
    for(let i=0;i<68;i++){
      c.fillStyle="#15343d";
      c.fillRect(-411+r()*822,-64+r()*115,1+r()*11,1+r()*3);
    }
    c.restore();
    // Asymmetric occult classroom doodles: staring eyes, crooked stars,
    // cracked hearts, crescent and tangled hand-drawn spiral symbols.
    c.save();c.strokeStyle="rgba(178,192,196,.64)";
    c.lineWidth=5;c.lineCap="round";c.lineJoin="round";
    const eye=(x:number,y:number,rx:number)=>{
      c.beginPath();c.moveTo(x-rx,y);
      c.quadraticCurveTo(x,y-rx*.62,x+rx,y);
      c.quadraticCurveTo(x,y+rx*.62,x-rx,y);c.stroke();
      c.beginPath();c.ellipse(x,y,rx*.16,rx*.24,.15,0,Math.PI*2);c.stroke();
      for(let j=0;j<5;j++){const xx=x+(j-2)*rx*.36;
        c.beginPath();c.moveTo(xx,y-rx*.18);c.lineTo(xx-5,y-rx*.50);c.stroke();}
    };
    eye(212,204,86);eye(1327,546,75);
    const star=(x:number,y:number,outer:number)=>{
      c.beginPath();
      for(let j=0;j<10;j++){const a=j*Math.PI/5-1.5,rr=j%2?outer*.39:outer;
        const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;
        if(j===0)c.moveTo(px,py);else c.lineTo(px,py);}
      c.closePath();c.stroke();
    };
    star(1250,156,68);star(266,592,50);
    c.beginPath();c.moveTo(636,517);
    c.bezierCurveTo(566,440,544,552,637,628);
    c.bezierCurveTo(728,550,710,445,636,517);c.stroke();
    c.beginPath();c.moveTo(643,532);c.lineTo(619,557);c.lineTo(659,578);
    c.lineTo(628,604);c.stroke();
    for(let k=0;k<4;k++){
      const x=1030+k*60,y=625+Math.sin(k)*18;
      c.beginPath();c.arc(x,y,30+k*7,Math.PI*.17,Math.PI*1.63);c.stroke();
    }
    c.beginPath();c.arc(410,125,48,Math.PI*.36,Math.PI*1.70);
    c.arc(429,113,39,Math.PI*1.57,Math.PI*.43,true);c.stroke();
    c.restore();
  });
}
export function makeGhostWindow() {
  return canvasTexture(512, 1024, 404, (c,r) => {
    const g=c.createLinearGradient(0,0,0,1024);
    // V12: dark outdoor night, not a luminous pink skybox. Keep a restrained
    // centre band lighter than the near-black figure for silhouette contrast.
    g.addColorStop(0,"#100e1c");g.addColorStop(.27,"#33233e");
    g.addColorStop(.65,"#292035");g.addColorStop(1,"#0d101c");
    c.fillStyle=g;c.fillRect(0,0,512,1024);
    const moon=c.createRadialGradient(310,155,4,310,155,155);
    moon.addColorStop(0,"rgba(150,126,164,.21)");
    moon.addColorStop(.41,"rgba(131,109,151,.105)");
    moon.addColorStop(.74,"rgba(81,66,105,.035)");
    moon.addColorStop(1,"rgba(64,56,89,0)");
    c.fillStyle=moon;c.fillRect(0,0,512,440);
    c.fillStyle="rgba(144,131,167,.15)";
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
    // No static people or ghosts in the sky texture: transient figures
    // are only instantiated as real animated window objects.
    c.fillStyle="rgba(97,82,119,.025)"; c.fillRect(0,0,512,1024);
    for(let i=0;i<100;i++){
      c.strokeStyle="rgba(160,147,171,.045)";c.lineWidth=.4+r();
      const x=r()*512,y=r()*1024;c.beginPath();c.moveTo(x,y);c.lineTo(x+r()*60,y+r()*80);c.stroke();
    }
  });
}
/** Transparent specter that crosses a real window group behind its glass.
 * The texture is shared by all window instances and disposed with the stage.
 */
/** Long-haired woman in SIDE PROFILE behind the panes. A human figure
 * rather than a front-facing cartoon ghost; translucent from dirty glass.
 * All paths are original raster shapes made once during environment load.
 */
/**
 * Filmic half-body passer-by behind the classroom windows.
 *
 * A single, tall-haired adult side profile in a dark coat, viewed through
 * murky glass. Her lower body is deliberately OUTSIDE the camera crop below
 * the lower sash. We do not paint a floating ghost tail, eyes, or feet.
 *
 * An original Canvas asset drawn once at stage load, not a captured frame
 * or someone else's copyrighted Audition character.
 */
export function makePassingWindowGhost() {
  return canvasTexture(512, 768, 511, (c, random) => {
    c.clearRect(0, 0, 512, 768);
    c.save();
    c.lineCap="round";c.lineJoin="round";
    // Local soft reflection in the glass, not neon outlining the figure.
    const smog=c.createRadialGradient(239,389,48,239,389,258);
    smog.addColorStop(0,"rgba(19,16,30,.07)");
    smog.addColorStop(.57,"rgba(32,29,44,.032)");
    smog.addColorStop(1,"rgba(32,29,44,0)");
    c.fillStyle=smog;c.fillRect(10,10,492,738);

    const coat=c.createLinearGradient(136,360,382,655);
    coat.addColorStop(0,"#101019");
    coat.addColorStop(.43,"#201d28");
    coat.addColorStop(.78,"#13131d");
    coat.addColorStop(1,"#0c0e15");
    const blackHair=c.createLinearGradient(135,70,339,540);
    blackHair.addColorStop(0,"#09090d");
    blackHair.addColorStop(.38,"#16131b");
    blackHair.addColorStop(1,"#0c0d14");
    const face=c.createLinearGradient(190,135,350,324);
    face.addColorStop(0,"#241e28");
    face.addColorStop(.6,"#322532");
    face.addColorStop(1,"#18151f");

    // Low, diffuse backlight created from the actual contour, not a sticker.
    c.shadowColor="rgba(183,153,191,.19)";
    c.shadowBlur=25;
    c.shadowOffsetX=5;

    // Narrow woman in a long black cardigan / coat. Full-width clothing
    // continues BELOW the crop; it never tapers to a ghost-like point.
    c.fillStyle=coat;
    c.beginPath();c.moveTo(184,321);
    c.bezierCurveTo(152,325,125,354,116,400);
    c.bezierCurveTo(110,484,125,552,120,644);
    c.lineTo(107,768);c.lineTo(369,768);
    c.bezierCurveTo(355,677,356,622,367,532);
    c.bezierCurveTo(376,462,365,399,335,358);
    c.bezierCurveTo(301,326,265,319,229,321);
    c.closePath();c.fill();

    // Sleeve falling naturally by her hip, hand only partly visible.
    c.beginPath();c.moveTo(142,360);
    c.bezierCurveTo(119,394,114,467,137,520);
    c.bezierCurveTo(148,565,156,613,152,648);
    c.bezierCurveTo(151,682,164,702,177,696);
    c.bezierCurveTo(185,684,177,659,181,633);
    c.bezierCurveTo(189,555,185,463,189,396);
    c.closePath();c.fill();
    c.shadowBlur=0;c.shadowOffsetX=0;

    // Neck and human adult profile, chin/nose facing right.
    c.fillStyle=face;
    c.beginPath();c.moveTo(226,294);
    c.lineTo(229,358);c.lineTo(281,373);c.lineTo(288,301);
    c.closePath();c.fill();
    c.beginPath();c.moveTo(224,131);
    c.bezierCurveTo(269,103,315,138,326,179);
    c.bezierCurveTo(335,205,324,231,332,251);
    c.lineTo(351,269);
    c.quadraticCurveTo(355,278,344,283);
    c.lineTo(332,285);
    c.bezierCurveTo(336,304,317,316,302,318);
    c.bezierCurveTo(293,326,290,346,278,346);
    c.bezierCurveTo(250,337,234,307,219,283);
    c.bezierCurveTo(201,236,203,164,224,131);
    c.closePath();c.fill();

    // Realistic long, hanging straight hair with uneven individual locks.
    // Heavy crown and curtain of hair obscuring facial details.
    c.fillStyle=blackHair;
    c.shadowColor="rgba(113,93,125,.16)";c.shadowBlur=12;
    c.beginPath();c.moveTo(213,109);
    c.bezierCurveTo(174,113,150,147,152,204);
    c.bezierCurveTo(152,250,157,283,144,340);
    c.bezierCurveTo(145,409,129,486,113,564);
    c.bezierCurveTo(139,548,156,520,167,481);
    c.bezierCurveTo(164,546,154,586,149,617);
    c.bezierCurveTo(188,583,196,528,199,472);
    c.bezierCurveTo(215,530,227,578,240,603);
    c.bezierCurveTo(248,535,234,458,247,393);
    c.bezierCurveTo(248,324,275,285,294,245);
    c.bezierCurveTo(311,209,300,142,269,122);
    c.bezierCurveTo(251,110,232,107,213,109);
    c.closePath();c.fill();
    // Parted bangs trail over the cheek, not a round cartoon head.
    c.beginPath();c.moveTo(250,114);
    c.bezierCurveTo(289,121,318,146,318,191);
    c.bezierCurveTo(319,235,301,269,301,309);
    c.bezierCurveTo(286,290,278,262,279,229);
    c.bezierCurveTo(263,224,256,192,250,114);
    c.closePath();c.fill();
    c.shadowBlur=0;

    // Coated lapels are subtle tonal material changes, not contour lines.
    const fabric=c.createLinearGradient(208,339,332,509);
    fabric.addColorStop(0,"rgba(93,75,98,.37)");
    fabric.addColorStop(.4,"rgba(57,44,62,.26)");
    fabric.addColorStop(1,"rgba(18,15,24,0)");
    c.fillStyle=fabric;
    c.beginPath();c.moveTo(227,351);c.lineTo(283,374);
    c.quadraticCurveTo(259,429,265,504);
    c.quadraticCurveTo(235,430,227,351);c.fill();
    c.beginPath();c.moveTo(305,348);c.lineTo(283,374);
    c.quadraticCurveTo(300,414,294,485);
    c.quadraticCurveTo(315,427,305,348);c.fill();

    // Directional fabric folds from collar through the torso create actual
    // visible clothing without making the person a clean vector pictogram.
    for(let i=0;i<37;i++){
      const x=142+random()*186, y=385+random()*215;
      const length=25+random()*116;
      c.strokeStyle=random()>.5
        ?"rgba(141,120,150,.052)":"rgba(0,0,0,.13)";
      c.lineWidth=.65+random()*1.9;
      c.beginPath();c.moveTo(x,y);
      c.bezierCurveTo(x-11,y+length*.30,x+9,y+length*.62,x-4,y+length);
      c.stroke();
    }
    // Fine hair flyaways break the artificial smoothness at the edges.
    for(let i=0;i<25;i++){
      const x=153+random()*76,y=162+random()*368;
      c.strokeStyle="rgba(65,53,70,"+(0.13+random()*.17)+")";
      c.lineWidth=.5+random()*1.1;
      c.beginPath();c.moveTo(x,y);
      c.bezierCurveTo(x-9,y+47,x-13,y+80,x-15-random()*10,y+130);
      c.stroke();
    }
    // Tiny human neck shadow; intentionally no eyes/mouth or ghost face.
    c.fillStyle="rgba(4,4,11,.19)";
    c.beginPath();c.moveTo(283,314);c.quadraticCurveTo(272,339,252,346);
    c.lineTo(281,353);c.closePath();c.fill();
    c.restore();
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
    g.addColorStop(0,"rgba(127,111,162,0)");
    g.addColorStop(.24,"rgba(143,119,176,.085)");
    g.addColorStop(.63,"rgba(104,86,146,.065)");
    g.addColorStop(1,"rgba(95,74,129,0)");
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
