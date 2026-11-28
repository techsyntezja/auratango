const ACCESS='aura_member_session',REFRESH='aura_member_refresh';
const readCookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))];}));
function sessionCookies(req,res,session){const secure=/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||'')?'':'; Secure';res.setHeader('Set-Cookie',[[ACCESS,session?.access_token,Math.min(session?.expires_in||3600,3600)],[REFRESH,session?.refresh_token,604800]].map(([name,value,age])=>`${name}=${encodeURIComponent(value||'')}; Path=/api/member; HttpOnly; SameSite=Strict; Max-Age=${session?age:0}${secure}`));}
export function createMemberHandler({fetcher=fetch,env=process.env,preview=false}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
 try{
  if(req.method!=='POST')return send(405,{message:'Method not allowed'});
  if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site')return send(403,{message:'Same-origin request required'});
  let body=req.body;if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8000)return send(413,{message:'Request too large'});}body=JSON.parse(raw||'{}');}else if(typeof body==='string')body=JSON.parse(body);
  if(JSON.stringify(body).length>8000)return send(413,{message:'Request too large'});
  const {action}=body;if(!['session','send_code','verify','logout'].includes(action))return send(400,{message:'Unknown account action'});
  const base=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY;if(!base||!key)return send(503,{message:'Account sign-in is not configured yet.'});
  const upstream=async(path,payload,token)=>{const result=await fetcher(base.replace(/\/$/,'')+'/auth/v1/'+path,{method:payload?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(15000)});const data=await result.json().catch(()=>({}));if(!result.ok){const error=Error(data.msg||data.message||data.error_description||'Sign-in failed. Please retry.');error.status=result.status;throw error;}return data;};
  const saved=readCookies(req);let token=saved[ACCESS];
  if(action==='logout'){try{if(token)await upstream('logout?scope=local',{},token);}finally{sessionCookies(req,res,null);}return send(200,{signedOut:true});}
  if(action==='send_code'||action==='verify'){
   const email=String(body.email||'').trim().toLowerCase();if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return send(400,{message:'Enter a valid email address.'});
   if(action==='send_code'){await upstream('otp',{email,create_user:true});return send(200,{sent:true,...(preview?{previewCode:'123456'}:{})});}
   const code=String(body.code||'').trim();if(!/^\d{6,10}$/.test(code))return send(400,{message:'Enter the verification code from your email.'});
   const session=await upstream('verify',{email,token:code,type:'email'});const user=await upstream('user',null,session.access_token);
   if(!user.email_confirmed_at||user.email?.toLowerCase()!==email)return send(403,{message:'Please verify your email before signing in.'});
   sessionCookies(req,res,session);return send(200,{user:{id:user.id,email:user.email,verified:true}});
  }
  let user,refreshed;
  try{if(token)user=await upstream('user',null,token);}catch(error){if(![401,403].includes(error.status))throw error;}
  if(!user&&saved[REFRESH]){try{refreshed=await upstream('token?grant_type=refresh_token',{refresh_token:saved[REFRESH]});user=await upstream('user',null,refreshed.access_token);}catch(error){if(![400,401,403].includes(error.status))throw error;}}
  if(!user?.email_confirmed_at){sessionCookies(req,res,null);return send(200,{user:null});}if(refreshed)sessionCookies(req,res,refreshed);
  return send(200,{user:{id:user.id,email:user.email,verified:true}});
 }catch(error){const status=[400,401,403,422,429].includes(error.status)?error.status:500;return send(status,{message:status===500?'Unable to sign in right now. Please retry.':error.message});}
};}
export default createMemberHandler();
