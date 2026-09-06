import { env } from 'cloudflare:workers';
import type { GenerationStatus, GenerationTask } from '../lib/generation-types';

export type TaskRow = {
  id: string; owner_id: string; remote_task_id: string | null; name: string;
  status: GenerationStatus; model: string; prompt: string; aspect_ratio: string;
  resolution: string; color_name: string; asset_id: string | null; error: string;
  last_polled_at: number; created_at: number; updated_at: number;
};

export function publicTask(row: TaskRow): GenerationTask {
  return { id: row.id, name: row.name, status: row.status, model: row.model,
    aspectRatio: row.aspect_ratio, resolution: row.resolution, createdAt: row.created_at,
    error: row.error, assetId: row.asset_id, url: row.asset_id ? `/api/files/${row.asset_id}` : null,
    remoteTaskId: row.remote_task_id };
}

export async function getTask(owner: string, id: string) {
  return env.DB.prepare('SELECT * FROM generation_tasks WHERE owner_id = ? AND id = ?').bind(owner, id).first<TaskRow>();
}

export async function listTasks(owner: string) {
  // Uploading is safe to expire: the billable call starts only after the submitting transition.
  await env.DB.prepare("UPDATE generation_tasks SET status = 'failed', error = '参考图上传中断，请重新生成。', updated_at = ? WHERE owner_id = ? AND status = 'uploading' AND updated_at < ?")
    .bind(Date.now(), owner, Date.now() - 300_000).run();
  await env.DB.prepare("UPDATE generation_tasks SET status = 'unknown', error = '提交结果尚未确认。请先在 RunningHub 任务记录核对，避免重复扣费。', updated_at = ? WHERE owner_id = ? AND status = 'submitting' AND updated_at < ?")
    .bind(Date.now(), owner, Date.now() - 120_000).run();
  const { results } = await env.DB.prepare('SELECT * FROM generation_tasks WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100').bind(owner).all<TaskRow>();
  return results;
}

export async function insertTask(row: TaskRow) {
  const result = await env.DB.prepare(`INSERT INTO generation_tasks
    (id, owner_id, name, status, model, prompt, aspect_ratio, resolution, color_name, created_at, updated_at)
    SELECT ?, ?, ?, 'uploading', ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS
    (SELECT 1 FROM generation_tasks WHERE owner_id = ? AND status IN ('uploading','submitting','queued','running','saving','unknown'))
    ON CONFLICT DO NOTHING`).bind(row.id, row.owner_id, row.name, row.model, row.prompt,
    row.aspect_ratio, row.resolution, row.color_name, row.created_at, row.updated_at, row.owner_id).run();
  return result.meta.changes > 0;
}

export async function updateTask(owner: string, id: string, status: GenerationStatus, error = '', remoteTaskId: string | null = null, lease: number | null = null) {
  await env.DB.prepare("UPDATE generation_tasks SET status = ?, error = ?, remote_task_id = COALESCE(?, remote_task_id), updated_at = ? WHERE id = ? AND owner_id = ? AND status NOT IN ('succeeded', 'failed') AND (? IS NULL OR last_polled_at = ?)")
    .bind(status, error, remoteTaskId, Date.now(), id, owner, lease, lease).run();
}

export async function claimSubmission(owner: string, id: string) {
  const result = await env.DB.prepare("UPDATE generation_tasks SET status = 'submitting', updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'uploading'").bind(Date.now(), id, owner).run();
  return result.meta.changes > 0;
}

export async function claimPoll(owner: string, id: string) {
  const lease = Date.now() + 120_000;
  const result = await env.DB.prepare("UPDATE generation_tasks SET last_polled_at = ? WHERE id = ? AND owner_id = ? AND last_polled_at < ? AND status IN ('queued','running','saving')")
    .bind(lease, id, owner, Date.now()).run();
  return result.meta.changes > 0 ? lease : null;
}

export async function releasePoll(owner: string, id: string, lease: number) {
  await env.DB.prepare('UPDATE generation_tasks SET last_polled_at = ? WHERE id = ? AND owner_id = ? AND last_polled_at = ?')
    .bind(Date.now() + 5_000, id, owner, lease).run();
}

export async function completeTask(row: TaskRow, mime: string, size: number, key: string, lease: number) {
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO assets (id, owner_id, name, category, tags, tone, mime_type, object_key, size, created_at)
      SELECT ?, ?, ?, '生成效果图', 'RunningHub;组合效果', ?, ?, ?, ?, ? WHERE EXISTS
      (SELECT 1 FROM generation_tasks WHERE id = ? AND owner_id = ? AND status = 'saving' AND last_polled_at = ?) ON CONFLICT(id) DO NOTHING`)
      .bind(row.id, row.owner_id, row.name, row.color_name, mime, key, size, Date.now(), row.id, row.owner_id, lease),
    env.DB.prepare("UPDATE generation_tasks SET status = 'succeeded', asset_id = ?, error = '', updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'saving' AND last_polled_at = ?")
      .bind(row.id, Date.now(), row.id, row.owner_id, lease),
  ]);
}
