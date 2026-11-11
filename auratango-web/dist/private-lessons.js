export const teacherNames = {rick:'Rick Daniel', anna:'Anna Daniel'};
export const rateFields = {trial:'trial_grosz', package4:'package4_grosz', package8:'package8_grosz'};

const warsawClock = new Intl.DateTimeFormat('en-GB', {
  timeZone:'Europe/Warsaw', year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', hourCycle:'h23'
});

export function warsawLocalTime(date) {
  const parts = Object.fromEntries(warsawClock.formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function warsawToIso(localTime) {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(localTime)) return null;
  const wallClock = Date.parse(localTime+'Z');
  if (!Number.isFinite(wallClock)) return null;
  let guess = wallClock;
  for (let i=0; i<3; i++) {
    const displayed = warsawLocalTime(new Date(guess));
    if (displayed === localTime) return new Date(guess).toISOString();
    guess += wallClock-Date.parse(displayed+'Z');
  }
  return null;
}

export function priceToGrosz(value) {
  if (value === '') return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return NaN;
  const grosz = Math.round(Number(value)*100);
  return grosz <= 10000000 ? grosz : NaN;
}

export function privateLessonCatalog(rows) {
  return Object.fromEntries(rows.filter(row=>Object.hasOwn(teacherNames,row.teacher)).map(row=>[
    row.teacher,
    {
      times:row.schedule_managed
        ? [...new Set(row.available_times.map(time=>Date.parse(time)).filter(Number.isFinite)
          .sort((a,b)=>a-b).map(time=>warsawLocalTime(new Date(time))))]
        : null,
      prices:Object.fromEntries(Object.entries(rateFields).map(([option,field])=>[option,row[field] ?? null]))
    }
  ]));
}
