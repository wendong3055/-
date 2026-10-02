import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const b=await build({entryPoints:['app/trial-canvas.tsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react/jsx-runtime'],plugins:[{name:'inert-hooks',setup(b){b.onResolve({filter:/^react$/},a=>a.importer.endsWith('trial-canvas.tsx')?{path:'hooks',namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const useState=x=>[globalThis.viewHookValues?.length?globalThis.viewHookValues.shift():x,()=>{}];export const useRef=x=>({current:x});export const useEffect=()=>{};',loader:'js'}));}}]});
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

const previous={...task,id:'previous',createdAt:0,url:'/previous.png',favorite:true};
let favorites=0,submissions=0;
globalThis.viewHookValues=[true,'previous',false];
const compared=m.exports.TrialCanvas({...props,tasks:[task,previous],onFavorite(){favorites++;},onGenerate(){submissions++;}});
const windowNode=nodes(compared).find(n=>typeof n.type==='function'&&n.type.name==='PreviewWindow');
assert.equal(windowNode.props.comparison.src,'/previous.png');
assert.equal(windowNode.props.picture.src,'/current.png');
const viewportTree=windowNode.type(windowNode.props);
const viewports=nodes(viewportTree).filter(n=>typeof n.type==='function'&&n.type.name==='ImageViewport');
assert.equal(viewports.length,4); // Both panes in normal and full-screen view.
assert.ok(viewports.every(n=>n.props.zoom===100&&n.props.fit==='contain'));
nodes(compared).find(n=>n.type==='button'&&text(n)==='☆ 收藏这版').props.onClick();
assert.equal(favorites,1);assert.equal(submissions,0);
globalThis.viewHookValues=[false,'',true];
const favoriteView=m.exports.TrialCanvas({...props,tasks:[task,previous]});
const strip=nodes(favoriteView).find(n=>n.props?.className==='trial-filmstrip');
assert.equal(nodes(strip).filter(n=>n.type==='button').length,1);
assert.match(text(strip),/previous|宽150/);
delete globalThis.viewHookValues;
console.log('PASS two-version comparison with shared zoom/fit, favorite-only history and no generation during selection/favoriting.');
