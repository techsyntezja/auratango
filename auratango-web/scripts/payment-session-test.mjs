import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('dist/index.html','utf8');let saved=0;const ctx={saveV:()=>saved++,Date,Number,Math};vm.createContext(ctx);
for(const name of ['paymentTimeRemaining','ensurePackagePaymentDeadline','packageValidityDates']){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);vm.runInContext(html.slice(start,end),ctx);}
const request={};const expiry=ctx.ensurePackagePaymentDeadline(request,1000);assert.equal(expiry,601000);assert.equal(saved,1);assert.equal(ctx.paymentTimeRemaining(expiry,1000),600);assert.equal(ctx.paymentTimeRemaining(expiry,600000),1);assert.equal(ctx.paymentTimeRemaining(expiry,601000),0);assert.equal(ctx.paymentTimeRemaining(expiry,900000),0);assert.equal(ctx.ensurePackagePaymentDeadline(request,700000),expiry);assert.equal(saved,1);assert.equal(ctx.paymentTimeRemaining(NaN,1000),0);
assert.equal(ctx.packageValidityDates('2026-11-28',1).last,'2026-12-25');assert.equal(ctx.packageValidityDates('2026-11-28',3).last,'2027-02-19');
console.log('PASS: 10-minute deadline persists without extending, expires at zero, and package dates count from the chosen first class.');

let clock=1000,expiredUpdates=0,quotes=0;
const error={textContent:''},payButton={disabled:false};
const guarded={Date:{now:()=>clock},Number,Math,L:en=>en,document:{getElementById:id=>id==='pay-error'?error:id==='pay-now'?payButton:null},U:{pay:{request:'test',quoteVersion:'v1',busy:false}},V:{requests:[{id:'test',directPackage:true,status:'offered',paymentExpiresAt:2000,quote:{version:'v1',price:260}}],orders:[],wallet:[]},updatePackagePaymentClock:()=>expiredUpdates++,packageDiscountQuote:async()=>{quotes++;clock=3000;return {valid:true,total:260};}};
vm.createContext(guarded);
for(const name of ['paymentTimeRemaining']){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);vm.runInContext(html.slice(start,end),guarded);}
const completeStart=html.indexOf('async function completePackagePayment('),completeEnd=html.indexOf('function paymentPage(',completeStart);vm.runInContext(html.slice(completeStart,completeEnd),guarded);
clock=2000;await guarded.completePackagePayment('test');assert.equal(quotes,0);assert.equal(guarded.V.orders.length,0);assert.equal(expiredUpdates,1);
clock=1000;await guarded.completePackagePayment('test');assert.equal(quotes,1);assert.equal(guarded.V.orders.length,0);assert.equal(guarded.U.pay.busy,false);assert.equal(expiredUpdates,2);
console.log('PASS: expired sessions and sessions expiring during quote validation cannot create orders or passes.');
