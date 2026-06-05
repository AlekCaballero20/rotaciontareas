const STORAGE_KEY   = 'rotador_urgente_alek_v1';
const TIMER_KEY     = 'rotador_urgente_alek_timer_v1';
const DOPAMINE_KEY  = 'rotador_dopamine_v1';
const COMBO_WINDOW_MS  = 12_000;
const CONFETTI_COLORS  = ['#2563eb','#7c3aed','#ec4899','#f59e0b','#10b981','#0ea5e9'];

const sampleText = `1. Marketing x
- Revisar presupuesto de Google Ads *
- Crear anuncio
- Responder leads
2. Musicala
- Revisar pagos urgentes
- Confirmar horarios
3. Personal
- Hacer llamada pendiente`;

const defaultState = { date: todayKey(), activeTaskId: null, filter: 'all', search: '', tasks: [] };
const defaultTimer  = { durationMinutes: 15, seconds: 15 * 60, running: false };

let state         = loadState();
let timerState    = loadTimer();
let timerInterval = null;
let toastTimeout  = null;
let particleFrame = null;
let dopamineState = loadDopamine();

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const els = {
  todayLabel:        $('#todayLabel'),
  activeBadge:       $('#activeBadge'),
  currentTaskTitle:  $('#currentTaskTitle'),
  currentStepTitle:  $('#currentStepTitle'),
  progressText:      $('#progressText'),
  progressBar:       $('#progressBar'),
  activeSubtaskForm: $('#activeSubtaskForm'),
  activeSubtaskInput:$('#activeSubtaskInput'),
  completeCurrentBtn:$('#completeCurrentBtn'),
  rotateBtn:         $('#rotateBtn'),
  focusModeBtn:      $('#focusModeBtn'),
  timerDisplay:      $('#timerDisplay'),
  timerToggleBtn:    $('#timerToggleBtn'),
  timerResetBtn:     $('#timerResetBtn'),
  timerCustomForm:   $('#timerCustomForm'),
  timerCustomInput:  $('#timerCustomInput'),
  statTasks:         $('#statTasks'),
  statPendingSteps:  $('#statPendingSteps'),
  statDoneSteps:     $('#statDoneSteps'),
  taskInput:         $('#taskInput'),
  firstStepInput:    $('#firstStepInput'),
  priorityInput:     $('#priorityInput'),
  addTaskBtn:        $('#addTaskBtn'),
  searchInput:       $('#searchInput'),
  importBtn:         $('#importBtn'),
  copyBtn:           $('#copyBtn'),
  resetBtn:          $('#resetBtn'),
  taskBoard:         $('#taskBoard'),
  importModal:       $('#importModal'),
  closeImportBtn:    $('#closeImportBtn'),
  importTextarea:    $('#importTextarea'),
  parseImportBtn:    $('#parseImportBtn'),
  sampleBtn:         $('#sampleBtn'),
  streakBar:         $('#streakBar'),
  toast:             $('#toast'),
};

init();

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  migrateStateShape();
  ensureActivePointer();
  setTodayLabel();
  bindEvents();
  render();
  updateTimerDisplay();
  updateTimerUrgency();
  updateStreakBar();
  setupPwa();
}

// ─── EVENTS ──────────────────────────────────────────────────────────────────

function bindEvents() {
  els.addTaskBtn.addEventListener('click', addTaskFromComposer);
  els.taskInput.addEventListener('keydown', submitComposerOnEnter);
  els.firstStepInput.addEventListener('keydown', submitComposerOnEnter);

  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    saveState();
    renderTasks();
  });

  $$('.chip').forEach((btn) => btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    saveState();
    render();
  }));

  els.activeSubtaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.activeSubtaskInput.value.trim();
    const task  = getTask(state.activeTaskId);
    if (!task) { showToast('Primero pon una tarea en X. La app todavía no hace magia negra.'); return; }
    addSubtaskToTask(task.id, title);
    els.activeSubtaskInput.value = '';
  });

  els.completeCurrentBtn.addEventListener('click', completeCurrentStepAndRotate);
  els.rotateBtn.addEventListener('click', rotateOnly);
  els.focusModeBtn.addEventListener('click', toggleFocusMode);
  els.timerToggleBtn.addEventListener('click', toggleTimer);
  els.timerResetBtn.addEventListener('click', resetTimer);
  document.querySelectorAll('[data-minutes]').forEach((btn) =>
    btn.addEventListener('click', () => applyTimerPreset(btn.dataset.minutes)));
  els.timerCustomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (els.timerCustomInput.value.trim() === '') return;
    applyTimerPreset(els.timerCustomInput.value);
    els.timerCustomInput.value = '';
  });

  els.importBtn.addEventListener('click', openImportModal);
  els.closeImportBtn.addEventListener('click', closeImportModal);
  els.importModal.addEventListener('click', (e) => { if (e.target === els.importModal) closeImportModal(); });
  els.sampleBtn.addEventListener('click', () => {
    els.importTextarea.value = sampleText;
    showToast('Ejemplo cargado. Qué sofisticado, copiar y pegar.');
  });
  els.parseImportBtn.addEventListener('click', importFromTextarea);
  els.copyBtn.addEventListener('click', copySummary);
  els.resetBtn.addEventListener('click', resetDay);
  els.taskBoard.addEventListener('click', handleBoardClick);
  els.taskBoard.addEventListener('submit', handleBoardSubmit);

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key.toLowerCase() === 'n') completeCurrentStepAndRotate();
    if (e.key.toLowerCase() === 'r') rotateOnly();
    if (e.key.toLowerCase() === 'f') toggleFocusMode();
    if (e.key === 'Escape') closeImportModal();
  });
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function todayKey() { return new Date().toISOString().slice(0, 10); }
function uid(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }

function setTodayLabel() {
  els.todayLabel.textContent = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date());
}

function escapeHtml(v) {
  return String(v)
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem('rotador_tdah_alek_v3')
      || localStorage.getItem('rotador_tdah_alek_v2')
      || localStorage.getItem('rotador_tdah_alek_v1');
    if (!raw) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...JSON.parse(raw) };
  } catch (err) {
    console.warn('No se pudo cargar el estado:', err);
    return structuredClone(defaultState);
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function loadTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return { ...defaultTimer };
    const p = { ...defaultTimer, ...JSON.parse(raw), running: false };
    p.durationMinutes = clampMinutes(p.durationMinutes);
    p.seconds = Math.max(0, Number(p.seconds) || p.durationMinutes * 60);
    return p;
  } catch { return { ...defaultTimer }; }
}
function saveTimer() {
  localStorage.setItem(TIMER_KEY, JSON.stringify({
    durationMinutes: timerState.durationMinutes,
    seconds: timerState.seconds,
    running: false
  }));
}

// ─── DOPAMINE ENGINE ─────────────────────────────────────────────────────────

function loadDopamine() {
  try {
    const base = { date: todayKey(), streak: 0, combo: 0, lastTime: 0, xp: 0 };
    const raw  = localStorage.getItem(DOPAMINE_KEY);
    if (!raw) return base;
    const p = { ...base, ...JSON.parse(raw) };
    return p.date === todayKey() ? p : base;
  } catch { return { date: todayKey(), streak: 0, combo: 0, lastTime: 0, xp: 0 }; }
}
function saveDopamine() { localStorage.setItem(DOPAMINE_KEY, JSON.stringify(dopamineState)); }

function onStepCompleted(triggerEl) {
  const now = Date.now();
  dopamineState.streak++;
  dopamineState.xp    += 10;
  dopamineState.combo  = (now - dopamineState.lastTime < COMBO_WINDOW_MS)
    ? dopamineState.combo + 1 : 1;
  dopamineState.lastTime = now;
  saveDopamine();

  const rect = triggerEl.getBoundingClientRect();
  spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  spawnFloatingText('+10 XP', triggerEl);
  updateStreakBar();

  if (dopamineState.combo >= 3) showComboFlash(dopamineState.combo);
}

function updateStreakBar() {
  const bar = els.streakBar;
  if (!bar) return;
  const { streak, combo, xp } = dopamineState;
  bar.hidden = streak < 1;
  if (streak < 1) return;

  bar.querySelector('.streak-count').textContent = streak;
  bar.querySelector('.xp-count').textContent     = `${xp} XP`;
  const comboEl = bar.querySelector('.combo-count');
  if (combo >= 3) { comboEl.textContent = `⚡ ×${combo}`; comboEl.hidden = false; }
  else              { comboEl.hidden = true; }

  bar.classList.remove('pop');
  void bar.offsetWidth;          // reflow para reiniciar animación
  bar.classList.add('pop');
}

function showComboFlash(count) {
  document.body.classList.add('combo-flash');
  setTimeout(() => document.body.classList.remove('combo-flash'), 600);
  showToast(`⚡ COMBO ×${count} — ¡Imparable!`);
}

function checkProgressMilestone(prev, next) {
  for (const m of [25, 50, 75, 100]) {
    if (prev < m && next >= m) { fireMilestone(m); return; }
  }
}

function fireMilestone(pct) {
  const msgs = {
    25:  '🚂 ¡25%! El tren salió de la estación.',
    50:  '⛰️ ¡Mitad del día! La cuesta va para abajo.',
    75:  '🎯 ¡75%! Casi en la meta, no te distraigas.',
    100: '🏆 ¡TODO LISTO! Día ganado.',
  };
  showToast(msgs[pct] || `¡${pct}% completado!`);
  els.progressBar.classList.add('milestone-pulse');
  setTimeout(() => els.progressBar.classList.remove('milestone-pulse'), 900);
  if (pct === 100) setTimeout(() => spawnConfetti(window.innerWidth / 2, window.innerHeight / 3), 350);
}

// ─── CONFETTI ────────────────────────────────────────────────────────────────

function spawnConfetti(cx, cy) {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const pts = Array.from({ length: 36 }, () => ({
    x: cx, y: cy,
    vx: (Math.random() - 0.5) * 18,
    vy: -(Math.random() * 14 + 4),
    sz: Math.random() * 9 + 4,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 16,
    g: 0.45,
    a: 1,
    rect: Math.random() > 0.35,
  }));

  if (particleFrame) cancelAnimationFrame(particleFrame);

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy; p.vy += p.g;
      p.vx *= 0.985; p.rot += p.rotV; p.a -= 0.02;
      if (p.a <= 0) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.a);
      ctx.fillStyle   = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      if (p.rect) ctx.fillRect(-p.sz / 2, -p.sz / 4, p.sz, p.sz / 2.5);
      else { ctx.beginPath(); ctx.arc(0, 0, p.sz / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (alive) particleFrame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ─── FLOATING TEXT ───────────────────────────────────────────────────────────

function spawnFloatingText(text, originEl) {
  const rect = originEl.getBoundingClientRect();
  const el   = document.createElement('div');
  el.className = 'floating-xp';
  el.textContent = text;
  el.style.left  = `${rect.left + rect.width / 2}px`;
  el.style.top   = `${rect.top - 4}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

// ─── MIGRATION ───────────────────────────────────────────────────────────────

function migrateStateShape() {
  state.tasks = (state.tasks || []).map((t) => ({
    id:               t.id || uid('task'),
    title:            t.title || 'Tarea sin nombre',
    priority:         normalizePriority(t.priority || t.energy || 'urgent'),
    done:             Boolean(t.done),
    currentSubtaskId: t.currentSubtaskId || t.activeSubtaskId || null,
    subtasks: (t.subtasks || []).map((s) => ({
      id:    s.id    || uid('sub'),
      title: s.title || 'Subtarea sin nombre',
      done:  Boolean(s.done),
    })),
  }));
  if (!['all','pending','urgent','active','done'].includes(state.filter)) state.filter = 'all';
}

function normalizePriority(v) {
  if (v === 'alta'  || v === 'high')   return 'high';
  if (v === 'normal'|| v === 'baja')   return 'normal';
  return 'urgent';
}
function clampMinutes(v) {
  const m = Number.parseInt(v, 10);
  return Number.isNaN(m) ? 15 : Math.max(1, Math.min(180, m));
}

// ─── FACTORY ─────────────────────────────────────────────────────────────────

function createTask(title, priority = 'urgent') {
  return { id: uid('task'), title, priority: normalizePriority(priority), done: false, currentSubtaskId: null, subtasks: [] };
}
function createSubtask(title) { return { id: uid('sub'), title, done: false }; }
function getTask(id) { return state.tasks.find((t) => t.id === id) || null; }

// ─── POINTERS ────────────────────────────────────────────────────────────────

function ensureTaskSubtaskPointer(task) {
  if (!task) return;
  if (!task.subtasks.length) { task.currentSubtaskId = null; return; }
  const active = task.subtasks.find((s) => s.id === task.currentSubtaskId && !s.done);
  if (active) { task.done = false; return; }
  const next = task.subtasks.find((s) => !s.done);
  task.currentSubtaskId = next?.id || null;
  task.done = !next;
}

function ensureActivePointer() {
  state.tasks.forEach(ensureTaskSubtaskPointer);
  const active = getTask(state.activeTaskId);
  if (active && !active.done) return;
  state.activeTaskId = findNextPendingTask()?.id || null;
}

function getCurrentSubtask(task) {
  if (!task || !task.subtasks.length) return null;
  ensureTaskSubtaskPointer(task);
  return task.subtasks.find((s) => s.id === task.currentSubtaskId) || null;
}

function advanceCurrentSubtaskPointer(task) {
  if (!task || !task.subtasks.length) return false;
  const pending = task.subtasks.filter((s) => !s.done);
  if (pending.length < 2) return false;
  const idx = pending.findIndex((s) => s.id === task.currentSubtaskId);
  task.currentSubtaskId = pending[(idx + 1) % pending.length].id;
  task.done = false;
  return true;
}

function findNextPendingTask(startAfterId = null) {
  const pending = state.tasks.filter((t) => !t.done);
  if (!pending.length) return null;
  if (!startAfterId) return pending[0];
  const idx = state.tasks.findIndex((t) => t.id === startAfterId);
  return state.tasks.find((t, i) => i > idx && !t.done) || pending[0];
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

function addTaskFromComposer() {
  const title     = els.taskInput.value.trim();
  const firstStep = els.firstStepInput.value.trim();
  const priority  = els.priorityInput.value;
  if (!title) {
    showToast('Escribe el nombre de la tarea. El caos sin título no ayuda.');
    els.taskInput.focus();
    return;
  }
  const task = createTask(title, priority);
  if (firstStep) {
    const sub = createSubtask(firstStep);
    task.subtasks.push(sub);
    task.currentSubtaskId = sub.id;
  }
  state.tasks.push(task);
  if (!state.activeTaskId) state.activeTaskId = task.id;
  ensureActivePointer();
  saveState();
  els.taskInput.value = els.firstStepInput.value = '';
  els.taskInput.focus();
  render();
  showToast('Tarea agregada. Un ladrillo menos en la torre del desorden.');
}

function submitComposerOnEnter(e) { if (e.key === 'Enter') addTaskFromComposer(); }

function addSubtaskToTask(taskId, title) {
  const clean = title.trim();
  const task  = getTask(taskId);
  if (!task) return;
  if (!clean) {
    showToast('La subtarea necesita texto. Una subtarea invisible sería muy poética, pero inútil.');
    return;
  }
  const sub = createSubtask(clean);
  task.subtasks.push(sub);
  task.done = false;
  if (!task.currentSubtaskId || !task.subtasks.find((s) => s.id === task.currentSubtaskId && !s.done)) {
    task.currentSubtaskId = sub.id;
  }
  if (!state.activeTaskId) state.activeTaskId = task.id;
  ensureActivePointer();
  saveState();
  render();
  showToast('Subtarea agregada donde sí era. Milagro de UX.');
}

function completeCurrentStepAndRotate() {
  const prevProgress = getTotalSteps()
    ? Math.round((getDoneSteps() / getTotalSteps()) * 100) : 0;

  ensureActivePointer();
  const task = getTask(state.activeTaskId);
  if (!task) { showToast('No hay tarea activa. Tranquilidad sospechosa.'); render(); return; }

  const sub        = getCurrentSubtask(task);
  const wasLastSub = sub && task.subtasks.filter((s) => !s.done).length === 1;

  if (sub) { sub.done = true; ensureTaskSubtaskPointer(task); }
  else      { task.done = true; }

  const nextTask     = findNextPendingTask(task.id);
  state.activeTaskId = nextTask?.id || null;
  ensureActivePointer();
  saveState();
  render();

  // 🎯 Dopamina
  onStepCompleted(els.completeCurrentBtn);
  const nextProgress = getTotalSteps()
    ? Math.round((getDoneSteps() / getTotalSteps()) * 100) : 0;
  checkProgressMilestone(prevProgress, nextProgress);

  if (!state.activeTaskId)     showToast('🏆 Todo listo. Día ganado. Sospechoso, pero precioso.');
  else if (wasLastSub)         showToast('✓ ¡Tarea completada! Rotando a la siguiente.');
  else                         showToast('Paso completado. X rotó a lo siguiente.');
}

function rotateOnly() {
  ensureActivePointer();
  const current = getTask(state.activeTaskId);
  advanceCurrentSubtaskPointer(current);
  const next = findNextPendingTask(state.activeTaskId);
  if (!next) { showToast('No hay pendientes para rotar. Inusual, casi mítico.'); render(); return; }
  state.activeTaskId = next.id;
  ensureTaskSubtaskPointer(next);
  saveState();
  render();
  showToast('X rotó sin completar. Permitiremos esta pequeña evasión.');
}

function setActiveTask(taskId) {
  const task = getTask(taskId);
  if (!task || task.done) return;
  state.activeTaskId = taskId;
  ensureTaskSubtaskPointer(task);
  saveState();
  render();
}

function setActiveSubtask(taskId, subtaskId) {
  const task = getTask(taskId);
  const sub  = task?.subtasks.find((s) => s.id === subtaskId);
  if (!task || !sub || sub.done) return;
  task.currentSubtaskId = subtaskId;
  task.done = false;
  state.activeTaskId = taskId;
  saveState();
  render();
  showToast('X y * actualizados. Orden mínimo restaurado.');
}

function toggleTaskDone(taskId) {
  const task = getTask(taskId);
  if (!task) return;
  const next = !task.done;
  task.done = next;
  task.subtasks.forEach((s) => { s.done = next; });
  task.currentSubtaskId = next ? null : task.subtasks.find((s) => !s.done)?.id || null;
  ensureActivePointer();
  saveState();
  render();
}

function toggleSubtaskDone(taskId, subtaskId) {
  const task = getTask(taskId);
  const sub  = task?.subtasks.find((s) => s.id === subtaskId);
  if (!task || !sub) return;
  sub.done = !sub.done;
  if (!sub.done) { task.done = false; if (!task.currentSubtaskId) task.currentSubtaskId = sub.id; }
  ensureTaskSubtaskPointer(task);
  ensureActivePointer();
  saveState();
  render();
}

function editTask(taskId) {
  const task = getTask(taskId);
  if (!task) return;
  const next = prompt('Editar tarea:', task.title);
  if (next === null) return;
  const clean = next.trim();
  if (!clean) return;
  task.title = clean;
  saveState();
  render();
}

function editSubtask(taskId, subtaskId) {
  const task = getTask(taskId);
  const sub  = task?.subtasks.find((s) => s.id === subtaskId);
  if (!sub) return;
  const next = prompt('Editar subtarea:', sub.title);
  if (next === null) return;
  const clean = next.trim();
  if (!clean) return;
  sub.title = clean;
  saveState();
  render();
}

function deleteTask(taskId) {
  const task = getTask(taskId);
  if (!task || !confirm(`¿Borrar la tarea "${task.title}"?`)) return;
  state.tasks = state.tasks.filter((t) => t.id !== taskId);
  ensureActivePointer();
  saveState();
  render();
  showToast('Tarea borrada. Que el basurero digital la reciba.');
}

function deleteSubtask(taskId, subtaskId) {
  const task = getTask(taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId);
  ensureTaskSubtaskPointer(task);
  ensureActivePointer();
  saveState();
  render();
}

function changeTaskPriority(taskId) {
  const task = getTask(taskId);
  if (!task) return;
  const order = ['urgent','high','normal'];
  task.priority = order[(order.indexOf(task.priority) + 1) % order.length];
  saveState();
  render();
}

function moveTask(taskId, dir) {
  const idx = state.tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;
  const next = idx + dir;
  if (next < 0 || next >= state.tasks.length) return;
  const [task] = state.tasks.splice(idx, 1);
  state.tasks.splice(next, 0, task);
  saveState();
  render();
}

// ─── BOARD HANDLERS ──────────────────────────────────────────────────────────

function handleBoardClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const taskId = btn.closest('[data-task-id]')?.dataset.taskId;
  const subId  = btn.closest('[data-subtask-id]')?.dataset.subtaskId;
  const map = {
    'active-task':    () => setActiveTask(taskId),
    'toggle-task':    () => toggleTaskDone(taskId),
    'edit-task':      () => editTask(taskId),
    'delete-task':    () => deleteTask(taskId),
    'priority-task':  () => changeTaskPriority(taskId),
    'move-up':        () => moveTask(taskId, -1),
    'move-down':      () => moveTask(taskId, 1),
    'active-subtask': () => setActiveSubtask(taskId, subId),
    'toggle-subtask': () => toggleSubtaskDone(taskId, subId),
    'edit-subtask':   () => editSubtask(taskId, subId),
    'delete-subtask': () => deleteSubtask(taskId, subId),
  };
  map[btn.dataset.action]?.();
}

function handleBoardSubmit(e) {
  const form = e.target.closest('[data-subtask-form]');
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector('input[name="subtask"]');
  addSubtaskToTask(form.closest('[data-task-id]')?.dataset.taskId, input.value);
  input.value = '';
  input.focus();
}

// ─── IMPORT / EXPORT ─────────────────────────────────────────────────────────

function parseMarkerText(raw) {
  let text    = raw.trim();
  const hasStar = /\*\s*$/.test(text);
  const hasX    = /(?:^|\s)x\s*$/i.test(text);
  text = text.replace(/^!+\s*/,'').replace(/\[\s*urgente\s*\]/ig,'')
             .replace(/\*\s*$/,'').replace(/(?:^|\s)x\s*$/i,'').trim();
  return { text, hasStar, hasX, priority: 'urgent' };
}

function parseList(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tasks = [];
  let curr = null, activeTaskId = null, firstStarId = null;

  for (const line of lines) {
    const num = line.match(/^\d+[.)]\s*(.+)$/);
    const bul = line.match(/^[-•*]\s*(.+)$/);
    if (num) {
      const m = parseMarkerText(num[1]);
      if (!m.text) continue;
      curr = createTask(m.text, m.priority);
      tasks.push(curr);
      if (m.hasX) activeTaskId = curr.id;
      if (m.hasStar && !firstStarId) firstStarId = curr.id;
      continue;
    }
    if (bul) {
      const m = parseMarkerText(bul[1]);
      if (!m.text) continue;
      if (!curr) { curr = createTask(m.text, m.priority); tasks.push(curr); }
      else {
        const sub = createSubtask(m.text);
        curr.subtasks.push(sub);
        if (m.hasStar) { curr.currentSubtaskId = sub.id; if (!firstStarId) firstStarId = curr.id; }
        if (m.hasX) activeTaskId = curr.id;
      }
      continue;
    }
    const m = parseMarkerText(line);
    if (!m.text) continue;
    curr = createTask(m.text, m.priority);
    tasks.push(curr);
    if (m.hasX) activeTaskId = curr.id;
    if (m.hasStar && !firstStarId) firstStarId = curr.id;
  }
  tasks.forEach(ensureTaskSubtaskPointer);
  return { tasks, activeTaskId: activeTaskId || firstStarId || tasks.find((t) => !t.done)?.id || null };
}

function openImportModal() {
  els.importTextarea.value = '';
  els.importModal.classList.remove('hidden');
  setTimeout(() => els.importTextarea.focus(), 0);
}
function closeImportModal() { els.importModal.classList.add('hidden'); }

function importFromTextarea() {
  const raw = els.importTextarea.value.trim();
  if (!raw) { showToast('Pega una lista primero. El vacío no rota, solo decepciona.'); return; }
  const parsed = parseList(raw);
  if (!parsed.tasks.length) { showToast('No encontré tareas válidas. El bloc ganó esta ronda.'); return; }
  state.tasks        = parsed.tasks;
  state.activeTaskId = parsed.activeTaskId;
  state.filter       = 'all';
  state.search       = '';
  state.date         = todayKey();
  els.searchInput.value = '';
  ensureActivePointer();
  saveState();
  closeImportModal();
  render();
  showToast('Lista importada. Ya se puede pelear contra el día con dignidad.');
}

function resetDay() {
  if (!confirm('¿Crear una jornada nueva? Esto borra las tareas actuales de este navegador.')) return;
  state         = structuredClone(defaultState);
  dopamineState = { date: todayKey(), streak: 0, combo: 0, lastTime: 0, xp: 0 };
  saveDopamine();
  stopTimer();
  timerState = { ...defaultTimer };
  saveState();
  saveTimer();
  render();
  updateTimerDisplay();
  updateTimerUrgency();
  updateStreakBar();
  showToast('Jornada nueva. Pantalla limpia, mente todavía en garantía dudosa.');
}

function copySummary() {
  const date  = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });
  const lines = [`Seguimiento urgente · ${date}`];
  state.tasks.forEach((t, i) => {
    lines.push(`${i+1}. ${t.title}${t.id === state.activeTaskId ? ' x':''}${t.done ? ' ✓':''}`);
    t.subtasks.forEach((s) =>
      lines.push(`- ${s.title}${s.id === t.currentSubtaskId && !s.done ? ' *':''}${s.done ? ' ✓':''}`));
  });
  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => showToast('Resumen copiado. El bloc de notas puede respirar.'))
    .catch(() => showToast('No pude copiar. El navegador decidió ser personaje.'));
}

// ─── FILTERS / STATS ─────────────────────────────────────────────────────────

function taskMatchesFilter(t) {
  if (state.filter === 'pending') return !t.done;
  if (state.filter === 'done')    return  t.done;
  if (state.filter === 'urgent')  return  t.priority === 'urgent' && !t.done;
  if (state.filter === 'active')  return  t.id === state.activeTaskId;
  return true;
}
function taskMatchesSearch(t) {
  const q = state.search.toLowerCase();
  if (!q) return true;
  return [t.title, priorityLabel(t.priority), ...t.subtasks.map((s) => s.title)]
    .join(' ').toLowerCase().includes(q);
}

function getTotalSteps() { return state.tasks.reduce((n,t) => n + Math.max(t.subtasks.length,1), 0); }
function getDoneSteps()  {
  return state.tasks.reduce((n,t) => {
    if (t.subtasks.length) return n + t.subtasks.filter((s) => s.done).length;
    return n + (t.done ? 1 : 0);
  }, 0);
}
function getPendingSteps() { return Math.max(0, getTotalSteps() - getDoneSteps()); }

// ─── RENDER ──────────────────────────────────────────────────────────────────

function render() {
  ensureActivePointer();
  els.searchInput.value = state.search;
  $$('.chip').forEach((btn) => btn.classList.toggle('active', btn.dataset.filter === state.filter));
  renderFocus();
  renderStats();
  renderTasks();
}

function renderFocus() {
  const task = getTask(state.activeTaskId);
  const sub  = getCurrentSubtask(task);
  if (!task) {
    els.activeBadge.textContent = 'Sin X';
    els.activeBadge.classList.remove('active');
    els.currentTaskTitle.textContent = 'No hay tarea activa';
    els.currentStepTitle.textContent = 'Agrega una tarea urgente para empezar.';
    els.completeCurrentBtn.disabled = els.rotateBtn.disabled = els.activeSubtaskInput.disabled = true;
    return;
  }
  els.activeBadge.textContent = sub ? 'X + *' : 'X actual';
  els.activeBadge.classList.add('active');
  els.currentTaskTitle.textContent = task.title;
  els.currentStepTitle.innerHTML   = sub
    ? `<strong>*</strong> ${escapeHtml(sub.title)}`
    : 'Sin subtareas: puedes completar esta tarea como bloque o agregarle pasos.';
  els.completeCurrentBtn.disabled = els.rotateBtn.disabled = els.activeSubtaskInput.disabled = false;
}

function renderStats() {
  const done = getDoneSteps(), total = getTotalSteps();
  const progress = total ? Math.round((done / total) * 100) : 0;
  els.statTasks.textContent        = state.tasks.length;
  els.statPendingSteps.textContent = getPendingSteps();
  els.statDoneSteps.textContent    = done;
  els.progressText.textContent     = `${progress}%`;
  els.progressBar.style.width      = `${progress}%`;
}

function renderTasks() {
  const visible = state.tasks.filter((t) => taskMatchesFilter(t) && taskMatchesSearch(t));
  els.taskBoard.innerHTML = visible.length
    ? visible.map(taskTemplate).join('')
    : `<article class="empty-state">
         <h2>No hay tareas para mostrar</h2>
         <p>Agrega una tarea urgente, cambia el filtro o importa una lista. La nada también cansa.</p>
       </article>`;
}

function taskTemplate(task) {
  const isActive  = task.id === state.activeTaskId;
  const doneCount = task.subtasks.length ? task.subtasks.filter((s) => s.done).length : (task.done ? 1 : 0);
  const totalCount= Math.max(task.subtasks.length, 1);
  const progress  = Math.round((doneCount / totalCount) * 100);
  const hasSubs   = task.subtasks.length > 0;
  return `
    <article class="task-card ${isActive ? 'active':''} ${task.done ? 'done':''}" data-task-id="${task.id}">
      <div class="task-head">
        <div class="task-title-wrap">
          <div class="task-title">
            ${isActive ? '<span class="active-badge">X</span>' : ''}
            <span class="task-title-text">${escapeHtml(task.title)}</span>
          </div>
          <div class="task-meta">
            <span class="priority-pill ${task.priority}">${priorityLabel(task.priority)}</span>
            <span class="count-pill">${doneCount}/${totalCount} pasos</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="secondary-btn small" data-action="active-task"   type="button">Poner X</button>
          <button class="ghost-btn small"     data-action="priority-task" type="button">Prioridad</button>
          <button class="ghost-btn small"     data-action="edit-task"     type="button">Editar</button>
          <button class="danger-btn small"    data-action="delete-task"   type="button">Borrar</button>
        </div>
      </div>
      <div class="progress-block" aria-hidden="true">
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
      </div>
      ${hasSubs
        ? `<ul class="subtask-list">${task.subtasks.map((s) => subtaskTemplate(task, s)).join('')}</ul>`
        : `<div class="empty-task-note">Esta tarea no tiene subtareas. Puedes completarla como bloque o dividirla abajo.</div>
           <ul class="subtask-list" aria-label="Acciones de tarea">
             <li class="subtask-row ${isActive?'active':''} ${task.done?'done':''}">
               <div class="subtask-main"><span class="check-dot">✓</span><span class="subtask-text">Tarea completa</span></div>
               <div class="subtask-actions">
                 <button class="secondary-btn small" data-action="toggle-task" type="button">${task.done?'Reabrir':'Completar'}</button>
               </div>
             </li>
           </ul>`
      }
      <form class="inline-subtask-form" data-subtask-form>
        <label>Agregar subtarea a esta tarea</label>
        <div class="inline-input-row">
          <input name="subtask" type="text" placeholder="Ej: primer paso concreto" autocomplete="off" />
          <button class="secondary-btn" type="submit">+ Subtarea</button>
        </div>
      </form>
      <div class="task-footer">
        <span class="muted">Orden de rotación</span>
        <div class="task-order-actions">
          <button class="ghost-btn small" data-action="move-up"   type="button" aria-label="Subir tarea">↑</button>
          <button class="ghost-btn small" data-action="move-down" type="button" aria-label="Bajar tarea">↓</button>
        </div>
      </div>
    </article>`;
}

function subtaskTemplate(task, sub) {
  const isCurrent = sub.id === task.currentSubtaskId && !sub.done;
  const isVisible = task.id === state.activeTaskId && isCurrent;
  return `
    <li class="subtask-row ${isVisible?'active':''} ${sub.done?'done':''}" data-subtask-id="${sub.id}">
      <div class="subtask-main">
        <span class="check-dot">✓</span>
        ${isCurrent ? '<span class="subtask-star">*</span>' : ''}
        <span class="subtask-text">${escapeHtml(sub.title)}</span>
      </div>
      <div class="subtask-actions">
        <button class="secondary-btn small" data-action="toggle-subtask"  type="button">${sub.done?'Reabrir':'Listo'}</button>
        <button class="ghost-btn small"     data-action="active-subtask"  type="button">Poner *</button>
        <button class="ghost-btn small"     data-action="edit-subtask"    type="button">Editar</button>
        <button class="danger-btn small"    data-action="delete-subtask"  type="button">×</button>
      </div>
    </li>`;
}

function priorityLabel(p) { return { urgent:'Urgente', high:'Alta', normal:'Normal' }[p] || 'Urgente'; }

// ─── FOCUS MODE ──────────────────────────────────────────────────────────────

function toggleFocusMode() {
  document.body.classList.toggle('focus-only');
  els.focusModeBtn.textContent = document.body.classList.contains('focus-only') ? 'Ver tablero' : 'Modo foco';
}

// ─── TIMER ───────────────────────────────────────────────────────────────────

function applyTimerPreset(v) {
  const m = clampMinutes(v);
  timerState.durationMinutes = m;
  timerState.seconds         = m * 60;
  timerState.running         = false;
  stopTimer();
  els.timerToggleBtn.textContent = 'Iniciar';
  updateTimerDisplay();
  updateTimerUrgency();
  saveTimer();
  showToast(`Sprint ajustado a ${m} minutos.`);
}

function toggleTimer() {
  if (!timerState.seconds) timerState.seconds = timerState.durationMinutes * 60;
  timerState.running = !timerState.running;
  if (timerState.running) { startTimer(); els.timerToggleBtn.textContent = 'Pausar'; }
  else                    { stopTimer();  els.timerToggleBtn.textContent = 'Iniciar'; }
}

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    timerState.seconds -= 1;
    if (timerState.seconds <= 0) {
      timerState.seconds = 0;
      timerState.running = false;
      stopTimer();
      els.timerToggleBtn.textContent = 'Iniciar';
      showToast('⏱ Sprint terminado. Mira la X y decide: completar o rotar.');
    }
    updateTimerDisplay();
    updateTimerUrgency();
    saveTimer();
  }, 1000);
}

function stopTimer() { if (timerInterval) clearInterval(timerInterval); timerInterval = null; }

function resetTimer() {
  timerState.seconds = timerState.durationMinutes * 60;
  timerState.running = false;
  stopTimer();
  els.timerToggleBtn.textContent = 'Iniciar';
  updateTimerDisplay();
  updateTimerUrgency();
  saveTimer();
}

function updateTimerDisplay() {
  const m = Math.floor(timerState.seconds / 60).toString().padStart(2, '0');
  const s = (timerState.seconds % 60).toString().padStart(2, '0');
  els.timerDisplay.textContent = `${m}:${s}`;
}

function updateTimerUrgency() {
  const el  = els.timerDisplay;
  const pct = timerState.durationMinutes > 0
    ? timerState.seconds / (timerState.durationMinutes * 60) : 1;
  el.classList.remove('timer-ok', 'timer-warn', 'timer-critical');
  if (!timerState.running)  { el.classList.add('timer-ok');       return; }
  if (pct <= 0.15)            el.classList.add('timer-critical');
  else if (pct <= 0.35)       el.classList.add('timer-warn');
  else                        el.classList.add('timer-ok');
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 2800);
}

// ─── PWA ─────────────────────────────────────────────────────────────────────

function setupPwa() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
