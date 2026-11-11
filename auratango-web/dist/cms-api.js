export const config = window.AURA_CONFIG;
export const configured = Boolean(config.supabaseUrl && config.supabaseKey);
let session = null;
export async function request(path, options = {}) {
  if (!configured) throw new Error('Add your Supabase project URL and publishable key to config.js first.');
  const response = await fetch(config.supabaseUrl.replace(/\/$/, '') + path, {
    ...options, headers: {apikey: config.supabaseKey, ...(session?.access_token ? {Authorization: `Bearer ${session.access_token}`} : {}), 'Content-Type':'application/json', ...options.headers}
  });
  const body = await response.text();
  const data = body ? JSON.parse(body) : null;
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || 'Supabase request failed');
  return data;
}
export async function login(email, password) {
  session = await request('/auth/v1/token?grant_type=password', {method:'POST',body:JSON.stringify({email,password})});
  try {
    const admins = await request('/rest/v1/cms_admins?select=user_id&user_id=eq.' + encodeURIComponent(session.user.id));
    if (admins.length) return {admin:true, teacher:null};
    const assignments = await request('/rest/v1/private_teacher_access?select=teacher');
    if (assignments.length) return {admin:false, teacher:assignments[0].teacher};
    throw new Error('This account has no studio access.');
  } catch(error) {session=null; throw error;}
}
export async function registerAdmin(email,password) {
  if(email.trim().toLowerCase()!=='tech.auratango@gmail.com') throw new Error('Administrator setup is reserved for the studio owner.');
  if(password.length<12) throw new Error('Choose a password with at least 12 characters.');
  return request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:email.trim(),password})});
}
export async function logout() {try {await request('/auth/v1/logout',{method:'POST'});} finally {session=null;}}
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
  const name=crypto.randomUUID()+'.'+file.type.split('/')[1];
  await request('/storage/v1/object/site-media/'+name,{method:'POST',headers:{'Content-Type':file.type},body:file});
  return config.supabaseUrl.replace(/\/$/,'')+'/storage/v1/object/public/site-media/'+name;
}
