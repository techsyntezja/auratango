const toggle = document.querySelector('.film-toggle');
const film = document.getElementById('tango-film');
const player = document.getElementById('tango-player');
const language = document.getElementById('language');
const storageKey = 'auratango-crimson-v3';
const languages = ['en', 'pl', 'ru', 'uk'];
const copy = {
  about: ['About', 'O szkole', 'О школе', 'Про школу'],
  schedule: ['Timetable', 'Grafik', 'Расписание', 'Розклад'],
  contact: ['Contact', 'Kontakt', 'Контакты', 'Контакти'],
  location: ['AURATANGO / WARSAW', 'AURATANGO / WARSZAWA', 'AURATANGO / ВАРШАВА', 'AURATANGO / ВАРШАВА'],
  headline: ['Dance tango.', 'Zatańcz tango.', 'Танцуй танго.', 'Танцюй танго.'],
  intro: ['Learn Argentine tango with Rick and Anna Daniel in Warsaw. Come on your own or with a partner.', 'Ucz się tanga argentyńskiego z Rickiem i Anną Daniel w Warszawie. Przyjdź solo lub z partnerem.', 'Учитесь аргентинскому танго с Риком и Анной Даниэль в Варшаве. Приходите самостоятельно или в паре.', 'Вивчайте аргентинське танго з Ріком та Анною Даніель у Варшаві. Приходьте самі або в парі.'],
  start: ['Find your class', 'Znajdź zajęcia', 'Выбрать занятия', 'Обрати заняття'],
  school: ['An Argentine tango school and community in Warsaw, led by Rick and Anna Daniel.', 'Warszawska szkoła i społeczność tanga argentyńskiego prowadzona przez Ricka i Annę Daniel.', 'Школа и сообщество аргентинского танго в Варшаве под руководством Рика и Анны Даниэль.', 'Школа та спільнота аргентинського танго у Варшаві під керівництвом Ріка й Анни Даніель.'],
  classes: ['Classes', 'Zajęcia', 'Занятия', 'Заняття'],
  formats: ['Partnered tango, Ladies’ Solo, and private classes.', 'Tango w parach, Ladies’ Solo i zajęcia indywidualne.', 'Танго в паре, Ladies’ Solo и индивидуальные занятия.', 'Танго в парі, Ladies’ Solo та індивідуальні заняття.'],
  venues: ['Locations and contact details', 'Lokalizacje i dane kontaktowe', 'Адреса и контакты', 'Адреси та контакти'],
  full: ['Full AuraTango site ↗', 'Pełna strona AuraTango ↗', 'Полный сайт AuraTango ↗', 'Повний сайт AuraTango ↗'],
  youtube: ['Watch on YouTube ↗', 'Obejrzyj na YouTube ↗', 'Смотреть на YouTube ↗', 'Дивитися на YouTube ↗'],
  watch: ['▶ Watch tango', '▶ Zobacz tango', '▶ Смотреть танго', '▶ Дивитися танго'],
  close: ['Close video', 'Zamknij film', 'Закрыть видео', 'Закрити відео'],
  video: ['Argentine tango — school film', 'Tango argentyńskie — film szkoły', 'Аргентинское танго — видео школы', 'Аргентинське танго — відео школи'],
  language: ['Language', 'Język', 'Язык', 'Мова'],
  navigation: ['Main navigation', 'Nawigacja główna', 'Главное меню', 'Головне меню'],
  title: ['Argentine tango in Warsaw', 'Tango argentyńskie w Warszawie', 'Аргентинское танго в Варшаве', 'Аргентинське танго у Варшаві']
};

const translate = key => copy[key][languages.indexOf(language.value)];

function updateLanguage() {
  document.documentElement.lang = language.value;
  document.title = 'AuraTango · ' + translate('title');
  for (const element of document.querySelectorAll('[data-copy]')) {
    element.textContent = translate(element.dataset.copy);
  }
  language.setAttribute('aria-label', translate('language'));
  document.querySelector('nav').setAttribute('aria-label', translate('navigation'));
  toggle.textContent = translate(film.hidden ? 'watch' : 'close');
  const video = player.querySelector('iframe');
  if (video) video.title = translate('video');
}

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (languages.includes(saved?.lang)) language.value = saved.lang;
} catch {
  // The page still works without browser storage.
}
updateLanguage();
language.addEventListener('change', () => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    localStorage.setItem(storageKey, JSON.stringify({ ...saved, lang: language.value }));
  } catch {
    // Apply the language for the current page even when storage is unavailable.
  }
  updateLanguage();
});

toggle.addEventListener('click', () => {
  const opening = film.hidden;
  film.hidden = !opening;
  toggle.setAttribute('aria-expanded', String(opening));
  toggle.textContent = translate(opening ? 'close' : 'watch');

  if (!opening) {
    player.replaceChildren();
    return;
  }

  const video = document.createElement('iframe');
  video.title = translate('video');
  video.src = 'https://www.youtube-nocookie.com/embed/9x2Y9Bw7Wio?autoplay=1&mute=1&playsinline=1';
  video.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  video.allowFullscreen = true;
  player.append(video);
});
