// Audition Mobile MVP — isolated Golden Eye V7 texture mapping.
// Source of visual design: owner-approved iris-only 9-pack and full-head 9-pack, 2026-11-07.
// Nine separate high-resolution iris designs are authored into a 1536x1536 SVG atlas.
// The shader only replaces the ORIGINAL GLB eye pigment / pupil, never the sclera,
// lashes, brows or the whole eye image. The head remains a real 3D surface.
// Note: this is not a standalone eyeball retopology or final UV-unwrapped module.
export const GOLDEN_V7_IDS=Object.freeze(["natural","joyful","sad","playful","angry","doll","idol","star","heart"]);

export const goldenV7Common=[
"#include <common>",
"varying vec3 vEyeLocal;",
"uniform sampler2D uGoldenV7Atlas;",
"uniform float uGoldenV7Ready;",
"uniform float uGoldenV7Enabled;",
"uniform int uGoldenV7Style;",
"// Fragment-local values reused after PBR lighting is assembled.",
"vec3 goldenV7IrisEmission=vec3(0.);",
"vec3 irisRgbToHsv(vec3 c){",
" vec4 K=vec4(0.,-1./3.,2./3.,-1.);",
" vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));",
" vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));",
" float d=q.x-min(q.w,q.y);",
" return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x);",
"}"
].join("\n");

export const goldenV7Fragment=[
"#include <map_fragment>",
"{",
" if(uGoldenV7Ready>.5 && uGoldenV7Enabled>.5){",
"  // Read the actual 3D mesh's original pigment after glTF base-color texture lookup.",
"  vec3 source=diffuseColor.rgb;",
"  vec3 hsv=irisRgbToHsv(source);",
"  float ax=abs(vEyeLocal.x);",
"  float eyeEll=length(vec2((ax-.116)/.064,(vEyeLocal.z+.509)/.058));",
"  float front=smoothstep(.181,.206,vEyeLocal.y);",
"  float socket=1.-smoothstep(.88,1.12,eyeEll);",
"  float pigment=smoothstep(.675,.725,hsv.x)*(1.-smoothstep(.90,.98,hsv.x))*smoothstep(.10,.22,hsv.y);",
"  // Cover the source's pupil and large white glints too: eliminate two-layer pupils.",
"  float innerEye=length(vec2((ax-.119)/.043,(vEyeLocal.z+.509)/.043));",
"  float pupilCleanup=1.-smoothstep(.63,.80,innerEye);",
"  float coverage=clamp(max(pigment*socket,pupilCleanup*.93)*front,0.,1.);",
"  if(coverage>.0001){",
"    // Source-specific, symmetric eye-space map. Both eyes use the SAME artwork;",
"    // sign-preserving x keeps star/heart upright and reflection glints consistent.",
"    float eyeSide=vEyeLocal.x<0.?-1.:1.;",
"    // The GLB uses LOWER z at the upper lid. Atlas PNG/SVG top must match that lid.",
"    // V7 had the opposite sign and displayed bottom fan glow at the top of the iris.",
"    vec2 eyeArt=vec2((vEyeLocal.x-eyeSide*.119)/.051,",
"                     -(vEyeLocal.z+.509)/.051);",
"    eyeArt=clamp(eyeArt,vec2(-.965),vec2(.965));",
"    vec2 within=eyeArt*.5+.5;",
"    float variant=float(uGoldenV7Style);",
"    float atlasColumn=mod(variant,3.);",
"    float atlasRow=floor(variant/3.);",
"    // Image rows run from top to bottom; GL texture coordinates run bottom to top.",
"    vec2 atlasUv=(vec2(atlasColumn,2.-atlasRow)+within)/3.;",
"    // The SVG atlas is tagged sRGB by TextureLoader; WebGL samples it as linear.",
"    // Gently lift midtones in linear space without adjusting the face/skin colors.",
"    vec3 irisArtwork=texture2D(uGoldenV7Atlas,atlasUv).rgb;",
"    vec3 liftedIris=mix(irisArtwork,sqrt(max(irisArtwork,vec3(0.))),.22);",
"    // Small eye-only emissive fill retains the gradient under ACES filmic shading.",
"    goldenV7IrisEmission=liftedIris*coverage*.26;",
"    diffuseColor.rgb=mix(source,liftedIris,coverage);",
"  }",
" }",
"}"
].join("\n");


// MeshStandardMaterial defines totalEmissiveRadiance before emissivemap_fragment.
// This is eye-only; face, eyebrows and lashes keep their existing lighting.
export const goldenV7Emissive=[
"#include <emissivemap_fragment>",
"totalEmissiveRadiance += goldenV7IrisEmission;"
].join("\n");
