import {loadPrivateLessons, savePrivateLessons} from './cms-api.js';
import {priceToGrosz, rateFields, teacherNames, warsawLocalTime, warsawToIso} from './private-lessons.js';

const $ = selector => document.querySelector(selector);
const rowEdits = new Map();
let access;
let rows = [];

export const hasUnsavedTeacherSettings = () => rowEdits.size > 0;

function selectedTeacher() {
  return access.teacher || $('#teacher-settings-person').value;
}

function currentSettings() {
  const teacher = selectedTeacher();
  return rowEdits.get(teacher) || rows.find(row => row.teacher === teacher);
}

function renderSlots(settings) {
  const slots = settings.available_times.filter(time=>Date.parse(time)>Date.now()).sort((a,b)=>Date.parse(a)-Date.parse(b));
  $('#teacher-slots-empty').hidden = slots.length > 0;
  $('#teacher-slots').replaceChildren(...slots.map(time => {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = warsawLocalTime(new Date(time)).replace('T',' · ');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label',`Remove ${label.textContent}`);
    remove.onclick = () => {
      const edited = {...currentSettings(), available_times:currentSettings().available_times.filter(slot=>slot!==time)};
      rowEdits.set(edited.teacher,edited);
      renderSlots(edited);
      announce('Time removed. Save settings to update the website.');
    };
    row.append(label,remove);
    return row;
  }));
}

function showTeacher() {
  const settings = currentSettings();
  if (!settings) return;
  $('#teacher-settings-form').hidden = false;
  $('#teacher-slot-time').value = '';
  $('#teacher-slot-time').min = warsawLocalTime(new Date());
  $('#teacher-managed').checked = settings.schedule_managed;
  for (const field of Object.values(rateFields)) {
    const price = settings[field];
    $(`[name="${field}"]`).value = typeof price === 'string' ? price : price == null ? '' : (price/100).toFixed(2);
  }
  renderSlots(settings);
}

function announce(message) {
  $('#teacher-settings-status').textContent = message;
}

export async function openTeacherPanel(workspace) {
  if (access) return;
  access = workspace;
  $('#teacher-settings-picker').hidden = !access.admin;
  $('#teacher-settings-title').textContent = access.teacher ? `${teacherNames[access.teacher]} · Timetable & pricing` : 'Private lessons · Timetable & pricing';
  announce('Loading teacher settings…');
  try {
    rows = await loadPrivateLessons();
    if (!currentSettings()) throw new Error('No settings were found for this teacher.');
    showTeacher();
    announce(access.preview ? 'Local preview. Changes stay in this tab.' : 'Saved settings appear on the public site.');
  } catch (error) {
    access = null;
    announce(error.message);
  }
}

$('#teacher-settings-person').onchange = showTeacher;
$('#teacher-settings-form').addEventListener('input', event => {
  const field = event.target.name;
  const settings = currentSettings();
  if (field === 'schedule_managed') {
    rowEdits.set(settings.teacher,{...settings,[field]:event.target.checked});
  } else if (Object.values(rateFields).includes(field)) {
    rowEdits.set(settings.teacher,{...settings,[field]:event.target.value});
  }
});

$('#teacher-add-slot').onclick = () => {
  const field = $('#teacher-slot-time');
  const time = warsawToIso(field.value);
  const settings = currentSettings();
  if (!time || Date.parse(time)<=Date.now()) return announce('Choose a valid future date and time in Warsaw.');
  const futureTimes = settings.available_times.filter(slot=>Date.parse(slot)>Date.now());
  if (futureTimes.some(slot=>Date.parse(slot)===Date.parse(time))) return announce('That start time is already listed.');
  if (futureTimes.length>=250) return announce('Remove a time before adding another.');
  const edited = {...settings,available_times:[...futureTimes,time]};
  rowEdits.set(edited.teacher,edited);
  field.value = '';
  renderSlots(edited);
  announce('Time added. Save settings to update the website.');
};

$('#teacher-settings-form').onsubmit = async event => {
  event.preventDefault();
  const settings = currentSettings();
  const updates = {schedule_managed:settings.schedule_managed,available_times:settings.available_times.filter(time=>Date.parse(time)>Date.now())};
  for (const field of Object.values(rateFields)) {
    const price = priceToGrosz($(`[name="${field}"]`).value);
    if (Number.isNaN(price)) return announce('Enter a price between 0 and 100,000 zł with up to two decimal places.');
    updates[field] = price;
  }
  const fieldset = $('#teacher-settings-fields');
  const picker = $('#teacher-settings-person');
  fieldset.disabled = picker.disabled = true;
  try {
    const saved = access.preview ? {...settings,...updates} : await savePrivateLessons(settings.teacher,settings.revision,updates);
    rows = rows.map(row=>row.teacher===saved.teacher?saved:row);
    rowEdits.delete(saved.teacher);
    showTeacher();
    announce(access.preview ? 'Saved for this preview only.' : 'Saved. Visitors will see these times and prices.');
  } catch (error) {
    announce(error.message);
  } finally {
    fieldset.disabled = picker.disabled = false;
  }
};
