import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
for(const file of await readdir('dist'))if(file.endsWith('.js')){const result=spawnSync(process.execPath,['--check','dist/'+file],{encoding:'utf8'});if(result.status)throw Error(result.stderr);}
const html=await readFile('dist/index.html','utf8');let count=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|type="module"/.test(match[1])){new vm.Script(match[2]);count++;}
if(!html.includes('cms-bridge.js'))throw Error('CMS bridge missing');
console.log('Checked CMS JavaScript and '+count+' original prototype scripts.');
