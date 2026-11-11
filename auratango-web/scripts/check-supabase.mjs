import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const {SUPABASE_URL: supabaseUrl, SUPABASE_PUBLISHABLE_KEY: supabaseKey} =
  parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
const headers={apikey:supabaseKey};
const published=await fetch(supabaseUrl+'/rest/v1/site_content?id=eq.main&select=published',{headers});
if(!published.ok)throw Error('Published content read failed: '+published.status);
const rows=await published.json();if(rows.length!==1)throw Error('Published document missing');
const drafts=await fetch(supabaseUrl+'/rest/v1/site_drafts?select=id',{headers});
if(![401,403].includes(drafts.status))throw Error('Anonymous draft access was not denied: '+drafts.status);
const admins=await fetch(supabaseUrl+'/rest/v1/cms_admins?select=user_id',{headers});
if(![401,403].includes(admins.status))throw Error('Anonymous admin access was not denied: '+admins.status);
console.log('Supabase verified: public content readable; drafts and admin membership inaccessible anonymously.');
