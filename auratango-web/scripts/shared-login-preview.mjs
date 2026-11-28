// Local-only shared-session browser fixture. Never connects to a real account.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHandler} from '../../api/crm.mjs';
import {createMemberHandler} from '../../api/member.mjs';
import {discountPreviewEngine} from './discount-preview-engine.mjs';
const root=path.resolve('dist'),port=4189;
const content={draft:{edits:{},theme:{}},published:{edits:{},theme:{}}};
const empty={leads:[],classes:[],bookings:[],students:[],memberships:[],history:[]};
if(process.argv.includes('--schedule-data'))empty.classes=[
 {id:'fixture-25',group_name:'Newborn',class_type:'Partner groups',starts_at:'2026-11-25T14:00:00Z',ends_at:'2026-11-25T15:15:00Z',instructor:'Fixture teacher',room:'Test room',capacity:12},
 {id:'fixture-26',group_name:'Toddler',class_type:'Ladies Solo',starts_at:'2026-11-26T09:00:00Z',ends_at:'2026-11-26T11:00:00Z',instructor:'Fixture teacher',room:'Test room',capacity:12}
];
await fs.mkdir('tmp',{recursive:true});
const fixtureDiscounts=await fs.readFile('tmp/preview-discounts.json','utf8').then(JSON.parse).catch(()=>[]);
const saveFixtureDiscounts=()=>fs.writeFile('tmp/preview-discounts.json',JSON.stringify(fixtureDiscounts));
const discountEngine=discountPreviewEngine(fixtureDiscounts);
const fetcher=async(url,options={})=>{
 if(url.includes('grant_type=password')){const credentials=JSON.parse(options.body);return credentials.email==='staff@example.invalid'&&credentials.password==='demo-only'?Response.json({access_token:'fixture-session',refresh_token:'fixture-refresh',expires_in:3600}):Response.json({message:'Invalid test credentials'},{status:400});}
 if(url.endsWith('/auth/v1/user'))return options.headers.Authorization==='Bearer fixture-session'?Response.json({id:'fixture-owner'}):Response.json({message:'Not signed in'},{status:401});
 if(url.includes('/cms_admins'))return Response.json([{user_id:'fixture-owner'}]);
 if(url.includes('/private_teacher_access'))return Response.json([]);
 if(url.includes('/site_content')){if(options.method==='PATCH')content.published=JSON.parse(options.body).published;return Response.json([{published:content.published}]);}
 if(url.includes('/site_drafts')){if(options.method==='PATCH')content.draft=JSON.parse(options.body).draft;return Response.json([{draft:content.draft}]);}
 if(url.includes('/private_lesson_settings'))return Response.json([]);
 if(url.includes('/rpc/crm_discounts')){const {p_action,p_data}=JSON.parse(options.body);if(p_action==='discount_list')return Response.json(fixtureDiscounts);if(p_action==='discount_save'){const id=p_data.id||crypto.randomUUID();const index=fixtureDiscounts.findIndex(d=>d.id===id);const row={...p_data,id,...(index>=0?{used_at:fixtureDiscounts[index].used_at,used_order:fixtureDiscounts[index].used_order,used_signature:fixtureDiscounts[index].used_signature,used_quote:fixtureDiscounts[index].used_quote}:{}),months:p_data.months?Number(p_data.months):null,created_at:new Date().toISOString()};if(index<0)fixtureDiscounts.push(row);else fixtureDiscounts[index]=row;await saveFixtureDiscounts();return Response.json({id});}const row=fixtureDiscounts.find(d=>d.id===p_data.id);row.enabled=p_data.enabled;await saveFixtureDiscounts();return Response.json({id:row.id});}
 if(url.includes('/rpc/crm_staff'))return Response.json(empty);
 return Response.json({});
};
const config={supabaseUrl:`http://127.0.0.1:${port}/provider`,supabaseKey:'sb_publishable_fixture',localDiscountPreview:true};
const handler=createHandler({fetcher,readPage:()=>fs.readFile(path.join(root,'dashboard.html'),'utf8'),env:{SUPABASE_URL:config.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:config.supabaseKey}});
const memberTokens=new Map(),memberCodes=new Set();
const memberFetcher=async(url,options={})=>{
 const body=options.body?JSON.parse(options.body):{};
 if(url.endsWith('/otp')){memberCodes.add(body.email);return Response.json({});}
 if(url.endsWith('/verify')){if(body.token!=='123456'||!memberCodes.has(body.email))return Response.json({message:'Invalid or expired verification code.'},{status:403});memberCodes.delete(body.email);const token=crypto.randomUUID();memberTokens.set(token,body.email);return Response.json({access_token:token,refresh_token:token,expires_in:3600});}
 if(url.includes('grant_type=refresh_token')){if(!memberTokens.has(body.refresh_token))return Response.json({message:'Expired session'},{status:401});return Response.json({access_token:body.refresh_token,refresh_token:body.refresh_token,expires_in:3600});}
 const token=options.headers.Authorization?.slice(7),email=memberTokens.get(token);
 if(url.includes('/logout')){memberTokens.delete(token);return Response.json({});}
 if(url.endsWith('/user')&&email)return Response.json({id:'local-'+email,email,email_confirmed_at:new Date().toISOString()});
 return Response.json({message:'Sign in required'},{status:401});
};
const memberHandler=createMemberHandler({fetcher:memberFetcher,env:{SUPABASE_URL:'http://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},preview:true});
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/member')return memberHandler(req,res);
 if(url.pathname==='/api/discount-preview'){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'||req.headers.origin!=='http://'+req.headers.host){res.statusCode=403;return res.end(JSON.stringify({valid:false}));}
  try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4000)throw Error('Too large');}const body=JSON.parse(raw);const result=body.action==='quote'?discountEngine.quote(body):body.action==='redeem'?discountEngine.redeem(body):{valid:false};if(body.action==='redeem'&&result.valid)await saveFixtureDiscounts();return res.end(JSON.stringify(result));}catch{res.statusCode=400;return res.end(JSON.stringify({valid:false}));}
 }
 if(url.pathname==='/api/crm'||url.pathname==='/dashboard')return handler(req,res);
 if(url.pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.AURA_CONFIG='+JSON.stringify(config)+';');}
 if(url.pathname.startsWith('/provider/')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify([{published:content.published}]));}
 try{const file=path.resolve(root,'.'+(url.pathname==='/backstage'?'/backstage.html':url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error('Outside root');const body=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.mp4')?'video/mp4':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(body);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Isolated shared-login preview: http://127.0.0.1:'+port+'/backstage'));
