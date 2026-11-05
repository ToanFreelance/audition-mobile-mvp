// Anime Lite V2 candidate: reproducibly fetch SHA-256 pinned CC0 GLBs
// at Vercel build time, never from the owner's iPhone or Supabase Storage.
import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile,rename} from "node:fs/promises";
import path from "node:path";
const commit="852e48f316b90a0937234886630e4fb4cdfd1f78";
const upstream="https://raw.githubusercontent.com/kblood/CharacterCreator/"+commit+"/output/";
const dest=path.join(process.cwd(),"public/characters/anime-lite-v2");
const sources={
 "base_body.glb":"b5b450af89f6fbf8debf387eda8da40cd0a8c3253a2d59871c730ce7e7f46469",
 "hair_long01.glb":"d340fff458f920dd16dcc80493a1a33207b00c6bbfb08c4c53aba54704a78818",
 "hair_bob02.glb":"6fda507823964a160c7552a9a8c283d6770a2944f1e24795026e42ba989aec7d",
 "clothing_dress.glb":"038fc440ae3932ba0e26a74c3cdcc53d381978832f5ea0fb58ef45e8b5055e06",
 "clothing_shoes.glb":"ea483876a6de5d51bf9fef16e1fd1e8957573398eab3321870d93af8c7dbc9a2",
 "clothing_jacket.glb":"22c489abb90fa3af3381948a91016ae2fa5dc5ab1c1152721527ac74c70e9dbd",
 "clothing_jeans.glb":"dac0e90aba219415e895eed0e471c0a9aab6b53f8870be1f8dfd41cd89c25d11",
 "clothing_tshirt.glb":"f77eaea89354ad57bcce48a877bec314e82d71de84700810e7c8290b20886063"
};
const sha256=b=>createHash("sha256").update(b).digest("hex");
await mkdir(dest,{recursive:true});
for(const [file,expected] of Object.entries(sources)){
 const out=path.join(dest,file.replace(".glb","-"+expected.slice(0,12)+".glb"));
 let valid=false;
 try{valid=sha256(await readFile(out))===expected}catch{}
 if(valid){console.log("[anime-lite-v2] cached",file);continue;}
 let lastError=null;
 for(let attempt=0;attempt<3&&!valid;attempt++){
  try{
   const res=await fetch(upstream+file,{signal:AbortSignal.timeout(45000),headers:{"User-Agent":"Audition-Mobile-MVP-Character-V2-QA"}});
   if(!res.ok)throw new Error("HTTP "+res.status);
   const bytes=Buffer.from(await res.arrayBuffer());
   const digest=sha256(bytes);
   if(digest!==expected)throw new Error("SHA mismatch "+file+": "+digest);
   await writeFile(out+".tmp",bytes);await rename(out+".tmp",out);
   console.log("[anime-lite-v2] verified",file,bytes.length,"bytes");
   valid=true;
  }catch(error){lastError=error;}
 }
 if(!valid)throw new Error("Unable to materialize "+file+": "+String(lastError));
}
console.log("[anime-lite-v2] all 8 CC0 binaries SHA-256 verified",commit);

