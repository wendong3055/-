import { getChatGPTUser } from '../app/chatgpt-auth';

export async function generationOwner(request?: Request) {
  if (request) {
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) return null;
  }
  return (await getChatGPTUser())?.userId ?? null;
}
