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
    const el=find(edit.targetKey||key);if(!el || el.tagName!==edit.tag || el.closest('[data-commerce-value]'))continue;
    if(edit.kind==='text-node'){const node=el.childNodes[edit.nodeIndex];if(node?.nodeType===3&&node.nodeValue.trim()!==edit.value)node.nodeValue=edit.value;}
    if(edit.kind==='text' && !el.children.length && el.textContent!==edit.value)el.textContent=edit.value;
    if(edit.kind==='image' && el.tagName==='IMG' && validUrl(edit.value) && el.getAttribute('src')!==edit.value)el.src=edit.value;
    if(edit.kind==='link' && el.tagName==='A' && (edit.value.startsWith('#/')||validUrl(edit.value)) && el.getAttribute('href')!==edit.value){el.setAttribute('href',edit.value);el.removeAttribute('onclick');}
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
    if(!el||!keyFor(el))return;
    const choices=[];
    const add=(target,kind,value,nodeIndex)=>{const key=keyFor(target);if(key)choices.push({key,tag:target.tagName,kind,value,nodeIndex});};
    const block=el.closest('article,section')||el.closest('a,button,h1,h2,h3,h4,p')||el;
    const nodes=[block,...block.querySelectorAll('*')];
    let textCount=0,imageCount=0,linkCount=0;
    for(const target of nodes){
      if(target.closest('svg,script,style,select'))continue;
      if(target.tagName==='IMG'){add(target,'image',target.getAttribute('src'));choices.at(-1).label='Image '+(++imageCount)+' · URL';}
      if(target.tagName==='A'){add(target,'link',target.getAttribute('href'));if(choices.at(-1)?.key===keyFor(target))choices.at(-1).label='Link '+(++linkCount)+' · '+target.textContent.trim().slice(0,45);}
      Array.from(target.childNodes).forEach((node,index)=>{if(node.nodeType!==3||!node.nodeValue.trim())return;add(target,target.children.length?'text-node':'text',target.children.length?node.nodeValue.trim():target.textContent,index);const choice=choices.at(-1);if(choice?.key===keyFor(target))choice.label=(/^H[1-6]$/.test(target.tagName)?'Heading':target.closest('button,a')?'Button / link text':'Text')+' '+(++textCount);});
    }
    if(!choices.length)return;
    event.preventDefault();event.stopImmediatePropagation();
    parent.postMessage({type:'aura-select',context:context(),choices,...choices[0]},location.origin);
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

window.validateClassDiscount=(code,offer,party,months)=>request('/rest/v1/rpc/validate_class_discount',{method:'POST',body:JSON.stringify({p_code:code,p_offer:offer,p_party:party,p_months:months})});

const standardDiscountQuote=window.validateClassDiscount;
async function localDiscountRequest(action,code,offer,party,months,checkout){const response=await fetch('/api/discount-preview',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,code,offer,party,months,checkout})});if(!response.ok)throw Error('Unable to check this discount. Please retry.');return response.json();}
window.validateClassDiscount=(code,offer,party,months,checkout)=>window.AURA_CONFIG?.localDiscountPreview?localDiscountRequest('quote',code,offer,party,months,checkout):standardDiscountQuote(code,offer,party,months);
window.redeemClassDiscount=(code,offer,party,months,checkout)=>{if(!window.AURA_CONFIG?.localDiscountPreview)throw Error('Single-use discount payment confirmation is not configured yet.');return localDiscountRequest('redeem',code,offer,party,months,checkout);};
