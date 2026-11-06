const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
export const apiState={configs:{},defaults:{},provider:'ark',used:0,tasks:[],ready:false,dirty:false};
let hooks, polling=0, recoveryTask;
export function currentEngine(){return $('#generation-engine').value;}
export async function downloadApiVideo(task){
 try{const response=await fetch(`/api/tasks/${task.id}/download`,{credentials:'same-origin'});if(!response.ok){const data=await response.json();throw new Error(data.error||'视频下载失败');}const blob=await response.blob();const extension=blob.type.includes('webm')?'webm':blob.type.includes('quicktime')?'mov':'mp4';hooks.downloadBlob(blob,`frameflow-${task.id}.${extension}`);hooks.toast('视频下载已开始');}catch(error){hooks.toast(error.message||'视频下载失败，请使用任务记录中的原始链接');}
}
async function api(path,method='GET',body){
 const response=await fetch(`/api/${path}`,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Frameflow-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});
 let data;try{data=await response.json();}catch{throw new Error('服务未响应 JSON，请刷新页面或检查部署状态');}
 if(!response.ok){const e=new Error(data.error||`请求失败 HTTP ${response.status}`);e.status=response.status;throw e;}return data;
}
function result(message,ok=false){const box=$('#api-test-result');box.hidden=false;box.className=`api-result ${ok?'ok':'error'}`;box.textContent=message;}
const fields={name:'api-name',baseUrl:'api-base',model:'api-model',auth:'api-auth',resolution:'api-resolution',mode:'api-mode',authHeader:'api-header',authPrefix:'api-prefix',createPath:'api-create-path',statusPath:'api-status-path',testPath:'api-test-path',idField:'api-id-field',statusField:'api-status-field',videoField:'api-video-field',successValues:'api-success-values',failureValues:'api-failure-values'};
function syncAuth(){const ak=$('#api-auth').value==='aksk',custom=$('#api-auth').value==='header';$('#api-key-field').hidden=ak;$('#api-ak-field').hidden=$('#api-sk-field').hidden=!ak;$('#api-header-field').hidden=$('#api-prefix-field').hidden=!custom;}
function fillForm(provider,config){
 apiState.provider=provider;const c={...apiState.defaults[provider],...config};
 $$('[data-provider]').forEach(button=>button.classList.toggle('selected',button.dataset.provider===provider));
 for(const [key,id] of Object.entries(fields))$('#'+id).value=c[key]??'';
 $('#api-body-template').value=JSON.stringify(c.bodyTemplate||{},null,2);
 $('#api-key').value=config?.credentials?.apiKey||'';$('#api-ak').value=config?.credentials?.accessKey||'';$('#api-sk').value=config?.credentials?.secretKey||'';
 [...$('#api-auth').options].forEach(option=>option.hidden=option.value==='aksk'?provider!=='kling':option.value==='header'?provider!=='custom':false);
 if(!['bearer',...(provider==='kling'?['aksk']:[]),...(provider==='custom'?['header']:[])].includes($('#api-auth').value))$('#api-auth').value='bearer';
 $('#api-config-title').textContent=`${{ark:'火山方舟',kling:'可灵',custom:'第三方平台'}[provider]} · 接入配置`;
 $('#api-custom-fields').hidden=provider!=='custom';$('#api-resolution-field').hidden=provider!=='ark';$('#api-mode-field').hidden=provider!=='kling';
 $('#api-model-note').textContent=provider==='ark'?'复制已开通的 Model ID 或 ep-… 接入点 ID。':provider==='kling'?'此预设适配 /v1/videos/image2video，支持该协议的模型，例如 kling-v2-6、kling-v3。':'填写供应商规定的模型标识，并核对 JSON 请求模板。';
 $('#api-provider-help').textContent=provider==='ark'?'在火山方舟控制台创建 API Key，并开通 Seedance 视频模型。':provider==='kling'?'在可灵开放平台创建 API Key；旧版凭据可选择 AK + SK，由服务端生成 JWT。海外服务默认新加坡接口，按账户地区调整。':'从服务商获取 Base URL、鉴权方式、模型 ID、创建/查询路径和 JSON 返回示例。';
 $('#api-doc-link').href=provider==='ark'?'https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh':provider==='kling'?'https://kling.ai/document-api/api/video/3-0-omni/image-to-video/legacy':'./API接入说明.md';
 $('#api-doc-link').textContent=provider==='custom'?'查看自定义接入说明 ↗':'查看官方文档 ↗';
 $('#api-key-state').textContent=apiState.configs[provider]?'此服务的凭据已加密保存':'此服务尚未保存凭据';
 $('#api-test-result').hidden=true;apiState.dirty=false;syncAuth();
}
function collect(includeCredentials=true){
 const provider=apiState.provider;const c={...apiState.defaults[provider],provider};
 for(const key of Object.keys(c))if(fields[key])c[key]=$('#'+fields[key]).value;
 if(provider==='custom'){try{c.bodyTemplate=JSON.parse($('#api-body-template').value);}catch{throw new Error('请求模板不是有效 JSON');}}
 if(includeCredentials)c.credentials={apiKey:$('#api-key').value.trim(),accessKey:$('#api-ak').value.trim(),secretKey:$('#api-sk').value.trim()};
 return c;
}
function updateEngine(){
 for(const provider of ['ark','kling','custom']){const option=$(`#generation-engine option[value="${provider}"]`);const config=apiState.configs[provider];option.disabled=!config;option.textContent=config?`${config.name} · ${config.model}`:`${{ark:'火山方舟',kling:'可灵',custom:'第三方服务'}[provider]} · 待配置`;$('#status-'+provider).textContent=config?'已保存':'未配置';}
 const provider=currentEngine();const config=apiState.configs[provider];const real=provider!=='demo';
 $('#engine-description').textContent=real?provider==='kling'?'真实 API 生成，按供应商计费。可灵图生视频比例跟随原图。':'真实 API 生成，按供应商账户计费。':'图片运镜演示，不调用视频模型。';
 $('#generation-cost-note').textContent=real?'提交后产生供应商费用 · API 额度独立计算':'消耗 1 次演示额度 · 不产生 API 费用';
 $('.engine-row>div').replaceChildren(document.createTextNode(real?(config?.name||'待配置'):'映序 · 标准模式'));
 const small=document.createElement('small');small.textContent=real?config?.model||'请先配置服务':'720p 动态预览';$('.engine-row>div').append(small);
 $('#quota-caption').textContent=real?'API 额度 · 含进行中与待核对':'每人最多 10 次 · 演示额度';
 $('.demo-note p').textContent=real?'将图片和描述提交到所选供应商生成。进度保存在服务端，可到 API 接入页继续查询；结果请及时下载。':'当前演示将图片制作成运镜短片，可预览、可下载；接入 AI 模型后可生成主体动作与场景变化。';
 hooks.updateQuota();
}
async function refreshConfigs(){const data=await api('configs');apiState.defaults=data.defaults;apiState.configs=Object.fromEntries(data.configs.map(c=>[c.provider,c]));apiState.ready=data.ready;updateEngine();return data;}
export async function refreshTasks(){const data=await api('tasks');apiState.tasks=data.tasks;apiState.used=data.used;$('#api-quota').textContent=`${data.used} / ${data.limit}`;renderTasks();hooks.updateQuota();return data;}
const statusNames={submitting:'提交中 / 待核对',queued:'排队中',running:'生成中',succeeded:'已完成',failed:'已失败',unknown:'待核对',cancelled:'已取消'};
function renderTasks(){
 const list=$('#api-task-list');list.replaceChildren();
 if(!apiState.tasks.length){const p=document.createElement('div');p.className='api-empty';p.textContent='尚无 API 任务。先保存配置，再到工作台提交。';list.append(p);return;}
 for(const task of apiState.tasks){
  const row=document.createElement('article');row.className='api-task-row';
  const body=document.createElement('div');const title=document.createElement('h3');title.textContent=task.title;
  const info=document.createElement('p');info.textContent=`${task.provider} · ${task.duration} 秒 · ${new Date(task.createdAt).toLocaleString('zh-CN')}`;
  const id=document.createElement('small');id.textContent=`任务 ${task.externalId||task.id}`;body.append(title,info,id);
  if(task.error){const error=document.createElement('p');error.className='task-error';error.textContent=task.error;body.append(error);}
  const actions=document.createElement('div');actions.className='task-actions';const status=document.createElement('span');status.className=`task-status ${task.status}`;status.textContent=statusNames[task.status]||task.status;actions.append(status);
  if(task.status==='succeeded'){
   const preview=document.createElement('button');preview.className='secondary-button';preview.textContent='预览';preview.onclick=()=>{hooks.showResult(task);hooks.navigate('studio');};
   const download=document.createElement('button');download.className='secondary-button';download.textContent='下载';download.onclick=async()=>{download.disabled=true;await downloadApiVideo(task);download.disabled=false;};
   const source=document.createElement('a');source.className='text-button';source.textContent='原始链接 ↗';source.href=task.videoUrl;source.target='_blank';source.rel='noopener';actions.append(preview,download,source);
  }else if(task.externalId&&!['failed','cancelled'].includes(task.status)){
   const query=document.createElement('button');query.className='secondary-button';query.textContent='查询进度';query.onclick=async()=>{query.disabled=true;try{await api(`tasks/${task.id}`);await refreshTasks();}catch(e){hooks.toast(e.message);query.disabled=false;}};actions.append(query);
  }else if(['unknown','submitting'].includes(task.status)){
   const recover=document.createElement('button');recover.className='secondary-button';recover.textContent='关联任务 ID';recover.onclick=()=>{recoveryTask=task.id;$('#api-recover-id').value='';$('#api-recover-dialog').showModal();};actions.append(recover);
  }
  row.append(body,actions);list.append(row);
 }
}
function importConfig(text){
 if(text.length>40000)throw new Error('配置文件超过 40 KB');let c;try{c=JSON.parse(text);}catch{throw new Error('请导入有效的 JSON 配置');}
 if(!c||!['ark','kling','custom'].includes(c.provider))throw new Error('配置需包含 provider：ark、kling 或 custom');
 fillForm(c.provider,c);apiState.dirty=true;hooks.toast('已导入到表单，请检查后点击保存');
}
export async function initApi(callbacks){
 hooks=callbacks;
 $('#generation-engine').onchange=()=>{if(hooks.isBusy())return;updateEngine();};
 $$('[data-provider]').forEach(button=>button.onclick=()=>{fillForm(button.dataset.provider,apiState.configs[button.dataset.provider]);});
 $('#api-auth').onchange=syncAuth;$('#api-config-form').addEventListener('input',()=>{apiState.dirty=true;$('#api-test-result').hidden=true;});
 $('#api-config-form').onsubmit=async e=>{
  e.preventDefault();$('#save-api').disabled=true;
  try{const c=collect();await api(`configs/${apiState.provider}`,'PUT',c);await refreshConfigs();fillForm(c.provider,apiState.configs[c.provider]);result('配置已保存，凭据已加密。现在可以测试连接。',true);hooks.toast('API 配置已保存');}
  catch(error){result(error.message);}finally{$('#save-api').disabled=false;}
 };
 $('#test-api').onclick=async()=>{
  if(apiState.dirty||!apiState.configs[apiState.provider]){result('请先保存当前配置，再测试连接');return;}
  $('#test-api').disabled=true;result('正在查询供应商接口，不会创建视频任务…',true);
  try{const data=await api(`configs/${apiState.provider}/test`,'POST',{});result(data.message,true);}catch(e){result(e.message);}finally{$('#test-api').disabled=false;}
 };
 $('#delete-api').onclick=async()=>{if(!apiState.configs[apiState.provider])return;if(!confirm('移除此服务的接入配置？已有任务仍可查询。'))return;try{await api(`configs/${apiState.provider}`,'DELETE',{});if(currentEngine()===apiState.provider)$('#generation-engine').value='demo';await refreshConfigs();fillForm(apiState.provider);hooks.toast('此配置已移除');}catch(e){result(e.message);}};
 $('#import-api-file').onclick=()=>$('#api-import-file').click();
 $('#api-import-file').onchange=async e=>{const file=e.target.files[0];if(file)try{if(file.size>40000)throw new Error('配置文件超过 40 KB');importConfig(await file.text());}catch(error){hooks.toast(error.message);}e.target.value='';};
 $('#paste-api-json').onclick=()=>{$('#api-import-json').value='';$('#api-import-dialog').showModal();};
 $('#apply-api-import').onclick=()=>{try{importConfig($('#api-import-json').value);$('#api-import-json').value='';$('#api-import-dialog').close();}catch(e){hooks.toast(e.message);}};
 $('#export-api-config').onclick=()=>{try{const c=collect(false);if(/"(?:authorization|api_key|apikey|secret_key|access_key|token|secret|password)"\s*:/i.test(JSON.stringify(c.bodyTemplate||{})))throw new Error('请从请求模板中移除凭据字段后再导出');hooks.downloadBlob(new Blob([JSON.stringify(c,null,2)],{type:'application/json'}),`frameflow-${c.provider}.json`);hooks.toast('配置已导出，不包含凭据');}catch(e){hooks.toast(e.message);}};
 $('#refresh-api-tasks').onclick=async()=>{try{await refreshTasks();hooks.toast('任务列表已刷新；点击单条任务可查询供应商进度');}catch(e){hooks.toast(e.message);}};
 $('#apply-api-recover').onclick=async()=>{const button=$('#apply-api-recover');button.disabled=true;try{await api(`tasks/${recoveryTask}/recover`,'POST',{externalId:$('#api-recover-id').value.trim()});$('#api-recover-dialog').close();await refreshTasks();hooks.toast('已关联供应商任务');}catch(e){hooks.toast(e.message);}finally{button.disabled=false;}};
 try{
  const data=await refreshConfigs();fillForm('ark',apiState.configs.ark);await refreshTasks();
  $('#api-service-message').textContent=data.ready?'服务端已就绪 · 配置与任务按登录账号隔离 · 三种服务可分别保存':'服务端加密尚未配置，请先设置 VIDEO_CONFIG_KEY 后重新部署。';
 }catch(e){
  $('#api-service-message').replaceChildren(document.createTextNode(e.message+' '));
  if(e.status===401){const a=document.createElement('a');a.className='inline-link';a.textContent='登录后配置 ↗';a.href='/signin-with-chatgpt?return_to='+encodeURIComponent('/#api');a.target='_top';$('#api-service-message').append(a);}
  $('#save-api').disabled=$('#test-api').disabled=true;
 }
}
export async function submitApi(input){
 const provider=currentEngine();if(!apiState.configs[provider]){hooks.toast('请先保存 API 配置');hooks.navigate('api');return;}
 if(apiState.used>=10){hooks.toast('API 额度已达到 10 次上限');return;}
 let run=++polling;
 hooks.setBusy(true);hooks.clearOutput();$('#record-progress').hidden=false;$('#progress-bar').style.width='0';$('#cancel-generation').textContent='后台继续 · 查看任务';$('#progress-title').textContent='正在提交到视频 API';
 const cancel=$('#cancel-generation');const previous=cancel.onclick;cancel.onclick=()=>{polling++;$('#record-progress').hidden=true;hooks.setBusy(false);cancel.onclick=previous;cancel.textContent='取消生成';$('#progress-title').textContent='正在制作动态预览';hooks.navigate('api');};
 try{
  const image=await hooks.prepareImage(input.imageUrl);const data=await api('tasks','POST',{title:input.title,prompt:input.prompt,duration:input.duration,aspect:input.aspect,image,provider,requestId:crypto.randomUUID()});
  let task=data.task;await refreshTasks();
  for(let attempt=0;attempt<90&&run===polling;attempt++){
   if(task.status==='succeeded'){hooks.showResult(task);hooks.toast('AI 视频已生成，可播放或下载');break;}
   if(['failed','unknown','submitting'].includes(task.status)){hooks.toast(task.error||'任务已记录，请在 API 接入页检查状态');hooks.navigate('api');break;}
   $('#preview-tag').textContent='API 生成中';$('#preview-status').textContent=`${statusNames[task.status]} · ${task.externalId||task.id}`;
   $('#progress-title').textContent=statusNames[task.status]||'正在生成';$('#progress-detail').textContent='供应商正在处理，可后台继续；此处不显示虚拟百分比。';
   await new Promise(resolve=>setTimeout(resolve,5000));if(run!==polling)break;
   try{task=(await api(`tasks/${task.id}`)).task;}catch(e){hooks.toast('暂时无法查询，任务仍已保存，可稍后到 API 接入页继续查询');hooks.navigate('api');break;}
  }
  await refreshTasks();
  if(run===polling&&task.status!=='succeeded'&&!['failed','unknown'].includes(task.status)){$('#preview-status').textContent='任务已保存在 API 接入页，可稍后继续查询';}
 }catch(e){hooks.toast(e.message);try{await refreshTasks();}catch{}$('#preview-status').textContent='请检查 API 任务记录，确认提交结果后再操作';}
 finally{if(run===polling){$('#record-progress').hidden=true;hooks.setBusy(false);cancel.onclick=previous;cancel.textContent='取消生成';$('#progress-title').textContent='正在制作动态预览';}}
}
