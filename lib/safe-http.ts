// Workers support manual redirects, not redirect: 'error'. Never forward keys
// or replay POST bodies to a redirect destination, and never retry here.
export class TransportError extends Error {}
export async function fetchWithoutRedirect(input: string | URL | Request, init: RequestInit = {}, fetcher: typeof fetch = fetch) {
  let response: Response;
  try {
    response = await fetcher(input, { ...init, redirect: 'manual' });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name} ${error.message}` : '';
    const reason = /timeout|abort/i.test(detail) ? '连接超时'
      : /redirect|RequestInitializerDict|unsupported.*cache/i.test(detail) ? '服务器请求参数不兼容'
      : /certificate|SSL|TLS/i.test(detail) ? '安全连接失败'
      : /header|ByteString/i.test(detail) ? '请求头格式不兼容'
      : '网络连接未完成';
    // Only a fixed category is exposed; raw exceptions may include secret URLs.
    throw new TransportError(`${reason}，请稍后重试或联系工作台管理员。`);
  }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    throw new TransportError(`接口返回跳转（HTTP ${response.status}），已停止请求以保护 Key，请核对接口地址。`);
  }
  return response;
}
export const transportMessage = (error: unknown, fallback: string) => error instanceof TransportError ? error.message : fallback;
