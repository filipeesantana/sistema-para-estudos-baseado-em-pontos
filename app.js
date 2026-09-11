/* =========================================================================
   DIÁRIO DE ESTUDOS — v3.0
   Aplicação local-first. Sem backend, sem rede, sem dependências externas.

   Seções:
     CONSTANTS · UTILITIES · DATE HELPERS · DATABASE · MIGRATION
     DOMAIN MODELS · PLAN ENGINE · REVIEW ENGINE · RECOMMENDATION ENGINE
     ANALYTICS ENGINE · TIMER SERVICE · BACKUP · UI STATE · RENDERING
     EVENT HANDLERS · INITIALIZATION
   ========================================================================= */
'use strict';

/* =========================================================================
   CONSTANTS
   ========================================================================= */
const APP_VERSION = '3.0';
const APP_SCHEMA_VERSION = 3;          // versão do formato de dados da aplicação
const IDB_NAME = 'diarioEstudosDB';
const IDB_VERSION = 1;                 // versão do schema físico do IndexedDB
const V2_LS_KEY = 'diarioEstudos:v1';  // chave usada pela V2 (preservada, nunca apagada)
const TIMER_LS_KEY = 'diarioEstudos:v3:timer';
const THEME_LS_KEY = 'diarioEstudos:v3:theme';

const STORES = ['meta','areas','disciplines','topics','sessions','plans','weeklyPlans','deadlines','settings'];

const SESSION_TYPES = [
  { v:'teoria',      label:'Teoria' },
  { v:'exercicios',  label:'Exercícios' },
  { v:'laboratorio', label:'Laboratório' },
  { v:'revisao',     label:'Revisão' },
  { v:'projeto',     label:'Projeto' },
  { v:'outro',       label:'Outro' }
];

const DIFFICULTIES = [
  { v:1, label:'Muito fácil',  color:'#4C8C7D' },
  { v:2, label:'Fácil',        color:'#7FAE86' },
  { v:3, label:'Mediano',      color:'#C9A227' },
  { v:4, label:'Difícil',      color:'#C97A4A' },
  { v:5, label:'Muito difícil',color:'#B33A3A' }
];

const REVIEW_OUTCOMES = [
  { v:'forgot',      label:'Esqueci' },
  { v:'hard',        label:'Lembrei com dificuldade' },
  { v:'remembered',  label:'Lembrei bem' },
  { v:'mastered',    label:'Dominei' }
];

const PRIORITY_LABELS = { 1:'Muito baixa', 2:'Baixa', 3:'Média', 4:'Alta', 5:'Muito alta' };

/* Pesos do planejador automático: prioridade → peso relativo na distribuição. */
const PLANNER = {
  PRIORITY_WEIGHT: { 1:1, 2:2, 3:4, 4:7, 5:10 },
  DEADLINE_MULTIPLIER: [            // prazo próximo aumenta o peso da disciplina
    { maxDays:7,  mult:1.6 },
    { maxDays:14, mult:1.3 },
    { maxDays:30, mult:1.1 }
  ],
  ROUND_TO: 5,                      // blocos de 5 minutos
  MIN_BLOCK: 10                     // menor bloco sugerido de estudo
};

/* Pesos do motor de recomendação (determinístico e documentado). */
const RECO = {
  W_DEFICIT: 35,
  W_PRIORITY: 20,
  W_RECENCY: 15,
  W_DEADLINE: 15,
  W_REVIEW: 10,
  W_LOW_MASTERY: 5,
  W_OVER_TARGET: 20,               // subtraído
  RECENCY_CAP_DAYS: 7,
  REVIEW_CAP: 3                    // nº de revisões pendentes que satura o score
};

/* Revisão espaçada: multiplicadores e pisos por resultado. */
const REVIEW = {
  forgot:     { mult:0,   floor:1, mastery:-2, resetStreak:true  },
  hard:       { mult:1.5, floor:2, mastery:-1, resetStreak:true  },
  remembered: { mult:2.2, floor:4, mastery:+1, resetStreak:false },
  mastered:   { mult:3.2, floor:7, mastery:'max', resetStreak:false }
};
const REVIEW_MAX_INTERVAL = 180;
const REVIEW_INITIAL_MASTERY = 2;
const MASTERED_MIN_LEVEL = 4;
const MASTERED_MIN_STREAK = 2;

const PALETTE = ['#69A99A','#C9A45A','#7FA3C9','#D56B61','#A88CC9','#4C8C7D','#C97A4A','#5E8FA8','#B08BB0','#82A867'];
const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MONTHS_ABBR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const DEFAULT_SETTINGS = {
  theme: 'dark',
  weekStart: 'monday',
  defaultSessionMinutes: 40,
  defaultReviewMinutes: 20,
  autoReviewNewTopics: true,
  reduceMotion: false,
  defaultPeriod: 'semana'
};

const VIEW_TITLES = {
  today:'Hoje', plan:'Planejamento', reviews:'Revisões', disciplines:'Disciplinas',
  analytics:'Análises', history:'Histórico', data:'Dados', settings:'Configurações'
};

/* =========================================================================
   UTILITIES
   ========================================================================= */

/** Cria elementos com segurança: texto sempre via textContent (nunca innerHTML). */
function h(tag, attrs, ...children){
  const el = document.createElement(tag);
  // Permite omitir o objeto de atributos: h('div', filho, filho...)
  if(attrs instanceof Node || Array.isArray(attrs) || typeof attrs === 'string' || typeof attrs === 'number'){
    children.unshift(attrs);
    attrs = null;
  }
  if(attrs){
    for(const k in attrs){
      const v = attrs[k];
      if(v === null || v === undefined || v === false) continue;
      if(k === 'class') el.className = v;
      else if(k === 'text') el.textContent = v;
      else if(k === 'dataset') Object.assign(el.dataset, v);
      else if(k === 'style') el.setAttribute('style', v);
      else if(k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if(v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  appendChildren(el, children);
  return el;
}

function svgEl(tag, attrs, ...children){
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if(attrs instanceof Node || Array.isArray(attrs) || typeof attrs === 'string' || typeof attrs === 'number'){
    children.unshift(attrs);
    attrs = null;
  }
  if(attrs){ for(const k in attrs){ const v = attrs[k]; if(v===null||v===undefined||v===false) continue; el.setAttribute(k, String(v)); } }
  appendChildren(el, children);
  return el;
}

function icon(id, cls){
  const s = svgEl('svg', { class: cls || 'btn-icon', 'aria-hidden':'true', focusable:'false' });
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', '#' + id);
  s.appendChild(u);
  return s;
}

function appendChildren(el, children){
  children.flat(Infinity).forEach(c => {
    if(c === null || c === undefined || c === false || c === '') return;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  });
}

function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }
function mount(node, ...children){ clear(node); appendChildren(node, children); }
function $(sel, root){ return (root || document).querySelector(sel); }
function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

function uid(){
  if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if(typeof crypto !== 'undefined' && crypto.getRandomValues){
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const hex = Array.from(b, x => x.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
}

function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }
function sum(arr, fn){ return arr.reduce((a,x) => a + (fn ? fn(x) : x), 0); }
function roundTo(n, step){ return Math.round(n / step) * step; }
function nowISO(){ return new Date().toISOString(); }
function isNum(v){ return typeof v === 'number' && isFinite(v); }
function str(v){ return typeof v === 'string' ? v : (v === null || v === undefined ? '' : String(v)); }

function fmtNumber(n, maxFrac){
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('pt-BR', { maximumFractionDigits: maxFrac === undefined ? 2 : maxFrac });
}

/** 95 → "1h35"; 60 → "1h"; 0 → "0min" */
function fmtDuration(minutes){
  const m = Math.max(0, Math.round(minutes || 0));
  const hh = Math.floor(m / 60), mm = m % 60;
  if(hh <= 0) return mm + 'min';
  if(mm === 0) return hh + 'h';
  return hh + 'h' + String(mm).padStart(2,'0');
}
function fmtClock(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total/3600), mm = Math.floor((total%3600)/60), ss = total%60;
  return [hh,mm,ss].map(x => String(x).padStart(2,'0')).join(':');
}
function fmtPct(n){ return fmtNumber(n, 0) + '%'; }

function sortByName(a, b){ return str(a.name).localeCompare(str(b.name), 'pt-BR'); }

/* =========================================================================
   DATE HELPERS  — datas acadêmicas são sempre LOCAIS (YYYY-MM-DD), sem UTC.
   ========================================================================= */
function dateToISO(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function parseISO(s){
  if(!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0,0,0,0);
  return d;
}
function today(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
function todayISO(){ return dateToISO(today()); }
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate() + n); x.setHours(0,0,0,0); return x; }
function addDaysISO(iso, n){ return dateToISO(addDays(parseISO(iso) || today(), n)); }
function diffDays(a, b){ return Math.round((a - b) / 86400000); }        // a - b, em dias
function daysSinceISO(iso){ const d = parseISO(iso); return d ? diffDays(today(), d) : null; }
function daysUntilISO(iso){ const d = parseISO(iso); return d ? diffDays(d, today()) : null; }

function weekStartDow(){ return (state.settings.weekStart === 'sunday') ? 0 : 1; }
function startOfWeek(d){
  const x = new Date(d); x.setHours(0,0,0,0);
  const shift = (x.getDay() - weekStartDow() + 7) % 7;
  x.setDate(x.getDate() - shift);
  return x;
}
function endOfWeek(d){ return addDays(startOfWeek(d), 6); }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function rangeDays(range){ return diffDays(range.end, range.start) + 1; }
function fmtDateBR(iso){ const d = parseISO(iso); return d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '—'; }
function fmtDayMonth(d){ return `${d.getDate()} de ${MONTHS[d.getMonth()]}`; }
function fmtRangeLabel(range){
  const a = range.start, b = range.end;
  if(dateToISO(a) === dateToISO(b)) return `${fmtDayMonth(a)} de ${a.getFullYear()}`;
  if(a.getFullYear() === b.getFullYear()) return `${fmtDayMonth(a)} a ${fmtDayMonth(b)} de ${b.getFullYear()}`;
  return `${fmtDayMonth(a)} de ${a.getFullYear()} a ${fmtDayMonth(b)} de ${b.getFullYear()}`;
}
/** "há 3 dias" / "hoje" / "ontem" */
function fmtRelativePast(iso){
  const n = daysSinceISO(iso);
  if(n === null) return 'nunca';
  if(n <= 0) return 'hoje';
  if(n === 1) return 'ontem';
  return `há ${n} dias`;
}
function fmtRelativeFuture(iso){
  const n = daysUntilISO(iso);
  if(n === null) return '—';
  if(n < 0) return `atrasada há ${Math.abs(n)} ${Math.abs(n) === 1 ? 'dia' : 'dias'}`;
  if(n === 0) return 'hoje';
  if(n === 1) return 'amanhã';
  return `em ${n} dias`;
}
/** Número ISO-8601 aproximado da semana, usado nos relatórios semanais. */
function isoWeekNumber(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow + 3);
  const firstThursday = new Date(x.getFullYear(), 0, 4);
  const fdow = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - fdow + 3);
  return 1 + Math.round((x - firstThursday) / (7 * 86400000));
}

/* =========================================================================
   DATABASE — camada fina sobre IndexedDB nativo.
   O resto da aplicação nunca fala com IndexedDB diretamente.
   ========================================================================= */
const DB = (() => {
  let db = null;

  function open(){
    return new Promise((resolve, reject) => {
      if(!('indexedDB' in window)) { reject(new Error('IndexedDB indisponível neste navegador.')); return; }
      let req;
      try { req = indexedDB.open(IDB_NAME, IDB_VERSION); }
      catch(e){ reject(e); return; }

      req.onupgradeneeded = (ev) => {
        const d = req.result;
        if(!d.objectStoreNames.contains('meta'))        d.createObjectStore('meta', { keyPath:'key' });
        if(!d.objectStoreNames.contains('settings'))    d.createObjectStore('settings', { keyPath:'key' });

        if(!d.objectStoreNames.contains('areas')){
          d.createObjectStore('areas', { keyPath:'id' }).createIndex('archived','archived',{unique:false});
        }
        if(!d.objectStoreNames.contains('disciplines')){
          const s = d.createObjectStore('disciplines', { keyPath:'id' });
          s.createIndex('areaId','areaId',{unique:false});
          s.createIndex('archived','archived',{unique:false});
        }
        if(!d.objectStoreNames.contains('topics')){
          const s = d.createObjectStore('topics', { keyPath:'id' });
          s.createIndex('disciplineId','disciplineId',{unique:false});
          s.createIndex('reviewDueDate','reviewDueDate',{unique:false});
          s.createIndex('archived','archived',{unique:false});
        }
        if(!d.objectStoreNames.contains('sessions')){
          const s = d.createObjectStore('sessions', { keyPath:'id' });
          s.createIndex('date','date',{unique:false});
          s.createIndex('disciplineId','disciplineId',{unique:false});
          s.createIndex('topicId','topicId',{unique:false});
        }
        if(!d.objectStoreNames.contains('plans'))       d.createObjectStore('plans', { keyPath:'id' });
        if(!d.objectStoreNames.contains('weeklyPlans')){
          d.createObjectStore('weeklyPlans', { keyPath:'id' }).createIndex('weekStart','weekStart',{unique:false});
        }
        if(!d.objectStoreNames.contains('deadlines')){
          const s = d.createObjectStore('deadlines', { keyPath:'id' });
          s.createIndex('date','date',{unique:false});
          s.createIndex('disciplineId','disciplineId',{unique:false});
        }
        void ev;
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error || new Error('Falha ao abrir o banco local.'));
      req.onblocked = () => reject(new Error('O banco está bloqueado por outra aba aberta.'));
    });
  }

  function tx(stores, mode){
    if(!db) throw new Error('Banco não inicializado.');
    return db.transaction(stores, mode);
  }
  function wrap(request){
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function done(transaction){
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transação cancelada.'));
    });
  }

  return {
    open,
    get isOpen(){ return !!db; },
    get(store, key){ return wrap(tx([store],'readonly').objectStore(store).get(key)); },
    getAll(store){ return wrap(tx([store],'readonly').objectStore(store).getAll()); },
    async put(store, value){ const t = tx([store],'readwrite'); t.objectStore(store).put(value); await done(t); return value; },
    async putMany(store, values){
      if(!values.length) return;
      const t = tx([store],'readwrite');
      const os = t.objectStore(store);
      values.forEach(v => os.put(v));
      await done(t);
    },
    async delete(store, key){ const t = tx([store],'readwrite'); t.objectStore(store).delete(key); await done(t); },
    async clearStores(stores){
      const t = tx(stores,'readwrite');
      stores.forEach(s => t.objectStore(s).clear());
      await done(t);
    },
    /** Escrita atômica em vários stores: ou tudo grava, ou nada. */
    async transactional(stores, writer){
      const t = tx(stores,'readwrite');
      const api = {
        put:(s, v) => t.objectStore(s).put(v),
        delete:(s, k) => t.objectStore(s).delete(k)
      };
      try { writer(api); } catch(err){ try{ t.abort(); }catch(_){} throw err; }
      await done(t);
    },
    /** Conta registros de um store (usado nas checagens de integridade). */
    count(store){ return wrap(tx([store],'readonly').objectStore(store).count()); }
  };
})();

/* =========================================================================
   MIGRATION — V2 (localStorage) → V3 (IndexedDB). Idempotente.
   O localStorage da V2 NUNCA é apagado automaticamente.
   ========================================================================= */
function readV2Raw(){
  try {
    const raw = localStorage.getItem(V2_LS_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch(_){ return null; }
}

/** Converte um estado no formato V2 para entidades V3. Não grava nada. */
function convertV2(raw){
  const ts = nowISO();
  const areas = [], disciplines = [], sessions = [];
  const areaIds = new Set();

  (Array.isArray(raw.areas) ? raw.areas : []).forEach(a => {
    if(!a || !a.id) return;
    if(areaIds.has(a.id)) return;
    areaIds.add(a.id);
    areas.push({ id:String(a.id), name:str(a.nome) || 'Área', archived:false, createdAt:ts, updatedAt:ts });
  });

  const discIds = new Set();
  (Array.isArray(raw.subjects) ? raw.subjects : []).forEach(s => {
    if(!s || !s.id) return;
    if(discIds.has(s.id)) return;
    discIds.add(s.id);
    const mpc = (isNum(s.minutosPorCredito) && s.minutosPorCredito > 0) ? s.minutosPorCredito : 20;
    const goalCredits = isNum(s.metaSemanalCreditos) ? s.metaSemanalCreditos : 0;
    disciplines.push({
      id: String(s.id),
      areaId: (s.areaId && areaIds.has(s.areaId)) ? String(s.areaId) : null,
      name: str(s.nome) || 'Disciplina',
      priority: 3,                                   // prioridade padrão para dados migrados
      minutesPerCredit: mpc,
      legacyWeeklyMinutes: Math.round(goalCredits * mpc),  // meta antiga convertida p/ minutos
      archived: !!s.archived,
      createdAt: ts, updatedAt: ts
    });
  });

  const sessIds = new Set();
  (Array.isArray(raw.logs) ? raw.logs : []).forEach(l => {
    if(!l || !l.id) return;
    if(sessIds.has(l.id)) return;
    if(!discIds.has(l.subjectId)) return;            // ignora log órfão (relatado depois)
    const date = parseISO(str(l.date)) ? str(l.date).slice(0,10) : todayISO();
    sessIds.add(l.id);
    sessions.push({
      id: String(l.id),
      disciplineId: String(l.subjectId),
      topicId: null,
      legacyTopicText: str(l.tema),                  // "tema" antigo vira texto legado
      date,
      startedAt: null, endedAt: null,
      minutes: isNum(l.minutos) ? l.minutos : 0,
      credits: isNum(l.credits) ? l.credits : 0,     // crédito histórico preservado exatamente
      type: SESSION_TYPES.some(t => t.v === l.tipo) ? l.tipo : null,
      difficulty: (isNum(l.dificuldade) && l.dificuldade >= 1 && l.dificuldade <= 5) ? l.dificuldade : null,
      comment: str(l.comentario),
      reviewOutcome: null,
      createdAt: str(l.criadoEm) || ts,
      updatedAt: ts
    });
  });

  const orphanLogs = (Array.isArray(raw.logs) ? raw.logs : []).filter(l => l && l.id && !discIds.has(l.subjectId)).length;

  const s = raw.settings || {};
  const settings = Object.assign({}, DEFAULT_SETTINGS, {
    theme: (s.theme === 'light' || s.theme === 'dark') ? s.theme : DEFAULT_SETTINGS.theme,
    weekStart: (s.weekStart === 'sunday') ? 'sunday' : 'monday',
    defaultSessionMinutes: (isNum(s.defaultSessionMinutes) && s.defaultSessionMinutes > 0) ? s.defaultSessionMinutes : DEFAULT_SETTINGS.defaultSessionMinutes,
    reduceMotion: !!s.reduceMotion,
    defaultPeriod: str(s.defaultPeriod) || DEFAULT_SETTINGS.defaultPeriod
  });

  return { areas, disciplines, sessions, settings, orphanLogs };
}

/**
 * Executa a migração V2→V3 uma única vez.
 * Grava tudo em uma transação; marca a conclusão no store `meta`.
 */
async function runV2Migration(){
  const already = await DB.get('meta','v2MigrationCompleted');
  if(already && already.value) return { migrated:false, reason:'already' };

  // Salvaguarda extra: se já existirem dados na V3, não importar por cima.
  const [dCount, sCount] = await Promise.all([DB.count('disciplines'), DB.count('sessions')]);
  if(dCount > 0 || sCount > 0){
    await DB.put('meta', { key:'v2MigrationCompleted', value:true, note:'ignorada: já havia dados na V3' });
    await DB.put('meta', { key:'v2MigrationDate', value: nowISO() });
    return { migrated:false, reason:'v3-has-data' };
  }

  const raw = readV2Raw();
  if(!raw || (!Array.isArray(raw.subjects) && !Array.isArray(raw.logs))){
    // Nada para migrar agora. NÃO marcamos como concluída: se os dados da V2
    // aparecerem depois neste navegador, a migração ainda poderá acontecer.
    return { migrated:false, reason:'no-v2-data' };
  }

  const converted = convertV2(raw);
  if(converted.disciplines.length === 0 && converted.sessions.length === 0){
    return { migrated:false, reason:'v2-empty' };
  }

  await DB.transactional(['areas','disciplines','sessions','settings','meta'], api => {
    converted.areas.forEach(a => api.put('areas', a));
    converted.disciplines.forEach(d => api.put('disciplines', d));
    converted.sessions.forEach(s => api.put('sessions', s));
    api.put('settings', { key:'settings', value: converted.settings });
    api.put('meta', { key:'v2MigrationCompleted', value:true });
    api.put('meta', { key:'v2MigrationDate', value: nowISO() });
    api.put('meta', { key:'v2MigrationSummary', value:{
      areas: converted.areas.length,
      disciplines: converted.disciplines.length,
      sessions: converted.sessions.length,
      orphanLogs: converted.orphanLogs
    }});
  });

  // Verificação de integridade pós-gravação.
  const [da, ds] = await Promise.all([DB.count('disciplines'), DB.count('sessions')]);
  const ok = da >= converted.disciplines.length && ds >= converted.sessions.length;

  return {
    migrated:true, ok,
    counts:{ areas:converted.areas.length, disciplines:converted.disciplines.length, sessions:converted.sessions.length },
    orphanLogs: converted.orphanLogs
  };
}

/* =========================================================================
   DOMAIN MODELS — fábricas e derivações. Estado em memória (`state`).
   ========================================================================= */
const state = {
  ready: false,
  settings: Object.assign({}, DEFAULT_SETTINGS),
  meta: {},
  areas: [], disciplines: [], topics: [], sessions: [], plans: [], weeklyPlans: [], deadlines: [],
  // índices derivados (recalculados em rebuildIndexes)
  idx: { areaById:new Map(), discById:new Map(), topicById:new Map(), sessionsByDisc:new Map(), sessionsByTopic:new Map(), topicsByDisc:new Map() }
};

function newArea(name){
  const ts = nowISO();
  return { id:uid(), name:str(name).trim(), archived:false, createdAt:ts, updatedAt:ts };
}
function newDiscipline(name, areaId, priority){
  const ts = nowISO();
  return {
    id:uid(), areaId: areaId || null, name:str(name).trim(),
    priority: clamp(Number(priority) || 3, 1, 5),
    minutesPerCredit: 20, legacyWeeklyMinutes: 0,
    archived:false, createdAt:ts, updatedAt:ts
  };
}
function newTopic(disciplineId, name, sortOrder){
  const ts = nowISO();
  return {
    id:uid(), disciplineId, name:str(name).trim(), sortOrder: sortOrder || 0, archived:false,
    reviewEnabled: !!state.settings.autoReviewNewTopics,
    firstStudiedAt:null, lastStudiedAt:null,
    reviewDueDate:null, reviewIntervalDays:null, lastReviewedAt:null, reviewRepetitions:0,
    masteryLevel:null, consecutiveSuccessfulReviews:0,
    createdAt:ts, updatedAt:ts
  };
}
function newSession(data){
  const ts = nowISO();
  return Object.assign({
    id:uid(), disciplineId:null, topicId:null, legacyTopicText:'',
    date: todayISO(), startedAt:null, endedAt:null,
    minutes:0, credits:0, type:null, difficulty:null, comment:'', reviewOutcome:null,
    createdAt:ts, updatedAt:ts
  }, data);
}
function newPlan(name, weeklyAvailableMinutes){
  const ts = nowISO();
  return { id:uid(), name:str(name).trim() || 'Meu plano', weeklyAvailableMinutes: Math.max(0, Math.round(weeklyAvailableMinutes) || 0), active:true, allocations:[], createdAt:ts, updatedAt:ts };
}
function newDeadline(data){
  const ts = nowISO();
  return Object.assign({ id:uid(), title:'', date:todayISO(), disciplineId:null, topicId:null, importance:'normal', completed:false, createdAt:ts, updatedAt:ts }, data);
}

function rebuildIndexes(){
  const idx = state.idx;
  idx.areaById = new Map(state.areas.map(a => [a.id, a]));
  idx.discById = new Map(state.disciplines.map(d => [d.id, d]));
  idx.topicById = new Map(state.topics.map(t => [t.id, t]));
  idx.sessionsByDisc = new Map();
  idx.sessionsByTopic = new Map();
  idx.topicsByDisc = new Map();
  state.sessions.forEach(s => {
    if(!idx.sessionsByDisc.has(s.disciplineId)) idx.sessionsByDisc.set(s.disciplineId, []);
    idx.sessionsByDisc.get(s.disciplineId).push(s);
    if(s.topicId){
      if(!idx.sessionsByTopic.has(s.topicId)) idx.sessionsByTopic.set(s.topicId, []);
      idx.sessionsByTopic.get(s.topicId).push(s);
    }
  });
  state.topics.forEach(t => {
    if(!idx.topicsByDisc.has(t.disciplineId)) idx.topicsByDisc.set(t.disciplineId, []);
    idx.topicsByDisc.get(t.disciplineId).push(t);
  });
  idx.topicsByDisc.forEach(list => list.sort((a,b) => (a.sortOrder - b.sortOrder) || sortByName(a,b)));
}

const getArea = id => state.idx.areaById.get(id) || null;
const getDiscipline = id => state.idx.discById.get(id) || null;
const getTopic = id => state.idx.topicById.get(id) || null;
const activeDisciplines = () => state.disciplines.filter(d => !d.archived);
const activeAreas = () => state.areas.filter(a => !a.archived);
const topicsOf = (discId, includeArchived) => (state.idx.topicsByDisc.get(discId) || []).filter(t => includeArchived || !t.archived);
const sessionsOf = discId => state.idx.sessionsByDisc.get(discId) || [];
const sessionsOfTopic = topicId => state.idx.sessionsByTopic.get(topicId) || [];

function disciplineName(id){ const d = getDiscipline(id); return d ? d.name : '(disciplina removida)'; }
function areaNameOf(disc){ const a = disc && disc.areaId ? getArea(disc.areaId) : null; return a ? a.name : 'Sem área'; }
function topicLabelOf(session){
  if(session.topicId){ const t = getTopic(session.topicId); if(t) return t.name; }
  return str(session.legacyTopicText);
}
function sessionTypeLabel(v){ const t = SESSION_TYPES.find(x => x.v === v); return t ? t.label : 'Não informado'; }
function difficultyInfo(v){ return DIFFICULTIES.find(d => d.v === v) || null; }
function reviewOutcomeLabel(v){ const o = REVIEW_OUTCOMES.find(x => x.v === v); return o ? o.label : null; }

function creditsFor(disciplineId, minutes){
  const d = getDiscipline(disciplineId);
  const mpc = d && d.minutesPerCredit > 0 ? d.minutesPerCredit : 20;
  return Math.round((minutes / mpc) * 100) / 100;
}
function lastStudyISO(disciplineId){
  const list = sessionsOf(disciplineId);
  if(!list.length) return null;
  return list.reduce((max, s) => (s.date > max ? s.date : max), list[0].date);
}
function sessionsInRange(range){
  const a = dateToISO(range.start), b = dateToISO(range.end);
  return state.sessions.filter(s => s.date >= a && s.date <= b);
}
function minutesInRange(range, disciplineId){
  return sum(sessionsInRange(range).filter(s => !disciplineId || s.disciplineId === disciplineId), s => s.minutes);
}

/* Status do tópico — derivado, nunca armazenado. */
function topicStatus(topic){
  const studied = sessionsOfTopic(topic.id).length > 0 || !!topic.firstStudiedAt;
  if(!studied) return 'nao_iniciado';
  const mastery = topic.masteryLevel || 0;
  if(topic.lastReviewedAt && mastery >= MASTERED_MIN_LEVEL && (topic.consecutiveSuccessfulReviews || 0) >= MASTERED_MIN_STREAK) return 'dominado';
  if(topic.lastReviewedAt) return 'em_revisao';
  return 'em_estudo';
}
const TOPIC_STATUS_LABEL = { nao_iniciado:'Não iniciado', em_estudo:'Em estudo', em_revisao:'Em revisão', dominado:'Dominado' };

/** Cobertura (tópicos vistos) e domínio (tópicos dominados) de uma disciplina. */
function disciplineProgress(discId){
  const tps = topicsOf(discId);
  const total = tps.length;
  if(!total) return { total:0, covered:0, mastered:0, coverage:null, mastery:null };
  let covered = 0, mastered = 0;
  tps.forEach(t => {
    const st = topicStatus(t);
    if(st !== 'nao_iniciado') covered++;
    if(st === 'dominado') mastered++;
  });
  return { total, covered, mastered, coverage: covered/total*100, mastery: mastered/total*100 };
}

/* =========================================================================
   PLAN ENGINE — distribui minutos semanais entre disciplinas.
   ========================================================================= */
const PlannerEngine = {
  /**
   * Distribui `availableMinutes` entre allocations [{disciplineId, priority, minWeeklyMinutes}].
   * 1) respeita mínimos  2) divide o resto por peso de prioridade (× urgência de prazo)
   * 3) arredonda em blocos de 5  4) corrige resíduo para bater o total exato.
   */
  generatePlan(availableMinutes, allocations){
    const total = Math.max(0, Math.round(availableMinutes) || 0);
    const items = allocations.map(a => ({
      disciplineId: a.disciplineId,
      priority: clamp(Number(a.priority) || 3, 1, 5),
      minWeeklyMinutes: Math.max(0, Math.round(Number(a.minWeeklyMinutes) || 0)),
      targetMinutes: 0
    }));
    if(!items.length) return { allocations: items, conflict:null };

    const minsTotal = sum(items, i => i.minWeeklyMinutes);
    let conflict = null;

    if(minsTotal > total){
      // Mínimos excedem a disponibilidade: reduz proporcionalmente, mas reporta o conflito.
      conflict = { minimumsTotal: minsTotal, available: total, excess: minsTotal - total };
      const factor = total > 0 ? total / minsTotal : 0;
      items.forEach(i => { i.targetMinutes = Math.max(0, roundTo(i.minWeeklyMinutes * factor, PLANNER.ROUND_TO)); });
      this._fixResidual(items, total);
      return { allocations: items, conflict };
    }

    items.forEach(i => { i.targetMinutes = i.minWeeklyMinutes; });

    let remaining = total - minsTotal;
    if(remaining > 0){
      const weights = items.map(i => {
        const base = PLANNER.PRIORITY_WEIGHT[i.priority] || 1;
        return base * this._deadlineMultiplier(i.disciplineId);
      });
      const weightSum = sum(weights);
      if(weightSum > 0){
        items.forEach((i, k) => {
          i.targetMinutes += roundTo((remaining * weights[k]) / weightSum, PLANNER.ROUND_TO);
        });
      } else {
        const each = roundTo(remaining / items.length, PLANNER.ROUND_TO);
        items.forEach(i => { i.targetMinutes += each; });
      }
    }

    this._fixResidual(items, total);
    return { allocations: items, conflict };
  },

  _deadlineMultiplier(disciplineId){
    const next = state.deadlines
      .filter(dl => !dl.completed && dl.disciplineId === disciplineId)
      .map(dl => daysUntilISO(dl.date))
      .filter(n => n !== null && n >= 0)
      .sort((a,b) => a - b)[0];
    if(next === undefined) return 1;
    for(const rule of PLANNER.DEADLINE_MULTIPLIER) if(next <= rule.maxDays) return rule.mult;
    return 1;
  },

  /** Ajusta o maior item (ou o menor) para que a soma feche exatamente em `total`. */
  _fixResidual(items, total){
    items.forEach(i => { i.targetMinutes = Math.max(0, Math.round(i.targetMinutes)); });
    let diff = total - sum(items, i => i.targetMinutes);
    let guard = 0;
    while(diff !== 0 && guard++ < 400){
      const step = diff > 0 ? PLANNER.ROUND_TO : -PLANNER.ROUND_TO;
      const chunk = Math.abs(diff) >= PLANNER.ROUND_TO ? step : diff;
      const sorted = items.slice().sort((a,b) => b.targetMinutes - a.targetMinutes);
      const target = chunk > 0 ? sorted[0] : sorted.find(i => i.targetMinutes + chunk >= 0) || sorted[0];
      target.targetMinutes = Math.max(0, target.targetMinutes + chunk);
      diff = total - sum(items, i => i.targetMinutes);
    }
  },

  activePlan(){ return state.plans.find(p => p.active) || null; },

  /** Snapshot da semana: garante que a semana corrente tem seu próprio plano histórico. */
  async ensureWeeklyPlan(dateRef){
    const base = this.activePlan();
    if(!base) return null;
    const ws = dateToISO(startOfWeek(dateRef || today()));
    const existing = state.weeklyPlans.find(w => w.weekStart === ws);
    if(existing) return existing;
    const wp = {
      id: ws,
      weekStart: ws,
      weekEnd: dateToISO(addDays(parseISO(ws), 6)),
      basePlanId: base.id,
      availableMinutes: base.weeklyAvailableMinutes,
      allocations: base.allocations.map(a => ({ ...a })),
      createdAt: nowISO(), updatedAt: nowISO()
    };
    await DB.put('weeklyPlans', wp);
    state.weeklyPlans.push(wp);
    return wp;
  },

  weeklyPlanFor(dateRef){
    const ws = dateToISO(startOfWeek(dateRef || today()));
    return state.weeklyPlans.find(w => w.weekStart === ws) || null;
  },

  /** Progresso da semana corrente: planejado × realizado, geral e por disciplina. */
  getCurrentWeekProgress(dateRef){
    const ref = dateRef || today();
    const wp = this.weeklyPlanFor(ref);
    const range = { start: startOfWeek(ref), end: endOfWeek(ref) };
    const weekSessions = sessionsInRange(range);
    const realizedByDisc = new Map();
    weekSessions.forEach(s => realizedByDisc.set(s.disciplineId, (realizedByDisc.get(s.disciplineId) || 0) + s.minutes));

    const perDiscipline = [];
    if(wp){
      wp.allocations.forEach(a => {
        const d = getDiscipline(a.disciplineId);
        if(!d || d.archived) return;
        const realized = realizedByDisc.get(a.disciplineId) || 0;
        perDiscipline.push({
          disciplineId: a.disciplineId,
          planned: a.targetMinutes || 0,
          realized,
          remaining: Math.max(0, (a.targetMinutes || 0) - realized)
        });
      });
    }
    const plannedTotal = wp ? sum(wp.allocations, a => a.targetMinutes || 0) : 0;
    const realizedTotal = sum(weekSessions, s => s.minutes);
    return {
      weeklyPlan: wp, range, plannedTotal, realizedTotal,
      remainingTotal: Math.max(0, plannedTotal - realizedTotal),
      pct: plannedTotal > 0 ? (realizedTotal / plannedTotal) * 100 : null,
      perDiscipline
    };
  },

  calculateDeficits(dateRef){
    const p = this.getCurrentWeekProgress(dateRef);
    const map = new Map();
    p.perDiscipline.forEach(x => map.set(x.disciplineId, x));
    return map;
  }
};

/* =========================================================================
   REVIEW ENGINE — revisão espaçada simples, adaptativa e transparente.
   ========================================================================= */
const ReviewEngine = {
  /** Primeiro estudo de um tópico: agenda revisão para amanhã. Não mexe se já agendado. */
  scheduleFirstReview(topic, dateISO){
    if(!topic.reviewEnabled) return topic;
    if(topic.reviewDueDate || topic.firstStudiedAt) return topic;
    topic.firstStudiedAt = dateISO;
    topic.reviewIntervalDays = 1;
    topic.reviewDueDate = addDaysISO(dateISO, 1);
    topic.masteryLevel = REVIEW_INITIAL_MASTERY;
    topic.consecutiveSuccessfulReviews = 0;
    topic.reviewRepetitions = 0;
    topic.updatedAt = nowISO();
    return topic;
  },

  /** Aplica o resultado de uma revisão: ajusta intervalo, domínio e próxima data. */
  applyReviewOutcome(topic, outcome, dateISO){
    const rule = REVIEW[outcome];
    if(!rule) return topic;
    const prev = topic.reviewIntervalDays || 1;
    let interval = rule.mult === 0 ? rule.floor : Math.max(rule.floor, Math.round(prev * rule.mult));
    interval = clamp(interval, 1, REVIEW_MAX_INTERVAL);

    let mastery = topic.masteryLevel || REVIEW_INITIAL_MASTERY;
    mastery = (rule.mastery === 'max') ? 5 : clamp(mastery + rule.mastery, 1, 5);

    const streak = rule.resetStreak ? 0 : (topic.consecutiveSuccessfulReviews || 0) + 1;
    const on = dateISO || todayISO();

    topic.reviewIntervalDays = interval;
    topic.masteryLevel = mastery;
    topic.consecutiveSuccessfulReviews = streak;
    topic.reviewRepetitions = (topic.reviewRepetitions || 0) + 1;
    topic.lastReviewedAt = on;
    topic.reviewDueDate = addDaysISO(on, interval);
    topic.lastStudiedAt = on;
    topic.updatedAt = nowISO();
    return topic;
  },

  /** Tópicos com revisão vencida ou para hoje (ordenados: mais atrasado primeiro). */
  getDueReviews(refISO){
    const ref = refISO || todayISO();
    return state.topics
      .filter(t => !t.archived && t.reviewEnabled && t.reviewDueDate && t.reviewDueDate <= ref)
      .filter(t => { const d = getDiscipline(t.disciplineId); return d && !d.archived; })
      .sort((a,b) => a.reviewDueDate.localeCompare(b.reviewDueDate) || sortByName(a,b));
  },

  /** Próximas revisões futuras, até `days` dias à frente. */
  getUpcomingReviews(days){
    const from = addDaysISO(todayISO(), 1);
    const to = addDaysISO(todayISO(), days || 7);
    return state.topics
      .filter(t => !t.archived && t.reviewEnabled && t.reviewDueDate && t.reviewDueDate >= from && t.reviewDueDate <= to)
      .filter(t => { const d = getDiscipline(t.disciplineId); return d && !d.archived; })
      .sort((a,b) => a.reviewDueDate.localeCompare(b.reviewDueDate) || sortByName(a,b));
  },

  dueCountFor(disciplineId){
    return this.getDueReviews().filter(t => t.disciplineId === disciplineId).length;
  },
  maxOverdueDaysFor(disciplineId){
    const due = this.getDueReviews().filter(t => t.disciplineId === disciplineId);
    if(!due.length) return 0;
    return Math.max(...due.map(t => Math.max(0, -(daysUntilISO(t.reviewDueDate) || 0))));
  },
  calculateTopicStatus(topic){ return topicStatus(topic); }
};

/* =========================================================================
   RECOMMENDATION ENGINE — sistema local de recomendação (determinístico).
   Não é IA: são regras explicáveis, com pesos declarados em RECO.
   ========================================================================= */
const RecommendationEngine = {
  /** Componentes normalizados (0..1) de uma disciplina. */
  scoreDiscipline(disc, ctx){
    const prog = ctx.deficits.get(disc.id);
    const planned = prog ? prog.planned : 0;
    const realized = prog ? prog.realized : (ctx.realizedByDisc.get(disc.id) || 0);
    const remaining = prog ? prog.remaining : 0;

    // Sem plano ativo, todas partem de um déficit neutro para não travar a recomendação.
    const deficitScore = planned > 0 ? clamp(remaining / planned, 0, 1) : 0.5;
    const priorityScore = clamp((disc.priority - 1) / 4, 0, 1);

    const lastISO = lastStudyISO(disc.id);
    const daysSince = lastISO === null ? RECO.RECENCY_CAP_DAYS : (daysSinceISO(lastISO) || 0);
    const recencyScore = clamp(daysSince / RECO.RECENCY_CAP_DAYS, 0, 1);

    const deadline = this._nextDeadline(disc.id);
    const deadlineScore = this._deadlineScore(deadline);

    const dueCount = ReviewEngine.dueCountFor(disc.id);
    const overdue = ReviewEngine.maxOverdueDaysFor(disc.id);
    const reviewPressureScore = clamp((dueCount / RECO.REVIEW_CAP) + (overdue > 0 ? 0.2 : 0), 0, 1);

    const lowMasteryScore = this._lowMastery(disc.id);
    const overTargetPenalty = planned > 0 ? clamp((realized - planned) / planned, 0, 1) : 0;

    const score =
      RECO.W_DEFICIT      * deficitScore +
      RECO.W_PRIORITY     * priorityScore +
      RECO.W_RECENCY      * recencyScore +
      RECO.W_DEADLINE     * deadlineScore +
      RECO.W_REVIEW       * reviewPressureScore +
      RECO.W_LOW_MASTERY  * lowMasteryScore -
      RECO.W_OVER_TARGET  * overTargetPenalty;

    return {
      score,
      parts:{ deficitScore, priorityScore, recencyScore, deadlineScore, reviewPressureScore, lowMasteryScore, overTargetPenalty },
      facts:{ planned, realized, remaining, daysSince, lastISO, deadline, dueCount, overdue }
    };
  },

  _nextDeadline(disciplineId){
    return state.deadlines
      .filter(dl => !dl.completed && dl.disciplineId === disciplineId)
      .map(dl => ({ dl, days: daysUntilISO(dl.date) }))
      .filter(x => x.days !== null && x.days >= 0)
      .sort((a,b) => a.days - b.days)[0] || null;
  },
  _deadlineScore(entry){
    if(!entry) return 0;
    const n = entry.days;
    if(n <= 2) return 1;
    if(n <= 7) return 0.8;
    if(n <= 14) return 0.5;
    if(n <= 30) return 0.25;
    return 0;
  },
  _lowMastery(disciplineId){
    const tps = topicsOf(disciplineId).filter(t => t.masteryLevel);
    if(!tps.length) return 0.5;
    const avg = sum(tps, t => t.masteryLevel) / tps.length;
    return clamp(1 - ((avg - 1) / 4), 0, 1);
  },

  /** Escolhe o tópico da vez dentro da disciplina, seguindo a ordem de prioridade. */
  pickTopic(disciplineId){
    const tps = topicsOf(disciplineId);
    if(!tps.length) return { topic:null, suggestedType:null, reason:null };

    const due = tps.filter(t => t.reviewEnabled && t.reviewDueDate && t.reviewDueDate <= todayISO())
                   .sort((a,b) => a.reviewDueDate.localeCompare(b.reviewDueDate));
    if(due.length) return { topic:due[0], suggestedType:'revisao', reason:'revisão pendente deste tópico' };

    const inStudy = tps.filter(t => topicStatus(t) === 'em_estudo' || topicStatus(t) === 'em_revisao');
    const lowRetention = inStudy.filter(t => (t.masteryLevel || 5) <= 2)
                                .sort((a,b) => (a.masteryLevel || 5) - (b.masteryLevel || 5));
    if(lowRetention.length) return { topic:lowRetention[0], suggestedType:null, reason:'tópico com domínio baixo' };

    const stale = inStudy.filter(t => t.lastStudiedAt && (daysSinceISO(t.lastStudiedAt) || 0) >= 3)
                         .sort((a,b) => str(a.lastStudiedAt).localeCompare(str(b.lastStudiedAt)));
    if(stale.length) return { topic:stale[0], suggestedType:null, reason:'em estudo, mas sem contato há dias' };

    const notStarted = tps.filter(t => topicStatus(t) === 'nao_iniciado');
    if(notStarted.length) return { topic:notStarted[0], suggestedType:null, reason:'próximo conteúdo da sequência' };

    if(inStudy.length) return { topic:inStudy[0], suggestedType:null, reason:'continuar o conteúdo em andamento' };
    return { topic:null, suggestedType:null, reason:null };
  },

  /** Duração sugerida: padrão, reduzida quando falta pouco para fechar a semana. */
  suggestDuration(remainingMinutes, isReview){
    const base = isReview
      ? (state.settings.defaultReviewMinutes || 20)
      : (state.settings.defaultSessionMinutes || 40);
    if(remainingMinutes > 0 && remainingMinutes < base){
      return Math.max(PLANNER.MIN_BLOCK, roundTo(remainingMinutes, PLANNER.ROUND_TO));
    }
    return base;
  },

  /** Frases explicáveis a partir dos componentes que realmente pesaram. */
  buildReasons(disc, scored, topicPick){
    const r = [];
    const f = scored.facts;
    if(f.planned > 0 && f.remaining > 0) r.push(`faltam ${fmtDuration(f.remaining)} do plano semanal`);
    else if(f.planned > 0 && f.remaining === 0) r.push('plano semanal desta disciplina já cumprido');
    if(disc.priority >= 4) r.push(`prioridade ${PRIORITY_LABELS[disc.priority].toLowerCase()}`);
    if(f.lastISO === null) r.push('ainda sem nenhuma sessão registrada');
    else if(f.daysSince >= 2) r.push(`último estudo ${fmtRelativePast(f.lastISO)}`);
    if(f.dueCount > 0) r.push(`${f.dueCount} ${f.dueCount === 1 ? 'revisão pendente' : 'revisões pendentes'}${f.overdue > 0 ? ` (atraso de ${f.overdue} ${f.overdue===1?'dia':'dias'})` : ''}`);
    if(f.deadline) r.push(`prazo "${f.deadline.dl.title}" ${fmtRelativeFuture(f.deadline.dl.date)}`);
    if(scored.parts.overTargetPenalty > 0) r.push(`já passou ${fmtDuration(f.realized - f.planned)} do planejado nesta semana`);
    if(topicPick && topicPick.reason) r.push(topicPick.reason);
    if(!r.length) r.push('disciplina ativa disponível para estudo');
    return r;
  },

  /**
   * Retorna as melhores próximas ações (objetos estruturados; a UI formata).
   * { type, discipline, topic, duration, suggestedType, score, reasons, parts }
   */
  getNextActions(limit){
    const discs = activeDisciplines();
    if(!discs.length) return [];

    const deficits = PlannerEngine.calculateDeficits();
    const weekRange = { start: startOfWeek(today()), end: endOfWeek(today()) };
    const realizedByDisc = new Map();
    sessionsInRange(weekRange).forEach(s => realizedByDisc.set(s.disciplineId, (realizedByDisc.get(s.disciplineId) || 0) + s.minutes));
    const ctx = { deficits, realizedByDisc };

    const scored = discs.map(d => {
      const sc = this.scoreDiscipline(d, ctx);
      const pick = this.pickTopic(d.id);
      const isReview = pick.suggestedType === 'revisao';
      return {
        type:'study',
        discipline: d,
        topic: pick.topic,
        suggestedType: pick.suggestedType,
        duration: this.suggestDuration(sc.facts.remaining, isReview),
        score: sc.score,
        parts: sc.parts,
        facts: sc.facts,
        reasons: this.buildReasons(d, sc, pick)
      };
    });

    scored.sort((a,b) => (b.score - a.score) || sortByName(a.discipline, b.discipline));
    return scored.slice(0, limit || 3);
  }
};

/* =========================================================================
   ANALYTICS ENGINE — calcula tudo uma vez, em memória, e devolve um objeto.
   ========================================================================= */
const AnalyticsEngine = {
  build(range){
    const sessions = sessionsInRange(range);
    const days = rangeDays(range);
    const prevRange = this.previousRange(range);
    const prevSessions = sessionsInRange(prevRange);

    const totals = this.totals(sessions, days);
    const previousComparison = this.compare(totals, this.totals(prevSessions, rangeDays(prevRange)), prevRange, prevSessions.length);

    const byDiscipline = this.groupMinutes(sessions, s => s.disciplineId, id => disciplineName(id));
    const byArea = this.groupMinutes(sessions, s => { const d = getDiscipline(s.disciplineId); return d && d.areaId ? d.areaId : '__none__'; },
                                     id => id === '__none__' ? 'Sem área' : (getArea(id) ? getArea(id).name : '(área removida)'));
    const byTopic = this.groupMinutes(sessions.filter(s => s.topicId), s => s.topicId, id => { const t = getTopic(id); return t ? t.name : '(tópico removido)'; });
    const byType = this.typeDistribution(sessions);
    const difficulty = this.difficulty(sessions);
    const planAdherence = this.planAdherence(range);
    const reviews = this.reviewStats(range, sessions);
    const content = this.contentStats();
    const projection = this.projection(range);

    const a = { range, days, sessions, totals, previousComparison, byDiscipline, byArea, byTopic, byType, difficulty, planAdherence, reviews, content, projection };
    a.insights = this.insights(a);
    return a;
  },

  totals(sessions, days){
    const minutes = sum(sessions, s => s.minutes);
    const credits = sum(sessions, s => s.credits);
    const activeDays = new Set(sessions.map(s => s.date)).size;
    return {
      minutes, credits, count: sessions.length, activeDays, days,
      avgSession: sessions.length ? minutes / sessions.length : 0,
      avgPerDay: days > 0 ? minutes / days : 0,
      consistency: days > 0 ? (activeDays / days) * 100 : 0
    };
  },

  previousRange(range){
    const n = rangeDays(range);
    const end = addDays(range.start, -1);
    return { start: addDays(end, -(n - 1)), end };
  },

  compare(cur, prev, prevRange, prevCount){
    if(!prev || prev.minutes <= 0) return { available:false, prevRange, prev };
    return {
      available:true, prevRange, prev,
      minutesDelta: ((cur.minutes - prev.minutes) / prev.minutes) * 100,
      sessionsDelta: prevCount > 0 ? ((cur.count - prevCount) / prevCount) * 100 : null,
      activeDaysDelta: prev.activeDays > 0 ? ((cur.activeDays - prev.activeDays) / prev.activeDays) * 100 : null,
      creditsDelta: prev.credits > 0 ? ((cur.credits - prev.credits) / prev.credits) * 100 : null
    };
  },

  groupMinutes(sessions, keyFn, labelFn){
    const map = new Map();
    sessions.forEach(s => {
      const k = keyFn(s);
      if(k === null || k === undefined) return;
      const cur = map.get(k) || { key:k, minutes:0, credits:0, count:0 };
      cur.minutes += s.minutes; cur.credits += s.credits; cur.count++;
      map.set(k, cur);
    });
    const total = sum(Array.from(map.values()), x => x.minutes);
    return Array.from(map.values())
      .map(x => ({ ...x, label: labelFn(x.key), pct: total > 0 ? (x.minutes/total)*100 : 0 }))
      .sort((a,b) => b.minutes - a.minutes);
  },

  typeDistribution(sessions){
    const map = new Map();
    sessions.forEach(s => { const k = s.type || '__none__'; map.set(k, (map.get(k) || 0) + 1); });
    const total = sessions.length;
    const rows = SESSION_TYPES.map(t => ({ key:t.v, label:t.label, count: map.get(t.v) || 0 }));
    if(map.get('__none__')) rows.push({ key:'__none__', label:'Não informado', count: map.get('__none__') });
    return rows.map(r => ({ ...r, pct: total > 0 ? (r.count/total)*100 : 0 }));
  },

  difficulty(sessions){
    const withD = sessions.filter(s => s.difficulty);
    const counts = DIFFICULTIES.map(d => ({ ...d, count: withD.filter(s => s.difficulty === d.v).length }));
    const avg = withD.length ? sum(withD, s => s.difficulty) / withD.length : null;

    const byDisc = new Map();
    withD.forEach(s => { if(!byDisc.has(s.disciplineId)) byDisc.set(s.disciplineId, []); byDisc.get(s.disciplineId).push(s.difficulty); });
    const perDiscipline = Array.from(byDisc.entries())
      .map(([id, vals]) => ({ id, label: disciplineName(id), avg: sum(vals)/vals.length, count: vals.length }))
      .sort((a,b) => b.avg - a.avg);

    const byTopic = new Map();
    withD.filter(s => s.topicId).forEach(s => { if(!byTopic.has(s.topicId)) byTopic.set(s.topicId, []); byTopic.get(s.topicId).push(s.difficulty); });
    const perTopic = Array.from(byTopic.entries())
      .map(([id, vals]) => { const t = getTopic(id); return { id, label: t ? t.name : '(tópico removido)', avg: sum(vals)/vals.length, count: vals.length }; })
      .sort((a,b) => b.avg - a.avg);

    return { avg, count: withD.length, counts, perDiscipline, perTopic };
  },

  /** Planejado × realizado usando o snapshot histórico de cada semana tocada pelo período. */
  planAdherence(range){
    const weeks = [];
    let cursor = startOfWeek(range.start);
    const last = startOfWeek(range.end);
    let guard = 0;
    while(cursor <= last && guard++ < 520){
      const ws = dateToISO(cursor);
      const wp = state.weeklyPlans.find(w => w.weekStart === ws);
      const wStart = cursor, wEnd = addDays(cursor, 6);
      const clipStart = wStart < range.start ? range.start : wStart;
      const clipEnd = wEnd > range.end ? range.end : wEnd;
      const coveredDays = diffDays(clipEnd, clipStart) + 1;
      const factor = clamp(coveredDays / 7, 0, 1);      // semana parcial conta proporcionalmente
      const realized = minutesInRange({ start:clipStart, end:clipEnd });
      const planned = wp ? sum(wp.allocations, a => a.targetMinutes || 0) * factor : 0;
      weeks.push({ weekStart: ws, weeklyPlan: wp, planned, realized, factor, coveredDays,
                   weekNumber: isoWeekNumber(wStart) });
      cursor = addDays(cursor, 7);
    }
    const planned = sum(weeks, w => w.planned);
    const realized = sum(weeks, w => w.realized);
    const hasPlan = weeks.some(w => w.weeklyPlan);

    const perDiscipline = [];
    if(hasPlan){
      const map = new Map();
      weeks.forEach(w => {
        if(!w.weeklyPlan) return;
        w.weeklyPlan.allocations.forEach(a => {
          const cur = map.get(a.disciplineId) || { disciplineId:a.disciplineId, planned:0, realized:0 };
          cur.planned += (a.targetMinutes || 0) * w.factor;
          map.set(a.disciplineId, cur);
        });
      });
      sessionsInRange(range).forEach(s => {
        const cur = map.get(s.disciplineId) || { disciplineId:s.disciplineId, planned:0, realized:0 };
        cur.realized += s.minutes;
        map.set(s.disciplineId, cur);
      });
      map.forEach(v => {
        const d = getDiscipline(v.disciplineId);
        perDiscipline.push({
          ...v,
          label: d ? d.name : '(disciplina removida)',
          archived: d ? d.archived : true,
          pct: v.planned > 0 ? (v.realized / v.planned) * 100 : null
        });
      });
      perDiscipline.sort((a,b) => (a.pct === null ? 999 : a.pct) - (b.pct === null ? 999 : b.pct));
    }

    return { hasPlan, planned, realized, weeks, perDiscipline, pct: planned > 0 ? (realized/planned)*100 : null };
  },

  /** Revisões concluídas no período × previstas (vencidas no período). */
  reviewStats(range, sessions){
    const done = sessions.filter(s => s.type === 'revisao' || s.reviewOutcome);
    const a = dateToISO(range.start), b = dateToISO(range.end);
    const scheduledInRange = state.topics.filter(t =>
      !t.archived && t.reviewEnabled && t.reviewDueDate && t.reviewDueDate >= a && t.reviewDueDate <= b
    ).length;
    const overdueNow = ReviewEngine.getDueReviews().filter(t => (daysUntilISO(t.reviewDueDate) || 0) < 0).length;
    const dueToday = ReviewEngine.getDueReviews().length;
    const outcomes = REVIEW_OUTCOMES.map(o => ({ ...o, count: done.filter(s => s.reviewOutcome === o.v).length }));
    const expected = scheduledInRange + done.length;
    return {
      completed: done.length, scheduled: scheduledInRange, expected,
      rate: expected > 0 ? (done.length / expected) * 100 : null,
      overdueNow, dueToday, outcomes, minutes: sum(done, s => s.minutes)
    };
  },

  /** Cobertura e domínio de conteúdo (visão geral e por disciplina). */
  contentStats(){
    const discs = activeDisciplines();
    const per = discs.map(d => ({ discipline:d, ...disciplineProgress(d.id) })).filter(x => x.total > 0);
    const total = sum(per, x => x.total);
    const covered = sum(per, x => x.covered);
    const mastered = sum(per, x => x.mastered);
    const weakest = state.topics
      .filter(t => !t.archived && t.masteryLevel)
      .filter(t => { const d = getDiscipline(t.disciplineId); return d && !d.archived; })
      .sort((a,b) => (a.masteryLevel - b.masteryLevel) || sortByName(a,b))
      .slice(0, 5);
    return {
      totalTopics: total, covered, mastered,
      coverage: total > 0 ? (covered/total)*100 : null,
      masteryPct: total > 0 ? (mastered/total)*100 : null,
      perDiscipline: per, weakest
    };
  },

  /** Projeção de ritmo: só com histórico suficiente (≥3 semanas e ≥6 sessões). */
  projection(range){
    const weeksBack = 4;
    const weeks = [];
    for(let i = 1; i <= weeksBack; i++){
      const ws = startOfWeek(addDays(today(), -7 * i));
      const we = addDays(ws, 6);
      weeks.push({ ws: dateToISO(ws), minutes: minutesInRange({ start:ws, end:we }), sessions: sessionsInRange({ start:ws, end:we }).length });
    }
    const withData = weeks.filter(w => w.minutes > 0);
    const totalSessions = sum(weeks, w => w.sessions);
    if(withData.length < 3 || totalSessions < 6){
      return { available:false, reason:'Dados insuficientes para projeção (são necessárias ao menos 3 semanas com registros).' };
    }
    const avg = sum(withData, w => w.minutes) / withData.length;
    const plan = PlannerEngine.activePlan();
    const target = plan ? plan.weeklyAvailableMinutes : null;
    void range;
    return {
      available:true, weeksConsidered: withData.length, avgWeeklyMinutes: avg, target,
      meetsTarget: target ? avg >= target * 0.95 : null,
      gap: target ? avg - target : null
    };
  },

  /** Insights determinísticos — fatos e tendências, nunca julgamentos. */
  insights(a){
    const out = [];
    const t = a.totals;

    if(t.count === 0){
      out.push('Nenhuma sessão registrada neste período.');
      return out;
    }

    out.push(`Você estudou ${fmtDuration(t.minutes)} em ${t.count} ${t.count === 1 ? 'sessão' : 'sessões'}, distribuídas em ${t.activeDays} ${t.activeDays === 1 ? 'dia' : 'dias'}.`);

    if(a.previousComparison.available){
      const d = a.previousComparison.minutesDelta;
      out.push(`Seu tempo de estudo ${d >= 0 ? 'subiu' : 'caiu'} ${fmtNumber(Math.abs(d),0)}% em relação ao período anterior (${fmtDuration(a.previousComparison.prev.minutes)}).`);
    }

    if(a.planAdherence.hasPlan && a.planAdherence.planned > 0){
      out.push(`Você realizou ${fmtNumber(a.planAdherence.pct,0)}% do tempo planejado (${fmtDuration(a.planAdherence.realized)} de ${fmtDuration(a.planAdherence.planned)}).`);
      const below = a.planAdherence.perDiscipline.filter(x => x.pct !== null && x.pct < 70 && x.planned > 0 && !x.archived);
      below.slice(0,2).forEach(x => out.push(`${x.label} recebeu ${fmtNumber(x.pct,0)}% do tempo planejado (${fmtDuration(x.realized)} de ${fmtDuration(x.planned)}).`));
      const above = a.planAdherence.perDiscipline.filter(x => x.pct !== null && x.pct > 130 && x.planned > 0 && !x.archived);
      above.slice(0,1).forEach(x => out.push(`${x.label} recebeu ${fmtNumber(x.pct - 100,0)}% mais tempo que o planejado.`));
    }

    if(a.byDiscipline.length){
      const top = a.byDiscipline[0];
      out.push(`${top.label} concentrou ${fmtNumber(top.pct,0)}% do seu tempo de estudo.`);
      if(top.pct > 60 && a.byDiscipline.length > 1) out.push(`Sua distribuição ficou concentrada: ${a.byDiscipline.length - 1} ${a.byDiscipline.length === 2 ? 'outra disciplina recebeu' : 'outras disciplinas receberam'} o tempo restante.`);
    }

    if(a.reviews.overdueNow > 0) out.push(`Existem ${a.reviews.overdueNow} ${a.reviews.overdueNow === 1 ? 'revisão atrasada' : 'revisões atrasadas'} neste momento.`);
    if(a.reviews.completed > 0) out.push(`Você concluiu ${a.reviews.completed} ${a.reviews.completed === 1 ? 'revisão' : 'revisões'} no período.`);

    // Disciplinas ativas sem registro recente.
    activeDisciplines().forEach(d => {
      const last = lastStudyISO(d.id);
      const n = last ? daysSinceISO(last) : null;
      if(last === null) out.push(`${d.name} ainda não possui nenhuma sessão registrada.`);
      else if(n >= 7) out.push(`${d.name} não recebe registros há ${n} dias.`);
    });

    if(a.difficulty.avg !== null){
      out.push(`Sua dificuldade percebida média foi ${fmtNumber(a.difficulty.avg,1)}/5 em ${a.difficulty.count} ${a.difficulty.count === 1 ? 'registro' : 'registros'}.`);
      const hardest = a.difficulty.perTopic.filter(x => x.count >= 2)[0] || a.difficulty.perDiscipline.filter(x => x.count >= 2)[0];
      if(hardest) out.push(`${hardest.label} teve a maior dificuldade média: ${fmtNumber(hardest.avg,1)}/5.`);
    }

    if(a.content.weakest.length){
      const w = a.content.weakest[0];
      out.push(`${w.name} está com domínio ${w.masteryLevel}/5.`);
    }
    if(a.content.coverage !== null){
      out.push(`Você já viu ${fmtNumber(a.content.coverage,0)}% dos tópicos cadastrados e domina ${fmtNumber(a.content.masteryPct,0)}%.`);
    }

    // Composição teoria × prática, quando houver classificação suficiente.
    const typed = a.byType.filter(x => x.key !== '__none__' && x.count > 0);
    const typedTotal = sum(typed, x => x.count);
    if(typedTotal >= 3){
      const top = typed.slice().sort((x,y) => y.count - x.count)[0];
      out.push(`${fmtNumber((top.count/typedTotal)*100,0)}% das sessões classificadas foram do tipo "${top.label}".`);
      const lab = typed.find(x => x.key === 'laboratorio');
      const theory = typed.find(x => x.key === 'teoria');
      if(theory && lab && theory.count >= 3 && lab.count / typedTotal < 0.15){
        out.push(`Laboratório representou apenas ${fmtNumber((lab.count/typedTotal)*100,0)}% das sessões classificadas.`);
      }
    }

    if(t.avgSession > 0) out.push(`Sua sessão média durou ${fmtDuration(t.avgSession)}.`);
    if(a.projection.available){
      out.push(`Média das últimas ${a.projection.weeksConsidered} semanas: ${fmtDuration(a.projection.avgWeeklyMinutes)}/semana.`);
      if(a.projection.target) out.push(a.projection.meetsTarget
        ? 'Seu ritmo atual é suficiente para o objetivo semanal do plano.'
        : `Seu ritmo atual está ${fmtDuration(Math.abs(a.projection.gap))} abaixo do objetivo semanal do plano.`);
    }

    return out;
  }
};

/* =========================================================================
   TIMER SERVICE — tempo sempre calculado por timestamps, nunca por setInterval.
   Estado persistido para sobreviver a reload / fechar aba.
   ========================================================================= */
const TimerService = {
  data: null,          // { disciplineId, topicId, presetType, startedAt, accumulatedMs, running }
  _tick: null,

  restore(){
    try {
      const raw = localStorage.getItem(TIMER_LS_KEY);
      if(!raw) { this.data = null; return null; }
      const d = JSON.parse(raw);
      if(!d || typeof d !== 'object' || !d.disciplineId) { this.clear(); return null; }
      if(!getDiscipline(d.disciplineId)) { this.clear(); return null; }   // disciplina sumiu
      this.data = {
        disciplineId: str(d.disciplineId),
        topicId: d.topicId ? str(d.topicId) : null,
        presetType: SESSION_TYPES.some(t => t.v === d.presetType) ? d.presetType : null,
        startedAt: isNum(d.startedAt) ? d.startedAt : Date.now(),
        accumulatedMs: isNum(d.accumulatedMs) ? d.accumulatedMs : 0,
        running: !!d.running,
        openedAt: isNum(d.openedAt) ? d.openedAt : (isNum(d.startedAt) ? d.startedAt : Date.now())
      };
      return this.data;
    } catch(_){ this.clear(); return null; }
  },
  _persist(){
    try {
      if(this.data) localStorage.setItem(TIMER_LS_KEY, JSON.stringify(this.data));
      else localStorage.removeItem(TIMER_LS_KEY);
    } catch(_){ /* storage cheio ou bloqueado: o timer segue em memória */ }
  },
  start(disciplineId, topicId, presetType){
    this.data = { disciplineId, topicId: topicId || null, presetType: presetType || null,
                  startedAt: Date.now(), accumulatedMs: 0, running: true, openedAt: Date.now() };
    this._persist();
    return this.data;
  },
  pause(){
    if(!this.data || !this.data.running) return;
    this.data.accumulatedMs = this.getElapsed();
    this.data.running = false;
    this._persist();
  },
  resume(){
    if(!this.data || this.data.running) return;
    this.data.startedAt = Date.now();
    this.data.running = true;
    this._persist();
  },
  getElapsed(){
    if(!this.data) return 0;
    const base = this.data.accumulatedMs || 0;
    return this.data.running ? base + (Date.now() - this.data.startedAt) : base;
  },
  get isActive(){ return !!this.data; },
  get isRunning(){ return !!(this.data && this.data.running); },
  /** Tempo total desde que a sessão foi aberta (para detectar sessão esquecida). */
  getOpenAgeMs(){ return this.data ? Date.now() - (this.data.openedAt || this.data.startedAt) : 0; },
  finish(){ const d = this.data; const ms = this.getElapsed(); this.clear(); return { data:d, elapsedMs:ms }; },
  discard(){ this.clear(); },
  clear(){ this.data = null; this._persist(); this.stopTicking(); },
  startTicking(fn){ this.stopTicking(); this._tick = setInterval(fn, 1000); },
  stopTicking(){ if(this._tick){ clearInterval(this._tick); this._tick = null; } }
};

/* =========================================================================
   BACKUP / IMPORT / EXPORT
   ========================================================================= */
const Backup = {
  buildExport(){
    return {
      schemaVersion: APP_SCHEMA_VERSION,
      app: 'diario-de-estudos',
      appVersion: APP_VERSION,
      exportedAt: nowISO(),
      areas: state.areas,
      disciplines: state.disciplines,
      topics: state.topics,
      sessions: state.sessions,
      plans: state.plans,
      weeklyPlans: state.weeklyPlans,
      deadlines: state.deadlines,
      settings: state.settings
    };
  },

  download(filename, content, mime){
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },

  async exportJSON(){
    this.download(`diario-estudos_${todayISO()}.json`, JSON.stringify(this.buildExport(), null, 2), 'application/json');
    await setMeta('lastBackupAt', nowISO());
  },

  exportCSV(){
    const head = ['data','area','disciplina','topico','tipo','dificuldade','minutos','creditos','resultado_revisao','comentario'];
    const esc = v => '"' + str(v).replace(/"/g,'""') + '"';
    const rows = state.sessions.slice().sort((a,b) => a.date.localeCompare(b.date)).map(s => {
      const d = getDiscipline(s.disciplineId);
      const diff = difficultyInfo(s.difficulty);
      return [
        s.date, d ? areaNameOf(d) : '', d ? d.name : '', topicLabelOf(s),
        s.type ? sessionTypeLabel(s.type) : '', diff ? diff.label : '',
        s.minutes, s.credits, reviewOutcomeLabel(s.reviewOutcome) || '', s.comment
      ].map(esc).join(',');
    });
    this.download(`sessoes_${todayISO()}.csv`, [head.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
  },

  /** Detecta o formato do arquivo e normaliza para entidades V3. Nunca executa conteúdo. */
  parseBackup(text){
    let raw;
    try { raw = JSON.parse(text); }
    catch(_){ throw new Error('Arquivo inválido: não é um JSON legível.'); }
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Arquivo inválido: estrutura inesperada.');

    const isV3 = Number(raw.schemaVersion) >= 3 || Array.isArray(raw.disciplines);
    const isV2 = !isV3 && (Array.isArray(raw.subjects) || Array.isArray(raw.logs));
    if(!isV3 && !isV2) throw new Error('Arquivo inválido: não parece um backup do Diário de Estudos.');

    // Coleções presentes precisam ser listas de verdade: um campo corrompido não
    // pode virar silenciosamente uma restauração vazia (que apagaria tudo).
    if(isV3){
      ['areas','disciplines','topics','sessions','plans','weeklyPlans','deadlines'].forEach(k => {
        if(k in raw && raw[k] !== null && raw[k] !== undefined && !Array.isArray(raw[k])){
          throw new Error(`Arquivo inválido: o campo "${k}" está corrompido.`);
        }
      });
    }

    const warnings = [];
    let data;

    if(isV2){
      const c = convertV2(raw);
      data = { areas:c.areas, disciplines:c.disciplines, topics:[], sessions:c.sessions, plans:[], weeklyPlans:[], deadlines:[], settings:c.settings };
      if(c.orphanLogs) warnings.push(`${c.orphanLogs} registro(s) antigo(s) sem matéria correspondente foram ignorados.`);
      warnings.push('Backup no formato da V2 — convertido automaticamente.');
    } else {
      data = {
        areas: this._arr(raw.areas), disciplines: this._arr(raw.disciplines), topics: this._arr(raw.topics),
        sessions: this._arr(raw.sessions), plans: this._arr(raw.plans), weeklyPlans: this._arr(raw.weeklyPlans),
        deadlines: this._arr(raw.deadlines),
        settings: Object.assign({}, DEFAULT_SETTINGS, (raw.settings && typeof raw.settings === 'object') ? raw.settings : {})
      };
    }

    // Validação e saneamento (nada além dos campos conhecidos entra no banco).
    const areaIds = new Set();
    data.areas = data.areas.filter(a => a && a.id && !areaIds.has(a.id) && areaIds.add(a.id)).map(a => ({
      id:str(a.id), name:str(a.name) || 'Área', archived:!!a.archived,
      createdAt:str(a.createdAt) || nowISO(), updatedAt:str(a.updatedAt) || nowISO()
    }));

    const discIds = new Set();
    data.disciplines = data.disciplines.filter(d => d && d.id && !discIds.has(d.id) && discIds.add(d.id)).map(d => ({
      id:str(d.id), areaId: (d.areaId && areaIds.has(d.areaId)) ? str(d.areaId) : null,
      name:str(d.name) || 'Disciplina',
      priority: clamp(Number(d.priority) || 3, 1, 5),
      minutesPerCredit: (isNum(d.minutesPerCredit) && d.minutesPerCredit > 0) ? d.minutesPerCredit : 20,
      legacyWeeklyMinutes: isNum(d.legacyWeeklyMinutes) ? d.legacyWeeklyMinutes : 0,
      archived: !!d.archived, createdAt:str(d.createdAt) || nowISO(), updatedAt:str(d.updatedAt) || nowISO()
    }));

    const topicIds = new Set();
    let droppedTopics = 0;
    data.topics = data.topics.filter(t => {
      if(!t || !t.id || topicIds.has(t.id)) return false;
      if(!discIds.has(t.disciplineId)){ droppedTopics++; return false; }
      topicIds.add(t.id); return true;
    }).map(t => ({
      id:str(t.id), disciplineId:str(t.disciplineId), name:str(t.name) || 'Tópico',
      sortOrder: isNum(t.sortOrder) ? t.sortOrder : 0, archived: !!t.archived,
      reviewEnabled: t.reviewEnabled !== false,
      firstStudiedAt: parseISO(str(t.firstStudiedAt)) ? str(t.firstStudiedAt) : null,
      lastStudiedAt: parseISO(str(t.lastStudiedAt)) ? str(t.lastStudiedAt) : null,
      reviewDueDate: parseISO(str(t.reviewDueDate)) ? str(t.reviewDueDate) : null,
      reviewIntervalDays: isNum(t.reviewIntervalDays) ? clamp(t.reviewIntervalDays,1,REVIEW_MAX_INTERVAL) : null,
      lastReviewedAt: parseISO(str(t.lastReviewedAt)) ? str(t.lastReviewedAt) : null,
      reviewRepetitions: isNum(t.reviewRepetitions) ? t.reviewRepetitions : 0,
      masteryLevel: (isNum(t.masteryLevel) && t.masteryLevel >= 1 && t.masteryLevel <= 5) ? t.masteryLevel : null,
      consecutiveSuccessfulReviews: isNum(t.consecutiveSuccessfulReviews) ? t.consecutiveSuccessfulReviews : 0,
      createdAt:str(t.createdAt) || nowISO(), updatedAt:str(t.updatedAt) || nowISO()
    }));
    if(droppedTopics) warnings.push(`${droppedTopics} tópico(s) sem disciplina correspondente foram ignorados.`);

    const sessIds = new Set();
    let droppedSessions = 0;
    data.sessions = data.sessions.filter(s => {
      if(!s || !s.id || sessIds.has(s.id)) return false;
      if(!discIds.has(s.disciplineId)){ droppedSessions++; return false; }
      sessIds.add(s.id); return true;
    }).map(s => ({
      id:str(s.id), disciplineId:str(s.disciplineId),
      topicId: (s.topicId && topicIds.has(s.topicId)) ? str(s.topicId) : null,
      legacyTopicText: str(s.legacyTopicText),
      date: parseISO(str(s.date)) ? str(s.date).slice(0,10) : todayISO(),
      startedAt: str(s.startedAt) || null, endedAt: str(s.endedAt) || null,
      minutes: isNum(s.minutes) ? Math.max(0, s.minutes) : 0,
      credits: isNum(s.credits) ? s.credits : 0,
      type: SESSION_TYPES.some(t => t.v === s.type) ? s.type : null,
      difficulty: (isNum(s.difficulty) && s.difficulty >= 1 && s.difficulty <= 5) ? s.difficulty : null,
      comment: str(s.comment),
      reviewOutcome: REVIEW_OUTCOMES.some(o => o.v === s.reviewOutcome) ? s.reviewOutcome : null,
      createdAt: str(s.createdAt) || nowISO(), updatedAt: str(s.updatedAt) || nowISO()
    }));
    if(droppedSessions) warnings.push(`${droppedSessions} sessão(ões) sem disciplina correspondente foram ignoradas.`);

    const planIds = new Set();
    data.plans = data.plans.filter(p => p && p.id && !planIds.has(p.id) && planIds.add(p.id)).map(p => ({
      id:str(p.id), name:str(p.name) || 'Plano',
      weeklyAvailableMinutes: isNum(p.weeklyAvailableMinutes) ? Math.max(0, Math.round(p.weeklyAvailableMinutes)) : 0,
      active: !!p.active,
      allocations: this._arr(p.allocations).filter(a => a && discIds.has(a.disciplineId)).map(a => ({
        disciplineId:str(a.disciplineId),
        priority: clamp(Number(a.priority) || 3, 1, 5),
        minWeeklyMinutes: isNum(a.minWeeklyMinutes) ? Math.max(0, Math.round(a.minWeeklyMinutes)) : 0,
        targetMinutes: isNum(a.targetMinutes) ? Math.max(0, Math.round(a.targetMinutes)) : 0
      })),
      createdAt:str(p.createdAt) || nowISO(), updatedAt:str(p.updatedAt) || nowISO()
    }));
    let activeSeen = false;
    data.plans.forEach(p => { if(p.active && activeSeen) p.active = false; else if(p.active) activeSeen = true; });

    const wpIds = new Set();
    data.weeklyPlans = data.weeklyPlans.filter(w => w && w.weekStart && parseISO(str(w.weekStart)) && !wpIds.has(str(w.weekStart)) && wpIds.add(str(w.weekStart))).map(w => ({
      id: str(w.weekStart), weekStart: str(w.weekStart),
      weekEnd: parseISO(str(w.weekEnd)) ? str(w.weekEnd) : addDaysISO(str(w.weekStart), 6),
      basePlanId: str(w.basePlanId) || null,
      availableMinutes: isNum(w.availableMinutes) ? Math.max(0, Math.round(w.availableMinutes)) : 0,
      allocations: this._arr(w.allocations).filter(a => a && discIds.has(a.disciplineId)).map(a => ({
        disciplineId:str(a.disciplineId),
        priority: clamp(Number(a.priority) || 3, 1, 5),
        minWeeklyMinutes: isNum(a.minWeeklyMinutes) ? Math.max(0, Math.round(a.minWeeklyMinutes)) : 0,
        targetMinutes: isNum(a.targetMinutes) ? Math.max(0, Math.round(a.targetMinutes)) : 0
      })),
      createdAt:str(w.createdAt) || nowISO(), updatedAt:str(w.updatedAt) || nowISO()
    }));

    const dlIds = new Set();
    data.deadlines = data.deadlines.filter(d => d && d.id && !dlIds.has(d.id) && dlIds.add(d.id)).map(d => ({
      id:str(d.id), title:str(d.title) || 'Prazo',
      date: parseISO(str(d.date)) ? str(d.date).slice(0,10) : todayISO(),
      disciplineId: (d.disciplineId && discIds.has(d.disciplineId)) ? str(d.disciplineId) : null,
      topicId: (d.topicId && topicIds.has(d.topicId)) ? str(d.topicId) : null,
      importance: d.importance === 'alta' ? 'alta' : 'normal',
      completed: !!d.completed,
      createdAt:str(d.createdAt) || nowISO(), updatedAt:str(d.updatedAt) || nowISO()
    }));

    data.settings = sanitizeSettings(data.settings);

    if(data.disciplines.length === 0 && data.sessions.length === 0 && data.areas.length === 0){
      throw new Error('Arquivo inválido: o backup não contém dados para restaurar.');
    }

    return { data, warnings, format: isV2 ? 'v2' : 'v3' };
  },

  _arr(v){ return Array.isArray(v) ? v : []; },

  /** Substitui todo o conteúdo do banco pelo backup, em uma única transação. */
  async restoreInto(data){
    const stores = ['areas','disciplines','topics','sessions','plans','weeklyPlans','deadlines','settings'];
    await DB.clearStores(stores);
    await DB.transactional(stores, api => {
      data.areas.forEach(x => api.put('areas', x));
      data.disciplines.forEach(x => api.put('disciplines', x));
      data.topics.forEach(x => api.put('topics', x));
      data.sessions.forEach(x => api.put('sessions', x));
      data.plans.forEach(x => api.put('plans', x));
      data.weeklyPlans.forEach(x => api.put('weeklyPlans', x));
      data.deadlines.forEach(x => api.put('deadlines', x));
      api.put('settings', { key:'settings', value:data.settings });
    });
  }
};

function sanitizeSettings(s){
  const src = s && typeof s === 'object' ? s : {};
  return {
    theme: (src.theme === 'light') ? 'light' : 'dark',
    weekStart: (src.weekStart === 'sunday') ? 'sunday' : 'monday',
    defaultSessionMinutes: clamp(Math.round(Number(src.defaultSessionMinutes) || DEFAULT_SETTINGS.defaultSessionMinutes), 5, 600),
    defaultReviewMinutes: clamp(Math.round(Number(src.defaultReviewMinutes) || DEFAULT_SETTINGS.defaultReviewMinutes), 5, 600),
    autoReviewNewTopics: src.autoReviewNewTopics !== false,
    reduceMotion: !!src.reduceMotion,
    defaultPeriod: ['hoje','7d','30d','semana','mes','tudo'].includes(src.defaultPeriod) ? src.defaultPeriod : DEFAULT_SETTINGS.defaultPeriod
  };
}

/* =========================================================================
   UI STATE
   ========================================================================= */
const ui = {
  view: 'today',
  period: null,               // { start, end } — usado em Análises
  periodPreset: 'semana',
  calMonth: null,
  calPicking: false,
  distributionMode: 'discipline',
  openDisciplineId: null,
  showArchivedDisciplines: false,
  history: { search:'', areaId:'', disciplineId:'', topicId:'', period:'todos', type:'', difficulty:'' },
  planDraft: null,            // rascunho editável da tela de Planejamento
  weekOffset: 0               // navegação de semanas no relatório semanal
};

/* =========================================================================
   PERSISTÊNCIA DE ALTO NÍVEL (o app fala com estas funções, não com o DB)
   ========================================================================= */
async function loadAll(){
  const [meta, settingsRec, areas, disciplines, topics, sessions, plans, weeklyPlans, deadlines] = await Promise.all([
    DB.getAll('meta'), DB.get('settings','settings'),
    DB.getAll('areas'), DB.getAll('disciplines'), DB.getAll('topics'),
    DB.getAll('sessions'), DB.getAll('plans'), DB.getAll('weeklyPlans'), DB.getAll('deadlines')
  ]);
  state.meta = {};
  (meta || []).forEach(m => { state.meta[m.key] = m.value; });
  state.settings = sanitizeSettings(settingsRec ? settingsRec.value : null);
  state.areas = areas || [];
  state.disciplines = disciplines || [];
  state.topics = topics || [];
  state.sessions = sessions || [];
  state.plans = plans || [];
  state.weeklyPlans = weeklyPlans || [];
  state.deadlines = deadlines || [];
  rebuildIndexes();
}

async function setMeta(key, value){
  await DB.put('meta', { key, value });
  state.meta[key] = value;
}
async function saveSettings(){
  state.settings = sanitizeSettings(state.settings);
  await DB.put('settings', { key:'settings', value: state.settings });
  applyTheme(state.settings.theme);
  applyReduceMotion(state.settings.reduceMotion);
}

async function persist(store, entity){
  entity.updatedAt = nowISO();
  await DB.put(store, entity);
}

/** Recarrega tudo do banco e redesenha a tela atual. */
async function refresh(){
  await loadAll();
  await PlannerEngine.ensureWeeklyPlan();
  render();
}

/* =========================================================================
   FEEDBACK: toasts e modais próprios (substituem alert/confirm)
   ========================================================================= */
const TOAST_MAX = 3;
function toast(message, kind){
  const box = $('#toasts');
  const el = h('div', { class:'toast' + (kind ? ' ' + kind : ''), text:message });
  box.appendChild(el);
  while(box.children.length > TOAST_MAX) box.removeChild(box.firstChild);
  setTimeout(() => {
    el.style.transition = 'opacity 220ms ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 240);
  }, 3200);
}

let modalCloser = null;
/**
 * Abre um modal. `build(close)` devolve { title, content, actions }.
 * Fecha com ESC, clique fora ou chamando close().
 */
function openModal(build, opts){
  const root = $('#modal-root'), box = $('#modal-box');
  const options = opts || {};
  const close = (result) => {
    root.hidden = true;
    clear($('#modal-content')); clear($('#modal-actions'));
    document.removeEventListener('keydown', onKey);
    root.removeEventListener('mousedown', onBackdrop);
    modalCloser = null;
    if(options.onClose) options.onClose(result);
  };
  const onKey = (e) => { if(e.key === 'Escape' && options.dismissible !== false) close(null); };
  const onBackdrop = (e) => { if(e.target === root && options.dismissible !== false) close(null); };

  const cfg = build(close) || {};
  box.className = 'modal' + (options.size ? ' ' + options.size : '');
  $('#modal-title').textContent = cfg.title || '';
  mount($('#modal-content'), cfg.content || null);
  mount($('#modal-actions'), ...(cfg.actions || []));
  root.hidden = false;
  document.addEventListener('keydown', onKey);
  root.addEventListener('mousedown', onBackdrop);
  modalCloser = close;

  const focusTarget = box.querySelector('input,select,textarea,button');
  if(focusTarget) setTimeout(() => focusTarget.focus(), 30);
  return close;
}

function confirmModal(message, opts){
  const o = opts || {};
  return new Promise(resolve => {
    openModal(close => ({
      title: o.title || 'Confirmar',
      content: h('p', { class:'modal-sub', text:message, style:'margin-bottom:0' }),
      actions: [
        h('button', { class:'btn ghost', type:'button', text:o.cancelLabel || 'Cancelar', onclick:() => { close(); resolve(false); } }),
        h('button', { class:'btn ' + (o.danger === false ? 'primary' : 'danger'), type:'button', text:o.confirmLabel || 'Confirmar',
                      onclick:() => { close(); resolve(true); } })
      ]
    }), { size:'narrow', onClose:(r) => { if(r === null) resolve(false); } });
  });
}

/* =========================================================================
   RENDERING — componentes compartilhados
   ========================================================================= */
function applyTheme(theme){
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_LS_KEY, t); } catch(_){}
  const id = t === 'dark' ? '#i-sun' : '#i-moon';
  ['#theme-icon','#theme-icon-m'].forEach(sel => { const el = $(sel); if(el) el.setAttribute('href', id); });
}
function applyReduceMotion(on){ document.documentElement.classList.toggle('reduce-motion', !!on); }

function card(title, ...children){
  const parts = [];
  if(title) parts.push(h('p', { class:'card-title', text:title }));
  return h('div', { class:'card' }, parts, children);
}
function cardWithAction(title, actionEl, ...children){
  return h('div', { class:'card' },
    h('div', { class:'card-head' }, h('p', { class:'card-title', text:title, style:'margin:0' }), actionEl),
    children);
}
function statBox(value, label, delta){
  return h('div', { class:'stat' },
    h('span', { class:'v', text:value }),
    h('span', { class:'l', text:label }),
    delta ? h('span', { class:'d ' + (delta.dir || ''), text:delta.text }) : null);
}
function progressBar(pct, cls){
  return h('div', { class:'bar' }, h('div', { class:'bar-fill' + (cls ? ' ' + cls : ''), style:`width:${clamp(pct || 0, 0, 100)}%` }));
}
function emptyState(title, text, actionEl){
  return h('div', { class:'empty' }, h('strong', { text:title }), h('span', { text:text }), actionEl ? h('div', { style:'margin-top:10px' }, actionEl) : null);
}
function selectField(id, label, options, value, onchange){
  const sel = h('select', { id, onchange });
  options.forEach(o => sel.appendChild(h('option', { value:o.value, selected:String(o.value) === String(value) }, o.label)));
  return h('div', { class:'field' }, label ? h('label', { for:id, text:label }) : null, sel);
}
function disciplineOptions(includeEmpty, includeArchived){
  const opts = includeEmpty ? [{ value:'', label:'— Selecione —' }] : [];
  const list = (includeArchived ? state.disciplines : activeDisciplines()).slice().sort(sortByName);
  list.forEach(d => opts.push({ value:d.id, label: d.name + (d.archived ? ' (arquivada)' : '') + ' · ' + areaNameOf(d) }));
  return opts;
}
function topicOptions(disciplineId, includeEmpty){
  const opts = includeEmpty ? [{ value:'', label:'— Sem tópico específico —' }] : [];
  topicsOf(disciplineId).forEach(t => opts.push({ value:t.id, label:t.name }));
  return opts;
}
function pillGroup(items, value, onPick, nameAttr){
  const wrap = h('div', { class:'chips', role:'group', 'aria-label':nameAttr || '' });
  items.forEach(it => {
    const b = h('button', { type:'button', class:'chip', 'aria-pressed': String(it.value) === String(value) ? 'true' : 'false',
      style: it.color ? `--chip-color:${it.color}` : null, text:it.label });
    b.addEventListener('click', () => {
      const next = (b.getAttribute('aria-pressed') === 'true' && it.allowToggle !== false) ? null : it.value;
      $$('.chip', wrap).forEach(x => x.setAttribute('aria-pressed','false'));
      if(next !== null) b.setAttribute('aria-pressed','true');
      onPick(next);
    });
    wrap.appendChild(b);
  });
  return wrap;
}
function statusMark(status){
  const map = { nao_iniciado:'', em_estudo:'studying', em_revisao:'reviewing', dominado:'mastered' };
  const el = h('span', { class:'status-mark ' + (map[status] || ''), 'aria-hidden':'true' });
  if(status === 'dominado') el.textContent = '✓';
  return el;
}

/* ---------- NAVEGAÇÃO ---------- */
function setView(view){
  if(!VIEW_TITLES[view]) view = 'today';
  ui.view = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('#nav-desktop .nav-item').forEach(b => {
    if(b.dataset.view === view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  $$('#nav-mobile .mb-item').forEach(b => {
    if(b.dataset.view === view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  const mt = $('#mobile-title'); if(mt) mt.textContent = VIEW_TITLES[view];
  window.scrollTo({ top:0, behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });
  render();
}

function updateBadges(){
  const n = ReviewEngine.getDueReviews().length;
  $$('[data-badge="reviews"]').forEach(b => {
    b.textContent = String(n);
    b.classList.toggle('hidden', n === 0);
  });
}

/* ---------- BARRA DO CRONÔMETRO ---------- */
function renderTimerBar(){
  const slot = $('#timerbar-slot');
  if(!TimerService.isActive){ clear(slot); TimerService.stopTicking(); return; }
  const d = TimerService.data;
  const disc = getDiscipline(d.disciplineId);
  const topic = d.topicId ? getTopic(d.topicId) : null;

  const clock = h('span', { class:'tb-clock' + (TimerService.isRunning ? '' : ' paused'), text: fmtClock(TimerService.getElapsed()), 'aria-live':'off' });
  const bar = h('div', { class:'timerbar', role:'region', 'aria-label':'Sessão em andamento' },
    h('div', { class:'tb-what' },
      h('div', { class:'tb-disc', text: disc ? disc.name : '(disciplina removida)' }),
      h('div', { class:'tb-topic', text: (topic ? topic.name : 'Sem tópico') + (d.presetType ? ' · ' + sessionTypeLabel(d.presetType) : '') }
    )),
    clock,
    h('div', { class:'row auto' },
      h('button', { class:'btn ghost sm', type:'button', text: TimerService.isRunning ? 'Pausar' : 'Retomar',
        onclick:() => { TimerService.isRunning ? TimerService.pause() : TimerService.resume(); renderTimerBar(); } }),
      h('button', { class:'btn primary sm', type:'button', text:'Finalizar', onclick:openFinishModal }),
      h('button', { class:'linkbtn muted', type:'button', text:'descartar', onclick:discardTimer })
    )
  );
  mount(slot, bar);

  TimerService.startTicking(() => {
    if(!TimerService.isActive){ TimerService.stopTicking(); return; }
    clock.textContent = fmtClock(TimerService.getElapsed());
    clock.classList.toggle('paused', !TimerService.isRunning);
  });
}

async function discardTimer(){
  const ok = await confirmModal('Descartar esta sessão sem registrar o tempo?', { confirmLabel:'Descartar' });
  if(!ok) return;
  TimerService.discard();
  renderTimerBar();
  toast('Sessão descartada.');
}

/* ---------- INICIAR SESSÃO ---------- */
function startTimer(disciplineId, topicId, presetType){
  if(TimerService.isActive){
    toast('Já existe uma sessão em andamento. Finalize-a antes de iniciar outra.', 'err');
    return;
  }
  TimerService.start(disciplineId, topicId, presetType);
  renderTimerBar();
  toast('Sessão iniciada. Bons estudos!', 'ok');
}

/** Modal do botão global "+ Registrar": cronômetro ou registro manual. */
function openRegisterModal(preset){
  const p = preset || {};
  if(!activeDisciplines().length){
    openModal(close => ({
      title:'Nenhuma disciplina ativa',
      content: emptyState('Cadastre uma disciplina primeiro', 'Em Disciplinas você cria áreas, disciplinas e tópicos. Depois é só registrar suas sessões aqui.'),
      actions:[ h('button', { class:'btn primary', type:'button', text:'Ir para Disciplinas', onclick:() => { close(); setView('disciplines'); } }) ]
    }));
    return;
  }

  let mode = p.mode || 'timer';
  let discId = p.disciplineId || (activeDisciplines().slice().sort(sortByName)[0] || {}).id || '';
  let topicId = p.topicId || '';
  let difficulty = null, type = p.type || null, outcome = null;

  openModal(close => {
    const content = h('div');

    const tabs = h('div', { class:'chips', style:'margin-bottom:14px' },
      h('button', { class:'chip', type:'button', 'aria-pressed': mode === 'timer' ? 'true':'false', text:'Cronômetro',
        onclick:() => { mode = 'timer'; rebuild(); } }),
      h('button', { class:'chip', type:'button', 'aria-pressed': mode === 'manual' ? 'true':'false', text:'Registrar manualmente',
        onclick:() => { mode = 'manual'; rebuild(); } })
    );

    const body = h('div');
    content.append(tabs, body);

    function rebuild(){
      $$('.chip', tabs).forEach((c,i) => c.setAttribute('aria-pressed', (i === 0) === (mode === 'timer') ? 'true' : 'false'));
      clear(body);

      const discSel = selectField('rm-disc', 'Disciplina', disciplineOptions(false), discId, (e) => {
        discId = e.target.value; topicId = ''; rebuild();
      });
      const topicSel = selectField('rm-topic', 'Tópico (opcional)', topicOptions(discId, true), topicId, (e) => { topicId = e.target.value; });
      body.append(discSel, topicSel);

      if(mode === 'timer'){
        body.append(h('p', { class:'hint', text:'O cronômetro continua rodando mesmo se você recarregar ou fechar a aba.' }));
      } else {
        const dateInput = h('input', { type:'date', id:'rm-date', value: todayISO(), max: todayISO() });
        const minInput = h('input', { type:'number', id:'rm-min', min:'1', step:'1', value:String(state.settings.defaultSessionMinutes), inputmode:'numeric' });
        const preview = h('p', { class:'hint', text:'' });
        const updatePreview = () => {
          const mins = Number(minInput.value);
          preview.textContent = (mins > 0 && discId) ? `${mins} minutos = ${fmtNumber(creditsFor(discId, mins))} crédito(s)` : '';
        };
        minInput.addEventListener('input', updatePreview);

        const quick = h('div', { class:'chips', style:'margin-bottom:8px' },
          [20,30,40,60].map(v => h('button', { class:'chip', type:'button', text:v + ' min',
            onclick:() => { minInput.value = String(v); updatePreview(); } })));

        const outcomeField = h('div', { class:'field' });
        const renderOutcome = () => {
          clear(outcomeField);
          if(type === 'revisao' && topicId){
            outcomeField.append(
              h('label', { text:'Como você se saiu?' }),
              pillGroup(REVIEW_OUTCOMES.map(o => ({ value:o.v, label:o.label })), outcome, v => { outcome = v; }));
          }
        };

        body.append(
          h('div', { class:'row' },
            h('div', { class:'field' }, h('label', { for:'rm-date', text:'Data' }), dateInput),
            h('div', { class:'field' }, h('label', { for:'rm-min', text:'Minutos' }), quick, minInput, preview)
          ),
          selectField('rm-type', 'Tipo de sessão', [{value:'',label:'— Não informado —'}].concat(SESSION_TYPES.map(t => ({ value:t.v, label:t.label }))), type,
            (e) => { type = e.target.value || null; renderOutcome(); }),
          h('div', { class:'field' }, h('label', { text:'Dificuldade percebida (opcional)' }),
            pillGroup(DIFFICULTIES.map(d => ({ value:d.v, label:d.label, color:d.color })), difficulty, v => { difficulty = v ? Number(v) : null; })),
          outcomeField,
          h('div', { class:'field' }, h('label', { for:'rm-comment', text:'Comentário (opcional)' }), h('textarea', { id:'rm-comment' }))
        );
        renderOutcome();
        topicSel.addEventListener('change', renderOutcome);
        updatePreview();
      }
    }
    rebuild();

    return {
      title:'Registrar progresso',
      content,
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        h('button', { class:'btn primary', type:'button', text: mode === 'timer' ? 'Iniciar sessão' : 'Salvar sessão',
          onclick: async () => {
            if(!discId){ toast('Escolha uma disciplina.', 'err'); return; }
            if(mode === 'timer'){ close(); startTimer(discId, topicId || null, type); return; }
            const minutes = Number(($('#rm-min') || {}).value);
            if(!(minutes > 0)){ toast('Informe os minutos estudados.', 'err'); return; }
            const date = ($('#rm-date') || {}).value || todayISO();
            const comment = (($('#rm-comment') || {}).value || '').trim();
            close();
            await saveSession({ disciplineId:discId, topicId: topicId || null, date, minutes, type, difficulty, comment, reviewOutcome: (type === 'revisao' ? outcome : null) });
          } })
      ]
    };
  }, { size:'wide' });
}

/** Modal de finalização do cronômetro. */
function openFinishModal(){
  if(!TimerService.isActive) return;
  const d = TimerService.data;
  const elapsedMin = Math.max(1, Math.round(TimerService.getElapsed() / 60000));
  let type = d.presetType || null;
  let difficulty = null, outcome = null;
  const topic = d.topicId ? getTopic(d.topicId) : null;

  openModal(close => {
    const minInput = h('input', { type:'number', id:'fin-min', min:'1', step:'1', value:String(elapsedMin), inputmode:'numeric' });
    const preview = h('p', { class:'hint' });
    const update = () => {
      const m = Number(minInput.value);
      preview.textContent = m > 0 ? `${m} minutos = ${fmtNumber(creditsFor(d.disciplineId, m))} crédito(s)` : '';
    };
    minInput.addEventListener('input', update);

    const outcomeField = h('div', { class:'field' });
    const renderOutcome = () => {
      clear(outcomeField);
      if(type === 'revisao' && topic){
        outcomeField.append(
          h('label', { text:'Como você se saiu?' }),
          pillGroup(REVIEW_OUTCOMES.map(o => ({ value:o.v, label:o.label })), outcome, v => { outcome = v; }),
          h('p', { class:'hint', text:'Isso ajusta o intervalo até a próxima revisão deste tópico.' })
        );
      }
    };

    const typeSel = selectField('fin-type', 'Tipo de sessão',
      [{value:'',label:'— Não informado —'}].concat(SESSION_TYPES.map(t => ({ value:t.v, label:t.label }))), type,
      (e) => { type = e.target.value || null; renderOutcome(); });

    const content = h('div',
      h('p', { class:'modal-sub', text: (getDiscipline(d.disciplineId) || {}).name + (topic ? ' · ' + topic.name : '') }),
      h('div', { class:'field' }, h('label', { for:'fin-min', text:'Tempo (minutos)' }), minInput, preview),
      typeSel,
      h('div', { class:'field' }, h('label', { text:'Dificuldade percebida (opcional)' }),
        pillGroup(DIFFICULTIES.map(x => ({ value:x.v, label:x.label, color:x.color })), difficulty, v => { difficulty = v ? Number(v) : null; })),
      outcomeField,
      h('div', { class:'field' }, h('label', { for:'fin-comment', text:'Comentário (opcional)' }), h('textarea', { id:'fin-comment' }))
    );
    renderOutcome();
    update();

    return {
      title:'Finalizar sessão',
      content,
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Voltar', onclick:() => close() }),
        h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
          const minutes = Number(minInput.value);
          if(!(minutes > 0)){ toast('Informe um tempo válido.', 'err'); return; }
          const comment = (($('#fin-comment') || {}).value || '').trim();
          const started = d.startedAt;
          const fin = TimerService.finish();
          close();
          renderTimerBar();
          await saveSession({
            disciplineId: fin.data.disciplineId, topicId: fin.data.topicId, date: todayISO(),
            minutes, type, difficulty, comment,
            reviewOutcome: (type === 'revisao' ? outcome : null),
            startedAt: new Date(started).toISOString(), endedAt: nowISO()
          });
        } })
      ]
    };
  }, { size:'wide', dismissible:false });
}

/** Sessão esquecida aberta por muito tempo. */
function offerStaleSession(){
  const hours = TimerService.getOpenAgeMs() / 3600000;
  if(hours < 6) return;
  const elapsedMin = Math.round(TimerService.getElapsed() / 60000);
  openModal(close => ({
    title:'Sessão em andamento há muito tempo',
    content: h('div',
      h('p', { class:'modal-sub', text:`Existe uma sessão de ${(getDiscipline(TimerService.data.disciplineId) || {}).name || ''} iniciada há ${fmtDuration(elapsedMin)}. Provavelmente você esqueceu de finalizá-la.` }),
      h('p', { class:'hint', text:'Ao finalizar você poderá corrigir a duração antes de salvar.' })
    ),
    actions:[
      h('button', { class:'btn ghost', type:'button', text:'Continuar', onclick:() => close() }),
      h('button', { class:'btn danger', type:'button', text:'Descartar', onclick: async () => { close(); TimerService.discard(); renderTimerBar(); toast('Sessão descartada.'); } }),
      h('button', { class:'btn primary', type:'button', text:'Finalizar', onclick:() => { close(); openFinishModal(); } })
    ]
  }), { dismissible:false });
}

/* =========================================================================
   AÇÕES DE DOMÍNIO — gravação com transações quando há efeitos relacionados
   ========================================================================= */
/**
 * Salva uma sessão. Quando há tópico envolvido, atualiza revisão/domínio
 * na MESMA transação — ou tudo grava, ou nada.
 */
async function saveSession(input){
  const disc = getDiscipline(input.disciplineId);
  if(!disc){ toast('Disciplina não encontrada.', 'err'); return; }

  const minutes = Math.max(0, Math.round(Number(input.minutes) || 0));
  const session = newSession({
    disciplineId: disc.id,
    topicId: input.topicId || null,
    date: input.date || todayISO(),
    minutes,
    credits: creditsFor(disc.id, minutes),
    type: input.type || null,
    difficulty: input.difficulty || null,
    comment: str(input.comment),
    reviewOutcome: input.reviewOutcome || null,
    startedAt: input.startedAt || null,
    endedAt: input.endedAt || null
  });

  let topic = session.topicId ? getTopic(session.topicId) : null;
  let topicCopy = null;
  if(topic){
    topicCopy = Object.assign({}, topic);
    const isFirst = !topicCopy.firstStudiedAt && !topicCopy.reviewDueDate;
    if(isFirst) ReviewEngine.scheduleFirstReview(topicCopy, session.date);
    if(session.reviewOutcome) ReviewEngine.applyReviewOutcome(topicCopy, session.reviewOutcome, session.date);
    if(!topicCopy.lastStudiedAt || session.date > topicCopy.lastStudiedAt) topicCopy.lastStudiedAt = session.date;
    topicCopy.updatedAt = nowISO();
  }

  try {
    await DB.transactional(topicCopy ? ['sessions','topics'] : ['sessions'], api => {
      api.put('sessions', session);
      if(topicCopy) api.put('topics', topicCopy);
    });
  } catch(err){
    console.error(err);
    toast('Não foi possível salvar a sessão.', 'err');
    return;
  }

  await refresh();
  const extra = topicCopy && topicCopy.reviewDueDate ? ` Próxima revisão: ${fmtRelativeFuture(topicCopy.reviewDueDate)}.` : '';
  toast(`Sessão registrada: ${fmtDuration(minutes)} em ${disc.name}.${extra}`, 'ok');
}

async function updateSession(id, changes){
  const s = state.sessions.find(x => x.id === id);
  if(!s) return;
  const updated = Object.assign({}, s, changes, { updatedAt: nowISO() });
  updated.minutes = Math.max(0, Math.round(Number(updated.minutes) || 0));
  updated.credits = creditsFor(updated.disciplineId, updated.minutes);
  await DB.put('sessions', updated);
  await refresh();
  toast('Sessão atualizada.', 'ok');
}

async function deleteSession(id){
  await DB.delete('sessions', id);
  await refresh();
  toast('Sessão removida.');
}

/* =========================================================================
   TELA: HOJE
   ========================================================================= */
function renderToday(){
  const root = $('#today-body');
  const parts = [];

  const plan = PlannerEngine.activePlan();
  const prog = PlannerEngine.getCurrentWeekProgress();
  const due = ReviewEngine.getDueReviews();
  const actions = RecommendationEngine.getNextActions(3);
  const todaySessions = state.sessions.filter(s => s.date === todayISO());
  const todayMinutes = sum(todaySessions, s => s.minutes);

  if(!activeDisciplines().length){
    mount(root, card(null, emptyState(
      'Comece cadastrando o que você estuda',
      'Crie uma área (ex.: Tecnologia), uma disciplina (ex.: CCNA) e seus tópicos. A partir daí o sistema passa a sugerir o que estudar e agenda as revisões sozinho.',
      h('button', { class:'btn primary', type:'button', text:'Cadastrar disciplina', onclick:() => setView('disciplines') })
    )));
    return;
  }

  /* --- progresso da semana --- */
  if(plan && prog.plannedTotal > 0){
    const pct = clamp(prog.pct || 0, 0, 999);
    parts.push(h('div', { class:'card today-progress' },
      h('div', { class:'top' },
        h('div', null,
          h('p', { class:'card-title', text:'Progresso da semana', style:'margin:0 0 4px' }),
          h('span', { class:'big', text: fmtDuration(prog.realizedTotal) }),
          h('span', { class:'big', text:' / ' + fmtDuration(prog.plannedTotal), style:'color:var(--muted);font-size:17px' })
        ),
        h('span', { class:'pct', text: fmtPct(pct) })
      ),
      progressBar(pct, pct >= 100 ? 'done' : null),
      h('p', { class:'hint', text: prog.remainingTotal > 0
        ? `Faltam ${fmtDuration(prog.remainingTotal)} para fechar o plano desta semana.`
        : 'Plano semanal concluído. O que vier agora é bônus.' })
    ));
  } else {
    parts.push(card(null, emptyState(
      'Defina quanto quer estudar por semana',
      'Com um plano ativo, o sistema calcula quanto falta, distribui o tempo entre suas disciplinas e passa a recomendar o que estudar agora.',
      h('button', { class:'btn primary', type:'button', text:'Criar plano semanal', onclick:() => setView('plan') })
    )));
  }

  /* --- próxima melhor ação --- */
  const top = actions[0];
  if(top){
    const isReview = top.suggestedType === 'revisao';
    parts.push(h('div', { class:'card next-action' },
      h('p', { class:'card-title', text:'Próxima sessão' }),
      h('div', { class:'na-disc', text: top.discipline.name }),
      h('div', { class:'na-topic', text: top.topic ? top.topic.name : 'Sem tópico específico' }),
      h('div', { class:'na-dur' }, fmtDuration(top.duration), isReview ? h('span', { class:'pill brass', text:'revisão', style:'margin-left:8px' }) : null),
      h('ul', { class:'reasons' }, top.reasons.slice(0,3).map(r => h('li', { text:r }))),
      h('div', { class:'row auto' },
        h('button', { class:'btn primary', type:'button', onclick:() => startTimer(top.discipline.id, top.topic ? top.topic.id : null, top.suggestedType) },
          icon('i-play'), 'Iniciar sessão'),
        h('button', { class:'linkbtn', type:'button', text:'Por que esta sugestão?', onclick:() => explainAction(top) })
      )
    ));
  }

  /* --- revisões --- */
  const revCard = h('div', { class:'card' });
  revCard.append(h('div', { class:'card-head' },
    h('p', { class:'card-title', text:'Revisões', style:'margin:0' }),
    due.length ? h('span', { class:'pill ' + (due.some(t => (daysUntilISO(t.reviewDueDate) || 0) < 0) ? 'danger' : 'brass'),
                             text: due.length + (due.length === 1 ? ' pendente' : ' pendentes') }) : null
  ));
  if(!due.length){
    revCard.append(h('p', { class:'hint', text: state.topics.some(t => t.reviewDueDate)
      ? 'Nenhuma revisão pendente hoje. A fila está em dia.'
      : 'Quando você estudar um tópico, ele entra automaticamente no ciclo de revisão.' }));
  } else {
    due.slice(0,3).forEach(t => revCard.append(reviewItem(t)));
    if(due.length > 3) revCard.append(h('div', { style:'margin-top:10px' },
      h('button', { class:'linkbtn', type:'button', text:`ver todas as ${due.length} revisões`, onclick:() => setView('reviews') })));
  }
  parts.push(revCard);

  /* --- alternativas --- */
  if(actions.length > 1){
    parts.push(card('Depois',
      h('ul', { class:'alt-list' }, actions.slice(1).map((a, i) => h('li', null,
        h('span', { class:'ord', text:String(i + 2) + '.' }),
        h('span', { class:'alt-main' },
          h('div', { text: a.discipline.name + (a.topic ? ' — ' + a.topic.name : '') }),
          h('div', { class:'alt-sub', text: a.reasons[0] })),
        h('button', { class:'linkbtn', type:'button', text:'iniciar',
          onclick:() => startTimer(a.discipline.id, a.topic ? a.topic.id : null, a.suggestedType) })
      )))
    ));
  }

  /* --- resumo --- */
  const revStats = (() => {
    const wr = { start: startOfWeek(today()), end: endOfWeek(today()) };
    const doneWeek = sessionsInRange(wr).filter(s => s.type === 'revisao' || s.reviewOutcome).length;
    return { doneWeek, due: due.length };
  })();
  parts.push(card('Resumo',
    h('div', { class:'stat-grid' },
      statBox(fmtDuration(todayMinutes), 'estudado hoje'),
      statBox(fmtDuration(prog.realizedTotal), 'nesta semana'),
      statBox(prog.plannedTotal > 0 ? fmtPct(clamp(prog.pct || 0, 0, 999)) : '—', 'do plano semanal'),
      statBox(String(revStats.doneWeek), 'revisões na semana'),
      statBox(String(revStats.due), 'revisões pendentes')
    ),
    h('div', { style:'margin-top:12px' },
      h('button', { class:'linkbtn', type:'button', text:'Ver análises completas', onclick:() => setView('analytics') }))
  ));

  mount(root, parts);
}

function reviewItem(topic){
  const disc = getDiscipline(topic.disciplineId);
  const overdue = (daysUntilISO(topic.reviewDueDate) || 0) < 0;
  return h('div', { class:'rev-item' },
    h('span', { class:'dot', style:`background:${overdue ? 'var(--danger)' : 'var(--brass)'}` }),
    h('div', { class:'ri-main' },
      h('div', { class:'ri-name', text: topic.name }),
      h('div', { class:'ri-meta', text: (disc ? disc.name + ' · ' : '') + fmtRelativeFuture(topic.reviewDueDate) + (topic.masteryLevel ? ` · domínio ${topic.masteryLevel}/5` : '') })
    ),
    h('button', { class:'btn ghost sm', type:'button', text:'Revisar',
      onclick:() => startTimer(topic.disciplineId, topic.id, 'revisao') })
  );
}

function explainAction(action){
  openModal(close => ({
    title:'Por que esta sugestão?',
    content: h('div',
      h('p', { class:'modal-sub', text: `${action.discipline.name}${action.topic ? ' — ' + action.topic.name : ''} foi recomendado porque:` }),
      h('ul', { class:'reasons' }, action.reasons.map(r => h('li', { text:r }))),
      h('p', { class:'hint', style:'margin-top:12px', text:'A recomendação combina déficit do plano semanal, prioridade da disciplina, tempo desde o último estudo, prazos próximos, revisões pendentes e domínio dos tópicos. Nada é aleatório e nada sai do seu navegador.' })
    ),
    actions:[ h('button', { class:'btn ghost', type:'button', text:'Fechar', onclick:() => close() }) ]
  }));
}

/* =========================================================================
   TELA: REVISÕES
   ========================================================================= */
function renderReviews(){
  const root = $('#reviews-body');
  const due = ReviewEngine.getDueReviews();
  const upcoming = ReviewEngine.getUpcomingReviews(14);
  const parts = [];

  const anyReviewTopic = state.topics.some(t => t.reviewDueDate);
  if(!anyReviewTopic){
    mount(root, card(null, emptyState(
      'Nenhuma revisão ainda',
      'Quando você estudar um tópico pela primeira vez, ele entra automaticamente no ciclo de revisão — a primeira fica marcada para o dia seguinte e o intervalo se adapta conforme você acerta ou esquece.',
      h('button', { class:'btn primary', type:'button', text:'Ver disciplinas', onclick:() => setView('disciplines') })
    )));
    return;
  }

  const overdue = due.filter(t => (daysUntilISO(t.reviewDueDate) || 0) < 0);
  const forToday = due.filter(t => (daysUntilISO(t.reviewDueDate) || 0) === 0);

  if(overdue.length){
    const c = h('div', { class:'card' }, h('div', { class:'card-head' },
      h('p', { class:'card-title', text:'Atrasadas', style:'margin:0' }),
      h('span', { class:'pill danger', text:String(overdue.length) })));
    overdue.forEach(t => c.append(reviewItem(t)));
    parts.push(c);
  }
  if(forToday.length){
    const c = h('div', { class:'card' }, h('div', { class:'card-head' },
      h('p', { class:'card-title', text:'Para hoje', style:'margin:0' }),
      h('span', { class:'pill brass', text:String(forToday.length) })));
    forToday.forEach(t => c.append(reviewItem(t)));
    parts.push(c);
  }
  if(!due.length){
    parts.push(card(null, h('p', { class:'hint', text:'Nenhuma revisão pendente. Volte amanhã — a fila se preenche sozinha conforme os intervalos vencem.' })));
  }

  if(upcoming.length){
    const byDay = new Map();
    upcoming.forEach(t => { if(!byDay.has(t.reviewDueDate)) byDay.set(t.reviewDueDate, []); byDay.get(t.reviewDueDate).push(t); });
    const c = h('div', { class:'card' }, h('p', { class:'card-title', text:'Próximas' }));
    Array.from(byDay.entries()).forEach(([date, list]) => {
      c.append(h('div', { style:'margin-top:10px' },
        h('p', { class:'hint', style:'margin:0 0 4px', text: fmtRelativeFuture(date) + ' · ' + fmtDateBR(date) }),
        h('ul', { class:'alt-list' }, list.map(t => h('li', null,
          h('span', { class:'alt-main' },
            h('div', { text:t.name }),
            h('div', { class:'alt-sub', text: disciplineName(t.disciplineId) + (t.masteryLevel ? ` · domínio ${t.masteryLevel}/5` : '') })),
          h('button', { class:'linkbtn', type:'button', text:'antecipar',
            onclick:() => startTimer(t.disciplineId, t.id, 'revisao') })
        )))
      ));
    });
    parts.push(c);
  }

  const withReview = state.topics.filter(t => !t.archived && t.reviewDueDate);
  if(withReview.length){
    const dominated = withReview.filter(t => topicStatus(t) === 'dominado').length;
    parts.push(card('Panorama',
      h('div', { class:'stat-grid' },
        statBox(String(withReview.length), 'tópicos no ciclo'),
        statBox(String(dominated), 'dominados'),
        statBox(String(due.length), 'pendentes agora'),
        statBox(String(upcoming.length), 'nos próximos 14 dias'))));
  }

  mount(root, parts);
}

/* =========================================================================
   TELA: PLANEJAMENTO
   ========================================================================= */
function ensurePlanDraft(){
  const plan = PlannerEngine.activePlan();
  if(ui.planDraft && ui.planDraft.planId === (plan ? plan.id : null)) return ui.planDraft;
  const discs = activeDisciplines().slice().sort(sortByName);
  const existing = new Map((plan ? plan.allocations : []).map(a => [a.disciplineId, a]));
  ui.planDraft = {
    planId: plan ? plan.id : null,
    name: plan ? plan.name : 'Meu plano',
    availableMinutes: plan ? plan.weeklyAvailableMinutes : 300,
    allocations: discs.map(d => {
      const a = existing.get(d.id);
      return {
        disciplineId: d.id,
        priority: a ? a.priority : d.priority,
        minWeeklyMinutes: a ? a.minWeeklyMinutes : 0,
        targetMinutes: a ? a.targetMinutes : 0
      };
    })
  };
  return ui.planDraft;
}

function renderPlan(){
  const root = $('#plan-body');
  const parts = [];
  const plan = PlannerEngine.activePlan();

  if(!activeDisciplines().length){
    mount(root, card(null, emptyState('Cadastre disciplinas primeiro',
      'O planejamento distribui seu tempo semanal entre as disciplinas ativas.',
      h('button', { class:'btn primary', type:'button', text:'Ir para Disciplinas', onclick:() => setView('disciplines') }))));
    return;
  }

  const draft = ensurePlanDraft();

  /* --- disponibilidade --- */
  const availInput = h('input', { type:'number', id:'plan-avail-h', min:'0', step:'0.5', inputmode:'decimal',
    value: String(Math.round((draft.availableMinutes / 60) * 100) / 100) });
  availInput.addEventListener('input', () => {
    const hours = Number(availInput.value);
    draft.availableMinutes = Math.max(0, Math.round((isFinite(hours) ? hours : 0) * 60));
    updateTotals();
  });

  const nameInput = h('input', { type:'text', id:'plan-name', value: draft.name, maxlength:'60' });
  nameInput.addEventListener('input', () => { draft.name = nameInput.value; });

  parts.push(card('Plano ativo',
    h('div', { class:'row' },
      h('div', { class:'field' }, h('label', { for:'plan-name', text:'Nome do plano' }), nameInput),
      h('div', { class:'field' }, h('label', { for:'plan-avail-h', text:'Horas por semana' }), availInput,
        h('p', { class:'hint', text:'Quanto tempo você pretende dedicar aos estudos por semana.' }))
    ),
    h('div', { class:'row auto' },
      h('button', { class:'btn ghost sm', type:'button', text:'Distribuir automaticamente', onclick:() => {
        const res = PlannerEngine.generatePlan(draft.availableMinutes, draft.allocations);
        draft.allocations = res.allocations;
        renderPlan();
        if(res.conflict) toast(`Seus mínimos ultrapassam a disponibilidade em ${fmtDuration(res.conflict.excess)}. Os valores foram reduzidos proporcionalmente.`, 'err');
        else toast('Distribuição gerada.', 'ok');
      } })
    )
  ));

  /* --- alocações --- */
  const allocCard = h('div', { class:'card' });
  allocCard.append(h('div', { class:'card-head' },
    h('p', { class:'card-title', text:'Distribuição semanal', style:'margin:0' }),
    h('span', { class:'hint', text:'Edite qualquer valor livremente.' })));
  allocCard.append(h('div', { class:'alloc-head' },
    h('span', { text:'Disciplina' }), h('span', { text:'Prioridade' }), h('span', { text:'Mínimo' }), h('span', { text:'Planejado' })));

  const totalEl = h('span', { class:'at-v' });
  const diffEl = h('p', { class:'hint', style:'margin:0' });

  function updateTotals(){
    const total = sum(draft.allocations, a => Number(a.targetMinutes) || 0);
    totalEl.textContent = `${fmtDuration(total)} / ${fmtDuration(draft.availableMinutes)}`;
    const d = total - draft.availableMinutes;
    if(d === 0) diffEl.textContent = 'O planejado bate exatamente com a disponibilidade.';
    else if(d > 0) diffEl.textContent = `${fmtDuration(d)} acima da disponibilidade.`;
    else diffEl.textContent = `${fmtDuration(-d)} ainda não distribuídos.`;
    diffEl.style.color = d > 0 ? 'var(--brass)' : '';
    const mins = sum(draft.allocations, a => Number(a.minWeeklyMinutes) || 0);
    if(mins > draft.availableMinutes){
      diffEl.textContent += `  ·  Seus mínimos somam ${fmtDuration(mins)}, ${fmtDuration(mins - draft.availableMinutes)} acima da disponibilidade.`;
      diffEl.style.color = 'var(--danger)';
    }
  }

  draft.allocations.forEach(a => {
    const disc = getDiscipline(a.disciplineId);
    if(!disc) return;
    const prioSel = h('select', { 'aria-label': 'Prioridade de ' + disc.name });
    [1,2,3,4,5].forEach(p => prioSel.appendChild(h('option', { value:String(p), selected: p === a.priority }, `${p} — ${PRIORITY_LABELS[p]}`)));
    prioSel.addEventListener('change', () => { a.priority = Number(prioSel.value); });

    const minIn = h('input', { type:'number', min:'0', step:'5', inputmode:'numeric', value:String(a.minWeeklyMinutes), 'aria-label':'Mínimo semanal de ' + disc.name });
    minIn.addEventListener('input', () => { a.minWeeklyMinutes = Math.max(0, Math.round(Number(minIn.value) || 0)); updateTotals(); });

    const tgtIn = h('input', { type:'number', min:'0', step:'5', inputmode:'numeric', value:String(a.targetMinutes), 'aria-label':'Minutos planejados de ' + disc.name });
    tgtIn.addEventListener('input', () => { a.targetMinutes = Math.max(0, Math.round(Number(tgtIn.value) || 0)); updateTotals(); });

    allocCard.append(h('div', { class:'alloc-row' },
      h('div', { class:'ar-id' }, h('div', { class:'ar-name', text:disc.name }), h('div', { class:'ar-area', text:areaNameOf(disc) })),
      h('div', null, h('label', { class:'sr-only', text:'Prioridade' }), prioSel),
      h('div', null, h('label', { class:'sr-only', text:'Mínimo (min)' }), minIn),
      h('div', null, h('label', { class:'sr-only', text:'Planejado (min)' }), tgtIn)
    ));
  });

  allocCard.append(h('div', { class:'alloc-total' },
    h('div', null, h('p', { class:'card-title', text:'Total planejado', style:'margin:0 0 2px' }), totalEl),
    diffEl));
  allocCard.append(h('div', { class:'row auto', style:'margin-top:14px' },
    h('button', { class:'btn primary', type:'button', text:'Salvar plano', onclick:() => savePlanDraft(false) }),
    h('button', { class:'btn ghost', type:'button', text:'Salvar e aplicar nesta semana', onclick:() => savePlanDraft(true) })
  ));
  updateTotals();
  parts.push(allocCard);

  /* --- semana atual (snapshot) --- */
  const prog = PlannerEngine.getCurrentWeekProgress();
  if(prog.weeklyPlan){
    const wc = h('div', { class:'card' });
    wc.append(h('div', { class:'card-head' },
      h('p', { class:'card-title', text:'Semana atual', style:'margin:0' }),
      h('span', { class:'hint', text: fmtDateBR(prog.weeklyPlan.weekStart) + ' → ' + fmtDateBR(prog.weeklyPlan.weekEnd) })));
    wc.append(h('p', { class:'hint', style:'margin-bottom:10px',
      text:'Esta semana tem seu próprio registro. Alterar o plano base no futuro não reescreve as metas das semanas já passadas.' }));
    prog.perDiscipline.forEach(x => {
      const pct = x.planned > 0 ? (x.realized / x.planned) * 100 : 0;
      wc.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text: disciplineName(x.disciplineId) }),
        h('div', { class:'hbar' }, h('span', { style:`width:${clamp(pct,0,100)}%;background:${pct >= 100 ? 'var(--teal)' : 'var(--brass)'}` })),
        h('span', { class:'hv', text: `${fmtDuration(x.realized)}/${fmtDuration(x.planned)}` })
      ));
    });
    wc.append(h('div', { class:'alloc-total' },
      h('div', null, h('p', { class:'card-title', text:'Semana', style:'margin:0 0 2px' }),
        h('span', { class:'at-v', text:`${fmtDuration(prog.realizedTotal)} / ${fmtDuration(prog.plannedTotal)}` })),
      h('p', { class:'hint', style:'margin:0', text: prog.pct !== null ? fmtPct(prog.pct) + ' do planejado' : '' })));
    parts.push(wc);
  }

  /* --- outros planos --- */
  if(state.plans.length > 1 || plan){
    const pc = h('div', { class:'card' });
    pc.append(h('div', { class:'card-head' },
      h('p', { class:'card-title', text:'Seus planos', style:'margin:0' }),
      h('button', { class:'linkbtn', type:'button', text:'+ novo plano', onclick:openNewPlanModal })));
    state.plans.slice().sort((a,b) => str(a.createdAt).localeCompare(str(b.createdAt))).forEach(p => {
      pc.append(h('div', { class:'rev-item' },
        h('div', { class:'ri-main' },
          h('div', { class:'ri-name', text:p.name }),
          h('div', { class:'ri-meta', text: fmtDuration(p.weeklyAvailableMinutes) + ' por semana · ' + p.allocations.length + ' disciplina(s)' })),
        p.active ? h('span', { class:'pill teal', text:'ativo' })
                 : h('button', { class:'linkbtn', type:'button', text:'ativar', onclick:() => activatePlan(p.id) }),
        p.active ? null : h('button', { class:'linkbtn danger', type:'button', text:'excluir', onclick:() => deletePlan(p.id) })
      ));
    });
    parts.push(pc);
  }

  mount(root, parts);
}

async function savePlanDraft(applyToCurrentWeek){
  const draft = ui.planDraft;
  if(!draft) return;
  const total = sum(draft.allocations, a => Number(a.targetMinutes) || 0);
  if(total > draft.availableMinutes){
    const ok = await confirmModal(
      `O total planejado (${fmtDuration(total)}) passa da sua disponibilidade (${fmtDuration(draft.availableMinutes)}). Salvar assim mesmo?`,
      { confirmLabel:'Salvar assim mesmo', danger:false });
    if(!ok) return;
  }

  let plan = PlannerEngine.activePlan();
  if(!plan){
    plan = newPlan(draft.name, draft.availableMinutes);
    state.plans.forEach(p => { p.active = false; });
    await DB.putMany('plans', state.plans);
  }
  plan.name = str(draft.name).trim() || 'Meu plano';
  plan.weeklyAvailableMinutes = draft.availableMinutes;
  plan.allocations = draft.allocations.map(a => ({ ...a }));
  plan.active = true;
  plan.updatedAt = nowISO();
  await DB.put('plans', plan);

  if(applyToCurrentWeek){
    const ws = dateToISO(startOfWeek(today()));
    const wp = {
      id: ws, weekStart: ws, weekEnd: dateToISO(endOfWeek(today())),
      basePlanId: plan.id, availableMinutes: plan.weeklyAvailableMinutes,
      allocations: plan.allocations.map(a => ({ ...a })),
      createdAt: nowISO(), updatedAt: nowISO()
    };
    await DB.put('weeklyPlans', wp);
  }

  ui.planDraft = null;
  await refresh();
  toast(applyToCurrentWeek ? 'Plano salvo e aplicado nesta semana.' : 'Plano salvo. Vale a partir da próxima semana (ou use "aplicar nesta semana").', 'ok');
}

function openNewPlanModal(){
  openModal(close => {
    const nameIn = h('input', { type:'text', id:'np-name', placeholder:'Ex.: Preparação CCNA', maxlength:'60' });
    const hoursIn = h('input', { type:'number', id:'np-hours', min:'0.5', step:'0.5', value:'5', inputmode:'decimal' });
    return {
      title:'Novo plano',
      content: h('div',
        h('div', { class:'field' }, h('label', { for:'np-name', text:'Nome' }), nameIn),
        h('div', { class:'field' }, h('label', { for:'np-hours', text:'Horas por semana' }), hoursIn),
        h('p', { class:'hint', text:'O novo plano fica ativo e usa suas disciplinas atuais. Semanas já registradas não mudam.' })
      ),
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        h('button', { class:'btn primary', type:'button', text:'Criar', onclick: async () => {
          const minutes = Math.round((Number(hoursIn.value) || 0) * 60);
          if(minutes <= 0){ toast('Informe as horas por semana.', 'err'); return; }
          close();
          const plan = newPlan(nameIn.value, minutes);
          const res = PlannerEngine.generatePlan(minutes, activeDisciplines().map(d => ({ disciplineId:d.id, priority:d.priority, minWeeklyMinutes:0 })));
          plan.allocations = res.allocations;
          state.plans.forEach(p => { p.active = false; });
          await DB.putMany('plans', state.plans);
          await DB.put('plans', plan);
          ui.planDraft = null;
          await refresh();
          toast('Plano criado e ativado.', 'ok');
        } })
      ]
    };
  });
}

async function activatePlan(id){
  state.plans.forEach(p => { p.active = (p.id === id); p.updatedAt = nowISO(); });
  await DB.putMany('plans', state.plans);
  ui.planDraft = null;
  await refresh();
  toast('Plano ativado.', 'ok');
}
async function deletePlan(id){
  const ok = await confirmModal('Excluir este plano? As semanas já registradas continuam com os valores históricos delas.', { confirmLabel:'Excluir' });
  if(!ok) return;
  await DB.delete('plans', id);
  ui.planDraft = null;
  await refresh();
  toast('Plano excluído.');
}

/* =========================================================================
   TELA: DISCIPLINAS
   ========================================================================= */
function renderDisciplines(){
  const root = $('#disciplines-body');
  const parts = [];

  const header = h('div', { class:'card' },
    h('div', { class:'card-head' },
      h('p', { class:'card-title', text:'Estrutura', style:'margin:0' }),
      h('div', { class:'row auto' },
        h('button', { class:'btn ghost sm', type:'button', text:'+ Área', onclick:openAreaModal }),
        h('button', { class:'btn primary sm', type:'button', text:'+ Disciplina', onclick:() => openDisciplineModal(null) }))),
    h('label', { style:'display:flex;align-items:center;gap:7px;margin:0;font-size:12.5px' },
      (() => { const c = h('input', { type:'checkbox', checked: ui.showArchivedDisciplines });
               c.addEventListener('change', () => { ui.showArchivedDisciplines = c.checked; renderDisciplines(); }); return c; })(),
      'mostrar arquivadas')
  );
  parts.push(header);

  const list = ui.showArchivedDisciplines ? state.disciplines : activeDisciplines();
  if(!list.length){
    parts.push(card(null, emptyState('Nenhuma disciplina cadastrada',
      'Crie uma área (ex.: Tecnologia) e uma disciplina (ex.: CCNA). Depois adicione os tópicos — são eles que entram no ciclo de revisão.',
      h('button', { class:'btn primary', type:'button', text:'Criar disciplina', onclick:() => openDisciplineModal(null) }))));
    mount(root, parts);
    return;
  }

  const groups = new Map();
  list.forEach(d => {
    const key = d.areaId || '__none__';
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  });
  const order = state.areas.slice().sort(sortByName).map(a => a.id).concat('__none__');

  order.forEach(areaId => {
    const items = groups.get(areaId);
    if(!items || !items.length) return;
    const area = areaId === '__none__' ? null : getArea(areaId);
    const group = h('div', { class:'area-group' },
      h('h3', null, (area ? area.name : 'Sem área'),
        area ? h('button', { class:'linkbtn muted', type:'button', text:' editar', style:'margin-left:8px;font-size:11.5px',
          onclick:() => openAreaModal(area) }) : null));
    items.slice().sort(sortByName).forEach(d => group.append(disciplineCard(d)));
    parts.push(group);
  });

  /* --- prazos --- */
  const dlCard = h('div', { class:'card' });
  dlCard.append(h('div', { class:'card-head' },
    h('p', { class:'card-title', text:'Prazos', style:'margin:0' }),
    h('button', { class:'linkbtn', type:'button', text:'+ novo prazo', onclick:() => openDeadlineModal(null) })));
  const pending = state.deadlines.filter(d => !d.completed).sort((a,b) => a.date.localeCompare(b.date));
  if(!pending.length){
    dlCard.append(h('p', { class:'hint', text:'Nenhum prazo cadastrado. Prazos próximos aumentam a prioridade da disciplina nas recomendações.' }));
  } else {
    pending.forEach(dl => {
      const days = daysUntilISO(dl.date);
      dlCard.append(h('div', { class:'rev-item' },
        h('span', { class:'dot', style:`background:${days !== null && days <= 7 ? 'var(--danger)' : 'var(--brass)'}` }),
        h('div', { class:'ri-main' },
          h('div', { class:'ri-name', text: dl.title }),
          h('div', { class:'ri-meta', text: fmtDateBR(dl.date) + ' · ' + fmtRelativeFuture(dl.date) + (dl.disciplineId ? ' · ' + disciplineName(dl.disciplineId) : '') + (dl.importance === 'alta' ? ' · importante' : '') })),
        h('button', { class:'linkbtn', type:'button', text:'concluir', onclick:() => completeDeadline(dl.id) }),
        h('button', { class:'linkbtn muted', type:'button', text:'editar', onclick:() => openDeadlineModal(dl) })
      ));
    });
  }
  parts.push(dlCard);

  mount(root, parts);
}

function disciplineCard(d){
  const prog = disciplineProgress(d.id);
  const weekProg = PlannerEngine.getCurrentWeekProgress().perDiscipline.find(x => x.disciplineId === d.id);
  const last = lastStudyISO(d.id);
  const btn = h('button', { class:'disc-card', type:'button', onclick:() => openDisciplineDetail(d.id) },
    h('div', { class:'dc-main' },
      h('div', { class:'dc-name' }, d.name, d.archived ? h('span', { class:'pill', text:'arquivada', style:'margin-left:8px' }) : null),
      prog.total > 0 ? progressBar(prog.coverage) : null,
      h('div', { class:'dc-meta', text:
        (prog.total > 0 ? `${prog.total} tópicos · ${prog.mastered} dominados` : 'sem tópicos cadastrados') +
        ` · último estudo ${fmtRelativePast(last)}` +
        (weekProg ? ` · semana ${fmtDuration(weekProg.realized)}/${fmtDuration(weekProg.planned)}` : '') })
    ),
    h('div', { class:'dc-right' },
      h('div', { class:'dc-pct', text: prog.coverage !== null ? fmtPct(prog.coverage) : '—' }),
      h('div', { class:'ri-meta', text:'visto' }))
  );
  return btn;
}

function openDisciplineDetail(discId){
  ui.openDisciplineId = discId;
  const d = getDiscipline(discId);
  if(!d) return;

  openModal(close => {
    const prog = disciplineProgress(d.id);
    const weekProg = PlannerEngine.getCurrentWeekProgress().perDiscipline.find(x => x.disciplineId === d.id);
    const topics = topicsOf(d.id, true);

    const topicList = h('div');
    const visible = topics.filter(t => !t.archived);
    if(!visible.length){
      topicList.append(emptyState('Nenhum tópico cadastrado', 'Adicione tópicos para acompanhar cobertura de conteúdo e revisões automáticas.'));
    } else {
      visible.forEach((t, i) => {
        const st = topicStatus(t);
        topicList.append(h('div', { class:'topic-row' },
          statusMark(st),
          h('div', { class:'tr-main' },
            h('div', { class:'tr-name', text:t.name }),
            h('div', { class:'tr-meta', text:
              TOPIC_STATUS_LABEL[st] +
              (t.masteryLevel ? ` · domínio ${t.masteryLevel}/5` : '') +
              (t.reviewDueDate ? ` · revisão ${fmtRelativeFuture(t.reviewDueDate)}` : (t.reviewEnabled ? '' : ' · revisão desligada')) })),
          h('button', { class:'linkbtn muted', type:'button', text:'↑', title:'Subir', disabled: i === 0,
            onclick: async () => { await moveTopic(t.id, -1); close(); openDisciplineDetail(discId); } }),
          h('button', { class:'linkbtn muted', type:'button', text:'↓', title:'Descer', disabled: i === visible.length - 1,
            onclick: async () => { await moveTopic(t.id, 1); close(); openDisciplineDetail(discId); } }),
          h('button', { class:'linkbtn', type:'button', text:'editar',
            onclick:() => { close(); openTopicModal(d.id, t); } })
        ));
      });
    }
    const archivedTopics = topics.filter(t => t.archived);
    if(archivedTopics.length){
      topicList.append(h('p', { class:'hint', style:'margin-top:10px', text:`${archivedTopics.length} tópico(s) arquivado(s) — histórico preservado.` }));
      archivedTopics.forEach(t => topicList.append(h('div', { class:'topic-row', style:'opacity:.6' },
        statusMark(topicStatus(t)),
        h('div', { class:'tr-main' }, h('div', { class:'tr-name', text:t.name }), h('div', { class:'tr-meta', text:'arquivado' })),
        h('button', { class:'linkbtn', type:'button', text:'reativar', onclick: async () => { t.archived = false; await persist('topics', t); await refresh(); close(); openDisciplineDetail(discId); } })
      )));
    }

    const content = h('div',
      h('div', { class:'stat-grid', style:'margin-bottom:14px' },
        statBox(weekProg ? fmtDuration(weekProg.planned) : '—', 'planejado na semana'),
        statBox(weekProg ? fmtDuration(weekProg.realized) : fmtDuration(minutesInRange({ start:startOfWeek(today()), end:endOfWeek(today()) }, d.id)), 'realizado'),
        statBox(PRIORITY_LABELS[d.priority], 'prioridade'),
        statBox(fmtRelativePast(lastStudyISO(d.id)), 'último estudo')
      ),
      prog.total > 0 ? h('div', { style:'margin-bottom:14px' },
        h('p', { class:'hint', style:'margin-bottom:5px', text:`Conteúdo visto ${fmtPct(prog.coverage)} · dominado ${fmtPct(prog.mastery)}` }),
        progressBar(prog.coverage)) : null,
      h('div', { class:'card-head' },
        h('p', { class:'card-title', text:'Conteúdo', style:'margin:0' }),
        h('button', { class:'linkbtn', type:'button', text:'+ adicionar tópico', onclick:() => { close(); openTopicModal(d.id, null); } })),
      topicList
    );

    return {
      title: d.name,
      content,
      actions:[
        h('button', { class:'btn ghost sm', type:'button', text:'Editar disciplina', onclick:() => { close(); openDisciplineModal(d); } }),
        h('button', { class:'btn ghost sm', type:'button', text: d.archived ? 'Reativar' : 'Arquivar',
          onclick: async () => { close(); await toggleArchiveDiscipline(d.id); } }),
        h('button', { class:'btn primary sm', type:'button', text:'Estudar agora',
          onclick:() => { close(); openRegisterModal({ disciplineId:d.id }); } })
      ]
    };
  }, { size:'wide' });
}

/* ---------- CRUD: áreas, disciplinas, tópicos, prazos ---------- */
function openAreaModal(area){
  openModal(close => {
    const nameIn = h('input', { type:'text', id:'ar-name', value: area ? area.name : '', placeholder:'Ex.: Tecnologia', maxlength:'60' });
    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
        const name = nameIn.value.trim();
        if(!name){ toast('Informe o nome da área.', 'err'); return; }
        close();
        if(area){ area.name = name; await persist('areas', area); }
        else { await DB.put('areas', newArea(name)); }
        await refresh();
        toast(area ? 'Área atualizada.' : 'Área criada.', 'ok');
      } })
    ];
    if(area){
      actions.unshift(h('button', { class:'btn ghost', type:'button', text:'Excluir', onclick: async () => {
        const used = state.disciplines.filter(d => d.areaId === area.id).length;
        close();
        if(used){ toast(`Esta área tem ${used} disciplina(s). Mova-as antes de excluir.`, 'err'); return; }
        const ok = await confirmModal('Excluir esta área?', { confirmLabel:'Excluir' });
        if(!ok) return;
        await DB.delete('areas', area.id);
        await refresh();
        toast('Área excluída.');
      } }));
    }
    return { title: area ? 'Editar área' : 'Nova área',
             content: h('div', h('div', { class:'field' }, h('label', { for:'ar-name', text:'Nome da área' }), nameIn)),
             actions };
  }, { size:'narrow' });
}

function openDisciplineModal(disc){
  openModal(close => {
    const nameIn = h('input', { type:'text', id:'dm-name', value: disc ? disc.name : '', placeholder:'Ex.: CCNA', maxlength:'80' });
    const areaOpts = [{ value:'', label:'— Sem área —' }].concat(state.areas.slice().sort(sortByName).map(a => ({ value:a.id, label:a.name })));
    let areaId = disc ? (disc.areaId || '') : (state.areas[0] ? state.areas[0].id : '');
    let priority = disc ? disc.priority : 3;

    const prioSel = h('select', { id:'dm-prio' });
    [1,2,3,4,5].forEach(p => prioSel.appendChild(h('option', { value:String(p), selected:p === priority }, `${p} — ${PRIORITY_LABELS[p]}`)));
    prioSel.addEventListener('change', () => { priority = Number(prioSel.value); });

    const mpcIn = h('input', { type:'number', id:'dm-mpc', min:'1', step:'1', inputmode:'numeric', value:String(disc ? disc.minutesPerCredit : 20) });

    const advanced = h('details', { style:'margin-top:4px' },
      h('summary', { style:'cursor:pointer;font-size:12.5px;color:var(--muted)' }, 'Opções avançadas'),
      h('div', { style:'margin-top:10px' },
        h('div', { class:'field' }, h('label', { for:'dm-mpc', text:'Minutos por crédito' }), mpcIn,
          h('p', { class:'hint', text:'Quantos minutos valem 1 crédito nesta disciplina. Usado no acompanhamento por créditos.' }))));

    const content = h('div',
      h('div', { class:'field' }, h('label', { for:'dm-name', text:'Nome' }), nameIn),
      selectField('dm-area', 'Área', areaOpts, areaId, e => { areaId = e.target.value; }),
      h('div', { class:'field' }, h('label', { for:'dm-prio', text:'Prioridade' }), prioSel),
      advanced
    );

    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
        const name = nameIn.value.trim();
        if(!name){ toast('Informe o nome da disciplina.', 'err'); return; }
        const mpc = Math.max(1, Math.round(Number(mpcIn.value) || 20));
        close();
        if(disc){
          disc.name = name; disc.areaId = areaId || null; disc.priority = priority; disc.minutesPerCredit = mpc;
          await persist('disciplines', disc);
        } else {
          const d = newDiscipline(name, areaId || null, priority);
          d.minutesPerCredit = mpc;
          await DB.put('disciplines', d);
        }
        ui.planDraft = null;
        await refresh();
        toast(disc ? 'Disciplina atualizada.' : 'Disciplina criada.', 'ok');
      } })
    ];
    if(disc){
      actions.unshift(h('button', { class:'btn ghost', type:'button', text: disc.archived ? 'Reativar' : 'Arquivar',
        onclick: async () => { close(); await toggleArchiveDiscipline(disc.id); } }));
      actions.unshift(h('button', { class:'linkbtn danger', type:'button', text:'excluir definitivamente',
        onclick: async () => { close(); await deleteDisciplineForever(disc.id); } }));
    }
    return { title: disc ? 'Editar disciplina' : 'Nova disciplina', content, actions };
  });
}

async function toggleArchiveDiscipline(id){
  const d = getDiscipline(id);
  if(!d) return;
  if(!d.archived){
    const ok = await confirmModal('Arquivar esta disciplina? Ela sai do planejamento, das recomendações e das revisões ativas — todo o histórico é preservado.',
      { confirmLabel:'Arquivar', danger:false });
    if(!ok) return;
  }
  d.archived = !d.archived;
  await persist('disciplines', d);
  ui.planDraft = null;
  await refresh();
  toast(d.archived ? 'Disciplina arquivada. O histórico continua intacto.' : 'Disciplina reativada.', 'ok');
}

async function deleteDisciplineForever(id){
  const d = getDiscipline(id);
  if(!d) return;
  const sess = sessionsOf(id).length, tps = topicsOf(id, true).length;
  const ok = await confirmModal(
    `Excluir "${d.name}" DEFINITIVAMENTE apaga ${sess} sessão(ões) e ${tps} tópico(s) do histórico. Arquivar preserva tudo. Continuar mesmo assim?`,
    { confirmLabel:'Excluir definitivamente' });
  if(!ok) return;
  const topicIds = topicsOf(id, true).map(t => t.id);
  const sessionIds = sessionsOf(id).map(s => s.id);
  await DB.transactional(['disciplines','topics','sessions','deadlines'], api => {
    api.delete('disciplines', id);
    topicIds.forEach(t => api.delete('topics', t));
    sessionIds.forEach(s => api.delete('sessions', s));
    state.deadlines.filter(dl => dl.disciplineId === id).forEach(dl => api.delete('deadlines', dl.id));
  });
  ui.planDraft = null;
  await refresh();
  toast('Disciplina excluída definitivamente.');
}

function openTopicModal(disciplineId, topic){
  openModal(close => {
    const nameIn = h('input', { type:'text', id:'tm-name', value: topic ? topic.name : '', placeholder:'Ex.: OSPF', maxlength:'80' });
    const revChk = h('input', { type:'checkbox', id:'tm-review', checked: topic ? topic.reviewEnabled : !!state.settings.autoReviewNewTopics });

    const content = h('div',
      h('div', { class:'field' }, h('label', { for:'tm-name', text:'Nome do tópico' }), nameIn),
      h('label', { style:'display:flex;align-items:center;gap:8px;margin:0' }, revChk, 'Incluir no ciclo de revisão'),
      topic && topic.reviewDueDate ? h('p', { class:'hint', style:'margin-top:10px',
        text:`Próxima revisão ${fmtRelativeFuture(topic.reviewDueDate)} · intervalo atual ${topic.reviewIntervalDays} dia(s) · domínio ${topic.masteryLevel || '—'}/5` }) : null,
      !topic ? h('p', { class:'hint', style:'margin-top:10px', text:'Dica: você pode colar vários tópicos de uma vez, um por linha.' }) : null
    );

    if(!topic){
      nameIn.remove();
      const area = h('textarea', { id:'tm-multi', placeholder:'OSPF\nVLAN\nSTP', style:'min-height:90px' });
      content.insertBefore(h('div', { class:'field' }, h('label', { for:'tm-multi', text:'Tópicos (um por linha)' }), area), content.firstChild);
    }

    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
        if(topic){
          const name = nameIn.value.trim();
          if(!name){ toast('Informe o nome.', 'err'); return; }
          close();
          topic.name = name; topic.reviewEnabled = revChk.checked;
          await persist('topics', topic);
          await refresh();
          toast('Tópico atualizado.', 'ok');
        } else {
          const lines = (($('#tm-multi') || {}).value || '').split('\n').map(s => s.trim()).filter(Boolean);
          if(!lines.length){ toast('Informe ao menos um tópico.', 'err'); return; }
          close();
          const existing = topicsOf(disciplineId, true);
          let order = existing.length ? Math.max(...existing.map(t => t.sortOrder || 0)) : 0;
          const created = lines.map(name => { order += 10; const t = newTopic(disciplineId, name, order); t.reviewEnabled = revChk.checked; return t; });
          await DB.putMany('topics', created);
          await refresh();
          toast(`${created.length} tópico(s) adicionado(s).`, 'ok');
        }
        openDisciplineDetail(disciplineId);
      } })
    ];
    if(topic){
      actions.unshift(h('button', { class:'btn ghost', type:'button', text:'Arquivar', onclick: async () => {
        close();
        const ok = await confirmModal('Arquivar este tópico? Ele sai das opções ativas e a revisão fica pausada — o histórico é preservado.', { confirmLabel:'Arquivar', danger:false });
        if(!ok){ openDisciplineDetail(disciplineId); return; }
        topic.archived = true;
        await persist('topics', topic);
        await refresh();
        toast('Tópico arquivado.');
        openDisciplineDetail(disciplineId);
      } }));
    }
    return { title: topic ? 'Editar tópico' : 'Adicionar tópicos', content, actions };
  }, { size:'narrow' });
}

async function moveTopic(topicId, dir){
  const t = getTopic(topicId);
  if(!t) return;
  const list = topicsOf(t.disciplineId);
  const i = list.findIndex(x => x.id === topicId);
  const j = i + dir;
  if(i < 0 || j < 0 || j >= list.length) return;
  const a = list[i], b = list[j];
  const tmp = a.sortOrder; a.sortOrder = b.sortOrder; b.sortOrder = tmp;
  if(a.sortOrder === b.sortOrder){ a.sortOrder = i * 10; b.sortOrder = j * 10; }
  a.updatedAt = nowISO(); b.updatedAt = nowISO();
  await DB.putMany('topics', [a, b]);
  await refresh();
}

function openDeadlineModal(dl){
  openModal(close => {
    const titleIn = h('input', { type:'text', id:'dl-title', value: dl ? dl.title : '', placeholder:'Ex.: Prova de Criptografia', maxlength:'80' });
    const dateIn = h('input', { type:'date', id:'dl-date', value: dl ? dl.date : todayISO() });
    let discId = dl ? (dl.disciplineId || '') : '';
    let importance = dl ? dl.importance : 'normal';
    const impSel = h('select', { id:'dl-imp' },
      h('option', { value:'normal', selected: importance === 'normal' }, 'Normal'),
      h('option', { value:'alta', selected: importance === 'alta' }, 'Alta'));
    impSel.addEventListener('change', () => { importance = impSel.value; });

    const content = h('div',
      h('div', { class:'field' }, h('label', { for:'dl-title', text:'Título' }), titleIn),
      h('div', { class:'row' },
        h('div', { class:'field' }, h('label', { for:'dl-date', text:'Data' }), dateIn),
        h('div', { class:'field' }, h('label', { for:'dl-imp', text:'Importância' }), impSel)),
      selectField('dl-disc', 'Disciplina (opcional)', [{ value:'', label:'— Nenhuma —' }].concat(disciplineOptions(false)), discId, e => { discId = e.target.value; }),
      h('p', { class:'hint', text:'Prazos próximos aumentam o peso da disciplina no planejamento e nas recomendações.' })
    );

    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
        const title = titleIn.value.trim();
        if(!title){ toast('Informe o título do prazo.', 'err'); return; }
        close();
        if(dl){
          Object.assign(dl, { title, date: dateIn.value || todayISO(), disciplineId: discId || null, importance });
          await persist('deadlines', dl);
        } else {
          await DB.put('deadlines', newDeadline({ title, date: dateIn.value || todayISO(), disciplineId: discId || null, importance }));
        }
        await refresh();
        toast('Prazo salvo.', 'ok');
      } })
    ];
    if(dl) actions.unshift(h('button', { class:'linkbtn danger', type:'button', text:'excluir', onclick: async () => {
      close();
      await DB.delete('deadlines', dl.id);
      await refresh();
      toast('Prazo excluído.');
    } }));
    return { title: dl ? 'Editar prazo' : 'Novo prazo', content, actions };
  }, { size:'narrow' });
}

async function completeDeadline(id){
  const dl = state.deadlines.find(d => d.id === id);
  if(!dl) return;
  dl.completed = true;
  await persist('deadlines', dl);
  await refresh();
  toast('Prazo concluído.', 'ok');
}

/* =========================================================================
   TELA: ANÁLISES
   ========================================================================= */
function presetRange(preset){
  const t = today();
  switch(preset){
    case 'hoje':   return { start:t, end:t };
    case '7d':     return { start:addDays(t,-6), end:t };
    case '30d':    return { start:addDays(t,-29), end:t };
    case 'semana': return { start:startOfWeek(t), end:endOfWeek(t) };
    case 'mes':    return { start:startOfMonth(t), end:endOfMonth(t) };
    case 'tudo': {
      if(!state.sessions.length) return { start:t, end:t };
      const min = state.sessions.reduce((m,s) => s.date < m ? s.date : m, state.sessions[0].date);
      return { start:parseISO(min) || t, end:t };
    }
    default: return { start:startOfWeek(t), end:endOfWeek(t) };
  }
}
function applyPreset(preset){
  ui.periodPreset = preset;
  ui.period = presetRange(preset);
  ui.calPicking = false;
  ui.calMonth = new Date(ui.period.end.getFullYear(), ui.period.end.getMonth(), 1);
  renderAnalytics();
}

function renderAnalytics(){
  const root = $('#analytics-body');
  if(!ui.period) applyPresetSilently(state.settings.defaultPeriod || 'semana');
  const a = AnalyticsEngine.build(ui.period);
  const parts = [];

  parts.push(periodCard());

  if(!state.sessions.length){
    parts.push(card(null, emptyState('Nada para analisar ainda',
      'Registre sua primeira sessão e as análises aparecem aqui: tempo, aderência ao plano, revisões, cobertura de conteúdo e tendências.',
      h('button', { class:'btn primary', type:'button', text:'Registrar sessão', onclick:() => openRegisterModal() }))));
    mount(root, parts);
    return;
  }

  /* --- métricas principais --- */
  const cmp = a.previousComparison;
  const deltaTxt = (v) => v === null || v === undefined ? null : { text:`${v >= 0 ? '↑' : '↓'} ${fmtNumber(Math.abs(v),0)}% vs. anterior`, dir: v >= 0 ? 'up' : 'down' };
  const metrics = [
    statBox(fmtDuration(a.totals.minutes), 'tempo estudado', cmp.available ? deltaTxt(cmp.minutesDelta) : null),
    statBox(fmtNumber(a.totals.credits), 'créditos', cmp.available ? deltaTxt(cmp.creditsDelta) : null),
    statBox(String(a.totals.count), 'sessões', cmp.available ? deltaTxt(cmp.sessionsDelta) : null),
    statBox(`${a.totals.activeDays}/${a.days}`, 'dias ativos', cmp.available ? deltaTxt(cmp.activeDaysDelta) : null),
    statBox(fmtDuration(a.totals.avgSession), 'sessão média'),
    statBox(a.difficulty.avg !== null ? fmtNumber(a.difficulty.avg,1) + '/5' : '—', 'dificuldade média')
  ];
  if(a.planAdherence.hasPlan && a.planAdherence.planned > 0){
    metrics.push(statBox(fmtPct(a.planAdherence.pct), 'aderência ao plano'));
    metrics.push(statBox(`${fmtDuration(a.planAdherence.realized)} / ${fmtDuration(a.planAdherence.planned)}`, 'realizado / planejado'));
  }
  if(a.reviews.expected > 0 || a.reviews.completed > 0){
    metrics.push(statBox(`${a.reviews.completed}/${a.reviews.expected}`, 'revisões concluídas'));
    if(a.reviews.overdueNow) metrics.push(statBox(String(a.reviews.overdueNow), 'revisões atrasadas'));
  }
  parts.push(card('Métricas do período', h('div', { class:'stat-grid' }, metrics)));

  /* --- gráfico temporal --- */
  parts.push(card('Tempo estudado ao longo do período', timeChart(a)));

  /* --- distribuição --- */
  const distToggle = h('div', { class:'chips' },
    h('button', { class:'chip', type:'button', 'aria-pressed': ui.distributionMode === 'discipline' ? 'true':'false', text:'Disciplinas',
      onclick:() => { ui.distributionMode = 'discipline'; renderAnalytics(); } }),
    h('button', { class:'chip', type:'button', 'aria-pressed': ui.distributionMode === 'area' ? 'true':'false', text:'Áreas',
      onclick:() => { ui.distributionMode = 'area'; renderAnalytics(); } }));
  const rows = ui.distributionMode === 'area' ? a.byArea : a.byDiscipline;
  parts.push(cardWithAction('Distribuição do tempo', distToggle,
    rows.length ? h('div', { class:'donut-wrap' }, donutChart(rows), donutLegend(rows)) : h('p', { class:'hint', text:'Sem registros no período.' })));

  /* --- planejado vs realizado --- */
  if(a.planAdherence.hasPlan && a.planAdherence.perDiscipline.length){
    const c = h('div', { class:'card' }, h('p', { class:'card-title', text:'Planejado × realizado por disciplina' }));
    a.planAdherence.perDiscipline.forEach(x => {
      if(x.planned <= 0 && x.realized <= 0) return;
      const pct = x.pct === null ? 0 : x.pct;
      c.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text:x.label }),
        h('div', { class:'hbar' }, h('span', { style:`width:${clamp(pct,0,100)}%;background:${pct >= 100 ? 'var(--teal)' : pct < 60 ? 'var(--danger)' : 'var(--brass)'}` })),
        h('span', { class:'hv', text: x.pct === null ? fmtDuration(x.realized) : fmtPct(pct) })
      ));
    });
    c.append(h('p', { class:'hint', style:'margin-top:8px', text:'Cada semana é comparada com o plano que existia naquela semana.' }));
    parts.push(c);
  }

  /* --- cobertura e domínio --- */
  if(a.content.totalTopics > 0){
    const c = h('div', { class:'card' }, h('p', { class:'card-title', text:'Cobertura e domínio de conteúdo' }),
      h('div', { class:'stat-grid', style:'margin-bottom:12px' },
        statBox(fmtPct(a.content.coverage), 'conteúdo visto'),
        statBox(fmtPct(a.content.masteryPct), 'conteúdo dominado'),
        statBox(`${a.content.covered}/${a.content.totalTopics}`, 'tópicos iniciados'),
        statBox(String(a.content.mastered), 'tópicos dominados')));
    a.content.perDiscipline.slice().sort((x,y) => (y.coverage||0) - (x.coverage||0)).forEach(x => {
      c.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text:x.discipline.name }),
        h('div', { class:'hbar' }, h('span', { style:`width:${clamp(x.coverage,0,100)}%` })),
        h('span', { class:'hv', text: fmtPct(x.coverage) })));
    });
    if(a.content.weakest.length){
      c.append(h('p', { class:'card-title', style:'margin-top:14px', text:'Tópicos com menor domínio' }));
      a.content.weakest.forEach(t => c.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text:t.name }),
        h('div', { class:'hbar' }, h('span', { style:`width:${(t.masteryLevel/5)*100}%;background:${t.masteryLevel <= 2 ? 'var(--danger)' : 'var(--brass)'}` })),
        h('span', { class:'hv', text: t.masteryLevel + '/5' }))));
    }
    parts.push(c);
  }

  /* --- dificuldade --- */
  const diffCard = h('div', { class:'card' }, h('p', { class:'card-title', text:'Dificuldade percebida' }));
  if(a.difficulty.count === 0){
    diffCard.append(h('p', { class:'hint', text:'Nenhuma sessão do período teve dificuldade informada.' }));
  } else {
    diffCard.append(h('p', { class:'hint', style:'margin-bottom:10px', text:`Média ${fmtNumber(a.difficulty.avg,1)}/5 em ${a.difficulty.count} registro(s). Representa percepção de esforço, não desempenho.` }));
    const max = Math.max(1, ...a.difficulty.counts.map(x => x.count));
    a.difficulty.counts.forEach(d => diffCard.append(h('div', { class:'hbar-row' },
      h('span', { class:'hl', text:d.label }),
      h('div', { class:'hbar' }, h('span', { style:`width:${(d.count/max)*100}%;background:${d.color}` })),
      h('span', { class:'hv', text:String(d.count) }))));
    if(a.difficulty.perDiscipline.length){
      diffCard.append(h('p', { class:'card-title', style:'margin-top:14px', text:'Média por disciplina' }));
      a.difficulty.perDiscipline.forEach(x => diffCard.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text:x.label }),
        h('div', { class:'hbar' }, h('span', { style:`width:${(x.avg/5)*100}%` })),
        h('span', { class:'hv', text: fmtNumber(x.avg,1) + '/5' }))));
    }
  }
  parts.push(diffCard);

  /* --- tipos de sessão --- */
  const typeCard = h('div', { class:'card' }, h('p', { class:'card-title', text:'Tipos de sessão' }));
  const maxType = Math.max(1, ...a.byType.map(x => x.count));
  a.byType.forEach(t => typeCard.append(h('div', { class:'hbar-row' },
    h('span', { class:'hl', text:t.label }),
    h('div', { class:'hbar' }, h('span', { style:`width:${(t.count/maxType)*100}%` })),
    h('span', { class:'hv', text: t.count ? `${t.count} · ${fmtNumber(t.pct,0)}%` : '0' }))));
  parts.push(typeCard);

  /* --- revisões --- */
  if(a.reviews.expected > 0 || a.reviews.completed > 0){
    const rc = h('div', { class:'card' }, h('p', { class:'card-title', text:'Revisões no período' }),
      h('div', { class:'stat-grid', style:'margin-bottom:10px' },
        statBox(String(a.reviews.completed), 'concluídas'),
        statBox(String(a.reviews.scheduled), 'previstas'),
        statBox(a.reviews.rate !== null ? fmtPct(a.reviews.rate) : '—', 'taxa de revisão'),
        statBox(String(a.reviews.overdueNow), 'atrasadas agora')));
    const outMax = Math.max(1, ...a.reviews.outcomes.map(o => o.count));
    if(a.reviews.completed > 0) a.reviews.outcomes.forEach(o => rc.append(h('div', { class:'hbar-row' },
      h('span', { class:'hl', text:o.label }),
      h('div', { class:'hbar' }, h('span', { style:`width:${(o.count/outMax)*100}%` })),
      h('span', { class:'hv', text:String(o.count) }))));
    parts.push(rc);
  }

  /* --- relatório semanal --- */
  parts.push(weeklyReportCard());

  /* --- projeção --- */
  parts.push(card('Projeção de ritmo', a.projection.available
    ? h('div',
        h('p', { text:`Média das últimas ${a.projection.weeksConsidered} semanas: ${fmtDuration(a.projection.avgWeeklyMinutes)} por semana.` }),
        a.projection.target ? h('p', { class:'hint', style:'margin-top:6px', text: a.projection.meetsTarget
          ? `Ritmo suficiente para o objetivo de ${fmtDuration(a.projection.target)}/semana.`
          : `Objetivo de ${fmtDuration(a.projection.target)}/semana — faltam ${fmtDuration(Math.abs(a.projection.gap))} no ritmo atual.` }) : null)
    : h('p', { class:'hint', text:a.projection.reason })));

  /* --- insights --- */
  parts.push(cardWithAction('Insights',
    h('button', { class:'linkbtn', type:'button', text:'copiar resumo do período', onclick:() => copySummary(a) }),
    h('div', { class:'insights' }, a.insights.map(t => h('div', { class:'insight', text:t })))));

  mount(root, parts);
}
function applyPresetSilently(preset){
  ui.periodPreset = preset;
  ui.period = presetRange(preset);
  ui.calMonth = new Date(ui.period.end.getFullYear(), ui.period.end.getMonth(), 1);
}

function periodCard(){
  const c = h('div', { class:'card' }, h('p', { class:'card-title', text:'Período' }));
  const presets = [
    ['hoje','Hoje'], ['7d','7 dias'], ['30d','30 dias'],
    ['semana','Esta semana'], ['mes','Este mês'], ['tudo','Tudo']
  ];
  c.append(h('div', { class:'chips', style:'margin-bottom:12px' },
    presets.map(([v,l]) => h('button', { class:'chip', type:'button', 'aria-pressed': ui.periodPreset === v ? 'true':'false', text:l,
      onclick:() => applyPreset(v) })),
    h('button', { class:'chip', type:'button', 'aria-pressed': ui.periodPreset === null ? 'true':'false', text:'Personalizado',
      onclick:() => { ui.periodPreset = null; renderAnalytics(); } })
  ));

  const startIn = h('input', { type:'date', id:'per-start', value: dateToISO(ui.period.start) });
  const endIn = h('input', { type:'date', id:'per-end', value: dateToISO(ui.period.end) });
  c.append(h('div', { class:'row auto', style:'margin-bottom:12px' },
    h('div', { class:'field tight' }, h('label', { for:'per-start', text:'Data inicial' }), startIn),
    h('div', { class:'field tight' }, h('label', { for:'per-end', text:'Data final' }), endIn),
    h('button', { class:'btn ghost sm', type:'button', text:'Aplicar', onclick:() => {
      const s = parseISO(startIn.value), e = parseISO(endIn.value);
      if(!s || !e){ toast('Escolha as duas datas.', 'err'); return; }
      ui.period = s <= e ? { start:s, end:e } : { start:e, end:s };
      ui.periodPreset = null; ui.calPicking = false;
      ui.calMonth = new Date(ui.period.end.getFullYear(), ui.period.end.getMonth(), 1);
      renderAnalytics();
    } })
  ));

  c.append(calendarHeatmap());
  c.append(h('p', { class:'hint', style:'margin-top:10px',
    text: `${rangeDays(ui.period)} ${rangeDays(ui.period) === 1 ? 'dia' : 'dias'} · ${fmtRangeLabel(ui.period)}` }));
  return c;
}

function calendarHeatmap(){
  const monthDate = ui.calMonth || new Date();
  const wrap = h('div');
  wrap.append(h('div', { class:'cal-head' },
    h('button', { class:'btn ghost sm', type:'button', text:'‹', 'aria-label':'Mês anterior',
      onclick:() => { ui.calMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1); renderAnalytics(); } }),
    h('span', { class:'cal-month', text:`${MONTHS[monthDate.getMonth()]} de ${monthDate.getFullYear()}` }),
    h('button', { class:'btn ghost sm', type:'button', text:'›', 'aria-label':'Próximo mês',
      onclick:() => { ui.calMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1); renderAnalytics(); } }),
    h('button', { class:'linkbtn', type:'button', text:'hoje', style:'margin-left:auto',
      onclick:() => { const t = new Date(); ui.calMonth = new Date(t.getFullYear(), t.getMonth(), 1); renderAnalytics(); } })
  ));

  const dows = weekStartDow() === 1 ? ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'] : ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  wrap.append(h('div', { class:'cal-dows' }, dows.map(d => h('span', { text:d }))));

  const total = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0).getDate();
  const minutesByDay = new Map();
  let max = 0;
  for(let day = 1; day <= total; day++){
    const iso = dateToISO(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
    const m = sum(state.sessions.filter(s => s.date === iso), s => s.minutes);
    minutesByDay.set(iso, m);
    if(m > max) max = m;
  }
  const firstDow = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const blanks = (firstDow - weekStartDow() + 7) % 7;

  const grid = h('div', { class:'cal-grid' });
  for(let i = 0; i < blanks; i++) grid.append(h('div', { class:'cal-day blank', 'aria-hidden':'true' }));
  const sISO = dateToISO(ui.period.start), eISO = dateToISO(ui.period.end), tISO = todayISO();
  for(let day = 1; day <= total; day++){
    const dObj = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const iso = dateToISO(dObj);
    const m = minutesByDay.get(iso) || 0;
    let lvl = 0;
    if(max > 0 && m > 0){ const r = m / max; lvl = r >= .75 ? 4 : r >= .5 ? 3 : r >= .25 ? 2 : 1; }
    const inRange = iso >= sISO && iso <= eISO;
    const edge = iso === sISO || iso === eISO;
    const cls = 'cal-day' + (inRange ? ' inrange' : '') + (edge ? ' edge' : '') + (iso === tISO ? ' today' : '');
    const btn = h('button', { type:'button', class:cls, dataset:{ date: iso },
      title: `${fmtDateBR(iso)} — ${m > 0 ? fmtDuration(m) : 'sem registros'}` },
      h('span', { text:String(day) }),
      h('span', { class:'lv', style: lvl ? `background:var(--heat-${lvl})` : null }));
    btn.addEventListener('click', () => {
      const clicked = parseISO(iso);
      if(!ui.calPicking){ ui.period = { start:clicked, end:clicked }; ui.calPicking = true; }
      else {
        const s = ui.period.start;
        ui.period = clicked < s ? { start:clicked, end:s } : { start:s, end:clicked };
        ui.calPicking = false;
      }
      ui.periodPreset = null;
      renderAnalytics();
    });
    grid.append(btn);
  }
  wrap.append(grid);
  wrap.append(h('div', { class:'cal-legend' },
    h('span', { text:'menos' }),
    [0,1,2,3,4].map(i => h('span', { class:'sw', style:`background:var(--heat-${i})` })),
    h('span', { text:'mais (minutos estudados no dia)' }),
    h('span', { text:'· clique em dois dias para escolher um intervalo', style:'margin-left:auto' })));
  return wrap;
}

function timeChart(a){
  const days = a.days;
  let granularity = days > 180 ? 'month' : days > 31 ? 'week' : 'day';
  const buckets = new Map();
  const add = (key, label, minutes) => {
    if(!buckets.has(key)) buckets.set(key, { key, label, minutes:0 });
    buckets.get(key).minutes += minutes;
  };
  if(granularity === 'day'){
    for(let i = 0; i < days; i++){ const d = addDays(a.range.start, i); add(dateToISO(d), String(d.getDate()), 0); }
    a.sessions.forEach(s => add(s.date, String((parseISO(s.date) || today()).getDate()), s.minutes));
  } else if(granularity === 'week'){
    a.sessions.forEach(s => { const ws = startOfWeek(parseISO(s.date)); add(dateToISO(ws), `${ws.getDate()}/${ws.getMonth()+1}`, s.minutes); });
  } else {
    a.sessions.forEach(s => { const d = parseISO(s.date); add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`, MONTHS_ABBR[d.getMonth()], s.minutes); });
  }
  const series = Array.from(buckets.values()).sort((x,y) => x.key < y.key ? -1 : 1);
  if(!series.length || series.every(s => s.minutes === 0)) return h('p', { class:'hint', text:'Sem registros no período.' });
  const max = Math.max(...series.map(s => s.minutes), 1);
  return h('div', { class:'tchart' }, series.map(s => h('div', { class:'tcol', title:`${s.label}: ${fmtDuration(s.minutes)}` },
    h('div', { class:'tb', style:`height:${(s.minutes/max)*100}%` }),
    h('span', { class:'tl', text:s.label }))));
}

function donutChart(rows){
  const total = sum(rows, r => r.minutes);
  const R = 45, C = 60, circ = 2 * Math.PI * R;
  const svg = svgEl('svg', { viewBox:'0 0 120 120', class:'donut', role:'img', 'aria-label':'Distribuição do tempo' });
  svg.append(svgEl('circle', { cx:C, cy:C, r:R, fill:'none', stroke:'var(--line-soft)', 'stroke-width':16 }));
  let offset = 0;
  rows.forEach((r, i) => {
    const seg = (r.minutes / total) * circ;
    svg.append(svgEl('circle', { cx:C, cy:C, r:R, fill:'none', stroke:PALETTE[i % PALETTE.length], 'stroke-width':16,
      'stroke-dasharray':`${seg} ${circ - seg}`, 'stroke-dashoffset':-offset, transform:`rotate(-90 ${C} ${C})` }));
    offset += seg;
  });
  return svg;
}
function donutLegend(rows){
  return h('div', { class:'legend' }, rows.map((r,i) => h('div', { class:'legend-row' },
    h('span', { class:'sw', style:`background:${PALETTE[i % PALETTE.length]}` }),
    h('span', { class:'lb', text:r.label }),
    h('span', { class:'num', style:'font-size:12px', text:`${fmtDuration(r.minutes)} (${fmtNumber(r.pct,0)}%)` }))));
}

function weeklyReportCard(){
  const ref = addDays(today(), ui.weekOffset * 7);
  const ws = startOfWeek(ref), we = endOfWeek(ref);
  const range = { start:ws, end:we };
  const wp = state.weeklyPlans.find(w => w.weekStart === dateToISO(ws));
  const sess = sessionsInRange(range);
  const planned = wp ? sum(wp.allocations, x => x.targetMinutes || 0) : 0;
  const realized = sum(sess, s => s.minutes);
  const reviews = sess.filter(s => s.type === 'revisao' || s.reviewOutcome).length;
  const scheduled = state.topics.filter(t => t.reviewDueDate && t.reviewDueDate >= dateToISO(ws) && t.reviewDueDate <= dateToISO(we)).length;

  const nav = h('div', { class:'row auto' },
    h('button', { class:'btn ghost sm', type:'button', text:'‹', 'aria-label':'Semana anterior', onclick:() => { ui.weekOffset--; renderAnalytics(); } }),
    h('span', { class:'hint', text:`Semana ${isoWeekNumber(ws)} · ${fmtDateBR(dateToISO(ws))} → ${fmtDateBR(dateToISO(we))}` }),
    h('button', { class:'btn ghost sm', type:'button', text:'›', 'aria-label':'Próxima semana', disabled: ui.weekOffset >= 0,
      onclick:() => { if(ui.weekOffset < 0){ ui.weekOffset++; renderAnalytics(); } } }));

  const c = cardWithAction('Relatório semanal', nav);
  c.append(h('div', { class:'stat-grid' },
    statBox(fmtDuration(realized), 'realizado'),
    statBox(planned > 0 ? fmtDuration(planned) : '—', 'planejado'),
    statBox(planned > 0 ? fmtPct((realized/planned)*100) : '—', 'aderência'),
    statBox(String(sess.length), 'sessões'),
    statBox(String(new Set(sess.map(s => s.date)).size), 'dias ativos'),
    statBox(`${reviews}/${scheduled + reviews}`, 'revisões')));

  if(wp && wp.allocations.length){
    const perDisc = wp.allocations.map(al => {
      const realizedD = sum(sess.filter(s => s.disciplineId === al.disciplineId), s => s.minutes);
      return { label: disciplineName(al.disciplineId), planned: al.targetMinutes || 0, realized: realizedD,
               pct: al.targetMinutes > 0 ? (realizedD / al.targetMinutes) * 100 : null };
    }).filter(x => x.planned > 0 || x.realized > 0).sort((a2,b2) => (b2.pct || 0) - (a2.pct || 0));
    if(perDisc.length){
      c.append(h('p', { class:'card-title', style:'margin-top:14px', text:'Por disciplina' }));
      perDisc.forEach(x => c.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text:x.label }),
        h('div', { class:'hbar' }, h('span', { style:`width:${clamp(x.pct || 0,0,100)}%;background:${(x.pct||0) >= 100 ? 'var(--teal)' : 'var(--brass)'}` })),
        h('span', { class:'hv', text: x.pct === null ? fmtDuration(x.realized) : fmtPct(x.pct) }))));
    }
  } else if(!wp){
    c.append(h('p', { class:'hint', style:'margin-top:10px', text:'Esta semana não tinha um plano registrado.' }));
  }
  return c;
}

/* ---------- resumo copiável ---------- */
function buildSummaryText(a){
  const L = [];
  L.push('RESUMO DE ESTUDOS');
  L.push('');
  L.push(`Período: ${fmtDateBR(dateToISO(a.range.start))} → ${fmtDateBR(dateToISO(a.range.end))} (${a.days} dias)`);
  L.push('');
  if(a.planAdherence.hasPlan && a.planAdherence.planned > 0){
    L.push(`Planejado: ${fmtDuration(a.planAdherence.planned)}`);
    L.push(`Realizado: ${fmtDuration(a.planAdherence.realized)}`);
    L.push(`Aderência: ${fmtPct(a.planAdherence.pct)}`);
  } else {
    L.push(`Tempo total: ${fmtDuration(a.totals.minutes)}`);
  }
  L.push(`Sessões: ${a.totals.count}`);
  L.push(`Dias ativos: ${a.totals.activeDays} de ${a.days}`);
  L.push(`Créditos: ${fmtNumber(a.totals.credits)}`);
  if(a.reviews.expected > 0) L.push(`Revisões: ${a.reviews.completed}/${a.reviews.expected}${a.reviews.overdueNow ? ` (${a.reviews.overdueNow} atrasadas)` : ''}`);
  L.push('');
  if(a.byArea.length){
    L.push('Áreas:');
    a.byArea.forEach(x => L.push(`- ${x.label}: ${fmtDuration(x.minutes)} (${fmtNumber(x.pct,0)}%)`));
    L.push('');
  }
  if(a.planAdherence.perDiscipline.length){
    L.push('Disciplinas (realizado / planejado):');
    a.planAdherence.perDiscipline.filter(x => x.planned > 0 || x.realized > 0)
      .forEach(x => L.push(`- ${x.label}: ${fmtDuration(x.realized)} / ${fmtDuration(x.planned)}${x.pct !== null ? ` (${fmtPct(x.pct)})` : ''}`));
    L.push('');
  } else if(a.byDiscipline.length){
    L.push('Disciplinas:');
    a.byDiscipline.forEach(x => L.push(`- ${x.label}: ${fmtDuration(x.minutes)} (${fmtNumber(x.pct,0)}%)`));
    L.push('');
  }
  if(a.difficulty.perTopic.length){
    L.push('Tópicos com maior dificuldade percebida:');
    a.difficulty.perTopic.slice(0,5).forEach(x => L.push(`- ${x.label}: ${fmtNumber(x.avg,1)}/5`));
    L.push('');
  }
  if(a.content.weakest.length){
    L.push('Tópicos com menor domínio:');
    a.content.weakest.forEach(t => L.push(`- ${t.name}: ${t.masteryLevel}/5`));
    L.push('');
  }
  if(a.content.coverage !== null){
    L.push(`Cobertura de conteúdo: ${fmtPct(a.content.coverage)} visto · ${fmtPct(a.content.masteryPct)} dominado`);
    L.push('');
  }
  L.push('Insights:');
  a.insights.forEach(i => L.push(`- ${i}`));
  return L.join('\n');
}

async function copySummary(a){
  const text = buildSummaryText(a || AnalyticsEngine.build(ui.period));
  try {
    await navigator.clipboard.writeText(text);
    toast('Resumo copiado.', 'ok');
  } catch(_){
    openModal(close => ({
      title:'Resumo do período',
      content: h('div',
        h('p', { class:'modal-sub', text:'Copie o texto abaixo.' }),
        (() => { const ta = h('textarea', { style:'min-height:220px', readonly:true }); ta.value = text; return ta; })()),
      actions:[ h('button', { class:'btn ghost', type:'button', text:'Fechar', onclick:() => close() }) ]
    }), { size:'wide' });
  }
}

/* =========================================================================
   TELA: HISTÓRICO
   ========================================================================= */
function renderHistory(){
  const root = $('#history-body');
  const f = ui.history;
  const parts = [];

  const filters = h('div', { class:'card' }, h('p', { class:'card-title', text:'Filtros' }));
  const searchIn = h('input', { type:'search', id:'hf-search', value:f.search, placeholder:'Tópico, comentário, disciplina…' });
  searchIn.addEventListener('input', () => { f.search = searchIn.value; renderHistoryTable(); });

  const areaOpts = [{ value:'', label:'Todas' }].concat(state.areas.slice().sort(sortByName).map(a => ({ value:a.id, label:a.name })));
  const discOpts = [{ value:'', label:'Todas' }].concat(
    (f.areaId ? state.disciplines.filter(d => d.areaId === f.areaId) : state.disciplines).slice().sort(sortByName)
      .map(d => ({ value:d.id, label:d.name + (d.archived ? ' (arquivada)' : '') })));
  const topicOpts = [{ value:'', label:'Todos' }].concat(
    (f.disciplineId ? topicsOf(f.disciplineId, true) : []).map(t => ({ value:t.id, label:t.name })));

  filters.append(
    h('div', { class:'field' }, h('label', { for:'hf-search', text:'Buscar' }), searchIn),
    h('div', { class:'row three' },
      selectField('hf-area', 'Área', areaOpts, f.areaId, e => { f.areaId = e.target.value; f.disciplineId = ''; f.topicId = ''; renderHistory(); }),
      selectField('hf-disc', 'Disciplina', discOpts, f.disciplineId, e => { f.disciplineId = e.target.value; f.topicId = ''; renderHistory(); }),
      selectField('hf-topic', 'Tópico', topicOpts, f.topicId, e => { f.topicId = e.target.value; renderHistoryTable(); })),
    h('div', { class:'row three' },
      selectField('hf-period', 'Período', [
        { value:'todos', label:'Todos' }, { value:'analises', label:'Período das Análises' },
        { value:'semana', label:'Esta semana' }, { value:'mes', label:'Este mês' }
      ], f.period, e => { f.period = e.target.value; renderHistoryTable(); }),
      selectField('hf-type', 'Tipo', [{ value:'', label:'Todos' }].concat(SESSION_TYPES.map(t => ({ value:t.v, label:t.label }))), f.type, e => { f.type = e.target.value; renderHistoryTable(); }),
      selectField('hf-diff', 'Dificuldade', [{ value:'', label:'Todas' }].concat(DIFFICULTIES.map(d => ({ value:String(d.v), label:d.label }))), f.difficulty, e => { f.difficulty = e.target.value; renderHistoryTable(); }))
  );
  parts.push(filters);
  parts.push(h('div', { class:'card', id:'history-table-card' }));
  mount(root, parts);
  renderHistoryTable();
}

function filteredSessions(){
  const f = ui.history;
  let list = state.sessions.slice();
  if(f.topicId) list = list.filter(s => s.topicId === f.topicId);
  else if(f.disciplineId) list = list.filter(s => s.disciplineId === f.disciplineId);
  else if(f.areaId){
    const ids = new Set(state.disciplines.filter(d => d.areaId === f.areaId).map(d => d.id));
    list = list.filter(s => ids.has(s.disciplineId));
  }
  if(f.period === 'semana'){ const r = { start:startOfWeek(today()), end:endOfWeek(today()) }; const a = dateToISO(r.start), b = dateToISO(r.end); list = list.filter(s => s.date >= a && s.date <= b); }
  else if(f.period === 'mes'){ const a = dateToISO(startOfMonth(today())), b = dateToISO(endOfMonth(today())); list = list.filter(s => s.date >= a && s.date <= b); }
  else if(f.period === 'analises' && ui.period){ const a = dateToISO(ui.period.start), b = dateToISO(ui.period.end); list = list.filter(s => s.date >= a && s.date <= b); }
  if(f.type) list = list.filter(s => s.type === f.type);
  if(f.difficulty) list = list.filter(s => String(s.difficulty) === f.difficulty);
  if(f.search){
    const q = f.search.trim().toLowerCase();
    list = list.filter(s => {
      const d = getDiscipline(s.disciplineId);
      const area = d && d.areaId ? getArea(d.areaId) : null;
      return (d && d.name.toLowerCase().includes(q)) ||
             (area && area.name.toLowerCase().includes(q)) ||
             topicLabelOf(s).toLowerCase().includes(q) ||
             str(s.comment).toLowerCase().includes(q);
    });
  }
  return list.sort((a,b) => b.date.localeCompare(a.date) || str(b.createdAt).localeCompare(str(a.createdAt)));
}

function renderHistoryTable(){
  const holder = $('#history-table-card');
  if(!holder) return;
  const list = filteredSessions();
  clear(holder);

  if(!state.sessions.length){
    holder.append(emptyState('Nenhuma sessão registrada ainda',
      'Use o botão "Registrar" para iniciar o cronômetro ou lançar uma sessão manualmente.',
      h('button', { class:'btn primary', type:'button', text:'Registrar sessão', onclick:() => openRegisterModal() })));
    return;
  }
  holder.append(h('div', { class:'card-head' },
    h('p', { class:'card-title', style:'margin:0', text:`${list.length} ${list.length === 1 ? 'sessão' : 'sessões'}` }),
    h('span', { class:'hint', text:`${fmtDuration(sum(list, s => s.minutes))} · ${fmtNumber(sum(list, s => s.credits))} créditos` })));
  if(!list.length){
    holder.append(h('p', { class:'hint', text:'Nenhuma sessão corresponde a estes filtros.' }));
    return;
  }

  const wrap = h('div', { class:'rtable' });
  const table = h('table');
  table.append(h('thead', null, h('tr', null,
    ['Data','Disciplina','Tópico','Tipo','Min','Créditos','Dificuldade','Comentário',''].map(t => h('th', { text:t })))));
  const tbody = h('tbody');
  list.slice(0, 400).forEach(s => {
    const diff = difficultyInfo(s.difficulty);
    tbody.append(h('tr', null,
      h('td', { dataset:{ l:'Data' }, class:'num', text: fmtDateBR(s.date) }),
      h('td', { dataset:{ l:'Disciplina' }, text: disciplineName(s.disciplineId) }),
      h('td', { dataset:{ l:'Tópico' }, text: topicLabelOf(s) || '—' }),
      h('td', { dataset:{ l:'Tipo' }, text: s.type ? sessionTypeLabel(s.type) : '—' }),
      h('td', { dataset:{ l:'Minutos' }, class:'num', text: String(s.minutes) }),
      h('td', { dataset:{ l:'Créditos' }, class:'num', text: fmtNumber(s.credits) }),
      h('td', { dataset:{ l:'Dificuldade' } }, diff ? [h('span', { class:'dot', style:`background:${diff.color};margin-right:6px` }), diff.label] : '—'),
      h('td', { dataset:{ l:'Comentário' }, class:'clip', title:str(s.comment), text: str(s.comment) || '—' }),
      h('td', { class:'actions' },
        h('button', { class:'linkbtn', type:'button', text:'editar', onclick:() => openEditSessionModal(s.id) }),
        h('button', { class:'linkbtn danger', type:'button', text:'remover', onclick: async () => {
          const ok = await confirmModal('Remover esta sessão do histórico?', { confirmLabel:'Remover' });
          if(ok) await deleteSession(s.id);
        } }))
    ));
  });
  table.append(tbody);
  wrap.append(table);
  holder.append(wrap);
  if(list.length > 400) holder.append(h('p', { class:'hint', style:'margin-top:10px', text:`Mostrando as 400 sessões mais recentes de ${list.length}. Refine os filtros para ver as demais.` }));
}

function openEditSessionModal(id){
  const s = state.sessions.find(x => x.id === id);
  if(!s) return;
  openModal(close => {
    let discId = s.disciplineId, topicId = s.topicId || '', type = s.type, difficulty = s.difficulty, outcome = s.reviewOutcome;
    const body = h('div');
    const dateIn = h('input', { type:'date', id:'es-date', value:s.date });
    const minIn = h('input', { type:'number', id:'es-min', min:'1', step:'1', value:String(s.minutes), inputmode:'numeric' });
    const commentIn = h('textarea', { id:'es-comment' });
    commentIn.value = str(s.comment);

    function build(){
      clear(body);
      body.append(
        selectField('es-disc', 'Disciplina', disciplineOptions(false, true), discId, e => { discId = e.target.value; topicId = ''; build(); }),
        selectField('es-topic', 'Tópico', topicOptions(discId, true), topicId, e => { topicId = e.target.value; }),
        h('div', { class:'row' },
          h('div', { class:'field' }, h('label', { for:'es-date', text:'Data' }), dateIn),
          h('div', { class:'field' }, h('label', { for:'es-min', text:'Minutos' }), minIn)),
        selectField('es-type', 'Tipo', [{ value:'', label:'— Não informado —' }].concat(SESSION_TYPES.map(t => ({ value:t.v, label:t.label }))), type, e => { type = e.target.value || null; build(); }),
        h('div', { class:'field' }, h('label', { text:'Dificuldade' }),
          pillGroup(DIFFICULTIES.map(d => ({ value:d.v, label:d.label, color:d.color })), difficulty, v => { difficulty = v ? Number(v) : null; })),
        type === 'revisao' ? h('div', { class:'field' }, h('label', { text:'Resultado da revisão' }),
          pillGroup(REVIEW_OUTCOMES.map(o => ({ value:o.v, label:o.label })), outcome, v => { outcome = v; }),
          h('p', { class:'hint', text:'Editar o resultado aqui não reprograma a revisão já aplicada ao tópico.' })) : null,
        h('div', { class:'field' }, h('label', { for:'es-comment', text:'Comentário' }), commentIn)
      );
    }
    build();

    return {
      title:'Editar sessão',
      content: body,
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
          const minutes = Number(minIn.value);
          if(!(minutes > 0)){ toast('Informe um tempo válido.', 'err'); return; }
          close();
          await updateSession(id, {
            disciplineId: discId, topicId: topicId || null, date: dateIn.value || s.date,
            minutes, type, difficulty, comment: commentIn.value.trim(),
            reviewOutcome: type === 'revisao' ? outcome : null
          });
        } })
      ]
    };
  }, { size:'wide' });
}

/* =========================================================================
   TELA: DADOS
   ========================================================================= */
function renderData(){
  const root = $('#data-body');
  const lastBackup = state.meta.lastBackupAt;
  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null;

  const info = card('Onde os seus dados ficam',
    h('div', { class:'stat-grid' },
      statBox('Local', 'armazenamento (neste navegador)'),
      statBox('Nenhum', 'servidor'),
      statBox('Nenhuma', 'sincronização'),
      statBox(lastBackup ? (daysSinceBackup === 0 ? 'hoje' : `há ${daysSinceBackup} ${daysSinceBackup === 1 ? 'dia' : 'dias'}`) : 'nunca', 'último backup')),
    h('p', { class:'hint', style:'margin-top:12px', text:'Tudo é gravado em IndexedDB, no seu navegador. Nenhum dado de estudo sai daqui — o app não faz conexões de rede.' }),
    (daysSinceBackup === null || daysSinceBackup >= 14)
      ? h('p', { class:'warn', text: lastBackup
          ? 'Já faz um tempo desde o último backup. Exportar um JSON de vez em quando evita perder tudo se você limpar o navegador.'
          : 'Você ainda não exportou nenhum backup. Se limpar os dados do navegador, o histórico se perde.' })
      : null
  );

  const counts = card('Conteúdo atual',
    h('div', { class:'stat-grid' },
      statBox(String(state.areas.length), 'áreas'),
      statBox(String(state.disciplines.length), 'disciplinas'),
      statBox(String(state.topics.length), 'tópicos'),
      statBox(String(state.sessions.length), 'sessões'),
      statBox(String(state.weeklyPlans.length), 'semanas registradas')));

  const exportCard = card('Backup',
    h('p', { class:'hint', style:'margin-bottom:12px', text:'O JSON contém tudo (áreas, disciplinas, tópicos, sessões, planos, semanas, prazos e configurações) e serve para restaurar ou levar para outro dispositivo. O CSV é só das sessões, para planilhas ou análise externa.' }),
    h('div', { class:'row auto' },
      h('button', { class:'btn primary', type:'button', text:'Exportar backup (.json)', onclick: async () => {
        await Backup.exportJSON(); await refresh(); toast('Backup exportado.', 'ok');
      } }),
      h('button', { class:'btn ghost', type:'button', text:'Exportar sessões (.csv)', onclick:() => { Backup.exportCSV(); toast('CSV exportado.', 'ok'); } })));

  const fileIn = h('input', { type:'file', id:'import-file', accept:'application/json,.json' });
  fileIn.addEventListener('change', onImportFile);
  const importCard = card('Restaurar backup',
    h('p', { class:'hint', style:'margin-bottom:12px', text:'Aceita backups desta versão e também os da versão anterior (formato antigo é convertido automaticamente). O arquivo é validado antes de gravar — nada é executado.' }),
    fileIn);

  const v2 = readV2Raw();
  const v2Card = v2 ? card('Dados da versão anterior',
    h('p', { class:'hint', text: state.meta.v2MigrationCompleted
      ? 'Seus dados da V2 já foram migrados para esta versão. A cópia original continua guardada no navegador como segurança e não é usada pelo app.'
      : 'Foram encontrados dados da versão anterior neste navegador.' }),
    h('div', { class:'row auto', style:'margin-top:10px' },
      h('button', { class:'linkbtn danger', type:'button', text:'apagar cópia antiga da V2', onclick: async () => {
        const ok = await confirmModal('Apagar a cópia de segurança dos dados da V2 (localStorage)? Os dados já migrados para a V3 continuam intactos. Esta ação não pode ser desfeita.', { confirmLabel:'Apagar cópia antiga' });
        if(!ok) return;
        try { localStorage.removeItem(V2_LS_KEY); toast('Cópia antiga removida.'); render(); }
        catch(_){ toast('Não foi possível remover.', 'err'); }
      } }))) : null;

  const danger = h('div', { class:'card', style:'border-color:var(--danger)' },
    h('p', { class:'card-title', style:'color:var(--danger)', text:'Zona perigosa' }),
    h('p', { class:'hint', style:'margin-bottom:12px', text:'Apaga áreas, disciplinas, tópicos, sessões, planos e prazos desta versão. Não pode ser desfeito — exporte um backup antes.' }),
    h('button', { class:'btn danger', type:'button', text:'Apagar todos os dados', onclick:wipeAll }));

  mount(root, info, counts, exportCard, importCard, v2Card, danger);
}

function onImportFile(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    e.target.value = '';
    let parsed;
    try { parsed = Backup.parseBackup(String(reader.result)); }
    catch(err){ toast(err.message || 'Arquivo inválido.', 'err'); return; }

    const d = parsed.data;
    const summary = `${d.disciplines.length} disciplina(s), ${d.topics.length} tópico(s), ${d.sessions.length} sessão(ões).`;
    openModal(close => ({
      title:'Restaurar backup',
      content: h('div',
        h('p', { class:'modal-sub', text:`Backup no formato ${parsed.format.toUpperCase()} — ${summary}` }),
        parsed.warnings.length ? h('ul', { class:'reasons' }, parsed.warnings.map(w => h('li', { text:w }))) : null,
        h('p', { class:'warn', text:'Isto substitui TODOS os dados atuais desta versão. Exporte um backup antes se quiser manter o que está aqui.' })),
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        h('button', { class:'btn danger', type:'button', text:'Substituir e restaurar', onclick: async () => {
          close();
          try {
            await Backup.restoreInto(d);
            ui.planDraft = null;
            await refresh();
            applyTheme(state.settings.theme);
            applyReduceMotion(state.settings.reduceMotion);
            toast('Backup restaurado.', 'ok');
          } catch(err){ console.error(err); toast('Falha ao restaurar o backup.', 'err'); }
        } })
      ]
    }), { size:'wide' });
  };
  reader.onerror = () => toast('Não foi possível ler o arquivo.', 'err');
  reader.readAsText(file);
}

async function wipeAll(){
  const ok1 = await confirmModal('Apagar TODOS os dados desta versão (disciplinas, tópicos, sessões, planos e prazos)?', { confirmLabel:'Continuar' });
  if(!ok1) return;
  const ok2 = await confirmModal('Esta ação é definitiva e não pode ser desfeita. Tem certeza?', { confirmLabel:'Apagar tudo' });
  if(!ok2) return;
  await DB.clearStores(['areas','disciplines','topics','sessions','plans','weeklyPlans','deadlines']);
  TimerService.discard();
  ui.planDraft = null;
  await refresh();
  renderTimerBar();
  toast('Todos os dados foram apagados. A cópia antiga da V2, se existir, não foi tocada.');
}

/* =========================================================================
   TELA: CONFIGURAÇÕES
   ========================================================================= */
function renderSettings(){
  const root = $('#settings-body');
  const s = state.settings;

  const themeSel = selectField('st-theme', 'Tema', [{ value:'dark', label:'Escuro' }, { value:'light', label:'Claro' }], s.theme,
    async e => { s.theme = e.target.value; await saveSettings(); toast('Tema atualizado.', 'ok'); });
  const weekSel = selectField('st-week', 'Primeiro dia da semana', [{ value:'monday', label:'Segunda-feira' }, { value:'sunday', label:'Domingo' }], s.weekStart,
    async e => { s.weekStart = e.target.value; await saveSettings(); await refresh(); toast('Semana atualizada.', 'ok'); });
  const periodSel = selectField('st-period', 'Período padrão das Análises', [
    { value:'hoje', label:'Hoje' }, { value:'7d', label:'7 dias' }, { value:'30d', label:'30 dias' },
    { value:'semana', label:'Esta semana' }, { value:'mes', label:'Este mês' }, { value:'tudo', label:'Tudo' }
  ], s.defaultPeriod, async e => { s.defaultPeriod = e.target.value; await saveSettings(); toast('Preferência salva.', 'ok'); });

  const sessIn = h('input', { type:'number', id:'st-sess', min:'5', step:'5', value:String(s.defaultSessionMinutes), inputmode:'numeric' });
  sessIn.addEventListener('change', async () => { s.defaultSessionMinutes = Number(sessIn.value); await saveSettings(); render(); toast('Duração padrão salva.', 'ok'); });
  const revIn = h('input', { type:'number', id:'st-rev', min:'5', step:'5', value:String(s.defaultReviewMinutes), inputmode:'numeric' });
  revIn.addEventListener('change', async () => { s.defaultReviewMinutes = Number(revIn.value); await saveSettings(); render(); toast('Duração de revisão salva.', 'ok'); });

  const autoRev = h('input', { type:'checkbox', id:'st-autorev', checked: s.autoReviewNewTopics });
  autoRev.addEventListener('change', async () => { s.autoReviewNewTopics = autoRev.checked; await saveSettings(); toast('Preferência salva.', 'ok'); });
  const redMotion = h('input', { type:'checkbox', id:'st-motion', checked: s.reduceMotion });
  redMotion.addEventListener('change', async () => { s.reduceMotion = redMotion.checked; await saveSettings(); toast('Preferência salva.', 'ok'); });

  mount(root,
    card('Aparência', themeSel,
      h('label', { style:'display:flex;align-items:center;gap:8px;margin:6px 0 0' }, redMotion, 'Reduzir animações')),
    card('Semana e período', weekSel, periodSel),
    card('Sessões',
      h('div', { class:'row' },
        h('div', { class:'field' }, h('label', { for:'st-sess', text:'Duração padrão de sessão (min)' }), sessIn),
        h('div', { class:'field' }, h('label', { for:'st-rev', text:'Duração padrão de revisão (min)' }), revIn)),
      h('label', { style:'display:flex;align-items:center;gap:8px;margin:0' }, autoRev, 'Incluir novos tópicos automaticamente nas revisões')),
    card('Sobre',
      h('p', { class:'hint', text:`Diário de Estudos v${APP_VERSION} · formato de dados ${APP_SCHEMA_VERSION}.` }),
      h('p', { class:'hint', style:'margin-top:6px', text:'Aplicação local: sem conta, sem servidor, sem rede. Desenvolvido por Filipe Santana.' }),
      state.meta.v2MigrationDate ? h('p', { class:'hint', style:'margin-top:6px', text:`Dados da V2 migrados em ${fmtDateBR(String(state.meta.v2MigrationDate).slice(0,10))}.` }) : null)
  );
}

/* =========================================================================
   ONBOARDING — 3 passos para quem chega novo; versão curta para quem migrou.
   ========================================================================= */
function openOnboarding(migratedSummary){
  const migrated = !!migratedSummary;
  const totalSteps = migrated ? 2 : 3;
  let step = 1;
  let weeklyHours = 5;
  let draftItems = [];   // [{ areaName, disciplineName, priority }] (fluxo novo)
  let priorities = new Map(activeDisciplines().map(d => [d.id, d.priority]));

  if(!migrated) draftItems = [{ areaName:'', disciplineName:'', priority:3 }];

  // O openModal monta cfg.actions depois de build(); guardamos rebuild para
  // repopular o rodapé logo em seguida (os botões mudam a cada passo).
  let rebuildRef = null;

  openModal(close => {
    const body = h('div');

    function footer(){
      const acts = [];
      if(step > 1) acts.push(h('button', { class:'btn ghost', type:'button', text:'Voltar', onclick:() => { step--; rebuild(); } }));
      if(step < totalSteps) acts.push(h('button', { class:'btn primary', type:'button', text:'Continuar', onclick:next }));
      else acts.push(h('button', { class:'btn primary', type:'button', text:'Começar', onclick:finish }));
      mount($('#modal-actions'), ...acts);
    }

    function next(){
      if(!migrated && step === 2){
        const valid = draftItems.filter(i => str(i.disciplineName).trim());
        if(!valid.length){ toast('Adicione ao menos uma disciplina.', 'err'); return; }
      }
      if(step === 1 && !(weeklyHours > 0)){ toast('Informe quantas horas por semana.', 'err'); return; }
      step++;
      rebuild();
    }

    /* --- passo 1: disponibilidade --- */
    function stepAvailability(){
      const input = h('input', { type:'number', id:'ob-hours', min:'0.5', step:'0.5', value:String(weeklyHours), inputmode:'decimal' });
      input.addEventListener('input', () => { weeklyHours = Number(input.value) || 0; });
      const quick = h('div', { class:'chips', style:'margin-bottom:10px' },
        [3,5,8,10,15].map(v => h('button', { class:'chip', type:'button', text:v + 'h',
          onclick:() => { weeklyHours = v; input.value = String(v); } })));
      return h('div',
        h('p', { class:'ob-step', text:`PASSO ${step} DE ${totalSteps}` }),
        h('p', { class:'ob-q', text:'Quanto tempo você quer dedicar aos estudos por semana?' }),
        (migrated && migratedSummary.fromMigration)
          ? h('p', { class:'hint', style:'margin-bottom:12px', text:`Seus dados da versão anterior foram migrados: ${migratedSummary.disciplines} disciplina(s) e ${migratedSummary.sessions} sessão(ões). Nada foi perdido.` })
          : (migrated ? h('p', { class:'hint', style:'margin-bottom:12px', text:'Suas disciplinas já estão cadastradas. Falta só definir quanto tempo você tem por semana.' }) : null),
        quick,
        h('div', { class:'field' }, h('label', { for:'ob-hours', text:'Horas por semana' }), input),
        h('p', { class:'hint', text:'Dá para mudar depois. Esse número é só a base da distribuição semanal.' }));
    }

    /* --- passo 2 (novo): o que você estuda --- */
    function stepDisciplines(){
      const list = h('div', { class:'ob-list' });
      draftItems.forEach((item, i) => {
        const areaIn = h('input', { type:'text', placeholder:'Área (ex.: Tecnologia)', value:item.areaName, maxlength:'60', 'aria-label':'Área' });
        areaIn.addEventListener('input', () => { item.areaName = areaIn.value; });
        const discIn = h('input', { type:'text', placeholder:'Disciplina (ex.: CCNA)', value:item.disciplineName, maxlength:'80', 'aria-label':'Disciplina' });
        discIn.addEventListener('input', () => { item.disciplineName = discIn.value; });
        const prioSel = h('select', { 'aria-label':'Prioridade' });
        [1,2,3,4,5].forEach(p => prioSel.appendChild(h('option', { value:String(p), selected:p === item.priority }, `${p} — ${PRIORITY_LABELS[p]}`)));
        prioSel.addEventListener('change', () => { item.priority = Number(prioSel.value); });

        list.append(h('div', { class:'card elevated', style:'padding:12px' },
          h('div', { class:'row' },
            h('div', { class:'field tight' }, h('label', { text:'Área' }), areaIn),
            h('div', { class:'field tight' }, h('label', { text:'Disciplina' }), discIn)),
          h('div', { class:'row', style:'margin-top:10px;align-items:end' },
            h('div', { class:'field tight' }, h('label', { text:'Prioridade' }), prioSel),
            draftItems.length > 1 ? h('div', { class:'field tight' },
              h('button', { class:'linkbtn danger', type:'button', text:'remover', onclick:() => { draftItems.splice(i,1); rebuild(); } })) : null)
        ));
      });
      return h('div',
        h('p', { class:'ob-step', text:`PASSO ${step} DE ${totalSteps}` }),
        h('p', { class:'ob-q', text:'O que você está estudando?' }),
        list,
        h('button', { class:'btn ghost sm', type:'button', text:'+ adicionar outra', onclick:() => { draftItems.push({ areaName:'', disciplineName:'', priority:3 }); rebuild(); } }),
        h('p', { class:'hint', style:'margin-top:10px', text:'A área é opcional — serve só para agrupar. Os tópicos você adiciona depois, dentro de cada disciplina.' }));
    }

    /* --- passo 2 (migrado): prioridades --- */
    function stepPriorities(){
      const list = h('div', { class:'ob-list' });
      activeDisciplines().slice().sort(sortByName).forEach(d => {
        const sel = h('select', { 'aria-label':'Prioridade de ' + d.name });
        [1,2,3,4,5].forEach(p => sel.appendChild(h('option', { value:String(p), selected:p === (priorities.get(d.id) || 3) }, `${p} — ${PRIORITY_LABELS[p]}`)));
        sel.addEventListener('change', () => priorities.set(d.id, Number(sel.value)));
        list.append(h('div', { class:'ob-item' },
          h('div', { class:'oi-main' },
            h('div', { text:d.name }),
            h('div', { class:'oi-sub', text: areaNameOf(d) + (d.legacyWeeklyMinutes ? ` · meta antiga ≈ ${fmtDuration(d.legacyWeeklyMinutes)}/semana` : '') })),
          sel));
      });
      return h('div',
        h('p', { class:'ob-step', text:`PASSO ${step} DE ${totalSteps}` }),
        h('p', { class:'ob-q', text:'Qual a prioridade de cada disciplina?' }),
        list,
        h('p', { class:'hint', text:'A prioridade orienta a distribuição do tempo e as recomendações. Dá para ajustar quando quiser.' }));
    }

    /* --- passo final: prévia da distribuição --- */
    function stepPreview(){
      const minutes = Math.round(weeklyHours * 60);
      const allocs = migrated
        ? activeDisciplines().map(d => ({ disciplineId:d.id, priority: priorities.get(d.id) || 3,
            minWeeklyMinutes: Math.min(d.legacyWeeklyMinutes || 0, minutes) }))
        : draftItems.filter(i => str(i.disciplineName).trim()).map((i, k) => ({ disciplineId:'tmp-' + k, priority:i.priority, minWeeklyMinutes:0 }));
      const res = PlannerEngine.generatePlan(minutes, allocs);
      const nameOf = (id, k) => migrated ? disciplineName(id) : str(draftItems.filter(i => str(i.disciplineName).trim())[k].disciplineName).trim();

      const pv = h('div', { class:'ob-preview' });
      res.allocations.forEach((a, k) => pv.append(h('div', { class:'pv-row' },
        h('span', { text: nameOf(a.disciplineId, k) }),
        h('span', { class:'num', text: fmtDuration(a.targetMinutes) }))));
      pv.append(h('div', { class:'pv-row', style:'border-top:1px solid var(--line);margin-top:6px;padding-top:8px' },
        h('span', { text:'Total' }),
        h('span', { class:'num', text: fmtDuration(sum(res.allocations, x => x.targetMinutes)) })));

      return h('div',
        h('p', { class:'ob-step', text:`PASSO ${step} DE ${totalSteps}` }),
        h('p', { class:'ob-q', text:'Sua distribuição semanal sugerida' }),
        pv,
        res.conflict ? h('p', { class:'warn', text:`Os mínimos herdados somam ${fmtDuration(res.conflict.minimumsTotal)} e passam da disponibilidade — os valores foram ajustados proporcionalmente. Dá para editar tudo no Planejamento.` }) : null,
        h('p', { class:'hint', style:'margin-top:10px', text:'Você pode editar cada valor depois, em Planejamento. A partir daqui a tela Hoje passa a sugerir o que estudar.' }));
    }

    function rebuild(){
      clear(body);
      if(step === 1) body.append(stepAvailability());
      else if(step === 2 && !migrated) body.append(stepDisciplines());
      else if(step === 2 && migrated) body.append(stepPriorities());
      else body.append(stepPreview());
      footer();
    }

    async function finish(){
      const minutes = Math.round(weeklyHours * 60);
      try {
        if(migrated){
          activeDisciplines().forEach(d => { d.priority = priorities.get(d.id) || 3; d.updatedAt = nowISO(); });
          await DB.putMany('disciplines', state.disciplines);
          await loadAll();
          const allocs = activeDisciplines().map(d => ({ disciplineId:d.id, priority:d.priority, minWeeklyMinutes: Math.min(d.legacyWeeklyMinutes || 0, minutes) }));
          const res = PlannerEngine.generatePlan(minutes, allocs);
          const plan = newPlan('Meu plano', minutes);
          plan.allocations = res.allocations;
          await DB.put('plans', plan);
        } else {
          const items = draftItems.filter(i => str(i.disciplineName).trim());
          const areaByName = new Map(state.areas.map(a => [a.name.toLowerCase(), a]));
          const newAreas = [], newDiscs = [];
          items.forEach(i => {
            const an = str(i.areaName).trim();
            let areaId = null;
            if(an){
              const key = an.toLowerCase();
              let a = areaByName.get(key);
              if(!a){ a = newArea(an); areaByName.set(key, a); newAreas.push(a); }
              areaId = a.id;
            }
            newDiscs.push(newDiscipline(str(i.disciplineName).trim(), areaId, i.priority));
          });
          const plan = newPlan('Meu plano', minutes);
          const res = PlannerEngine.generatePlan(minutes, newDiscs.map(d => ({ disciplineId:d.id, priority:d.priority, minWeeklyMinutes:0 })));
          plan.allocations = res.allocations;
          await DB.transactional(['areas','disciplines','plans'], api => {
            newAreas.forEach(a => api.put('areas', a));
            newDiscs.forEach(d => api.put('disciplines', d));
            api.put('plans', plan);
          });
        }
        await setMeta('onboardingCompleted', true);
        close();
        ui.planDraft = null;
        await refresh();
        setView('today');
        toast('Tudo pronto. A tela Hoje já sabe o que sugerir.', 'ok');
      } catch(err){
        console.error(err);
        toast('Não foi possível concluir a configuração inicial.', 'err');
      }
    }

    rebuildRef = rebuild;
    rebuild();
    return { title:'Bem-vindo ao Diário de Estudos', content: body, actions: [] };
  }, { size:'wide', dismissible:false });

  if(rebuildRef) rebuildRef();
}

/* =========================================================================
   RENDER — despachante por tela
   ========================================================================= */
function render(){
  updateBadges();
  renderTimerBar();
  switch(ui.view){
    case 'today':       renderToday(); break;
    case 'plan':        renderPlan(); break;
    case 'reviews':     renderReviews(); break;
    case 'disciplines': renderDisciplines(); break;
    case 'analytics':   renderAnalytics(); break;
    case 'history':     renderHistory(); break;
    case 'data':        renderData(); break;
    case 'settings':    renderSettings(); break;
    default:            renderToday();
  }
}

/* =========================================================================
   EVENT HANDLERS
   ========================================================================= */
function bindEvents(){
  $$('#nav-desktop .nav-item').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('#nav-mobile .mb-item[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  $('#mb-more').addEventListener('click', () => {
    openModal(close => ({
      title:'Mais',
      content: h('div', { class:'ob-list' },
        [['disciplines','Disciplinas'], ['history','Histórico'], ['data','Dados'], ['settings','Configurações']].map(([v,l]) =>
          h('button', { class:'btn ghost block', type:'button', text:l, onclick:() => { close(); setView(v); } }))),
      actions:[ h('button', { class:'btn ghost', type:'button', text:'Fechar', onclick:() => close() }) ]
    }), { size:'narrow' });
  });

  const toggleTheme = async () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    await saveSettings();
    if(ui.view === 'settings') renderSettings();
  };
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#theme-toggle-m').addEventListener('click', toggleTheme);

  $('#fab').addEventListener('click', () => {
    if(TimerService.isActive){ openFinishModal(); return; }
    openRegisterModal();
  });

  // Atalho: "R" abre o registro rápido (fora de campos de texto).
  document.addEventListener('keydown', (e) => {
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if(tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if(!$('#modal-root').hidden) return;
    if(e.key === 'r' || e.key === 'R'){ e.preventDefault(); TimerService.isActive ? openFinishModal() : openRegisterModal(); }
  });

  // Ao voltar para a aba, o relógio e a fila de revisões podem ter mudado de dia.
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState !== 'visible') return;
    renderTimerBar();
    updateBadges();
  });

  window.addEventListener('beforeunload', () => { TimerService.stopTicking(); });
}

/* =========================================================================
   INITIALIZATION
   ========================================================================= */
function showFatalError(message, detail){
  const main = $('.main');
  if(!main) return;
  mount(main, h('div', { class:'card', style:'border-color:var(--danger)' },
    h('h3', { style:'margin-bottom:8px', text:'Não foi possível abrir seus dados' }),
    h('p', { class:'hint', text:message }),
    detail ? h('p', { class:'hint', style:'margin-top:8px', text:detail }) : null,
    h('p', { class:'hint', style:'margin-top:12px', text:'Se você estiver em uma janela anônima ou com o armazenamento do site bloqueado, tente abrir em uma janela normal. Os dados ficam guardados no navegador.' })
  ));
  const fab = $('#fab'); if(fab) fab.classList.add('hidden');
}

async function init(){
  // Tema aplicado antes de tudo, para evitar piscar de cor.
  try {
    const cached = localStorage.getItem(THEME_LS_KEY);
    if(cached === 'light' || cached === 'dark') document.documentElement.setAttribute('data-theme', cached);
  } catch(_){}

  try {
    await DB.open();
  } catch(err){
    console.error(err);
    showFatalError('O navegador não liberou o banco local (IndexedDB), que é onde o aplicativo guarda tudo.', String(err && err.message || err));
    return;
  }

  let migration = null;
  try {
    migration = await runV2Migration();
  } catch(err){
    console.error('Falha na migração V2:', err);
    toast('Não foi possível migrar automaticamente os dados da versão anterior. Eles continuam salvos e podem ser importados em Dados.', 'err');
  }

  await loadAll();
  applyTheme(state.settings.theme);
  applyReduceMotion(state.settings.reduceMotion);
  applyPresetSilently(state.settings.defaultPeriod || 'semana');

  await PlannerEngine.ensureWeeklyPlan();

  TimerService.restore();
  bindEvents();
  state.ready = true;
  setView('today');

  if(TimerService.isActive) offerStaleSession();

  // Onboarding: só para quem ainda não tem plano nem disciplinas configuradas.
  const needsOnboarding = !state.meta.onboardingCompleted && !PlannerEngine.activePlan();
  if(needsOnboarding){
    // Quem já tem disciplinas (migradas ou criadas antes) não recadastra nada:
    // pede só disponibilidade semanal e prioridades.
    const hasDisciplines = activeDisciplines().length > 0;
    openOnboarding(hasDisciplines ? {
      fromMigration: !!(migration && migration.migrated),
      disciplines: migration && migration.migrated ? migration.counts.disciplines : activeDisciplines().length,
      sessions: migration && migration.migrated ? migration.counts.sessions : state.sessions.length
    } : null);
  } else if(migration && migration.migrated){
    toast(`Dados da V2 migrados: ${migration.counts.disciplines} disciplina(s), ${migration.counts.sessions} sessão(ões).`, 'ok');
  }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
