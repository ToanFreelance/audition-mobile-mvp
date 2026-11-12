const {validateBytes}=require(process.env.GLTF_VALIDATOR||'gltf-validator');
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
(async()=>{for(const ext of ['glb','vrm']){
 const bytes=fs.readFileSync(path.join(root,'out','Vita-Premium-Cute-V11.'+ext));
 const {issues}=await validateBytes(new Uint8Array(bytes),{maxIssues:400});
 const counts={};for(const m of issues.messages){counts[m.code]=(counts[m.code]||0)+1;}
 const result={errors:issues.numErrors,warnings:issues.numWarnings,codes:counts,firstPerCode:Object.keys(counts).map(c=>issues.messages.find(m=>m.code===c))};
 fs.writeFileSync(path.join(root,'review','validator-'+ext+'.json'),JSON.stringify(result,null,2));
 console.log(ext,issues.numErrors,issues.numWarnings,counts);
}})().catch(e=>{console.error(e);process.exit(1)});
