export const trialTypes=[['ladies','Ladies’ Solo'],['couples','Couple groups'],['solo','Solo partner groups']];
export function trialClassType(type){
 const name=String(type||'').toLowerCase();
 if(name.includes('ladies'))return 'ladies';
 if(name.includes('couple'))return 'couples';
 if(name.includes('single')||name.includes('solo partner'))return 'solo';
 return 'other';
}
export function trialsForDay(data,date,dayOf,type=''){
 const classes=new Map(data.classes.filter(c=>!c.cancelled&&dayOf(c.starts_at)===date).map(c=>[c.id,c]));
 return data.bookings.filter(b=>b.status==='Booked'&&b.lead_id&&classes.has(b.class_id)&&(!type||trialClassType(classes.get(b.class_id).class_type)===type));
}
export const trialLeadCount=bookings=>new Set(bookings.map(b=>b.lead_id)).size;
