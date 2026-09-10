/** QA viewport harness: embeds the production page, with no alternate runtime. */
export default async function SoloQA({searchParams}:{searchParams:Promise<{width?:string}>}){
  const width=(await searchParams).width==='430'?430:390;
  const height=width===430?932:844;
  return <main style={{padding:12}}>
    <p>Solo Easy portrait QA · <a href="?width=390">390 × 844</a> · <a href="?width=430">430 × 932</a></p>
    <iframe title="Solo Easy gameplay" src="/?debug=1&seed=123" allow="autoplay" style={{width,height,boxSizing:"content-box",border:"1px solid #aaa",display:"block"}} />
  </main>;
}
