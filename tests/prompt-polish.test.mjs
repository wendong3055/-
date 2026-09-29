import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['lib/prompt-polish.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {polishInput,polishText}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
for(const input of [null,{}, {text:'',context:''},{text:'字'.repeat(1501),context:''},{text:'你好',context:'字'.repeat(601)}])assert.throws(()=>polishInput(input));
const input=polishInput({text:' 保留画芯 ',context:'胡桃木色'});
assert.equal(input.text,'保留画芯');
let calls=0;
const good=await polishText('test-only',input,async(url,options)=>{
  calls++;assert.equal(url,'https://llm.runninghub.ai/v1/chat/completions');assert.equal(options.redirect,'manual');
  const body=JSON.parse(options.body);assert.equal(body.stream,false);assert.ok(!options.body.includes('image_url'));
  return Response.json({choices:[{message:{content:'保留原画芯与框架结构。'},finish_reason:'stop'}]});
});
assert.equal(good,'保留原画芯与框架结构。');assert.equal(calls,1);
for(const status of [401,403,429,500])await assert.rejects(polishText('test-only',input,async()=>new Response('',{status})));
for(const payload of [{},{choices:[{message:{content:'字'.repeat(1501)}}]},{choices:[{message:{content:'未完成'},finish_reason:'length'}]}])await assert.rejects(polishText('test-only',input,async()=>Response.json(payload)));
await assert.rejects(polishText('test-only',input,async()=>new Response('',{status:302,headers:{Location:'https://example.com'}})));
console.log('Prompt polishing: validation, text-only request, success, permissions, errors, truncation and redirect tests passed. No network calls.');
