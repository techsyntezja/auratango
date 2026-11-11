import {configured,load,loadPrivateLessons,request} from './cms-api.js';
import {finderVideoUrl} from './finder-videos.js';
import {privateLessonCatalog,warsawToIso} from './private-lessons.js';
let content={edits:{},theme:{}};
const editing=window.parent!==window && new URLSearchParams(location.search).has('cms');
const validUrl=(value)=>{try{return ['https:','http:'].includes(new URL(value,location.href).protocol)}catch{return false}};
function keyFor(el){
  const parts=[];
  while(el && el.id!=='app') {const parent=el.parentElement;if(!parent)return null;parts.unshift([...parent.children].indexOf(el));el=parent;}
  if(!el)return null;
  return parts.join('.');
}
function language(){return document.documentElement.lang || 'en';}
function context(){return (location.hash || '#/')+'|'+language();}
function find(key){let node=document.getElementById('app');for(const i of key.split('.'))node=node?.children[Number(i)];return node;}
function apply(){
  for (const link of document.querySelectorAll('#modal-root [data-finder-video]')) {
    const href = finderVideoUrl(content.finderVideos, language(), link.dataset.finderVideo, link.dataset.videoId);
    if (href && link.getAttribute('href') !== href) link.setAttribute('href', href);
  }
  for(const [key,value] of Object.entries(content.theme||{}))if(/^--[a-z-]+$/.test(key)&&/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty(key,value);
  for(const [key,edit] of Object.entries(content.edits?.[context()]||{})){
    const el=find(key);if(!el || el.tagName!==edit.tag)continue;
    if(edit.kind==='text' && !el.children.length && el.textContent!==edit.value)el.textContent=edit.value;
    if(edit.kind==='image' && el.tagName==='IMG' && validUrl(edit.value) && el.getAttribute('src')!==edit.value)el.src=edit.value;
    if(edit.kind==='link' && el.tagName==='A' && (edit.value.startsWith('#/')||validUrl(edit.value)) && el.getAttribute('href')!==edit.value)el.setAttribute('href',edit.value);
  }
}
let queued=false;
const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})});
observer.observe(document.getElementById('app'),{childList:true,subtree:true});
observer.observe(document.getElementById('modal-root'),{childList:true,subtree:true});
if(editing){
  const style=document.createElement('style');style.textContent='[data-cms-hover]{outline:2px solid #e95e49!important;outline-offset:3px}';document.head.append(style);
  let hovered;
  document.addEventListener('pointerover',event=>{hovered?.removeAttribute('data-cms-hover');hovered=event.target.closest('img,a,h1,h2,h3,h4,p,span,small,em,strong,label,button');hovered?.setAttribute('data-cms-hover','');});
  document.addEventListener('click',event=>{
    if(event.altKey)return;
    const el=event.target.closest('img,a,h1,h2,h3,h4,p,span,small,em,strong,label,button');
    const key=el && keyFor(el);if(!key)return;
    let target=event.target;
    while(target.children.length && target!==el)target=target.parentElement;
    const selected=target.children.length?el:target;
    const kind=el.tagName==='IMG'?'image':el.tagName==='A'?'link':'text';
    if(kind==='text'&&selected.children.length)return;
    event.preventDefault();event.stopImmediatePropagation();
    const actual=kind==='text'?selected:el;
    parent.postMessage({type:'aura-select',context:context(),key:keyFor(actual),tag:actual.tagName,kind,value:kind==='image'?actual.getAttribute('src'):kind==='link'?actual.getAttribute('href'):actual.textContent},location.origin);
  },true);
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data.type==='aura-content'){content=event.data.content;apply();}if(event.data.type==='aura-language'&&['en','pl','ru','uk'].includes(event.data.language))switchLang(event.data.language);});
  parent.postMessage({type:'aura-ready'},location.origin);
} else if(configured){load().then(row=>{content=row.published||{};apply()}).catch(error=>console.error('CMS content could not load:',error.message));}
apply();
if (configured) {
  window.changePrivateSlotHold = (action, {teacher, time, token}) => request('/rest/v1/rpc/private_slot_hold', {
    method:'POST', keepalive:action==='release',
    body:JSON.stringify({p_action:action,p_teacher:teacher,p_slot:warsawToIso(time),p_token:token})
  });
  loadPrivateLessons()
    .then(rows => applyPrivateLessonCatalog(privateLessonCatalog(rows)))
    .catch(error => {
      console.error('Could not load private lesson settings:', error.message);
      applyPrivateLessonCatalog(null);
    });
} else applyPrivateLessonCatalog({});
