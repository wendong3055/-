// Read-only official public catalogue. Emits an apply_patch document; never uses a Key.
const origin = 'https://www.runninghub.ai';
async function post(path, body) {
  const response = await fetch(origin + path, {method:'POST', headers:{'content-type':'application/json','X-RH-Lang':'zh','User-Language':'zh_CN',client:'WEB'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const json = await response.json();
  if (!response.ok || json.code !== 0) throw new Error(`Public catalogue failed: ${response.status}`);
  return json.data;
}
const list = await post('/api/sku/list',{categoryType:'STANDARD_MODEL',pageNum:1,pageSize:999});
if (Number(list.page.pages) !== 1) throw new Error('Catalogue pagination changed');
const entries = list.page.records.filter(x=>['image-to-image','text-to-image','image-tools','image-effects'].includes(x.categoryName)&& !/Deprecated/i.test(x.name));
// Newly published entries visible in the official UI but not yet in its cached list response.
const extra = ['2133000000000504076','2133000000000504075','2133100000000800376','2133100000000800378','2133100000000800375','2133100000000800384','2133100000000800377','2133100000000800383','2133100000000800382','2133100000000800381'];
const ids=[...new Set([...entries.map(x=>x.id),...extra])];
const records=[];
for (let i=0;i<ids.length;i+=6) {
  records.push(...await Promise.all(ids.slice(i,i+6).map(async id=>{
    const d=await post('/api/sku/detail',{id});
    const fields=JSON.parse(d.inputConfigJson||'[]').map(f=>Object.fromEntries(Object.entries(f).filter(([key])=>['fieldKey','type','title','required','min','max','minLength','maxLength','maxSize','maxInpuNum','multipleInputs','multiple','options','defaultValue','step'].includes(key))));
    for(const f of fields){
      // Do not ship provider example images/prompts or signed URLs as user defaults.
      if (['IMAGE','STRING','MODEL','LORA'].includes(f.type)) delete f.defaultValue;
      if(f.options) f.options=f.options.map(o=>({value:o.value,label:o.description||String(o.value)}));
    }
    return {skuId:id,name:d.name,endpoint:'/openapi/v2'+d.rhEndpoint,channel:d.modelVersion||'',vendor:d.relationTags?.find(x=>x.parentId===21)?.name||'',capabilities:d.relationTags?.filter(x=>x.parentId===18).map(x=>x.name)||[],fields};
  })));
}
records.sort((a,b)=>a.name.localeCompare(b.name));
const content=JSON.stringify({checkedAt:'2026-09-15',source:origin+'/zh-cn/call-api/search-api/standard-model',models:records},null,2)+'\n';
console.log('*** Begin Patch\n*** Add File: lib/runninghub-catalog.json\n'+content.split('\n').map(x=>'+'+x).join('\n')+'\n*** End Patch');
