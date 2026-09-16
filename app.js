/* =========================================================================
   CICLO — v5.1
   (antes chamado "Diário de Estudos")
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
const APP_VERSION = '5.1.0';
const APP_SCHEMA_VERSION = 4;          // formato LÓGICO dos dados. Nem a v5 nem a v5.1
                                       // introduzem campos persistentes novos (a v5.1 é
                                       // visual + contato), então continuar em 4 é o correto.

/* Identificadores técnicos LEGADOS. O produto passou a se chamar "Ciclo" na v5.1,
   mas estes nomes ficam como estão: renomeá-los faria o navegador procurar um
   banco/chaves que não existem e o usuário "perderia" os dados já gravados. */
const IDB_NAME = 'diarioEstudosDB';
const IDB_VERSION = 1;                 // schema FÍSICO do IndexedDB: a v4 só acrescenta
                                       // campos dentro dos objetos, nenhuma store ou
                                       // índice novo — por isso continua 1.
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

/* v5 — prioridade em linguagem natural. Três escolhas mapeadas na escala interna 1–5.
   A granularidade completa continua disponível em "Opções avançadas". */
const PRIORITY_SIMPLE = [
  { value:2, label:'De vez em quando', hint:'Quero acompanhar, mas sem pressa.' },
  { value:3, label:'É importante',     hint:'Faz parte da minha rotina de estudo.' },
  { value:5, label:'É prioridade',     hint:'É uma das coisas mais importantes agora.' }
];
function prioritySimpleValue(p){
  const n = clamp(Number(p) || 3, 1, 5);
  if(n <= 2) return 2;
  if(n >= 4) return 5;
  return 3;
}
function prioritySimpleLabel(p){
  const opt = PRIORITY_SIMPLE.find(x => x.value === prioritySimpleValue(p));
  return opt ? opt.label : 'É importante';
}

/* v5 — métricas em duas camadas: nome natural + termo canônico.
   A interface mostra o natural; o técnico aparece como complemento. */
const METRIC_WORDS = {
  adherence: { title:'Plano cumprido',        canonical:'aderência ao plano' },
  coverage:  { title:'Conteúdo estudado',     canonical:'cobertura' },
  mastery:   { title:'Conteúdos consolidados',canonical:'domínio' },
  credits:   { title:'Créditos',              canonical:'créditos' }
};

/* ---------- v4: natureza do conteúdo da disciplina ---------- */
const CONTENT_NATURES = [
  { v:'mixed',           label:'Mista',                  hint:'Um pouco de tudo. É o padrão.' },
  { v:'conceptual',      label:'Conceitual',             hint:'Teorias, definições, processos.' },
  { v:'memorization',    label:'Memorização',            hint:'Listas, termos, datas, vocabulário.' },
  { v:'problem_solving', label:'Resolução de problemas', hint:'Cálculo, lógica, questões.' },
  { v:'practical',       label:'Prática',                hint:'Laboratório, execução, habilidade manual.' }
];
function contentNatureLabel(v){ const x = CONTENT_NATURES.find(n => n.v === v); return x ? x.label : 'Mista'; }

/* ---------- v4: importância do tópico (dentro da disciplina) ---------- */
const TOPIC_IMPORTANCES = [
  { v:'low',    label:'Baixa',  weight:0.6 },
  { v:'normal', label:'Normal', weight:1.0 },
  { v:'high',   label:'Alta',   weight:1.5 }
];
function importanceLabel(v){ const x = TOPIC_IMPORTANCES.find(i => i.v === v); return x ? x.label : 'Normal'; }
function importanceWeight(v){ const x = TOPIC_IMPORTANCES.find(i => i.v === v); return x ? x.weight : 1.0; }

/* ---------- v4: QUANDO revisar (estratégia de espaçamento) ---------- */
const REVIEW_STRATEGIES = [
  { v:'adaptive',   label:'Adaptativa',      short:'O intervalo responde ao seu resultado. Recomendada.' },
  { v:'fixed',      label:'Ciclo programado', short:'Intervalos previsíveis: 1, 3, 7, 14, 30, 60 dias.' },
  { v:'intensive',  label:'Intensiva',        short:'Revisões mais frequentes. Para provas e prazos.' },
  { v:'maintenance',label:'Manutenção',       short:'Intervalos longos, para conteúdo já consolidado.' }
];
function strategyLabel(v){ const x = REVIEW_STRATEGIES.find(s2 => s2.v === v); return x ? x.label : 'Adaptativa'; }

/* Ciclos fixos, em dias. O resultado da revisão move o passo dentro do ciclo. */
const CYCLE_STEPS = {
  fixed:       [1, 3, 7, 14, 30, 60],
  intensive:   [1, 2, 3, 5, 7, 10, 14],
  maintenance: [14, 30, 60, 90, 120, 180]
};

/* ---------- v4: COMO revisar (método) ---------- */
const REVIEW_METHODS = [
  { v:'auto',           label:'Automático' },
  { v:'active_recall',  label:'Recordação ativa' },
  { v:'exercises',      label:'Exercícios' },
  { v:'explanation',    label:'Explicação' },
  { v:'memory_summary', label:'Resumo de memória' },
  { v:'flashcards',     label:'Flashcards' },
  { v:'interleaving',   label:'Prática intercalada' },
  { v:'free',           label:'Revisão livre' }
];
function methodLabel(v){ const x = REVIEW_METHODS.find(m => m.v === v); return x ? x.label : 'Automático'; }
const CONCRETE_METHODS = REVIEW_METHODS.filter(m => m.v !== 'auto').map(m => m.v);

/* Método sugerido por natureza do conteúdo. Simples e explicável de propósito. */
const AUTO_METHOD_BY_NATURE = {
  conceptual:      ['active_recall', 'explanation'],
  memorization:    ['active_recall', 'flashcards'],
  problem_solving: ['exercises', 'interleaving'],
  practical:       ['exercises', 'active_recall'],
  mixed:           ['active_recall']
};

/* Tempo estimado por método, em minutos — base para montar a sessão de revisão. */
const METHOD_MINUTES = {
  active_recall: 10, exercises: 20, explanation: 10,
  memory_summary: 15, flashcards: 10, interleaving: 20, free: 15
};

/* Pesos da fila inteligente de revisão. Centralizados para serem auditáveis. */
const REVIEW_QUEUE_WEIGHTS = {
  OVERDUE_BASE: 30,      // só por estar vencida
  OVERDUE_PER_DAY: 3,    // por dia de atraso (limitado)
  OVERDUE_DAY_CAP: 10,   // teto de dias contados
  DUE_TODAY: 18,         // prevista para hoje
  IMPORTANCE: 14,        // × peso da importância
  LOW_MASTERY: 16,       // domínio baixo
  BAD_LAST_RESULT: 12,   // último resultado foi ruim
  FORGET_RATE: 10,       // histórico de esquecimento
  DEADLINE: 16,          // prazo próximo da disciplina
  STALE: 6               // muito tempo sem revisar
};

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

/* Cores de dados (gráficos). Tons médios, legíveis nos dois temas. */
const PALETTE = ['#45A895','#D0A64E','#6F9BD1','#D9776D','#9A89D0','#2F8373','#CC844E','#5A93B0','#B587B2','#83AE63'];
const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MONTHS_ABBR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const DEFAULT_SETTINGS = {
  theme: 'dark',                 // 'dark' | 'light' | 'system'
  density: 'comfortable',        // 'comfortable' | 'compact'
  startView: 'today',            // tela inicial
  helpMode: 'full',              // 'full' | 'discreet' | 'off'
  hoverHints: true,              // explicações ao passar o mouse
  showUpcomingReviews: true,     // revisões futuras na tela Hoje
  seenTips: [],                  // ids das dicas de primeira visita já vistas
  weekStart: 'monday',
  defaultSessionMinutes: 40,
  defaultReviewMinutes: 20,
  autoReviewNewTopics: true,
  reduceMotion: false,
  defaultPeriod: 'semana',
  /* v4 */
  defaultReviewStrategy: 'adaptive',   // estratégia global (disciplina/tópico podem sobrescrever)
  defaultReviewMethod: 'auto',         // método global
  showDailyQuote: true,                // frase do dia na tela Hoje
  seenWhatsNew: null                   // versão cujas novidades já foram vistas
};

const VIEW_TITLES = {
  today:'Hoje', plan:'Planejamento', reviews:'Revisões', disciplines:'Disciplinas',
  analytics:'Análises', history:'Histórico', help:'Ajuda', data:'Dados', settings:'Configurações'
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

/**
 * Envolve um handler assíncrono para que cliques repetidos não disparem a ação
 * duas vezes (duplo clique, Enter repetido, toque duplo no celular).
 * O botão fica desabilitado enquanto a ação roda.
 */
function once(handler){
  let running = false;
  return async function(ev){
    if(running) return;
    running = true;
    const btn = ev && ev.currentTarget;
    if(btn && 'disabled' in btn){ btn.disabled = true; btn.classList.add('is-busy'); btn.setAttribute('aria-busy','true'); }
    try { await handler.call(this, ev); }
    catch(err){ console.error(err); toast('Tente novamente. Se continuar, relate o problema em Ajuda.', 'err', { title:'Não foi possível concluir a ação' }); }
    finally {
      running = false;
      if(btn && 'disabled' in btn && document.contains(btn)){
        btn.disabled = false; btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy');
      }
    }
  };
}
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
   MIGRATION V3 → V4 — acrescenta campos, nunca reescreve revisões.
   Idempotente: roda uma vez e marca a conclusão em `meta`.
   ========================================================================= */

/**
 * Deduz em que ponto de um ciclo um tópico da v3 estaria, a partir do
 * intervalo que ele já tinha. Isso NÃO muda a próxima data de revisão —
 * serve apenas para que, se o usuário passar a usar ciclo programado,
 * ele continue de onde está em vez de voltar ao começo.
 */
function inferCycleStep(intervalDays, strategy){
  const steps = CYCLE_STEPS[strategy] || CYCLE_STEPS.fixed;
  if(!isNum(intervalDays) || intervalDays <= 0) return 0;
  let best = 0;
  for(let i = 0; i < steps.length; i++) if(steps[i] <= intervalDays) best = i;
  return best;
}

/** Acrescenta os campos v4 a uma disciplina, preservando tudo o que existe. */
function upgradeDisciplineToV4(d){
  if(!CONTENT_NATURES.some(n => n.v === d.contentNature)) d.contentNature = 'mixed';
  if(!['inherit'].concat(REVIEW_STRATEGIES.map(x => x.v)).includes(d.reviewStrategy)) d.reviewStrategy = 'inherit';
  if(!['inherit'].concat(REVIEW_METHODS.map(x => x.v)).includes(d.preferredReviewMethod)) d.preferredReviewMethod = 'inherit';
  return d;
}

/** Acrescenta os campos v4 a um tópico. A agenda de revisão fica intacta. */
function upgradeTopicToV4(t){
  if(!TOPIC_IMPORTANCES.some(i => i.v === t.importance)) t.importance = 'normal';
  if(!['inherit'].concat(REVIEW_STRATEGIES.map(x => x.v)).includes(t.reviewStrategy)) t.reviewStrategy = 'inherit';
  if(!['inherit'].concat(REVIEW_METHODS.map(x => x.v)).includes(t.preferredReviewMethod)) t.preferredReviewMethod = 'inherit';
  if(!isNum(t.reviewCycleStep)) t.reviewCycleStep = inferCycleStep(t.reviewIntervalDays, 'fixed');
  if(!isNum(t.reviewFailures)) t.reviewFailures = 0;
  if(!REVIEW_OUTCOMES.some(o => o.v === t.lastReviewOutcome)) t.lastReviewOutcome = t.lastReviewOutcome || null;
  // reviewDueDate, reviewIntervalDays, masteryLevel, lastReviewedAt e
  // reviewRepetitions NÃO são tocados: a revisão continua de onde estava.
  return t;
}

function upgradeSessionToV4(x){
  if(!REVIEW_METHODS.some(m => m.v === x.reviewMethod)) x.reviewMethod = x.reviewMethod || null;
  if(!REVIEW_STRATEGIES.some(st => st.v === x.reviewStrategyAtTime)) x.reviewStrategyAtTime = x.reviewStrategyAtTime || null;
  return x;
}

/**
 * Executa a migração v3→v4 uma única vez. Só grava o que mudou.
 * Nenhuma sessão, tópico, plano ou prazo é apagado ou reagendado.
 */
async function runV4Migration(){
  const done = await DB.get('meta', 'v4MigrationCompleted');
  if(done && done.value) return { migrated:false, reason:'already' };

  const [disciplines, topics, sessions] = await Promise.all([
    DB.getAll('disciplines'), DB.getAll('topics'), DB.getAll('sessions')
  ]);

  const changedD = [], changedT = [], changedS = [];
  (disciplines || []).forEach(d => { const b = JSON.stringify(d); upgradeDisciplineToV4(d); if(JSON.stringify(d) !== b) changedD.push(d); });
  (topics || []).forEach(t => { const b = JSON.stringify(t); upgradeTopicToV4(t); if(JSON.stringify(t) !== b) changedT.push(t); });
  (sessions || []).forEach(x => { const b = JSON.stringify(x); upgradeSessionToV4(x); if(JSON.stringify(x) !== b) changedS.push(x); });

  const stores = ['meta'];
  if(changedD.length) stores.push('disciplines');
  if(changedT.length) stores.push('topics');
  if(changedS.length) stores.push('sessions');

  await DB.transactional(stores, api => {
    changedD.forEach(d => api.put('disciplines', d));
    changedT.forEach(t => api.put('topics', t));
    changedS.forEach(x => api.put('sessions', x));
    api.put('meta', { key:'v4MigrationCompleted', value:true });
    api.put('meta', { key:'v4MigrationDate', value: nowISO() });
    api.put('meta', { key:'v4MigrationSummary', value:{
      disciplines: changedD.length, topics: changedT.length, sessions: changedS.length
    }});
  });

  return { migrated:true, counts:{ disciplines:changedD.length, topics:changedT.length, sessions:changedS.length } };
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
    /* v4 — tudo opcional, com padrões que funcionam sem configuração */
    contentNature: 'mixed',
    reviewStrategy: 'inherit',      // herda da configuração global
    preferredReviewMethod: 'inherit',
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
    /* v4 */
    importance:'normal',
    reviewStrategy:'inherit',        // herda da disciplina
    preferredReviewMethod:'inherit', // herda da disciplina
    reviewCycleStep:0,               // posição dentro do ciclo, quando a estratégia usa ciclo
    reviewFailures:0,                // quantas vezes o resultado foi "esqueci"
    lastReviewOutcome:null,
    createdAt:ts, updatedAt:ts
  };
}
function newSession(data){
  const ts = nowISO();
  return Object.assign({
    id:uid(), disciplineId:null, topicId:null, legacyTopicText:'',
    date: todayISO(), startedAt:null, endedAt:null,
    minutes:0, credits:0, type:null, difficulty:null, comment:'', reviewOutcome:null,
    /* v4 — guarda o contexto da revisão para as análises continuarem legíveis
       mesmo se o usuário trocar a estratégia depois */
    reviewMethod:null, reviewStrategyAtTime:null,
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
/* =========================================================================
   REVIEW ENGINE v2 — separa claramente duas perguntas:
     QUANDO revisar → estratégia (adaptive | fixed | intensive | maintenance)
     COMO revisar   → método (recordação ativa, exercícios, explicação…)

   Herança de configuração: global → disciplina → tópico.
   Quem estiver como 'inherit' usa o nível acima.
   ========================================================================= */
const ReviewEngine = {

  /* ---------- herança ---------- */

  /** Estratégia efetiva de um tópico, resolvendo a cadeia de herança. */
  effectiveStrategy(topic){
    if(topic && topic.reviewStrategy && topic.reviewStrategy !== 'inherit') return topic.reviewStrategy;
    const d = topic ? getDiscipline(topic.disciplineId) : null;
    if(d && d.reviewStrategy && d.reviewStrategy !== 'inherit') return d.reviewStrategy;
    return state.settings.defaultReviewStrategy || 'adaptive';
  },

  /** De onde veio a estratégia efetiva — usado para explicar ao usuário. */
  strategySource(topic){
    if(topic && topic.reviewStrategy && topic.reviewStrategy !== 'inherit') return 'topic';
    const d = topic ? getDiscipline(topic.disciplineId) : null;
    if(d && d.reviewStrategy && d.reviewStrategy !== 'inherit') return 'discipline';
    return 'global';
  },

  /** Método configurado (pode ser 'auto'), resolvendo a herança. */
  configuredMethod(topic){
    if(topic && topic.preferredReviewMethod && topic.preferredReviewMethod !== 'inherit') return topic.preferredReviewMethod;
    const d = topic ? getDiscipline(topic.disciplineId) : null;
    if(d && d.preferredReviewMethod && d.preferredReviewMethod !== 'inherit') return d.preferredReviewMethod;
    return state.settings.defaultReviewMethod || 'auto';
  },

  /**
   * Método efetivo + motivo. Quando está em 'auto', escolhe pela natureza do
   * conteúdo da disciplina; se o último resultado foi ruim, prefere um método
   * mais exigente de recuperação.
   */
  effectiveMethod(topic){
    const configured = this.configuredMethod(topic);
    if(configured !== 'auto') {
      return { method: configured, auto:false, reason:'Você escolheu este método para este conteúdo.' };
    }
    const d = topic ? getDiscipline(topic.disciplineId) : null;
    const nature = (d && d.contentNature) || 'mixed';
    const options = AUTO_METHOD_BY_NATURE[nature] || AUTO_METHOD_BY_NATURE.mixed;

    let pick = options[0];
    let reason = `Sugerido porque a disciplina está marcada como "${contentNatureLabel(nature)}".`;

    // Alternar entre as opções da natureza evita repetir sempre o mesmo método.
    if(options.length > 1 && topic && (topic.reviewRepetitions || 0) % 2 === 1){
      pick = options[1];
      reason = `Sugerido para variar a forma de revisar dentro de "${contentNatureLabel(nature)}".`;
    }
    // Depois de esquecer, recuperação ativa costuma ser o retorno mais seguro.
    if(topic && topic.lastReviewOutcome === 'forgot'){
      pick = 'active_recall';
      reason = 'Sugerido porque na última revisão você esqueceu boa parte do conteúdo.';
    }
    return { method: pick, auto:true, reason };
  },

  methodGuide(method){ return REVIEW_METHOD_GUIDES[method] || REVIEW_METHOD_GUIDES.active_recall; },

  /** Minutos estimados para revisar um tópico com determinado método. */
  estimateMinutes(topic, method){
    const base = METHOD_MINUTES[method] || state.settings.defaultReviewMinutes || 15;
    const imp = topic ? importanceWeight(topic.importance) : 1;
    // importância alta merece um pouco mais de tempo, mas sem distorcer a conta
    const factor = imp >= 1.5 ? 1.2 : imp <= 0.6 ? 0.8 : 1;
    return Math.max(5, Math.round((base * factor) / 5) * 5);
  },

  /* ---------- agendamento ---------- */

  /** Primeiro estudo de um tópico: agenda a primeira revisão para o dia seguinte. */
  scheduleFirstReview(topic, dateISO){
    if(!topic.reviewEnabled) return topic;
    if(topic.reviewDueDate || topic.firstStudiedAt) return topic;   // já agendado: não mexe
    const strategy = this.effectiveStrategy(topic);
    const steps = CYCLE_STEPS[strategy];
    const firstInterval = steps ? steps[0] : 1;
    topic.firstStudiedAt = dateISO;
    topic.reviewIntervalDays = firstInterval;
    topic.reviewDueDate = addDaysISO(dateISO, firstInterval);
    topic.masteryLevel = REVIEW_INITIAL_MASTERY;
    topic.consecutiveSuccessfulReviews = 0;
    topic.reviewRepetitions = 0;
    topic.reviewCycleStep = 0;
    topic.updatedAt = nowISO();
    return topic;
  },

  /**
   * Aplica o resultado de uma revisão. Cada estratégia decide o próximo
   * intervalo; domínio e sequência de acertos seguem a mesma regra em todas.
   */
  applyReviewOutcome(topic, outcome, dateISO, methodUsed){
    const rule = REVIEW[outcome];
    if(!rule) return topic;
    const on = dateISO || todayISO();
    const strategy = this.effectiveStrategy(topic);
    const prev = topic.reviewIntervalDays || 1;

    let interval;
    if(strategy === 'adaptive'){
      // evolução direta da v3: multiplicador com piso por resultado
      interval = rule.mult === 0 ? rule.floor : Math.max(rule.floor, Math.round(prev * rule.mult));
    } else {
      // ciclos programados: o resultado move o passo dentro do ciclo
      const steps = CYCLE_STEPS[strategy] || CYCLE_STEPS.fixed;
      let step = clamp(isNum(topic.reviewCycleStep) ? topic.reviewCycleStep : 0, 0, steps.length - 1);
      if(outcome === 'forgot') step = 0;                       // recomeça o ciclo
      else if(outcome === 'hard') step = Math.max(0, step);     // repete o passo atual
      else if(outcome === 'remembered') step = Math.min(steps.length - 1, step + 1);
      else if(outcome === 'mastered') step = Math.min(steps.length - 1, step + 2);
      topic.reviewCycleStep = step;
      interval = steps[step];
    }
    interval = clamp(interval, 1, REVIEW_MAX_INTERVAL);

    let mastery = topic.masteryLevel || REVIEW_INITIAL_MASTERY;
    mastery = (rule.mastery === 'max') ? 5 : clamp(mastery + rule.mastery, 1, 5);

    topic.reviewIntervalDays = interval;
    topic.masteryLevel = mastery;
    topic.consecutiveSuccessfulReviews = rule.resetStreak ? 0 : (topic.consecutiveSuccessfulReviews || 0) + 1;
    topic.reviewRepetitions = (topic.reviewRepetitions || 0) + 1;
    topic.lastReviewedAt = on;
    topic.lastReviewOutcome = outcome;
    if(outcome === 'forgot') topic.reviewFailures = (topic.reviewFailures || 0) + 1;
    topic.reviewDueDate = addDaysISO(on, interval);
    topic.lastStudiedAt = on;
    if(methodUsed && CONCRETE_METHODS.includes(methodUsed)) topic.lastReviewMethod = methodUsed;
    topic.updatedAt = nowISO();
    return topic;
  },

  /**
   * Revisão intensiva volta sozinha ao normal quando o prazo que a justificava
   * já passou — o usuário é avisado, nada é alterado em silêncio.
   */
  intensiveExpired(topic){
    if(this.effectiveStrategy(topic) !== 'intensive') return false;
    const d = getDiscipline(topic.disciplineId);
    if(!d) return false;
    const future = state.deadlines.some(dl => !dl.completed && dl.disciplineId === d.id && (daysUntilISO(dl.date) || 0) >= 0);
    return !future;
  },

  /* ---------- consultas ---------- */

  /** Tópicos elegíveis a revisão (ativos, com revisão ligada e já agendados). */
  allScheduled(){
    return state.topics.filter(t => {
      if(t.archived || !t.reviewEnabled || !t.reviewDueDate) return false;
      const d = getDiscipline(t.disciplineId);
      return d && !d.archived;
    });
  },

  getDueReviews(refISO){
    const ref = refISO || todayISO();
    return this.allScheduled()
      .filter(t => t.reviewDueDate <= ref)
      .sort((a,b) => a.reviewDueDate.localeCompare(b.reviewDueDate) || sortByName(a,b));
  },

  getUpcomingReviews(days){
    const from = addDaysISO(todayISO(), 1);
    const to = addDaysISO(todayISO(), days || 7);
    return this.allScheduled()
      .filter(t => t.reviewDueDate >= from && t.reviewDueDate <= to)
      .sort((a,b) => a.reviewDueDate.localeCompare(b.reviewDueDate) || sortByName(a,b));
  },

  dueCountFor(disciplineId){ return this.getDueReviews().filter(t => t.disciplineId === disciplineId).length; },
  maxOverdueDaysFor(disciplineId){
    const due = this.getDueReviews().filter(t => t.disciplineId === disciplineId);
    if(!due.length) return 0;
    return Math.max(...due.map(t => Math.max(0, -(daysUntilISO(t.reviewDueDate) || 0))));
  },
  calculateTopicStatus(topic){ return topicStatus(topic); },

  /* ---------- fila inteligente ---------- */

  /**
   * Pontua uma revisão pendente. O número nunca aparece na interface:
   * o usuário vê apenas os motivos em texto.
   */
  scoreDue(topic){
    const W = REVIEW_QUEUE_WEIGHTS;
    const daysLate = -(daysUntilISO(topic.reviewDueDate) || 0);   // >0 = atrasada
    const reasons = [];
    let score = 0;

    if(daysLate > 0){
      score += W.OVERDUE_BASE + Math.min(daysLate, W.OVERDUE_DAY_CAP) * W.OVERDUE_PER_DAY;
      reasons.push(`atrasada há ${daysLate} ${daysLate === 1 ? 'dia' : 'dias'}`);
    } else if(daysLate === 0){
      score += W.DUE_TODAY;
      reasons.push('prevista para hoje');
    }

    const impW = importanceWeight(topic.importance);
    score += W.IMPORTANCE * (impW - 1);
    if(topic.importance === 'high') reasons.push('importância alta');

    const mastery = topic.masteryLevel || REVIEW_INITIAL_MASTERY;
    if(mastery <= 2){ score += W.LOW_MASTERY * ((3 - mastery) / 2); reasons.push(`domínio ${mastery}/5`); }

    if(topic.lastReviewOutcome === 'forgot'){ score += W.BAD_LAST_RESULT; reasons.push('você esqueceu na última revisão'); }
    else if(topic.lastReviewOutcome === 'hard'){ score += W.BAD_LAST_RESULT * 0.6; reasons.push('você teve dificuldade na última revisão'); }

    const fails = topic.reviewFailures || 0;
    if(fails >= 2){ score += Math.min(W.FORGET_RATE, fails * 3); reasons.push(`já esqueceu ${fails} vezes`); }

    const dl = state.deadlines
      .filter(x => !x.completed && x.disciplineId === topic.disciplineId)
      .map(x => ({ x, days: daysUntilISO(x.date) }))
      .filter(x => x.days !== null && x.days >= 0)
      .sort((a,b) => a.days - b.days)[0];
    if(dl && dl.days <= 30){
      score += W.DEADLINE * (1 - dl.days / 30);
      if(dl.days <= 14) reasons.push(`${dl.x.title} em ${dl.days} ${dl.days === 1 ? 'dia' : 'dias'}`);
    }

    const since = topic.lastReviewedAt ? daysSinceISO(topic.lastReviewedAt) : daysSinceISO(topic.firstStudiedAt);
    if(since !== null && since > 30){ score += W.STALE; reasons.push('sem revisar há mais de um mês'); }

    if(!reasons.length) reasons.push('na fila de revisão');
    return { topic, score, daysLate, reasons };
  },

  /** Fila ordenada por relevância, não apenas por data. */
  rankedQueue(){
    return this.getDueReviews().map(t => this.scoreDue(t))
      .sort((a,b) => b.score - a.score || a.topic.reviewDueDate.localeCompare(b.topic.reviewDueDate));
  },

  /**
   * Monta uma sessão de revisão que cabe no tempo informado.
   * Pega os itens mais relevantes enquanto o tempo estimado couber;
   * garante pelo menos um item para a sessão nunca vir vazia.
   */
  buildSession(availableMinutes){
    const budget = Math.max(5, Math.round(Number(availableMinutes) || 20));
    const ranked = this.rankedQueue();
    const picked = [];
    let used = 0;
    for(const entry of ranked){
      const em = this.effectiveMethod(entry.topic);
      const minutes = this.estimateMinutes(entry.topic, em.method);
      if(used + minutes > budget && picked.length) continue;   // tenta o próximo, menor
      picked.push({ ...entry, method: em.method, methodAuto: em.auto, methodReason: em.reason, minutes });
      used += minutes;
      if(used >= budget) break;
    }
    return { items: picked, totalMinutes: used, budget, remaining: Math.max(0, ranked.length - picked.length) };
  }
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

    // uso e resultado por método — só descritivo, nunca causal
    const methodMap = new Map();
    done.filter(x => x.reviewMethod).forEach(x => {
      if(!methodMap.has(x.reviewMethod)) methodMap.set(x.reviewMethod, { used:0, good:0 });
      const m = methodMap.get(x.reviewMethod);
      m.used++;
      if(x.reviewOutcome === 'remembered' || x.reviewOutcome === 'mastered') m.good++;
    });
    const byMethod = Array.from(methodMap.entries())
      .map(([k,v]) => ({ method:k, label:methodLabel(k), used:v.used, good:v.good,
                         rate: v.used ? (v.good / v.used) * 100 : null }))
      .sort((a,b) => b.used - a.used);

    // tópicos que você mais esquece
    const forgetful = state.topics
      .filter(t => !t.archived && (t.reviewFailures || 0) >= 2)
      .filter(t => { const d = getDiscipline(t.disciplineId); return d && !d.archived; })
      .sort((a,b) => (b.reviewFailures || 0) - (a.reviewFailures || 0))
      .slice(0, 5);

    const scheduledTopics = ReviewEngine.allScheduled();
    const avgMastery = scheduledTopics.length
      ? sum(scheduledTopics.filter(t => t.masteryLevel), t => t.masteryLevel) / Math.max(1, scheduledTopics.filter(t => t.masteryLevel).length)
      : null;
    const expected = scheduledInRange + done.length;
    return {
      completed: done.length, scheduled: scheduledInRange, expected,
      rate: expected > 0 ? (done.length / expected) * 100 : null,
      overdueNow, dueToday, outcomes, minutes: sum(done, s => s.minutes),
      byMethod, forgetful, avgMastery
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
    if(a.reviews.forgetful && a.reviews.forgetful.length){
      const f = a.reviews.forgetful[0];
      out.push(`${f.name} já foi esquecido ${f.reviewFailures} vezes nas revisões.`);
    }
    if(a.reviews.avgMastery !== null && a.reviews.avgMastery < 2.5){
      out.push(`O domínio médio dos tópicos em revisão está em ${fmtNumber(a.reviews.avgMastery,1)}/5.`);
    }
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
        presetMethod: CONCRETE_METHODS.includes(d.presetMethod) ? d.presetMethod : null,
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
  start(disciplineId, topicId, presetType, presetMethod){
    this.data = { disciplineId, topicId: topicId || null, presetType: presetType || null,
                  presetMethod: presetMethod || null,
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
      app: 'ciclo',                 // só informativo: a importação não depende deste campo
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
    this.download(`ciclo_backup_${todayISO()}.json`, JSON.stringify(this.buildExport(), null, 2), 'application/json');
    await setMeta('lastBackupAt', nowISO());
  },

  exportCSV(){
    const head = ['data','area','disciplina','topico','tipo','dificuldade','minutos','creditos','resultado_revisao','metodo_revisao','comentario'];
    const esc = v => '"' + str(v).replace(/"/g,'""') + '"';
    const rows = state.sessions.slice().sort((a,b) => a.date.localeCompare(b.date)).map(s => {
      const d = getDiscipline(s.disciplineId);
      const diff = difficultyInfo(s.difficulty);
      return [
        s.date, d ? areaNameOf(d) : '', d ? d.name : '', topicLabelOf(s),
        s.type ? sessionTypeLabel(s.type) : '', diff ? diff.label : '',
        s.minutes, s.credits, reviewOutcomeLabel(s.reviewOutcome) || '',
        s.reviewMethod ? methodLabel(s.reviewMethod) : '', s.comment
      ].map(esc).join(',');
    });
    this.download(`ciclo_sessoes_${todayISO()}.csv`, [head.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
  },

  /** Detecta o formato do arquivo e normaliza para entidades V3. Nunca executa conteúdo. */
  parseBackup(text){
    let raw;
    try { raw = JSON.parse(text); }
    catch(_){ throw new Error('Arquivo inválido: não é um JSON legível.'); }
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Arquivo inválido: estrutura inesperada.');

    const isV3 = Number(raw.schemaVersion) >= 3 || Array.isArray(raw.disciplines);  // cobre v3 e v4
    const isV2 = !isV3 && (Array.isArray(raw.subjects) || Array.isArray(raw.logs));
    if(!isV3 && !isV2) throw new Error('Arquivo inválido: não parece um backup do Ciclo.');

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
      contentNature: CONTENT_NATURES.some(n => n.v === d.contentNature) ? d.contentNature : 'mixed',
      reviewStrategy: ['inherit'].concat(REVIEW_STRATEGIES.map(x => x.v)).includes(d.reviewStrategy) ? d.reviewStrategy : 'inherit',
      preferredReviewMethod: ['inherit'].concat(REVIEW_METHODS.map(x => x.v)).includes(d.preferredReviewMethod) ? d.preferredReviewMethod : 'inherit',
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
      importance: TOPIC_IMPORTANCES.some(i => i.v === t.importance) ? t.importance : 'normal',
      reviewStrategy: ['inherit'].concat(REVIEW_STRATEGIES.map(x => x.v)).includes(t.reviewStrategy) ? t.reviewStrategy : 'inherit',
      preferredReviewMethod: ['inherit'].concat(REVIEW_METHODS.map(x => x.v)).includes(t.preferredReviewMethod) ? t.preferredReviewMethod : 'inherit',
      reviewCycleStep: isNum(t.reviewCycleStep) ? clamp(t.reviewCycleStep, 0, 10) : 0,
      reviewFailures: isNum(t.reviewFailures) ? Math.max(0, t.reviewFailures) : 0,
      lastReviewOutcome: REVIEW_OUTCOMES.some(o => o.v === t.lastReviewOutcome) ? t.lastReviewOutcome : null,
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
      reviewMethod: REVIEW_METHODS.some(m => m.v === s.reviewMethod) ? s.reviewMethod : null,
      reviewStrategyAtTime: REVIEW_STRATEGIES.some(x => x.v === s.reviewStrategyAtTime) ? s.reviewStrategyAtTime : null,
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
  // Instalações anteriores não têm os campos da v3.1: todos recebem defaults seguros.
  return {
    theme: ['light','dark','system'].includes(src.theme) ? src.theme : 'dark',
    density: (src.density === 'compact') ? 'compact' : 'comfortable',
    startView: ['today','plan','analytics'].includes(src.startView) ? src.startView : 'today',
    helpMode: ['full','discreet','off'].includes(src.helpMode) ? src.helpMode : 'full',
    hoverHints: src.hoverHints !== false,
    showUpcomingReviews: src.showUpcomingReviews !== false,
    seenTips: Array.isArray(src.seenTips) ? src.seenTips.filter(x => typeof x === 'string').slice(0, 50) : [],
    weekStart: (src.weekStart === 'sunday') ? 'sunday' : 'monday',
    defaultSessionMinutes: clamp(Math.round(Number(src.defaultSessionMinutes) || DEFAULT_SETTINGS.defaultSessionMinutes), 5, 600),
    defaultReviewMinutes: clamp(Math.round(Number(src.defaultReviewMinutes) || DEFAULT_SETTINGS.defaultReviewMinutes), 5, 600),
    autoReviewNewTopics: src.autoReviewNewTopics !== false,
    reduceMotion: !!src.reduceMotion,
    defaultPeriod: ['hoje','7d','30d','semana','mes','tudo'].includes(src.defaultPeriod) ? src.defaultPeriod : DEFAULT_SETTINGS.defaultPeriod,
    /* v4 — instalações anteriores recebem defaults seguros */
    defaultReviewStrategy: REVIEW_STRATEGIES.some(x => x.v === src.defaultReviewStrategy) ? src.defaultReviewStrategy : 'adaptive',
    defaultReviewMethod: REVIEW_METHODS.some(x => x.v === src.defaultReviewMethod) ? src.defaultReviewMethod : 'auto',
    showDailyQuote: src.showDailyQuote !== false,
    seenWhatsNew: typeof src.seenWhatsNew === 'string' ? src.seenWhatsNew : null
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
  weekOffset: 0,              // navegação de semanas no relatório semanal
  planExpanded: false,        // v5: true quando o usuário pediu os controles detalhados
  reviewQueue: null,          // v4: itens restantes da sessão de revisão montada
  helpDoor: 'start',          // v5: 'start' | 'use' | 'learn' | 'faq'
  prevView: null              // v5.1: tela anterior (contexto do relato de problema)
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
/**
 * Grava as preferências.
 *
 * Dois cuidados que a v3 não tinha e que causavam o bug de tema:
 *
 * 1. A identidade de `state.settings` é PRESERVADA. Antes, sanitizeSettings
 *    devolvia um objeto novo e `state.settings` era substituído — qualquer
 *    closure que tivesse capturado `state.settings` (como renderSettings)
 *    passava a escrever num objeto órfão, e a alteração se perdia.
 * 2. As gravações são serializadas numa fila. Cliques rápidos não disputam
 *    transações do IndexedDB; vence sempre o estado mais recente.
 */
let settingsWriteChain = Promise.resolve();

function applySettingsEffects(){
  applyTheme(state.settings.theme);
  applyDensity(state.settings.density);
  applyReduceMotion(state.settings.reduceMotion);
}

function saveSettings(){
  // sanitiza mutando em conteúdo, nunca trocando a referência
  const clean = sanitizeSettings(state.settings);
  Object.keys(state.settings).forEach(k => { if(!(k in clean)) delete state.settings[k]; });
  Object.assign(state.settings, clean);

  applySettingsEffects();   // efeito visual imediato, sem esperar o banco

  settingsWriteChain = settingsWriteChain.then(async () => {
    // sempre grava o estado ATUAL: a última alteração vence
    try { await DB.put('settings', { key:'settings', value: JSON.parse(JSON.stringify(state.settings)) }); }
    catch(err){ console.error('Falha ao salvar as configurações:', err); toast('Não foi possível salvar as configurações.', 'err'); }
  });
  return settingsWriteChain;
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
/* Toasts — hierarquia: ok (sucesso) · info · warn (atenção) · err (erro).
   Ícone + título opcional + texto + barra de acento. Nunca bloqueiam nada. */
const TOAST_MAX = 3;
const TOAST_KINDS = {
  ok:   { icon:'i-check', label:'Concluído' },
  info: { icon:'i-info',  label:'Aviso' },
  warn: { icon:'i-alert', label:'Atenção' },
  err:  { icon:'i-alert', label:'Erro' }
};

function dismissToast(el){
  if(!el || el.dataset.leaving === '1') return;
  el.dataset.leaving = '1';
  el.classList.add('is-leaving');
  // a duração acompanha o CSS; com animações reduzidas o CSS zera a transição
  setTimeout(() => el.remove(), prefersReducedMotion() ? 0 : 200);
}

function mountToast(el, duration){
  const box = $('#toasts');
  if(!box) return;
  box.appendChild(el);
  while(box.children.length > TOAST_MAX) box.removeChild(box.firstChild);
  let timer = setTimeout(() => dismissToast(el), duration);
  // passar o mouse segura o aviso na tela; sair reinicia uma contagem curta
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { clearTimeout(timer); timer = setTimeout(() => dismissToast(el), 1800); });
}

/**
 * toast(mensagem, tipo?, { title?, duration? })
 * tipo: 'ok' | 'info' | 'warn' | 'err' (sem tipo = 'info').
 */
function toast(message, kind, opts){
  const o = opts || {};
  const k = TOAST_KINDS[kind] ? kind : 'info';
  const el = h('div', { class:'toast ' + k },
    h('span', { class:'t-icon', 'aria-hidden':'true' }, icon(TOAST_KINDS[k].icon)),
    h('div', { class:'t-content' },
      o.title ? h('p', { class:'t-title', text:o.title }) : null,
      message ? h('p', { class:'t-text', text:message }) : null));
  if(k === 'err') el.setAttribute('role', 'alert');
  mountToast(el, o.duration || (k === 'err' || k === 'warn' ? 5200 : 3400));
}

/**
 * Impede que um botão de ação seja acionado duas vezes em sequência
 * (duplo clique, Enter repetido, toque duplo). O primeiro clique passa
 * normalmente; os seguintes são descartados na fase de captura, antes de
 * chegarem ao handler — sem `disabled`, que interromperia o clique em curso.
 */
const MODAL_ACTION_GUARD_MS = 900;
function guardModalActions(container){
  if(!container) return;
  $$('button', container).forEach(btn => {
    if(btn.dataset.guarded === '1') return;
    btn.dataset.guarded = '1';
    btn.addEventListener('click', (e) => {
      if(btn.dataset.busy === '1'){
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      btn.dataset.busy = '1';
      btn.classList.add('is-busy');
      setTimeout(() => {
        btn.dataset.busy = '';
        if(document.contains(btn)) btn.classList.remove('is-busy');
      }, MODAL_ACTION_GUARD_MS);
    }, true);
  });
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
  guardModalActions($('#modal-actions'));
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
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

/** Resolve a preferência ('system' consulta o sistema operacional). */
function resolveTheme(pref){
  if(pref === 'system') return (systemThemeQuery && systemThemeQuery.matches) ? 'light' : 'dark';
  return pref === 'light' ? 'light' : 'dark';
}

/** Aplica o tema RESOLVIDO no documento. Não decide nada: só pinta. */
function applyTheme(preference){
  const t = resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_LS_KEY, t); } catch(_){}   // evita piscar no próximo load
  const id = t === 'dark' ? '#i-sun' : '#i-moon';
  ['#theme-icon','#theme-icon-m'].forEach(sel => { const el = $(sel); if(el) el.setAttribute('href', id); });
}

/**
 * FONTE ÚNICA DE VERDADE do tema. Todo ponto da aplicação passa por aqui.
 * Preferência ('dark' | 'light' | 'system') e tema resolvido ('dark' | 'light')
 * são coisas distintas: a preferência é o que o usuário escolheu; o resolvido
 * é o que aparece na tela.
 */
function setThemePreference(preference){
  const pref = ['dark','light','system'].includes(preference) ? preference : 'dark';
  state.settings.theme = pref;      // 1. estado muda na hora
  applyTheme(pref);                 // 2. visual muda na hora
  syncThemeControls();              // 3. controles refletem na hora
  return saveSettings();            // 4. persistência serializada, last-write-wins
}

/** Mantém o segmented de Configurações coerente com a preferência atual. */
function syncThemeControls(){
  const group = $('#theme-segmented');
  if(!group) return;
  $$('button', group).forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.value === state.settings.theme ? 'true' : 'false');
  });
}

function applyDensity(density){
  document.documentElement.setAttribute('data-density', density === 'compact' ? 'compact' : 'comfortable');
}

/** Alterna manualmente entre claro e escuro (sai de 'system'). */
/** Botão de alternar da barra lateral/mobile: sai de 'system' para uma escolha explícita. */
function toggleTheme(){
  return setThemePreference(resolveTheme(state.settings.theme) === 'dark' ? 'light' : 'dark');
}
function applyReduceMotion(on){ document.documentElement.classList.toggle('reduce-motion', !!on); }

/** Movimento reduzido: configuração interna OU preferência do sistema. */
function prefersReducedMotion(){
  if(state.settings && state.settings.reduceMotion) return true;
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

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
/* v5.1 — memória visual: barras e métricas animam apenas quando o valor
   realmente muda entre duas renderizações (nunca "do zero" a cada tela). */
const UiMemory = { bars:new Map(), stats:new Map() };

function statBox(value, label, delta, key){
  const val = String(value);
  const prev = key ? UiMemory.stats.get(key) : undefined;
  if(key) UiMemory.stats.set(key, val);
  const changed = prev !== undefined && prev !== val && !prefersReducedMotion();
  return h('div', { class:'stat' },
    h('span', { class:'v' + (/\d/.test(val) ? '' : ' is-text') + (changed ? ' is-updated' : ''), text:val }),
    h('span', { class:'l', text:label }),
    delta ? h('span', { class:'d ' + (delta.dir || ''), text:delta.text }) : null);
}

/** Cria o preenchimento de uma barra; com `key`, anima do valor anterior ao novo. */
function barFill(pct, cls, key){
  const target = Math.round(clamp(pct || 0, 0, 100) * 10) / 10;
  const prev = key ? UiMemory.bars.get(key) : undefined;
  if(key) UiMemory.bars.set(key, target);
  const animate = prev !== undefined && prev !== target && !prefersReducedMotion();
  const fill = h('div', { class:'bar-fill' + (cls ? ' ' + cls : ''), style:`width:${animate ? prev : target}%` });
  if(animate) requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = target + '%'; }));
  return fill;
}
function progressBar(pct, cls, key){
  return h('div', { class:'bar' }, barFill(pct, cls, key));
}
/** Primeira letra maiúscula (motivos são gerados em minúsculas pelo motor). */
function capFirst(t){ const x = str(t); return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; }
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
  if(ui.view !== view) ui.prevView = ui.view;
  ui.view = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('#nav-desktop .nav-item').forEach(b => {
    if(b.dataset.view === view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  $$('#nav-mobile .mb-item').forEach(b => {
    if(b.dataset.view === view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  const mt = $('#mobile-title'); if(mt) mt.textContent = VIEW_TITLES[view];
  Tooltip.hide();
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
  // anima só quando a barra aparece; re-renderizações não repetem a entrada
  const isNew = !slot.querySelector('.timerbar');
  const state_ = TimerService.isRunning ? 'running' : 'paused';
  const bar = h('div', { class:'timerbar' + (isNew ? ' is-entering' : ''), role:'region', 'aria-label':'Sessão em andamento', 'data-state': state_ },
    h('span', { class:'tb-status', 'aria-hidden':'true' }),
    h('div', { class:'tb-what' },
      h('div', { class:'tb-label', text: TimerService.isRunning ? 'Em andamento' : 'Pausada' }),
      h('div', { class:'tb-disc', text: disc ? disc.name : '(disciplina removida)' }),
      h('div', { class:'tb-topic', text: (topic ? topic.name : 'Sem tópico') + (d.presetType ? ' · ' + sessionTypeLabel(d.presetType) : '') }
    )),
    clock,
    h('div', { class:'row auto' },
      h('button', { class:'btn ghost sm', type:'button', text: TimerService.isRunning ? 'Pausar' : 'Retomar',
        onclick:() => { TimerService.isRunning ? TimerService.pause() : TimerService.resume(); renderTimerBar(); } }),
      h('button', { class:'btn ghost sm', type:'button', text:'Foco', onclick:() => FocusMode.enter() }),
      h('button', { class:'btn primary sm', type:'button', text:'Finalizar', onclick:openFinishModal }),
      h('button', { class:'linkbtn muted', type:'button', text:'descartar', onclick:discardTimer })
    )
  );
  mount(slot, bar);

  TimerService.startTicking(() => {
    if(!TimerService.isActive){ TimerService.stopTicking(); return; }
    clock.textContent = fmtClock(TimerService.getElapsed());
    clock.classList.toggle('paused', !TimerService.isRunning);
    bar.setAttribute('data-state', TimerService.isRunning ? 'running' : 'paused');
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
function startTimer(disciplineId, topicId, presetType, presetMethod){
  if(TimerService.isActive){
    toast('Já existe uma sessão em andamento. Finalize-a antes de iniciar outra.', 'err');
    return;
  }
  TimerService.start(disciplineId, topicId, presetType, presetMethod);
  renderTimerBar();
  const d = getDiscipline(disciplineId), t = topicId ? getTopic(topicId) : null;
  toast((d ? d.name : '') + (t ? ' · ' + t.name : '') + ' — o tempo já está contando.', 'ok',
    { title: presetType === 'revisao' ? 'Revisão iniciada' : 'Sessão iniciada' });
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
  let method = d.presetMethod || (topic ? ReviewEngine.effectiveMethod(topic).method : null);

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
          h('p', { class:'hint', text:'Isso ajusta o intervalo até a próxima revisão deste tópico.' }),
          h('label', { style:'margin-top:10px', text:'Método usado' }),
          (() => {
            const sel = h('select', { 'aria-label':'Método usado na revisão' });
            CONCRETE_METHODS.forEach(mv => sel.appendChild(h('option', { value:mv, selected: mv === method }, methodLabel(mv))));
            sel.addEventListener('change', () => { method = sel.value; });
            return sel;
          })()
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
            reviewMethod: (type === 'revisao' ? method : null),
            startedAt: new Date(started).toISOString(), endedAt: nowISO()
          });
          // se veio de uma sessão de revisão montada, segue para o próximo item
          if(ui.reviewQueue && ui.reviewQueue.length) setTimeout(runNextQueuedReview, 400);
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
    reviewMethod: input.reviewMethod || null,
    reviewStrategyAtTime: null,
    startedAt: input.startedAt || null,
    endedAt: input.endedAt || null
  });

  let topic = session.topicId ? getTopic(session.topicId) : null;
  let topicCopy = null;
  if(topic){
    topicCopy = Object.assign({}, topic);
    // guarda a estratégia vigente para as análises continuarem legíveis depois
    session.reviewStrategyAtTime = ReviewEngine.effectiveStrategy(topicCopy);
    const isFirst = !topicCopy.firstStudiedAt && !topicCopy.reviewDueDate;
    if(isFirst) ReviewEngine.scheduleFirstReview(topicCopy, session.date);
    if(session.reviewOutcome) ReviewEngine.applyReviewOutcome(topicCopy, session.reviewOutcome, session.date, session.reviewMethod);
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

  const topicName = topicCopy ? topicCopy.name : '';
  const prog = PlannerEngine.getCurrentWeekProgress();
  if(session.reviewOutcome && topicCopy){
    toastRich('Revisão concluída', [
      topicName,
      ['Você respondeu', reviewOutcomeLabel(session.reviewOutcome)],
      ['Volta a aparecer', topicCopy.reviewDueDate ? fmtRelativeFuture(topicCopy.reviewDueDate) : '—'],
      ['Quanto você retém', (topicCopy.masteryLevel || '—') + ' de 5']
    ]);
  } else {
    const rows = [
      disc.name + (topicName ? ' · ' + topicName : ''),
      ['Tempo', fmtDuration(minutes)],
      ['Créditos', fmtNumber(session.credits)]
    ];
    if(prog.plannedTotal > 0) rows.push(['Semana', `${fmtDuration(prog.realizedTotal)} / ${fmtDuration(prog.plannedTotal)}`]);
    if(topicCopy && topicCopy.reviewDueDate) rows.push(['Próxima revisão', fmtRelativeFuture(topicCopy.reviewDueDate)]);
    toastRich('Sessão registrada', rows);
  }
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

  const plan = PlannerEngine.activePlan();
  const prog = PlannerEngine.getCurrentWeekProgress();
  const due = ReviewEngine.getDueReviews();
  const actions = RecommendationEngine.getNextActions(3);
  const todaySessions = state.sessions.filter(s => s.date === todayISO());
  const todayMinutes = sum(todaySessions, s => s.minutes);

  /* Sem nada cadastrado: uma única ação, sem métricas vazias. */
  if(!activeDisciplines().length){
    mount(root,
      h('div', { class:'card hero' },
        h('p', { class:'hero-eyebrow', text:'Para começar' }),
        h('h3', { class:'hero-title', text:'Adicione algo que você estuda' }),
        h('p', { class:'hero-text', text:'Pode ser uma matéria, um idioma, uma certificação ou qualquer outro assunto. Leva alguns segundos.' }),
        h('div', { class:'row auto', style:'margin-top:14px' },
          h('button', { class:'btn primary lg', type:'button', text:'Adicionar o que estou estudando',
            onclick:() => openDisciplineModal(null) }),
          h('button', { class:'linkbtn', type:'button', text:'Como isso funciona?',
            onclick:() => openInteractiveGuide('ig-disciplina') }))),
      dailyQuoteCard());
    return;
  }

  /* Tem disciplina, mas nenhuma sessão: a ação principal é estudar. */
  if(!state.sessions.length){
    const guide0 = startGuideCard();
    mount(root,
      h('div', { class:'card hero' },
        h('p', { class:'hero-eyebrow', text:'O que você quer fazer agora?' }),
        h('h3', { class:'hero-title', text:'Começar a estudar' }),
        h('p', { class:'hero-text', text:'Escolha o que vai estudar e quanto tempo. O Ciclo conta o tempo e registra tudo para você.' }),
        h('div', { class:'row auto', style:'margin-top:14px' },
          h('button', { class:'btn primary lg', type:'button', onclick:() => openQuickStart() },
            icon('i-play'), 'Começar'),
          h('button', { class:'linkbtn', type:'button', text:'O que é uma sessão?',
            onclick:() => openInteractiveGuide('ig-sessao') }))),
      guide0,
      dailyQuoteCard());
    return;
  }

  /* v5.1 — hierarquia: próxima ação → revisões → progresso → guia →
     dados secundários → frase do dia. No desktop largo vira duas colunas. */
  const main = [], side = [];

  /* --- 1. próxima melhor ação --- */
  const top = actions[0];
  if(top) main.push(nextActionCard(top));

  /* --- 2. revisões --- */
  const overdueAny = due.some(t => (daysUntilISO(t.reviewDueDate) || 0) < 0);
  const revCard = h('div', { class:'card reviews-card' });
  revCard.append(h('div', { class:'card-head' },
    h('p', { class:'card-title', style:'margin:0' }, 'Revisões', helpDot('revisao')),
    due.length
      ? h('span', { class:'pill ' + (overdueAny ? 'danger' : 'brass'), text: due.length + (due.length === 1 ? ' pendente' : ' pendentes') })
      : h('span', { class:'pill teal', text:'em dia' })));
  if(!due.length){
    revCard.append(h('p', { class:'hint', text: state.topics.some(t => t.reviewDueDate)
      ? 'Nenhuma revisão pendente hoje. A fila está em dia.'
      : 'Quando você estudar um assunto, ele entra automaticamente no ciclo de revisão.' }));
  } else {
    revCard.append(h('p', { class:'rev-lead', text: due.length === 1
      ? 'Você tem 1 revisão para hoje.'
      : `Você tem ${due.length} revisões para hoje.` + (due.length > 3 ? ' Comece pelas primeiras.' : '') }));
    due.slice(0,3).forEach(t => revCard.append(reviewItem(t)));
    revCard.append(h('div', { class:'row auto', style:'margin-top:12px' },
      due.length > 1 ? h('button', { class:'btn ghost sm', type:'button', onclick:openSessionBuilder }, icon('i-review'), 'Montar sessão de revisão') : null,
      due.length > 3 ? h('button', { class:'linkbtn', type:'button', text:`ver todas as ${due.length}`, onclick:() => setView('reviews') }) : null));
  }
  if(state.settings.showUpcomingReviews){
    const soon = ReviewEngine.getUpcomingReviews(3);
    if(soon.length){
      revCard.append(h('p', { class:'hint', style:'margin-top:12px',
        text:`Próximos dias: ${soon.slice(0,3).map(t => t.name).join(', ')}${soon.length > 3 ? ` e mais ${soon.length - 3}` : ''}.` }));
    }
  }
  const rh = reviewHints();
  if(rh.length) revCard.append(hintBox(rh));
  main.push(revCard);

  /* --- 3. progresso da semana --- */
  if(plan && prog.plannedTotal > 0){
    const pct = clamp(prog.pct || 0, 0, 999);
    side.push(h('div', { class:'card today-progress' },
      h('div', { class:'top' },
        h('div', null,
          h('p', { class:'card-title', text:'Progresso da semana', style:'margin:0 0 6px' }),
          h('span', { class:'big num', text: fmtDuration(prog.realizedTotal) }),
          h('span', { class:'of num', text:' / ' + fmtDuration(prog.plannedTotal) })),
        h('span', { class:'pct num' + (pct >= 100 ? ' done' : ''), text: fmtPct(pct) })),
      barWithTip(pct, pct >= 100 ? 'done' : null, 'Semana', [
        ['Planejado', fmtDuration(prog.plannedTotal)],
        ['Realizado', fmtDuration(prog.realizedTotal)],
        ['Restante', fmtDuration(prog.remainingTotal)],
        ['Plano cumprido', fmtPct(pct)]
      ], 'today-week'),
      h('p', { class:'hint', text: prog.remainingTotal > 0
        ? `Faltam ${fmtDuration(prog.remainingTotal)} para fechar o plano desta semana.`
        : 'Plano semanal concluído. O que vier agora é bônus.' })));
  } else {
    side.push(h('div', { class:'card plan-nudge' },
      h('p', { class:'card-title', text:'Organizar a semana' }),
      h('p', { class:'hint', style:'margin-bottom:12px', text:'Diga quanto tempo você tem por semana e o Ciclo mostra quanto falta e o que estudar primeiro. É opcional.' }),
      h('button', { class:'btn ghost sm', type:'button', onclick:() => setView('plan') }, icon('i-plan'), 'Definir tempo semanal')));
  }

  /* --- 4. guia inicial --- */
  const startGuide = startGuideCard();
  if(startGuide) side.push(startGuide);

  /* --- 5. alternativas e resumo --- */
  if(actions.length > 1){
    side.push(card('Outras opções agora',
      h('ul', { class:'alt-list' }, actions.slice(1).map((a, i) => h('li', null,
        h('span', { class:'ord num', text:String(i + 2) }),
        h('span', { class:'alt-main' },
          h('div', { class:'alt-name', text: a.discipline.name + (a.topic ? ' — ' + a.topic.name : '') }),
          h('div', { class:'alt-sub', text: capFirst(a.reasons[0]) })),
        h('button', { class:'btn ghost sm', type:'button', text:'Iniciar', 'aria-label':'Iniciar ' + a.discipline.name,
          onclick:() => startTimer(a.discipline.id, a.topic ? a.topic.id : null, a.suggestedType) })
      )))
    ));
  }

  const doneWeek = sessionsInRange({ start: startOfWeek(today()), end: endOfWeek(today()) })
    .filter(x => x.type === 'revisao' || x.reviewOutcome).length;
  side.push(card('Resumo',
    h('div', { class:'stat-grid compact' },
      statBox(fmtDuration(todayMinutes), 'estudado hoje', null, 'today-min'),
      statBox(fmtDuration(prog.realizedTotal), 'nesta semana', null, 'today-week-min'),
      statBox(prog.plannedTotal > 0 ? fmtPct(clamp(prog.pct || 0, 0, 999)) : '—', 'do plano semanal', null, 'today-pct'),
      statBox(String(doneWeek), 'revisões na semana', null, 'today-rev-week')
    ),
    h('div', { style:'margin-top:12px' },
      h('button', { class:'linkbtn', type:'button', text:'Ver análises completas', onclick:() => setView('analytics') }))
  ));

  /* --- 6. frase do dia --- */
  const quote = dailyQuoteCard();
  if(quote) side.push(quote);

  mount(root, h('div', { class:'screen-layout today-layout' },
    h('div', { class:'stack layout-main' }, main),
    h('div', { class:'stack layout-side' }, side)));
}

/** Card da próxima melhor ação: disciplina, assunto, tempo, motivo e um CTA. */
function nextActionCard(top){
  const isReview = top.suggestedType === 'revisao';
  return h('section', { class:'card next-action interactive', 'aria-labelledby':'na-title' },
    h('div', { class:'na-head' },
      h('p', { class:'na-eyebrow' }, isReview ? 'Próxima revisão' : 'Próxima sessão', helpDot('recomendacao')),
      h('button', { class:'linkbtn muted', type:'button', text:'Por quê?', onclick:() => explainAction(top) })),
    h('div', { class:'na-body' },
      h('div', { class:'na-main' },
        h('h3', { class:'na-disc', id:'na-title', text: top.discipline.name }),
        h('p', { class:'na-topic', text: top.topic ? top.topic.name : 'Sem assunto específico' }),
        h('div', { class:'na-meta' },
          h('span', { class:'na-dur' }, icon('i-today', 'nav-icon'), h('span', { class:'num', text: fmtDuration(top.duration) })),
          isReview ? h('span', { class:'pill brass', text:'revisão' }) : null),
        h('ul', { class:'reasons na-reasons' }, top.reasons.slice(0,3).map(r => h('li', { text: capFirst(r) })))),
      h('div', { class:'na-cta' },
        h('button', { class:'btn primary lg', type:'button',
          onclick:() => startTimer(top.discipline.id, top.topic ? top.topic.id : null, top.suggestedType) },
          icon('i-play'), isReview ? 'Começar revisão' : 'Começar a estudar'),
        top.topic ? h('button', { class:'linkbtn', type:'button', text:'Ver assunto', onclick:() => openTopicDrawer(top.topic.id) }) : null)),
    signalGrid(top));
}

function reviewItem(topic){
  const disc = getDiscipline(topic.disciplineId);
  const overdue = (daysUntilISO(topic.reviewDueDate) || 0) < 0;
  return h('div', { class:'rev-item' + (overdue ? ' is-overdue' : '') },
    h('span', { class:'dot', style:`background:${overdue ? 'var(--danger)' : 'var(--brass)'}` }),
    h('div', { class:'ri-main' },
      h('div', { class:'ri-name', text: topic.name }),
      h('div', { class:'ri-meta', text: (disc ? disc.name + ' · ' : '') + fmtRelativeFuture(topic.reviewDueDate) + (topic.masteryLevel ? ` · domínio ${topic.masteryLevel}/5` : '') })
    ),
    h('button', { class:'btn ghost sm', type:'button', text:'Revisar',
      onclick:() => startReview(topic.id) })
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
/* =========================================================================
   TELA: REVISÕES (v4)
   Resumo curto → montar sessão → precisam de atenção → hoje → próximas.
   Nenhum número de algoritmo aparece: só motivos em texto.
   ========================================================================= */
function renderReviews(){
  const root = $('#reviews-body');
  const parts = [];
  const ranked = ReviewEngine.rankedQueue();
  const overdue = ranked.filter(r => r.daysLate > 0);
  const forToday = ranked.filter(r => r.daysLate === 0);
  const upcoming = ReviewEngine.getUpcomingReviews(14);
  const anyScheduled = ReviewEngine.allScheduled().length > 0;

  /* ---------- estado vazio ---------- */
  if(!anyScheduled){
    mount(root, card(null, emptyState(
      'Nada para revisar agora',
      'Quando você estuda um assunto com revisões ativadas, ele volta aqui no momento certo — você não precisa agendar nada.',
      h('div', { class:'empty-actions' },
        h('button', { class:'btn primary', type:'button', text:'Ver como funciona', onclick:() => openInteractiveGuide('ig-revisao') }),
        h('button', { class:'btn ghost', type:'button', text:'Adicionar um assunto',
          onclick:() => { const d = activeDisciplines()[0]; if(d) openTopicModal(d.id, null); else setView('disciplines'); } }))
    )));
    return;
  }

  /* ---------- resumo + ação principal ---------- */
  const summary = h('div', { class:'card feature' },
    h('div', { class:'card-head' },
      h('p', { class:'card-title', style:'margin:0' }, 'Sua fila', helpDot('revisao')),
      h('button', { class:'linkbtn', type:'button', text:'Como funciona?', onclick:openReviewPrimer })),
    h('div', { class:'stat-grid', style:'margin-bottom:14px' },
      statBox(String(forToday.length), 'para hoje', null, 'rev-today'),
      statBox(String(overdue.length), 'atrasadas', null, 'rev-overdue'),
      statBox(String(upcoming.length), 'nos próximos 14 dias', null, 'rev-upcoming'),
      statBox(String(ReviewEngine.allScheduled().length), 'assuntos no ciclo', null, 'rev-cycle')),
    ranked.length
      ? h('div', null,
          h('p', { class:'hint', style:'margin-bottom:10px', text:
            ranked.length > 6
              ? `Você tem ${ranked.length} revisões pendentes. Não precisa fazer todas hoje — escolha um tempo e o Ciclo monta uma sessão com as mais importantes.`
              : 'Escolha quanto tempo você tem agora e comece pelas mais importantes.' }),
          h('div', { class:'row auto quick-review' },
            h('button', { class:'btn primary', type:'button', onclick:openSessionBuilder },
              icon('i-play'), 'Montar sessão de revisão'),
            h('span', { class:'hint', text:'ou revisar por' }),
            [10, 20, 30].map(m => h('button', { class:'btn ghost sm', type:'button', text:`${m} min`,
              'aria-label':`Revisar por ${m} minutos`, onclick:() => startQueuedReviewSession(m) }))))
      : h('p', { class:'hint', text:'Nenhuma revisão pendente hoje. A fila se preenche sozinha conforme os intervalos vencem.' })
  );
  parts.push(summary);

  const sugestoes = renderDeadlineSuggestions();
  if(sugestoes) parts.push(sugestoes);

  /* ---------- precisam de atenção ---------- */
  if(overdue.length){
    const c = h('div', { class:'card' }, h('div', { class:'card-head' },
      h('p', { class:'card-title', style:'margin:0', text:'Precisam de atenção' }),
      h('span', { class:'pill danger', text:String(overdue.length) })));
    overdue.slice(0, 8).forEach(r => c.append(reviewQueueItem(r)));
    if(overdue.length > 8) c.append(h('p', { class:'hint', style:'margin-top:10px', text:`+ ${overdue.length - 8} atrasadas. Monte uma sessão para reduzir aos poucos.` }));
    parts.push(c);
  }

  /* ---------- hoje ---------- */
  if(forToday.length){
    const c = h('div', { class:'card' }, h('div', { class:'card-head' },
      h('p', { class:'card-title', style:'margin:0', text:'Hoje' }),
      h('span', { class:'pill brass', text:String(forToday.length) })));
    forToday.slice(0, 8).forEach(r => c.append(reviewQueueItem(r)));
    parts.push(c);
  }

  /* ---------- próximas (coluna lateral no desktop largo) ---------- */
  const side = [];
  if(upcoming.length){
    const byDay = new Map();
    upcoming.forEach(t => { if(!byDay.has(t.reviewDueDate)) byDay.set(t.reviewDueDate, []); byDay.get(t.reviewDueDate).push(t); });
    const c = h('div', { class:'card' }, h('p', { class:'card-title', text:'Próximas' }));
    Array.from(byDay.entries()).slice(0, 7).forEach(([date, list]) => {
      c.append(h('div', { style:'margin-top:10px' },
        h('p', { class:'hint', style:'margin:0 0 4px', text: fmtRelativeFuture(date) + ' · ' + fmtDateBR(date) }),
        h('ul', { class:'alt-list' }, list.map(t => h('li', null,
          h('span', { class:'alt-main' },
            h('button', { class:'linkbtn', type:'button', style:'padding:0', text:t.name, onclick:() => openTopicDrawer(t.id) }),
            h('div', { class:'alt-sub', text: disciplineName(t.disciplineId) + (t.masteryLevel ? ` · domínio ${t.masteryLevel}/5` : '') })),
          h('button', { class:'linkbtn', type:'button', text:'antecipar', onclick:() => startReview(t.id) })
        )))));
    });
    side.push(c);
  }

  const hints = reviewHints();
  if(hints.length) side.push(hintBox(hints));

  mount(root, side.length
    ? h('div', { class:'screen-layout' }, h('div', { class:'stack layout-main' }, parts), h('div', { class:'stack layout-side' }, side))
    : parts);
}

/** Item da fila: nome, contexto, motivos e método sugerido. */
function reviewQueueItem(entry){
  const t = entry.topic;
  const em = ReviewEngine.effectiveMethod(t);
  const minutes = ReviewEngine.estimateMinutes(t, em.method);
  const late = entry.daysLate > 0;

  return h('div', { class:'rev-item rev-rich' },
    h('span', { class:'dot', style:`background:${late ? 'var(--danger)' : 'var(--brass)'}` }),
    h('div', { class:'ri-main' },
      h('button', { class:'ri-name linkbtn', type:'button', style:'padding:0;text-decoration:none;color:var(--text)',
        text:t.name, onclick:() => openTopicDrawer(t.id) }),
      h('div', { class:'ri-meta', text: disciplineName(t.disciplineId) + ' · ~' + minutes + ' min' }),
      h('div', { class:'ri-reasons' }, entry.reasons.slice(0,3).map(r => h('span', { class:'pill', text:r }))),
      h('div', { class:'ri-method' }, 'Sugestão: ', h('strong', { text: methodLabel(em.method) }),
        ' — ', ReviewEngine.methodGuide(em.method).short)
    ),
    h('div', { class:'ri-actions' },
      h('button', { class:'btn ghost sm', type:'button', text:'Revisar', onclick:() => startReview(t.id) }),
      h('button', { class:'linkbtn muted', type:'button', text:'Por quê?',
        onclick:() => explainReview(entry) }))
  );
}

/** Resposta curta, em linguagem natural, sobre por que este item está na fila. */
function explainReview(entry){
  const t = entry.topic;
  const frases = entry.reasons.slice(0, 3).map(r => r.charAt(0).toUpperCase() + r.slice(1) + '.');
  openModal(close => ({
    title:'Por que revisar isto?',
    content: h('div',
      h('p', { class:'modal-sub', text: t.name + ' · ' + disciplineName(t.disciplineId) }),
      h('ul', { class:'reasons' }, frases.map(f => h('li', { text:f }))),
      h('p', { class:'hint', style:'margin-top:12px', text:'Quando há muitas revisões pendentes, o Ciclo coloca primeiro o que corre mais risco de ser esquecido.' })),
    actions:[
      h('button', { class:'btn ghost', type:'button', text:'Fechar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text:'Revisar agora', onclick:() => { close(); startReview(t.id); } })
    ]
  }), { size:'narrow' });
}

/* =========================================================================
   INICIAR UMA REVISÃO — escolha do método + roteiro curto
   ========================================================================= */
function startReview(topicId, presetMethod){
  const t = getTopic(topicId);
  if(!t){ toast('Tópico não encontrado.', 'err'); return; }
  const em = ReviewEngine.effectiveMethod(t);
  let method = presetMethod && CONCRETE_METHODS.includes(presetMethod) ? presetMethod : em.method;

  openModal(close => {
    const body = h('div');
    const build = () => {
      const guide = ReviewEngine.methodGuide(method);
      const minutes = ReviewEngine.estimateMinutes(t, method);
      clear(body);
      body.append(
        h('p', { class:'modal-sub', text: disciplineName(t.disciplineId) + ' · ' + fmtRelativeFuture(t.reviewDueDate) +
          (t.importance === 'high' ? ' · importância alta' : '') + ' · ~' + minutes + ' min' }),
        h('div', { class:'method-box' },
          h('p', { class:'card-title', style:'margin:0 0 4px' }, 'Método: ' + guide.label, helpDot('metodo')),
          h('p', { class:'hint', style:'margin-bottom:8px', text: guide.intro }),
          method === em.method && em.auto ? h('p', { class:'hint', style:'color:var(--brass)', text: em.reason }) : null,
          h('ol', { class:'method-steps' }, guide.steps.map(st => h('li', { text:st }))),
          guide.note ? h('p', { class:'hint', style:'margin-top:8px', text:guide.note }) : null
        ),
        h('div', { class:'field', style:'margin-top:14px' },
          h('label', { text:'Usar outro método' }),
          h('div', { class:'chips' }, CONCRETE_METHODS.map(mv =>
            h('button', { class:'chip', type:'button', 'aria-pressed': mv === method ? 'true':'false', text: methodLabel(mv),
              onclick:() => { method = mv; build(); } }))))
      );
    };
    build();

    return {
      title:'Revisar: ' + t.name,
      content: body,
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        h('button', { class:'btn ghost', type:'button', text:'Registrar sem cronômetro',
          onclick:() => { close(); openReviewOutcomeModal(t.id, method, ReviewEngine.estimateMinutes(t, method)); } }),
        h('button', { class:'btn primary', type:'button', text:'Começar revisão',
          onclick:() => { close(); startTimer(t.disciplineId, t.id, 'revisao', method); } })
      ]
    };
  }, { size:'wide' });
}

/** Registro direto do resultado, sem passar pelo cronômetro. */
function openReviewOutcomeModal(topicId, method, suggestedMinutes){
  const t = getTopic(topicId);
  if(!t) return;
  let outcome = null;
  openModal(close => {
    const minInput = h('input', { type:'number', id:'ro-min', min:'1', value:String(suggestedMinutes || 10), inputmode:'numeric' });
    return {
      title:'Como foi a revisão?',
      content: h('div',
        h('p', { class:'modal-sub', text: t.name + ' · ' + methodLabel(method) }),
        h('div', { class:'field' }, h('label', { text:'Resultado' }),
          pillGroup(REVIEW_OUTCOMES.map(o => ({ value:o.v, label:o.label })), outcome, v => { outcome = v; })),
        h('div', { class:'field' }, h('label', { for:'ro-min', text:'Tempo gasto (minutos)' }), minInput),
        h('div', { class:'field' }, h('label', { for:'ro-comment', text:'Comentário (opcional)' }), h('textarea', { id:'ro-comment' }))),
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
          if(!outcome){ toast('Escolha como foi a revisão.', 'err'); return; }
          const minutes = Math.max(1, Number(minInput.value) || 10);
          const comment = (($('#ro-comment') || {}).value || '').trim();
          close();
          await saveSession({ disciplineId:t.disciplineId, topicId:t.id, date:todayISO(), minutes,
            type:'revisao', reviewOutcome:outcome, reviewMethod:method, comment });
        } })
      ]
    };
  });
}

/* =========================================================================
   MONTAR SESSÃO DE REVISÃO — "quanto tempo você tem agora?"
   ========================================================================= */
function openSessionBuilder(){
  let minutes = 20;
  openModal(close => {
    const preview = h('div');
    const render = () => {
      const plan = ReviewEngine.buildSession(minutes);
      clear(preview);
      if(!plan.items.length){
        preview.append(h('p', { class:'hint', text:'Nenhuma revisão pendente no momento.' }));
        return;
      }
      preview.append(h('p', { class:'card-title', style:'margin-top:6px',
        text:`REVISÃO · ${plan.totalMinutes} MIN` }));
      plan.items.forEach(it => preview.append(h('div', { class:'builder-item' },
        h('div', { class:'bi-main' },
          h('div', { class:'bi-name', text: it.topic.name }),
          h('div', { class:'bi-sub', text: disciplineName(it.topic.disciplineId) + ' · ' + it.reasons.slice(0,2).join(' · ') }),
          h('div', { class:'bi-method', text: methodLabel(it.method) })),
        h('span', { class:'num bi-min', text: it.minutes + ' min' }))));
      if(plan.remaining > 0){
        preview.append(h('p', { class:'hint', style:'margin-top:10px',
          text:`Outras ${plan.remaining} revisões continuam na fila para depois. Nada é marcado como concluído sem você revisar.` }));
      }
    };

    const chips = h('div', { class:'chips', style:'margin-bottom:12px' },
      [10,20,30,45].map(v => h('button', { class:'chip', type:'button', 'aria-pressed': v === minutes ? 'true':'false', text: v + ' min',
        onclick:() => { minutes = v; $$('.chip', chips).forEach(c => c.setAttribute('aria-pressed','false'));
                        $$('.chip', chips).find(c => c.textContent === v + ' min').setAttribute('aria-pressed','true');
                        customIn.value = ''; render(); } })));
    const customIn = h('input', { type:'number', id:'sb-custom', min:'5', step:'5', placeholder:'Outro valor', inputmode:'numeric' });
    customIn.addEventListener('input', () => {
      const v = Number(customIn.value);
      if(v >= 5){ minutes = v; $$('.chip', chips).forEach(c => c.setAttribute('aria-pressed','false')); render(); }
    });
    render();

    return {
      title:'Quanto tempo você tem agora?',
      content: h('div',
        chips,
        h('div', { class:'field' }, h('label', { for:'sb-custom', text:'Personalizado (minutos)' }), customIn),
        preview),
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        h('button', { class:'btn primary', type:'button', text:'Começar', onclick:() => {
          const plan = ReviewEngine.buildSession(minutes);
          if(!plan.items.length){ toast('Nenhuma revisão pendente.', 'err'); return; }
          close();
          ui.reviewQueue = plan.items.map(i => ({ topicId:i.topic.id, method:i.method }));
          runNextQueuedReview();
        } })
      ]
    };
  }, { size:'wide' });
}

/** "Revisar por N minutos": monta a sessão direto, sem passar pelo seletor. */
function startQueuedReviewSession(minutes){
  const plan = ReviewEngine.buildSession(minutes);
  if(!plan.items.length){ toast('Nenhuma revisão pendente agora.', 'info'); return; }
  ui.reviewQueue = plan.items.map(i => ({ topicId:i.topic.id, method:i.method }));
  toast(`${plan.items.length} ${plan.items.length === 1 ? 'revisão' : 'revisões'} · cerca de ${plan.totalMinutes} min. Comece por ${plan.items[0].topic.name}.`, 'info',
    { title:`Sessão de ${minutes} minutos montada` });
  runNextQueuedReview();
}

/** Encadeia as revisões escolhidas na sessão montada. */
function runNextQueuedReview(){
  if(!ui.reviewQueue || !ui.reviewQueue.length){
    toast('Todas as revisões escolhidas foram registradas.', 'ok', { title:'Sessão de revisão concluída' });
    return;
  }
  const next = ui.reviewQueue.shift();
  const t = getTopic(next.topicId);
  if(!t){ runNextQueuedReview(); return; }
  startReview(t.id, next.method);
}

/* =========================================================================
   "COMO FUNCIONAM AS REVISÕES?" — explicação curta e visual
   ========================================================================= */
function openReviewPrimer(){
  if(!state.meta.reviewPrimerSeen) setMeta('reviewPrimerSeen', true).catch(err => console.error(err));
  const flow = ['Estude um tópico','Tente lembrar depois','Avalie como foi','O Ciclo ajusta a próxima revisão','Repita'];
  const body = h('div',
    h('p', { class:'prose', style:'margin-bottom:14px',
      text:'Revisar é voltar a um conteúdo já estudado para descobrir o que você ainda consegue lembrar. Não é reler: é tentar recuperar antes de conferir.' }),
    h('ol', { class:'flow' }, flow.map(f => h('li', { text:f }))),
    h('div', { class:'two-col', style:'margin-top:18px' },
      h('div', { class:'card elevated' },
        h('p', { class:'card-title', text:'QUANDO revisar' }),
        h('p', { class:'hint', text:'É a estratégia. Ela decide o intervalo até a próxima revisão. A padrão é a Adaptativa: se você lembra bem, o intervalo cresce; se esquece, ele encurta.' })),
      h('div', { class:'card elevated' },
        h('p', { class:'card-title', text:'COMO revisar' }),
        h('p', { class:'hint', text:'É o método. Pode ser tentar lembrar, resolver exercícios, explicar em voz alta, escrever de memória… O Ciclo sugere um, e você pode trocar.' }))),
    h('p', { class:'card-title', style:'margin-top:18px', text:'O que significa cada resposta' }),
    h('div', { class:'outcome-grid' },
      h('div', null, h('strong', { text:'Esqueci boa parte' }), h('span', { text:'O conteúdo volta amanhã e o domínio cai.' })),
      h('div', null, h('strong', { text:'Lembrei com dificuldade' }), h('span', { text:'O intervalo cresce pouco.' })),
      h('div', null, h('strong', { text:'Lembrei bem' }), h('span', { text:'O intervalo cresce e o domínio sobe.' })),
      h('div', null, h('strong', { text:'Dominei' }), h('span', { text:'O intervalo cresce bastante e o domínio vai ao máximo.' }))),
    h('p', { class:'hint', style:'margin-top:16px', text:'Responder com honestidade é o que faz o sistema funcionar. Marcar "lembrei bem" sem ter lembrado só adia o problema.' }),
    h('div', { class:'row auto', style:'margin-top:16px' },
      h('button', { class:'btn ghost sm', type:'button', text:'O que é revisão?', onclick:() => openStudyGuideDrawer('o-que-e-revisao') }),
      h('button', { class:'btn ghost sm', type:'button', text:'Por que não basta reler?', onclick:() => openStudyGuideDrawer('reconhecer-x-lembrar') }))
  );
  Drawer.open('Como funcionam as revisões', body);
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

  /* v5 — sem plano ainda: uma pergunta, uma sugestão, um botão. */
  if(!PlannerEngine.activePlan() && !ui.planExpanded){
    mount(root,
      h('div', { class:'card hero' },
        h('p', { class:'hero-eyebrow', text:'Organizar a semana' }),
        h('h3', { class:'hero-title', text:'Quanto você quer estudar nesta semana?' }),
        h('p', { class:'hero-text', text:'O Ciclo divide esse tempo entre o que você estuda e passa a mostrar quanto falta. Você pode estudar sem plano — ele só torna as sugestões melhores.' }),
        (() => {
          const chips = h('div', { class:'chips', style:'margin:14px 0' });
          [2,5,10].forEach(hrs => chips.append(h('button', { class:'chip', type:'button', text: hrs + 'h',
            onclick:() => createSimplePlan(hrs * 60) })));
          chips.append(h('button', { class:'chip', type:'button', text:'Outro',
            onclick:() => { ui.planExpanded = true; renderPlan(); } }));
          return chips;
        })(),
        h('button', { class:'linkbtn', type:'button', text:'Para que serve o planejamento?',
          onclick:() => openInteractiveGuide('ig-plano') })));
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
      h('div', { class:'field' }, h('label', { for:'plan-avail-h' }, 'Horas por semana', helpDot('disponibilidade')), availInput,
        h('p', { class:'hint', text:'Quanto tempo você pretende dedicar aos estudos por semana.' }))
    ),
    h('div', { class:'row auto' },
      h('button', { class:'btn ghost sm', type:'button', text:'Distribuir automaticamente', title:'Respeita mínimos, divide o resto por prioridade e fecha no total exato.', onclick:() => {
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
    h('span', { text:'Disciplina' }),
    h('span', null, 'Prioridade', helpDot('prioridade')),
    h('span', null, 'Mínimo', helpDot('minimo')),
    h('span', { text:'Planejado' })));

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
  const ph = planHints(draft);
  if(ph.length) allocCard.append(hintBox(ph));
  parts.push(allocCard);

  /* --- semana atual (snapshot) — coluna lateral no desktop largo --- */
  const side = [];
  const prog = PlannerEngine.getCurrentWeekProgress();
  if(prog.weeklyPlan){
    const wc = h('div', { class:'card' });
    wc.append(h('div', { class:'card-head' },
      h('p', { class:'card-title', style:'margin:0' }, 'Semana atual', helpDot('planosemana')),
      h('span', { class:'hint', text: fmtDateBR(prog.weeklyPlan.weekStart) + ' → ' + fmtDateBR(prog.weeklyPlan.weekEnd) })));
    wc.append(h('p', { class:'hint', style:'margin-bottom:10px',
      text:'Esta semana tem seu próprio registro. Alterar o plano base no futuro não reescreve as metas das semanas já passadas.' }));
    prog.perDiscipline.forEach(x => {
      const pct = x.planned > 0 ? (x.realized / x.planned) * 100 : 0;
      const bar = h('div', { class:'hbar', tabindex:'0', role:'img',
        'aria-label': `${disciplineName(x.disciplineId)}: ${fmtDuration(x.realized)} de ${fmtDuration(x.planned)}` },
        h('span', { class: pct >= 100 ? 'is-done' : '', style:`width:${clamp(pct,0,100)}%` }));
      Tooltip.attach(bar, () => tipBody(disciplineName(x.disciplineId), [
        ['Planejado', fmtDuration(x.planned)],
        ['Realizado', fmtDuration(x.realized)],
        ['Restante', fmtDuration(x.remaining)],
        ['Aderência', x.planned > 0 ? fmtPct(pct) : '—']
      ]));
      wc.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text: disciplineName(x.disciplineId) }), bar,
        h('span', { class:'hv', text: `${fmtDuration(x.realized)}/${fmtDuration(x.planned)}` })
      ));
    });
    wc.append(h('div', { class:'alloc-total' },
      h('div', null, h('p', { class:'card-title', text:'Semana', style:'margin:0 0 2px' }),
        h('span', { class:'at-v', text:`${fmtDuration(prog.realizedTotal)} / ${fmtDuration(prog.plannedTotal)}` })),
      h('p', { class:'hint', style:'margin:0', text: prog.pct !== null ? fmtPct(prog.pct) + ' do planejado' : '' })));
    side.push(wc);
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
    side.push(pc);
  }

  mount(root, side.length
    ? h('div', { class:'screen-layout plan-layout' }, h('div', { class:'stack layout-main' }, parts), h('div', { class:'stack layout-side' }, side))
    : parts);
}

/**
 * v5 — cria um plano a partir de uma única escolha (horas na semana) e mostra
 * a divisão sugerida antes de confirmar. Nenhuma outra decisão é exigida.
 */
function createSimplePlan(minutes){
  const discs = activeDisciplines();
  if(!discs.length){
    toast('Adicione o que você estuda antes de organizar a semana.', 'err');
    setView('disciplines');
    return;
  }
  const res = PlannerEngine.generatePlan(minutes, discs.map(d => ({
    disciplineId:d.id, priority:d.priority, minWeeklyMinutes:0
  })));

  openModal(close => ({
    title:'O Ciclo sugere esta divisão',
    content: h('div',
      h('p', { class:'modal-sub', text:`${fmtDuration(minutes)} por semana, distribuídas conforme a atenção que cada uma merece.` }),
      h('div', { class:'plan-preview' },
        res.allocations.map(a => {
          const d = getDiscipline(a.disciplineId);
          return h('div', { class:'demo-row' },
            h('div', null, h('div', { text: d ? d.name : '' }),
              h('div', { class:'hint', text: d ? prioritySimpleLabel(d.priority) : '' })),
            h('span', { class:'num', text: fmtDuration(a.targetMinutes) }));
        })),
      h('p', { class:'hint', style:'margin-top:12px', text:'Isso é apenas uma sugestão. Você pode ajustar qualquer valor depois, quando quiser.' })),
    actions:[
      h('button', { class:'btn ghost', type:'button', text:'Ajustar', onclick:() => {
        close(); ui.planExpanded = true;
        ui.planDraft = { planId:null, name:'Meu plano', availableMinutes:minutes, allocations:res.allocations.map(a => ({ ...a })) };
        renderPlan();
      } }),
      h('button', { class:'btn primary', type:'button', text:'Usar esta divisão', onclick: async () => {
        close();
        try {
          const plan = newPlan('Meu plano', minutes);
          plan.allocations = res.allocations;
          state.plans.forEach(x => { x.active = false; });
          if(state.plans.length) await DB.putMany('plans', state.plans);
          await DB.put('plans', plan);
          ui.planDraft = null; ui.planExpanded = false;
          await refresh();
          toast(`${fmtDuration(minutes)} por semana. A tela Hoje já usa esse plano.`, 'ok', { title:'Semana organizada' });
        } catch(err){
          console.error('Falha ao criar o plano:', err);
          toast('Não foi possível salvar o plano.', 'err');
        }
      } })
    ]
  }), { size:'wide' });
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
  toast(applyToCurrentWeek ? 'Já vale para esta semana.' : 'Vale a partir da próxima semana. Para usar agora, escolha "Salvar e aplicar nesta semana".', 'ok',
    { title:'Plano salvo' });
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
          toast(`${plan.name} · ${fmtDuration(minutes)} por semana.`, 'ok', { title:'Plano criado e ativado' });
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
        h('button', { class:'btn ghost sm', type:'button', text:'+ Área', onclick:() => openAreaModal(null) }),
        h('button', { class:'btn primary sm', type:'button', text:'+ Disciplina', onclick:() => openDisciplineModal(null) }))),
    h('label', { style:'display:flex;align-items:center;gap:7px;margin:0;font-size:12.5px' },
      (() => { const c = h('input', { type:'checkbox', checked: ui.showArchivedDisciplines });
               c.addEventListener('change', () => { ui.showArchivedDisciplines = c.checked; renderDisciplines(); }); return c; })(),
      'mostrar arquivadas')
  );
  parts.push(header);

  const list = ui.showArchivedDisciplines ? state.disciplines : activeDisciplines();
  if(!list.length){
    parts.push(card(null, emptyState('Você ainda não adicionou nada para estudar',
      'Comece com apenas uma coisa. Pode ser uma matéria, um idioma, uma certificação ou qualquer outro assunto — por exemplo Matemática, Inglês, Anatomia ou CCNA.',
      h('div', { class:'empty-actions' },
        h('button', { class:'btn primary', type:'button', text:'Adicionar o que estou estudando',
          onclick:() => openDisciplineModal(null) }),
        h('button', { class:'btn ghost', type:'button', text:'O que é uma disciplina?',
          onclick:() => openInteractiveGuide('ig-disciplina') })))));
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
    group.append(h('div', { class:'disc-grid' }, items.slice().sort(sortByName).map(d => disciplineCard(d))));
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
  const due = ReviewEngine.dueCountFor(d.id);
  const meta = [];
  meta.push(prog.total > 0 ? `${prog.total} ${prog.total === 1 ? 'assunto' : 'assuntos'} · ${prog.mastered} ${prog.mastered === 1 ? 'dominado' : 'dominados'}` : 'sem assuntos ainda');
  meta.push(`último estudo ${fmtRelativePast(last)}`);
  if(weekProg) meta.push(`semana ${fmtDuration(weekProg.realized)}/${fmtDuration(weekProg.planned)}`);

  return h('div', { class:'disc-card' + (d.archived ? ' is-archived' : '') },
    h('button', { class:'dc-open', type:'button', onclick:() => openDisciplineDetail(d.id) },
      h('span', { class:'dc-top' },
        h('span', { class:'dc-titles' },
          h('span', { class:'dc-name' }, d.name, d.archived ? h('span', { class:'pill', text:'arquivada' }) : null),
          h('span', { class:'dc-sub', text: prioritySimpleLabel(d.priority) + (d.areaId ? ' · ' + areaNameOf(d) : '') })),
        h('span', { class:'dc-right' },
          h('span', { class:'dc-pct num', text: prog.coverage !== null ? fmtPct(prog.coverage) : '—' }),
          h('span', { class:'dc-pct-l', text:'conteúdo visto' }))),
      prog.total > 0 ? progressBar(prog.coverage, prog.coverage >= 100 ? 'done' : null, 'disc-' + d.id) : h('span', { class:'bar is-empty', 'aria-hidden':'true' }),
      h('span', { class:'dc-meta' },
        h('span', { text: meta.join(' · ') }),
        due > 0 ? h('span', { class:'pill brass', text: due + (due === 1 ? ' revisão' : ' revisões') }) : null)),
    d.archived ? null : h('div', { class:'dc-actions dc-hover' },
      h('button', { class:'btn ghost sm', type:'button', 'aria-label':'Estudar ' + d.name,
        onclick:() => openRegisterModal({ disciplineId:d.id }) }, icon('i-play'), 'Estudar'),
      h('button', { class:'btn ghost sm', type:'button', 'aria-label':'Adicionar assunto em ' + d.name,
        onclick:() => openTopicModal(d.id, null) }, icon('i-plus'), 'Assunto')));
}

function isDesktopUI(){
  return window.matchMedia('(min-width:861px)').matches;
}

/**
 * Detalhe da disciplina. No computador abre em painel lateral (mantém a lista
 * visível ao lado); no celular continua em modal, que é mais confortável lá.
 */
function openDisciplineDetail(discId){
  ui.openDisciplineId = discId;
  const d = getDiscipline(discId);
  if(!d) return;
  if(isDesktopUI()){ openDisciplineDrawer(d); return; }

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

function openDisciplineDrawer(d){
  const build = () => {
    const prog = disciplineProgress(d.id);
    const weekProg = PlannerEngine.getCurrentWeekProgress().perDiscipline.find(x => x.disciplineId === d.id);
    const topics = topicsOf(d.id, true);
    const visible = topics.filter(t => !t.archived);

    const topicList = h('div');
    if(!visible.length){
      topicList.append(emptyState(
        'Você ainda não adicionou assuntos em ' + d.name,
        'Adicione aos poucos, conforme for estudando. Não precisa cadastrar tudo agora.',
        h('div', { class:'empty-actions' },
          h('button', { class:'btn primary sm', type:'button', text:'Adicionar assunto',
            onclick:() => { Drawer.close(); openTopicModal(d.id, null); } }),
          h('button', { class:'btn ghost sm', type:'button', text:'O que é um assunto?',
            onclick:() => openInteractiveGuide('ig-topico') }))));
    } else {
      visible.forEach((t, i) => {
        const st = topicStatus(t);
        topicList.append(h('div', { class:'topic-row' },
          statusMark(st),
          h('button', { class:'tr-main', type:'button', style:'text-align:left;background:none',
            onclick:() => openTopicDrawer(t.id) },
            h('div', { class:'tr-name', text:t.name }),
            h('div', { class:'tr-meta', text:
              TOPIC_STATUS_LABEL[st] +
              (t.masteryLevel ? ` · domínio ${t.masteryLevel}/5` : '') +
              (t.reviewDueDate ? ` · revisão ${fmtRelativeFuture(t.reviewDueDate)}` : (t.reviewEnabled ? '' : ' · revisão desligada')) })),
          h('span', { class:'row-actions' },
            h('button', { class:'linkbtn muted', type:'button', text:'↑', title:'Subir', disabled: i === 0,
              onclick: async () => { await moveTopic(t.id, -1); refreshDrawer(); } }),
            h('button', { class:'linkbtn muted', type:'button', text:'↓', title:'Descer', disabled: i === visible.length - 1,
              onclick: async () => { await moveTopic(t.id, 1); refreshDrawer(); } }),
            h('button', { class:'linkbtn', type:'button', text:'editar',
              onclick:() => { Drawer.close(); openTopicModal(d.id, t); } }))
        ));
      });
    }

    const archived = topics.filter(t => t.archived);
    if(archived.length){
      topicList.append(h('p', { class:'hint', style:'margin-top:10px', text:`${archived.length} tópico(s) arquivado(s) — histórico preservado.` }));
      archived.forEach(t => topicList.append(h('div', { class:'topic-row', style:'opacity:.6' },
        statusMark(topicStatus(t)),
        h('div', { class:'tr-main' }, h('div', { class:'tr-name', text:t.name }), h('div', { class:'tr-meta', text:'arquivado' })),
        h('button', { class:'linkbtn', type:'button', text:'reativar',
          onclick: async () => { t.archived = false; await persist('topics', t); await refresh(); refreshDrawer(); } }))));
    }

    return h('div',
      h('p', { class:'hint', style:'margin-bottom:12px', text: areaNameOf(d) + ' · ' + PRIORITY_LABELS[d.priority].toLowerCase() + ' prioridade' }),
      h('div', { class:'stat-grid', style:'margin-bottom:14px' },
        statBox(weekProg ? fmtDuration(weekProg.planned) : '—', 'planejado na semana'),
        statBox(weekProg ? fmtDuration(weekProg.realized) : fmtDuration(minutesInRange({ start:startOfWeek(today()), end:endOfWeek(today()) }, d.id)), 'realizado'),
        statBox(prog.coverage !== null ? fmtPct(prog.coverage) : '—', 'conteúdo visto'),
        statBox(fmtRelativePast(lastStudyISO(d.id)), 'último estudo')),
      prog.total > 0 ? h('div', { style:'margin-bottom:14px' },
        h('p', { class:'hint', style:'margin-bottom:5px' }, `Conteúdo visto ${fmtPct(prog.coverage)} · dominado ${fmtPct(prog.mastery)}`, helpDot('cobertura')),
        barWithTip(prog.coverage, null, d.name, [
          ['Tópicos', String(prog.total)],
          ['Iniciados', String(prog.covered)],
          ['Dominados', String(prog.mastered)]
        ])) : null,
      h('div', { class:'card-head' },
        h('p', { class:'card-title', style:'margin:0', text:'Conteúdo' }),
        h('button', { class:'linkbtn', type:'button', text:'+ adicionar tópico',
          onclick:() => { Drawer.close(); openTopicModal(d.id, null); } })),
      topicList,
      h('div', { class:'row auto', style:'margin-top:18px' },
        h('button', { class:'btn primary sm', type:'button', text:'Estudar agora',
          onclick:() => { Drawer.close(); openRegisterModal({ disciplineId:d.id }); } }),
        h('button', { class:'btn ghost sm', type:'button', text:'Editar disciplina',
          onclick:() => { Drawer.close(); openDisciplineModal(d); } }),
        h('button', { class:'btn ghost sm', type:'button', text: d.archived ? 'Reativar' : 'Arquivar',
          onclick: async () => { Drawer.close(); await toggleArchiveDiscipline(d.id); } }))
    );
  };

  const refreshDrawer = () => { mount(document.getElementById('drawer-content'), build()); };
  Drawer.open(d.name, build());
}

/* ---------- CRUD: áreas, disciplinas, tópicos, prazos ---------- */
function openAreaModal(area){
  // Só é edição quando recebemos uma área de verdade. Isso protege o fluxo de
  // handlers que repassem o Event por engano (ex.: onclick:openAreaModal).
  if(area && typeof area.id !== 'string'){
    console.warn('openAreaModal recebeu um argumento que não é uma área; tratando como nova área.', area);
    area = null;
  }
  openModal(close => {
    const nameIn = h('input', { type:'text', id:'ar-name', value: area ? area.name : '', placeholder:'Ex.: Tecnologia', maxlength:'60' });
    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
        const name = nameIn.value.trim();
        if(!name){ toast('Escreva o nome do grupo.', 'err'); return; }
        const dup = state.areas.find(x => x.name.toLowerCase() === name.toLowerCase() && (!area || x.id !== area.id));
        if(dup){ toast('Já existe um grupo com esse nome.', 'err'); return; }
        close();
        try {
          if(area){ area.name = name; await persist('areas', area); }
          else { await DB.put('areas', newArea(name)); }
          await refresh();
          toast(area ? 'Área atualizada.' : 'Área criada.', 'ok');
        } catch(err){
          console.error('Falha ao salvar a área:', err);
          toast('Não foi possível salvar a área.', 'err');
        }
      } })
    ];
    if(area){
      actions.unshift(h('button', { class:'btn ghost', type:'button', text:'Excluir', onclick: async () => {
        const used = state.disciplines.filter(d => d.areaId === area.id).length;
        close();
        if(used){ toast(`Esta área tem ${used} disciplina(s). Mova-as antes de excluir.`, 'err'); return; }
        const ok = await confirmModal('Excluir esta área?', { confirmLabel:'Excluir' });
        if(!ok) return;
        try {
          await DB.delete('areas', area.id);
          await refresh();
          toast('Área excluída.');
        } catch(err){
          console.error('Falha ao excluir a área:', err);
          toast('Não foi possível excluir a área.', 'err');
        }
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

    // prioridade em linguagem natural; a escala 1–5 continua em Opções avançadas
    let simplePriority = prioritySimpleValue(priority);
    const prioSimple = h('div', { class:'choice-list', role:'radiogroup', 'aria-label':'Quanta atenção esta disciplina merece' });
    PRIORITY_SIMPLE.forEach(o => {
      const btn = h('button', { class:'choice', type:'button', 'aria-pressed': o.value === simplePriority ? 'true':'false' },
        h('span', { class:'choice-title', text:o.label }),
        h('span', { class:'choice-hint', text:o.hint }));
      btn.addEventListener('click', () => {
        simplePriority = o.value; priority = o.value;
        $$('.choice', prioSimple).forEach(x => x.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
        if(prioSel) prioSel.value = String(o.value);
      });
      prioSimple.append(btn);
    });

    const prioSel = h('select', { id:'dm-prio' });
    [1,2,3,4,5].forEach(p => prioSel.appendChild(h('option', { value:String(p), selected:p === priority }, `${p} — ${PRIORITY_LABELS[p]}`)));
    prioSel.addEventListener('change', () => { priority = Number(prioSel.value); });

    const mpcIn = h('input', { type:'number', id:'dm-mpc', min:'1', step:'1', inputmode:'numeric', value:String(disc ? disc.minutesPerCredit : 20) });

    let nature = disc ? (disc.contentNature || 'mixed') : 'mixed';
    let dStrategy = disc ? (disc.reviewStrategy || 'inherit') : 'inherit';
    let dMethod = disc ? (disc.preferredReviewMethod || 'inherit') : 'inherit';

    const natureSel = h('select', { id:'dm-nature' });
    CONTENT_NATURES.forEach(n => natureSel.appendChild(h('option', { value:n.v, selected:n.v === nature }, n.label + ' — ' + n.hint)));
    natureSel.addEventListener('change', () => { nature = natureSel.value; });

    const stratSel = h('select', { id:'dm-strategy' });
    [{ v:'inherit', label:'Usar o padrão geral (' + strategyLabel(state.settings.defaultReviewStrategy) + ')' }]
      .concat(REVIEW_STRATEGIES.map(x => ({ v:x.v, label:x.label })))
      .forEach(o => stratSel.appendChild(h('option', { value:o.v, selected:o.v === dStrategy }, o.label)));
    stratSel.addEventListener('change', () => { dStrategy = stratSel.value; });

    const methodSel = h('select', { id:'dm-method' });
    [{ v:'inherit', label:'Usar o padrão geral (' + methodLabel(state.settings.defaultReviewMethod) + ')' }]
      .concat(REVIEW_METHODS.map(m => ({ v:m.v, label:m.label })))
      .forEach(o => methodSel.appendChild(h('option', { value:o.v, selected:o.v === dMethod }, o.label)));
    methodSel.addEventListener('change', () => { dMethod = methodSel.value; });

    const advanced = h('details', { style:'margin-top:4px' },
      h('summary', { style:'cursor:pointer;font-size:12.5px;color:var(--muted)' }, 'Opções avançadas'),
      h('div', { style:'margin-top:10px' },
        h('div', { class:'field' }, h('label', { for:'dm-prio' }, 'Prioridade detalhada', helpDot('prioridade')), prioSel,
          h('p', { class:'hint', text:'Escala completa de 1 a 5, usada na distribuição do tempo.' })),
        state.areas.length ? null : h('div', { class:'field' },
          h('p', { class:'hint', text:'Você ainda não tem grupos (Áreas). Eles são opcionais e podem ser criados depois, na tela Disciplinas.' })),
        h('div', { class:'field' }, h('label', { for:'dm-nature' }, 'Natureza do conteúdo', helpDot('natureza')), natureSel,
          h('p', { class:'hint', text:'Orienta o método de revisão sugerido. Pode deixar em Mista.' })),
        h('div', { class:'field' }, h('label', { for:'dm-strategy' }, 'Estratégia de revisão', helpDot('estrategia')), stratSel),
        h('div', { class:'field' }, h('label', { for:'dm-method' }, 'Método de revisão', helpDot('metodo')), methodSel),
        h('div', { class:'field' }, h('label', { for:'dm-mpc' }, 'Minutos por crédito', helpDot('creditos')), mpcIn,
          h('p', { class:'hint', text:'Quantos minutos valem 1 crédito nesta disciplina. Usado no acompanhamento por créditos.' }))));

    const areaField = state.areas.length
      ? selectField('dm-area', 'Grupo (opcional)', areaOpts, areaId, e => { areaId = e.target.value; })
      : null;

    const content = h('div',
      h('div', { class:'field' },
        h('label', { for:'dm-name', text: disc ? 'Nome' : 'O que você está estudando?' }), nameIn,
        disc ? null : h('p', { class:'hint', text:'Ex.: Matemática, Inglês, Anatomia, Direito Constitucional, CCNA, Violão.' })),
      h('div', { class:'field' },
        h('label', null, 'Quanta atenção isso merece?', helpDot('prioridade')),
        prioSimple),
      areaField,
      areaField ? h('p', { class:'hint', style:'margin:-8px 0 12px', text:'Grupos são opcionais. No Ciclo eles se chamam Áreas.' }) : null,
      advanced
    );

    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text:'Salvar', onclick: async () => {
        const name = nameIn.value.trim();
        if(!name){ toast('Escreva o que você está estudando.', 'err'); return; }
        const dup = state.disciplines.find(x => !x.archived && x.name.toLowerCase() === name.toLowerCase() && (!disc || x.id !== disc.id));
        if(dup){ toast(`Você já tem "${dup.name}".`, 'err'); return; }
        const mpc = Math.max(1, Math.round(Number(mpcIn.value) || 20));
        close();
        try {
          if(disc){
            disc.name = name; disc.areaId = areaId || null; disc.priority = priority; disc.minutesPerCredit = mpc;
            disc.contentNature = nature; disc.reviewStrategy = dStrategy; disc.preferredReviewMethod = dMethod;
            await persist('disciplines', disc);
          } else {
            const d = newDiscipline(name, areaId || null, priority);
            d.minutesPerCredit = mpc; d.contentNature = nature;
            d.reviewStrategy = dStrategy; d.preferredReviewMethod = dMethod;
            await DB.put('disciplines', d);
          }
        } catch(err){
          console.error('Falha ao salvar a disciplina:', err);
          toast('Não foi possível salvar a disciplina.', 'err');
          return;
        }
        ui.planDraft = null;
        await refresh();
        toast(disc ? 'Alterações salvas.' : 'Pronto para estudar. Assuntos podem ser adicionados quando quiser.', 'ok',
          { title: disc ? `${name} atualizada` : `${name} adicionada` });
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

    let importance = topic ? (topic.importance || 'normal') : 'normal';
    let tStrategy = topic ? (topic.reviewStrategy || 'inherit') : 'inherit';
    let tMethod = topic ? (topic.preferredReviewMethod || 'inherit') : 'inherit';
    const disciplineOfTopic = getDiscipline(disciplineId);

    const impCtl = segmented(TOPIC_IMPORTANCES.map(i => ({ value:i.v, label:i.label })), importance,
      v => { importance = v; }, 'Importância do tópico');

    const tStratSel = h('select', { id:'tm-strategy' });
    [{ v:'inherit', label:'Usar o padrão da disciplina (' + strategyLabel(ReviewEngine.effectiveStrategy({ disciplineId, reviewStrategy:'inherit' })) + ')' }]
      .concat(REVIEW_STRATEGIES.map(x => ({ v:x.v, label:x.label })))
      .forEach(o => tStratSel.appendChild(h('option', { value:o.v, selected:o.v === tStrategy }, o.label)));
    tStratSel.addEventListener('change', () => { tStrategy = tStratSel.value; });

    const tMethodSel = h('select', { id:'tm-method' });
    [{ v:'inherit', label:'Usar o padrão da disciplina' }]
      .concat(REVIEW_METHODS.map(m => ({ v:m.v, label:m.label })))
      .forEach(o => tMethodSel.appendChild(h('option', { value:o.v, selected:o.v === tMethod }, o.label)));
    tMethodSel.addEventListener('change', () => { tMethod = tMethodSel.value; });

    const topicAdvanced = h('details', { style:'margin-top:12px' },
      h('summary', { style:'cursor:pointer;font-size:12.5px;color:var(--muted)' }, 'Personalizar revisão'),
      h('div', { style:'margin-top:10px' },
        h('p', { class:'hint', style:'margin-bottom:10px', text:'Por padrão este tópico segue a configuração da disciplina. Só mude se este conteúdo pedir algo diferente.' }),
        h('div', { class:'field' }, h('label', { for:'tm-strategy' }, 'Estratégia', helpDot('estrategia')), tStratSel),
        h('div', { class:'field' }, h('label', { for:'tm-method' }, 'Método', helpDot('metodo')), tMethodSel),
        topic && topic.reviewDueDate ? h('p', { class:'hint', text:`Alterar a estratégia não muda a próxima revisão já marcada (${fmtRelativeFuture(topic.reviewDueDate)}); ela passa a valer a partir da próxima resposta.` }) : null));

    const content = h('div',
      h('div', { class:'field' }, h('label', { for:'tm-name', text:'Nome do tópico' }), nameIn),
      h('div', { class:'field' }, h('label', null, 'Importância', helpDot('importancia')), impCtl),
      h('label', { style:'display:flex;align-items:center;gap:8px;margin:0' }, revChk, 'Incluir no ciclo de revisão'),
      topicAdvanced,
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
          topic.importance = importance; topic.reviewStrategy = tStrategy; topic.preferredReviewMethod = tMethod;
          await persist('topics', topic);
          await refresh();
          toast(name, 'ok', { title:'Assunto atualizado' });
        } else {
          const lines = (($('#tm-multi') || {}).value || '').split('\n').map(s => s.trim()).filter(Boolean);
          if(!lines.length){ toast('Informe ao menos um tópico.', 'err'); return; }
          close();
          const existing = topicsOf(disciplineId, true);
          let order = existing.length ? Math.max(...existing.map(t => t.sortOrder || 0)) : 0;
          const created = lines.map(name => {
            order += 10;
            const t = newTopic(disciplineId, name, order);
            t.reviewEnabled = revChk.checked;
            t.importance = importance; t.reviewStrategy = tStrategy; t.preferredReviewMethod = tMethod;
            return t;
          });
          await DB.putMany('topics', created);
          await refresh();
          const dname = (getDiscipline(disciplineId) || {}).name || '';
          toast(created.length === 1
            ? `${created[0].name} · ${dname}`
            : created.slice(0, 3).map(t => t.name).join(', ') + (created.length > 3 ? ` e mais ${created.length - 3}` : '') + ` · ${dname}`,
            'ok', { title: created.length === 1 ? 'Assunto adicionado' : `${created.length} assuntos adicionados` });
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
    metrics.push(statBox(fmtPct(a.planAdherence.pct), METRIC_WORDS.adherence.title,
      { text:`${fmtDuration(a.planAdherence.realized)} das ${fmtDuration(a.planAdherence.planned)} planejadas`, dir:'' }));
    metrics.push(statBox(`${fmtDuration(a.planAdherence.realized)} / ${fmtDuration(a.planAdherence.planned)}`, 'realizado / planejado'));
  }
  if(a.reviews.expected > 0 || a.reviews.completed > 0){
    metrics.push(statBox(`${a.reviews.completed}/${a.reviews.expected}`, 'revisões concluídas'));
    if(a.reviews.overdueNow) metrics.push(statBox(String(a.reviews.overdueNow), 'revisões atrasadas'));
  }
  parts.push(h('div', { class:'card' },
    h('p', { class:'card-title' }, 'Métricas do período', helpDot('creditos')),
    h('div', { class:'stat-grid' }, metrics)));

  /* --- gráfico temporal --- */
  parts.push(card('Tempo estudado ao longo do período', timeChart(a)));

  // a partir daqui, os cards formam uma grade de duas colunas no desktop largo
  const gridStart = parts.length;

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
    const c = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Planejado × realizado por disciplina', helpDot('aderencia')));
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
    const c = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Progresso no conteúdo', helpDot('cobertura')),
      h('div', { class:'stat-grid', style:'margin-bottom:12px' },
        statBox(`${a.content.covered} de ${a.content.totalTopics}`, METRIC_WORDS.coverage.title,
          { text:`${fmtPct(a.content.coverage)} · também chamado de cobertura`, dir:'' }),
        statBox(`${a.content.mastered} de ${a.content.totalTopics}`, METRIC_WORDS.mastery.title,
          { text:`${fmtPct(a.content.masteryPct)} · também chamado de domínio`, dir:'' }),
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
  const diffCard = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Dificuldade percebida', helpDot('dificuldade')));
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
  const typeCard = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Tipos de sessão', helpDot('tiposessao')));
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

    if(a.reviews.avgMastery !== null){
      rc.append(h('p', { class:'hint', style:'margin-top:10px' },
        `Domínio médio dos tópicos em revisão: ${fmtNumber(a.reviews.avgMastery,1)}/5.`, helpDot('dominio')));
    }

    if(a.reviews.byMethod.length){
      rc.append(h('p', { class:'card-title', style:'margin-top:14px' }, 'Métodos usados', helpDot('metodo')));
      const mm = Math.max(1, ...a.reviews.byMethod.map(x => x.used));
      a.reviews.byMethod.forEach(x => rc.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text:x.label }),
        h('div', { class:'hbar' }, h('span', { style:`width:${(x.used/mm)*100}%` })),
        h('span', { class:'hv', text: x.used + '×' }))));
      // só comenta o desempenho quando há amostra suficiente, e sem afirmar causa
      const solid = a.reviews.byMethod.filter(x => x.used >= 5);
      if(solid.length){
        const best = solid.slice().sort((x,y) => y.rate - x.rate)[0];
        rc.append(h('p', { class:'hint', style:'margin-top:8px',
          text:`Nas últimas ${best.used} revisões com ${best.label.toLowerCase()}, ${best.good} tiveram resultado "Lembrei bem" ou "Dominei".` }));
      }
    }

    if(a.reviews.forgetful.length){
      rc.append(h('p', { class:'card-title', style:'margin-top:14px', text:'Esquecidos com mais frequência' }));
      a.reviews.forgetful.forEach(t => rc.append(h('div', { class:'hbar-row' },
        h('span', { class:'hl', text:t.name }),
        h('div', { class:'hbar' }, h('span', { style:`width:${clamp((t.reviewFailures/5)*100,10,100)}%;background:var(--danger)` })),
        h('span', { class:'hv', text: t.reviewFailures + '×' }))));
    }
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

  const gridItems = parts.splice(gridStart);
  parts.push(h('div', { class:'an-grid' }, gridItems));

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
  const c = h('div', { class:'card period-card' });
  const controls = h('div', { class:'period-controls' }, h('p', { class:'card-title', text:'Período' }));
  const presets = [
    ['hoje','Hoje'], ['7d','7 dias'], ['30d','30 dias'],
    ['semana','Esta semana'], ['mes','Este mês'], ['tudo','Tudo']
  ];
  controls.append(h('div', { class:'chips', style:'margin-bottom:14px' },
    presets.map(([v,l]) => h('button', { class:'chip', type:'button', 'aria-pressed': ui.periodPreset === v ? 'true':'false', text:l,
      onclick:() => applyPreset(v) })),
    h('button', { class:'chip', type:'button', 'aria-pressed': ui.periodPreset === null ? 'true':'false', text:'Personalizado',
      onclick:() => { ui.periodPreset = null; renderAnalytics(); } })
  ));

  const startIn = h('input', { type:'date', id:'per-start', value: dateToISO(ui.period.start) });
  const endIn = h('input', { type:'date', id:'per-end', value: dateToISO(ui.period.end) });
  controls.append(h('div', { class:'row auto', style:'margin-bottom:12px' },
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

  controls.append(h('p', { class:'period-summary' },
    h('span', { class:'num', text: `${rangeDays(ui.period)} ${rangeDays(ui.period) === 1 ? 'dia' : 'dias'}` }),
    h('span', { text: fmtRangeLabel(ui.period) })));
  c.append(controls, h('div', { class:'period-cal' }, calendarHeatmap()));
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
      'aria-label': `${fmtDateBR(iso)} — ${m > 0 ? fmtDuration(m) : 'sem registros'}` },
      h('span', { text:String(day) }),
      h('span', { class:'lv', style: lvl ? `background:var(--heat-${lvl})` : null }));
    Tooltip.attach(btn, () => dayTip(iso));
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
    h('span', { text:'mais' })));
  wrap.append(h('p', { class:'hint', style:'margin-top:6px', text:'Cor = minutos estudados no dia. Clique em dois dias para escolher um intervalo.' }));
  return wrap;
}

/** Detalhe de um dia no calendário: tempo, sessões e disciplinas. */
function dayTip(iso){
  const list = state.sessions.filter(x => x.date === iso);
  if(!list.length) return tipBody(fmtDateBR(iso), [], 'Sem registros neste dia.');
  const byDisc = new Map();
  list.forEach(x => byDisc.set(x.disciplineId, (byDisc.get(x.disciplineId) || 0) + x.minutes));
  const rows = [...byDisc.entries()].sort((a,b) => b[1] - a[1])
    .map(([id, min]) => [disciplineName(id), fmtDuration(min)]);
  const total = sum(list, x => x.minutes);
  return tipBody(fmtDateBR(iso), [
    ['Tempo', fmtDuration(total)],
    ['Sessões', String(list.length)],
    ['Disciplinas', String(byDisc.size)],
    '-'
  ].concat(rows));
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
  const chart = h('div', { class:'tchart' });
  series.forEach(s => {
    const col = h('div', { class:'tcol', tabindex:'0', role:'img',
      'aria-label': `${s.label}: ${fmtDuration(s.minutes)}` },
      h('div', { class:'tb', style:`height:${(s.minutes/max)*100}%` }),
      h('span', { class:'tl', text:s.label }));
    Tooltip.attach(col, () => bucketTip(s, granularity));
    chart.appendChild(col);
  });
  return chart;
}

/** Detalhe de uma barra do gráfico temporal: total e quebra por disciplina. */
function bucketTip(bucket, granularity){
  let list;
  if(granularity === 'day') list = state.sessions.filter(x => x.date === bucket.key);
  else if(granularity === 'week'){
    const ws = parseISO(bucket.key), we = addDays(ws, 6);
    list = sessionsInRange({ start:ws, end:we });
  } else {
    const [y, m] = bucket.key.split('-').map(Number);
    list = sessionsInRange({ start:new Date(y, m, 1), end:new Date(y, m + 1, 0) });
  }
  const byDisc = new Map();
  list.forEach(x => byDisc.set(x.disciplineId, (byDisc.get(x.disciplineId) || 0) + x.minutes));
  const rows = [...byDisc.entries()].sort((a,b) => b[1] - a[1]).slice(0, 5)
    .map(([id, min]) => [disciplineName(id), fmtDuration(min)]);
  const head = granularity === 'day' ? fmtDateBR(bucket.key) : bucket.label;
  const sub = `${fmtDuration(bucket.minutes)} · ${list.length} ${list.length === 1 ? 'sessão' : 'sessões'}`;
  return tipBody(head, rows.length ? [[sub, '']].concat(['-']).concat(rows) : [], rows.length ? null : sub);
}

function donutChart(rows){
  const total = sum(rows, r => r.minutes);
  const R = 45, C = 60, circ = 2 * Math.PI * R;
  const svg = svgEl('svg', { id:'donut-svg', viewBox:'0 0 120 120', class:'donut', role:'img', 'aria-label':'Distribuição do tempo' });
  svg.append(svgEl('circle', { cx:C, cy:C, r:R, fill:'none', stroke:'var(--line-soft)', 'stroke-width':16 }));
  let offset = 0;
  rows.forEach((r, i) => {
    const seg = (r.minutes / total) * circ;
    svg.append(svgEl('circle', { cx:C, cy:C, r:R, fill:'none', stroke:PALETTE[i % PALETTE.length], 'stroke-width':16,
      'stroke-dasharray':`${seg} ${circ - seg}`, 'stroke-dashoffset':-offset, transform:`rotate(-90 ${C} ${C})`,
      'data-seg': String(i) }));
    offset += seg;
  });
  return svg;
}
function donutLegend(rows, total){
  const box = h('div', { class:'legend' });
  rows.forEach((r, i) => {
    const row = h('div', { class:'legend-row', 'data-hoverable':'1', tabindex:'0' },
      h('span', { class:'sw', style:`background:${PALETTE[i % PALETTE.length]}` }),
      h('span', { class:'lb', text:r.label }),
      h('span', { class:'num', style:'font-size:12px', text:`${fmtDuration(r.minutes)} (${fmtNumber(r.pct,0)}%)` }));
    const highlight = (on) => {
      const svg = $('#donut-svg');
      if(!svg) return;
      if(on){ svg.setAttribute('data-dim','1'); const c = svg.querySelector(`circle[data-seg="${i}"]`); if(c) c.setAttribute('data-active','1'); }
      else { svg.removeAttribute('data-dim'); $$('circle[data-active]', svg).forEach(c => c.removeAttribute('data-active')); }
    };
    row.addEventListener('mouseenter', () => highlight(true));
    row.addEventListener('mouseleave', () => highlight(false));
    row.addEventListener('focus', () => highlight(true));
    row.addEventListener('blur', () => highlight(false));
    Tooltip.attach(row, () => tipBody(r.label, [
      ['Tempo', fmtDuration(r.minutes)],
      ['Participação', fmtNumber(r.pct,1) + '%'],
      ['Sessões', String(r.count)]
    ]));
    box.appendChild(row);
  });
  void total;
  return box;
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
  if(await copyToClipboard(text)){
    toast('Cole onde quiser: anotações, mensagem ou planilha.', 'ok', { title:'Resumo copiado' });
  } else {
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
      h('td', { class:'actions row-actions' },
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
/** Exporta o backup completo e confirma com um aviso claro. */
async function exportBackupWithFeedback(){
  try {
    await Backup.exportJSON();
  } catch(err){
    console.error('Falha ao exportar o backup:', err);
    toast('Tente novamente. Seus dados continuam intactos.', 'err', { title:'Não foi possível exportar o backup' });
    return;
  }
  await refresh();
  toast(`ciclo_backup_${todayISO()}.json · guarde o arquivo fora deste computador também.`, 'ok', { title:'Backup exportado' });
}
function exportCSVWithFeedback(){
  try { Backup.exportCSV(); }
  catch(err){ console.error(err); toast('Tente novamente.', 'err', { title:'Não foi possível exportar o CSV' }); return; }
  toast(`${state.sessions.length} sessão(ões) em ciclo_sessoes_${todayISO()}.csv`, 'ok', { title:'Sessões exportadas' });
}
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
      h('button', { class:'btn primary', type:'button', text:'Exportar backup (.json)', onclick: once(exportBackupWithFeedback) }),
      h('button', { class:'btn ghost', type:'button', text:'Exportar sessões (.csv)', onclick: once(exportCSVWithFeedback) })));

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

  mount(root, h('div', { class:'data-grid' }, info, counts, exportCard, importCard), v2Card, danger);
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
            toast(`${d.disciplines.length} disciplina(s) e ${d.sessions.length} sessão(ões) restauradas.`, 'ok', { title:'Backup restaurado' });
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
      guardModalActions($('#modal-actions'));
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
    return { title:'Bem-vindo ao Ciclo', content: body, actions: [] };
  }, { size:'wide', dismissible:false });

  if(rebuildRef) rebuildRef();
}

/* =========================================================================
   RENDER — despachante por tela
   ========================================================================= */
function render(){
  updateBadges();
  renderTimerBar();
  renderTips();
  switch(ui.view){
    case 'today':       renderToday(); break;
    case 'plan':        renderPlan(); break;
    case 'reviews':     renderReviews(); break;
    case 'disciplines': renderDisciplines(); break;
    case 'analytics':   renderAnalytics(); break;
    case 'history':     renderHistory(); break;
    case 'help':        renderHelp(); break;
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
        [['disciplines','Disciplinas'], ['history','Histórico'], ['help','Ajuda'], ['data','Dados'], ['settings','Configurações']].map(([v,l]) =>
          h('button', { class:'btn ghost block', type:'button', text:l, onclick:() => { close(); setView(v); } }))),
      actions:[ h('button', { class:'btn ghost', type:'button', text:'Fechar', onclick:() => close() }) ]
    }), { size:'narrow' });
  });

  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#theme-toggle-m').addEventListener('click', toggleTheme);

  $('#open-palette').addEventListener('click', () => Palette.open());
  $('#screen-help').addEventListener('click', () => openScreenHelp());
  $('#drawer-close').addEventListener('click', () => Drawer.close());

  // Tema 'system' acompanha o sistema operacional enquanto a página está aberta.
  if(systemThemeQuery){
    // Só reage quando a preferência é 'system'; nunca sobrescreve uma escolha explícita.
    const onSystemTheme = () => { if(state.settings.theme === 'system') applyTheme('system'); };
    if(systemThemeQuery.addEventListener) systemThemeQuery.addEventListener('change', onSystemTheme);
    else if(systemThemeQuery.addListener) systemThemeQuery.addListener(onSystemTheme);
  }

  DesktopFx.bind();

  $('#fab').addEventListener('click', () => {
    if(TimerService.isActive){ openFinishModal(); return; }
    // v5: quem ainda não registrou nada entra pela rota mais curta
    if(state.sessions.length < 3) openQuickStart(); else openRegisterModal();
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' ||
                   (e.target && e.target.isContentEditable);

    // Ctrl/⌘ + K funciona mesmo com foco em campo, exceto dentro da própria palette.
    if((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
      e.preventDefault();
      Palette.isOpen ? Palette.close() : Palette.open();
      return;
    }

    if(e.key === 'Escape'){
      if(Palette.isOpen || FocusMode.isOpen || Drawer.isOpen) return;  // cada um trata o seu Esc
      if(!$('#modal-root').hidden) return;                             // modal trata o seu
      Tooltip.hide();
      return;
    }

    if(e.ctrlKey || e.metaKey || e.altKey) return;
    if(typing) return;
    if(!$('#modal-root').hidden || Palette.isOpen || Drawer.isOpen || FocusMode.isOpen) return;

    const k = e.key.toLowerCase();
    if(k === 'r'){ e.preventDefault(); TimerService.isActive ? openFinishModal() : openRegisterModal(); }
    else if(k === 'h'){ e.preventDefault(); setView('today'); }
    else if(k === 'p'){ e.preventDefault(); setView('plan'); }
    else if(k === 'v'){ e.preventDefault(); setView('reviews'); }
    else if(k === 'a'){ e.preventDefault(); setView('analytics'); }
    else if(e.key === '?'){ e.preventDefault(); setView('help'); }
  });

  // A busca de comandos filtra conforme você digita.
  $('#palette-input').addEventListener('input', (e) => Palette.filter(e.target.value));

  // Fecha tooltip ao rolar a página (o ancoradouro pode sair do lugar).
  window.addEventListener('scroll', () => { if(Tooltip.current) Tooltip.hide(); }, { passive:true });

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

  let migrationV4 = null;
  let migration = null;
  try {
    migration = await runV2Migration();
  } catch(err){
    console.error('Falha na migração V2:', err);
    toast('Não foi possível migrar automaticamente os dados da versão anterior. Eles continuam salvos e podem ser importados em Dados.', 'err');
  }

  // v3 → v4: acrescenta campos novos sem tocar na agenda de revisões
  try {
    migrationV4 = await runV4Migration();
  } catch(err){
    console.error('Falha na migração v4:', err);
    toast('Não foi possível concluir a atualização do formato de dados.', 'err');
  }

  await loadAll();
  applyTheme(state.settings.theme);
  applyDensity(state.settings.density);
  applyReduceMotion(state.settings.reduceMotion);
  applyPresetSilently(state.settings.defaultPeriod || 'semana');

  await PlannerEngine.ensureWeeklyPlan();

  TimerService.restore();
  bindEvents();
  state.ready = true;

  // v5: o primeiro acesso depende só de existir algo cadastrado. Plano não é pré-requisito.
  const needsSetup = !state.meta.onboardingCompleted && !activeDisciplines().length && !state.sessions.length;
  setView(needsSetup ? 'today' : (state.settings.startView || 'today'));

  if(TimerService.isActive) offerStaleSession();

  // Onboarding: só para quem ainda não tem plano nem disciplinas configuradas.
  if(needsSetup){
    openWelcome();
  } else if(migration && migration.migrated){
    toast(`Dados da V2 migrados: ${migration.counts.disciplines} disciplina(s), ${migration.counts.sessions} sessão(ões).`, 'ok');
  } else {
    maybeShowWhatsNew();
  }
  void migrationV4;

  // Primeira revisão: ensina fazendo, no momento em que ela aparece.
  // Espera qualquer modal de abertura (boas-vindas/novidades) ser resolvido.
  setTimeout(function waitThenOffer(){
    if(!$('#modal-root').hidden){ setTimeout(waitThenOffer, 1200); return; }
    maybeOfferFirstReview();
  }, 1000);
}
/* =========================================================================
   HELP ENGINE — busca local, sem rede, tolerante a acentos.
   ========================================================================= */
function normalizeText(s){
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function articleText(a){
  const parts = [a.title, a.summary, a.keywords];
  (a.content || []).forEach(b => {
    if(b.p) parts.push(b.p);
    if(b.h) parts.push(b.h);
    if(b.ul) parts.push(b.ul.join(' '));
  });
  return parts.join(' ');
}

/** Índice de busca da ajuda, construído uma vez. */
const HELP_INDEX = HELP_ARTICLES.map(a => ({
  article: a,
  nTitle: normalizeText(a.title),
  nKeywords: normalizeText(a.keywords + ' ' + a.summary),
  nBody: normalizeText(articleText(a))
}));
const FAQ_INDEX = HELP_FAQ.map((f, i) => ({ faq:f, i, n: normalizeText(f.q + ' ' + f.a) }));
const GUIDE_INDEX = STUDY_GUIDES.map(g => ({ g, n: normalizeText(
  [g.title, g.summary, g.oneLine, g.keywords, g.what, g.why, g.example, g.inApp, (g.how || []).join(' ')].join(' ')) }));
const INTERACTIVE_INDEX = INTERACTIVE_GUIDES.map(g => ({ g, n: normalizeText(
  [g.title, g.oneLine, g.what, (g.examples || []).join(' ')].join(' ')) }));
const GLOSSARY_INDEX = HELP_GLOSSARY.map(g => ({ g, n: normalizeText(g.t + ' ' + g.d) }));

function getArticle(id){ return HELP_ARTICLES.find(a => a.id === id) || null; }
function categoryLabel(id){ const c = HELP_CATEGORIES.find(x => x.id === id); return c ? c.label : ''; }

/** Busca por termos: cada termo precisa aparecer em algum campo. Pontua título > keywords > corpo. */
function searchHelp(query){
  const q = normalizeText(query);
  if(q.length < 2) return { articles:[], faq:[], glossary:[], guides:[], interactive:[] };
  const terms = q.split(' ').filter(Boolean);

  const articles = HELP_INDEX.map(e => {
    let score = 0;
    for(const t of terms){
      if(e.nTitle.includes(t)) score += 10;
      else if(e.nKeywords.includes(t)) score += 5;
      else if(e.nBody.includes(t)) score += 2;
      else return null;                      // termo ausente: descarta
    }
    if(e.nTitle === q) score += 20;
    if(e.nTitle.startsWith(q)) score += 8;
    return { article:e.article, score };
  }).filter(Boolean).sort((a,b) => b.score - a.score || a.article.title.localeCompare(b.article.title,'pt-BR'));

  const faq = FAQ_INDEX.filter(e => terms.every(t => e.n.includes(t))).map(e => e.faq);
  const glossary = GLOSSARY_INDEX.filter(e => terms.every(t => e.n.includes(t))).map(e => e.g);
  const guides = GUIDE_INDEX.filter(e => terms.every(t => e.n.includes(t))).map(e => e.g);
  const interactive = INTERACTIVE_INDEX.filter(e => terms.every(t => e.n.includes(t))).map(e => e.g);
  return { articles: articles.map(x => x.article), faq, glossary, guides, interactive };
}

/* =========================================================================
   TOOLTIP SERVICE — uma única raiz reutilizada, mouse e teclado.
   ========================================================================= */
const Tooltip = {
  el: null,
  timer: null,
  current: null,

  get root(){ if(!this.el) this.el = document.getElementById('tooltip-root'); return this.el; },
  get enabled(){ return state.settings.hoverHints !== false && state.settings.helpMode !== 'off'; },

  /** content: string | Node | () => (string|Node) */
  show(anchor, content, opts){
    if(!this.enabled && !(opts && opts.force)) return;
    const root = this.root;
    if(!root || !anchor) return;
    const value = typeof content === 'function' ? content() : content;
    if(!value) return;

    clear(root);
    if(value instanceof Node) root.appendChild(value);
    else root.textContent = String(value);

    root.hidden = false;
    this.current = anchor;
    this.position(anchor);
    requestAnimationFrame(() => root.setAttribute('data-show','1'));
  },

  position(anchor){
    const root = this.root;
    const r = anchor.getBoundingClientRect();
    const t = root.getBoundingClientRect();
    const gap = 9, pad = 8;
    let top = r.top - t.height - gap;
    let placeBelow = false;
    if(top < pad){ top = r.bottom + gap; placeBelow = true; }
    if(placeBelow && top + t.height > window.innerHeight - pad) top = Math.max(pad, r.top - t.height - gap);
    let left = r.left + (r.width / 2) - (t.width / 2);
    left = clamp(left, pad, Math.max(pad, window.innerWidth - t.width - pad));
    root.style.top = Math.round(top) + 'px';
    root.style.left = Math.round(left) + 'px';
  },

  hide(){
    const root = this.root;
    if(!root) return;
    root.removeAttribute('data-show');
    this.current = null;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { root.hidden = true; clear(root); }, 130);
  },

  /** Liga tooltip a um elemento (mouse + foco de teclado). */
  attach(el, content, opts){
    const o = opts || {};
    const open = () => { clearTimeout(this.timer); this.timer = setTimeout(() => this.show(el, content, o), o.delay === undefined ? 130 : o.delay); };
    const close = () => { clearTimeout(this.timer); this.hide(); };
    el.addEventListener('mouseenter', open);
    el.addEventListener('mouseleave', close);
    el.addEventListener('focus', () => this.show(el, content, o));
    el.addEventListener('blur', close);
    return el;
  }
};

/** Monta o corpo de um tooltip com título e linhas rótulo/valor. */
function tipBody(title, rows, footer){
  const box = document.createDocumentFragment();
  if(title) box.appendChild(h('strong', { text:title }));
  (rows || []).forEach(r => {
    if(r === '-'){ box.appendChild(h('div', { class:'tt-sep' })); return; }
    box.appendChild(h('div', { class:'tt-row' }, h('span', { text:r[0] }), h('span', { text:r[1] })));
  });
  if(footer) box.appendChild(h('div', { class:'tt-row', style:'margin-top:4px' }, h('span', { text:footer })));
  return box;
}

/** Botão "?" de ajuda contextual: tooltip no hover/foco, artigo no clique. */
function helpDot(key){
  const info = CONTEXT_HELP[key];
  if(!info || state.settings.helpMode === 'off') return null;
  const btn = h('button', {
    class:'helpdot', type:'button', text:'?',
    'aria-label': 'O que é ' + info.title + '?',
    onclick:(e) => { e.stopPropagation(); openHelpArticleDrawer(info.article); }
  });
  Tooltip.attach(btn, () => tipBody(info.title, [], info.tip));
  return btn;
}

/** Rótulo com "?" ao lado. */
function labelWithHelp(text, key, tag){
  return h(tag || 'span', null, text, helpDot(key));
}

/* =========================================================================
   DRAWER SERVICE — painel lateral para consulta e contexto.
   ========================================================================= */
const Drawer = {
  opener: null,
  open(title, contentNode, opts){
    const root = document.getElementById('drawer-root');
    const o = opts || {};
    const wasOpen = !root.hidden;
    // Trocar de conteúdo com o painel aberto mantém quem abriu o painel da primeira vez.
    if(!wasOpen) this.opener = document.activeElement;
    const content = document.getElementById('drawer-content');
    document.getElementById('drawer-title').textContent = title || '';
    mount(content, contentNode || null);
    content.scrollTop = 0;                       // novo conteúdo começa do topo
    if(wasOpen){
      content.classList.remove('is-swapping');
      void content.offsetWidth;                  // reinicia a transição de troca
      content.classList.add('is-swapping');
    }
    root.hidden = false;
    if(!wasOpen){
      document.addEventListener('keydown', this._onKey);
      root.addEventListener('mousedown', this._onBackdrop);
    }
    const focusable = document.getElementById('drawer-panel').querySelector('button,a,input,select,textarea');
    if(focusable) setTimeout(() => focusable.focus(), 40);
    if(o.onClose) this._onCloseCb = o.onClose;
  },
  close(){
    const root = document.getElementById('drawer-root');
    if(!root || root.hidden) return;
    root.hidden = true;
    clear(document.getElementById('drawer-content'));
    document.removeEventListener('keydown', this._onKey);
    root.removeEventListener('mousedown', this._onBackdrop);
    Tooltip.hide();
    if(this._onCloseCb){ const cb = this._onCloseCb; this._onCloseCb = null; cb(); }
    if(this.opener && document.contains(this.opener)) this.opener.focus();
    this.opener = null;
  },
  get isOpen(){ const r = document.getElementById('drawer-root'); return r && !r.hidden; },
  _onKey(e){ if(e.key === 'Escape'){ e.stopPropagation(); Drawer.close(); } },
  _onBackdrop(e){ if(e.target === document.getElementById('drawer-root')) Drawer.close(); }
};

/* =========================================================================
   COMMAND PALETTE — navegação, disciplinas, tópicos, ajuda e ações.
   ========================================================================= */
const Palette = {
  items: [],
  filtered: [],
  index: 0,
  opener: null,

  buildIndex(){
    const items = [];
    const push = (group, label, sub, icon, run, searchExtra) => items.push({ group, label, sub, icon, run, n: normalizeText(label + ' ' + (sub||'') + ' ' + (searchExtra||'')) });

    Object.keys(VIEW_TITLES).forEach(v => {
      push('Navegação', VIEW_TITLES[v], null, NAV_ICONS[v] || 'i-arrow', () => setView(v));
    });

    push('Ações', 'Registrar sessão', 'abre o cronômetro ou o registro manual', 'i-plus', () => openRegisterModal(), 'estudar iniciar timer');
    push('Ações', 'Fazer backup agora', 'exporta o arquivo .json', 'i-data', () => exportBackupWithFeedback(), 'exportar salvar copia');
    push('Ações', 'Exportar sessões (.csv)', 'para planilha', 'i-data', () => exportCSVWithFeedback(), 'planilha excel');
    push('Ações', 'Abrir revisões pendentes', null, 'i-review', () => setView('reviews'), 'revisar fila');
    push('Ações', 'Abrir configurações', null, 'i-settings', () => setView('settings'), 'preferencias tema');
    push('Ações', 'Alternar tema', null, 'i-sun', () => toggleTheme(), 'escuro claro dark light');
    if(TimerService.isActive){
      push('Ações', 'Finalizar sessão em andamento', null, 'i-play', () => openFinishModal(), 'parar terminar');
      push('Ações', 'Entrar no modo foco', null, 'i-focus', () => FocusMode.enter(), 'concentrar');
    }

    activeDisciplines().slice().sort(sortByName).forEach(d => {
      push('Disciplinas', d.name, areaNameOf(d), 'i-disc', () => openDisciplineDetail(d.id), 'disciplina ' + areaNameOf(d));
    });

    state.topics.filter(t => !t.archived).forEach(t => {
      const d = getDiscipline(t.disciplineId);
      if(!d || d.archived) return;
      push('Tópicos', t.name, d.name, 'i-disc', () => openTopicDrawer(t.id), 'topico estudar ' + d.name);
    });

    HELP_ARTICLES.forEach(a => {
      push('Ajuda', a.title, categoryLabel(a.cat), 'i-help', () => openHelpArticleDrawer(a.id), a.keywords + ' ' + a.summary);
    });
    STUDY_GUIDES.forEach(g => {
      push('Aprender a estudar', g.title, null, 'i-help', () => openStudyGuideDrawer(g.id), g.keywords + ' ' + g.summary);
    });
    INTERACTIVE_GUIDES.forEach(g => {
      push('Entender rapidamente', g.title, null, 'i-help', () => openInteractiveGuide(g.id), g.oneLine + ' ' + g.what);
    });
    push('Ações', 'Começar a estudar agora', 'escolha o que estudar e o tempo', 'i-play', () => openQuickStart(), 'sessao rapida iniciar');
    push('Ações', 'Montar sessão de revisão', 'escolha quanto tempo você tem', 'i-review', () => openSessionBuilder(), 'revisar fila tempo');
    push('Ações', 'Como funcionam as revisões', null, 'i-help', () => openReviewPrimer(), 'revisao entender explicacao');
    push('Ações', 'Entrar em contato', CONTACT_EMAIL, 'i-mail', () => openContactDrawer(), 'contato email suporte duvida sugestao');
    push('Ações', 'Relatar um problema', 'copie o relato ou abra no e-mail', 'i-flag', () => openReportProblemDrawer(), 'bug erro problema suporte');

    this.items = items;
  },

  open(){
    this.buildIndex();
    this.opener = document.activeElement;
    const root = document.getElementById('palette-root');
    const input = document.getElementById('palette-input');
    root.hidden = false;
    input.value = '';
    this.filter('');
    document.addEventListener('keydown', this._onKey, true);
    root.addEventListener('mousedown', this._onBackdrop);
    setTimeout(() => input.focus(), 30);
  },

  close(){
    const root = document.getElementById('palette-root');
    if(!root || root.hidden) return;
    root.hidden = true;
    document.removeEventListener('keydown', this._onKey, true);
    root.removeEventListener('mousedown', this._onBackdrop);
    if(this.opener && document.contains(this.opener)) this.opener.focus();
    this.opener = null;
  },

  get isOpen(){ const r = document.getElementById('palette-root'); return r && !r.hidden; },

  filter(query){
    const q = normalizeText(query);
    if(!q){
      const order = ['Navegação','Ações'];
      this.filtered = this.items.filter(i => order.includes(i.group)).slice(0, 12);
    } else {
      const terms = q.split(' ').filter(Boolean);
      this.filtered = this.items
        .map(i => {
          if(!terms.every(t => i.n.includes(t))) return null;
          const nl = normalizeText(i.label);
          let s = 0;
          if(nl === q) s += 30; else if(nl.startsWith(q)) s += 15; else if(nl.includes(q)) s += 8;
          if(i.group === 'Navegação') s += 3;
          if(i.group === 'Ações') s += 2;
          return { i, s };
        })
        .filter(Boolean)
        .sort((a,b) => b.s - a.s)
        .slice(0, 24)
        .map(x => x.i);
    }
    this.index = 0;
    this.render();
  },

  render(){
    const list = document.getElementById('palette-list');
    clear(list);
    if(!this.filtered.length){
      list.appendChild(h('li', { class:'palette-empty', text:'Nada encontrado. Tente outra palavra.' }));
      return;
    }
    let lastGroup = null;
    this.filtered.forEach((item, i) => {
      if(item.group !== lastGroup){
        lastGroup = item.group;
        list.appendChild(h('li', { class:'palette-group', text:item.group, role:'presentation' }));
      }
      const btn = h('button', { class:'palette-item', type:'button', role:'option',
        'aria-selected': i === this.index ? 'true' : 'false',
        onclick:() => this.run(i) },
        icon(item.icon, 'nav-icon'),
        h('span', { class:'pi-main', text:item.label }),
        item.sub ? h('span', { class:'pi-sub', text:item.sub }) : null);
      btn.addEventListener('mousemove', () => { if(this.index !== i){ this.index = i; this.syncSelection(); } });
      const li = h('li', { role:'presentation' }, btn);
      list.appendChild(li);
    });
    this.scrollToSelected();
  },

  syncSelection(){
    const btns = $$('#palette-list .palette-item');
    btns.forEach((b, i) => b.setAttribute('aria-selected', i === this.index ? 'true' : 'false'));
    this.scrollToSelected();
  },

  scrollToSelected(){
    const btns = $$('#palette-list .palette-item');
    const el = btns[this.index];
    if(el && el.scrollIntoView) el.scrollIntoView({ block:'nearest' });
  },

  move(delta){
    if(!this.filtered.length) return;
    this.index = (this.index + delta + this.filtered.length) % this.filtered.length;
    this.syncSelection();
  },

  run(i){
    const item = this.filtered[i === undefined ? this.index : i];
    if(!item) return;
    this.close();
    try { item.run(); } catch(err){ console.error(err); toast('Não foi possível executar esta ação.', 'err'); }
  },

  _onKey(e){
    if(!Palette.isOpen) return;
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); Palette.close(); }
    else if(e.key === 'ArrowDown'){ e.preventDefault(); Palette.move(1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); Palette.move(-1); }
    else if(e.key === 'Enter'){ e.preventDefault(); Palette.run(); }
  },
  _onBackdrop(e){ if(e.target === document.getElementById('palette-root')) Palette.close(); }
};

const NAV_ICONS = {
  today:'i-today', plan:'i-plan', reviews:'i-review', disciplines:'i-disc',
  analytics:'i-chart', history:'i-history', help:'i-help', data:'i-data', settings:'i-settings'
};

/* =========================================================================
   FOCUS MODE — estado visual da própria aplicação (sem Fullscreen API).
   ========================================================================= */
const FocusMode = {
  tick: null,
  enter(){
    if(!TimerService.isActive){ toast('Inicie uma sessão para usar o modo foco.', 'err'); return; }
    const root = document.getElementById('focus-root');
    root.hidden = false;
    document.documentElement.classList.add('focus-active');
    document.addEventListener('keydown', this._onKey, true);
    this.render();
    this.tick = setInterval(() => this.renderClock(), 1000);
    const first = document.querySelector('#focus-actions button');
    if(first) setTimeout(() => first.focus(), 40);
  },
  exit(){
    const root = document.getElementById('focus-root');
    if(!root || root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove('focus-active');
    document.removeEventListener('keydown', this._onKey, true);
    clearInterval(this.tick); this.tick = null;
  },
  get isOpen(){ const r = document.getElementById('focus-root'); return r && !r.hidden; },
  render(){
    if(!TimerService.isActive){ this.exit(); return; }
    const d = TimerService.data;
    const disc = getDiscipline(d.disciplineId);
    const topic = d.topicId ? getTopic(d.topicId) : null;
    document.getElementById('focus-disc').textContent = disc ? disc.name : '';
    document.getElementById('focus-topic').textContent = topic ? topic.name : (d.presetType ? sessionTypeLabel(d.presetType) : 'Sem tópico específico');
    this.renderClock();
    mount(document.getElementById('focus-actions'),
      h('button', { class:'btn ghost', type:'button', text: TimerService.isRunning ? 'Pausar' : 'Retomar',
        onclick:() => { TimerService.isRunning ? TimerService.pause() : TimerService.resume(); this.render(); renderTimerBar(); } }),
      h('button', { class:'btn primary', type:'button', text:'Finalizar', onclick:() => { this.exit(); openFinishModal(); } }),
      h('button', { class:'btn ghost', type:'button', text:'Sair do foco', onclick:() => this.exit() })
    );
  },
  renderClock(){
    if(!TimerService.isActive){ this.exit(); return; }
    document.getElementById('focus-clock').textContent = fmtClock(TimerService.getElapsed());
    document.getElementById('focus-state').textContent = TimerService.isRunning ? 'Sessão em andamento' : 'Sessão pausada';
  },
  _onKey(e){ if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); FocusMode.exit(); } }
};

/* =========================================================================
   DESKTOP INTERACTIONS — brilho radial discreto seguindo o mouse.
   ========================================================================= */
const DesktopFx = {
  frame: null,
  enabled(){
    if(state.settings.reduceMotion) return false;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  },
  bind(){
    // Delegação única no documento: nenhum listener por card.
    document.addEventListener('mousemove', (e) => {
      if(!this.enabled()) return;
      const card = e.target.closest ? e.target.closest('.card.interactive') : null;
      if(!card) return;
      if(this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', Math.round(e.clientX - r.left) + 'px');
        card.style.setProperty('--mouse-y', Math.round(e.clientY - r.top) + 'px');
      });
    }, { passive:true });
  }
};

/* =========================================================================
   RENDER — CENTRAL DE AJUDA
   ========================================================================= */
const helpUi = { query:'', category:null, exampleId:'faculdade', openFaq:null };

function articleNode(a){
  const box = h('div', { class:'help-article prose' });
  (a.content || []).forEach(b => {
    if(b.h) box.appendChild(h('h4', { text:b.h }));
    if(b.p) box.appendChild(h('p', { text:b.p }));
    if(b.ul) box.appendChild(h('ul', null, b.ul.map(li => h('li', { text:li }))));
  });
  return box;
}

function openHelpArticleDrawer(id){
  const a = getArticle(id);
  if(!a) return;
  const related = HELP_ARTICLES.filter(x => x.cat === a.cat && x.id !== a.id).slice(0, 3);
  const body = h('div',
    h('p', { class:'hi-cat', text: categoryLabel(a.cat).toUpperCase() }),
    articleNode(a),
    related.length ? h('div', { style:'margin-top:18px' },
      h('p', { class:'card-title', text:'Relacionados' }),
      related.map(r => h('button', { class:'help-item', type:'button', onclick:() => openHelpArticleDrawer(r.id) },
        h('span', { class:'hi-main' }, h('div', { class:'hi-title', text:r.title }), h('div', { class:'hi-sum', text:r.summary }))))
    ) : null,
    h('div', { style:'margin-top:18px' },
      h('button', { class:'btn ghost sm', type:'button', text:'Abrir Central de Ajuda',
        onclick:() => { Drawer.close(); helpUi.query = ''; helpUi.category = a.cat; setView('help'); } }))
  );
  Drawer.open(a.title, body);
}

function renderHelp(){
  const root = $('#help-body');
  const parts = [];

  /* busca */
  const input = h('input', { type:'search', id:'help-q', value: helpUi.query,
    placeholder:'Buscar na ajuda… (ex.: backup, revisão, aderência)', 'aria-label':'Buscar na ajuda' });
  input.addEventListener('input', () => {
    helpUi.query = input.value;
    renderHelpResults();
    const el = $('#help-q');
    if(el && document.activeElement !== el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  parts.push(h('div', { class:'card' },
    h('div', { class:'help-search' }, icon('i-search'), input),
    h('p', { class:'hint', text:'A busca é local: funciona offline, sem acento e procura em títulos, palavras-chave e conteúdo.' })));

  // v5 — quatro portas: começar, usar, aprender e dúvidas
  const doors = [
    ['start', 'Como começar',      'Os primeiros passos, com exemplos e ações prontas.'],
    ['use',   'Usar o Ciclo',     'Planejar, registrar, revisar, analisar e fazer backup.'],
    ['learn', 'Aprender a estudar','O que é revisão, por que reler engana, recuperação ativa e mais.'],
    ['faq',   'Dúvidas frequentes','Respostas curtas para as perguntas mais comuns.']
  ];
  parts.push(h('div', { class:'doors doors-4' }, doors.map(([id, title, sub]) =>
    h('button', { class:'door' + (ui.helpDoor === id ? ' active' : ''), type:'button',
      onclick:() => { ui.helpDoor = id; helpUi.category = null; renderHelpResults(); } },
      h('span', { class:'door-title', text:title }),
      h('span', { class:'door-sub', text:sub })))));

  parts.push(h('div', { id:'help-results' }));
  mount(root, parts);
  renderHelpResults();
}

function renderHelpResults(){
  const box = $('#help-results');
  if(!box) return;
  clear(box);
  const q = helpUi.query.trim();

  /* ---- resultados de busca ---- */
  if(q.length >= 2){
    const res = searchHelp(q);
    const total = res.articles.length + res.faq.length + res.glossary.length +
                  (res.guides ? res.guides.length : 0) + (res.interactive ? res.interactive.length : 0);
    const c = h('div', { class:'card' },
      h('div', { class:'card-head' },
        h('p', { class:'card-title', style:'margin:0', text: total ? `${total} resultado(s) para "${q}"` : `Nada encontrado para "${q}"` }),
        h('button', { class:'linkbtn', type:'button', text:'limpar busca', onclick:() => { helpUi.query = ''; renderHelp(); } })));
    if(!total){
      c.appendChild(h('p', { class:'hint', text:'Tente outra palavra — por exemplo: backup, revisão, prioridade, aderência, celular, cronômetro.' }));
    } else {
      if(res.interactive && res.interactive.length){
        c.appendChild(h('p', { class:'card-title', text:'Entender rapidamente' }));
        res.interactive.forEach(g => c.appendChild(h('button', { class:'help-item', type:'button', onclick:() => openInteractiveGuide(g.id) },
          h('span', { class:'hi-main' }, h('div', { class:'hi-title', text:g.title }), h('div', { class:'hi-sum', text:g.oneLine })))));
      }
      res.articles.forEach(a => c.appendChild(helpItemButton(a)));
      if(res.guides && res.guides.length){
        c.appendChild(h('p', { class:'card-title', style:'margin-top:14px', text:'Aprender a estudar' }));
        res.guides.forEach(g => c.appendChild(h('button', { class:'help-item', type:'button', onclick:() => openStudyGuideDrawer(g.id) },
          h('span', { class:'hi-main' }, h('div', { class:'hi-title', text:g.title }), h('div', { class:'hi-sum', text:g.summary })))));
      }
      if(res.faq.length){
        c.appendChild(h('p', { class:'card-title', style:'margin-top:14px', text:'Dúvidas frequentes' }));
        res.faq.forEach(f => c.appendChild(faqNode(f, true)));
      }
      if(res.glossary.length){
        c.appendChild(h('p', { class:'card-title', style:'margin-top:14px', text:'Glossário' }));
        c.appendChild(h('div', { class:'glossary' }, res.glossary.map(g =>
          h('dl', { class:'gloss-item' }, h('dt', { text:g.t }), h('dd', { text:g.d })))));
      }
    }
    box.appendChild(c);
    return;
  }

  /* ---- categoria aberta ---- */
  if(helpUi.category){
    const cat = HELP_CATEGORIES.find(c => c.id === helpUi.category);
    const arts = HELP_ARTICLES.filter(a => a.cat === helpUi.category);
    const c = h('div', { class:'card' },
      h('div', { class:'card-head' },
        h('p', { class:'card-title', style:'margin:0', text: cat ? cat.label.toUpperCase() : '' }),
        h('button', { class:'linkbtn', type:'button', text:'todas as categorias', onclick:() => { helpUi.category = null; renderHelpResults(); } })));
    arts.forEach(a => c.appendChild(helpItemButton(a)));
    box.appendChild(c);
    return;
  }

  /* ---- porta "Como começar" ---- */
  if(ui.helpDoor === 'start'){
    const prog = startProgress();
    box.appendChild(h('div', { class:'card interactive' },
      h('p', { class:'card-title', text:'Em cinco passos' }),
      h('p', { class:'hint prose', style:'margin-bottom:12px', text:'Você não precisa seguir esta ordem. Cada passo pode ser feito quando fizer sentido para você.' }),
      (() => {
        const list = h('ol', { class:'steps-num' });
        prog.steps.forEach(st => list.append(h('li', { class: st.done ? 'done' : '' },
          h('div', { class:'sn-main' },
            h('div', { class:'sn-title', text:st.title }),
            h('div', { class:'sn-text', text:st.text }),
            h('div', { class:'sn-ex', text:st.example })),
          st.done
            ? h('span', { class:'ck-ok', text:'feito' })
            : h('button', { class:'btn ghost sm', type:'button', text:st.actionLabel,
                onclick:() => { const fn = START_ACTIONS[st.action]; if(fn) fn(); } }))));
        return list;
      })()));

    const ig = h('div', { class:'card' }, h('p', { class:'card-title', text:'Entender os conceitos' }),
      h('p', { class:'hint', style:'margin-bottom:10px', text:'Explicações curtas, com exemplo e a ação pronta para executar.' }));
    INTERACTIVE_GUIDES.forEach(g => ig.appendChild(
      h('button', { class:'help-item', type:'button', onclick:() => openInteractiveGuide(g.id) },
        h('span', { class:'hi-main' },
          h('div', { class:'hi-title', text:g.title }),
          h('div', { class:'hi-sum', text:g.oneLine })),
        icon('i-arrow', 'nav-icon'))));
    box.appendChild(ig);
    box.appendChild(contactCard());
    return;
  }

  /* ---- porta "Dúvidas frequentes" ---- */
  if(ui.helpDoor === 'faq'){
    const c = h('div', { class:'card' }, h('p', { class:'card-title', text:'Dúvidas frequentes' }));
    HELP_FAQ.forEach(f => c.appendChild(faqNode(f, false)));
    box.appendChild(c);
    box.appendChild(h('div', { class:'card' },
      h('p', { class:'card-title', text:'Glossário' }),
      h('p', { class:'hint', style:'margin-bottom:10px', text:'Os termos usados na interface, explicados em uma linha.' }),
      h('div', { class:'glossary' }, HELP_GLOSSARY.map(g =>
        h('dl', { class:'gloss-item' }, h('dt', { text:g.t }), h('dd', { text:g.d }))))));
    box.appendChild(contactCard());
    return;
  }

  /* ---- porta "Aprender a estudar" ---- */
  if(ui.helpDoor === 'learn'){
    box.appendChild(h('div', { class:'card interactive' },
      h('p', { class:'card-title', text:'Aprender a estudar' }),
      h('p', { class:'hint prose', style:'margin-bottom:12px', text:'Uma base curta e prática. Cada texto responde: o que é, por que é útil, como fazer, um exemplo e como isso aparece no Ciclo.' }),
      h('div', { class:'row auto' },
        h('button', { class:'btn primary sm', type:'button', text:'Começar pelo básico', onclick:() => openStudyGuideDrawer('o-que-e-estudar') }),
        h('button', { class:'btn ghost sm', type:'button', text:'Por que não basta reler?', onclick:() => openStudyGuideDrawer('reconhecer-x-lembrar') }))));

    const gc = h('div', { class:'card' }, h('p', { class:'card-title', text:'Conceitos' }));
    STUDY_GUIDES.forEach(g => gc.appendChild(
      h('button', { class:'help-item', type:'button', onclick:() => openStudyGuideDrawer(g.id) },
        h('span', { class:'hi-main' },
          h('div', { class:'hi-title', text:g.title }),
          h('div', { class:'hi-sum', text:g.oneLine || g.summary })),
        icon('i-arrow', 'nav-icon'))));
    box.appendChild(gc);

    const mc = h('div', { class:'card' }, h('p', { class:'card-title', text:'Métodos de revisão, em uma linha' }));
    CONCRETE_METHODS.forEach(mv => {
      const g = REVIEW_METHOD_GUIDES[mv];
      mc.appendChild(h('div', { class:'method-line' },
        h('strong', { text:g.label }), h('span', { text:g.short }),
        h('span', { class:'ml-good', text:g.good })));
    });
    box.appendChild(mc);
    box.appendChild(contactCard());
    return;
  }

  /* ---- início: primeiros passos + categorias + exemplos + faq + glossário + contato ---- */
  const start = getArticle('primeiros-passos');
  box.appendChild(h('div', { class:'card interactive' },
    h('p', { class:'card-title', text:'Comece por aqui' }),
    h('p', { class:'hi-title', style:'font-size:16px;margin-bottom:4px', text: start.title }),
    h('p', { class:'hint', style:'margin-bottom:12px', text: start.summary }),
    h('div', { class:'row auto' },
      h('button', { class:'btn primary sm', type:'button', text:'Ler primeiros passos', onclick:() => openHelpArticleDrawer('primeiros-passos') }),
      h('button', { class:'btn ghost sm', type:'button', text:'Como montar um bom planejamento', onclick:() => openHelpArticleDrawer('primeiro-plano') }))));

  const checklist = startHereChecklistCard();
  if(checklist) box.appendChild(checklist);

  const cats = h('div', { class:'help-cats' });
  HELP_CATEGORIES.forEach(cat => {
    const arts = HELP_ARTICLES.filter(a => a.cat === cat.id);
    cats.appendChild(h('button', { class:'help-cat', type:'button', onclick:() => { helpUi.category = cat.id; renderHelpResults(); window.scrollTo({ top:0, behavior: state.settings.reduceMotion ? 'auto':'smooth' }); } },
      h('h4', { text: cat.label.toUpperCase() }),
      h('ul', null, arts.slice(0,4).map(a => h('li', { text: a.title }))),
      arts.length > 4 ? h('div', { class:'more', text:`+ ${arts.length - 4} artigo(s)` }) : null));
  });
  box.appendChild(h('div', { class:'card' }, h('p', { class:'card-title', text:'Categorias' }), cats));

  /* exemplos */
  const ex = HELP_EXAMPLES.find(e => e.id === helpUi.exampleId) || HELP_EXAMPLES[0];
  const exBox = h('div', { class:'card' },
    h('p', { class:'card-title', text:'Exemplos de organização' }),
    h('p', { class:'hint', style:'margin-bottom:12px', text:'A plataforma não é de uma área específica. Veja como a mesma estrutura se adapta:' }),
    h('div', { class:'chips', style:'margin-bottom:12px' }, HELP_EXAMPLES.map(e =>
      h('button', { class:'chip', type:'button', 'aria-pressed': e.id === ex.id ? 'true':'false', text:e.label,
        onclick:() => { helpUi.exampleId = e.id; renderHelpResults(); } }))),
    h('div', { class:'example-out' },
      h('div', { class:'ex-line' }, h('span', { class:'ex-label', text:'ÁREA  ' }), ex.area),
      h('div', { class:'ex-line' }, h('span', { class:'ex-label', text:'DISCIPLINA  ' }), ex.discipline),
      h('div', { class:'ex-line' }, h('span', { class:'ex-label', text:'TÓPICOS' }),
        h('div', { class:'ex-topics' }, ex.topics.map(t => h('span', { class:'pill', text:t })))),
      h('p', { class:'hint', style:'margin-top:10px', text: ex.note })));
  box.appendChild(exBox);

  /* faq */
  const faqCard = h('div', { class:'card' }, h('p', { class:'card-title', text:'Dúvidas frequentes' }));
  HELP_FAQ.forEach(f => faqCard.appendChild(faqNode(f, false)));
  box.appendChild(faqCard);

  /* glossário */
  box.appendChild(h('div', { class:'card' },
    h('p', { class:'card-title', text:'Glossário' }),
    h('div', { class:'glossary' }, HELP_GLOSSARY.map(g =>
      h('dl', { class:'gloss-item' }, h('dt', { text:g.t }), h('dd', { text:g.d }))))));

  /* contato */
  box.appendChild(contactCard());
}

/**
 * Cartão de contato. Duas ações claras; copiar o endereço fica dentro do fluxo
 * de contato, que funciona mesmo sem aplicativo de e-mail configurado.
 */
function contactCard(){
  return h('div', { class:'card contact-card' },
    h('div', { class:'cc-main' },
      h('p', { class:'card-title', text:'Contato' }),
      h('p', { class:'hint', text:'Dúvidas, sugestões ou problemas.' }),
      h('p', { class:'cc-mail' }, icon('i-mail', 'nav-icon'), h('span', { class:'num', text: CONTACT_EMAIL }))),
    h('div', { class:'cc-actions' },
      h('button', { class:'btn primary sm', type:'button', onclick:() => openContactDrawer() }, icon('i-mail'), 'Entrar em contato'),
      h('button', { class:'btn ghost sm', type:'button', onclick:() => openReportProblemDrawer() }, icon('i-flag'), 'Relatar problema')));
}

function helpItemButton(a){
  return h('button', { class:'help-item', type:'button', onclick:() => openHelpArticleDrawer(a.id) },
    h('span', { class:'hi-main' },
      h('div', { class:'hi-cat', text: categoryLabel(a.cat).toUpperCase() }),
      h('div', { class:'hi-title', text:a.title }),
      h('div', { class:'hi-sum', text:a.summary })),
    icon('i-arrow', 'nav-icon'));
}

function faqNode(f, openByDefault){
  const item = h('div', { class:'faq-item' });
  const answer = h('div', { class:'faq-a', text:f.a, hidden: !openByDefault });
  const q = h('button', { class:'faq-q', type:'button', 'aria-expanded': openByDefault ? 'true':'false' },
    h('span', { text:f.q }), icon('i-chev', 'chev'));
  q.addEventListener('click', () => {
    const open = q.getAttribute('aria-expanded') === 'true';
    q.setAttribute('aria-expanded', open ? 'false' : 'true');
    answer.hidden = open;
  });
  item.append(q, answer);
  return item;
}

/* =========================================================================
   CONTATO E RELATO DE PROBLEMA (v5.1)
   O Ciclo não envia e-mails. `mailto:` é só uma conveniência: depende de um
   aplicativo de e-mail configurado no aparelho e, sem ele, o navegador pode
   simplesmente não fazer nada. Por isso todo fluxo oferece um caminho que
   sempre funciona — copiar o endereço ou o texto — e nunca diz "enviado".
   ========================================================================= */
const MAIL_SUBJECT_CONTACT = '[Ciclo] Contato';
const MAIL_SUBJECT_REPORT = '[Ciclo] Relato de problema';

/** Abre o aplicativo de e-mail do sistema, se houver um. Não garante nada. */
function openMail(subject, body){
  // Chamado também como handler: ignora um Event recebido por engano.
  const subj = typeof subject === 'string' && subject ? subject : MAIL_SUBJECT_CONTACT;
  const text = typeof body === 'string' ? body : '';
  const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subj)}${text ? '&body=' + encodeURIComponent(text) : ''}`;
  try {
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch(err){
    console.error('Falha ao acionar mailto:', err);
  }
  toast('Se nenhum aplicativo de e-mail abrir, use "Copiar" e envie pelo seu serviço de e-mail.', 'info',
    { title:'Pedimos ao sistema para abrir seu e-mail', duration:6000 });
}

/**
 * Copia texto para a área de transferência.
 * 1) Clipboard API  2) textarea temporário + execCommand('copy')  3) false.
 * Devolve true/false — quem chama decide o que mostrar se falhar.
 */
async function copyToClipboard(text){
  const value = String(text == null ? '' : text);
  try {
    if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext !== false){
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch(err){
    console.warn('Clipboard API indisponível ou negada; tentando alternativa.', err);
  }
  const previousFocus = document.activeElement;
  let ta = null;
  try {
    ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    return !!ok;
  } catch(err){
    console.warn('Cópia alternativa falhou.', err);
    return false;
  } finally {
    if(ta) ta.remove();
    if(previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)){
      try { previousFocus.focus({ preventScroll:true }); } catch(_){ previousFocus.focus(); }
    }
  }
}

/** Seleciona o conteúdo de um campo para cópia manual (último recurso). */
function selectForManualCopy(field){
  if(!field) return;
  field.focus();
  try { field.select(); field.setSelectionRange(0, field.value.length); } catch(_){}
  const box = field.closest('.copy-box');
  if(box){
    box.classList.remove('needs-manual');
    void box.offsetWidth;                       // reinicia o destaque
    box.classList.add('needs-manual');
  }
}

function openContactDrawer(){
  const mailField = h('input', { class:'copy-field num', type:'text', readonly:true, value: CONTACT_EMAIL,
    id:'contact-mail-field', 'aria-label':'Endereço de e-mail do Ciclo', spellcheck:'false' });
  mailField.addEventListener('focus', () => mailField.select());
  mailField.addEventListener('click', () => mailField.select());

  const status = h('p', { class:'copy-status', role:'status', 'aria-live':'polite' });

  const doCopy = once(async () => {
    const ok = await copyToClipboard(CONTACT_EMAIL);
    if(ok){
      status.textContent = 'Endereço copiado. Cole no seu serviço de e-mail.';
      status.dataset.kind = 'ok';
      toast('Cole o endereço no seu serviço de e-mail.', 'ok', { title:'E-mail copiado' });
    } else {
      status.textContent = 'Não foi possível copiar automaticamente. Selecione o endereço acima e copie.';
      status.dataset.kind = 'warn';
      selectForManualCopy(mailField);
      toast('Selecione o endereço acima e copie manualmente.', 'warn', { title:'Não foi possível copiar automaticamente' });
    }
  });

  const body = h('div', { class:'contact-drawer' },
    h('p', { class:'prose', text:'Dúvidas, sugestões, ideias ou problemas — escreva para este endereço.' }),
    h('div', { class:'copy-box' },
      h('label', { for:'contact-mail-field', text:'E-mail' }),
      h('div', { class:'copy-row' },
        mailField,
        h('button', { class:'btn primary sm', type:'button', onclick:doCopy }, icon('i-copy'), 'Copiar endereço'))),
    status,
    h('div', { class:'row auto', style:'margin-top:4px' },
      h('button', { class:'btn ghost sm', type:'button', onclick:() => openMail(MAIL_SUBJECT_CONTACT) }, icon('i-mail'), 'Abrir aplicativo de e-mail')),
    h('p', { class:'hint', style:'margin-top:14px', text:'Se nenhum aplicativo abrir, copie o endereço acima e use seu serviço de e-mail normalmente.' }),
    h('div', { class:'drawer-note' },
      h('p', { class:'hint', text:'O Ciclo não envia mensagens por conta própria e não se conecta à internet. Você escolhe como e quando escrever.' }),
      h('button', { class:'linkbtn', type:'button', text:'Encontrou um problema? Relatar', onclick:() => openReportProblemDrawer() })));
  Drawer.open('Entrar em contato', body);
}

/** Informações técnicas do relato. Nunca inclui dado de estudo. */
function reportTechInfo(){
  const current = VIEW_TITLES[ui.view] || ui.view;
  const before = ui.prevView && ui.prevView !== ui.view ? VIEW_TITLES[ui.prevView] : null;
  return [
    ['Versão', APP_VERSION],
    ['Tela', before ? `${current} (antes: ${before})` : current],
    ['Navegador', navigator.userAgent || 'desconhecido'],
    ['Idioma', navigator.language || 'desconhecido'],
    ['Janela', `${window.innerWidth}×${window.innerHeight}`]
  ];
}

function buildReportText(description, info){
  const desc = str(description).trim();
  return [
    'Ciclo — Relato de problema',
    '',
    'Descrição:',
    desc || '(descreva aqui o que aconteceu)',
    '',
    'Informações técnicas:',
    ...info.map(([k, v]) => `${k}: ${v}`),
    '',
    'Nenhum dado de estudo foi incluído neste relato.'
  ].join('\n');
}

function openReportProblemDrawer(){
  const info = reportTechInfo();
  const descField = h('textarea', { id:'report-desc', rows:'6', maxlength:'4000',
    placeholder:'Ex.: O botão X não responde quando eu clico depois de registrar uma sessão.' });
  const preview = h('pre', { class:'report-preview' });
  const syncPreview = () => { preview.textContent = buildReportText(descField.value, info); };
  descField.addEventListener('input', syncPreview);
  syncPreview();

  const status = h('p', { class:'copy-status', role:'status', 'aria-live':'polite' });

  const doCopy = once(async () => {
    if(!descField.value.trim()){
      status.textContent = 'Escreva o que aconteceu antes de copiar.';
      status.dataset.kind = 'warn';
      descField.setAttribute('aria-invalid', 'true');
      descField.focus();
      return;
    }
    descField.removeAttribute('aria-invalid');
    const text = buildReportText(descField.value, info);
    const ok = await copyToClipboard(text);
    if(ok){
      status.textContent = `Relato copiado. Envie para ${CONTACT_EMAIL} pelo seu serviço de e-mail.`;
      status.dataset.kind = 'ok';
      toast(`Cole o texto em um e-mail para ${CONTACT_EMAIL}.`, 'ok', { title:'Relato copiado' });
    } else {
      status.textContent = 'Não foi possível copiar automaticamente. Abra "Ver o texto completo" e copie manualmente.';
      status.dataset.kind = 'warn';
      details.open = true;
      const range = document.createRange();
      range.selectNodeContents(preview);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      toast('Abra "Ver o texto completo" e copie manualmente.', 'warn', { title:'Não foi possível copiar automaticamente' });
    }
  });

  descField.addEventListener('input', () => {
    if(descField.value.trim()){ descField.removeAttribute('aria-invalid'); if(status.dataset.kind === 'warn'){ status.textContent = ''; delete status.dataset.kind; } }
  });

  const details = h('details', { class:'report-details' },
    h('summary', { text:'Ver o texto completo' }),
    preview);

  const body = h('div', { class:'report-drawer' },
    h('p', { class:'prose', text:'Conte o que aconteceu. Quanto mais específico, mais fácil entender e corrigir.' }),
    h('div', { class:'field' }, h('label', { for:'report-desc', text:'O que aconteceu?' }), descField),
    h('div', { class:'report-tech' },
      h('p', { class:'report-tech-title', text:'Informações técnicas que serão incluídas' }),
      h('dl', { class:'tech-list' }, info.map(([k, v]) => h('div', null, h('dt', { text:k }), h('dd', { text:v })))),
      h('p', { class:'privacy-note' }, icon('i-check', 'nav-icon'),
        h('span', { text:'Nenhuma disciplina, tópico, sessão, comentário ou dado de estudo será incluído.' }))),
    details,
    status,
    h('div', { class:'row auto', style:'margin-top:6px' },
      h('button', { class:'btn primary sm', type:'button', onclick:doCopy }, icon('i-copy'), 'Copiar relato'),
      h('button', { class:'btn ghost sm', type:'button',
        onclick:() => openMail(MAIL_SUBJECT_REPORT, buildReportText(descField.value, info)) }, icon('i-mail'), 'Abrir no e-mail')),
    h('p', { class:'hint', style:'margin-top:12px', text:`Nada é enviado automaticamente. Se o e-mail não abrir, copie o relato e envie para ${CONTACT_EMAIL}.` }));
  Drawer.open('Relatar um problema', body);
}

/* =========================================================================
   AJUDA DESTA TELA
   ========================================================================= */
function openScreenHelp(){
  const s = SCREEN_HELP[ui.view];
  if(!s){ setView('help'); return; }
  const body = h('div',
    h('p', { class:'prose', style:'margin-bottom:14px', text:s.intro }),
    h('ul', { class:'reasons' }, s.points.map(p => h('li', { text:p }))),
    s.articles && s.articles.length ? h('div', { style:'margin-top:18px' },
      h('p', { class:'card-title', text:'Saiba mais' }),
      s.articles.map(id => { const a = getArticle(id); return a ? h('button', { class:'help-item', type:'button', onclick:() => openHelpArticleDrawer(a.id) },
        h('span', { class:'hi-main' }, h('div', { class:'hi-title', text:a.title }), h('div', { class:'hi-sum', text:a.summary }))) : null; })
    ) : null,
    h('div', { style:'margin-top:16px' },
      h('button', { class:'btn ghost sm', type:'button', text:'Ver mais na Central de Ajuda',
        onclick:() => { Drawer.close(); setView('help'); } }))
  );
  Drawer.open('Ajuda · ' + s.title, body);
}

/* =========================================================================
   DICAS DE PRIMEIRA VISITA — uma vez só, nunca bloqueiam a interface.
   ========================================================================= */
const FIRST_TIPS = {
  plan:        { id:'plan-intro',        title:'Seu plano é semanal e flexível',
                 text:'Você define quanto pretende estudar por semana; não precisa escolher horários fixos nem estudar todo dia.' },
  reviews:     { id:'reviews-intro',     title:'As revisões aparecem sozinhas',
                 text:'Depois de estudar um tópico, ele entra automaticamente no ciclo de revisão e volta aqui quando chegar a hora.' },
  analytics:   { id:'analytics-intro',   title:'O período comanda a página',
                 text:'Os filtros de período no topo alteram todas as métricas e gráficos desta tela.' },
  disciplines: { id:'disciplines-intro', title:'Tópicos são o coração do conteúdo',
                 text:'São eles que permitem acompanhar cobertura, domínio e revisões. Dá para adicionar vários de uma vez.' }
};

function renderTips(){
  const slot = $('#tips-slot');
  if(!slot) return;
  clear(slot);
  if(state.settings.helpMode !== 'full') return;
  const tip = FIRST_TIPS[ui.view];
  if(!tip) return;
  const seen = Array.isArray(state.settings.seenTips) ? state.settings.seenTips : [];
  if(seen.includes(tip.id)) return;

  slot.appendChild(h('div', { class:'tip', role:'note' },
    icon('i-help', 'nav-icon'),
    h('div', { class:'tip-main' }, h('strong', { text:tip.title }), h('span', { text:tip.text })),
    h('button', { class:'btn ghost sm', type:'button', text:'Entendi', onclick: async () => {
      const list = Array.isArray(state.settings.seenTips) ? state.settings.seenTips.slice() : [];
      if(!list.includes(tip.id)) list.push(tip.id);
      state.settings.seenTips = list;
      await saveSettings();
      renderTips();
    } })));
}

/* =========================================================================
   DRAWER DE TÓPICO
   ========================================================================= */
function openTopicDrawer(topicId){
  const t = getTopic(topicId);
  if(!t) return;
  const disc = getDiscipline(t.disciplineId);
  const sess = sessionsOfTopic(t.id).slice().sort((a,b) => b.date.localeCompare(a.date));
  const totalMin = sum(sess, s => s.minutes);
  const st = topicStatus(t);

  const recent = h('div');
  if(!sess.length){
    recent.appendChild(h('p', { class:'hint', text:'Nenhuma sessão registrada neste tópico ainda.' }));
  } else {
    sess.slice(0, 6).forEach(s => {
      const diff = difficultyInfo(s.difficulty);
      recent.appendChild(h('div', { class:'topic-row' },
        h('div', { class:'tr-main' },
          h('div', { class:'tr-name', text: fmtDateBR(s.date) + ' · ' + fmtDuration(s.minutes) }),
          h('div', { class:'tr-meta', text: [s.type ? sessionTypeLabel(s.type) : null, diff ? diff.label : null, reviewOutcomeLabel(s.reviewOutcome)].filter(Boolean).join(' · ') || '—' }))));
    });
    if(sess.length > 6) recent.appendChild(h('p', { class:'hint', style:'margin-top:8px', text:`+ ${sess.length - 6} sessão(ões) mais antigas no Histórico.` }));
  }

  const body = h('div',
    h('p', { class:'hint', style:'margin-bottom:12px', text: (disc ? disc.name : '') + (disc && disc.areaId ? ' · ' + areaNameOf(disc) : '') }),
    h('div', { class:'stat-grid', style:'margin-bottom:14px' },
      statBox(TOPIC_STATUS_LABEL[st], 'status'),
      statBox(t.masteryLevel ? t.masteryLevel + '/5' : '—', 'domínio'),
      statBox(fmtDuration(totalMin), 'tempo total'),
      statBox(String(sess.length), 'sessões')),
    h('div', { class:'card elevated', style:'margin-bottom:14px' },
      h('div', { class:'set-row' }, h('span', { class:'sr-main', text:'Último estudo' }), h('span', { class:'num', text: fmtRelativePast(t.lastStudiedAt) })),
      h('div', { class:'set-row' }, h('span', { class:'sr-main', text:'Próxima revisão' }),
        h('span', { class:'num', text: t.reviewEnabled ? (t.reviewDueDate ? fmtRelativeFuture(t.reviewDueDate) : 'após o primeiro estudo') : 'desativada' })),
      h('div', { class:'set-row' }, h('span', { class:'sr-main', text:'Intervalo atual' }),
        h('span', { class:'num', text: t.reviewIntervalDays ? t.reviewIntervalDays + ' dia(s)' : '—' })),
      h('div', { class:'set-row' }, h('span', { class:'sr-main', text:'Revisões concluídas' }), h('span', { class:'num', text:String(t.reviewRepetitions || 0) }))),
    h('p', { class:'card-title', text:'Sessões recentes' }),
    recent,
    h('div', { class:'row auto', style:'margin-top:16px' },
      h('button', { class:'btn primary sm', type:'button', text:'Estudar', onclick:() => { Drawer.close(); startTimer(t.disciplineId, t.id, null); } }),
      t.reviewEnabled ? h('button', { class:'btn ghost sm', type:'button', text:'Revisar', onclick:() => { Drawer.close(); startTimer(t.disciplineId, t.id, 'revisao'); } }) : null,
      h('button', { class:'btn ghost sm', type:'button', text:'Editar', onclick:() => { Drawer.close(); openTopicModal(t.disciplineId, t); } }))
  );
  Drawer.open(t.name, body);
}

/* =========================================================================
   FEEDBACK ENRIQUECIDO
   ========================================================================= */
function toastRich(headline, rows, kind){
  const k = TOAST_KINDS[kind] ? kind : 'ok';
  const el = h('div', { class:'toast rich ' + k },
    h('span', { class:'t-icon', 'aria-hidden':'true' }, icon(TOAST_KINDS[k].icon)),
    h('div', { class:'t-content' },
      h('p', { class:'t-title', text:headline }),
      h('div', { class:'t-body' }, rows.map(r => Array.isArray(r)
        ? h('div', { class:'t-row' }, h('span', { text:r[0] }), h('b', { text:r[1] }))
        : h('div', { class:'t-sub', text:r })))));
  mountToast(el, 5600);
}


/* =========================================================================
   COMPONENTES INTERATIVOS — barras com detalhe, sinais da recomendação
   ========================================================================= */

/** Barra de progresso que revela planejado/realizado/restante no hover e no foco. */
function barWithTip(pct, cls, title, rows, key){
  const wrap = h('div', { class:'bar', tabindex:'0', role:'img',
    'aria-label': title + ': ' + rows.map(r => r[0] + ' ' + r[1]).join(', ') },
    barFill(pct, cls, key));
  Tooltip.attach(wrap, () => tipBody(title, rows));
  return wrap;
}

/** Sinais da recomendação em linguagem qualitativa — nunca o score bruto. */
function signalGrid(action){
  if(!action || !action.parts) return null;
  const level = v => v >= .66 ? 'Alto' : v >= .33 ? 'Médio' : 'Baixo';
  const f = action.facts, p = action.parts;
  const rows = [
    ['Plano semanal', f.planned > 0 ? level(p.deficitScore) : 'sem plano'],
    ['Prioridade', PRIORITY_LABELS[action.discipline.priority]],
    ['Tempo sem estudar', f.lastISO === null ? 'nunca estudada' : level(p.recencyScore)]
  ];
  if(f.dueCount > 0) rows.push(['Revisões', f.dueCount + (f.dueCount === 1 ? ' pendente' : ' pendentes')]);
  if(f.deadline) rows.push(['Prazo', fmtRelativeFuture(f.deadline.dl.date)]);

  return h('dl', { class:'signals', 'aria-label':'Sinais usados na sugestão' },
    rows.map(r => h('div', { class:'signal' }, h('dt', { text:r[0] }), h('dd', { text:r[1] }))));
}


/* =========================================================================
   FRASE DO DIA — rotação determinística, sem rede.
   A ordem é embaralhada com uma semente derivada do ano; o dia do ano
   escolhe a posição. Recarregar a página não troca a frase; amanhã troca;
   e cada ano produz uma ordem diferente.
   ========================================================================= */
function dayOfYear(d){
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d - start) / 86400000);   // 0-based
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
function seededRandom(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ordem embaralhada das frases para um ano — sempre a mesma para o mesmo ano. */
function quoteOrderForYear(year){
  const rnd = seededRandom(year * 2654435761);
  const order = DAILY_QUOTES.map((_, i) => i);
  for(let i = order.length - 1; i > 0; i--){          // Fisher–Yates determinístico
    const j = Math.floor(rnd() * (i + 1));
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  return order;
}

let _quoteCache = { year:null, order:null };
function quoteOfTheDay(date){
  const d = date || new Date();
  const year = d.getFullYear();
  if(_quoteCache.year !== year) _quoteCache = { year, order: quoteOrderForYear(year) };
  const idx = _quoteCache.order[dayOfYear(d) % _quoteCache.order.length];
  return DAILY_QUOTES[idx];
}

/** Assinatura conforme o tipo de atribuição, sem inventar autoria. */
function quoteAttribution(q){
  switch(q.attributionStatus){
    case 'verified':   return '— ' + q.author;
    case 'attributed': return q.author.startsWith('atribuída') ? '— ' + q.author : '— atribuída a ' + q.author;
    case 'proverb':    return '— ' + (q.author || 'provérbio');
    default:           return '— Ciclo';
  }
}

function dailyQuoteCard(){
  if(!state.settings.showDailyQuote) return null;
  const q = quoteOfTheDay();
  return h('div', { class:'card quote-card' },
    h('p', { class:'quote-text', text: '“' + q.text + '”' }),
    h('p', { class:'quote-author', text: quoteAttribution(q) }));
}

/* =========================================================================
   COMECE POR AQUI — checklist derivada dos dados reais, nunca de checkboxes.
   ========================================================================= */
function onboardingSteps(){
  const hasPlan = !!PlannerEngine.activePlan();
  const hasArea = state.areas.length > 0;
  const hasDiscipline = activeDisciplines().length > 0;
  const hasTopic = state.topics.some(t => !t.archived);
  const hasSession = state.sessions.length > 0;
  const understandsReview = ReviewEngine.allScheduled().length > 0 || !!state.meta.reviewPrimerSeen;

  return [
    { id:'plan',    done:hasPlan,       label:'Defina seu tempo semanal',
      action:{ text:'Definir agora', run:() => setView('plan') } },
    { id:'area',    done:hasArea,       label:'Crie sua primeira área',
      action:{ text:'Criar área', run:() => { setView('disciplines'); setTimeout(() => openAreaModal(null), 250); } } },
    { id:'disc',    done:hasDiscipline, label:'Crie sua primeira disciplina',
      action:{ text:'Criar disciplina', run:() => { setView('disciplines'); setTimeout(() => openDisciplineModal(null), 250); } } },
    { id:'topic',   done:hasTopic,      label:'Adicione seu primeiro tópico',
      action:{ text:'Adicionar tópico', run:() => {
        const d = activeDisciplines()[0];
        if(d) openTopicModal(d.id, null); else setView('disciplines');
      } } },
    { id:'session', done:hasSession,    label:'Faça sua primeira sessão',
      action:{ text:'Registrar sessão', run:() => openRegisterModal() } },
    { id:'review',  done:understandsReview, label:'Entenda sua primeira revisão',
      action:{ text:'Ver como funciona', run:openReviewPrimer } }
  ];
}

/** Versão da checklist para a Central de Ajuda: sempre visível, mesmo concluída. */
function startHereChecklistCard(){
  const steps = onboardingSteps();
  const done = steps.filter(x => x.done).length;
  const box = h('div', { class:'card' },
    h('div', { class:'card-head' },
      h('p', { class:'card-title', style:'margin:0', text:'Como começar' }),
      h('span', { class:'hint', text:`${done} de ${steps.length}` })));
  const list = h('ul', { class:'checklist' });
  steps.forEach(st => list.append(h('li', { class: st.done ? 'done' : '' },
    h('span', { class:'ck-mark', 'aria-hidden':'true', text: st.done ? '✓' : '○' }),
    h('span', { class:'ck-label', text:st.label }),
    st.done ? h('span', { class:'ck-ok', text:'feito' })
            : h('button', { class:'linkbtn', type:'button', text:st.action.text, onclick:st.action.run }))));
  box.append(list);
  return box;
}

function startHereCard(){
  const steps = onboardingSteps();
  const doneCount = steps.filter(s => s.done).length;
  const complete = doneCount === steps.length;

  if(complete && state.meta.startHereDismissed) return null;

  const box = h('div', { class:'card start-here' });
  box.append(h('div', { class:'card-head' },
    h('p', { class:'card-title', style:'margin:0', text: complete ? 'Tudo pronto' : 'Comece por aqui' }),
    h('span', { class:'hint', text: `${doneCount} de ${steps.length}` })));

  if(complete){
    box.append(
      h('p', { class:'hint', style:'margin-bottom:12px', text:'A tela Hoje já pode orientar seus estudos. Esta lista continua disponível em Ajuda → Como começar.' }),
      h('div', { class:'row auto' },
        h('button', { class:'btn primary sm', type:'button', text:'Começar a estudar', onclick: async () => {
          await setMeta('startHereDismissed', true); render();
        } })));
    return box;
  }

  box.append(progressBar((doneCount / steps.length) * 100, doneCount === steps.length ? 'done' : null));
  const list = h('ul', { class:'checklist', style:'margin-top:12px' });
  steps.forEach(s => {
    list.append(h('li', { class: s.done ? 'done' : '' },
      h('span', { class:'ck-mark', 'aria-hidden':'true', text: s.done ? '✓' : '○' }),
      h('span', { class:'ck-label', text:s.label }),
      s.done ? h('span', { class:'ck-ok', text:'feito' })
             : h('button', { class:'btn ghost sm', type:'button', text:s.action.text, onclick:s.action.run })));
  });
  box.append(list);
  return box;
}

/* =========================================================================
   NOVIDADES DA VERSÃO — uma única vez, para quem já usava.
   ========================================================================= */
function maybeShowWhatsNew(){
  if(state.settings.seenWhatsNew === APP_VERSION) return;
  // usuário realmente novo não precisa de "novidades": ele tem o onboarding
  if(!state.sessions.length && !activeDisciplines().length) return;

  const markSeen = async () => { state.settings.seenWhatsNew = APP_VERSION; await saveSettings(); };
  openModal(close => ({
    title:'O Diário de Estudos agora é Ciclo',
    content: h('div', { class:'whats-new' },
      h('div', { class:'wn-brand', 'aria-hidden':'true' }, icon('i-brand', 'welcome-icon')),
      h('p', { class:'modal-sub', text:'Mesmo aplicativo, novo nome. Seus dados, revisões e planos continuam exatamente como estavam.' }),
      h('ul', { class:'reasons' },
        h('li', { text:'Visual refinado nos temas escuro e claro, com mais contraste, profundidade e hierarquia.' }),
        h('li', { text:'Respostas visuais mais claras depois de cada ação: registrar, revisar, salvar, fazer backup.' }),
        h('li', { text:'A tela Hoje destaca a próxima sessão e as revisões do dia.' }),
        h('li', { text:'Contato e relato de problema confiáveis: dá para copiar o endereço ou o relato mesmo sem aplicativo de e-mail.' }))),
    actions:[
      h('button', { class:'btn ghost', type:'button', text:'Ver o histórico de versões', onclick: async () => {
        close(); await markSeen(); openChangelog();
      } }),
      h('button', { class:'btn primary', type:'button', text:'Continuar', onclick: async () => {
        close(); await markSeen();
      } })
    ]
  }), { size:'wide', onClose:(r) => { if(r === null) markSeen(); } });
}

/* =========================================================================
   APRENDER A ESTUDAR — leitura dos guias em painel lateral.
   ========================================================================= */
function studyGuideNode(g){
  const box = h('div', { class:'help-article prose' });
  if(g.oneLine) box.append(h('p', { class:'one-line' }, h('span', { class:'ol-tag', text:'EM UMA FRASE' }), g.oneLine));
  box.append(h('h4', { text:'O QUE É' }), h('p', { text:g.what }));
  box.append(h('h4', { text:'POR QUE É ÚTIL' }), h('p', { text:g.why }));
  box.append(h('h4', { text:'COMO FAZER' }), h('ul', null, g.how.map(x => h('li', { text:x }))));
  box.append(h('h4', { text:'EXEMPLO' }), h('p', { text:g.example }));
  box.append(h('h4', { text:'NO CICLO' }), h('p', { text:g.inApp }));
  if(g.caution) box.append(h('p', { class:'hint', style:'margin-top:12px', text:g.caution }));
  return box;
}

function openStudyGuideDrawer(id){
  const g = STUDY_GUIDES.find(x => x.id === id);
  if(!g) return;
  const related = STUDY_GUIDES.filter(x => x.id !== g.id).slice(0, 3);
  Drawer.open(g.title, h('div',
    h('p', { class:'hi-cat', text:'APRENDER A ESTUDAR' }),
    h('p', { class:'hint', style:'margin-bottom:14px', text:g.summary }),
    studyGuideNode(g),
    h('div', { style:'margin-top:18px' },
      h('p', { class:'card-title', text:'Continue lendo' }),
      related.map(r => h('button', { class:'help-item', type:'button', onclick:() => openStudyGuideDrawer(r.id) },
        h('span', { class:'hi-main' }, h('div', { class:'hi-title', text:r.title }), h('div', { class:'hi-sum', text:r.summary })))))
  ));
}


/* =========================================================================
   v5 — PRIMEIRO ACESSO
   Duas telas. Nenhum conceito é exigido antes de existir motivo para ele.
   Resultado: uma disciplina criada com bons padrões, e o usuário na Home.
   ========================================================================= */
function openWelcome(){
  let step = 1;
  let name = '';
  let rebuildRef = null;

  openModal(close => {
    const body = h('div');

    function actions(){
      const acts = [];
      if(step === 2){
        acts.push(h('button', { class:'btn ghost', type:'button', text:'Voltar',
          onclick:() => { step = 1; rebuild(); } }));
        acts.push(h('button', { class:'btn primary', type:'button', text:'Continuar', onclick:finish }));
      } else {
        acts.push(h('button', { class:'btn primary lg', type:'button', text:'Começar',
          onclick:() => { step = 2; rebuild(); } }));
      }
      mount($('#modal-actions'), ...acts);
      guardModalActions($('#modal-actions'));
    }

    function stepWelcome(){
      return h('div', { class:'welcome' },
        h('div', { class:'welcome-mark', 'aria-hidden':'true' }, icon('i-brand', 'welcome-icon')),
        h('h3', { class:'welcome-title', text:'Bem-vindo ao Ciclo' }),
        h('p', { class:'welcome-tag', text:'Seu sistema de estudos' }),
        h('p', { class:'welcome-text', text:'Organize o que você estuda, acompanhe seu progresso e saiba quando revisar.' }),
        h('p', { class:'welcome-note', text:'Você não precisa configurar nada agora.' }));
    }

    function stepName(){
      const input = h('input', { type:'text', id:'wc-name', value:name, maxlength:'80',
        placeholder:'Ex.: Matemática', autocomplete:'off', 'aria-describedby':'wc-ex' });
      input.addEventListener('input', () => { name = input.value; });
      input.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); finish(); } });

      const chips = h('div', { class:'chips', style:'margin-top:10px' },
        ['Matemática','Inglês','Direito','Anatomia','CCNA','Violão'].map(ex =>
          h('button', { class:'chip', type:'button', text:ex,
            onclick:() => { name = ex; input.value = ex; input.focus(); } })));

      return h('div',
        h('h3', { class:'welcome-title', style:'font-size:22px', text:'O que você está estudando?' }),
        h('p', { class:'hint', id:'wc-ex', style:'margin-bottom:12px', text:'Pode ser uma matéria, um idioma, uma certificação ou qualquer outro assunto. Depois você adiciona mais.' }),
        h('div', { class:'field' }, input),
        chips);
    }

    async function finish(){
      const clean = str(name).trim();
      if(!clean){ toast('Escreva o que você está estudando.', 'err'); $('#wc-name') && $('#wc-name').focus(); return; }
      try {
        // Sem área, sem prioridade, sem plano: só o mínimo, com bons padrões.
        const d = newDiscipline(clean, null, 3);
        await DB.put('disciplines', d);
        await setMeta('onboardingCompleted', true);
        await setMeta('firstDisciplineId', d.id);
        close();
        await refresh();
        setView('today');
        toast('Agora é só começar a estudar.', 'ok', { title: clean + ' adicionada' });
      } catch(err){
        console.error('Falha ao criar a primeira disciplina:', err);
        toast('Não foi possível salvar agora. Tente novamente.', 'err');
      }
    }

    rebuild();
    function rebuild(){
      clear(body);
      body.append(step === 1 ? stepWelcome() : stepName());
      actions();
      const first = body.querySelector('input');
      if(first) setTimeout(() => first.focus(), 40);
    }
    rebuildRef = rebuild;
    return { title:'', content: body, actions: [] };
  }, { size:'narrow', dismissible:false });

  if(rebuildRef) rebuildRef();
}

/* =========================================================================
   v5 — ROTA DE ZERO CONFIGURAÇÃO
   "O que vai estudar? / Assunto (opcional) / Quanto tempo? / Começar"
   Cria disciplina e tópico na hora, se necessário, com confirmação leve.
   ========================================================================= */
function openQuickStart(preset){
  const p = preset || {};
  let disciplineName = '';
  let disciplineId = p.disciplineId || '';
  let topicText = '';
  let minutes = state.settings.defaultSessionMinutes || 40;
  let free = false;
  let busy = false;

  const discs = activeDisciplines().slice().sort(sortByName);
  if(!disciplineId && discs.length) disciplineId = discs[0].id;

  openModal(close => {
    const body = h('div');

    /* --- o que vai estudar --- */
    const discField = h('div', { class:'field' });
    function buildDiscField(){
      clear(discField);
      discField.append(h('label', { for:'qs-disc', text:'O que você vai estudar?' }));
      if(discs.length){
        const sel = h('select', { id:'qs-disc' });
        discs.forEach(d => sel.appendChild(h('option', { value:d.id, selected:d.id === disciplineId }, d.name)));
        sel.appendChild(h('option', { value:'__new__' }, '+ Adicionar outra…'));
        sel.addEventListener('change', () => {
          if(sel.value === '__new__'){ disciplineId = ''; buildDiscField(); }
          else { disciplineId = sel.value; buildTopicField(); }
        });
        discField.append(sel);
        if(!disciplineId){
          const nameIn = h('input', { type:'text', id:'qs-newdisc', placeholder:'Ex.: História', maxlength:'80', style:'margin-top:8px' });
          nameIn.addEventListener('input', () => { disciplineName = nameIn.value; });
          discField.append(nameIn, h('p', { class:'hint', text:'Ela será criada quando você começar.' }));
          setTimeout(() => nameIn.focus(), 30);
        }
      } else {
        const nameIn = h('input', { type:'text', id:'qs-newdisc', placeholder:'Ex.: Matemática', maxlength:'80' });
        nameIn.addEventListener('input', () => { disciplineName = nameIn.value; });
        discField.append(nameIn, h('p', { class:'hint', text:'Ela será criada quando você começar.' }));
      }
    }

    /* --- assunto (opcional) --- */
    const topicField = h('div', { class:'field' });
    function buildTopicField(){
      clear(topicField);
      const known = disciplineId ? topicsOf(disciplineId) : [];
      topicField.append(h('label', { for:'qs-topic' }, 'Assunto ', h('span', { class:'optional', text:'opcional' })));
      const input = h('input', { type:'text', id:'qs-topic', value:topicText, maxlength:'80',
        placeholder: known.length ? 'Ex.: ' + known[0].name : 'Ex.: Derivadas',
        autocomplete:'off', list: known.length ? 'qs-topic-list' : null });
      input.addEventListener('input', () => { topicText = input.value; });
      topicField.append(input);
      if(known.length){
        const dl = h('datalist', { id:'qs-topic-list' });
        known.forEach(t => dl.appendChild(h('option', { value:t.name })));
        topicField.append(dl);
      }
      topicField.append(h('p', { class:'hint', text:'Ajuda o Ciclo a lembrar você de revisar depois. Pode deixar em branco.' }));
    }

    /* --- tempo --- */
    const timeField = h('div', { class:'field' });
    const timeChips = h('div', { class:'chips' });
    function buildTime(){
      clear(timeChips);
      [20,30,40].forEach(v => timeChips.appendChild(h('button', { class:'chip', type:'button',
        'aria-pressed': (!free && minutes === v) ? 'true' : 'false', text: v + ' min',
        onclick:() => { minutes = v; free = false; buildTime(); } })));
      timeChips.appendChild(h('button', { class:'chip', type:'button', 'aria-pressed': free ? 'true':'false', text:'Livre',
        onclick:() => { free = true; buildTime(); } }));
      clear(timeField);
      timeField.append(h('label', { text:'Quanto tempo?' }), timeChips,
        h('p', { class:'hint', text: free
          ? 'O cronômetro corre sem limite. Você para quando quiser.'
          : 'Uma sugestão de duração. Você pode parar antes ou seguir além.' }));
    }

    buildDiscField(); buildTopicField(); buildTime();
    body.append(discField, topicField, timeField);

    const startBtn = h('button', { class:'btn primary', type:'button', text:'Começar' });
    startBtn.addEventListener('click', async () => {
      if(busy) return;                       // guarda contra duplo clique
      busy = true; startBtn.disabled = true;
      try { await begin(); }
      finally { busy = false; startBtn.disabled = false; }
    });

    async function begin(){
      let disc = disciplineId ? getDiscipline(disciplineId) : null;

      if(!disc){
        const clean = str(disciplineName).trim();
        if(!clean){ toast('Escreva o que você vai estudar.', 'err'); return; }
        const existing = activeDisciplines().find(d => d.name.toLowerCase() === clean.toLowerCase());
        if(existing) disc = existing;
        else {
          disc = newDiscipline(clean, null, 3);
          try { await DB.put('disciplines', disc); await refresh(); }
          catch(err){ console.error(err); toast('Não foi possível criar a disciplina.', 'err'); return; }
          toast(clean + ' adicionada.', 'ok');
        }
      }

      const topicName = str(topicText).trim();
      if(!topicName){ close(); startTimer(disc.id, null, null); return; }

      const match = topicsOf(disc.id).find(t => t.name.toLowerCase() === topicName.toLowerCase());
      if(match){ close(); startTimer(disc.id, match.id, null); return; }

      // assunto novo: pergunta uma vez, sem bloquear quem não quiser cadastrar
      close();
      openModal(close2 => ({
        title:'Adicionar como assunto?',
        content: h('div',
          h('p', { class:'modal-sub', text:`"${topicName}" ainda não está em ${disc.name}.` }),
          h('p', { class:'hint', text:'Adicionar permite que o Ciclo acompanhe suas revisões e seu progresso nesse assunto. Também dá para seguir sem adicionar.' })),
        actions:[
          h('button', { class:'btn ghost', type:'button', text:'Continuar sem adicionar',
            onclick:() => { close2(); startTimer(disc.id, null, null); } }),
          h('button', { class:'btn primary', type:'button', text:'Adicionar', onclick: async () => {
            close2();
            try {
              const existing = topicsOf(disc.id, true);
              const order = existing.length ? Math.max(...existing.map(t => t.sortOrder || 0)) + 10 : 10;
              const t = newTopic(disc.id, topicName, order);
              await DB.put('topics', t);
              await refresh();
              toast(`${topicName} · ${disc.name}`, 'ok', { title:'Assunto adicionado' });
              startTimer(disc.id, t.id, null);
            } catch(err){
              console.error(err);
              toast('Não foi possível adicionar o assunto. A sessão continua.', 'err');
              startTimer(disc.id, null, null);
            }
          } })
        ]
      }), { size:'narrow' });
    }

    return {
      title:'Começar a estudar',
      content: body,
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        startBtn
      ]
    };
  }, { size:'wide' });
}

/* =========================================================================
   v5 — GUIA VIVO "SEU COMEÇO"
   Derivado do estado real. Não bloqueia nada, pode ser ocultado, e some
   sozinho quando deixa de ser útil.
   ========================================================================= */
const START_ACTIONS = {
  addDiscipline: () => openDisciplineModal(null),
  quickStart:    () => openQuickStart(),
  addTopic:      () => {
    const d = activeDisciplines()[0];
    if(d) openTopicModal(d.id, null); else openDisciplineModal(null);
  },
  reviewDemo:    () => openInteractiveGuide('ig-revisao'),
  plan:          () => setView('plan'),
  addArea:       () => openAreaModal(null),
  openReviews:   () => setView('reviews'),
  openDisciplines: () => setView('disciplines')
};

function startProgress(){
  const hasDiscipline = activeDisciplines().length > 0;
  const hasSession = state.sessions.length > 0;
  const hasTopic = state.topics.some(t => !t.archived);
  const hasReview = state.sessions.some(x => x.reviewOutcome) || !!state.meta.reviewDemoSeen;
  const hasPlan = !!PlannerEngine.activePlan();
  const done = { discipline:hasDiscipline, session:hasSession, topic:hasTopic, review:hasReview, plan:hasPlan };
  const steps = HOW_TO_START.map(s2 => ({ ...s2, done: !!done[s2.id] }));
  return { steps, doneCount: steps.filter(x => x.done).length, total: steps.length };
}

function startGuideCard(){
  if(state.meta.startGuideHidden) return null;
  const prog = startProgress();
  if(prog.doneCount === prog.total) return null;   // some sozinho quando termina

  const next = prog.steps.find(s2 => !s2.done);
  const card = h('div', { class:'card start-guide' });
  card.append(h('div', { class:'card-head' },
    h('p', { class:'card-title', style:'margin:0', text:'Seu começo' }),
    h('div', { class:'row auto' },
      h('span', { class:'hint', text:`${prog.doneCount} de ${prog.total}` }),
      h('button', { class:'linkbtn muted', type:'button', text:'ocultar', onclick: async () => {
        await setMeta('startGuideHidden', true); render();
        toast('Guia ocultado. Ele continua em Ajuda → Como começar.');
      } }))));
  card.append(progressBar((prog.doneCount / prog.total) * 100, null, 'start-guide'));

  const list = h('ul', { class:'checklist', style:'margin-top:12px' });
  prog.steps.forEach(s2 => {
    const isNext = next && s2.id === next.id;
    list.append(h('li', { class:(s2.done ? 'done' : '') + (isNext ? ' next' : '') },
      h('span', { class:'ck-mark', 'aria-hidden':'true', text: s2.done ? '✓' : '○' }),
      h('span', { class:'ck-label' },
        h('span', { text:s2.title }),
        isNext ? h('span', { class:'ck-desc', text:s2.text }) : null),
      s2.done
        ? h('span', { class:'ck-ok', text:'feito' })
        : h('button', { class: isNext ? 'btn primary sm' : 'linkbtn', type:'button', text:s2.actionLabel,
            onclick:() => { const fn = START_ACTIONS[s2.action]; if(fn) fn(); } })));
  });
  card.append(list);
  return card;
}


/* =========================================================================
   v5 — AJUDA INTERATIVA
   Explica mostrando e deixa executar. As demonstrações rodam inteiramente
   em memória: nada aqui toca no IndexedDB do usuário.
   ========================================================================= */
function guideTree(tree){
  if(!tree) return null;
  const box = h('div', { class:'tree' });
  if(tree.area) box.append(h('div', { class:'tree-area' }, h('span', { class:'tree-tag', text:'Área' }), tree.area));
  box.append(h('div', { class:'tree-disc' }, h('span', { class:'tree-tag', text:'Disciplina' }), tree.discipline));
  (tree.topics || []).forEach(t =>
    box.append(h('div', { class:'tree-topic' }, h('span', { class:'tree-tag', text:'Assunto' }), t)));
  return box;
}

/** Demonstração de revisão: o usuário clica nas respostas e vê o efeito. */
function reviewDemoNode(){
  const d = REVIEW_DEMO;
  const box = h('div', { class:'demo' });
  box.append(
    h('p', { class:'demo-label', text:'DEMONSTRAÇÃO' }),
    h('p', { class:'hint', style:'margin-bottom:12px', text:d.intro }),
    h('div', { class:'demo-card' },
      h('div', { class:'demo-topic', text:d.topic }),
      h('div', { class:'demo-disc', text:d.discipline })));

  const result = h('div', { class:'demo-result', role:'status', 'aria-live':'polite' });
  const opts = h('div', { class:'chips', style:'margin:12px 0' });
  d.outcomes.forEach(o => {
    const btn = h('button', { class:'chip', type:'button', text:o.label, 'aria-pressed':'false' });
    btn.addEventListener('click', () => {
      $$('.chip', opts).forEach(x => x.setAttribute('aria-pressed','false'));
      btn.setAttribute('aria-pressed','true');
      mount(result,
        h('p', { class:'demo-next' }, 'Próxima revisão: ', h('strong', { text:o.next })),
        h('p', { class:'hint', text:`Domínio ${o.mastery}. ${o.explain}` }));
    });
    opts.append(btn);
  });

  box.append(h('p', { class:'hint', style:'margin-bottom:4px', text:'Como foi lembrar?' }), opts, result,
    h('p', { class:'hint', style:'margin-top:10px', text:d.closing }),
    h('p', { class:'demo-note', text:'Este é só um exemplo. Nada aqui é salvo nos seus dados.' }));
  return box;
}

/** Demonstração de planejamento. */
function planDemoNode(){
  const d = PLAN_DEMO;
  const box = h('div', { class:'demo' });
  box.append(
    h('p', { class:'demo-label', text:'DEMONSTRAÇÃO' }),
    h('p', { class:'hint', style:'margin-bottom:10px', text:`Imagine que você tem ${d.hours} horas nesta semana. O Ciclo sugeriria:` }));
  const total = sum(d.rows, r => r.minutes);
  d.rows.forEach(r => box.append(h('div', { class:'demo-row' },
    h('div', null, h('div', { text:r.name }), h('div', { class:'hint', text:r.importance })),
    h('span', { class:'num', text: fmtDuration(r.minutes) }))));
  box.append(h('div', { class:'demo-row demo-total' },
    h('strong', { text:'Total' }), h('span', { class:'num', text: fmtDuration(total) })));
  box.append(h('p', { class:'hint', style:'margin-top:10px', text:d.note }),
    h('p', { class:'demo-note', text:'Este é só um exemplo. Nada aqui é salvo nos seus dados.' }));
  return box;
}

function openInteractiveGuide(id){
  const g = INTERACTIVE_GUIDES.find(x => x.id === id);
  if(!g) return;

  const body = h('div',
    h('p', { class:'one-line' }, h('span', { class:'ol-tag', text:'EM UMA FRASE' }), g.oneLine),
    h('p', { class:'prose', style:'margin-bottom:14px', text:g.what }),
    guideTree(g.tree),
    g.demo === 'review' ? reviewDemoNode() : null,
    g.demo === 'plan' ? planDemoNode() : null,
    g.examples && g.examples.length
      ? h('div', { style:'margin-top:14px' },
          h('p', { class:'card-title', text:'Exemplos' }),
          h('ul', { class:'reasons' }, g.examples.map(x => h('li', { text:x }))))
      : null,
    h('div', { class:'row auto', style:'margin-top:18px' },
      h('button', { class:'btn primary sm', type:'button', text:g.actionLabel, onclick:() => {
        Drawer.close();
        const fn = START_ACTIONS[g.action];
        if(fn) setTimeout(fn, 180);
      } }))
  );
  if(g.demo === 'review') setMeta('reviewDemoSeen', true).catch(err => console.error(err));
  Drawer.open(g.title, body);
}

/* =========================================================================
   v5 — PRIMEIRA REVISÃO COMO EXPERIÊNCIA GUIADA
   Aparece uma única vez, no momento em que a primeira revisão fica pendente.
   ========================================================================= */
function openFirstReviewIntro(topic){
  const disc = getDiscipline(topic.disciplineId);
  openModal(close => ({
    title:'Sua primeira revisão',
    content: h('div',
      h('p', { class:'first-review-topic', text: topic.name }),
      h('p', { class:'hint', style:'margin-bottom:14px', text: disc ? disc.name : '' }),
      h('p', { class:'prose', text:'Você estudou isso antes. Hoje vamos verificar o que você ainda consegue lembrar.' }),
      h('p', { class:'prose', style:'margin-top:8px', text:'Tente responder sem consultar seu material. Depois você diz como foi — e o Ciclo decide quando esse assunto deve voltar.' }),
      h('p', { class:'hint', style:'margin-top:12px', text:'Não é preciso reler tudo.' })),
    actions:[
      h('button', { class:'btn ghost', type:'button', text:'Agora não', onclick: async () => {
        close(); await setMeta('firstReviewIntroSeen', true);
      } }),
      h('button', { class:'btn primary', type:'button', text:'Começar', onclick: async () => {
        close(); await setMeta('firstReviewIntroSeen', true);
        startReview(topic.id);
      } })
    ]
  }), { size:'narrow' });
}

/**
 * Dispara a introdução da primeira revisão uma única vez, e apenas para quem
 * é realmente novo nisso. Qualquer sinal de histórico de revisão cancela:
 * um usuário que já vem de versões anteriores nunca vê esta tela.
 */
function hasReviewHistory(){
  if(state.sessions.some(x => x.reviewOutcome)) return true;
  if(state.sessions.some(x => x.type === 'revisao')) return true;
  if(state.topics.some(t => (t.reviewRepetitions || 0) > 0 || t.lastReviewedAt)) return true;
  return false;
}

function maybeOfferFirstReview(){
  if(state.meta.firstReviewIntroSeen) return;
  if(hasReviewHistory()){
    // marca como visto para não voltar a avaliar isso em toda abertura
    setMeta('firstReviewIntroSeen', true).catch(err => console.error(err));
    return;
  }
  if(state.sessions.length > 10) return;          // já usa o app há tempo
  if(!$('#modal-root').hidden) return;            // não empilha sobre outro modal
  if(Drawer.isOpen || Palette.isOpen || FocusMode.isOpen) return;
  const due = ReviewEngine.getDueReviews();
  if(!due.length) return;
  openFirstReviewIntro(due[0]);
}

/* =========================================================================
   CONFIGURAÇÕES — seções em cards, com controles apropriados.
   ========================================================================= */
function setRow(title, desc, control, helpKey){
  return h('div', { class:'set-row' },
    h('div', { class:'sr-main' },
      h('div', { class:'sr-title' }, title, helpKey ? helpDot(helpKey) : null),
      desc ? h('div', { class:'sr-desc', text:desc }) : null),
    h('div', { class:'sr-ctl' }, control));
}

function segmented(options, value, onPick, ariaLabel, id){
  const wrap = h('div', { class:'segmented', role:'group', 'aria-label': ariaLabel || '', id: id || null });
  options.forEach(o => {
    const b = h('button', { type:'button', text:o.label, dataset:{ value:String(o.value) },
      'aria-pressed': String(o.value) === String(value) ? 'true':'false' });
    b.addEventListener('click', () => {
      $$('button', wrap).forEach(x => x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed','true');
      onPick(o.value);
    });
    wrap.appendChild(b);
  });
  return wrap;
}

function switchControl(checked, onToggle, ariaLabel){
  const b = h('button', { class:'switch', type:'button', role:'switch',
    'aria-checked': checked ? 'true':'false', 'aria-label': ariaLabel || '' });
  b.addEventListener('click', () => {
    const next = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', next ? 'true':'false');
    onToggle(next);
  });
  return b;
}

function numberControl(value, min, step, onChange, ariaLabel){
  const i = h('input', { type:'number', value:String(value), min:String(min), step:String(step), inputmode:'numeric', 'aria-label': ariaLabel || '' });
  i.addEventListener('change', () => onChange(Number(i.value)));
  return i;
}

function selectControl(options, value, onChange, ariaLabel){
  const s = h('select', { 'aria-label': ariaLabel || '' });
  options.forEach(o => s.appendChild(h('option', { value:o.value, selected:String(o.value) === String(value) }, o.label)));
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

function renderSettings(){
  const root = $('#settings-body');
  const s = state.settings;   // apenas leitura dos valores atuais; a escrita vai sempre em state.settings

  /* ---------- APARÊNCIA ---------- */
  const aparencia = card('Aparência',
    setRow('Tema', 'Sistema acompanha a preferência do seu computador.',
      segmented([{ value:'dark', label:'Escuro' }, { value:'light', label:'Claro' }, { value:'system', label:'Sistema' }],
        state.settings.theme, v => setThemePreference(v), 'Tema', 'theme-segmented')),
    setRow('Densidade', 'Compacta reduz espaçamentos sem diminuir o tamanho do texto.',
      segmented([{ value:'comfortable', label:'Confortável' }, { value:'compact', label:'Compacta' }],
        s.density, async v => { state.settings.density = v; await saveSettings(); }, 'Densidade')),
    setRow('Reduzir animações', 'Remove transições e efeitos decorativos. Respeita também a preferência do sistema.',
      switchControl(s.reduceMotion, async v => { state.settings.reduceMotion = v; await saveSettings(); }, 'Reduzir animações'))
  );

  /* ---------- ESTUDOS ---------- */
  const estudos = card('Estudos',
    setRow('Duração padrão da sessão', 'Usada como sugestão ao iniciar uma sessão nova.',
      numberControl(s.defaultSessionMinutes, 5, 5, async v => { state.settings.defaultSessionMinutes = v; await saveSettings(); }, 'Duração padrão da sessão em minutos')),
    setRow('Duração padrão da revisão', 'Revisões costumam ser mais curtas que o estudo inicial.',
      numberControl(s.defaultReviewMinutes, 5, 5, async v => { state.settings.defaultReviewMinutes = v; await saveSettings(); }, 'Duração padrão da revisão em minutos')),
    setRow('Primeiro dia da semana', 'Define o início da semana no plano e nas análises.',
      selectControl([{ value:'monday', label:'Segunda-feira' }, { value:'sunday', label:'Domingo' }],
        s.weekStart, async v => { state.settings.weekStart = v; await saveSettings(); await refresh(); }, 'Primeiro dia da semana')),
    setRow('Período padrão das Análises', 'O intervalo já selecionado ao abrir a tela.',
      selectControl([
        { value:'hoje', label:'Hoje' }, { value:'7d', label:'7 dias' }, { value:'30d', label:'30 dias' },
        { value:'semana', label:'Esta semana' }, { value:'mes', label:'Este mês' }, { value:'tudo', label:'Tudo' }
      ], s.defaultPeriod, async v => { state.settings.defaultPeriod = v; await saveSettings(); }, 'Período padrão')),
    setRow('Tela inicial', 'Onde a plataforma abre.',
      selectControl([{ value:'today', label:'Hoje' }, { value:'plan', label:'Planejamento' }, { value:'analytics', label:'Análises' }],
        s.startView, async v => { state.settings.startView = v; await saveSettings(); }, 'Tela inicial'))
  );

  /* ---------- REVISÕES ---------- */
  const revisoes = card('Revisões',
    setRow(labelWithHelp('Estratégia padrão', 'estrategia'),
      'Decide quando o conteúdo volta. Disciplinas e tópicos podem usar outra.',
      selectControl(REVIEW_STRATEGIES.map(x => ({ value:x.v, label: x.v === 'adaptive' ? x.label + ' — recomendada' : x.label })),
        state.settings.defaultReviewStrategy, async v => { state.settings.defaultReviewStrategy = v; await saveSettings(); renderSettings(); }, 'Estratégia padrão de revisão')),
    h('p', { class:'hint', style:'margin:-6px 0 10px',
      text: (REVIEW_STRATEGIES.find(x => x.v === state.settings.defaultReviewStrategy) || REVIEW_STRATEGIES[0]).short }),
    setRow(labelWithHelp('Método padrão', 'metodo'),
      'Decide como revisar. No Automático, o Ciclo sugere conforme a natureza da disciplina.',
      selectControl(REVIEW_METHODS.map(m => ({ value:m.v, label:m.label })),
        state.settings.defaultReviewMethod, async v => { state.settings.defaultReviewMethod = v; await saveSettings(); }, 'Método padrão de revisão')),
    setRow(labelWithHelp('Incluir novos tópicos automaticamente', 'revisao'),
      'Ao criar um tópico, ele já entra no ciclo de revisão. Pode ser alterado tópico a tópico.',
      switchControl(s.autoReviewNewTopics, async v => { state.settings.autoReviewNewTopics = v; await saveSettings(); }, 'Incluir novos tópicos nas revisões')),
    setRow('Mostrar revisões futuras na tela Hoje',
      'Além das pendentes, exibe as que vencem nos próximos dias.',
      switchControl(state.settings.showUpcomingReviews, async v => { state.settings.showUpcomingReviews = v; await saveSettings(); }, 'Mostrar revisões futuras')),
    h('div', { style:'margin-top:10px' },
      h('button', { class:'linkbtn', type:'button', text:'Como funcionam as revisões?', onclick:openReviewPrimer }))
  );

  /* ---------- INTERFACE E AJUDA ---------- */
  const ajuda = card('Interface e ajuda',
    setRow('Ajuda contextual', 'Completa inclui dicas de primeira visita. Discreta mantém só os botões "?". A Central de Ajuda continua disponível em qualquer opção.',
      segmented([{ value:'full', label:'Completa' }, { value:'discreet', label:'Discreta' }, { value:'off', label:'Desativada' }],
        s.helpMode, async v => { state.settings.helpMode = v; await saveSettings(); renderSettings(); }, 'Ajuda contextual')),
    setRow('Explicações ao passar o mouse', 'Mostra detalhes adicionais em gráficos, barras e botões de ajuda.',
      switchControl(s.hoverHints, async v => { state.settings.hoverHints = v; await saveSettings(); }, 'Explicações ao passar o mouse')),
    setRow('Mostrar frase do dia', 'Uma frase curta sobre estudo na tela Hoje. Muda a cada dia, sem usar internet.',
      switchControl(state.settings.showDailyQuote, async v => { state.settings.showDailyQuote = v; await saveSettings(); if(ui.view === 'today') renderToday(); }, 'Mostrar frase do dia')),
    setRow('Dicas de primeira visita', 'Reexibe as dicas que aparecem uma única vez em cada tela.',
      h('button', { class:'btn ghost sm', type:'button', text:'Mostrar novamente',
        onclick: async () => { state.settings.seenTips = []; await saveSettings(); renderTips(); toast('As dicas voltarão a aparecer.', 'ok'); } }))
  );

  /* ---------- DADOS E PRIVACIDADE ---------- */
  const lastBackup = state.meta.lastBackupAt;
  const daysBackup = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null;
  const dados = card('Dados e privacidade',
    h('div', { class:'privacy-grid' },
      statBox('Local', 'armazenamento'),
      statBox('Nenhuma', 'conta'),
      statBox('Nenhuma', 'sincronização'),
      statBox('Nenhum', 'servidor de dados'),
      statBox(lastBackup ? (daysBackup === 0 ? 'hoje' : `há ${daysBackup} ${daysBackup === 1 ? 'dia':'dias'}`) : 'nunca', 'último backup')),
    h('div', { class:'row auto' },
      h('button', { class:'btn primary sm', type:'button', text:'Fazer backup agora',
        onclick: once(exportBackupWithFeedback) }),
      h('button', { class:'btn ghost sm', type:'button', text:'Abrir tela Dados', onclick:() => setView('data') }),
      h('button', { class:'linkbtn', type:'button', text:'Onde meus dados ficam?', onclick:() => openHelpArticleDrawer('onde-dados') }))
  );

  /* ---------- SOBRE ---------- */
  const sobre = card('Sobre',
    h('div', { class:'about-brand' },
      icon('i-brand', 'about-mark'),
      h('div', null,
        h('p', { class:'about-name', text:'Ciclo' }),
        h('p', { class:'hint', text:'Seu sistema de estudos · ', }, h('span', { class:'num', text:'v' + APP_VERSION }), ' · formato de dados ' + APP_SCHEMA_VERSION))),
    h('p', { class:'hint', style:'margin-top:10px', text:'Antes chamado Diário de Estudos. Desenvolvido por Filipe Santana. Aplicação local-first: seus dados ficam neste navegador.' }),
    state.meta.v2MigrationDate ? h('p', { class:'hint', style:'margin-top:6px', text:'Dados da V2 migrados em ' + fmtDateBR(String(state.meta.v2MigrationDate).slice(0,10)) + '.' }) : null,
    h('p', { class:'hint', style:'margin-top:10px' }, 'Dúvidas, sugestões ou problemas: ', h('span', { class:'cc-inline num', text: CONTACT_EMAIL })),
    h('div', { class:'row auto', style:'margin-top:12px' },
      h('button', { class:'btn ghost sm', type:'button', onclick:() => openContactDrawer() }, icon('i-mail'), 'Entrar em contato'),
      h('button', { class:'btn ghost sm', type:'button', onclick:() => openReportProblemDrawer() }, icon('i-flag'), 'Relatar problema'),
      h('button', { class:'btn ghost sm', type:'button', text:'Central de Ajuda', onclick:() => setView('help') }),
      h('button', { class:'btn ghost sm', type:'button', text:'Novidades desta versão', onclick:() => openChangelog() }))
  );

  mount(root, h('div', { class:'settings-grid' },
    h('div', { class:'stack' }, aparencia, revisoes, sobre),
    h('div', { class:'stack' }, estudos, ajuda, dados)));
}

function openChangelog(){
  const body = h('div', CHANGELOG.map(c => h('div', { style:'margin-bottom:16px' },
    h('p', { style:'font-family:var(--serif);font-size:17px;margin-bottom:3px', text:'v' + c.v }),
    h('p', { class:'hint prose', text:c.d }))));
  Drawer.open('Novidades', body);
}

/* =========================================================================
   DICAS CONTEXTUAIS DETERMINÍSTICAS — poucas, e só quando ajudam.
   ========================================================================= */
function planHints(draft){
  const out = [];
  const allocs = draft.allocations.filter(a => getDiscipline(a.disciplineId));
  if(allocs.length >= 3 && allocs.every(a => a.priority === 5)){
    out.push('Quando todas as disciplinas têm prioridade máxima, a prioridade deixa de diferenciá-las e o tempo acaba dividido quase por igual.');
  }
  if(draft.availableMinutes >= 1200){
    const perDay = draft.availableMinutes / 7;
    out.push(`${fmtDuration(draft.availableMinutes)} por semana representam cerca de ${fmtDuration(perDay)} por dia, todos os dias.`);
  }
  const mins = sum(allocs, a => Number(a.minWeeklyMinutes) || 0);
  if(mins > 0 && mins === draft.availableMinutes && allocs.length > 1){
    out.push('Os mínimos ocupam toda a disponibilidade, então a prioridade não tem tempo livre para distribuir.');
  }
  return out;
}

function reviewHints(){
  const out = [];
  const due = ReviewEngine.getDueReviews();
  const overdue = due.filter(t => (daysUntilISO(t.reviewDueDate) || 0) < 0);
  if(overdue.length >= 5){
    out.push(`Existem ${overdue.length} revisões atrasadas. Revisá-las antes de adicionar muito conteúdo novo pode ajudar a reduzir o acúmulo.`);
  }
  return out;
}

/**
 * Sugestões ligadas a prazos. Nada é alterado em silêncio: o usuário decide.
 * (a) prazo próximo → oferecer revisão intensiva na disciplina;
 * (b) prazo já passou → oferecer voltar da intensiva para a estratégia normal.
 */
function renderDeadlineSuggestions(){
  const box = h('div');
  const hoje = todayISO();

  // (a) disciplinas com prazo em até 10 dias que ainda não estão intensivas
  const candidatas = activeDisciplines().filter(d => {
    if(d.reviewStrategy === 'intensive') return false;
    if(state.meta['intensiveDismissed_' + d.id]) return false;
    const dl = state.deadlines.filter(x => !x.completed && x.disciplineId === d.id)
      .map(x => ({ x, days: daysUntilISO(x.date) }))
      .filter(x => x.days !== null && x.days >= 0 && x.days <= 10)
      .sort((a,b) => a.days - b.days)[0];
    if(!dl) return false;
    d.__dl = dl;
    return topicsOf(d.id).some(t => t.reviewEnabled);
  });

  candidatas.slice(0, 2).forEach(d => {
    const dl = d.__dl;
    box.append(h('div', { class:'card elevated suggestion' },
      h('p', { class:'hint prose', style:'margin-bottom:10px',
        text:`Há ${dl.x.title} em ${dl.days} ${dl.days === 1 ? 'dia' : 'dias'} em ${d.name}. Quer usar revisão intensiva nesta disciplina até lá? Os intervalos ficam mais curtos.` }),
      h('div', { class:'row auto' },
        h('button', { class:'btn primary sm', type:'button', text:'Usar revisão intensiva', onclick: async () => {
          const disc = getDiscipline(d.id);
          disc.reviewStrategy = 'intensive';
          await persist('disciplines', disc);
          // uma nova escolha de intensiva reabre a sugestão de voltar ao normal no futuro
          if(state.meta['intensiveKeep_' + disc.id]) await setMeta('intensiveKeep_' + disc.id, false);
          await refresh();
          toast(`${disc.name} passou a usar revisão intensiva. Você pode voltar atrás quando quiser.`, 'ok');
        } }),
        h('button', { class:'btn ghost sm', type:'button', text:'Manter atual', onclick: async () => {
          await setMeta('intensiveDismissed_' + d.id, true);
          renderReviews();
        } }))));
    delete d.__dl;
  });

  // (b) intensiva sem prazo futuro: oferecer voltar ao ritmo normal.
  // v5.1: um prazo HOJE (0 dias) conta como futuro — antes `0 || -1` o descartava —
  // e "Continuar intensiva" passa a ser respeitado (antes o aviso reaparecia sempre).
  const expiradas = activeDisciplines().filter(d => {
    if(d.reviewStrategy !== 'intensive') return false;
    if(state.meta['intensiveKeep_' + d.id]) return false;
    return !state.deadlines.some(x => {
      if(x.completed || x.disciplineId !== d.id) return false;
      const days = daysUntilISO(x.date);
      return days !== null && days >= 0;
    });
  });

  expiradas.slice(0, 2).forEach(d => {
    box.append(h('div', { class:'card elevated suggestion' },
      h('p', { class:'hint prose', style:'margin-bottom:10px',
        text:`${d.name} continua em revisão intensiva, mas não há mais prazo próximo. Quer voltar ao ritmo normal?` }),
      h('div', { class:'row auto' },
        h('button', { class:'btn primary sm', type:'button', text:'Voltar ao padrão', onclick: async () => {
          const disc = getDiscipline(d.id);
          disc.reviewStrategy = 'inherit';
          await persist('disciplines', disc);
          await refresh();
          toast(`${disc.name} voltou a usar a estratégia padrão.`, 'ok');
        } }),
        h('button', { class:'btn ghost sm', type:'button', text:'Continuar intensiva', onclick: async () => {
          await setMeta('intensiveKeep_' + d.id, true);
          renderReviews();
        } }))));
  });

  void hoje;
  return box.children.length ? box : null;
}

function hintBox(texts){
  if(!texts || !texts.length) return null;
  if(state.settings.helpMode === 'off') return null;
  return h('div', { class:'card elevated', style:'margin-top:12px' },
    texts.map(t => h('p', { class:'hint prose', style:'margin-bottom:4px', text:t })));
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
