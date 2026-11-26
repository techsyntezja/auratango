import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('dist/index.html','utf8');
const start=source.indexOf('// Personal account reflects the current class');
const end=source.indexOf('/* Source media and editorial narrative retained;',start);
assert(start>=0&&end>start);
const context={
 V:{orders:[{id:'order',request:'paid',target:'private',created:'2026-11-27T10:00:00Z',total:200}],requests:[{id:'paid',fullName:'Test Dancer',email:'dancer@example.invalid'},{id:'pending',status:'offered',directPrivate:true}],wallet:[],bookings:[]},
 state:{member:true},L:en=>en,T:en=>en,W:key=>key,ESC:value=>String(value??'').replaceAll('<','&lt;'),I:()=>'',
 warsawDateTime:()=> '2026-11-27T12:00',itemTitle:()=> 'Private classes',money:value=>value+' zł',dateLabel:value=>value||'',
 A:(path,label)=>'<a href="#'+path+'">'+label+'</a>',plainCard:(title,body,action)=>'<article>'+title+body+action+'</article>',
 memberRequests:()=>'<a href="#/invitation/pending">Review invitation</a>',memberClasses:()=> 'Classes',purchasedPackageCard:()=> 'Package details',studioAddressLink:()=> 'Studio'
};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
assert.deepEqual(JSON.parse(JSON.stringify(context.memberIdentity())),{name:'Test Dancer',email:'dancer@example.invalid',phone:''});
assert(!context.memberNav().some(([key])=>['community','progress'].includes(key)));
context.V.bookings=[{status:'confirmed',date:'2026-11-26',time:'14:00'},{status:'confirmed',date:'2026-11-28',time:'13:00'},{status:'cancelled',date:'2026-11-29',time:'13:00'}];
assert.equal(context.memberUpcoming().length,1);
assert.equal(context.memberPassUsable({remaining:2,validThrough:'2026-11-26'}),false);
assert.equal(context.memberPassUsable({remaining:2,validThrough:'2026-12-20'}),true);
assert.equal(context.memberPassUsable({remaining:0,validThrough:'2026-12-20'}),false);
assert(context.memberRequests().includes('href="#/checkout/pending"'));
for(const page of [context.memberHome(),context.memberPurchases(),context.memberAccount(),context.memberShell('community')]){
 assert(!page.includes('href="#/community"'));
 assert(!page.includes('partner-night'));
 assert(!page.includes('community member'));
}
assert(context.memberPurchases().includes('200 zł'));
assert(context.memberAccount().includes('dancer@example.invalid'));
console.log('PASS: account identity, active passes, upcoming classes, checkout links, purchases and paused community navigation.');
