import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../lib/runninghub.ts',import.meta.url),'utf8');
const body=source.slice(source.indexOf('export async function downloadResult('));
let calls=[];
globalThis.__rhDownloadMock=async(url,options)=>{calls.push({url,options});return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}})};
const prefix='class RunningHubError extends Error {}\nconst fetchWithoutRedirect=globalThis.__rhDownloadMock;\n';
const {downloadResult}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(prefix+body,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const host='rh-hk-images-1252422369.cos.ap-hongkong.myqcloud.com';
assert.equal((await downloadResult(`https://${host}/result.png?signature=fake`)).size,3);
assert.equal(calls.length,1);assert.equal(calls[0].options.headers,undefined);
for(const url of [`http://${host}/a`,`https://${host}:444/a`,`https://fake@${host}/a`,`https://${host}.evil.test/a`,`https://evil-${host}/a`,'https://other.cos.ap-hongkong.myqcloud.com/a','https://127.0.0.1/a','https://example.test/private-path?secret=do-not-leak']){
 await assert.rejects(()=>downloadResult(url),e=>!e.message.includes('private-path')&&!e.message.includes('do-not-leak'));
}
assert.equal(calls.length,1);
// Downloads must never follow a redirect: the adapter routes them through
// fetchWithoutRedirect, which is the single place that pins redirect handling.
assert.match(body,/fetchWithoutRedirect/);
assert.match(await readFile(new URL('../lib/safe-http.ts',import.meta.url),'utf8'),/redirect: 'manual'/);
delete globalThis.__rhDownloadMock;
console.log('RunningHub exact CDN allowlist, unsafe URL rejection and signed URL redaction passed (mock only).');
