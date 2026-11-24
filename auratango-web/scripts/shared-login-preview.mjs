// Local-only shared-session browser fixture. Never connects to a real account.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHandler} from '../../api/crm.mjs';
const root=path.resolve('dist'),port=4189;
const content={draft:{edits:{},theme:{}},published:{edits:{},theme:{}}};
const empty={leads:[],classes:[],bookings:[],students:[],memberships:[],history:[]};
const fetcher=async(url,options={})=>{
 if(url.includes('grant_type=password')){const credentials=JSON.parse(options.body);return credentials.email==='staff@example.invalid'&&credentials.password==='demo-only'?Response.json({access_token:'fixture-session',refresh_token:'fixture-refresh',expires_in:3600}):Response.json({message:'Invalid test credentials'},{status:400});}
 if(url.endsWith('/auth/v1/user'))return options.headers.Authorization==='Bearer fixture-session'?Response.json({id:'fixture-owner'}):Response.json({message:'Not signed in'},{status:401});
 if(url.includes('/cms_admins'))return Response.json([{user_id:'fixture-owner'}]);
 if(url.includes('/private_teacher_access'))return Response.json([]);
 if(url.includes('/site_content')){if(options.method==='PATCH')content.published=JSON.parse(options.body).published;return Response.json([{published:content.published}]);}
 if(url.includes('/site_drafts')){if(options.method==='PATCH')content.draft=JSON.parse(options.body).draft;return Response.json([{draft:content.draft}]);}
 if(url.includes('/private_lesson_settings'))return Response.json([]);
 if(url.includes('/rpc/crm_staff'))return Response.json(empty);
 return Response.json({});
};
const config={supabaseUrl:`http://127.0.0.1:${port}/provider`,supabaseKey:'sb_publishable_fixture'};
const handler=createHandler({fetcher,readPage:()=>fs.readFile(path.join(root,'dashboard.html'),'utf8'),env:{SUPABASE_URL:config.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:config.supabaseKey}});
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/crm'||url.pathname==='/dashboard')return handler(req,res);
 if(url.pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.AURA_CONFIG='+JSON.stringify(config)+';');}
 if(url.pathname.startsWith('/provider/')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify([{published:content.published}]));}
 try{const file=path.resolve(root,'.'+(url.pathname==='/backstage'?'/backstage.html':url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error('Outside root');const body=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(body);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Isolated shared-login preview: http://127.0.0.1:'+port+'/backstage'));
