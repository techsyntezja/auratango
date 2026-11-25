export function warsawClassDay(value){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
export function scheduleClasses(classes,date=''){
 return classes.filter(item=>!item.cancelled&&(!date||warsawClassDay(item.starts_at)===date)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
}
