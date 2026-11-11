const messages = {
  en: {
    subject:'Your AuraTango booking is confirmed', intro:'Your payment is complete. We look forward to seeing you at AuraTango.',
    reference:'Booking reference', programme:'Class', date:'First session · Warsaw time', teacher:'Teacher / host',
    venue:'Location', sessions:'Sessions', participants:'Participants', amount:'Amount paid', closing:'See you on the dance floor,\nAuraTango'
  },
  pl: {
    subject:'Twoja rezerwacja w AuraTango jest potwierdzona', intro:'Płatność została zakończona. Do zobaczenia w AuraTango!',
    reference:'Numer rezerwacji', programme:'Zajęcia', date:'Pierwsze zajęcia · czas warszawski', teacher:'Osoba prowadząca',
    venue:'Miejsce', sessions:'Liczba zajęć', participants:'Uczestnicy', amount:'Zapłacona kwota', closing:'Do zobaczenia na parkiecie,\nAuraTango'
  },
  ru: {
    subject:'Ваша запись в AuraTango подтверждена', intro:'Оплата прошла. Ждём вас в AuraTango!',
    reference:'Номер записи', programme:'Занятие', date:'Первое занятие · время Варшавы', teacher:'Преподаватель / ведущий',
    venue:'Место', sessions:'Количество занятий', participants:'Участники', amount:'Оплачено', closing:'До встречи на танцполе,\nAuraTango'
  },
  uk: {
    subject:'Ваш запис до AuraTango підтверджено', intro:'Оплату завершено. Чекаємо на вас в AuraTango!',
    reference:'Номер запису', programme:'Заняття', date:'Перше заняття · час Варшави', teacher:'Викладач / ведучий',
    venue:'Місце', sessions:'Кількість занять', participants:'Учасники', amount:'Сплачено', closing:'До зустрічі на танцмайданчику,\nAuraTango'
  }
};

export function bookingConfirmationEmail(order, programme, language) {
  const locale = Object.hasOwn(messages, language) ? language : 'en';
  const t = messages[locale];
  const date = new Intl.DateTimeFormat(locale, {dateStyle:'long', timeZone:'UTC'})
    .format(new Date(`${order.date}T12:00:00Z`));
  const amount = new Intl.NumberFormat(locale, {style:'currency', currency:'PLN'}).format(order.total);
  const location = [order.venue, order.address].filter(Boolean).join(' · ');
  const details = [
    [t.reference, order.id], [t.programme, programme], [t.date, `${date} · ${order.time}`],
    [t.teacher, order.quote?.teacher], [t.venue, location], [t.sessions, order.quote?.lessons],
    [t.participants, order.people], [t.amount, amount]
  ].filter(([, value]) => value != null && value !== '');
  return {
    subject: t.subject,
    text: [t.intro, '', ...details.map(([label, value]) => `${label}: ${value}`), '', t.closing].join('\n')
  };
}
