import {trialClassType} from './crm-trials.js';
export function warsawDay(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function shiftDay(value,amount){const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);}
const rate=(n,d)=>d?Math.round(n/d*100):null;
export function buildAnalytics(data,{from,to},now=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>to)throw Error('Choose a valid start and end date.');
 if([from,to].some(value=>new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value))throw Error('Choose valid calendar dates.');
 const span=(Date.parse(to)-Date.parse(from))/86400000;if(span>3660)throw Error('Choose a date range of ten years or less.');
 const inRange=value=>{if(!value)return false;const date=warsawDay(value);return date>=from&&date<=to;};
 const currentDay=warsawDay(now),leads=data.leads.filter(l=>inRange(l.created_at)),classes=data.classes.filter(c=>!c.cancelled&&inRange(c.starts_at));
 const classMap=new Map(classes.map(c=>[c.id,c])),bookings=data.bookings.filter(b=>classMap.has(b.class_id));
 const active=bookings.filter(b=>b.status==='Booked'),trials=active.filter(b=>b.lead_id),completed=active.filter(b=>new Date(classMap.get(b.class_id).ends_at)<=now);
 const recorded=completed.filter(b=>['Present','Absent','No-show'].includes(b.attendance)),present=recorded.filter(b=>b.attendance==='Present').length,noShows=recorded.filter(b=>b.attendance==='No-show').length;
 const converted=l=>Boolean(l.student_id||l.status==='Converted');
 const leadBookings=new Map();for(const b of data.bookings){if(!b.lead_id)continue;const list=leadBookings.get(b.lead_id)||[];list.push(b);leadBookings.set(b.lead_id,list);}
 const leadEvents=new Map();for(const h of data.history){if(!h.lead_id)continue;const list=leadEvents.get(h.lead_id)||[];list.push(h);leadEvents.set(h.lead_id,list);}
 const reached=l=>{const booked=leadBookings.get(l.id)||[],events=leadEvents.get(l.id)||[],conversion=converted(l);const attended=l.status==='Trial Attended'||booked.some(b=>b.attendance==='Present')||events.some(h=>h.event==='attendance'&&h.detail.endsWith('→ Present'));const trial=attended||l.status==='Trial Booked'||booked.length>0||events.some(h=>h.event==='Booking');return {contacted:trial||l.status==='Contacted'||events.some(h=>h.detail?.includes('→ Contacted')),trial,attended,conversion};};
 const funnel=[['Inquiries',leads.length],['Contacted',leads.filter(l=>reached(l).contacted).length],['Trial booked',leads.filter(l=>reached(l).trial).length],['Trial attended',leads.filter(l=>reached(l).attended).length],['Converted',leads.filter(converted).length]];
 const sources=[...new Set(leads.map(l=>l.source||'Unknown'))].map(source=>{const group=leads.filter(l=>(l.source||'Unknown')===source),conversions=group.filter(converted).length;return {source,leads:group.length,converted:conversions,rate:rate(conversions,group.length)};}).sort((a,b)=>b.leads-a.leads);
 const groups=[['ladies','Ladies’ Solo'],['couples','Couple groups'],['solo','Solo partner groups'],['other','Private / other classes']].map(([id,label])=>{const groupClasses=classes.filter(c=>trialClassType(c.class_type)===id),ids=new Set(groupClasses.map(c=>c.id)),groupBookings=active.filter(b=>ids.has(b.class_id)),capacity=groupClasses.reduce((sum,c)=>sum+c.capacity,0);return {id,label,classes:groupClasses.length,booked:groupBookings.length,capacity,trials:groupBookings.filter(b=>b.lead_id).length,occupancy:rate(groupBookings.length,capacity)};});
 const periodMemberships=data.memberships.filter(m=>inRange(m.created_at)),activeMemberships=data.memberships.filter(m=>m.starts_on<=currentDay&&m.expires_on>=currentDay&&m.remaining_sessions>0);
 const bucket=value=>warsawDay(value).slice(0,span>60?7:10),trend=new Map();
 for(let date=from;date<=to;date=shiftDay(date,1)){const key=date.slice(0,span>60?7:10);if(!trend.has(key))trend.set(key,{date:key,leads:0,trials:0});}
 for(const l of leads)trend.get(bucket(l.created_at)).leads++;
 for(const b of trials)trend.get(bucket(classMap.get(b.class_id).starts_at)).trials++;
 const capacity=classes.reduce((sum,c)=>sum+c.capacity,0);
 return {from,to,currentDay,leadCount:leads.length,converted:leads.filter(converted).length,conversion:rate(leads.filter(converted).length,leads.length),trialCount:trials.length,
 attendance:rate(present,recorded.length),noShowRate:rate(noShows,recorded.length),present,noShows,absent:recorded.filter(b=>b.attendance==='Absent').length,pending:completed.length-recorded.length,
 occupancy:rate(active.length,capacity),booked:active.length,capacity,cancelled:bookings.filter(b=>b.status==='Cancelled').length,classCount:classes.length,
 newStudents:data.students.filter(s=>inRange(s.created_at)).length,memberships:periodMemberships.length,activeMembers:new Set(activeMemberships.map(m=>m.student_id)).size,
 expiring:activeMemberships.filter(m=>m.expires_on<=shiftDay(currentDay,30)).length,
 overdue:data.leads.filter(l=>l.follow_up&&l.follow_up<currentDay&&!['Converted','Closed'].includes(l.status)).length,
 funnel,sources,groups,trend:[...trend.values()],monthly:span>60};
}
