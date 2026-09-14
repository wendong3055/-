import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../lib/production-annotations.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {productBounds,drawSizeAnnotations,detailCaptions}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const pixels=new Uint8ClampedArray(10*10*4).fill(255);
assert.equal(productBounds(pixels,10,10),null);
for(let y=2;y<=8;y++)for(let x=3;x<=6;x++){const i=(y*10+x)*4;pixels[i]=70;pixels[i+1]=60;pixels[i+2]=50;}
assert.deepEqual(productBounds(pixels,10,10),{left:3,right:6,top:2,bottom:8});
const labels=[],ctx=new Proxy({getImageData:()=>({data:pixels}),strokeText:()=>{},fillText:(s)=>labels.push(s)}, {get:(o,k)=>k in o?o[k]:()=>{}});
drawSizeAnnotations(ctx,{spec:{widthCm:120,heightCm:230,depthCm:30}},{x:0,y:100,width:10,height:10});
assert.deepEqual(labels,['高 230 cm','宽 120 cm','深 30 cm']);
assert.equal(detailCaptions['选购须知'].length,4);
assert.ok(!detailCaptions['选购须知'].some(s=>/免费|质保|实木|环保/.test(s)));
console.log('Production annotations: product bounds, confirmed dimensions, Chinese notices passed.');
