import assert from 'node:assert/strict';
import {createHandler} from '../../api/crm.mjs';
const calls=[];let admin=true;
const fetcher=async(url,options={})=>{calls.push({url,options});if(url.includes('grant_type=password'))return Response.json({access_token:'test-token',refresh_token:'test-refresh',expires_in:3600});if(url.endsWith('/auth/v1/user'))return Response.json({id:'test-admin'});if(url.includes('/cms_admins'))return Response.json(admin?[{user_id:'test-admin'}]:[]);if(url.endsWith('/rpc/crm_staff'))return Response.json({leads:[]});return Response.json({});};
const handler=createHandler({fetcher,env:{SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},readPage:async()=>'<html>Sign in</html>'});
async function run(action,{cookie,origin='https://school.example',method='POST',payload={}}={}){const req={method,url:'/api/crm',headers:{host:'school.example',origin,...(cookie?{cookie}:{})},body:{action,payload}};const headers={};let text;const res={statusCode:200,setHeader:(name,value)=>headers[name]=value,end:value=>text=value};await handler(req,res);return {status:res.statusCode,headers,body:JSON.parse(text)};}
assert.equal((await run('load')).status,401);
assert.equal((await run('load',{origin:'https://evil.example',cookie:'aura_crm_session=test-token'})).status,403);
assert.equal((await run('load',{origin:null})).status,403);
admin=false;assert.equal((await run('load',{cookie:'aura_crm_session=test-token'})).status,403);
admin=true;const signed=await run('login',{payload:{email:'admin@example.invalid',password:'not-real'}});assert.equal(signed.status,200);assert.equal(signed.body.admin,true);assert(!JSON.stringify(signed.body).includes('test-token'));assert(signed.headers['Set-Cookie'].every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Strict')&&c.includes('Secure')));
const before=calls.length;const load=await run('load',{cookie:'aura_crm_session=test-token'});assert.equal(load.status,200);assert(calls.slice(before).some(c=>c.url.endsWith('/auth/v1/user')));assert(calls.slice(before).some(c=>c.url.includes('/cms_admins')));assert(calls.some(c=>c.url.endsWith('/rpc/crm_staff')&&c.options.headers.Authorization==='Bearer test-token'));
const signedOut=await run('logout',{cookie:'aura_crm_session=test-token'});assert(signedOut.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')));
console.log('PASS: server rejects anonymous, non-admin and cross-origin requests; rechecks role for reads; HttpOnly secure session; sign-out clears cookies.');
