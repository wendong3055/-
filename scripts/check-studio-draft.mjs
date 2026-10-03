import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Uses the real request handlers and SQL against an in-memory SQLite database.
// Only identity retrieval and the D1 adapter are replaced. No external requests.
const source = `
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {GET,PUT} from './app/api/studio-draft/route';
import {parseStudioDraft,studioDraftIssues} from './lib/studio-draft';
import {latestGenerationNotice} from './lib/generation-notice';
import {imageModels} from './lib/generation-models';
import {StudioDraftBar} from './app/studio-draft';
import {TrialCanvas} from './app/trial-canvas';
import Home from './app/page';

export async function verify() {
  globalThis.fetch=()=>{throw Error('External requests are forbidden in this check');};
  const sql = new DatabaseSync(':memory:');
  sql.exec("CREATE TABLE existing_results (id TEXT PRIMARY KEY); INSERT INTO existing_results VALUES ('keep')");
  sql.exec(readFileSync('drizzle/0013_wide_colossus.sql','utf8'));
  assert.equal(sql.prepare('SELECT id FROM existing_results').get().id,'keep');
  globalThis.__draftDb={prepare(query){return {bind(...args){return {
    async first(){return sql.prepare(query).get(...args) || null;},
    async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}
  };}};}};
  const data={artworkId:'art-a',frameId:'frame-a',colorId:'walnut',sceneId:'',intent:'composition',instruction:'保留完整结构',modelId:'gpt-image-2',aspectRatio:'1:1',resolution:'2k',quality:'medium',background:'auto',outputFormat:'png',step:'brief'};
  const request=(body,headers={})=>new Request('https://work.test/api/studio-draft',{method:'PUT',headers:{'content-type':'application/json','origin':'https://work.test',...headers},body:JSON.stringify(body)});
  assert.deepEqual(parseStudioDraft(data),data);
  for(const invalid of [{...data,apiKey:'must-not-save'},{...data,instruction:'x'.repeat(1501)},{...data,step:'submit'},null,[],{...data,modelId:''}]) assert.equal(parseStudioDraft(invalid),null);
  assert.deepEqual(studioDraftIssues(data,{artworkIds:['art-a'],frameIds:['frame-a'],colorIds:['walnut'],sceneIds:[],models:imageModels}),[]);
  assert.equal(studioDraftIssues({...data,modelId:'removed'},{artworkIds:[],frameIds:[],colorIds:['walnut'],sceneIds:[],models:imageModels}).length,3);
  assert.ok(studioDraftIssues({...data,resolution:'invalid'},{artworkIds:['art-a'],frameIds:['frame-a'],colorIds:['walnut'],sceneIds:[],models:imageModels}).length);

  globalThis.__draftOwner=null;
  assert.equal((await GET()).status,401);
  assert.equal((await PUT(request({data,baseRevision:0}))).status,401);
  globalThis.__draftOwner='owner-a';
  assert.equal((await PUT(request({data,baseRevision:0},{origin:'https://other.test','sec-fetch-site':'cross-site'}))).status,401);
  assert.deepEqual(await (await GET()).json(),{draft:null});
  assert.equal((await PUT(request({data:{...data,apiKey:'secret'},baseRevision:0}))).status,400);
  assert.equal((await PUT(request({data,baseRevision:-1}))).status,400);
  assert.equal((await PUT(request({data,padding:'x'.repeat(17000),baseRevision:0}))).status,413);
  const initial=await PUT(request({data,baseRevision:0,ownerId:'owner-b'}));
  assert.equal(initial.status,200);
  assert.equal((await initial.json()).draft.revision,1);
  globalThis.__draftOwner='owner-b';
  assert.deepEqual(await (await GET()).json(),{draft:null});
  assert.equal((await PUT(request({data:{...data,instruction:'B'},baseRevision:0}))).status,200);
  globalThis.__draftOwner='owner-a';
  assert.equal((await (await GET()).json()).draft.data.instruction,data.instruction);
  const results=await Promise.all([PUT(request({data:{...data,instruction:'tab-one'},baseRevision:1})),PUT(request({data:{...data,instruction:'tab-two'},baseRevision:1}))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const current=(await (await GET()).json()).draft;
  assert.equal(current.revision,2);
  const stale=await PUT(request({data:{...data,instruction:'stale'},baseRevision:1}));
  assert.equal(stale.status,409);
  assert.deepEqual((await stale.json()).draft,current);
  assert.equal((await PUT(request({data:{...data,instruction:'explicit choice'},baseRevision:2}))).status,200);
  globalThis.__draftOwner='owner-b';
  assert.equal((await (await GET()).json()).draft.data.instruction,'B');

  const task={id:'failed',name:'本次试稿',status:'failed',createdAt:2,model:'gpt-image-2',aspectRatio:'1:1',resolution:'2k',error:'test',url:null,assetId:null,remoteTaskId:null,recipe:{artworkId:'art-a',frameId:'frame-a',colorId:'walnut',intent:'composition',instruction:'保持结构'}};
  assert.equal(latestGenerationNotice([task,{...task,id:'unknown',status:'unknown',createdAt:3}],'').kind,'attention');
  assert.equal(latestGenerationNotice([task,{...task,id:'success',status:'succeeded',createdAt:4}],'success'),null);
  const props={tasks:[task],activeTaskId:'failed',working:false,status:'',loading:false,onSelect:()=>{},onReuse:()=>{},reuseDisabled:false,onHistory:()=>{},onGenerate:()=>{throw Error('No generation');},canGenerate:false,generateLabel:'生成',outputSummary:'',references:[]};
  assert.ok(render(React.createElement(TrialCanvas,props)).includes('带回设置修改'));
  const unknown=render(React.createElement(TrialCanvas,{...props,tasks:[{...task,status:'unknown'}]}));
  assert.ok(unknown.includes('查看记录并核对') && !unknown.includes('带回设置修改'));
  const banner=render(React.createElement(StudioDraftBar,{draft:{pending:{data,revision:1,updatedAt:1},phase:'conflict',error:'',savedAt:1,dirty:false,accept:()=>{},retry:()=>{}},busy:false,restoreIssue:'素材不可用',onRestore:()=>{},onUseCurrent:()=>{},onTextOnly:()=>{}}));
  assert.ok(banner.includes('保存本页这份编辑') && banner.includes('只恢复文字要求'));
  assert.ok(render(React.createElement(Home)).includes('编辑草稿'));
  sql.close();
  console.log('通过：草稿校验、账号隔离、跨站拒绝、请求大小、版本冲突、迁移保留旧数据、恢复缺项、任务状态及页面渲染。无外部请求或收费生图。');
}
`;

const temp = mkdtempSync(join(tmpdir(),'studio-draft-check-'));
try {
  const output=join(temp,'check.cjs');
  await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},outfile:output,bundle:true,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},plugins:[{
    name:'offline-fixtures',setup(plugin){
      plugin.onResolve({filter:/^cloudflare:workers$/},()=>({path:'workers',namespace:'fixture'}));
      plugin.onResolve({filter:/chatgpt-auth$/},()=>({path:'identity',namespace:'fixture'}));
      plugin.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='workers'?'export const env={get DB(){return globalThis.__draftDb;}};':'export async function getChatGPTUser(){return globalThis.__draftOwner ? {userId:globalThis.__draftOwner} : null;}',loader:'js'}));
    }
  }]});
  const module=await import(pathToFileURL(output).href);
  await module.default.verify();
} finally { rmSync(temp,{recursive:true,force:true}); }
