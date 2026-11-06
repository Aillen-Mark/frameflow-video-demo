import { ApiError, PROVIDERS, DEFAULTS, validateConfig, testProvider, createProviderTask, queryProviderTask, credentialsHeader } from './providers.mjs';
import { encrypt, decrypt, hash } from './crypto.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const configView=row=>({...JSON.parse(row.config),configured:true,credentialsSaved:!!row.credentials,updatedAt:row.updated_at});
const taskView=row=>({id:row.id,provider:row.provider,externalId:row.external_id,status:row.status,title:row.title,prompt:row.prompt,duration:row.duration,aspect:row.aspect,videoUrl:row.video_url,error:row.error,createdAt:row.created_at,updatedAt:row.updated_at});
async function readJson(request,max=20000){if(Number(request.headers.get('content-length'))>max)throw new ApiError('请求内容过大',413);const text=await request.text();if(text.length>max)throw new ApiError('请求内容过大',413);let data;try{data=JSON.parse(text);}catch{throw new ApiError('请求不是有效 JSON');}if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('请求应为 JSON 对象');return data;}
function inputFor(body){
 if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(body.requestId))throw new ApiError('请求标识无效');
 if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>500)throw new ApiError('请填写 1–500 字的提示词');
 if(![5,10].includes(body.duration)||!['16:9','9:16','1:1'].includes(body.aspect))throw new ApiError('视频时长或比例无效');
 if(typeof body.image!=='string'||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image)||body.image.length>14*1024*1024)throw new ApiError('请上传小于 10 MB 的 JPEG 或 PNG 图片');
 return {...body,title:String(body.title||'AI 视频作品').slice(0,80),prompt:body.prompt.trim()};
}
export async function handleApi(request,{store,secret,fetcher=fetch}){
 try{
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)throw new ApiError('请先登录后配置视频 API',401);
  const url=new URL(request.url);const route=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  if(request.method!=='GET'){
   const origin=request.headers.get('origin');
   if(origin&&origin!==url.origin)throw new ApiError('请求来源不匹配',403);
   if(request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('x-frameflow-request')!=='1')throw new ApiError('请求校验失败，请刷新页面后重试',403);
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('请使用 JSON 请求',415);
  }
  if(route[0]==='configs'){
   const provider=route[1];
   if(request.method==='GET'&&!provider)return json({configs:(await store.configs(user)).map(configView),defaults:DEFAULTS,ready:!!secret});
   if(!PROVIDERS.includes(provider))throw new ApiError('供应商不存在',404);
   if(request.method==='DELETE'){await store.deleteConfig(user,provider);return json({ok:true});}
   if(request.method==='PUT'){
    const body=await readJson(request);const c=validateConfig(body,provider);const old=await store.config(user,provider);
    let credentials={};
    if(old){const previous=JSON.parse(old.config);if(previous.baseUrl===c.baseUrl&&previous.auth===c.auth)credentials=await decrypt(old.credentials,secret,`${user}:${provider}`);}
    for(const key of ['apiKey','accessKey','secretKey']){const value=body.credentials?.[key];if(value){if(typeof value!=='string'||value.length>4096||/[\r\n]/.test(value))throw new ApiError('凭据格式不正确');credentials[key]=value.trim();}}
    await credentialsHeader(c,credentials);
    await store.saveConfig(user,provider,c,await encrypt(credentials,secret,`${user}:${provider}`));
    return json({config:configView(await store.config(user,provider))});
   }
   if(request.method==='POST'&&route[2]==='test'){
    const row=await store.config(user,provider);if(!row)throw new ApiError('请先保存配置');
    return json(await testProvider(JSON.parse(row.config),await decrypt(row.credentials,secret,`${user}:${provider}`),fetcher));
   }
  }
  if(route[0]==='tasks'){
   const id=route[1];
   if(request.method==='GET'&&!id){const rows=await store.tasks(user);return json({tasks:rows.map(taskView),used:await store.usage(user),limit:10});}
   if(request.method==='GET'&&id){
    const row=await store.task(user,id);if(!row)throw new ApiError('任务不存在',404);
    if(route[2]==='download'){
     if(row.status!=='succeeded'||!row.video_url)throw new ApiError('视频尚未生成完成');
     let upstream;try{upstream=await fetcher(row.video_url,{redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new ApiError('视频下载失败，可在任务记录中打开原始链接',502);}
     if(!upstream.ok)throw new ApiError('视频链接可能已过期，请到供应商控制台重新获取',502);
     const type=upstream.headers.get('content-type')||'application/octet-stream';
     if(!/^(video\/|application\/octet-stream)/i.test(type))throw new ApiError('供应商结果不是视频文件，请打开原始链接检查',502);
     return new Response(upstream.body,{headers:{'Content-Type':upstream.headers.get('content-type')||'video/mp4','Content-Disposition':`attachment; filename="frameflow-${row.id}.mp4"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if(row.external_id&&!['succeeded','failed','cancelled'].includes(row.status)){
     const c=JSON.parse(row.config);const result=await queryProviderTask(c,await decrypt(row.credentials,secret,`${user}:${row.provider}`),row.external_id,fetcher);
     await store.update(user,id,{status:result.status,video_url:result.videoUrl,error:result.error});
    }
    return json({task:taskView(await store.task(user,id))});
   }
   if(request.method==='POST'&&id&&route[2]==='recover'){
    const row=await store.task(user,id);if(!row)throw new ApiError('任务不存在',404);
    if(row.external_id||!['unknown','submitting'].includes(row.status))throw new ApiError('此任务不需要关联');
    const {externalId}=await readJson(request);if(typeof externalId!=='string'||!externalId.trim()||externalId.length>200)throw new ApiError('供应商任务 ID 无效');
    const result=await queryProviderTask(JSON.parse(row.config),await decrypt(row.credentials,secret,`${user}:${row.provider}`),externalId.trim(),fetcher);
    await store.update(user,id,{external_id:externalId.trim(),status:result.status,video_url:result.videoUrl,error:result.error});return json({task:taskView(await store.task(user,id))});
   }
   if(request.method==='POST'&&!id){
    const body=inputFor(await readJson(request,15*1024*1024));const provider=body.provider;
    const digest=await hash(JSON.stringify({provider,prompt:body.prompt,image:body.image,duration:body.duration,aspect:body.aspect}));
    const existing=await store.request(user,body.requestId);
    if(existing){if(existing.input_hash!==digest)throw new ApiError('此请求标识已用于另一任务',409);return json({task:taskView(existing)});}
    const config=await store.config(user,provider);if(!config)throw new ApiError('请先在 API 接入页配置此服务');
    const c=JSON.parse(config.config);const credentials=await decrypt(config.credentials,secret,`${user}:${provider}`);
    const row={id:crypto.randomUUID(),user_id:user,provider,request_id:body.requestId,input_hash:digest,status:'submitting',config:config.config,credentials:config.credentials,title:body.title,prompt:body.prompt,duration:body.duration,aspect:body.aspect,created_at:Date.now(),updated_at:Date.now()};
    if(!await store.reserve(row)){const duplicate=await store.request(user,body.requestId);if(duplicate){if(duplicate.input_hash!==digest)throw new ApiError('请求标识冲突',409);return json({task:taskView(duplicate)});}throw new ApiError('本账号 API 额度已达到 10 次上限（含进行中及待核对任务）',429);}
    try{const externalId=await createProviderTask(c,credentials,body,fetcher);await store.update(user,row.id,{external_id:externalId,status:'queued'});}
    catch(error){await store.update(user,row.id,{status:error.definitive?'failed':'unknown',error:`${error instanceof ApiError?error.message:'提交结果未确认'}${error.definitive?' 此请求被拒绝，平台额度已释放。':'。请先在供应商控制台核对并关联任务 ID，不会自动重复提交。'}`});}
    return json({task:taskView(await store.task(user,row.id))},202);
   }
  }
  throw new ApiError('接口不存在',404);
 }catch(error){return json({error:error instanceof ApiError?error.message:'服务暂时无法处理请求，请稍后重试'},error instanceof ApiError?error.status:500);}
}
