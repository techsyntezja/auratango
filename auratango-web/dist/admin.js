import {configured,login,logout,load,save,upload,registerAdmin} from './cms-api.js';
import {finderVideoUrl,youtubeVideoId} from './finder-videos.js';
import {openTeacherPanel,hasUnsavedTeacherSettings} from './teacher-panel.js';
const $=s=>document.querySelector(s), frame=$('#preview-frame');
let draft={edits:{},theme:{}},published={},selected=null,authenticated=false,dirty=false,workspaceAccess={admin:true,teacher:null,preview:true};
const pages={'/':'Home','/classes':'Classes','/class/partnered':'Partnered tango','/class/ladies':'Tango Ladies','/timetable':'Timetable','/workshops':'Workshops','/milonga':'Milonga','/auratouch':'AuraTouch','/community':'Community','/shop':'Atelier','/story':'About','/contact':'Contact','/pricing':'Pricing','/journal':'Journal','/guide':'Beginner guide','/gift':'Gift cards'};
for(const [path,title] of Object.entries(pages))$('#route').add(new Option(title,path));
function status(text){$('#status').textContent=text;}
function send(){frame.contentWindow?.postMessage({type:'aura-content',content:draft},location.origin);}
function preview(){frame.src='index.html?cms=1#'+$('#route').value;}
function update(){dirty=true;send();status(authenticated?'Unsaved draft changes.':'Local preview — changes are temporary.');changes();}
function changes(){let total=0;const list=$('#change-list');list.replaceChildren();for(const [context,edits]of Object.entries(draft.edits||{}))for(const edit of Object.values(edits)){total++;const row=document.createElement('div');row.className='change';row.textContent=context+' · '+edit.kind+' · '+edit.value;list.append(row);}$('#count').textContent=total+' content changes plus '+Object.keys(draft.theme||{}).length+' brand colours and '+Object.values(draft.finderVideos||{}).reduce((count,links)=>count+Object.keys(links).length,0)+' video links.';}
function openWorkspace(){
  $('#auth').hidden=true;$('#admin-setup').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=!authenticated;
  $('#connection').textContent=authenticated?'Connected to Supabase':'Local preview';
  $('#save').disabled=$('#publish').disabled=!authenticated;
  if(workspaceAccess.admin){preview();renderVideoFields();changes();return;}
  $('.toolbar').hidden=true;
  document.querySelectorAll('[data-tab]:not([data-tab=teacher-settings])').forEach(button=>button.hidden=true);
  $('[data-tab=teacher-settings]').click();
}
$('#login').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const f=new FormData(e.target);const access=await login(f.get('email'),f.get('password'));if(access.admin){const row=await load(false);draft=row.draft||{edits:{},theme:{}};published=row.published||{};}workspaceAccess={...access,preview:false};authenticated=true;e.target.reset();openWorkspace();status(workspaceAccess.admin?'Signed in. Your draft is ready.':'Signed in to teacher settings.');}catch(error){status(error.message);}finally{button.disabled=false;}};
$('#preview').onclick=openWorkspace;
$('#register').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const form=new FormData(e.target);await registerAdmin(form.get('email'),form.get('password'));e.target.reset();status('Check tech.auratango@gmail.com for the confirmation email. Confirm your email, return to this dashboard, then sign in. If the confirmation opens an unavailable localhost page, return here and sign in after confirming.');}catch(error){status(error.message);}finally{button.disabled=false;}};
$('#logout').onclick=async()=>{try{await logout();location.reload();}catch(error){status(error.message)}};
$('#route').onchange=()=>{selected=null;$('#edit-form').hidden=true;preview();};
$('#language').onchange=()=>frame.contentWindow?.postMessage({type:'aura-language',language:$('#language').value},location.origin);
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;if(event.data.type==='aura-ready')send();if(event.data.type==='aura-select'){selected=event.data;$('#edit-form').hidden=false;$('#value').value=selected.value;$('#edit-label').textContent=selected.kind==='image'?'Image URL':selected.kind==='link'?'Link destination':'Text';$('#upload-label').hidden=selected.kind!=='image';}});
$('#edit-form').onsubmit=e=>{e.preventDefault();if(!selected)return;const value=$('#value').value;if(selected.kind==='link'&&!/^(#\/|https?:\/\/)/i.test(value))return status('Use a website URL or an internal #/page link.');if(selected.kind==='image'&&!/^https?:\/\//i.test(value))return status('Use an HTTP or HTTPS image URL.');draft.edits||={};draft.edits[selected.context]||={};draft.edits[selected.context][selected.key]={tag:selected.tag,kind:selected.kind,value};update();};
$('#reset-field').onclick=()=>{if(selected&&draft.edits?.[selected.context])delete draft.edits[selected.context][selected.key];dirty=true;preview();changes();status('Original restored in draft. Save and publish to make this change live.');};
$('#upload').onchange=async e=>{if(!authenticated)return status('Sign in to upload media.');if(!e.target.files[0])return;try{$('#value').value=await upload(e.target.files[0]);status('Image uploaded. Apply it to your draft.');}catch(error){status(error.message);}};
async function persist(publish){const buttons=[$('#save'),$('#publish')];buttons.forEach(b=>b.disabled=true);try{await save(draft,publish);dirty=false;if(publish)published=structuredClone(draft);status(publish?'Published. Your changes are now available on the website.':'Draft saved. The public website has not changed.');}catch(error){status(error.message);}finally{buttons.forEach(b=>b.disabled=false);}}
$('#save').onclick=()=>persist(false);$('#publish').onclick=()=>persist(true);
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==button.dataset.tab);if(button.dataset.tab==='teacher-settings')openTeacherPanel(workspaceAccess);};
const videoSlots = {
  partnered:'Partner dancing', ladies:'Ladies’ Solo', experienced:'I already dance',
  return:'I am coming back', auratouch:'AuraTouch', private:'Private classes · Anna',
  'private-rick':'Private classes · Rick'
};
function renderVideoFields() {
  const language = $('#video-language').value;
  const fields = Object.entries(videoSlots).map(([slot,title]) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    label.textContent = title;
    input.name = slot;
    input.placeholder = 'Use current video';
    input.inputMode = 'url';
    input.value = finderVideoUrl(draft.finderVideos, language, slot) || '';
    input.oninput = () => input.setCustomValidity('');
    label.append(input);
    return label;
  });
  $('#video-fields').replaceChildren(...fields);
}
$('#video-language').onchange = renderVideoFields;
$('#video-form').onsubmit = event => {
  event.preventDefault();
  const form = event.currentTarget;
  const language = $('#video-language').value;
  const links = {};
  for (const [slot,value] of new FormData(form)) {
    if (!value.trim()) continue;
    const id = youtubeVideoId(value);
    if (!id) {
      const field = form.elements.namedItem(slot);
      field.setCustomValidity('Enter a valid YouTube link or video ID.');
      field.reportValidity();
      return;
    }
    links[slot] = id;
  }
  draft.finderVideos ||= {};
  if (Object.keys(links).length) draft.finderVideos[language] = links;
  else delete draft.finderVideos[language];
  update();
  renderVideoFields();
};
const colours={'--paper':['Background','#f8efe5'],'--wine':['Brand burgundy','#741522'],'--coral':['Accent','#8b2436'],'--ink':['Text','#231317'],'--deep':['Deep background','#1b090e'],'--muted':['Muted text','#675056']};
for(const [key,[title,value]]of Object.entries(colours)){const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.type='color';input.value=value;input.oninput=()=>{draft.theme||={};draft.theme[key]=input.value;update();};label.append(input);$('#colours').append(label);}
$('#restore').onclick=()=>{draft=structuredClone(published);dirty=true;preview();renderVideoFields();changes();status('Published content restored to your draft. Save to keep it.');};
$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='auratango-content.json';a.click();URL.revokeObjectURL(url);};
window.addEventListener('beforeunload',e=>{if(dirty||hasUnsavedTeacherSettings()){e.preventDefault();e.returnValue='';}});
if(configured){$('#connection').textContent='Supabase configured';$('#setup').hidden=true;}
