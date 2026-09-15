import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { customProvider } from '../../../db/custom-image-providers';
import { customImageModel, isCustomModel } from '../../../lib/custom-image-config';
import { CustomImageError, editCustomImage } from '../../../lib/custom-image-provider';
import { FormLimitError, limitedFormData } from '../../../lib/limited-form';
import { generationOwner } from '../../../lib/generation-auth';
import { compositionPrompt } from '../../../lib/composition-prompt';
import { isStudioIntent, parseRecipe } from '../../../lib/studio-brief';
import { runningHubConnection, loadMemberApp, submitMemberApp, providerError, RUNNINGHUB_MODEL, RunningHubError, submitGeneration, uploadReference } from '../../../lib/runninghub';
import { appOutputSetting, compileAppInputs, type AppSetup, type AppSpec } from '../../../lib/runninghub-app-schema';
import { cleanAppSetup } from '../../../lib/app-setup-storage';
import { getImageModel, validModelSettings } from '../../../lib/generation-models';
import { claimSubmission, getTask, insertTask, listTasks, publicTask, type TaskRow, updateTask } from '../../../db/generation-tasks';
import { productionContext, claimProductionItem, productionSceneFile, ProductionError } from '../../../db/production';
import { artworkRules } from '../../../lib/production-plan';
import { sceneSizeBrief } from '../../../lib/production-scene';
import { latestInternationalKeyId } from '../../../db/runninghub-international';

import { findScene, sceneReferenceBrief } from '../../../lib/scene-library';
export async function POST(request: Request) {
  const owner = await generationOwner(request);
  if (!owner) return NextResponse.json({ error: '请登录后再生成。' }, { status: 401 });
  if (Number(request.headers.get('content-length') || 0) > 22 * 1024 * 1024) return NextResponse.json({ error: '参考图总大小过大。' }, { status: 413 });
  let id = '';
  let submitted = false;
  let inserted = false;
  let acceptedRemoteId: string | null = null;
  try {
    const form = await limitedFormData(request, 22 * 1024 * 1024);
    id = String(form.get('requestId') || '');
    if (!/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: '请求标识无效，请刷新后重试。' }, { status: 400 });
    const previous = await getTask(owner, id);
    if (previous) return NextResponse.json(publicTask(previous));
    const artwork = form.get('artwork');
    const frame = form.get('frame');
    const refs = frame instanceof File && frame.size ? [frame, artwork] : [artwork];
    if (refs.some((file) => !(file instanceof File) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024)) return NextResponse.json({ error: '请选择 JPG、PNG 或 WebP 参考图，每张不超过 10 MB。' }, { status: 400 });
    const field = (name: string, fallback = '') => String(form.get(name) || fallback).trim().slice(0, name === 'instruction' ? 1500 : 160);
    let ratio = field('aspectRatio', '16:9');
    let resolution = field('resolution', '2k');
    const requestedModel = field('model', RUNNINGHUB_MODEL);
    if (isCustomModel(requestedModel)) return NextResponse.json({ error: '工作台现仅使用 RunningHub。其他平台的新生成已关闭，历史记录仍保留。' }, { status: 410 });
    const custom = isCustomModel(requestedModel) ? await customProvider(owner, requestedModel.slice(7)) : null;
    const model = custom ? customImageModel(custom.config) : getImageModel(requestedModel);
    if (custom && (refs as File[]).reduce((sum,file) => sum+file.size,0) > 8*1024*1024) return NextResponse.json({ error: '自定义接口的参考图总大小请控制在8MB以内。' }, { status: 413 });
    if (custom && field('providerRevision') !== custom.config.revision) return NextResponse.json({ error: '接口配置已更新，请刷新模型列表并重新核对后生成。' }, { status: 409 });
    const quality = field('quality', model?.qualities.length ? 'medium' : '');
    const background = field('background', model?.backgrounds?.length ? 'auto' : '');
    const outputFormat = field('outputFormat', model?.outputFormats?.length ? 'png' : '');
    if (!model || (model.apiMode !== 'member-app' && !validModelSettings(model, ratio, resolution, quality, background, outputFormat))) return NextResponse.json({ error: '所选模型不支持这组图片设置；透明背景请选择 PNG 或 WebP。' }, { status: 400 });
    let connection;
    const credentialId = !custom && model.region !== 'cn' ? await latestInternationalKeyId(owner) : null;
    try { connection = custom ? undefined : await runningHubConnection(owner, model.id, credentialId); }
    catch (error) { return NextResponse.json({ error: error instanceof RunningHubError ? error.message : '请先配置当前模型的 API Key。' }, { status: 503 }); }
    if (!custom && model.id !== 'gpt-image-2' && refs.some((file) => (file as File).type === 'image/webp')) return NextResponse.json({ error: '此模型需要 JPG 或 PNG 参考图，请刷新页面后重试格式转换。' }, { status: 400 });
    const artworkName = field('artworkName', '画芯');
    const frameName = field('frameName', '屏风框架');
    const colorName = field('colorName', '胡桃木色');
    const intent = field('intent', 'composition');
    if (!isStudioIntent(intent)) return NextResponse.json({ error: '请选择有效的出图用途。' }, { status: 400 });
    const recipe = parseRecipe(JSON.stringify({ artworkId: field('artworkId'), frameId: field('frameId'), colorId: field('colorId'), intent, instruction: field('instruction'), ...(quality ? { quality } : {}), ...(background ? {background}:{}), ...(outputFormat ? {outputFormat}:{}) }));
    let prompt = compositionPrompt({ hasFrame: refs.length === 2, frameName, frameProfile: field('frameProfile'), colorId: field('colorId'), colorName, colorHex: field('colorHex'), instruction: field('instruction'), intent });
    const productionItemId=field('productionItemId');
    let productionTitle='';
    const sceneId=field('sceneId');
    const selectedScene=findScene(sceneId);
    const sceneUpload=form.get('scene');
    if(sceneId || sceneUpload) {
      if(!selectedScene || !(sceneUpload instanceof File) || !['image/png','image/jpeg','image/webp'].includes(sceneUpload.type) || !sceneUpload.size || sceneUpload.size>10*1024*1024)
        return NextResponse.json({error:'场景参考无效，请从场景图库重新选择。'},{status:400});
      if(!(frame instanceof File) || !frame.size || background==='transparent' || intent!=='interior')
        return NextResponse.json({error:'使用场景参考需要框架原图、家居场景用途和非透明背景。'},{status:400});
    }
    if(productionItemId) {
      const context=await productionContext(owner,productionItemId), saved=context.workspace.sample!.recipe!;
      productionTitle=context.row.title;
      if(selectedScene && context.row.kind==='size') throw new ProductionError('尺寸图必须沿用本套已确认的共用场景，请勿替换为图库参考。');
      if(!recipe || refs.length!==2 || recipe.artworkId!==saved.artworkId || recipe.frameId!==saved.frameId || recipe.colorId!==saved.colorId) throw new ProductionError('当前搭配与此新品不一致，请从新品清单重新进入制作。');
      recipe.productionItemId=productionItemId;
      if(context.row.kind==='size'&&!context.config.sceneTitle)throw new ProductionError('尺寸图需要沿用本套统一场景，请先在制作清单中确认共用场景主图。');
      prompt=context.row.kind==='size'
        ? `${prompt}\n制作清单（以确认数据为准）：${context.row.brief}`
        : `图1是已经确认的完整新品效果，图2是原画芯。保持图1的产品结构、木色和图案位置不变，不要重新替换到其他区域。${context.row.brief}\n本次补充：${field('instruction')}`;
      if(context.row.review==='rework' && context.row.note) prompt+=`\n上一稿重做原因：${context.row.note}`;
      if(context.config.sceneTitle) {
        if(!['gpt-image-2','gpt-image-2.5-sunburst'].includes(model.id)||resolution!=='2k'||(context.row.kind!=='detail'&&ratio!=='1:1'))throw new ProductionError('共用场景请使用 GPT Image 2 或 2.5、2K；主图和尺寸图需为 1:1。');
        if(background==='transparent')throw new ProductionError('本套需要保留场景背景，请选择自动或不透明背景。');
        if(context.row.kind==='size') {
          const scene=await productionSceneFile(owner,context);
          refs.push(scene.file);recipe.sceneGenerationId=scene.generationId;
          prompt=sceneSizeBrief(context.spec,artworkRules[context.config.rule],`${context.config.notes} 框架木色：${colorName}。本次补充：${field('instruction')}${context.row.review==='rework'&&context.row.note?` 上一稿重做原因：${context.row.note}`:''}`);
          recipe.sizeAnnotationMode='source-preserved-v1';
        }
      }
    }
    let appSpec: AppSpec | null = null, appSetup: AppSetup | null = null;
    if(selectedScene && sceneUpload instanceof File) {
      refs.push(sceneUpload);
      if(recipe) recipe.sceneId=selectedScene.id;
      prompt+=`\n${sceneReferenceBrief(selectedScene,refs.length)}`;
    }
    if (background === 'transparent') prompt += '\n背景设置优先：本次输出透明背景，去除环境和纯白底，仅保留完整产品；产品结构、画芯与木色要求保持不变。';
    if (model.apiMode === 'member-app') {
      try {
        const rawSetup = String(form.get('appSetup') || '');
        if (rawSetup.length > 50000 || !rawSetup) throw new Error('请先读取并确认会员应用参数。');
        appSetup = cleanAppSetup(JSON.parse(rawSetup));
        if (!appSetup) throw new Error('应用参数格式不正确，请重新读取。');
        appSpec = await loadMemberApp(model.appId!, connection!);
        compileAppInputs(appSpec, appSetup, refs.map((_, index) => `pending-${index}`), prompt);
        ratio = appOutputSetting(appSpec, appSetup, 'ratio'); resolution = appOutputSetting(appSpec, appSetup, 'resolution');
        if (recipe) recipe.appSetup = appSetup;
      } catch (error) { return NextResponse.json({ error: error instanceof Error && !/JSON|Unexpected/i.test(error.message) ? error.message : '应用参数格式不正确，请重新读取。' }, { status: 400 }); }
    }
    await listTasks(owner);
    const row: TaskRow = { id, owner_id: owner, remote_task_id: null, name: `${productionTitle ? `${productionTitle} · ` : ''}${artworkName} · ${frameName} · ${colorName}`,
      status: 'uploading', model: model.id, credential_id: credentialId, prompt, recipe_json: recipe ? JSON.stringify(recipe) : null, aspect_ratio: ratio, resolution, color_name: colorName,
      asset_id: null, error: '', last_polled_at: 0, created_at: Date.now(), updated_at: Date.now() };
    if (!await insertTask(row)) {
      const existing = await getTask(owner, id);
      if (existing) return NextResponse.json(publicTask(existing));
      return NextResponse.json({ error: '已有生成任务或待核对的提交，请先在生成任务中处理。' }, { status: 409 });
    }
    inserted = true;
    if(productionItemId) await claimProductionItem(owner,productionItemId,id);
    if (custom) {
      // Acquiring the same owner task lock also prevents concurrent key/config changes.
      const fresh = await customProvider(owner, custom.config.id, true);
      if (fresh.config.revision !== custom.config.revision) throw new CustomImageError('接口配置刚刚改变，请重新核对后生成。');
      if (!await claimSubmission(owner, id)) throw new CustomImageError('任务已过期，请重新创建。');
      submitted = true;
      const result = await editCustomImage(fresh.config, fresh.apiKey, refs as File[], prompt, resolution, quality);
      // Persist first. If the database write fails, GET can recover this exact image without another paid call.
      await env.FILES.put(`${owner}/generated-previews/${id}/result`, result.bytes, { httpMetadata: { contentType: result.mime } });
      acceptedRemoteId = 'custom-result';
      await updateTask(owner, id, 'queued', '', acceptedRemoteId);
      return NextResponse.json(publicTask((await getTask(owner, id))!), { status: 202 });
    }
    // Re-read after acquiring the owner's active-task lock. Key replacement is
    // atomically blocked while this task is active, keeping submit/query aligned.
    connection = await runningHubConnection(owner, model.id, credentialId);
    const imageUrls: string[] = [];
    for (const file of refs) imageUrls.push(await uploadReference(file as File, connection, model.apiMode === 'member-app'));
    if (!await claimSubmission(owner, id)) throw new RunningHubError('参考图上传已过期，请重新创建任务。');
    submitted = true;
    // Never retry this billable request automatically.
    const result = appSpec && appSetup
      ? await submitMemberApp(model.appId!, compileAppInputs(appSpec, appSetup, imageUrls, prompt), connection)
      : await submitGeneration({ prompt, imageUrls, aspectRatio: ratio, resolution, model: model.id, quality, background, outputFormat }, connection);
    acceptedRemoteId = result.taskId!;
    await updateTask(owner, id, result.status === 'FAILED' ? 'failed' : 'queued', result.status === 'FAILED' ? providerError(result) : '', acceptedRemoteId);
    return NextResponse.json(publicTask((await getTask(owner, id))!), { status: 202 });
  } catch (error) {
    if (error instanceof FormLimitError) return NextResponse.json({ error: error.message }, { status: 413 });
    const message = error instanceof RunningHubError || error instanceof CustomImageError || error instanceof ProductionError ? error.message : '服务暂时不可用，请稍后查看任务记录。';
    const uncertain = submitted && (!(error instanceof RunningHubError || error instanceof CustomImageError) || error.uncertain);
    if (inserted) await updateTask(owner, id, acceptedRemoteId ? 'queued' : uncertain ? 'unknown' : 'failed', message, acceptedRemoteId).catch(() => undefined);
    return NextResponse.json({ error: message, requestId: id || undefined, uncertain }, { status: 502 });
  }
}
