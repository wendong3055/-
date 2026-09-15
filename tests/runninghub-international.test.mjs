import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE rh_creator_keys(owner_id TEXT PRIMARY KEY,encrypted_key TEXT); CREATE TABLE generation_tasks(owner_id TEXT,status TEXT); CREATE TABLE rh_creator_tasks(owner_id TEXT,status TEXT);');
db.exec(await readFile(new URL('../drizzle/0011_spicy_purple_man.sql',import.meta.url),'utf8'));
const raw=crypto.getRandomValues(new Uint8Array(32));
globalThis.__rhTestEnv={
  CREDENTIAL_ENCRYPTION_KEY:Buffer.from(raw).toString('base64'),
  DB:{prepare(sql){return {bind(...args){return {
    async first(){return db.prepare(sql).get(...args)},
    async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}
  }}}}}
};
const source=(await readFile(new URL('../db/runninghub-international.ts',import.meta.url),'utf8')).replace("import { env } from 'cloudflare:workers';",'const env = globalThis.__rhTestEnv;');
const m=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
async function save(owner,plain){const iv=crypto.getRandomValues(new Uint8Array(12));const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(`rh-creator:${owner}`)},key,new TextEncoder().encode(plain));db.prepare('INSERT OR REPLACE INTO rh_creator_keys VALUES (?,?)').run(owner,`v1.${Buffer.from(iv).toString('base64')}.${Buffer.from(encrypted).toString('base64')}`);}
await save('owner','fake-original');
assert.equal(await m.latestInternationalKeyId('owner'),null);
await m.connectSavedInternationalKey('owner');const id=await m.latestInternationalKeyId('owner');
assert.equal(await m.internationalSnapshotKey('owner',id),'fake-original');
await save('owner','fake-replacement');assert.equal(await m.internationalSnapshotKey('owner',id),'fake-original');
await assert.rejects(()=>m.internationalSnapshotKey('another-owner',id));
await assert.rejects(()=>m.connectSavedInternationalKey('missing-owner'));
db.prepare('INSERT INTO generation_tasks(owner_id,status) VALUES (?,?)').run('owner','unknown');
await assert.rejects(()=>m.connectSavedInternationalKey('owner'));
const submit=await readFile(new URL('../app/api/generate-preview/route.ts',import.meta.url),'utf8');
const query=await readFile(new URL('../app/api/generations/[id]/route.ts',import.meta.url),'utf8');
assert.match(submit,/credential_id: credentialId/);assert.match(query,/row.credential_id \?\? null/);
const config=await readFile(new URL('../app/api/runninghub/config/route.ts',import.meta.url),'utf8');assert.match(config,/body.confirmedInternational !== true/);
db.close(); delete globalThis.__rhTestEnv;
console.log('International key snapshot, rotation, owner isolation, active-task lock and historical query checks passed (mock only).');
