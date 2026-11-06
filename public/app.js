import { initApi, apiState, currentEngine, submitApi, downloadApiVideo } from './api-client.js';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { duration: 10, imageUrl: './assets/landscape.svg', imageName: '山湖之间', motion: 'push', used: 0, jobs: [], busy: false, cancel: false, currentUrl: null, ready: false, libraryUrls: [] };
const templates = {
  cinematic: '镜头缓慢向前推进，穿过清晨的薄雾，阳光洒落在平静的湖面上，保持柔和、宁静的电影质感。',
  product: '镜头从左向右横向移动，聚焦产品表面的材质与光泽，柔和的侧光勾勒轮廓，保持主体完整、背景简洁。',
  travel: '镜头缓慢拉远，从画面主体展开至广阔的全景，呈现远近景物的空间层次，营造自由、悠远的旅行氛围。'
};
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3600); }
function navigate(view) {
  if (!['studio','library','project','api'].includes(view)) view = 'studio';
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $$('.nav-item').forEach(el => { el.classList.toggle('active', el.dataset.view === view); if (el.dataset.view === view) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  $('#breadcrumb-title').textContent = {studio:'创作工作台',library:'我的作品',project:'项目方案',api:'API 接入'}[view];
  history.replaceState(null, '', `${location.pathname}${location.search}#${view}`);
  window.scrollTo({top:0,behavior:'instant'});
}
$$('[data-view]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.view)));
$$('[data-go]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.go)));
$('.brand').addEventListener('click', e => {e.preventDefault();navigate('studio');});
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
if (new URLSearchParams(location.search).get('embed') === '1') document.body.classList.add('embedded');
navigate(location.hash.slice(1));

let db;
async function openDatabase() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('frameflow-demo-v1',1);
    request.onupgradeneeded = () => { request.result.createObjectStore('jobs',{keyPath:'id'}); request.result.createObjectStore('meta'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭旧版演示页面后重试'));
  });
}
function readStore(store,key) { return new Promise((resolve,reject) => { const req = db.transaction(store).objectStore(store)[key === undefined ? 'getAll':'get'](key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
async function loadSaved() {
  [state.jobs,state.used] = await Promise.all([readStore('jobs'),readStore('meta','used')]);
  state.used = Number(state.used) || 0;
  state.jobs.sort((a,b) => b.createdAt-a.createdAt);
  updateQuota(); renderLibrary();
}
function saveJob(job) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(['jobs','meta'],'readwrite');
    const req = tx.objectStore('meta').get('used');
    let quotaError = false;
    req.onsuccess = () => { const used = Number(req.result) || 0; if (used >= 10) {quotaError = true;tx.abort();return;} tx.objectStore('jobs').put(job); tx.objectStore('meta').put(used+1,'used'); };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error(quotaError ? '演示额度已用完，请到我的作品中重置演示。' : '浏览器存储失败，请释放空间后重试。'));
  });
}
function updateQuota() {
  const real=currentEngine()!=='demo';const used=real?apiState.used:state.used;
  $('#quota-left').textContent = Math.max(0,10-used);
  $('#quota-bar').style.width = `${Math.max(0,10-used)*10}%`;
  $('#library-count').textContent = state.jobs.length;
  $('#generate').disabled = state.busy || (real ? !apiState.ready : !state.ready) || used >= 10;
  $('#generate>span').textContent = state.busy ? (real?'API 任务处理中…':'正在制作预览…') : used >= 10 ? '额度已用完' : real?'提交到 API':'生成动态预览';
}
function downloadBlob(blob,name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(() => URL.revokeObjectURL(url),60000);
}
function renderLibrary() {
  state.libraryUrls.forEach(url => URL.revokeObjectURL(url));state.libraryUrls=[];
  const grid = $('#library-grid');grid.replaceChildren();
  if (!state.jobs.length) {
    const empty = document.createElement('div');empty.className='empty-library';
    empty.innerHTML='<svg><use href="#i-grid"/></svg><h3>你的第一段故事，还未开始</h3><p>上传一张图片，让静止的一帧成为流动的画面。</p><button class="secondary-button">创建第一条作品 ↗</button>';
    empty.querySelector('button').onclick=()=>navigate('studio');grid.append(empty);return;
  }
  for (const job of state.jobs) {
    const card = document.createElement('article');card.className='library-card';
    const video = document.createElement('video');const url=URL.createObjectURL(job.blob);state.libraryUrls.push(url);video.src=url;video.controls=true;video.playsInline=true;video.preload='metadata';video.poster=job.thumbnail;video.setAttribute('aria-label',`${job.title}动态预览`);
    const body=document.createElement('div');body.className='library-card-body';
    const heading=document.createElement('h3');heading.textContent=job.title;
    const desc=document.createElement('p');desc.textContent=job.prompt;
    const meta=document.createElement('div');meta.className='library-card-meta';meta.textContent=`${job.duration} 秒 · ${job.aspect} · 动态演示 · ${new Date(job.createdAt).toLocaleDateString('zh-CN')}`;
    const button=document.createElement('button');button.className='download-button';button.innerHTML='<svg><use href="#i-down"/></svg>下载视频';button.onclick=()=>downloadBlob(job.blob,`映序_${job.id}.${job.extension}`);
    body.append(heading,desc,meta,button);card.append(video,body);grid.append(card);
  }
}
$('#reset-demo').onclick=()=>{if(state.busy){toast('请先等待当前预览完成');return;}$('#reset-dialog').showModal();};
$('#confirm-reset').onclick=async()=>{
  try {
    await new Promise((resolve,reject)=>{const tx=db.transaction(['jobs','meta'],'readwrite');tx.objectStore('jobs').clear();tx.objectStore('meta').put(0,'used');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    $('#reset-dialog').close();await loadSaved();clearOutput();toast('已恢复 10 次演示额度');
  } catch {toast('重置失败，请检查浏览器存储权限');}
};

function clearOutput() {
  $('#result-video').pause();$('#result-video').removeAttribute('src');$('#result-video').load();$('#result-video').hidden=true;
  if(state.currentUrl) URL.revokeObjectURL(state.currentUrl);state.currentUrl=null;state.currentJob=null;
  $('#hero-image').hidden=false;$('#render-canvas').hidden=true;$('#preview-stage').classList.remove('has-result');
  $('#download-current').disabled=true;$('#preview-tag').textContent='起始画面';$('#preview-status').textContent='画面已就绪，等待你的创意';
}
function showImage(url,name,isExample=false) {
  clearOutput();state.imageUrl=url;state.imageName=name;
  $('#input-thumb').src=url;$('#hero-image').src=url;
  $('#selected-file').replaceChildren(document.createTextNode(`${name}${isExample ? ' · 示例图片':''} `));const check=document.createElement('b');check.textContent='✓';$('#selected-file').append(check);
  $('#stage-caption h3').textContent=name.length>12 ? `${name.slice(0,12)}…`:name;
  $('.stage-top span:last-child').textContent=isExample ? '原创示例插画':'你的起始图片';
  $('#image-error').textContent='';
}
async function readImage(file) {
  if(state.busy) return;
  if(!file) return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) {$('#image-error').textContent='请选择 JPG、PNG 或 WebP 图片。';return;}
  if(file.size>10*1024*1024){$('#image-error').textContent='图片超过 10 MB，请选择较小的图片。';return;}
  try {
    const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
    const img=await loadImage(url);
    if(img.naturalWidth*img.naturalHeight>40000000) throw new Error('图片像素过大，请选择不超过 4000 万像素的图片。');
    showImage(url,file.name.replace(/\.[^.]+$/,''));toast('图片已就绪，可以开始创作');
  } catch(error){$('#image-error').textContent=error.message || '图片无法读取，请尝试其他文件。';}
}
function loadImage(url) {return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片无法读取，请尝试其他文件。'));img.src=url;});}
$('#image-input').addEventListener('change',e=>{readImage(e.target.files[0]);e.target.value='';});
$('#upload-zone').addEventListener('dragover',e=>{e.preventDefault();if(!state.busy)$('#upload-zone').classList.add('dragover');});
$('#upload-zone').addEventListener('dragleave',()=>$('#upload-zone').classList.remove('dragover'));
$('#upload-zone').addEventListener('drop',e=>{e.preventDefault();$('#upload-zone').classList.remove('dragover');readImage(e.dataTransfer.files[0]);});
$('#use-example').onclick=()=>showImage('./assets/landscape.svg','山湖之间',true);
function updatePromptCount(){ $('#prompt-count').textContent=`${$('#prompt').value.length} / 500`; }
$('#prompt').addEventListener('input',updatePromptCount);updatePromptCount();
function setPrompt(text){if(state.busy){toast('请先完成当前预览');return;}$('#prompt').value=text.slice(0,500);updatePromptCount();}
$$('[data-motion]').forEach(button=>button.onclick=()=>{state.motion=button.dataset.motion;const prefix={push:'镜头缓慢向前推进',pan:'镜头从左向右横向移动',pull:'镜头缓慢拉远，展现广阔的全景'}[state.motion];setPrompt(`${prefix}，保持画面主体稳定，光线柔和自然，呈现细腻的电影质感。`);});
$$('[data-template]').forEach(button=>button.onclick=()=>{setPrompt(templates[button.dataset.template]);toast('已应用镜头描述，可继续编辑');});
function updateSpec(){ $('#preview-spec').textContent=`${$('#aspect').value} · ${state.duration} SEC`; }
$$('[data-duration]').forEach(button=>button.onclick=()=>{state.duration=Number(button.dataset.duration);$$('[data-duration]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-pressed',String(el===button));});updateSpec();});
$('#aspect').addEventListener('change',updateSpec);

function drawFrame(ctx,img,width,height,t,motion) {
  ctx.fillStyle='#101611';ctx.fillRect(0,0,width,height);
  const ease=t*t*(3-2*t);const scale=motion==='pull' ? 1.12-.12*ease:motion==='pan' ? 1.12:1+.12*ease;
  const base=Math.max(width/img.naturalWidth,height/img.naturalHeight);const w=img.naturalWidth*base*scale;const h=img.naturalHeight*base*scale;
  let x=(width-w)/2;const y=(height-h)/2;if(motion==='pan')x+=(ease-.5)*width*.10;
  ctx.drawImage(img,x,y,w,h);
  const font=Math.max(13,Math.round(width/75));ctx.font=`${font}px sans-serif`;ctx.fillStyle='#0007';ctx.fillRect(width-font*17,height-font*2.8,font*16.2,font*1.9);ctx.fillStyle='#fff9';ctx.fillText('FRAMEFLOW · DEMO',width-font*16.4,height-font*1.4);
}
async function recordPreview(img,duration,aspect,motion) {
  const canvas=$('#render-canvas');const sizes={'16:9':[1280,720],'9:16':[720,1280],'1:1':[720,720]};[canvas.width,canvas.height]=sizes[aspect];
  if(!canvas.captureStream || !window.MediaRecorder)throw new Error('当前浏览器未提供视频导出能力，请使用新版 Chrome 或 Edge 体验。');
  const ctx=canvas.getContext('2d');drawFrame(ctx,img,canvas.width,canvas.height,0,motion);
  const candidates=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'];const mimeType=candidates.find(type=>MediaRecorder.isTypeSupported(type));
  if(!mimeType)throw new Error('当前浏览器没有可用的视频编码格式，请使用新版 Chrome 或 Edge。');
  const stream=canvas.captureStream(30);let recorder;
  try {recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:2500000});}catch(error){stream.getTracks().forEach(track=>track.stop());throw error;}
  const chunks=[];let raf;let settled=false;
  return new Promise((resolve,reject)=>{
    const finish=()=>{cancelAnimationFrame(raf);clearTimeout(watchdog);stream.getTracks().forEach(track=>track.stop());};
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onerror=()=>{if(settled)return;settled=true;finish();reject(new Error('视频编码失败，请重试。'));};
    recorder.onstop=()=>{if(settled)return;settled=true;finish();if(state.cancel){reject(new Error('CANCELLED'));return;}const blob=new Blob(chunks,{type:mimeType});if(!blob.size){reject(new Error('未获取到视频数据，请重试。'));return;}resolve({blob,thumbnail:canvas.toDataURL('image/jpeg',.7),extension:mimeType.startsWith('video/mp4')?'mp4':'webm'});};
    const start=performance.now();
    function frame(now){if(state.cancel){if(recorder.state==='recording')recorder.stop();return;}const t=Math.min((now-start)/(duration*1000),1);drawFrame(ctx,img,canvas.width,canvas.height,t,motion);$('#progress-bar').style.width=`${Math.round(t*100)}%`;$('#progress-detail').textContent=`正在录制镜头 · ${Math.min(duration,Math.floor(t*duration))} / ${duration} 秒`;if(t<1)raf=requestAnimationFrame(frame);else if(recorder.state==='recording')recorder.stop();}
    const watchdog=setTimeout(()=>{state.cancel=true;if(recorder.state==='recording')recorder.stop();},duration*1000+15000);
    try{recorder.start(250);raf=requestAnimationFrame(frame);}catch(error){settled=true;finish();reject(error);}
  });
}
$('#generation-form').addEventListener('submit',async e=>{
  e.preventDefault();if(state.busy || !state.ready)return;
  if(currentEngine()!=='demo'){
    if(!$('#prompt').value.trim()){toast('请先写下画面描述');return;}
    await submitApi({imageUrl:state.imageUrl,title:state.imageName,prompt:$('#prompt').value.trim(),duration:state.duration,aspect:$('#aspect').value});return;
  }
  if(state.used>=10){toast('演示额度已用完，可在我的作品中重置');return;}
  const prompt=$('#prompt').value.trim();if(!prompt){toast('请先写下画面描述');$('#prompt').focus();return;}
  state.busy=true;state.cancel=false;$('#generation-inputs').disabled=true;updateQuota();clearOutput();
  const duration=state.duration;const aspect=$('#aspect').value;const motion=/拉远|全景/.test(prompt)?'pull':/横向|从左|从右/.test(prompt)?'pan':'push';
  $('#record-progress').hidden=false;$('#preview-tag').textContent='制作中';$('#progress-bar').style.width='0%';$('#preview-status').textContent='正在制作演示，请保持此页在前台';
  try {
    const img=await loadImage(state.imageUrl);if(state.cancel)throw new Error('CANCELLED');
    const result=await recordPreview(img,duration,aspect,motion);
    const job={id:crypto.randomUUID ? crypto.randomUUID():String(Date.now()),title:state.imageName,prompt,duration,aspect,createdAt:Date.now(),...result};
    $('#progress-detail').textContent='正在保存到本地作品库';
    await saveJob(job);state.currentJob=job;state.currentUrl=URL.createObjectURL(result.blob);
    $('#result-video').src=state.currentUrl;$('#result-video').poster=result.thumbnail;$('#result-video').hidden=false;$('#hero-image').hidden=true;$('#preview-stage').classList.add('has-result');
    $('#download-current').disabled=false;$('#preview-tag').textContent='预览完成';$('#preview-status').textContent=`${duration} 秒演示已完成 · ${result.extension.toUpperCase()}`;
    await loadSaved();toast('动态预览已完成，点击播放或下载视频');
  } catch(error) {
    clearOutput();toast(error.message==='CANCELLED'?'已取消，本次不扣除演示额度':error.message || '生成失败，本次不扣除额度');
  } finally {state.busy=false;state.cancel=false;$('#record-progress').hidden=true;$('#generation-inputs').disabled=false;updateQuota();}
});
$('#cancel-generation').onclick=()=>{state.cancel=true;};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.busy)state.cancel=true;});
$('#download-current').onclick=async()=>{if(state.currentJob?.remote){$('#download-current').disabled=true;await downloadApiVideo(state.currentJob);$('#download-current').disabled=false;}else if(state.currentJob)downloadBlob(state.currentJob.blob,`映序_${state.currentJob.id}.${state.currentJob.extension}`);};

$$('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
$('#open-help').onclick=$('#top-guide').onclick=()=>$('#help-dialog').showModal();
$('#prompt-assist').onclick=()=>{$('#assistant-dialog').showModal();$('#chat-input').focus();};
$('#chat-form').addEventListener('submit',e=>{
  e.preventDefault();const input=$('#chat-input').value.trim();if(!input)return;
  const log=$('#chat-log');const user=document.createElement('div');user.className='user-message';user.textContent=input;
  const answer=document.createElement('div');answer.className='assistant-message';const selected=/产品|商品|细节|特写/.test(input)?templates.product:/旅行|风景|全景|拉远/.test(input)?templates.travel:templates.cinematic;
  const text=document.createElement('p');text.textContent=`可以试试这段镜头描述：${selected}`;const apply=document.createElement('button');apply.textContent='应用到创作描述 ↗';apply.onclick=()=>{setPrompt(selected);$('#assistant-dialog').close();toast('描述已填入，可按你的图片调整');};answer.append(text,apply);log.append(user,answer);$('#chat-input').value='';log.scrollTop=log.scrollHeight;
});
const money=value=>`¥${value.toLocaleString('zh-CN',{minimumFractionDigits:0,maximumFractionDigits:2})}`;
let latestBudget;
function calculateBudget(){
  const ids=['people','times','duration','model','buffer','dev','infra'];const values={};let valid=true;
  for(const key of ids){const input=$(`#budget-${key}`);const v=Number(input.value);if(!input.checkValidity() || ((!input.value || v<=0)&&['people','times','duration','model'].includes(key)))valid=false;values[key]=v;}
  if(!Number.isInteger(values.people)||!Number.isInteger(values.times))valid=false;
  if(!valid){$('#budget-total').textContent='请检查输入';$('#export-budget').disabled=true;$('#budget-warning').textContent='请填写有效人数、次数、时长与费用；人数和次数需要是整数。';return;}
  const api=values.people*values.times*values.duration*values.model;const reserve=api*values.buffer/100;const total=api+reserve+values.dev+values.infra;
  $('#budget-total').textContent=money(total);$('#budget-api').textContent=money(api);$('#budget-reserve').textContent=money(reserve);$('#budget-equation').textContent=`${values.people} 人 × ${values.times} 次 × ${values.duration} 秒`;
  const filled=$('#budget-dev').value!=='' && $('#budget-infra').value!=='';
  $('#budget-other').textContent=filled?money(values.dev+values.infra):`${values.dev+values.infra?money(values.dev+values.infra)+' · ':''}待补全`;
  $('#budget-warning').textContent=filled?'按已填报价汇总；税费、存储与流量是否含在报价中需另行确认。':'尚未包含全部开发、部署、存储、流量与税费。';
  $('#export-budget').disabled=false;latestBudget={...values,api,reserve,total,filled};
}
$$('.budget-fields input,.budget-fields select').forEach(input=>input.addEventListener('input',calculateBudget));calculateBudget();
$('#export-budget').onclick=()=>{const b=latestBudget;const text=`映序 · 图生视频项目预算测算\n本文件为场景测算，非正式报价。\n\n参与人数：${b.people}\n每人最多生成：${b.times} 次\n单条时长：${b.duration} 秒\n模型：${$('#budget-model').selectedOptions[0].textContent}\n官方参考单价：${b.model} 元/秒\n模型费用：${money(b.api)}\n预留比例：${b.buffer}%（假设，可调整）\n预留费用：${money(b.reserve)}\n开发费：${$('#budget-dev').value===''?'待报价':money(b.dev)}\n部署与存储：${$('#budget-infra').value===''?'待报价':money(b.infra)}\n已知项目小计：${money(b.total)}\n\n${$('#budget-warning').textContent}\n基础用量：人数 × 每人次数 × 时长。预算预留不会自动增加每人可用次数。\n成功计费、接口单价、模型能力与并发配额以实际选定接口为准。\n官方来源（2026-11-06 查阅）：\nhttps://docs.volcengine.com/docs/jimeng-ai/jimeng-ai-video-generation-billing-instructions?lang=zh\n`;downloadBlob(new Blob(['\ufeff',text],{type:'text/plain;charset=utf-8'}),'映序_活动预算测算.txt');toast('预算测算明细已导出');};
updateQuota();
try {db=await openDatabase();await loadSaved();state.ready=true;updateQuota();}catch(error){$('#preview-status').textContent='本地存储未开启，生成暂不可用';toast(error.message || '请开启浏览器本地存储后刷新页面');}
await initApi({toast,navigate,downloadBlob,updateQuota,clearOutput,isBusy:()=>state.busy,
  setBusy(value){state.busy=value;$('#generation-inputs').disabled=value;updateQuota();},
  async prepareImage(url){const img=await loadImage(url);if(img.naturalWidth<300||img.naturalHeight<300||img.naturalWidth/img.naturalHeight<.4||img.naturalWidth/img.naturalHeight>2.5)throw new Error('API 图片宽高至少 300 像素，宽高比需介于 0.4–2.5');const canvas=document.createElement('canvas');const scale=Math.min(1,2048/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.93);},
  showResult(task){clearOutput();state.currentJob={...task,remote:true};$('#result-video').src=task.videoUrl;$('#result-video').removeAttribute('poster');$('#result-video').hidden=false;$('#hero-image').hidden=true;$('#preview-stage').classList.add('has-result');$('#download-current').disabled=false;$('#preview-tag').textContent='AI 生成完成';$('#preview-status').textContent=`${task.provider} · ${task.duration} 秒 · 请及时下载`;} 
});
window.addEventListener('beforeunload',()=>{state.libraryUrls.forEach(url=>URL.revokeObjectURL(url));if(state.currentUrl)URL.revokeObjectURL(state.currentUrl);});
