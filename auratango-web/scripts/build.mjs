import {writeFile} from 'node:fs/promises';
const supabaseUrl=process.env.SUPABASE_URL||'';
const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';
if(supabaseKey && !supabaseKey.startsWith('sb_publishable_'))throw new Error('SUPABASE_PUBLISHABLE_KEY must be a public publishable key.');
await writeFile(new URL('../dist/config.js',import.meta.url),'window.AURA_CONFIG = '+JSON.stringify({supabaseUrl,supabaseKey})+';\n');
console.log('Static website ready in auratango-web/dist');
