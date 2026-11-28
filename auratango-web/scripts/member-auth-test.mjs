import assert from 'node:assert/strict';
import {createMemberHandler} from '../../api/member.mjs';
let confirmed=true,badCode=false;const calls=[];
const fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/otp'))return Response.json({});if(url.endsWith('/verify'))return badCode?Response.json({message:'Invalid code'},{status:403}):Response.json({access_token:'member-token',refresh_token:'member-refresh',expires_in:3600});if(url.includes('grant_type=refresh_token'))return Response.json({access_token:'new-token',refresh_token:'new-refresh',expires_in:3600});if(url.endsWith('/user'))return options.headers.Authorization==='Bearer expired'?Response.json({message:'Expired'},{status:401}):Response.json({id:'member-id',email:'anna@example.invalid',email_confirmed_at:confirmed?'2026-11-28T10:00:00Z':null});return Response.json({});};
const handler=createMemberHandler({fetcher,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}});
async function run(action,payload={},extra={}){let value;const headers={};const res={statusCode:200,setHeader:(k,v)=>headers[k]=v,end:v=>value=JSON.parse(v)};await handler({method:'POST',url:'/api/member',headers:{host:'school.example',origin:'https://school.example',...extra},body:{action,...payload}},res);return {status:res.statusCode,body:value,headers};}
assert.equal((await run('session')).body.user,null);
assert.equal((await run('send_code',{email:'bad'})).status,400);
assert.equal((await run('send_code',{email:'anna@example.invalid'},{origin:'https://evil.example'})).status,403);
const sent=await run('send_code',{email:'Anna@example.invalid'});assert.equal(sent.body.sent,true);assert(!('previewCode' in sent.body));assert.equal(JSON.parse(calls.at(-1).options.body).email,'anna@example.invalid');
badCode=true;const bad=await run('verify',{email:'anna@example.invalid',code:'654321'});assert.equal(bad.status,403);assert(!bad.headers['Set-Cookie']);badCode=false;
confirmed=false;assert.equal((await run('verify',{email:'anna@example.invalid',code:'123456'})).status,403);confirmed=true;
const verified=await run('verify',{email:'anna@example.invalid',code:'123456'});assert.equal(verified.body.user.verified,true);assert(!JSON.stringify(verified.body).includes('member-token'));assert(verified.headers['Set-Cookie'].every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Strict')&&c.includes('Secure')&&c.includes('Path=/api/member')));assert(verified.headers['Set-Cookie'].every(c=>!c.includes('aura_crm')));
const refresh=await run('session',{}, {cookie:'aura_member_session=expired; aura_member_refresh=member-refresh'});assert.equal(refresh.body.user.email,'anna@example.invalid');assert(refresh.headers['Set-Cookie']);
assert.equal((await run('load',{}, {cookie:'aura_member_session=member-token'})).status,400);
const logout=await run('logout',{}, {cookie:'aura_member_session=member-token'});assert(logout.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')));
assert(calls.every(c=>!c.url.includes('/rest/v1/')));
console.log('PASS: customer OTP request/verification, invalid and unverified rejection, session refresh, HttpOnly cookies, logout, CSRF and no CRM access.');
