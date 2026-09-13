/* Режим — логика приложения. Без зависимостей, без сети.
   Все данные — в localStorage под ключами tracker.* */
(() => {
  'use strict';

  const APP_VERSION = '1.5.0';
  const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  const $ = (id) => document.getElementById(id);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pad = (n) => String(n).padStart(2, '0');
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ---------------- хранилище ---------------- */
  const KEYS = { checks: 'tracker.checks', variants: 'tracker.variants', settings: 'tracker.settings', meals: 'tracker.meals' };
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function persist(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('storage', e); }
  }
  const store = {
    checks: load(KEYS.checks, {}),      // { 'YYYY-MM-DD': { itemId: true } }
    variants: load(KEYS.variants, {}),  // { 'YYYY-MM-DD': { satEvening: true } }
    meals: load(KEYS.meals, {}),        // { 'YYYY-MM-DD': { itemId: optionIndex } }
    settings: Object.assign({ theme: 'light', notify: false }, load(KEYS.settings, {})) // светлая — основная
  };
  const saveChecks = () => persist(KEYS.checks, store.checks);
  const saveVariants = () => persist(KEYS.variants, store.variants);
  const saveMeals = () => persist(KEYS.meals, store.meals);
  const saveSettings = () => persist(KEYS.settings, store.settings);

  /* ---------------- даты ---------------- */
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => dateKey(new Date());
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

  /* ---------------- расписание для даты ---------------- */
  function itemsFor(dateK) {
    const d = parseKey(dateK);
    const dayKey = DAY_KEYS[d.getDay()];
    const base = (window.SCHEDULE[dayKey] || []).map((it, i) => ({ ...it, id: `${dayKey}:${i}` }));
    if (dayKey === 'saturday' && store.variants[dateK]?.satEvening) {
      window.SATURDAY_EVENING.forEach((it, i) => base.push({ ...it, id: `sat-eve:${i}` }));
      // ужин переносится после вечерней пары (дома ~21:40)
      const dinner = base.find((it) => it.mealId === 'dinner');
      if (dinner) { dinner.time = '22:00'; dinner.subtitle = 'после вечерней пары'; }
    }
    return base.sort((a, b) => toMin(a.time) - toMin(b.time));
  }
  const hasWorkout = (dateK) => itemsFor(dateK).some((it) => it.workoutId);
  const isChecked = (dateK, id) => !!store.checks[dateK]?.[id];
  function setChecked(dateK, id, val) {
    if (!store.checks[dateK]) store.checks[dateK] = {};
    if (val) store.checks[dateK][id] = true; else delete store.checks[dateK][id];
    if (Object.keys(store.checks[dateK]).length === 0) delete store.checks[dateK];
    saveChecks();
  }
  function progressFor(dateK) {
    const items = itemsFor(dateK);
    const done = items.filter((it) => isChecked(dateK, it.id)).length;
    return { done, total: items.length, ratio: items.length ? done / items.length : 0 };
  }
  const exId = (workoutId, i) => `w:${workoutId}:${i}`;

  /* ---------------- рационы ---------------- */
  const mealChoice = (dateK, itemId) => { const v = store.meals[dateK]?.[itemId]; return Number.isInteger(v) ? v : null; };
  function setMealChoice(dateK, itemId, idx) {
    if (!store.meals[dateK]) store.meals[dateK] = {};
    if (idx === null) delete store.meals[dateK][itemId]; else store.meals[dateK][itemId] = idx;
    if (Object.keys(store.meals[dateK]).length === 0) delete store.meals[dateK];
    saveMeals();
  }
  // «овсянка + яблоко + 2 яйца» → массив ингредиентов; «лаваш с курицей» — одна метка
  const mealParts = (text) => text.split(/\s\+\s/).map((s) => s.trim()).filter(Boolean);
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // ингредиент → ключ рецепта (null — готовить не нужно)
  function recipeFor(part) {
    for (const [re, key] of window.RECIPE_MATCH) if (re.test(part) && window.RECIPES[key]) return key;
    return null;
  }
  // метка ингредиента; если есть рецепт — с кнопкой «!»
  function ingrHtml(part, cls) {
    const r = recipeFor(part);
    const badge = r ? `<button class="rq" data-recipe="${r}" aria-label="Как готовить: ${escapeHtml(part)}">!</button>` : '';
    return `<span class="${cls}${r ? ' has-recipe' : ''}">${escapeHtml(part)}${badge}</span>`;
  }
  function mealMetaHtml(dateK, it) {
    const m = window.MEALS[it.mealId];
    if (!m) return '';
    const idx = mealChoice(dateK, it.id);
    const label = it.kind === 'study' ? 'Обед с собой' : 'Рацион';
    if (idx === null || !m.options[idx]) {
      return `<div class="meal-meta"><span class="pick">${label} · выбрать из ${m.options.length}</span></div>`;
    }
    return `<div class="meal-meta">${mealParts(m.options[idx]).map((p) => ingrHtml(p, 'ingr')).join('')}</div>`;
  }
  function workoutProgress(dateK, workoutId) {
    const w = window.WORKOUTS[workoutId];
    const total = w.exercises.length;
    const done = w.exercises.filter((_, i) => isChecked(dateK, exId(workoutId, i))).length;
    return { done, total, ratio: total ? done / total : 0 };
  }

  /* ---------------- статистика ---------------- */
  function streak() {
    let d = new Date();
    let n = 0;
    const t = progressFor(dateKey(d));
    if (!(t.total && t.done === t.total)) d = addDays(d, -1); // сегодня ещё не закончился — не ломает серию
    for (let i = 0; i < 3660; i++) {
      const p = progressFor(dateKey(d));
      if (p.total && p.done === p.total) { n++; d = addDays(d, -1); } else break;
    }
    return n;
  }
  function weekPercent() {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // 0 = понедельник
    let done = 0, total = 0;
    for (let i = 0; i <= dow; i++) {
      const p = progressFor(dateKey(addDays(today, i - dow)));
      done += p.done; total += p.total;
    }
    return total ? Math.round((done / total) * 100) : 0;
  }
  function workoutsThisMonth() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    let n = 0;
    for (let d = 1; d <= days; d++) {
      const k = dateKey(new Date(y, m, d));
      itemsFor(k).forEach((it) => { if (it.workoutId && isChecked(k, it.id)) n++; });
    }
    return n;
  }

  /* ---------------- тактильный отклик ---------------- */
  const hapticSwitch = $('hapticSwitch');
  function haptic() { try { hapticSwitch.click(); } catch { /* нет поддержки */ } }

  /* ---------------- тост ---------------- */
  const toastEl = $('toast');
  let toastTimer = null, toastAction = null;
  function toast(msg, { action, duration = 2200 } = {}) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.toggle('action', !!action);
    toastAction = action || null;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }
  toastEl.addEventListener('click', () => { if (toastAction) { toastAction(); toastEl.classList.remove('show'); } });

  /* ---------------- иконки ---------------- */
  const ICONS = {
    wake: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 7a5 5 0 0 1 5 5h-2a3 3 0 0 0-6 0H7a5 5 0 0 1 5-5Zm-1-5h2v3h-2V2Zm8.07 3.93 1.41 1.41-2.12 2.12-1.41-1.41 2.12-2.12ZM3.51 7.34l1.41-1.41 2.12 2.12-1.41 1.41-2.12-2.12ZM2 13h20v2H2v-2Zm3 4h14v2H5v-2Z"/></svg>',
    food: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 2h1.5v6H9V2h1.5v6H12V2h1.5v7a3.5 3.5 0 0 1-2.75 3.42V22h-2V12.42A3.5 3.5 0 0 1 6 9V2Zm11 0c-1.66 0-3 2.24-3 5v6h2v9h2V2h-1Z"/></svg>',
    workout: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M1 10h2v4H1v-4Zm3-2h3v8H4V8Zm13 0h3v8h-3V8Zm3 2h2v4h-2v-4ZM7 11h10v2H7v-2Z"/></svg>',
    shower: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2s-6 7.2-6 12a6 6 0 0 0 12 0c0-4.8-6-12-6-12Zm0 16a4 4 0 0 1-4-4h2a2 2 0 0 0 2 2v2Z"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5v-2H6V6h4V4Zm3 3-1.4 1.4 2.6 2.6H9v2h5.2l-2.6 2.6L13 17l5-5-5-5Z"/></svg>',
    study: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H3V4Zm18 0h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8V4Z"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m12 3 9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8Z"/></svg>',
    wind: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 3a9 9 0 1 0 7 14.6A8 8 0 0 1 14 3Z"/></svg>',
    sleep: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 5h2v7h6V7h5a4 4 0 0 1 4 4v8h-2v-3H6v3H4V5Zm4 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/></svg>',
    free: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8L12 2Z"/></svg>'
  };
  // сердечко вместо галочки
  const CHECK_SVG = '<span class="check"><svg viewBox="0 0 24 24"><path d="M12 21s-8.5-5.2-8.5-11.3A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 8.5 2.3C20.5 15.8 12 21 12 21Z"/></svg></span>';
  const CHEV_SVG = '<svg class="chev" viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';

  /* ---------------- тема ---------------- */
  const metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
  const metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
  function applyTheme() {
    const t = store.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const forced = t === 'light' ? '#fbf4f6' : t === 'dark' ? '#1f171c' : null;
    metaLight.content = forced || '#fbf4f6';
    metaDark.content = forced || '#1f171c';
    document.querySelectorAll('#themeSeg button').forEach((b) => {
      const on = b.dataset.theme === t;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
  }

  /* ---------------- шторки ---------------- */
  const appEl = $('app');
  const sheetStack = [];
  function syncPushed() {
    appEl.classList.toggle('pushed', sheetStack.length > 0);
    appEl.setAttribute('aria-hidden', sheetStack.length > 0);
    sheetStack.forEach((s, i) => s.classList.toggle('pushed', i < sheetStack.length - 1));
  }
  function openSheet(el) {
    if (sheetStack.includes(el)) return;
    el.classList.remove('closing');
    el.querySelector('.sheet-body').scrollTop = 0;
    el.querySelector('.sheet-panel').style.setProperty('--drag', '0px');
    el.setAttribute('aria-hidden', 'false');
    sheetStack.push(el);
    // два кадра, чтобы visibility успела примениться до transform
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('open'); syncPushed(); }));
    // на случай, если кадры не пришли (фон/скрытая вкладка)
    setTimeout(() => { el.classList.add('open'); syncPushed(); }, 60);
  }
  function closeSheet(el) {
    const i = sheetStack.indexOf(el);
    if (i < 0) return;
    sheetStack.splice(i, 1);
    el.classList.remove('open', 'pushed');
    el.classList.add('closing');
    el.setAttribute('aria-hidden', 'true');
    el.querySelector('.sheet-panel').style.setProperty('--drag', '0px');
    syncPushed();
    setTimeout(() => el.classList.remove('closing'), 500);
  }
  function closeTopSheet() { if (sheetStack.length) closeSheet(sheetStack[sheetStack.length - 1]); }

  document.querySelectorAll('.sheet').forEach((sheet) => {
    const panel = sheet.querySelector('.sheet-panel');
    const body = sheet.querySelector('.sheet-body');
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(sheet); });
    sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet(sheet)));

    // свайп вниз для закрытия
    let startY = 0, startT = 0, dy = 0, active = false, fromBody = false;
    panel.addEventListener('touchstart', (e) => {
      if (sheetStack[sheetStack.length - 1] !== sheet) return;
      fromBody = body.contains(e.target);
      if (fromBody && body.scrollTop > 0) { active = false; return; }
      startY = e.touches[0].clientY; startT = Date.now(); dy = 0; active = true;
    }, { passive: true });
    panel.addEventListener('touchmove', (e) => {
      if (!active) return;
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        if (fromBody) active = false; // пользователь скроллит вверх — отдаём скроллу
        sheet.classList.remove('dragging');
        panel.style.setProperty('--drag', '0px');
        return;
      }
      if (fromBody && body.scrollTop > 0) { active = false; return; }
      if (e.cancelable) e.preventDefault();
      sheet.classList.add('dragging');
      panel.style.setProperty('--drag', `${dy}px`);
    }, { passive: false });
    const end = () => {
      if (!active) return;
      active = false;
      sheet.classList.remove('dragging');
      const v = dy / Math.max(1, Date.now() - startT);
      if (dy > 110 || (dy > 30 && v > 0.45)) { closeSheet(sheet); }
      else panel.style.setProperty('--drag', '0px');
      dy = 0;
    };
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTopSheet(); });

  /* ---------------- календарь ---------------- */
  const gridEl = $('grid');
  const monthTitleEl = $('monthTitle');
  const now0 = new Date();
  const view = { y: now0.getFullYear(), m: now0.getMonth() };
  const RING_R = 17, RING_C = 2 * Math.PI * RING_R;

  function ringSVG(ratio, cls = 'ring') {
    const off = RING_C * (1 - ratio);
    return `<svg class="${cls}${ratio === 0 ? ' empty' : ''}" viewBox="0 0 38 38">
      <circle class="ring-track" cx="19" cy="19" r="${RING_R}"></circle>
      <circle class="ring-fill" cx="19" cy="19" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${off}"></circle>
    </svg>`;
  }

  function renderMonth() {
    monthTitleEl.textContent = `${cap(MONTHS_RU[view.m])} ${view.y}`;
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const start = addDays(first, -lead);
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
    const tk = todayKey();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < cells; i++) {
      const d = addDays(start, i);
      const k = dateKey(d);
      const p = progressFor(k);
      const btn = document.createElement('button');
      btn.className = 'day';
      btn.dataset.date = k;
      btn.setAttribute('aria-label', `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${WEEKDAYS_RU[d.getDay()]}`);
      if (d.getMonth() !== view.m) btn.classList.add('other');
      if (d.getDay() === 0 || d.getDay() === 6) btn.classList.add('weekend');
      if (k === tk) btn.classList.add('today');
      if (p.total && p.done === p.total) btn.classList.add('done');
      btn.innerHTML = `<span class="num-wrap">${ringSVG(p.ratio)}<span class="num">${d.getDate()}</span></span>
        <span class="type${hasWorkout(k) ? ' train' : ''}"></span>`;
      frag.appendChild(btn);
    }
    gridEl.replaceChildren(frag);
  }
  function refreshCell(dateK) {
    const btn = gridEl.querySelector(`.day[data-date="${dateK}"]`);
    if (!btn) return;
    const p = progressFor(dateK);
    btn.classList.toggle('done', p.total > 0 && p.done === p.total);
    const ring = btn.querySelector('.ring');
    ring.classList.toggle('empty', p.ratio === 0);
    ring.querySelector('.ring-fill').setAttribute('stroke-dashoffset', RING_C * (1 - p.ratio));
    btn.querySelector('.type').classList.toggle('train', hasWorkout(dateK));
  }
  function navigateMonth(delta) {
    const total = view.y * 12 + view.m + delta;
    view.y = Math.floor(total / 12); view.m = ((total % 12) + 12) % 12;
    gridEl.classList.add(delta > 0 ? 'slide-right' : 'slide-left');
    renderMonth();
    void gridEl.offsetWidth; // reflow — чтобы transition сработал
    gridEl.classList.remove('slide-right', 'slide-left');
    haptic();
  }
  $('prevMonth').addEventListener('click', () => navigateMonth(-1));
  $('nextMonth').addEventListener('click', () => navigateMonth(1));
  $('todayBtn').addEventListener('click', () => {
    const n = new Date();
    const delta = (n.getFullYear() * 12 + n.getMonth()) - (view.y * 12 + view.m);
    if (delta !== 0) navigateMonth(delta);
    const cell = gridEl.querySelector('.day.today');
    if (cell) { cell.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(0.34,1.56,0.64,1)' }); }
  });
  gridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.day');
    if (btn) openDay(btn.dataset.date);
  });

  // свайп по сетке для смены месяца
  (() => {
    const vp = $('gridViewport');
    let sx = 0, sy = 0, tracking = false;
    vp.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; }, { passive: true });
    vp.addEventListener('touchend', (e) => {
      if (!tracking) return; tracking = false;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) navigateMonth(dx < 0 ? 1 : -1);
    });
  })();

  /* ---------------- главный экран: сегодня + статистика ---------------- */
  const TODAY_C = 2 * Math.PI * 19;
  function renderToday() {
    const k = todayKey();
    const d = new Date();
    const p = progressFor(k);
    const items = itemsFor(k);
    $('todayRing').setAttribute('stroke-dasharray', TODAY_C);
    $('todayRing').setAttribute('stroke-dashoffset', TODAY_C * (1 - p.ratio));
    $('todayPct').textContent = `${Math.round(p.ratio * 100)}%`;
    $('todayCard').classList.toggle('done', p.total > 0 && p.done === p.total);
    $('todayTitle').textContent = `${cap(WEEKDAYS_RU[d.getDay()])}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
    const nowMin = d.getHours() * 60 + d.getMinutes();
    const next = items.find((it) => !isChecked(k, it.id) && toMin(it.time) >= nowMin) || items.find((it) => !isChecked(k, it.id));
    let sub = `${p.done} из ${p.total} выполнено`;
    if (p.total && p.done === p.total) sub = 'Всё выполнено — отличный день';
    else if (next) sub += ` · далее ${next.time} ${next.title}`;
    $('todayNext').textContent = sub;
  }
  function renderStats() {
    $('statStreak').textContent = streak();
    $('statWeek').textContent = `${weekPercent()}%`;
    $('statWorkouts').textContent = workoutsThisMonth();
  }
  function refreshAll(dateK) {
    if (dateK) refreshCell(dateK);
    renderToday();
    renderStats();
  }
  const openToday = () => openDay(todayKey());
  $('todayCard').addEventListener('click', openToday);
  $('todayCard').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openToday(); } });

  /* ---------------- экран дня ---------------- */
  const sheetDay = $('sheetDay');
  const timelineEl = $('timeline');
  let currentDate = null;

  function currentItemId(dateK, items) {
    if (dateK !== todayKey()) return null;
    const n = new Date(); const nowMin = n.getHours() * 60 + n.getMinutes();
    let cur = null;
    for (const it of items) if (toMin(it.time) <= nowMin) cur = it; else break;
    return cur ? cur.id : null;
  }

  function renderDayProgress(dateK) {
    const p = progressFor(dateK);
    $('dayProgressText').textContent = `${p.done} из ${p.total} выполнено`;
    $('dayProgressPct').textContent = `${Math.round(p.ratio * 100)}%`;
    const bar = $('dayBar');
    bar.style.width = `${p.ratio * 100}%`;
    bar.classList.toggle('full', p.total > 0 && p.done === p.total);
  }

  function renderTimeline(dateK) {
    const items = itemsFor(dateK);
    const nowId = currentItemId(dateK, items);
    const frag = document.createDocumentFragment();
    items.forEach((it) => {
      const li = document.createElement('li');
      li.className = `tl-item kind-${it.kind || 'plain'}`;
      li.dataset.id = it.id;
      if (it.workoutId) { li.classList.add('workout'); li.dataset.workout = it.workoutId; }
      if (it.mealId && window.MEALS[it.mealId]) { li.classList.add('meal'); li.dataset.meal = it.mealId; }
      if (isChecked(dateK, it.id)) li.classList.add('done');
      if (it.id === nowId) li.classList.add('now');
      const timeHtml = `${it.time}${it.endTime ? `<small>–${it.endTime}</small>` : ''}`;
      let meta = '';
      if (it.workoutId) {
        const wp = workoutProgress(dateK, it.workoutId);
        meta = `<div class="workout-meta">${wp.total} ${plural(wp.total, 'упражнение', 'упражнения', 'упражнений')}${wp.done ? ` · ${wp.done} выполнено` : ''}</div>`;
      } else if (li.dataset.meal) {
        meta = mealMetaHtml(dateK, it);
      }
      const opens = it.workoutId || li.dataset.meal;
      li.innerHTML = `
        <div class="tl-time">${timeHtml}</div>
        <button class="tl-check" aria-label="Отметить: ${it.title}" aria-pressed="${isChecked(dateK, it.id)}">${CHECK_SVG}</button>
        <div class="tl-card" ${opens ? 'role="button" tabindex="0"' : ''}>
          <div class="kind-icon ${it.kind || ''}">${ICONS[it.kind] || ICONS.free}</div>
          <div class="body">
            <span class="tl-title">${it.title}</span>
            ${it.subtitle ? `<div class="tl-sub">${it.subtitle}</div>` : ''}
            ${meta}
          </div>
          ${it.id === nowId ? '<span class="now-pill">сейчас</span>' : ''}
          ${opens ? CHEV_SVG : ''}
        </div>`;
      frag.appendChild(li);
    });
    timelineEl.replaceChildren(frag);
  }

  function openDay(dateK) {
    currentDate = dateK;
    const d = parseKey(dateK);
    $('dayEyebrow').textContent = dateK === todayKey() ? `Сегодня · ${WEEKDAYS_RU[d.getDay()]}` : WEEKDAYS_RU[d.getDay()];
    $('dayTitle').textContent = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
    $('dayTag').hidden = !hasWorkout(dateK);
    const isSat = d.getDay() === 6;
    $('dayVariant').hidden = !isSat;
    $('satEvening').checked = !!store.variants[dateK]?.satEvening;
    renderTimeline(dateK);
    renderDayProgress(dateK);
    openSheet(sheetDay);
    haptic();
  }

  function toggleItem(dateK, id) {
    const val = !isChecked(dateK, id);
    setChecked(dateK, id, val);
    const li = timelineEl.querySelector(`.tl-item[data-id="${CSS.escape(id)}"]`);
    if (li) { li.classList.toggle('done', val); li.querySelector('.tl-check').setAttribute('aria-pressed', val); }
    renderDayProgress(dateK);
    refreshAll(dateK);
    haptic();
    const p = progressFor(dateK);
    if (val && p.total && p.done === p.total) toast('День выполнен полностью');
  }

  timelineEl.addEventListener('click', (e) => {
    const rq = e.target.closest('.rq');
    if (rq) { e.stopPropagation(); openRecipe(rq.dataset.recipe); return; }
    const li = e.target.closest('.tl-item');
    if (!li || !currentDate) return;
    if (e.target.closest('.tl-check')) { toggleItem(currentDate, li.dataset.id); return; }
    if (li.dataset.workout) { openWorkout(currentDate, li.dataset.workout, li.dataset.id); return; }
    if (li.dataset.meal) { openMeal(currentDate, li.dataset.meal, li.dataset.id); return; }
    if (e.target.closest('.tl-card')) toggleItem(currentDate, li.dataset.id);
  });
  timelineEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.tl-card[role="button"]');
    if (!card) return;
    e.preventDefault();
    const li = card.closest('.tl-item');
    if (li.dataset.workout) openWorkout(currentDate, li.dataset.workout, li.dataset.id);
    else if (li.dataset.meal) openMeal(currentDate, li.dataset.meal, li.dataset.id);
  });

  $('satEvening').addEventListener('change', (e) => {
    if (!currentDate) return;
    if (!store.variants[currentDate]) store.variants[currentDate] = {};
    store.variants[currentDate].satEvening = e.target.checked;
    if (!e.target.checked) delete store.variants[currentDate];
    saveVariants();
    renderTimeline(currentDate);
    renderDayProgress(currentDate);
    refreshAll(currentDate);
    haptic();
  });

  /* ---------------- экран тренировки ---------------- */
  const sheetWorkout = $('sheetWorkout');
  const exercisesEl = $('exercises');
  let currentWorkout = null; // { dateK, workoutId, itemId }

  function renderWorkoutProgress() {
    const { dateK, workoutId, itemId } = currentWorkout;
    const wp = workoutProgress(dateK, workoutId);
    $('workoutProgressText').textContent = `${wp.done} из ${wp.total} упражнений`;
    $('workoutProgressPct').textContent = `${Math.round(wp.ratio * 100)}%`;
    const bar = $('workoutBar');
    bar.style.width = `${wp.ratio * 100}%`;
    bar.classList.toggle('full', wp.done === wp.total);
    const btn = $('workoutDone');
    const itemDone = isChecked(dateK, itemId);
    btn.classList.toggle('done', itemDone);
    btn.textContent = itemDone ? 'Тренировка выполнена' : 'Завершить тренировку';
  }

  function openWorkout(dateK, workoutId, itemId) {
    const w = window.WORKOUTS[workoutId];
    if (!w) return;
    currentWorkout = { dateK, workoutId, itemId };
    const item = itemsFor(dateK).find((it) => it.id === itemId);
    $('workoutEyebrow').textContent = item ? `Тренировка · ${item.time}${item.endTime ? `–${item.endTime}` : ''}` : 'Тренировка';
    $('workoutTitle').textContent = w.title;
    const frag = document.createDocumentFragment();
    w.exercises.forEach((ex, i) => {
      const li = document.createElement('li');
      li.className = 'ex' + (isChecked(dateK, exId(workoutId, i)) ? ' done' : '');
      li.dataset.index = i;
      li.setAttribute('role', 'checkbox');
      li.setAttribute('aria-checked', isChecked(dateK, exId(workoutId, i)));
      li.tabIndex = 0;
      li.innerHTML = `${CHECK_SVG}<span class="ex-num">${i + 1}</span>
        <div class="ex-body"><span class="ex-name">${ex.name}</span><div class="ex-sets">${ex.sets}</div></div>`;
      frag.appendChild(li);
    });
    exercisesEl.replaceChildren(frag);
    renderWorkoutProgress();
    openSheet(sheetWorkout);
    haptic();
  }

  function syncWorkoutItemInDay() {
    // обновить строку тренировки на экране дня без перерисовки
    const { dateK, workoutId, itemId } = currentWorkout;
    const li = timelineEl.querySelector(`.tl-item[data-id="${CSS.escape(itemId)}"]`);
    if (!li) return;
    const wp = workoutProgress(dateK, workoutId);
    const meta = li.querySelector('.workout-meta');
    if (meta) meta.textContent = `${wp.total} ${plural(wp.total, 'упражнение', 'упражнения', 'упражнений')}${wp.done ? ` · ${wp.done} выполнено` : ''}`;
    const done = isChecked(dateK, itemId);
    li.classList.toggle('done', done);
    li.querySelector('.tl-check').setAttribute('aria-pressed', done);
    renderDayProgress(dateK);
  }

  function toggleExercise(i) {
    const { dateK, workoutId, itemId } = currentWorkout;
    const id = exId(workoutId, i);
    const val = !isChecked(dateK, id);
    setChecked(dateK, id, val);
    const li = exercisesEl.querySelector(`.ex[data-index="${i}"]`);
    li.classList.toggle('done', val); li.setAttribute('aria-checked', val);
    const wp = workoutProgress(dateK, workoutId);
    if (val && wp.done === wp.total && !isChecked(dateK, itemId)) {
      setChecked(dateK, itemId, true);
      toast('Тренировка завершена');
    }
    renderWorkoutProgress();
    syncWorkoutItemInDay();
    refreshAll(dateK);
    haptic();
  }
  exercisesEl.addEventListener('click', (e) => {
    const li = e.target.closest('.ex');
    if (li) toggleExercise(Number(li.dataset.index));
  });
  exercisesEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('.ex');
    if (li) { e.preventDefault(); toggleExercise(Number(li.dataset.index)); }
  });
  $('workoutDone').addEventListener('click', () => {
    const { dateK, workoutId, itemId } = currentWorkout;
    if (isChecked(dateK, itemId)) { toast('Уже отмечено. Снять отметку можно в расписании дня'); return; }
    window.WORKOUTS[workoutId].exercises.forEach((_, i) => setChecked(dateK, exId(workoutId, i), true));
    setChecked(dateK, itemId, true);
    exercisesEl.querySelectorAll('.ex').forEach((li) => { li.classList.add('done'); li.setAttribute('aria-checked', 'true'); });
    renderWorkoutProgress();
    syncWorkoutItemInDay();
    refreshAll(dateK);
    haptic();
    toast('Тренировка завершена');
    setTimeout(() => closeSheet(sheetWorkout), 550);
  });

  /* ---------------- экран рациона ---------------- */
  const sheetMeal = $('sheetMeal');
  const mealOptionsEl = $('mealOptions');
  let currentMeal = null; // { dateK, mealId, itemId }

  function renderMealChosen() {
    const { dateK, mealId, itemId } = currentMeal;
    const m = window.MEALS[mealId];
    const idx = mealChoice(dateK, itemId);
    const box = $('mealChosen');
    const has = idx !== null && !!m.options[idx];
    box.classList.toggle('empty', !has);
    $('mealChosenLabel').textContent = dateK === todayKey() ? 'Сегодня на столе' : 'Выбрано на этот день';
    $('mealChosenText').textContent = has ? m.options[idx] : 'Вариант ещё не выбран';
    $('mealClear').hidden = !has;
    mealOptionsEl.querySelectorAll('.meal-opt').forEach((li) => {
      const on = Number(li.dataset.index) === idx;
      li.classList.toggle('selected', on);
      li.setAttribute('aria-checked', on);
    });
    const btn = $('mealDone');
    const done = isChecked(dateK, itemId);
    btn.classList.toggle('done', done);
    btn.textContent = done ? 'Отмечено как съеденное' : 'Отметить съеденным';
  }

  function openMeal(dateK, mealId, itemId) {
    const m = window.MEALS[mealId];
    if (!m) return;
    currentMeal = { dateK, mealId, itemId };
    const item = itemsFor(dateK).find((it) => it.id === itemId);
    $('mealEyebrow').textContent = item ? `${item.title} · ${item.time}` : 'Рацион';
    $('mealTitle').textContent = m.title;
    $('mealTag').textContent = `${m.options.length} ${plural(m.options.length, 'вариант', 'варианта', 'вариантов')}`;
    $('mealHint').textContent = m.hint || 'Варианты';
    const frag = document.createDocumentFragment();
    m.options.forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'meal-opt';
      li.dataset.index = i;
      li.setAttribute('role', 'radio');
      li.tabIndex = 0;
      const parts = mealParts(opt);
      // все варианты — метками: ингредиенты через «+», цельное блюдо — одна метка
      const body = `<div class="meal-ingr">${parts.map((p) => ingrHtml(p, 'ing')).join('<span class="plus">+</span>')}</div>`;
      li.innerHTML = `${CHECK_SVG}<span class="ex-num">${i + 1}</span><div class="meal-body">${body}</div>`;
      frag.appendChild(li);
    });
    mealOptionsEl.replaceChildren(frag);
    renderMealChosen();
    openSheet(sheetMeal);
    haptic();
  }

  function syncMealItemInDay() {
    const { dateK, itemId } = currentMeal;
    const li = timelineEl.querySelector(`.tl-item[data-id="${CSS.escape(itemId)}"]`);
    if (!li) return;
    const it = itemsFor(dateK).find((x) => x.id === itemId);
    const old = li.querySelector('.meal-meta');
    if (old && it) old.outerHTML = mealMetaHtml(dateK, it);
    const done = isChecked(dateK, itemId);
    li.classList.toggle('done', done);
    li.querySelector('.tl-check').setAttribute('aria-pressed', done);
    renderDayProgress(dateK);
  }

  function chooseMeal(idx) {
    const { dateK, itemId } = currentMeal;
    const same = mealChoice(dateK, itemId) === idx;
    setMealChoice(dateK, itemId, same ? null : idx);
    renderMealChosen();
    syncMealItemInDay();
    haptic();
  }
  mealOptionsEl.addEventListener('click', (e) => {
    const rq = e.target.closest('.rq');
    if (rq) { e.stopPropagation(); openRecipe(rq.dataset.recipe); return; }
    const li = e.target.closest('.meal-opt');
    if (li) chooseMeal(Number(li.dataset.index));
  });
  mealOptionsEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('.meal-opt');
    if (li) { e.preventDefault(); chooseMeal(Number(li.dataset.index)); }
  });
  $('mealRandom').addEventListener('click', () => {
    const { dateK, mealId, itemId } = currentMeal;
    const n = window.MEALS[mealId].options.length;
    const cur = mealChoice(dateK, itemId);
    let idx = Math.floor(Math.random() * n);
    if (n > 1 && idx === cur) idx = (idx + 1) % n;
    setMealChoice(dateK, itemId, idx);
    renderMealChosen();
    syncMealItemInDay();
    haptic();
    const el = mealOptionsEl.querySelector(`.meal-opt[data-index="${idx}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  $('mealClear').addEventListener('click', () => {
    const { dateK, itemId } = currentMeal;
    setMealChoice(dateK, itemId, null);
    renderMealChosen();
    syncMealItemInDay();
    haptic();
  });
  $('mealDone').addEventListener('click', () => {
    const { dateK, itemId } = currentMeal;
    const val = !isChecked(dateK, itemId);
    setChecked(dateK, itemId, val);
    renderMealChosen();
    syncMealItemInDay();
    refreshAll(dateK);
    haptic();
    if (val) { toast('Приятного аппетита'); setTimeout(() => closeSheet(sheetMeal), 550); }
  });

  /* ---------------- экран рецепта ---------------- */
  const sheetRecipe = $('sheetRecipe');
  function openRecipe(key) {
    const r = window.RECIPES[key];
    if (!r) return;
    $('recipeTitle').textContent = r.title;
    $('recipeTime').textContent = r.time || '';
    const li = (arr, cls) => arr.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
    let html = r.intro ? `<p class="recipe-intro">${escapeHtml(r.intro)}</p>` : '';
    if (r.methods?.length) {
      html += `<div class="group-label">Способы и время</div><div class="recipe-methods">${r.methods.map((m) => `
        <div class="recipe-method">
          <div class="rm-time">${escapeHtml(m.time)}</div>
          <div class="rm-body"><div class="rm-name">${escapeHtml(m.name)}</div>${m.note ? `<div class="rm-note">${escapeHtml(m.note)}</div>` : ''}</div>
        </div>`).join('')}</div>`;
    }
    if (r.steps?.length) html += `<div class="group-label">Пошагово</div><ol class="recipe-steps">${li(r.steps)}</ol>`;
    if (r.tips?.length) html += `<div class="group-label">Советы</div><ul class="recipe-tips">${li(r.tips)}</ul>`;
    html += '<div class="sheet-spacer"></div>';
    $('recipeBody').innerHTML = html;
    openSheet(sheetRecipe);
    haptic();
  }

  /* ---------------- фото в рамке ---------------- */
  // Фото хранится в IndexedDB (localStorage слишком мал для картинок). Никуда не отправляется.
  const FRAMES = [
    { id: 'polaroid', name: 'Полароид' },
    { id: 'lace', name: 'Кружево' },
    { id: 'hearts', name: 'Сердечки' },
    { id: 'bow', name: 'Бантик' },
    { id: 'pearls', name: 'Жемчуг' },
    { id: 'tape', name: 'Скотч' }
  ];
  const photoDb = {
    open() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('tracker', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async get(key) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        tx.onsuccess = () => resolve(tx.result ?? null);
        tx.onerror = () => reject(tx.error);
      });
    },
    async set(key, val) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async del(key) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  };

  const photoFrameEl = $('photoFrame');
  const photoImgEl = $('photoImg');
  const photoEmptyEl = $('photoEmpty');
  const photoInput = $('photoInput');
  const sheetPhoto = $('sheetPhoto');
  let photoData = null;

  const currentFrame = () => FRAMES.some((f) => f.id === store.settings.frame) ? store.settings.frame : 'polaroid';
  function applyFrame() {
    FRAMES.forEach((f) => photoFrameEl.classList.remove(`frame-${f.id}`));
    photoFrameEl.classList.add(`frame-${currentFrame()}`);
  }
  function renderPhoto() {
    const has = !!photoData;
    photoEmptyEl.hidden = has;
    photoFrameEl.hidden = !has;
    if (has) { photoImgEl.src = photoData; applyFrame(); }
    else photoImgEl.removeAttribute('src');
  }
  async function loadPhoto() {
    try { photoData = await photoDb.get('photo'); } catch { photoData = null; }
    renderPhoto();
  }

  // уменьшаем до 1400px по длинной стороне и сохраняем как JPEG — так фото занимает ~200–400 КБ
  async function processPhoto(file) {
    let source, w, h;
    if ('createImageBitmap' in window) {
      source = await createImageBitmap(file); // Safari 15+ сам учитывает поворот из EXIF
      w = source.width; h = source.height;
    } else {
      source = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img); img.onerror = rej;
        img.src = URL.createObjectURL(file);
      });
      w = source.naturalWidth; h = source.naturalHeight;
    }
    const MAX = 1400;
    const k = Math.min(1, MAX / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    if (source.close) source.close();
    return canvas.toDataURL('image/jpeg', 0.86);
  }

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files && photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    toast('Сохраняю фото…', { duration: 4000 });
    try {
      const data = await processPhoto(file);
      await photoDb.set('photo', data);
      photoData = data;
      renderPhoto();
      haptic();
      toast('Фото сохранено на устройстве');
      if (!sheetStack.includes(sheetPhoto)) openPhotoSheet();
    } catch (e) {
      console.warn('photo', e);
      toast('Не удалось обработать фото');
    }
  });
  photoEmptyEl.addEventListener('click', () => photoInput.click());
  photoFrameEl.addEventListener('click', () => openPhotoSheet());

  function renderFrameGrid() {
    const frag = document.createDocumentFragment();
    FRAMES.forEach((f) => {
      const b = document.createElement('button');
      b.className = 'frame-opt' + (f.id === currentFrame() ? ' selected' : '');
      b.dataset.frame = f.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', f.id === currentFrame());
      b.innerHTML = `<span class="photo-frame mini frame-${f.id}"><img alt=""></span><span class="fo-name">${f.name}</span>`;
      const img = b.querySelector('img');
      if (photoData) img.src = photoData; else img.remove();
      frag.appendChild(b);
    });
    $('frameGrid').replaceChildren(frag);
  }
  function openPhotoSheet() {
    renderFrameGrid();
    openSheet(sheetPhoto);
  }
  $('frameGrid').addEventListener('click', (e) => {
    const b = e.target.closest('.frame-opt');
    if (!b) return;
    store.settings.frame = b.dataset.frame; saveSettings();
    $('frameGrid').querySelectorAll('.frame-opt').forEach((x) => { const on = x === b; x.classList.toggle('selected', on); x.setAttribute('aria-checked', on); });
    applyFrame();
    haptic();
  });
  $('photoReplace').addEventListener('click', () => photoInput.click());
  $('photoRemove').addEventListener('click', async () => {
    if (!window.confirm('Удалить фото с устройства?')) return;
    try { await photoDb.del('photo'); } catch { /* пусто */ }
    photoData = null;
    renderPhoto();
    closeSheet(sheetPhoto);
    toast('Фото удалено');
  });
  loadPhoto();

  /* ---------------- настройки ---------------- */
  const sheetSettings = $('sheetSettings');
  $('settingsBtn').addEventListener('click', () => { openSettings(); });
  function openSettings() {
    const installed = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    $('installedNote').hidden = !installed;
    $('notifyToggle').checked = !!store.settings.notify && notificationsGranted();
    updateNotifyStatus();
    $('versionNote').textContent = `Режим ${APP_VERSION} · ${installed ? 'установлено' : 'в браузере'}`;
    openSheet(sheetSettings);
  }
  $('themeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-theme]');
    if (!b) return;
    store.settings.theme = b.dataset.theme; saveSettings(); applyTheme(); haptic();
  });

  // уведомления (только пока приложение открыто)
  const notificationsSupported = () => 'Notification' in window;
  const notificationsGranted = () => notificationsSupported() && Notification.permission === 'granted';
  function updateNotifyStatus() {
    const el = $('notifyStatus');
    if (!notificationsSupported()) { el.textContent = 'Недоступно в Safari — только после установки на экран Домой'; return; }
    if (Notification.permission === 'denied') { el.textContent = 'Запрещено в настройках iOS'; return; }
    el.textContent = store.settings.notify && notificationsGranted() ? 'Включены · только пока приложение открыто' : 'Только пока приложение открыто';
  }
  $('notifyToggle').addEventListener('change', async (e) => {
    if (!e.target.checked) { store.settings.notify = false; saveSettings(); updateNotifyStatus(); return; }
    if (!notificationsSupported()) { e.target.checked = false; toast('Сначала добавьте приложение на экран Домой'); return; }
    let perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; } }
    if (perm !== 'granted') { e.target.checked = false; store.settings.notify = false; saveSettings(); updateNotifyStatus(); toast('Разрешение не выдано'); return; }
    store.settings.notify = true; saveSettings(); updateNotifyStatus(); haptic();
    toast('Напоминания включены, пока приложение открыто');
  });
  const notified = new Set();
  async function showNotification(title, body) {
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg && reg.showNotification) return reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'tracker-' + title });
      new Notification(title, { body, icon: 'icons/icon-192.png' });
    } catch (e) { console.warn('notify', e); }
  }
  function notificationTick() {
    if (!store.settings.notify || !notificationsGranted()) return;
    const k = todayKey();
    const n = new Date();
    const hhmm = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    itemsFor(k).forEach((it) => {
      const key = `${k}|${it.id}`;
      if (it.time === hhmm && !isChecked(k, it.id) && !notified.has(key)) {
        notified.add(key);
        showNotification(it.title, `${it.time}${it.endTime ? `–${it.endTime}` : ''} · Режим`);
      }
    });
  }
  setInterval(notificationTick, 20000);

  // данные: экспорт / импорт / сброс
  $('exportBtn').addEventListener('click', async () => {
    const payload = JSON.stringify({ app: 'tracker', version: APP_VERSION, exportedAt: new Date().toISOString(), checks: store.checks, variants: store.variants, meals: store.meals, settings: store.settings });
    try { await navigator.clipboard.writeText(payload); toast('Резервная копия скопирована'); }
    catch { window.prompt('Скопируйте текст резервной копии:', payload); }
  });
  $('importBtn').addEventListener('click', () => {
    const raw = window.prompt('Вставьте JSON резервной копии:');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.app !== 'tracker' || typeof data.checks !== 'object') throw new Error('bad');
      store.checks = data.checks || {}; store.variants = data.variants || {}; store.meals = data.meals || {};
      if (data.settings) store.settings = Object.assign(store.settings, data.settings);
      saveChecks(); saveVariants(); saveMeals(); saveSettings(); applyTheme();
      renderMonth(); refreshAll();
      toast('Данные восстановлены');
    } catch { toast('Не удалось прочитать копию'); }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Стереть все отметки о выполнении? Это нельзя отменить.')) return;
    store.checks = {}; store.variants = {}; store.meals = {}; saveChecks(); saveVariants(); saveMeals();
    renderMonth(); refreshAll();
    toast('Отметки стёрты');
  });

  /* ---------------- смена дня / возврат в приложение ---------------- */
  let lastToday = todayKey();
  function onWake() {
    const k = todayKey();
    if (k !== lastToday) { lastToday = k; renderMonth(); }
    refreshAll();
    if (currentDate && sheetStack.includes(sheetDay)) {
      // обновить метку «сейчас»
      const items = itemsFor(currentDate);
      const nowId = currentItemId(currentDate, items);
      timelineEl.querySelectorAll('.tl-item').forEach((li) => {
        const isNow = li.dataset.id === nowId;
        li.classList.toggle('now', isNow);
        const pill = li.querySelector('.now-pill');
        if (isNow && !pill) li.querySelector('.tl-card .body').insertAdjacentHTML('afterend', '<span class="now-pill">сейчас</span>');
        if (!isNow && pill) pill.remove();
      });
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onWake(); });
  window.addEventListener('focus', onWake);
  setInterval(onWake, 60000);

  /* ---------------- service worker ---------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              toast('Доступно обновление — нажмите, чтобы применить', { duration: 8000, action: () => nw.postMessage({ type: 'SKIP_WAITING' }) });
            }
          });
        });
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
      } catch (e) { console.warn('sw', e); }
    });
  }

  /* ---------------- старт ---------------- */
  applyTheme();
  renderMonth();
  refreshAll();
})();
