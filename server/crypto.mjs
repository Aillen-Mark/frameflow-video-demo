import { ApiError } from './providers.mjs';
const encoder=new TextEncoder();
function encode(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
function decode(s){return Uint8Array.from(atob(s),x=>x.charCodeAt(0));}
async function keyFor(secret){if(!secret||secret.length<32)throw new ApiError('服务端加密配置尚未就绪',503);return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function encrypt(data,secret,aad){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(aad)},await keyFor(secret),encoder.encode(JSON.stringify(data)));return `v1.${encode(iv)}.${encode(new Uint8Array(bytes))}`;}
export async function decrypt(data,secret,aad){try{const [version,iv,bytes]=data.split('.');if(version!=='v1')throw new Error();const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:encoder.encode(aad)},await keyFor(secret),decode(bytes));return JSON.parse(new TextDecoder().decode(plain));}catch{throw new ApiError('保存的凭据无法读取，请重新填写并保存',503);}}
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
