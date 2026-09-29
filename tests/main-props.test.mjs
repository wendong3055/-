import assert from 'node:assert/strict';import {build} from 'esbuild';
const out=await build({entryPoints:['lib/main-props.ts'],bundle:true,write:false,format:'esm'});
const {mainPropsBrief}=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
assert.equal(mainPropsBrief('size','auto',''), '');assert.equal(mainPropsBrief('detail','custom','花瓶'),'');
assert.match(mainPropsBrief('main','none',''),/不添加摆件/);
assert.match(mainPropsBrief('main','auto',''),/不新增隔板/);
assert.match(mainPropsBrief('main','custom','陶瓷花瓶'),/陶瓷花瓶/);
assert.match(mainPropsBrief('main','auto',''),/没有合适的摆放位置/);
console.log('PASS main props prompt, default off, custom and main-only scope.');
