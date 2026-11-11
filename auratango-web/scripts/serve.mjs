import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {parseEnv} from 'node:util';

const {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
 throw new Error('.env.local must contain SUPABASE_URL and a Supabase publishable key.');
}
const browserConfig = JSON.stringify({supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_PUBLISHABLE_KEY});
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{
 if (new URL(req.url, 'http://localhost').pathname === '/config.js') {
  res.writeHead(200, {'Content-Type': types['.js'], 'Cache-Control': 'no-store'});
  res.end('window.AURA_CONFIG = ' + browserConfig + ';');
  return;
 }
 try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/admin/' || url.pathname==='/admin.html'){res.writeHead(302,{Location:'/admin'+url.search});res.end();return;}const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname==='/admin'?'/admin.html':url.pathname==='/simple'?'/simple.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
