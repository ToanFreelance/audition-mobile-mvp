// Eye Asset Pack V5.1 — conservative full-iris restoration.
// IMPORTANT: V5 projected a second inner disc over the GLB's original purple iris.
// Restore the proven V4 original-pigment mask; enhance only pixels already in the
// source iris. NEVER draw an independent circular iris or second pupil on top.
export const EYE_STYLE_IDS=Object.freeze(["natural","joyful","sad","playful","angry","doll","idol","star","heart"]);
export const eyeCommonV51=[
"#include <common>",
"varying vec3 vEyeLocal;",
"uniform vec3 uEyeTint;",
"uniform float uEyeOpacity;",
"uniform int uEyeStyle;",
"vec3 eyeRgbToHsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x);}",
"vec3 eyeHsvToRgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}",
"float eyeHeart(vec2 p){p.y+=.18;p.x*=1.05;float x=p.x,y=p.y;float f=pow(x*x+y*y-1.,3.)-x*x*y*y*y;return 1.-smoothstep(-.05,.06,f);}",
"float eyeStar(vec2 p){float a=atan(p.y,p.x)-1.5707963;float wave=acos(clamp(cos(5.*a),-1.,1.))/3.14159265;float edge=mix(.90,.42,wave);return 1.-smoothstep(edge-.045,edge+.045,length(p));}"
].join("\n");

export const eyeFragmentV51=[
"#include <map_fragment>","{",
"  // EXACT V4 full-eye region: keeps the original source iris boundary visible.",
"  float ax=abs(vEyeLocal.x);",
"  float eyeEll=length(vec2((ax-.116)/.064,(vEyeLocal.z+.509)/.058));",
"  float eyeRegion=(1.-smoothstep(.87,1.15,eyeEll))*smoothstep(.177,.202,vEyeLocal.y);",
"  vec3 base=diffuseColor.rgb;",
"  vec3 baseHsv=eyeRgbToHsv(base);",
"  float violetHue=smoothstep(.675,.725,baseHsv.x)*(1.-smoothstep(.90,.98,baseHsv.x));",
"  float pigment=violetHue*smoothstep(.12,.24,baseHsv.y);",
"  float irisCoverage=clamp(eyeRegion*pigment,0.,1.);",
"  // Shift hue of the ENTIRE source iris. Do not clip to a small projected disc.",
"  float targetHue=eyeRgbToHsv(uEyeTint).x;",
"  float hueDelta=fract(targetHue-baseHsv.x+.5)-.5;",
"  vec3 shiftedHsv=baseHsv;",
"  shiftedHsv.x=fract(baseHsv.x+hueDelta*irisCoverage*uEyeOpacity);",
"  // Style-specific radial fibers/limbal contrast, strictly gated by pigment.",
"  // Keep the original pupil and original white glints; no second pupil.",
"  vec2 p=vec2((ax-.116)/.052,(-.508-vEyeLocal.z)/.050);",
"  float radius=length(p);",
"  float theta=atan(p.y,p.x);",
"  float annulus=smoothstep(.27,.47,radius)*(1.-smoothstep(.80,1.03,radius));",
"  float fiber=(.5+.5*sin(theta*39.+radius*10.))-.5;",
"  float thinFiber=(.5+.5*sin(theta*71.-radius*20.))-.5;",
"  float outer=smoothstep(.72,.90,radius);",
"  float inner=exp(-pow((radius-.53)/.23,2.));",
"  float deltaLight=0.;float deltaSat=0.;",
"  if(uEyeStyle==1){deltaLight=.090*inner+.028*fiber*annulus;deltaSat=.02;}", // joyful honey
"  if(uEyeStyle==2){deltaLight=-.045*outer+.025*inner;deltaSat=-.11;}", // sad
"  if(uEyeStyle==3){deltaLight=.045*inner+.085*fiber*annulus+.022*thinFiber*annulus;deltaSat=.07;}", // playful
"  if(uEyeStyle==4){deltaLight=-.092*outer+.055*fiber*annulus;deltaSat=.09;}", // angry ruby
"  if(uEyeStyle==5){deltaLight=.105*inner+.024*fiber*annulus;deltaSat=.03;}", // doll violet
"  if(uEyeStyle==6){deltaLight=.095*inner+.110*fiber*annulus+.045*thinFiber*annulus;deltaSat=.06;}", // idol
"  if(uEyeStyle==7){deltaLight=.078*inner+.050*fiber*annulus;deltaSat=.05;}", // star
"  if(uEyeStyle==8){deltaLight=.098*inner+.040*fiber*annulus;deltaSat=.03;}", // heart
"  shiftedHsv.y=clamp(shiftedHsv.y+irisCoverage*deltaSat*uEyeOpacity,0.,1.);",
"  shiftedHsv.z=clamp(shiftedHsv.z+irisCoverage*deltaLight*uEyeOpacity,0.,1.);",
"  diffuseColor.rgb=eyeHsvToRgb(shiftedHsv);",
"  // Re-use the iPhone-approved V4 motif center and placement.",
"  if(uEyeStyle==7 || uEyeStyle==8){",
"    float motifScale=uEyeStyle==7?.0180:.0190;",
"    vec2 mp=vec2((ax-.1160)/motifScale,(-.5080-vEyeLocal.z)/motifScale);",
"    float mark=uEyeStyle==7?eyeStar(mp):eyeHeart(mp);",
"    vec3 motif=uEyeStyle==7?vec3(1.,.77,.27):vec3(1.,.50,.76);",
"    float opacity=uEyeStyle==7?.76:.86;",
"    diffuseColor.rgb=mix(diffuseColor.rgb,motif,mark*irisCoverage*opacity*uEyeOpacity);",
"  }",
"}"
].join("\n");
