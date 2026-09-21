import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../lib/detail-batch.ts',import.meta.url),'utf8');
const {runDetailBatch,detailCandidates}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const items=[{id:'a',kind:'detail',title:'画芯'},{id:'b',kind:'detail',title:'参数'}];
const done={id:'c',kind:'detail',generationId:'g',task:{status:'succeeded',url:'/c'}};
assert.deepEqual(detailCandidates([...items,done,{id:'main',kind:'main'}]),items);
assert.equal(detailCandidates([{...done,task:{status:'unknown'}},{...done,review:'rework'}],true).length,1);
let submits=[],polls=[],stopped=false;
const io={stopped:()=>stopped,submit:async i=>{submits.push(i.id);return{id:i.id,status:'queued'};},poll:async id=>{polls.push(id);return{id,status:'succeeded',url:'/ok'};},wait:async()=>{},progress:()=>{}};
await runDetailBatch(items,io);assert.deepEqual(submits,['a','b']);assert.deepEqual(polls,['a','b']);
for(const status of ['unknown','failed']){submits=[];await assert.rejects(()=>runDetailBatch(items,{...io,poll:async id=>({id,status})}));assert.deepEqual(submits,['a']);}
submits=[];await assert.rejects(()=>runDetailBatch(items,{...io,submit:async i=>{submits.push(i.id);throw Error('network unknown');}}));assert.deepEqual(submits,['a']);
submits=[];await runDetailBatch(items,{...io,progress:()=>{stopped=true;}});assert.deepEqual(submits,['a']);
stopped=false;submits=[];await assert.rejects(()=>runDetailBatch(items,{...io,maxPolls:0}));assert.deepEqual(submits,['a']);
console.log('PASS detail batch: serial, skip completed/main, stop, timeout, failed and uncertain never retry. No live generation.');
