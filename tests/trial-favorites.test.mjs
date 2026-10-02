import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
async function bundle(contents, plugins = []) {
  const built = await build({stdin:{contents,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',external:['next/server'],plugins});
  const m={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,m,m.exports);return m.exports;
}
const {trialChanges,previousTrial}=await bundle(`export * from './lib/trial-changes';`);
const recipe={artworkId:'a',frameId:'f',colorId:'c',intent:'composition',instruction:'保持结构',quality:'medium'};
const task=(id,time,r=recipe)=>({id,name:id,status:'succeeded',url:`/api/files/${id}`,model:'gpt-image-2',resolution:'2k',aspectRatio:'1:1',createdAt:time,recipe:r});
const old=task('old',1),same=task('same',2),current=task('new',3,{...recipe,colorId:'dark',instruction:'增加摆件'});
assert.deepEqual(trialChanges(same,old),[]);
assert.deepEqual(trialChanges(current,same,(_,id)=>({c:'原木',dark:'深木'}[id]||id)).map(c=>[c.label,c.before,c.after]),[['木色','原木','深木'],['制作要求','保持结构','增加摆件']]);
assert.equal(trialChanges({...current,recipe:null},old),null);
assert.equal(previousTrial(current,[current,old,same]).id,'same');
assert.equal(previousTrial(old,[current,old,same]),undefined);

const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())db.exec(readFileSync(`drizzle/${file}`,'utf8'));
const insert=db.prepare(`INSERT INTO generation_tasks(id,owner_id,name,status,model,prompt,aspect_ratio,resolution,color_name,asset_id,error,created_at,updated_at) VALUES(?,?,'图片',?,'test','p','1:1','2k','原木',?,'',?,?)`);
insert.run('saved','alice','succeeded','saved',1,1);insert.run('other','bob','succeeded','other',1,1);insert.run('pending','alice','running',null,1,1);
for(let n=0;n<110;n++)insert.run(`recent-${n}`,'alice','succeeded',`recent-${n}`,n+2,n+2);
const adapter={prepare(sql){const statement=db.prepare(sql);let args=[];const prepared={bind(...next){args=next;return prepared;},async run(){return {meta:{changes:Number(statement.run(...args).changes)}};},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};}};return prepared;}};
const mocks={name:'server-mocks',setup(b){
  b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'worker',namespace:'mock'}));
  b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='worker'?'export const env=globalThis.testEnv;':'export const getChatGPTUser=async()=>globalThis.testUser;',loader:'js'}));
}};
globalThis.testEnv={DB:adapter};globalThis.testUser={userId:'alice'};
const {POST,listTasks,publicTask}=await bundle(`export {POST} from './app/api/generations/[id]/favorite/route'; export {listTasks,publicTask} from './db/generation-tasks';`,[mocks]);
const request=(favorite,headers={})=>new Request('https://studio.test/api/generations/saved/favorite',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({favorite})});
const context=id=>({params:Promise.resolve({id})});
assert.equal((await POST(request(true),context('saved'))).status,200);
assert.equal(publicTask(await adapter.prepare('SELECT * FROM generation_tasks WHERE id=?').bind('saved').first()).favorite,true);
assert.ok((await listTasks('alice')).some(row=>row.id==='saved')); // Favorite survives beyond latest 100.
assert.equal((await POST(request(true),context('other'))).status,404);
assert.equal(db.prepare('SELECT favorite FROM generation_tasks WHERE id=?').get('other').favorite,0);
assert.equal((await POST(request(true),context('pending'))).status,404);
assert.equal((await POST(request('true'),context('saved'))).status,400);
assert.equal((await POST(request(false,{origin:'https://elsewhere.test'}),context('saved'))).status,401);
assert.equal(db.prepare('SELECT favorite FROM generation_tasks WHERE id=?').get('saved').favorite,1);
globalThis.testUser=null;assert.equal((await POST(request(false),context('saved'))).status,401);
globalThis.testUser={userId:'alice'};
assert.equal((await POST(request(false),context('saved'))).status,200);
assert.equal((await POST(request(false),context('saved'))).status,200); // Explicit desired state is repeat-safe.
assert.equal(db.prepare('SELECT favorite FROM generation_tasks WHERE id=?').get('saved').favorite,0);
db.close();delete globalThis.testEnv;delete globalThis.testUser;
console.log('PASS actual SQLite migrations, durable favorites outside recent history, owner/CSRF isolation, invalid states, repeat-safe updates and recipe diffs. No provider calls.');
