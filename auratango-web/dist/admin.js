import {configured,staffSession,logout,load,save,upload} from './cms-api.js';
import {finderVideoUrl,youtubeVideoId} from './finder-videos.js';
import {openTeacherPanel,hasUnsavedTeacherSettings} from './teacher-panel.js';
const $=s=>document.querySelector(s), frame=$('#preview-frame');
let draft={edits:{},theme:{}},published={},selected=null,authenticated=false,dirty=false,workspaceAccess={admin:false,teacher:null,preview:false};
const pages={'/':'Home','/classes':'Classes','/class/partnered':'Partnered tango','/class/ladies':'Tango Ladies','/timetable':'Timetable','/workshops':'Workshops','/milonga':'Milonga','/auratouch':'AuraTouch','/community':'Community','/shop':'Atelier','/story':'About','/contact':'Contact','/pricing':'Pricing','/journal':'Journal','/guide':'Beginner guide','/gift':'Gift cards'};
for(const [path,title] of Object.entries(pages))$('#route').add(new Option(title,path));
function status(text){$('#status').textContent=text;const feedback=$('#edit-feedback');if(feedback)feedback.textContent=text;}
function send(){frame.contentWindow?.postMessage({type:'aura-content',content:draft},location.origin);}
function preview(){frame.src='index.html?cms=1#'+$('#route').value;}
function update(){dirty=true;send();status(authenticated?'Unsaved draft changes.':'Local preview — changes are temporary.');changes();}
function changes(){let total=0;const list=$('#change-list');list.replaceChildren();for(const [context,edits]of Object.entries(draft.edits||{}))for(const edit of Object.values(edits)){total++;const row=document.createElement('div');row.className='change';row.textContent=context+' · '+edit.kind+' · '+edit.value;list.append(row);}$('#count').textContent=total+' content changes plus '+Object.keys(draft.theme||{}).length+' brand colours and '+Object.values(draft.finderVideos||{}).reduce((count,links)=>count+Object.keys(links).length,0)+' video links.';}
function openWorkspace(){
  if(!authenticated||(!workspaceAccess.admin&&!workspaceAccess.teacher))return;
  $('#backstage-nav').hidden=false;
  $('#auth').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=!authenticated;

  $('#save').disabled=$('#publish').disabled=!authenticated;
  if(workspaceAccess.admin){preview();renderVideoFields();changes();return;}
  $('.toolbar').hidden=true;
  document.querySelectorAll('[data-tab]:not([data-tab=teacher-settings])').forEach(button=>button.hidden=true);
  $('[data-tab=teacher-settings]').click();
}



$('#logout').onclick=async()=>{try{await logout();location.reload();}catch(error){status(error.message)}};
$('#route').onchange=()=>{selected=null;$('#edit-form').hidden=true;preview();};
$('#language').onchange=()=>frame.contentWindow?.postMessage({type:'aura-language',language:$('#language').value},location.origin);
let editChoices=[],editContext='';
const fieldKey=choice=>choice.key+'::'+choice.kind+(choice.kind==='text-node'?':'+choice.nodeIndex:'');
function renderEditFields(){
 const fields=$('#edit-fields');fields.replaceChildren();
 editChoices.forEach((choice,index)=>{
  const label=document.createElement('label');label.textContent=choice.label||(choice.kind==='image'?'Image URL':choice.kind==='link'?'Link destination':'Text');
  const input=document.createElement(choice.kind==='text'||choice.kind==='text-node'?'textarea':'input');input.dataset.index=index;input.value=choice.value||'';if(input.tagName==='TEXTAREA')input.rows=2;label.append(input);
  if(choice.kind==='image'){const uploadLabel=document.createElement('label');uploadLabel.textContent='Upload replacement image';const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp,image/gif';file.onchange=async()=>{if(!file.files[0])return;try{input.value=await upload(file.files[0]);status('Image uploaded. Apply this section to your draft.');}catch(error){status(error.message);}};uploadLabel.append(file);label.append(uploadLabel);}
  fields.append(label);
 });
}
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;if(event.data.type==='aura-ready')send();if(event.data.type==='aura-select'){editChoices=event.data.choices||[event.data];editContext=event.data.context;$('#edit-form').hidden=false;renderEditFields();}});
$('#edit-form').onsubmit=e=>{e.preventDefault();const edits=[];for(const input of $('#edit-fields').querySelectorAll('[data-index]')){const choice=editChoices[Number(input.dataset.index)],value=input.value;if(choice.kind==='link'&&!/^(#\/|https?:\/\/)/i.test(value))return status('Use a website URL or an internal #/page link.');if(choice.kind==='image'&&!/^https?:\/\//i.test(value))return status('Use an HTTP or HTTPS image URL.');edits.push([choice,value]);}draft.edits||={};draft.edits[editContext]||={};for(const [choice,value]of edits)draft.edits[editContext][fieldKey(choice)]={targetKey:choice.key,tag:choice.tag,kind:choice.kind,nodeIndex:choice.nodeIndex,value};update();};
$('#reset-field').onclick=()=>{for(const choice of editChoices){const edits=draft.edits?.[editContext];if(!edits)continue;delete edits[fieldKey(choice)];if(edits[choice.key]?.kind===choice.kind)delete edits[choice.key];}dirty=true;preview();changes();$('#edit-form').hidden=true;status('Section restored in draft. Save and publish to make this change live.');};
async function persist(publish){const buttons=[$('#save'),$('#publish')];buttons.forEach(b=>b.disabled=true);try{await save(draft,publish);dirty=false;if(publish)published=structuredClone(draft);status(publish?'Published. Your changes are now available on the website.':'Draft saved. The public website has not changed.');}catch(error){status(error.message);}finally{buttons.forEach(b=>b.disabled=false);}}
$('#save').onclick=()=>persist(false);$('#publish').onclick=()=>persist(true);
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==button.dataset.tab);if(button.dataset.tab==='teacher-settings')openClassSettings();};
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
if(configured){$('#setup').hidden=true;}

function openClassSettings(){
 const types=workspaceAccess.admin?[['single','Single partner groups','One person joining a partner group'],['couple','Couple groups','Two people joining together'],['ladies','Ladies’ Solo','Solo movement with Anna'],['private','Private lessons','Rick and Anna · individual settings']]:[['private','Private lessons','Your timetable and prices']];
 const choices=$('#class-type-choices');choices.replaceChildren(...types.map(([id,title,description])=>{const button=document.createElement('button');button.type='button';button.dataset.classType=id;const heading=document.createElement('strong');heading.textContent=title;const text=document.createElement('span');text.textContent=description;button.append(heading,text);button.onclick=()=>showClassSettings(id);return button;}));
 showClassSettings(workspaceAccess.admin?'single':'private');
}
function showClassSettings(type){
 const isPrivate=type==='private';$('#private-settings-content').hidden=!isPrivate;$('#group-class-overview').hidden=isPrivate;
 document.querySelectorAll('[data-class-type]').forEach(button=>{const selected=button.dataset.classType===type;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',selected);});
 if(isPrivate){openTeacherPanel(workspaceAccess);return;}
 if(!workspaceAccess.admin)return;
 const couple=type==='couple',ladies=type==='ladies',title=ladies?'Ladies’ Solo':couple?'Couple groups':'Single partner groups',rate=couple?440:260,trial=couple?58:29;
 const overview=$('#group-class-overview');overview.innerHTML='<h3>'+title+'</h3><p>Current website programme · Warsaw time</p><div class="class-overview-grid"><section><h3>Packages & prices</h3><table><thead><tr><th>Package</th><th>Classes</th><th>Price</th></tr></thead><tbody>'+[['First Embrace',1],['Finding the Flow',3],['Your Tango Voice',6]].map(([name,months])=>'<tr><td>'+name+'<small>'+months+' month'+(months>1?'s':'')+'</small></td><td>'+months*4+'</td><td>'+rate*months+' zł</td></tr>').join('')+'</tbody></table><p>Trial class: <strong>'+trial+' zł</strong> · '+(couple?'per couple':'per person')+'</p></section><section><h3>Weekly timetable</h3><ul>'+(ladies?['Saturday · 10:00–12:00','Sunday · 10:00–12:00']:['Saturday · 15:00–16:15','Saturday · 16:15–17:30','Saturday · 17:30–18:45']).map(time=>'<li>'+time+'</li>').join('')+'</ul><p>Studios: Gocław · Abrahama 12 and Solec · Solec 38. A group’s venue is confirmed separately.</p></section></div><p class="hint">Group prices and recurring times are shown as an overview of the current website. Private lesson settings can be edited and saved in the Private lessons card.</p><a href="/#/classes" target="_blank" rel="noopener">View public classes ↗</a>';
}

async function resumeStaffEditor(){try{const access=await staffSession();if(access.admin){const row=await load(false);draft=row.draft||{edits:{},theme:{}};published=row.published||{};}workspaceAccess={...access,preview:false};authenticated=true;openWorkspace();status(workspaceAccess.admin?'Signed in. Your draft is ready.':'Signed in to teacher settings.');}catch(error){if(!authenticated&&(error.status===401||error.status===403))location.replace('/dashboard?next=backstage');else status(error.message);}}
resumeStaffEditor();
