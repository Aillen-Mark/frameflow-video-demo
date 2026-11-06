export const PROVIDERS = ['ark','kling','custom'];
export const DEFAULTS = {
 ark:{provider:'ark',name:'火山方舟 / Seedance',baseUrl:'https://ark.cn-beijing.volces.com/api/v3',model:'',auth:'bearer',resolution:'720p'},
 kling:{provider:'kling',name:'可灵',baseUrl:'https://api-singapore.klingai.com',model:'kling-v2-6',auth:'bearer',mode:'pro'},
 custom:{provider:'custom',name:'第三方视频服务',baseUrl:'',model:'',auth:'bearer',createPath:'/v1/videos',statusPath:'/v1/videos/{id}',testPath:'/v1/models',
  bodyTemplate:{model:'{{model}}',prompt:'{{prompt}}',image:'{{image}}',duration:'{{duration}}',aspect_ratio:'{{aspect}}'},
  idField:'id',statusField:'status',videoField:'video_url',errorField:'error.message',successValues:'succeeded,completed,success',failureValues:'failed,error,cancelled',authHeader:'Authorization',authPrefix:'Bearer '}
};
export class ApiError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export function publicUrl(value) {
 let u;try{u=new URL(value);}catch{throw new ApiError('请输入有效的 HTTPS 接口地址');}
 const host=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443'||!host.includes('.')||host.startsWith('[')||/^[\d.]+$/.test(host)||/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host))throw new ApiError('接口地址需使用公网 HTTPS 域名，不支持内网地址、账号或非标准端口');
 return u;
}
function pathValue(path,placeholder=false){
 if(typeof path!=='string'||path.length>300||!path.startsWith('/')||path.startsWith('//')||/[\\\r\n]/.test(path)||path.includes('..')||/^[^?]*%/i.test(path))throw new ApiError('接口路径需以 / 开头，不能包含域名、反斜线或上级目录');
 if(placeholder&&!path.includes('{id}'))throw new ApiError('状态查询路径需要包含 {id}');return path;
}
const safePath = value => {if(typeof value!=='string'||value.length>150||!/^[a-zA-Z0-9_.]+$/.test(value)||value.split('.').some(k=>['__proto__','prototype','constructor'].includes(k)))throw new ApiError('返回字段路径格式不正确，例如 data.task_id');return value;};
export function validateConfig(input,provider) {
 if(!PROVIDERS.includes(provider))throw new ApiError('不支持此供应商');
 const c={...DEFAULTS[provider]};
 for(const key of Object.keys(c))if(Object.hasOwn(input,key))c[key]=input[key];
 c.provider=provider;
 c.name=String(c.name||DEFAULTS[provider].name).trim().slice(0,60);
 c.model=String(c.model||'').trim();if(!c.model||c.model.length>150||/[\r\n]/.test(c.model))throw new ApiError('请填写控制台中的模型 ID / Endpoint ID');
 const u=publicUrl(c.baseUrl);if(u.search)throw new ApiError('Base URL 不能包含查询参数');
 c.baseUrl=u.toString().replace(/\/$/,'');
 if(provider==='ark'&&!['ark.cn-beijing.volces.com','ark.ap-southeast.bytepluses.com'].includes(u.hostname))throw new ApiError('方舟预设仅接受官方地址；兼容服务请使用第三方配置');
 if(provider==='kling'&&!['api.klingai.com','api-singapore.klingai.com','api-beijing.klingai.com'].includes(u.hostname))throw new ApiError('可灵预设仅接受官方地址；兼容服务请使用第三方配置');
 if(!['bearer',...(provider==='kling'?['aksk']:[]),...(provider==='custom'?['header']:[])].includes(c.auth))throw new ApiError('鉴权方式无效');
 if(provider==='ark'&&!['480p','720p','1080p'].includes(c.resolution))throw new ApiError('分辨率无效');
 if(provider==='kling'&&!['std','pro'].includes(c.mode))throw new ApiError('可灵模式无效');
 if(provider==='custom'){
  pathValue(c.createPath);pathValue(c.statusPath,true);pathValue(c.testPath);
  for(const k of ['idField','statusField','videoField','errorField'])safePath(c[k]);
  for(const k of ['successValues','failureValues'])if(typeof c[k]!=='string'||!c[k]||c[k].length>200)throw new ApiError('请填写成功和失败状态值');
  if(!/^(Authorization|X-API-Key|Api-Key|X-Token)$/i.test(c.authHeader))throw new ApiError('鉴权请求头仅支持 Authorization / X-API-Key / Api-Key / X-Token');
  if(typeof c.authPrefix!=='string'||c.authPrefix.length>30||/[\r\n]/.test(c.authPrefix))throw new ApiError('鉴权前缀无效');
  if(!c.bodyTemplate||Array.isArray(c.bodyTemplate)||typeof c.bodyTemplate!=='object'||JSON.stringify(c.bodyTemplate).length>12000)throw new ApiError('请求模板应为小于 12 KB 的 JSON 对象');
  const json=JSON.stringify(c.bodyTemplate);if(!json.includes('{{image}}')&&!json.includes('{{image_base64}}'))throw new ApiError('请求模板需包含 {{image}} 或 {{image_base64}}');
  if(/"(?:authorization|api_key|apikey|secret_key|access_key|token|secret|password)"\s*:/i.test(json))throw new ApiError('密钥请填入独立凭据字段，不要放在请求模板内');
  for(const match of json.matchAll(/\{\{([^}]+)\}\}/g))if(!['model','prompt','image','image_base64','duration','aspect','request_id'].includes(match[1]))throw new ApiError(`不支持模板变量 ${match[1]}`);
 }
 return c;
}
export function field(data,path){return path.split('.').reduce((value,key)=>value!=null&&Object.hasOwn(Object(value),key)?value[key]:undefined,data);}
export function template(value,vars){
 if(typeof value==='string'){const exact=value.match(/^\{\{(\w+)\}\}$/);if(exact)return vars[exact[1]];return value.replace(/\{\{(\w+)\}\}/g,(_,key)=>String(vars[key]));}
 if(Array.isArray(value))return value.map(item=>template(item,vars));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,template(item,vars)]));
 return value;
}
function base64url(bytes){let text='';for(const x of bytes)text+=String.fromCharCode(x);return btoa(text).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
export async function klingJwt(ak,sk,now=Math.floor(Date.now()/1000)){
 const encode=v=>base64url(new TextEncoder().encode(JSON.stringify(v)));
 const message=`${encode({alg:'HS256',typ:'JWT'})}.${encode({iss:ak,exp:now+1800,nbf:now-5})}`;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(sk),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return `${message}.${base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))))}`;
}
export async function credentialsHeader(c,secret){
 if(c.auth==='aksk'){if(!secret.accessKey||!secret.secretKey)throw new ApiError('请先保存可灵 Access Key 和 Secret Key');return {Authorization:`Bearer ${await klingJwt(secret.accessKey,secret.secretKey)}`};}
 if(!secret.apiKey)throw new ApiError('请先保存 API Key');
 return c.auth==='header'?{[c.authHeader]:`${c.authPrefix}${secret.apiKey}`}:{Authorization:`Bearer ${secret.apiKey}`};
}
function endpoint(c,path){const url=new URL(`${c.baseUrl}${path}`);if(url.origin!==new URL(c.baseUrl).origin)throw new ApiError('接口地址不匹配');return url.toString();}
async function request(c,secret,path,method,body,fetcher=fetch){
 let response;try{response=await fetcher(endpoint(c,path),{method,headers:{...await credentialsHeader(c,secret),'Content-Type':'application/json','Accept':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000),redirect:'error'});}catch{throw new ApiError('供应商请求超时或网络连接失败',502);}
 if(!response.ok){const error=new ApiError(`供应商返回 HTTP ${response.status}。${response.status===401||response.status===403?'请检查密钥、地区与接口权限。':response.status===429?'已达到供应商限流，请稍后查询。':'请检查模型、参数、账户余额与接口路径。'}`,502);error.definitive=response.status>=400&&response.status<500;throw error;}
 if(Number(response.headers.get('content-length'))>1024*1024)throw new ApiError('供应商响应过大',502);
 let data;try{data=await response.json();}catch{throw new ApiError('供应商未返回 JSON，请检查接口地址',502);}
 if(c.provider==='kling'&&data.code!==0){const error=new ApiError(`可灵接口返回错误码 ${String(data.code).replace(/[^\w-]/g,'').slice(0,30)}，请检查账户或请求参数`,502);error.definitive=true;throw error;}
 return data;
}
export function buildCreate(c,input){
 if(c.provider==='ark')return {path:'/contents/generations/tasks',body:{model:c.model,content:[{type:'text',text:input.prompt},{type:'image_url',image_url:{url:input.image},role:'first_frame'}],duration:input.duration,ratio:input.aspect,resolution:c.resolution}};
 if(c.provider==='kling')return {path:'/v1/videos/image2video',body:{model_name:c.model,image:input.image.split(',')[1],prompt:input.prompt,duration:String(input.duration),mode:c.mode,external_task_id:input.requestId}};
 return {path:c.createPath,body:template(c.bodyTemplate,{model:c.model,prompt:input.prompt,image:input.image,image_base64:input.image.split(',')[1],duration:input.duration,aspect:input.aspect,request_id:input.requestId})};
}
export async function testProvider(c,secret,fetcher){
 const path=c.provider==='ark'?'/contents/generations/tasks?page_size=1':c.provider==='kling'?'/v1/videos/image2video?pageNum=1&pageSize=1':c.testPath;
 await request(c,secret,path,'GET',null,fetcher);
 return {ok:true,message:'查询接口已响应，鉴权与连通性检查通过；模型生成权限和余额需以实际提交结果为准。'};
}
export async function createProviderTask(c,secret,input,fetcher){
 const {path,body}=buildCreate(c,input);const data=await request(c,secret,path,'POST',body,fetcher);
 const id=c.provider==='ark'?data.id:c.provider==='kling'?data.data?.task_id:field(data,c.idField);
 if((typeof id!=='string'&&typeof id!=='number')||!String(id)||String(id).length>200)throw new ApiError('供应商已响应，但没有找到任务 ID；请核对返回字段并在供应商控制台检查任务，避免重复生成',502);
 return String(id);
}
export async function queryProviderTask(c,secret,id,fetcher){
 const path=c.provider==='ark'?`/contents/generations/tasks/${encodeURIComponent(id)}`:c.provider==='kling'?`/v1/videos/image2video/${encodeURIComponent(id)}`:c.statusPath.replace('{id}',encodeURIComponent(id));
 const data=await request(c,secret,path,'GET',null,fetcher);
 const raw=c.provider==='ark'?data.status:c.provider==='kling'?data.data?.task_status:field(data,c.statusField);
 if(typeof raw!=='string')throw new ApiError('响应中缺少任务状态，请检查返回字段映射',502);
 const good=c.provider==='custom'?c.successValues.split(',').map(x=>x.trim()):['succeeded','succeed'];
 const bad=c.provider==='custom'?c.failureValues.split(',').map(x=>x.trim()):['failed','cancelled','expired'];
 const status=good.includes(raw)?'succeeded':bad.includes(raw)?'failed':['queued','submitted','pending'].includes(raw)?'queued':'running';
 const url=c.provider==='ark'?data.content?.video_url:c.provider==='kling'?data.data?.task_result?.videos?.[0]?.url:field(data,c.videoField);
 if(status==='succeeded'&&!url)throw new ApiError('任务成功但缺少视频地址，请检查视频字段映射',502);
 if(url)publicUrl(url);
 return {status,videoUrl:status==='succeeded'?url:null,error:status==='failed'?'供应商任务失败，请在对应控制台查看原因；本平台额度已释放。':null};
}
