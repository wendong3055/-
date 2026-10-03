import { env } from 'cloudflare:workers';
import { parseStudioDraft, type SavedStudioDraft, type StudioDraft } from '../lib/studio-draft';

export async function getStudioDraft(owner: string): Promise<SavedStudioDraft | null> {
  const row = await env.DB.prepare('SELECT data_json,revision,updated_at FROM studio_drafts WHERE owner_id=?').bind(owner).first<{data_json:string;revision:number;updated_at:number}>();
  if (!row) return null;
  const data = parseStudioDraft(JSON.parse(row.data_json));
  if (!data) throw new Error('草稿格式无法读取，原记录已保留。');
  return { data, revision: row.revision, updatedAt: row.updated_at };
}

export async function saveStudioDraft(owner: string, data: StudioDraft, baseRevision: number) {
  const updatedAt = Date.now(), json = JSON.stringify(data);
  const result = baseRevision === 0
    ? await env.DB.prepare('INSERT INTO studio_drafts (owner_id,data_json,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id) DO NOTHING').bind(owner,json,updatedAt).run()
    : await env.DB.prepare('UPDATE studio_drafts SET data_json=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(json,updatedAt,owner,baseRevision).run();
  if (!result.meta.changes) return { saved: false as const, draft: await getStudioDraft(owner) };
  return { saved: true as const, draft: { data, updatedAt, revision: baseRevision + 1 } };
}
