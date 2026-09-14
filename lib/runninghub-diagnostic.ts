// Only bounded numeric provider codes are displayed. Never expose provider messages,
// URLs, request bodies or credentials in diagnostics.
export function diagnosticSuffix(path: string, code: unknown, status: number) {
  const stage = path.includes('/media/upload/') ? '上传参考图' : path.endsWith('/accountStatus') ? '查询账户' : path.endsWith('/query') ? '查询任务' : '提交生图';
  const safeCode = /^-?\d{1,8}$/.test(String(code)) ? String(code) : '未提供';
  return `（${stage}；HTTP ${Number.isInteger(status) ? status : 0}；平台代码 ${safeCode}）`;
}
