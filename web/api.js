export async function api(path,signal) {
 const response=await fetch(path,{signal,credentials:'same-origin'});
 if(response.status===401)throw Error('Your session has ended. Reload to sign in.');
 if(!response.ok)throw Error('This source is unavailable. Please try again.');
 return response.json();
}
export const resource=(a,name,type,id,query='',signal)=>api('/api/addon/'+a.index+'/'+name+'/'+encodeURIComponent(type)+'/'+encodeURIComponent(id)+query,signal);
export const supports=(a,name,type)=>a.resources?.some(r=>typeof r==='string'?r===name:r.name===name&&(!r.types||r.types.includes(type)));
export const dedupe=items=>[...new Map(items.filter(i=>i?.id).map(i=>[i.type+':'+i.id,i])).values()];
export function safeURL(value) {try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function readState(uid,name,fallback) {try{return JSON.parse(localStorage.getItem('librestream:'+uid+':'+name))||fallback;}catch{return fallback;}}
export function writeState(uid,name,value) {try{localStorage.setItem('librestream:'+uid+':'+name,JSON.stringify(value));}catch{}}
export function sourceLabel(a,stream) {
 const text=[a.name,stream.name,stream.title||stream.description].filter(Boolean).join(' · ');
 // Provider decoration is data. Remove pictographs from source controls for readable browser labels.
 return text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/[ \t]+/g,' ').trim();
}
