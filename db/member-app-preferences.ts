import { env } from 'cloudflare:workers';
import { cleanAppSetup } from '../lib/app-setup-storage';
import type { AppSetup } from '../lib/runninghub-app-schema';

export async function readAppPreference(owner: string, model: string) {
  const row = await env.DB.prepare('SELECT setup_json FROM member_app_preferences WHERE owner_id = ? AND model_id = ?').bind(owner, model).first<{ setup_json: string }>();
  try { return row ? cleanAppSetup(JSON.parse(row.setup_json)) : null; } catch { return null; }
}
export async function saveAppPreference(owner: string, model: string, setup: AppSetup) {
  await env.DB.prepare('INSERT INTO member_app_preferences (id, owner_id, model_id, setup_json, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id, model_id) DO UPDATE SET setup_json = excluded.setup_json, updated_at = excluded.updated_at').bind(`${owner}:${model}`, owner, model, JSON.stringify(setup), Date.now()).run();
}
