export const config = window.AURA_CONFIG;
export const configured = Boolean(config.supabaseUrl && config.supabaseKey);
const studioPage=/^\/(backstage|studio)(\.html)?\/?$/.test(location.pathname);
export async function staffSession(action='session',payload={}){const response=await fetch('/api/crm',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});const data=await response.json();if(!response.ok){if(response.status===401&&studioPage)location.replace('/dashboard?next=backstage');const error=Error(data.message||'Staff request failed');error.status=response.status;throw error;}return data;}
export async function request(path,options={}){
 if(studioPage)return staffSession('studio_request',{path,method:options.method||'GET',body:options.body?JSON.parse(options.body):undefined});
 if(!configured)throw Error('Website services are not configured.');
 const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+path,{...options,headers:{apikey:config.supabaseKey,'Content-Type':'application/json',...options.headers}});
 const body=await response.text(),data=body?JSON.parse(body):null;if(!response.ok)throw Error(data?.msg||data?.message||'Website request failed');return data;
}
export const login=(email,password)=>staffSession('login',{email,password});
export const logout=()=>staffSession('logout');
export function loadPrivateLessons() {
  return request('/rest/v1/private_lesson_settings?select=teacher,schedule_managed,available_times,trial_grosz,package4_grosz,package8_grosz,revision');
}
export async function savePrivateLessons(teacher, revision, settings) {
  const rows = await request(`/rest/v1/private_lesson_settings?teacher=eq.${encodeURIComponent(teacher)}&revision=eq.${revision}`, {
    method:'PATCH', headers:{Prefer:'return=representation'},
    body:JSON.stringify({...settings, revision:revision+1})
  });
  if (!rows.length) throw new Error('The settings changed or this account cannot edit them. Reload and try again.');
  return rows[0];
}
export async function load(published = true) {
  const rows = await request('/rest/v1/site_content?id=eq.main&select=published');
  if(published) return rows[0] || {published:{}};
  const drafts=await request('/rest/v1/site_drafts?id=eq.main&select=draft,updated_at');
  return {...rows[0],...drafts[0]};
}
export async function save(draft, publish = false) {
  const body = {draft, updated_at:new Date().toISOString()};
  const rows=await request('/rest/v1/site_drafts?id=eq.main',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
  if(!rows?.length) throw new Error('No content record was saved. Check the migration and admin permissions.');
  if(publish) {
    const published=await request('/rest/v1/site_content?id=eq.main',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({published:draft,updated_at:body.updated_at})});
    if(!published?.length) throw new Error('Draft saved, but publication failed. Check administrator permissions.');
  }
  return rows[0];
}
export async function upload(file) {
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP or GIF image.');
  if(file.size>10*1024*1024) throw new Error('Images must be under 10 MB.');
  const signed=await staffSession('studio_upload',{extension:file.type.split('/')[1]});
  const form=new FormData();form.append('cacheControl','3600');form.append('',file);
  const response=await fetch(signed.url,{method:'PUT',headers:{apikey:config.supabaseKey},body:form});
  if(!response.ok)throw Error('Image upload failed. Please retry.');
  return config.supabaseUrl.replace(/\/$/,'')+'/storage/v1/object/public/site-media/'+signed.name;
}
