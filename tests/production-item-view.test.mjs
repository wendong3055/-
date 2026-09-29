import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const b=await build({entryPoints:['app/trial-canvas.tsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime']});
const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);
const task={id:'current',name:'宽150 × 高200cm',status:'succeeded',url:'/current.png',createdAt:1,recipe:{instruction:'保留尺寸',productionItemId:'item'}};
const props={tasks:[task],activeTaskId:'current',working:false,loading:false,status:'',onSelect(){},onReuse(){},reuseDisabled:false,onHistory(){},onGenerate(){},canGenerate:true,generateLabel:'生成',outputSummary:'2K',references:[]};
function nodes(v){return Array.isArray(v)?v.flatMap(nodes):v&&typeof v==='object'?[v,...nodes(v.props?.children)]:[];}
function text(v){return Array.isArray(v)?v.map(text).join(''):v&&typeof v==='object'?text(v.props?.children):typeof v==='string'?v:'';}
const item=m.exports.TrialCanvas({...props,itemMode:true});
assert.match(text(item),/这张图的历史版本/);
assert.doesNotMatch(text(item),/继续下一轮|带入这张的设置|全部记录/);
assert.equal(nodes(item).filter(n=>n.props?.onClick===props.onGenerate).length,0);
assert.ok(nodes(item).some(n=>n.type==='a'&&n.props.href==='/current.png?download=1'));
assert.match(text(m.exports.TrialCanvas(props)),/继续下一轮/);
const source=readFileSync('app/page.tsx','utf8');
assert.match(source,/task\.recipe\?\.productionItemId === production\.itemId/);
assert.match(source,/setViewedTaskId\(b\.generationId \|\| ''\)/);
assert.match(source,/返回整套/);
console.log('PASS single-item history, no duplicate generate/reuse controls, download, initial result binding and item scope. No paid calls.');
