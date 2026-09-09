// Adapted from HM-RunningHub/RH_CLI src/rh_cli/poll.py (Apache-2.0).
// Pinned source: 0ed2b31d50fbfef114304fae78d24d4c9e371b68.
// Changes: TypeScript/Workers adapter; one bounded query per invocation, with
// retry scheduling owned by our persisted task controller; no resubmission.
// See THIRD_PARTY_NOTICES.md and licenses/RH_CLI-Apache-2.0.txt.
export const MEMBER_QUERY_PATH = '/openapi/v2/query';
export async function readMemberTask(taskId: string, post: (path: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>) {
  const response = await post(MEMBER_QUERY_PATH, { taskId });
  if (!['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED'].includes(String(response.status))) throw new Error('应用状态暂时无法识别，任务已保留，请恢复查询。');
  const results = Array.isArray(response.results) ? response.results.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const url = item.url || item.outputUrl;
    const type = String(item.outputType || '').toLowerCase();
    return typeof url === 'string' && (['image', 'png', 'jpg', 'jpeg', 'webp'].includes(type) || (!type && /\.(png|jpe?g|webp)(\?|$)/i.test(url))) ? [{ url, outputType: 'image' }] : [];
  }) : [];
  return { taskId, status: String(response.status), errorCode: String(response.errorCode || ''), errorMessage: String(response.errorMessage || ''), results };
}
