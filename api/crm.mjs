import {readFile} from 'node:fs/promises';
const COOKIE='aura_crm_session', REFRESH='aura_crm_refresh';
const actions=new Set(['load','lead_save','note','class_save','book','cancel','attendance','convert','membership']);
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))];}));}
function setSession(req,res,session){const secure=(req.headers['x-forwarded-proto']==='https'||!String(req.headers.host).startsWith('127.0.0.1'))?'; Secure':'';res.setHeader('Set-Cookie',[`${COOKIE}=${encodeURIComponent(session?.access_token||'')}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${session?Math.min(session.expires_in||3600,3600):0}${secure}`,`${REFRESH}=${encodeURIComponent(session?.refresh_token||'')}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${session?604800:0}${secure}`]);}
export function createHandler({fetcher=fetch,readPage=()=>readFile(new URL('../auratango-web/dist/dashboard.html',import.meta.url),'utf8'),env=process.env}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
  try{
   const url=new URL(req.url,'http://'+req.headers.host),page=url.pathname==='/dashboard'||url.searchParams.get('action')==='page'||req.query?.action==='page';
   if(!['GET','POST'].includes(req.method))return send(405,{message:'Method not allowed'});
   let payload={};
   if(req.method==='POST'){
    const origin=req.headers.origin,host=req.headers.host;
    if(!origin||new URL(origin).host!==host||req.headers['sec-fetch-site']==='cross-site')return send(403,{message:'Same-origin request required'});
    if(req.body){payload=typeof req.body==='string'?JSON.parse(req.body):req.body;}else{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>24000)return send(413,{message:'Request too large'});}payload=JSON.parse(raw||'{}');}
    if(JSON.stringify(payload).length>24000)return send(413,{message:'Request too large'});
   }
   const action=payload.action||url.searchParams.get('action')||'session';
   const base=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY;
   if(!base||!key?.startsWith('sb_publishable_')){
    if(page){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readPage());}
    return send(503,{message:'CRM is not configured. Set the Supabase environment variables.'});
   }
   const upstream=async(path,token,options={})=>{const response=await fetcher(base.replace(/\/$/,'')+path,{...options,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(15000)});const body=await response.json().catch(()=>({}));if(!response.ok){const error=Error(body.message||body.msg||body.error_description||'Unable to complete request');error.status=response.status;throw error;}return body;};
   let saved=cookies(req),token=saved[COOKIE],session;
   if(action==='login'&&req.method==='POST'){
    session=await upstream('/auth/v1/token?grant_type=password',null,{method:'POST',body:JSON.stringify({email:String(payload.payload?.email||'').trim(),password:payload.payload?.password||''})});token=session.access_token;
   }
   if(action==='logout'&&req.method==='POST'){try{if(token)await upstream('/auth/v1/logout',token,{method:'POST'});}finally{setSession(req,res,null);}return send(200,{signedOut:true});}
   let user;
   try{if(!token)throw Error('Sign in required');user=await upstream('/auth/v1/user',token);}
   catch(error){
    if(saved[REFRESH]&&action!=='login'){try{session=await upstream('/auth/v1/token?grant_type=refresh_token',null,{method:'POST',body:JSON.stringify({refresh_token:saved[REFRESH]})});token=session.access_token;user=await upstream('/auth/v1/user',token);}catch{setSession(req,res,null);}}
   }
   if(!user){if(page){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readPage());}return send(401,{message:'Sign in with your administrator account.'});}
   const admins=await upstream('/rest/v1/cms_admins?select=user_id&user_id=eq.'+encodeURIComponent(user.id),token);
   if(!admins.length){setSession(req,res,null);if(page){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readPage());}return send(403,{message:'School administrator access required.'});}
   if(session)setSession(req,res,session);
   if(page){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readPage());}
   if(action==='login'||action==='session')return send(200,{admin:true});
   if(!actions.has(action)||req.method!=='POST')return send(400,{message:'Unknown CRM action'});
   return send(200,await upstream('/rest/v1/rpc/crm_staff',token,{method:'POST',body:JSON.stringify({p_action:action,p_data:payload.payload||{}})}));
  }catch(error){const status=error.status===400?400:error.status===401?401:error.status===403?403:500;return send(status,{message:status===500?'Unable to complete this request. Please retry.':error.message});}
 };
}
export default createHandler();
