const STORAGE_KEY = 'rotador_tdah_alek_v3';
const TIMER_KEY = 'rotador_tdah_alek_timer_v2';

const sampleText = `Seguimiento de tareas del día
0. Apps personal y laboral
1. Vacante (mejorar video brief)
- Linked in (hacer retroalimentaciones de Viva correo, cambiar foto)
- Indeed
- Computrabajo *
- Cursos de música
- Cursos extra
- Material pedagógico para vender (libros para colorear)
- Cursos de artes
- Espíritu floral
- Pasifae skincare
1. Secretaría
2. Checklist
• Salvemoslos del reggaetón minuto a minuto *
• Salvemoslos partituras
3. Bloc de notas
4. Organización física/sede
5. Marketing x
- Configuración de campañas
- Creación de contenido *`;

const defaultState = {
  date: todayKey(),
  activeTaskId: null,
  filter: 'all',
  search: '',
  settings: {
    theme: 'tech'
  },
  tasks: []
};

let state = loadState();
let timerState = loadTimer();
let timerInterval = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  todayLabel: $('#todayLabel'),
  currentStatus: $('#currentStatus'),
  currentTaskTitle: $('#currentTaskTitle'),
  currentSubtaskTitle: $('#currentSubtaskTitle'),
  globalProgressBar: $('#globalProgressBar'),
  globalProgressText: $('#globalProgressText'),
  statTasks: $('#statTasks'),
  statDone: $('#statDone'),
  statPending: $('#statPending'),
  taskBoard: $('#taskBoard'),
  taskInput: $('#taskInput'),
  subtaskInput: $('#subtaskInput'),
  energyInput: $('#energyInput'),
  addTaskBtn: $('#addTaskBtn'),
  searchInput: $('#searchInput'),
  importBtn: $('#importBtn'),
  exportBtn: $('#exportBtn'),
  resetDayBtn: $('#resetDayBtn'),
  importModal: $('#importModal'),
  closeImportBtn: $('#closeImportBtn'),
  importTextarea: $('#importTextarea'),
  parseImportBtn: $('#parseImportBtn'),
  loadSampleBtn: $('#loadSampleBtn'),
  completeCurrentBtn: $('#completeCurrentBtn'),
  nextCurrentBtn: $('#nextCurrentBtn'),
  toggleZenBtn: $('#toggleZenBtn'),
  timerDisplay: $('#timerDisplay'),
  timerToggleBtn: $('#timerToggleBtn'),
  timerResetBtn: $('#timerResetBtn'),
  timerMinutesInput: $('#timerMinutesInput'),
  timerEndActionInput: $('#timerEndActionInput'),
  applyTimerSettingsBtn: $('#applyTimerSettingsBtn'),
  themeInput: $('#themeInput'),
  toast: $('#toast')
};

init();

function init() {
  migrateStateShape();

  if (!state.tasks.length) {
    const parsed = parseBlocText(sampleText);
    state.tasks = parsed.tasks;
    state.activeTaskId = parsed.activeTaskId;
    ensureActivePointer();
    saveState();
  }

  applyTheme();
  bindEvents();
  setTodayLabel();
  syncSettingsInputs();
  render();
  setupPwa();
  updateTimerDisplay();
}

function bindEvents() {
  els.addTaskBtn.addEventListener('click', addTaskFromComposer);
  els.taskInput.addEventListener('keydown', submitComposerOnEnter);
  els.subtaskInput.addEventListener('keydown', submitComposerOnEnter);

  els.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value.trim();
    saveState();
    renderTasks();
  });

  $$('.chip').forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      saveState();
      render();
    });
  });

  els.importBtn.addEventListener('click', openImportModal);
  els.closeImportBtn.addEventListener('click', closeImportModal);
  els.importModal.addEventListener('click', (event) => {
    if (event.target === els.importModal) closeImportModal();
  });
  els.loadSampleBtn.addEventListener('click', () => {
    els.importTextarea.value = sampleText;
    showToast('Ejemplo cargado. El bloc, pero con menos vibra de Windows 98.');
  });
  els.parseImportBtn.addEventListener('click', importFromTextarea);

  els.completeCurrentBtn.addEventListener('click', completeCurrentStepAndRotateTask);
  els.nextCurrentBtn.addEventListener('click', rotateOnly);
  els.exportBtn.addEventListener('click', copySummary);
  els.resetDayBtn.addEventListener('click', resetDay);
  els.toggleZenBtn.addEventListener('click', toggleZenMode);

  els.timerToggleBtn.addEventListener('click', toggleTimer);
  els.timerResetBtn.addEventListener('click', resetTimer);
  els.applyTimerSettingsBtn.addEventListener('click', applyTimerSettings);
  els.timerMinutesInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyTimerSettings();
  });
  els.timerEndActionInput.addEventListener('change', applyTimerSettings);
  els.themeInput.addEventListener('change', (event) => {
    state.settings.theme = event.target.value;
    applyTheme();
    saveState();
    showToast('Tema cambiado. Ya no parece invitación a baby shower digital.');
  });
  document.querySelectorAll('[data-timer-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      els.timerMinutesInput.value = button.dataset.timerPreset;
      applyTimerSettings();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea, select')) return;
    if (event.key.toLowerCase() === 'n') completeCurrentStepAndRotateTask();
    if (event.key.toLowerCase() === 'r') rotateOnly();
    if (event.key.toLowerCase() === 'f') toggleZenMode();
    if (event.key === 'Escape') closeImportModal();
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('rotador_tdah_alek_v2') || localStorage.getItem('rotador_tdah_alek_v1');
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  } catch (error) {
    console.warn('No se pudo cargar el estado local:', error);
    return structuredClone(defaultState);
  }
}

function migrateStateShape() {
  state.settings = { ...defaultState.settings, ...(state.settings || {}) };

  state.tasks = (state.tasks || []).map((task) => ({
    id: task.id || uid('task'),
    title: task.title || 'Tarea sin nombre',
    energy: task.energy || 'media',
    done: Boolean(task.done),
    collapsed: Boolean(task.collapsed),
    currentSubtaskId: task.currentSubtaskId || task.activeSubtaskId || null,
    subtasks: (task.subtasks || []).map((subtask) => ({
      id: subtask.id || uid('sub'),
      title: subtask.title || 'Subtarea sin nombre',
      done: Boolean(subtask.done)
    }))
  }));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadTimer() {
  const fallback = { durationMinutes: 25, seconds: 25 * 60, running: false, endAction: 'notify' };
  try {
    const raw = localStorage.getItem(TIMER_KEY) || localStorage.getItem('rotador_tdah_alek_timer_v1');
    if (!raw) return fallback;
    const parsed = { ...fallback, ...JSON.parse(raw), running: false };
    parsed.durationMinutes = clampMinutes(parsed.durationMinutes || Math.round(parsed.seconds / 60) || 25);
    parsed.seconds = Math.max(0, Number(parsed.seconds) || parsed.durationMinutes * 60);
    if (!['notify', 'rotate', 'complete'].includes(parsed.endAction)) parsed.endAction = 'notify';
    return parsed;
  } catch {
    return fallback;
  }
}

function saveTimer() {
  localStorage.setItem(TIMER_KEY, JSON.stringify({
    durationMinutes: timerState.durationMinutes,
    seconds: timerState.seconds,
    running: false,
    endAction: timerState.endAction
  }));
}

function clampMinutes(value) {
  const minutes = Number.parseInt(value, 10);
  if (Number.isNaN(minutes)) return 25;
  return Math.min(180, Math.max(1, minutes));
}

function applyTheme() {
  const theme = state.settings?.theme || 'tech';
  document.body.dataset.theme = theme;
}

function syncSettingsInputs() {
  els.timerMinutesInput.value = timerState.durationMinutes;
  els.timerEndActionInput.value = timerState.endAction;
  els.themeInput.value = state.settings?.theme || 'tech';
}

function applyTimerSettings() {
  const nextMinutes = clampMinutes(els.timerMinutesInput.value);
  const nextEndAction = els.timerEndActionInput.value;
  const wasRunning = timerState.running;

  timerState.durationMinutes = nextMinutes;
  timerState.endAction = ['notify', 'rotate', 'complete'].includes(nextEndAction) ? nextEndAction : 'notify';
  timerState.seconds = nextMinutes * 60;
  timerState.running = false;
  stopTimer();
  els.timerToggleBtn.textContent = 'Iniciar';
  syncSettingsInputs();
  updateTimerDisplay();
  saveTimer();

  showToast(wasRunning ? 'Ajuste aplicado y temporizador reiniciado.' : `Sprint ajustado a ${nextMinutes} minutos.`);
}


function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function setTodayLabel() {
  const formatter = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  els.todayLabel.textContent = formatter.format(new Date());
}

function normalizeMarkerText(text) {
  let cleaned = text.trim();
  const hasStar = /\*\s*$/.test(cleaned);
  const hasX = /(?:\s|^)x\s*$/i.test(cleaned);
  cleaned = cleaned.replace(/\*\s*$/, '').replace(/(?:\s|^)x\s*$/i, '').trim();
  return { text: cleaned, hasStar, hasX };
}

function parseBlocText(rawText) {
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const tasks = [];
  let currentTask = null;
  let parsedActiveTaskId = null;
  let firstStarredTaskId = null;

  for (const line of lines) {
    const isTitle = /^seguimiento\s+de\s+tareas/i.test(line);
    if (isTitle) continue;

    const numberedMatch = line.match(/^\d+[.)]\s*(.+)$/);
    const bulletMatch = line.match(/^[-•*]\s*(.+)$/);

    if (numberedMatch) {
      const { text, hasStar, hasX } = normalizeMarkerText(numberedMatch[1]);
      if (!text) continue;
      currentTask = createTask(text, 'media');
      tasks.push(currentTask);
      if (hasX) parsedActiveTaskId = currentTask.id;
      if (hasStar && !firstStarredTaskId) firstStarredTaskId = currentTask.id;
      continue;
    }

    if (bulletMatch) {
      const { text, hasStar, hasX } = normalizeMarkerText(bulletMatch[1]);
      if (!text) continue;

      if (!currentTask) {
        currentTask = createTask(text, 'media');
        tasks.push(currentTask);
      } else {
        const subtask = createSubtask(text);
        currentTask.subtasks.push(subtask);
        if (hasStar) {
          currentTask.currentSubtaskId = subtask.id;
          if (!firstStarredTaskId) firstStarredTaskId = currentTask.id;
        }
        if (hasX) parsedActiveTaskId = currentTask.id;
        continue;
      }

      if (hasX) parsedActiveTaskId = currentTask.id;
      if (hasStar && !firstStarredTaskId) firstStarredTaskId = currentTask.id;
      continue;
    }

    const { text, hasStar, hasX } = normalizeMarkerText(line);
    if (!text) continue;
    currentTask = createTask(text, 'media');
    tasks.push(currentTask);
    if (hasX) parsedActiveTaskId = currentTask.id;
    if (hasStar && !firstStarredTaskId) firstStarredTaskId = currentTask.id;
  }

  tasks.forEach(ensureTaskSubtaskPointer);

  return {
    tasks,
    activeTaskId: parsedActiveTaskId || firstStarredTaskId || tasks.find(task => !task.done)?.id || null
  };
}

function createTask(title, energy = 'media') {
  return {
    id: uid('task'),
    title,
    energy,
    done: false,
    collapsed: false,
    currentSubtaskId: null,
    subtasks: []
  };
}

function createSubtask(title) {
  return {
    id: uid('sub'),
    title,
    done: false
  };
}

function ensureTaskSubtaskPointer(task) {
  if (!task.subtasks.length) {
    task.currentSubtaskId = null;
    return;
  }

  const pointed = task.subtasks.find(sub => sub.id === task.currentSubtaskId && !sub.done);
  if (pointed) return;

  const nextPending = task.subtasks.find(sub => !sub.done);
  task.currentSubtaskId = nextPending?.id ?? null;
  task.done = !nextPending;
}

function ensureActivePointer() {
  state.tasks.forEach(ensureTaskSubtaskPointer);

  const activeTask = getTask(state.activeTaskId);
  if (activeTask && !activeTask.done) return;

  const next = findNextPendingTask();
  state.activeTaskId = next?.id ?? null;
}

function getTask(taskId) {
  return state.tasks.find(task => task.id === taskId) ?? null;
}

function getCurrentSubtask(task) {
  if (!task?.subtasks?.length) return null;
  ensureTaskSubtaskPointer(task);
  return task.subtasks.find(sub => sub.id === task.currentSubtaskId) ?? null;
}

function findNextPendingTask(startAfterTaskId = null) {
  const pendingTasks = state.tasks.filter(task => !task.done);
  if (!pendingTasks.length) return null;
  if (!startAfterTaskId) return pendingTasks[0];

  const currentIndex = state.tasks.findIndex(task => task.id === startAfterTaskId);
  const after = state.tasks.find((task, index) => index > currentIndex && !task.done);
  return after || pendingTasks[0];
}

function addTaskFromComposer() {
  const title = els.taskInput.value.trim();
  const subtaskTitle = els.subtaskInput.value.trim();
  const energy = els.energyInput.value;

  if (!title && !subtaskTitle) {
    showToast('Pon algo, Alek. La app no adivina todavía, por fortuna.');
    return;
  }

  if (title) {
    const task = createTask(title, energy);
    if (subtaskTitle) {
      const subtask = createSubtask(subtaskTitle);
      task.subtasks.push(subtask);
      task.currentSubtaskId = subtask.id;
    }
    state.tasks.push(task);
  } else {
    const activeTask = getTask(state.activeTaskId) ?? state.tasks[state.tasks.length - 1];
    if (!activeTask) {
      showToast('Necesitas una tarea base antes de meterle subtareas.');
      return;
    }
    const subtask = createSubtask(subtaskTitle);
    activeTask.subtasks.push(subtask);
    activeTask.done = false;
    if (!activeTask.currentSubtaskId) activeTask.currentSubtaskId = subtask.id;
  }

  ensureActivePointer();
  saveState();
  els.taskInput.value = '';
  els.subtaskInput.value = '';
  render();
  showToast('Agregado. Otro ladrillito contra el caos 🧱');
}

function submitComposerOnEnter(event) {
  if (event.key === 'Enter') addTaskFromComposer();
}

function openImportModal() {
  els.importTextarea.value = '';
  els.importModal.classList.remove('hidden');
  setTimeout(() => els.importTextarea.focus(), 0);
}

function closeImportModal() {
  els.importModal.classList.add('hidden');
}

function importFromTextarea() {
  const raw = els.importTextarea.value.trim();
  if (!raw) {
    showToast('Pega la lista primero. El vacío no se organiza, se contempla.');
    return;
  }

  const parsed = parseBlocText(raw);
  if (!parsed.tasks.length) {
    showToast('No encontré tareas reconocibles. El bloc ganó esta ronda.');
    return;
  }

  state.tasks = parsed.tasks;
  state.activeTaskId = parsed.activeTaskId;
  state.date = todayKey();
  ensureActivePointer();
  saveState();
  closeImportModal();
  render();
  showToast('Jornada importada y domesticada.');
}

function completeCurrentStepAndRotateTask() {
  ensureActivePointer();
  const task = getTask(state.activeTaskId);
  if (!task) {
    showToast('No hay tarea activa. Sospechosamente tranquilo.');
    render();
    return;
  }

  const subtask = getCurrentSubtask(task);

  if (subtask) {
    subtask.done = true;
    const nextSubtask = task.subtasks.find(sub => !sub.done);
    task.currentSubtaskId = nextSubtask?.id ?? null;
    task.done = !nextSubtask;
  } else {
    task.done = true;
  }

  const nextTask = findNextPendingTask(task.id);
  state.activeTaskId = nextTask?.id ?? null;
  ensureActivePointer();
  saveState();
  render();

  if (!nextTask) {
    showToast('Todo listo. Raro, sospechoso, pero hermoso ✨');
  } else {
    showToast('Paso listo. X rotó a la siguiente tarea.');
  }
}

function rotateOnly() {
  ensureActivePointer();
  const nextTask = findNextPendingTask(state.activeTaskId);

  if (!nextTask) {
    showToast('No hay nada pendiente para rotar. Respira, esa función ancestral.');
    return;
  }

  state.activeTaskId = nextTask.id;
  ensureActivePointer();
  saveState();
  render();
  showToast('X rotada sin completar. El sistema acepta tus excusas.');
}

function setActiveTask(taskId) {
  const task = getTask(taskId);
  if (!task || task.done) return;
  state.activeTaskId = taskId;
  ensureTaskSubtaskPointer(task);
  saveState();
  render();
  showToast('X movida. El destino ha sido actualizado.');
}

function setActiveSubtask(taskId, subtaskId) {
  const task = getTask(taskId);
  const subtask = task?.subtasks.find(item => item.id === subtaskId);
  if (!task || !subtask || subtask.done) return;
  task.currentSubtaskId = subtaskId;
  task.done = false;
  if (task.id === state.activeTaskId) ensureActivePointer();
  saveState();
  render();
  showToast('* movido dentro de esta tarea.');
}

function toggleTaskDone(taskId) {
  const task = getTask(taskId);
  if (!task) return;
  const nextDone = !task.done;
  task.done = nextDone;
  task.subtasks.forEach(sub => sub.done = nextDone);
  task.currentSubtaskId = nextDone ? null : task.subtasks[0]?.id ?? null;
  ensureActivePointer();
  saveState();
  render();
}

function toggleSubtaskDone(taskId, subtaskId) {
  const task = getTask(taskId);
  const subtask = task?.subtasks.find(sub => sub.id === subtaskId);
  if (!task || !subtask) return;

  subtask.done = !subtask.done;
  task.done = task.subtasks.every(sub => sub.done);
  ensureTaskSubtaskPointer(task);
  ensureActivePointer();
  saveState();
  render();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter(task => task.id !== taskId);
  ensureActivePointer();
  saveState();
  render();
  showToast('Tarea eliminada. Que descanse en el basurero digital.');
}

function deleteSubtask(taskId, subtaskId) {
  const task = getTask(taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter(sub => sub.id !== subtaskId);
  ensureTaskSubtaskPointer(task);
  ensureActivePointer();
  saveState();
  render();
}

function editTask(taskId) {
  const task = getTask(taskId);
  if (!task) return;
  const title = prompt('Editar tarea:', task.title);
  if (title === null) return;
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  task.title = cleanTitle;
  saveState();
  render();
}

function editSubtask(taskId, subtaskId) {
  const task = getTask(taskId);
  const subtask = task?.subtasks.find(sub => sub.id === subtaskId);
  if (!subtask) return;
  const title = prompt('Editar subtarea:', subtask.title);
  if (title === null) return;
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  subtask.title = cleanTitle;
  saveState();
  render();
}

function render() {
  ensureActivePointer();
  els.searchInput.value = state.search;
  $$('.chip').forEach(chip => chip.classList.toggle('active', chip.dataset.filter === state.filter));
  renderFocus();
  renderStats();
  renderTasks();
}

function renderFocus() {
  const task = getTask(state.activeTaskId);
  const subtask = getCurrentSubtask(task);

  if (!task) {
    els.currentTaskTitle.textContent = 'Jornada despejada';
    els.currentSubtaskTitle.textContent = 'No hay pendientes. Este silencio es legalmente sospechoso.';
    els.currentStatus.textContent = 'Sin X';
    els.completeCurrentBtn.disabled = true;
    els.nextCurrentBtn.disabled = true;
    return;
  }

  els.currentTaskTitle.textContent = task.title;
  els.currentSubtaskTitle.textContent = subtask ? `* ${subtask.title}` : 'Sin subtareas: completa esta tarea cuando cierres el bloque.';
  els.currentStatus.textContent = subtask ? 'X + * actual' : 'X actual';
  els.completeCurrentBtn.disabled = false;
  els.nextCurrentBtn.disabled = false;
}

function renderStats() {
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter(task => task.done).length;
  const pendingTasks = totalTasks - doneTasks;
  const totalSteps = getTotalSteps();
  const doneSteps = getDoneSteps();
  const progress = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  els.statTasks.textContent = totalTasks;
  els.statDone.textContent = doneTasks;
  els.statPending.textContent = pendingTasks;
  els.globalProgressBar.style.width = `${progress}%`;
  els.globalProgressText.textContent = `${progress}% de la jornada · ${doneSteps}/${totalSteps} pasos`;
}

function getTotalSteps() {
  return state.tasks.reduce((total, task) => total + Math.max(task.subtasks.length, 1), 0);
}

function getDoneSteps() {
  return state.tasks.reduce((total, task) => {
    if (task.subtasks.length) return total + task.subtasks.filter(sub => sub.done).length;
    return total + (task.done ? 1 : 0);
  }, 0);
}

function taskMatchesFilter(task) {
  const isActive = task.id === state.activeTaskId;
  if (state.filter === 'active') return isActive;
  if (state.filter === 'done') return task.done;
  if (state.filter === 'pending') return !task.done;
  return true;
}

function taskMatchesSearch(task) {
  const query = state.search.toLowerCase();
  if (!query) return true;
  const text = [task.title, ...task.subtasks.map(sub => sub.title)].join(' ').toLowerCase();
  return text.includes(query);
}

function renderTasks() {
  const visibleTasks = state.tasks.filter(task => taskMatchesFilter(task) && taskMatchesSearch(task));

  if (!visibleTasks.length) {
    els.taskBoard.innerHTML = `
      <article class="empty-state">
        <h2>No hay tareas para mostrar</h2>
        <p>Cambia el filtro, importa tu bloc o disfruta tres segundos de falsa paz.</p>
      </article>
    `;
    return;
  }

  els.taskBoard.innerHTML = visibleTasks.map(taskTemplate).join('');
  bindTaskBoardEvents();
}

function taskTemplate(task) {
  const isActive = task.id === state.activeTaskId;
  const doneCount = task.subtasks.length ? task.subtasks.filter(sub => sub.done).length : (task.done ? 1 : 0);
  const totalCount = Math.max(task.subtasks.length, 1);
  const progress = Math.round((doneCount / totalCount) * 100);
  const noSubtasks = !task.subtasks.length;

  return `
    <article class="task-card ${isActive ? 'active' : ''} ${task.done ? 'done' : ''}" data-task-id="${task.id}">
      <div class="task-head">
        <div class="task-title-wrap">
          <div class="task-title">
            ${isActive ? '<span class="active-badge">X</span>' : ''}
            <span>${escapeHtml(task.title)}</span>
          </div>
          <div class="task-meta">
            <span class="energy-pill ${task.energy}">${energyLabel(task.energy)}</span>
            <span class="count-pill">${doneCount}/${totalCount} pasos</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="ghost-btn" data-action="active-task" type="button">Poner X</button>
          <button class="ghost-btn" data-action="edit-task" type="button">Editar</button>
          <button class="danger-btn" data-action="delete-task" type="button">Borrar</button>
        </div>
      </div>

      <div class="focus-progress" aria-hidden="true">
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
      </div>

      ${noSubtasks ? `
        <ul class="subtask-list">
          <li class="subtask-row ${isActive ? 'active' : ''} ${task.done ? 'done' : ''}">
            <div class="subtask-main">
              <span class="check-dot">✓</span>
              <span class="subtask-text">Tarea completa</span>
            </div>
            <div class="subtask-actions">
              <button class="secondary-btn" data-action="toggle-task" type="button">${task.done ? 'Reabrir' : 'Completar'}</button>
            </div>
          </li>
        </ul>` : `
        <ul class="subtask-list">
          ${task.subtasks.map(subtaskTemplate(task)).join('')}
        </ul>`}
    </article>
  `;
}

function subtaskTemplate(task) {
  return (subtask) => {
    const isActiveStar = subtask.id === task.currentSubtaskId && !subtask.done;
    const isVisibleCurrent = task.id === state.activeTaskId && isActiveStar;
    return `
      <li class="subtask-row ${isVisibleCurrent ? 'active' : ''} ${subtask.done ? 'done' : ''}" data-subtask-id="${subtask.id}">
        <div class="subtask-main">
          <span class="check-dot">✓</span>
          ${isActiveStar ? '<span class="subtask-star">*</span>' : ''}
          <span class="subtask-text">${escapeHtml(subtask.title)}</span>
        </div>
        <div class="subtask-actions">
          <button class="secondary-btn" data-action="toggle-subtask" type="button">${subtask.done ? 'Reabrir' : 'Listo'}</button>
          <button class="ghost-btn" data-action="active-subtask" type="button">Poner *</button>
          <button class="ghost-btn" data-action="edit-subtask" type="button">Editar</button>
          <button class="danger-btn" data-action="delete-subtask" type="button">×</button>
        </div>
      </li>
    `;
  };
}

function bindTaskBoardEvents() {
  els.taskBoard.removeEventListener('click', handleBoardClick);
  els.taskBoard.addEventListener('click', handleBoardClick);
}

function handleBoardClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const taskEl = button.closest('[data-task-id]');
  const subtaskEl = button.closest('[data-subtask-id]');
  const taskId = taskEl?.dataset.taskId;
  const subtaskId = subtaskEl?.dataset.subtaskId;
  const action = button.dataset.action;

  if (action === 'active-task') setActiveTask(taskId);
  if (action === 'active-subtask') setActiveSubtask(taskId, subtaskId);
  if (action === 'toggle-task') toggleTaskDone(taskId);
  if (action === 'toggle-subtask') toggleSubtaskDone(taskId, subtaskId);
  if (action === 'delete-task') deleteTask(taskId);
  if (action === 'delete-subtask') deleteSubtask(taskId, subtaskId);
  if (action === 'edit-task') editTask(taskId);
  if (action === 'edit-subtask') editSubtask(taskId, subtaskId);
}

function energyLabel(energy) {
  const labels = { baja: 'Energía baja', media: 'Energía media', alta: 'Energía alta' };
  return labels[energy] ?? 'Energía media';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function copySummary() {
  const lines = [];
  lines.push(`Seguimiento de tareas del día · ${new Date().toLocaleDateString('es-CO')}`);
  state.tasks.forEach((task, index) => {
    const activeMark = task.id === state.activeTaskId ? ' x' : '';
    const doneMark = task.done ? ' ✓' : '';
    lines.push(`${index}. ${task.title}${activeMark}${doneMark}`);
    task.subtasks.forEach(subtask => {
      const subActive = subtask.id === task.currentSubtaskId && !subtask.done ? ' *' : '';
      const subDone = subtask.done ? ' ✓' : '';
      lines.push(`- ${subtask.title}${subActive}${subDone}`);
    });
  });

  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => showToast('Resumen copiado. Bloc de notas va a sentir celos.'))
    .catch(() => showToast('No pude copiarlo. El navegador se puso intenso.'));
}

function resetDay() {
  const ok = confirm('¿Crear una jornada nueva? Esto limpia las tareas actuales de este navegador.');
  if (!ok) return;
  const currentSettings = { ...defaultState.settings, ...(state.settings || {}) };
  state = { ...structuredClone(defaultState), settings: currentSettings };
  saveState();
  syncSettingsInputs();
  applyTheme();
  render();
  showToast('Jornada nueva. Tabula rasa, pero sin latín innecesario.');
}

function toggleZenMode() {
  document.body.classList.toggle('zen');
  const isZen = document.body.classList.contains('zen');
  els.toggleZenBtn.textContent = isZen ? 'Ver tablero' : 'Modo foco';
}

function toggleTimer() {
  if (!timerState.seconds) timerState.seconds = timerState.durationMinutes * 60;
  timerState.running = !timerState.running;
  if (timerState.running) {
    startTimer();
    els.timerToggleBtn.textContent = 'Pausar';
  } else {
    stopTimer();
    els.timerToggleBtn.textContent = 'Iniciar';
  }
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
      handleTimerFinished();
    }
    updateTimerDisplay();
    saveTimer();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  timerState.seconds = timerState.durationMinutes * 60;
  timerState.running = false;
  stopTimer();
  els.timerToggleBtn.textContent = 'Iniciar';
  updateTimerDisplay();
  saveTimer();
}

function handleTimerFinished() {
  if (timerState.endAction === 'rotate') {
    rotateOnly();
    showToast('Tiempo cumplido: X rotada sin completar. Prudente, como raro.');
    return;
  }

  if (timerState.endAction === 'complete') {
    completeCurrentStepAndRotateTask();
    showToast('Tiempo cumplido: paso completado y X rotada.');
    return;
  }

  showToast('Sprint terminado. Estira las manos, humano de oficina 🎧');
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerState.seconds / 60).toString().padStart(2, '0');
  const seconds = (timerState.seconds % 60).toString().padStart(2, '0');
  els.timerDisplay.textContent = `${minutes}:${seconds}`;
}

let toastTimeout;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function setupPwa() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Si se abre localmente con file://, el service worker no aplica. No pasa nada.
    });
  }
}
