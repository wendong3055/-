import {env} from 'cloudflare:workers';
import {creatorKey} from './rh-creator';
import {latestInternationalKeyId,internationalSnapshotKey} from './runninghub-international';
export type CreatorBinding={origin:'https://www.runninghub.ai'|'https://www.runninghub.cn';credentialId?:string|null};
export async function newCreatorBinding(owner:string,endpoint:string):Promise<CreatorBinding>{
  if(!endpoint.startsWith('intl:'))return {origin:'https://www.runninghub.cn'};
  const credentialId=await latestInternationalKeyId(owner);
  if(!credentialId&&!env.RUNNINGHUB_API_KEY)throw new Error('请先在连接设置中连接国际站 Key。');
  return {origin:'https://www.runninghub.ai',credentialId};
}
export async function creatorBindingKey(owner:string,binding:CreatorBinding){
  if(binding.origin==='https://www.runninghub.ai'){
    const key=binding.credentialId?await internationalSnapshotKey(owner,binding.credentialId):env.RUNNINGHUB_API_KEY;
    if(!key)throw new Error('此任务的国际站密钥不可用，未切换到其他站点。');return key;
  }
  return creatorKey(owner);
}
export function savedCreatorBinding(endpoint:string,inputsJson:string):CreatorBinding{
  if(!endpoint.startsWith('intl:'))return {origin:'https://www.runninghub.cn'};
  const data=JSON.parse(inputsJson);
  if(data.binding?.origin!=='https://www.runninghub.ai')throw new Error('任务连接信息缺失，未切换站点。');
  return {origin:'https://www.runninghub.ai',credentialId:data.binding.credentialId??null};
}
