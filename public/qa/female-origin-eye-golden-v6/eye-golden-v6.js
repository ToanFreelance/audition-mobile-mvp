// Golden Eye V6 — reference-authored texture atlas from the owner-approved 2026-11-07 sheet.
// Unlike V5/V5.1, does not hue-shift the one purple eye into nine fake styles.
// Each of nine actual colored/pupil/sparkle patterns is sampled from a distinct
// 48x48 atlas tile. V6 is a 3D surface-mapped QA, NOT a retopologized eyeball asset.
export const GOLDEN_EYE_IDS=Object.freeze([
 "natural","joyful","sad","playful","angry","doll","idol","star","heart"
]);
export const GOLDEN_ATLAS_SOURCE=Object.freeze({
 columns:3,rows:3,tileSize:48,reference:"owner-accepted Golden Concept – Gói Mắt Nhân Vật",
 order:GOLDEN_EYE_IDS
});
export const goldenEyeShaderCommon=[
 "#include <common>",
 "varying vec3 vEyeLocal;",
 "uniform sampler2D uGoldenIrisAtlas;",
 "uniform float uGoldenAtlasReady;",
 "uniform int uGoldenLook;",
 "vec3 goldenRgbToHsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x);}"
].join("\n");

export const goldenEyeShaderFragment=[
 "#include <map_fragment>",
 "{",
 " if(uGoldenAtlasReady>.5){",
 "   // Full ORIGINAL GLB iris pigment mask from V5.1: avoids another disc/purple halo.",
 "   float ax=abs(vEyeLocal.x);",
 "   float eyeEll=length(vec2((ax-.116)/.064,(vEyeLocal.z+.509)/.058));",
 "   float eyeRegion=(1.-smoothstep(.87,1.15,eyeEll))*smoothstep(.177,.202,vEyeLocal.y);",
 "   vec3 rawHsv=goldenRgbToHsv(diffuseColor.rgb);",
 "   float purple=smoothstep(.675,.725,rawHsv.x)*(1.-smoothstep(.90,.98,rawHsv.x));",
 "   float sourcePigment=purple*smoothstep(.12,.24,rawHsv.y);",
 "   float coverage=clamp(eyeRegion*sourcePigment,0.,1.);",
 "   if(coverage>.00001){",
 "     // Triplanar-like local projection adheres to source 3D eye vertices.",
 "     // This does NOT create a flat disc geometry or duplicate source pupils.",
 "     vec2 irisP=vec2((ax-.116)/.052,(-.508-vEyeLocal.z)/.050);",
 "     float radius=length(irisP);",
 "     irisP*=min(1.,.92/max(radius,.0001));",
 "     vec2 within=clamp(irisP*.5+.5,vec2(.045),vec2(.955));",
 "     float style=float(uGoldenLook);",
 "     float atlasCol=mod(style,3.);",
 "     float atlasRow=floor(style/3.);",
 "     // Flip atlas row for GL's bottom-origin UV; source atlas stores Natural at top.",
 "     vec2 atlasUV=(vec2(atlasCol,2.-atlasRow)+within)/3.;",
 "     vec3 goldenColor=texture2D(uGoldenIrisAtlas,atlasUV).rgb;",
 "     // Preserve original model white specular highlights and sclera automatically:",
 "     // unpigmented pixels have zero coverage. Golden source holds unique pupil art.",
 "     diffuseColor.rgb=mix(diffuseColor.rgb,goldenColor,coverage);",
 "   }",
 " }",
 "}"
].join("\n");
