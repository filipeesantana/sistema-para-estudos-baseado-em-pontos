/* =========================================================================
   CICLO — v5.2.1
   (antes chamado "Diário de Estudos")
   Aplicação local-first. Sem backend, sem rede, sem dependências externas.

   Seções:
     CONSTANTS · UTILITIES · DATE HELPERS · DATABASE · MIGRATION
     DOMAIN MODELS · PRIORITY ENGINE · DEADLINE ENGINE
     PLAN ENGINE · REVIEW ENGINE · RECOMMENDATION ENGINE
     ANALYTICS ENGINE · TIMER SERVICE · BACKUP · UI STATE · RENDERING
     EVENT HANDLERS · INITIALIZATION
   ========================================================================= */
'use strict';

/* =========================================================================
   CONSTANTS
   ========================================================================= */
const APP_VERSION = '5.2.1';
const APP_SCHEMA_VERSION = 5;          // formato LÓGICO dos dados. A v5.2 mudou o conteúdo
                                       // de objetos existentes: tópicos passam a ter
                                       // `priority` (1–5) no lugar de `importance`, e prazos
                                       // ganham tipo, status, data de início, orientações e
                                       // anotações. A v5.2.1 é estabilização: nenhum campo
                                       // persistente novo, por isso o formato continua em 5.

/* Identificadores técnicos LEGADOS. O produto passou a se chamar "Ciclo" na v5.1,
   mas estes nomes ficam como estão: renomeá-los faria o navegador procurar um
   banco/chaves que não existem e o usuário "perderia" os dados já gravados. */
const IDB_NAME = 'diarioEstudosDB';
const IDB_VERSION = 1;                 // schema FÍSICO do IndexedDB: v4 e v5.2 só alteram
                                       // campos dentro dos objetos, nenhuma store ou
                                       // índice novo — por isso continua 1. O prazo mantém
                                       // `date` como data do prazo (há um índice nesse campo).
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

/* =========================================================================
   v5.2 — ESCALA UNIVERSAL DE PRIORIDADE (1–5)
   A mesma pergunta em todo o Ciclo: "quanto isso importa para mim agora?".
   Vale para Disciplina, Tópico e Prazo. Área de Estudo não tem prioridade:
   ela só organiza.
   ========================================================================= */
const PRIORITY_DEFAULT = 3;
const PRIORITY_LEVELS = [
  { v:1, label:'Muito baixa', hint:'Este item merece pouca atenção no momento.' },
  { v:2, label:'Baixa',       hint:'Pode receber menos atenção que o padrão.' },
  { v:3, label:'Mediana',     hint:'Prioridade padrão.' },
  { v:4, label:'Alta',        hint:'Merece atenção frequente.' },
  { v:5, label:'Muito alta',  hint:'Está entre seus principais focos.' }
];
const PRIORITY_LABELS = { 1:'Muito baixa', 2:'Baixa', 3:'Mediana', 4:'Alta', 5:'Muito alta' };

/* Explicação de cada nível ajustada ao que está sendo priorizado. */
const PRIORITY_CONTEXT_HINTS = {
  discipline: {
    1:'Recebe pouco espaço na sua semana por enquanto.',
    2:'Recebe um pouco menos de tempo que o padrão.',
    3:'Prioridade padrão: tempo proporcional ao das outras disciplinas.',
    4:'Merece atenção frequente e recebe mais tempo no planejamento.',
    5:'É um dos seus focos principais e recebe atenção acima do normal.'
  },
  topic: {
    1:'Dentro da disciplina, este tópico pode esperar.',
    2:'Pode receber menos atenção que outros tópicos da disciplina.',
    3:'Prioridade padrão dentro da disciplina.',
    4:'Merece atenção frequente: revisões um pouco mais próximas.',
    5:'Está entre os principais focos da disciplina: revisões mais frequentes.'
  },
  deadline: {
    1:'Este prazo influencia pouco as suas recomendações.',
    2:'Influencia as recomendações um pouco menos que o padrão.',
    3:'Influência padrão, que cresce conforme a data se aproxima.',
    4:'Influencia bastante as recomendações conforme a data se aproxima.',
    5:'É um dos seus prazos principais e pesa bastante nas recomendações.'
  }
};

/* Área de Estudo — rótulos usados na interface. */
const AREA_TERM = 'Área de Estudo';
const NO_AREA_LABEL = 'Sem área';

/* =========================================================================
   v5.2 — PRAZOS
   `date` continua sendo a data do prazo (campo canônico e indexado).
   ========================================================================= */
const DEADLINE_TYPES = [
  { v:'exam',       label:'Prova',    dateLabel:'Data da prova',   dueWord:'Prova' },
  { v:'assignment', label:'Trabalho', dateLabel:'Data de entrega', dueWord:'Entrega' },
  { v:'project',    label:'Projeto',  dateLabel:'Data de entrega', dueWord:'Entrega' },
  { v:'task',       label:'Tarefa',   dateLabel:'Data do prazo',   dueWord:'Prazo' },
  { v:'demand',     label:'Demanda',  dateLabel:'Data do prazo',   dueWord:'Prazo' },
  { v:'delivery',   label:'Entrega',  dateLabel:'Data da entrega', dueWord:'Entrega' },
  { v:'other',      label:'Outro',    dateLabel:'Data do prazo',   dueWord:'Prazo' }
];
const DEADLINE_STATUSES = [
  { v:'pending',     label:'Pendente' },
  { v:'in_progress', label:'Em andamento' },
  { v:'completed',   label:'Concluído' }
];
function deadlineTypeInfo(v){ return DEADLINE_TYPES.find(t => t.v === v) || DEADLINE_TYPES[DEADLINE_TYPES.length - 1]; }
function deadlineStatusLabel(v){ const x = DEADLINE_STATUSES.find(t => t.v === v); return x ? x.label : 'Pendente'; }

/* Conversão das escalas antigas para a escala 1–5.
   Tópico: low/normal/high · Prazo: normal/alta (v3–v5.1).
   Os extremos 1 e 5 ficam livres para o usuário escolher depois. */
const LEGACY_IMPORTANCE_TO_PRIORITY = { low:2, baixa:2, normal:3, high:4, alta:4 };

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
  PRIORITY: 14,          // × atenção efetiva (prioridade do tópico + disciplina), −1..+1
  LOW_MASTERY: 16,       // domínio baixo
  BAD_LAST_RESULT: 12,   // último resultado foi ruim
  FORGET_RATE: 10,       // histórico de esquecimento
  DEADLINE: 18,          // × urgência do prazo ligado ao tópico/disciplina (0..1)
  STALE: 6               // muito tempo sem revisar
};

/* Pesos do planejador automático: prioridade → peso relativo na distribuição. */
/* v5.2 — pesos revistos. Antes 1:2:4:7:10 (P5 recebia 10× o tempo de P1).
   Agora cada nível acima multiplica ~1,5×: com 300 min e disciplinas P1/P3/P5
   a divisão fica ≈ 35/90/175 min — diferença clara, sem distorção. */
const PLANNER = {
  PRIORITY_WEIGHT: { 1:1, 2:1.6, 3:2.5, 4:3.6, 5:5 },
  DEADLINE_BOOST: 0.6,              // prazo urgente multiplica o peso por até 1 + 0,6
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
    /** Escrita atômica em vários stores: ou tudo grava, ou nada.
        `clear` existe aqui para que "apagar e regravar" (restauração de backup)
        aconteça dentro de UMA transação. */
    async transactional(stores, writer){
      const t = tx(stores,'readwrite');
      const api = {
        put:(s, v) => t.objectStore(s).put(v),
        delete:(s, k) => t.objectStore(s).delete(k),
        clear:(s) => t.objectStore(s).clear()
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
  // v5.2: a prioridade substituiu a importância. A migração v5.2 converte;
  // aqui só garantimos que um tópico v3 tenha algo a converter.
  if(!isValidPriority(t.priority) && !t.importance) t.importance = 'normal';
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
   MIGRATION V5.1 → V5.2 (schema 4 → 5)
   Tópicos: importance → priority (1–5). Prazos: importance/completed →
   priority/status + campos novos com padrões seguros.
   NÃO toca em reviewDueDate, reviewIntervalDays, masteryLevel, histórico,
   repetições, lastReviewedAt nem em datas de prazos: nada é reagendado.
   Idempotente: rodar de novo não muda nada.
   ========================================================================= */
function isValidPriority(p){ return Number.isInteger(p) && p >= 1 && p <= 5; }

/** Converte qualquer entrada (número, texto 1–5 ou importância antiga) para 1–5. */
function normalizePriority(value, legacy){
  const n = Number(value);
  if(Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  const key = str(legacy).toLowerCase();
  if(LEGACY_IMPORTANCE_TO_PRIORITY[key]) return LEGACY_IMPORTANCE_TO_PRIORITY[key];
  return PRIORITY_DEFAULT;
}

function upgradeTopicToV52(t){
  if(!isValidPriority(t.priority)) t.priority = normalizePriority(t.priority, t.importance);
  if('importance' in t) delete t.importance;           // uma única fonte de verdade
  return t;
}

function upgradeDeadlineToV52(d){
  if(!isValidPriority(d.priority)) d.priority = normalizePriority(d.priority, d.importance);
  if(!DEADLINE_TYPES.some(x => x.v === d.type)) d.type = 'other';
  if(!DEADLINE_STATUSES.some(x => x.v === d.status)) d.status = d.completed ? 'completed' : 'pending';
  if(!('startDate' in d) || (d.startDate !== null && !parseISO(str(d.startDate)))) d.startDate = null;
  if(typeof d.instructions !== 'string') d.instructions = '';
  if(typeof d.notes !== 'string') d.notes = '';
  if(!('completedAt' in d)) d.completedAt = null;
  if(d.topicId === undefined) d.topicId = null;
  if('importance' in d) delete d.importance;
  if('completed' in d) delete d.completed;              // substituído por status
  return d;
}

async function runV52Migration(){
  const done = await DB.get('meta', 'v52MigrationCompleted');
  if(done && done.value) return { migrated:false, reason:'already' };

  const [topics, deadlines] = await Promise.all([DB.getAll('topics'), DB.getAll('deadlines')]);
  const changedT = [], changedD = [];
  (topics || []).forEach(t => { const b = JSON.stringify(t); upgradeTopicToV52(t); if(JSON.stringify(t) !== b) changedT.push(t); });
  (deadlines || []).forEach(d => { const b = JSON.stringify(d); upgradeDeadlineToV52(d); if(JSON.stringify(d) !== b) changedD.push(d); });

  const stores = ['meta'];
  if(changedT.length) stores.push('topics');
  if(changedD.length) stores.push('deadlines');
  await DB.transactional(stores, api => {
    changedT.forEach(t => api.put('topics', t));
    changedD.forEach(d => api.put('deadlines', d));
    api.put('meta', { key:'v52MigrationCompleted', value:true });
    api.put('meta', { key:'v52MigrationDate', value: nowISO() });
    api.put('meta', { key:'v52MigrationSummary', value:{ topics: changedT.length, deadlines: changedD.length } });
  });
  return { migrated:true, counts:{ topics:changedT.length, deadlines:changedD.length } };
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
    /* v5.2 — prioridade do tópico dentro da disciplina (1–5) */
    priority: PRIORITY_DEFAULT,
    /* v4 */
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
  // `date` = data do prazo (obrigatória). `startDate` = a partir de quando ele influencia.
  return Object.assign({
    id:uid(), title:'', type:'other', date:todayISO(), startDate:null,
    disciplineId:null, topicId:null, priority:PRIORITY_DEFAULT, status:'pending',
    instructions:'', notes:'', completedAt:null, createdAt:ts, updatedAt:ts
  }, data);
}

/* v5.2.1 — cache de consultas derivadas.
   Medição com 40 disciplinas / 400 tópicos / 100 prazos / 5.000 sessões:
   renderToday chamava ReviewEngine.getDueReviews() 82 vezes e renderDisciplines
   chamava PlannerEngine.getCurrentWeekProgress() 40 vezes — cada chamada
   percorrendo todos os tópicos ou todas as sessões. A tela Hoje levava ~510ms e
   Disciplinas ~291ms, com travada visível. As duas consultas são puras dentro de
   uma mesma geração de dados, então bastam ser memorizadas. `bump()` roda
   sempre que os dados mudam (rebuildIndexes) ou a cada render. */
const DerivedCache = {
  _gen: 0,
  _store: new Map(),
  bump(){ this._gen++; this._store.clear(); },
  get(key, compute){
    const k = this._gen + '|' + key;
    if(this._store.has(k)) return this._store.get(k);
    const v = compute();
    this._store.set(k, v);
    return v;
  }
};

function rebuildIndexes(){
  const idx = state.idx;
  DerivedCache.bump();
  if(typeof AnalyticsEngine !== 'undefined') AnalyticsEngine.invalidate();
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
   PRIORITY ENGINE — única fonte de verdade para interpretar prioridade.

   Escala 1–5 normalizada:  n(p) = (p − 3) / 2  →  1:−1 · 2:−0,5 · 3:0 · 4:+0,5 · 5:+1

   • Disciplina: pesa no planejamento, na recomendação e na ordem entre
     disciplinas. Quase não mexe no intervalo de revisão dos tópicos.
   • Tópico: pesa na fila de revisão, no intervalo de revisão e na escolha
     do tópico dentro da disciplina.
   • Comparação GLOBAL entre tópicos usa a atenção efetiva:
         atenção = 0,7 · n(tópico) + 0,3 · n(disciplina)        (−1..+1)
     Exemplos: D5/T5 = +1 · D5/T2 = −0,05 · D1/T5 = +0,4 · D3/T3 = 0.
   • Prioridade é UM fator: atraso, esquecimento, domínio, prazo e plano
     continuam pesando (ver REVIEW_QUEUE_WEIGHTS e RECO).
   ========================================================================= */
const PRIORITY_MODEL = {
  TOPIC_SHARE: 0.7,
  DISCIPLINE_SHARE: 0.3,
  /* intervalo-base × multiplicador. 20 dias → 26 · 23 · 20 · 17 · 14 */
  TOPIC_INTERVAL: { 1:1.30, 2:1.15, 3:1.00, 4:0.85, 5:0.70 },
  /* a disciplina ajusta o intervalo em no máximo ±5% */
  DISCIPLINE_INTERVAL_SPAN: 0.05,
  /* estimativa de tempo de revisão */
  TOPIC_MINUTES: { 1:0.8, 2:0.8, 3:1.0, 4:1.2, 5:1.2 }
};

const PriorityEngine = {
  levels: PRIORITY_LEVELS,

  /** Qualquer valor → inteiro 1–5 (padrão 3). */
  clamp(p){ return normalizePriority(p); },
  label(p){ return PRIORITY_LABELS[this.clamp(p)]; },
  /** "5 · Muito alta" — número + texto, nunca só cor. */
  text(p){ const v = this.clamp(p); return `${v} · ${PRIORITY_LABELS[v]}`; },
  hint(p, context){
    const v = this.clamp(p);
    const byCtx = PRIORITY_CONTEXT_HINTS[context];
    return (byCtx && byCtx[v]) || PRIORITY_LEVELS[v - 1].hint;
  },
  normalized(p){ return (this.clamp(p) - 3) / 2; },

  /** Peso relativo da disciplina na distribuição do planejamento. */
  disciplinePriorityWeight(p){ return PLANNER.PRIORITY_WEIGHT[this.clamp(p)] || 1; },

  /** Peso do tópico dentro da disciplina (0,5 a 1,5). */
  topicPriorityWeight(p){ return 1 + 0.5 * this.normalized(p); },

  /** Atenção efetiva para comparar tópicos de disciplinas diferentes (−1..+1). */
  effectiveTopicAttention(topic){
    if(!topic) return 0;
    const d = getDiscipline(topic.disciplineId);
    return PRIORITY_MODEL.TOPIC_SHARE * this.normalized(topic.priority) +
           PRIORITY_MODEL.DISCIPLINE_SHARE * this.normalized(d ? d.priority : PRIORITY_DEFAULT);
  },

  /** Multiplicador aplicado DEPOIS do intervalo-base calculado pelo ReviewEngine. */
  reviewIntervalModifier(topic){
    if(!topic) return 1;
    const d = getDiscipline(topic.disciplineId);
    const byTopic = PRIORITY_MODEL.TOPIC_INTERVAL[this.clamp(topic.priority)] || 1;
    const byDisc = 1 - PRIORITY_MODEL.DISCIPLINE_INTERVAL_SPAN * this.normalized(d ? d.priority : PRIORITY_DEFAULT);
    return byTopic * byDisc;
  },

  /** Contribuição (positiva ou negativa) para a fila de revisão. */
  reviewQueueModifier(topic){ return REVIEW_QUEUE_WEIGHTS.PRIORITY * this.effectiveTopicAttention(topic); },

  /** Componente 0..1 da disciplina no motor de recomendação. */
  recommendationModifier(disc){ return disc ? (this.clamp(disc.priority) - 1) / 4 : 0.5; },

  /** Fator de tempo estimado para revisar um tópico. */
  minutesFactor(topic){ return topic ? (PRIORITY_MODEL.TOPIC_MINUTES[this.clamp(topic.priority)] || 1) : 1; },

  /** Encaminha para o DeadlineEngine (mantido aqui como ponto único de consulta). */
  deadlineInfluence({ topic, disciplineId } = {}){
    return topic ? DeadlineEngine.forTopic(topic) : DeadlineEngine.forDiscipline(disciplineId);
  }
};

/* =========================================================================
   DEADLINE ENGINE — quanto cada prazo deve influenciar o sistema AGORA.
     urgência = proximidade(dias) × fator(prioridade)           (0..1)
   Proximidade (categorias internas, nunca mostradas como alarme):
     >60 d: 0,05 · 31–60: 0,10 · 15–30: 0,25 · 8–14: 0,45 · 4–7: 0,70
     2–3: 0,85 · 0–1: 1
   Fator de prioridade: 0,6 · 0,7 · 0,8 · 0,9 · 1,0  (P1…P5)
   Um prazo só influencia quando: não está concluído, a data de início
   (se houver) já chegou e a data do prazo não passou.
   ========================================================================= */
const DEADLINE_MODEL = {
  PROXIMITY: [
    { maxDays:1,  value:1.00 },
    { maxDays:3,  value:0.85 },
    { maxDays:7,  value:0.70 },
    { maxDays:14, value:0.45 },
    { maxDays:30, value:0.25 },
    { maxDays:60, value:0.10 }
  ],
  FAR_VALUE: 0.05,
  DISCIPLINE_WIDE_ON_TOPIC: 0.5,   // prazo da disciplina sem tópico → metade para cada tópico
  NOTEWORTHY: 0.45                 // a partir daqui vira motivo explícito ("Prova em 10 dias")
};

const DeadlineEngine = {
  isDone(dl){ return !!dl && dl.status === 'completed'; },
  daysLeft(dl){ return dl ? daysUntilISO(dl.date) : null; },
  hasStarted(dl){
    if(!dl || !dl.startDate) return true;
    return str(dl.startDate) <= todayISO();
  },
  /** Pendente/em andamento, iniciado e com data ainda por vir (hoje incluso). */
  isActive(dl){
    if(!dl || this.isDone(dl) || !this.hasStarted(dl)) return false;
    const n = this.daysLeft(dl);
    return n !== null && n >= 0;
  },
  isOverdue(dl){ const n = this.daysLeft(dl); return !!dl && !this.isDone(dl) && n !== null && n < 0; },
  proximity(days){
    if(days === null || days < 0) return 0;
    for(const r of DEADLINE_MODEL.PROXIMITY) if(days <= r.maxDays) return r.value;
    return DEADLINE_MODEL.FAR_VALUE;
  },
  priorityFactor(p){ return 0.5 + 0.1 * PriorityEngine.clamp(p); },
  urgency(dl){
    if(!this.isActive(dl)) return 0;
    return this.proximity(this.daysLeft(dl)) * this.priorityFactor(dl.priority);
  },
  /** Prazos que ainda contam (não concluídos), do mais próximo ao mais distante. */
  open(){
    return state.deadlines.filter(d => !this.isDone(d))
      .sort((a,b) => str(a.date).localeCompare(str(b.date)));
  },
  /** Maior urgência entre os prazos da disciplina (com ou sem tópico). */
  forDiscipline(disciplineId){
    if(!disciplineId) return { score:0, deadline:null, days:null };
    return DerivedCache.get('dlDisc:' + disciplineId + ':' + todayISO(), () => this._forDiscipline(disciplineId));
  },
  _forDiscipline(disciplineId){
    let best = { score:0, deadline:null, days:null };
    state.deadlines.forEach(dl => {
      if(dl.disciplineId !== disciplineId) return;
      const u = this.urgency(dl);
      if(u > best.score) best = { score:u, deadline:dl, days:this.daysLeft(dl) };
    });
    return best;
  },
  /**
   * Urgência para um tópico: prazo do PRÓPRIO tópico conta inteiro; prazo da
   * disciplina sem tópico conta pela metade. Prazo de outro tópico não conta.
   */
  forTopic(topic){
    let best = { score:0, deadline:null, days:null, specific:false };
    if(!topic) return best;
    state.deadlines.forEach(dl => {
      let factor = 0;
      if(dl.topicId && dl.topicId === topic.id) factor = 1;
      else if(!dl.topicId && dl.disciplineId && dl.disciplineId === topic.disciplineId) factor = DEADLINE_MODEL.DISCIPLINE_WIDE_ON_TOPIC;
      if(!factor) return;
      const u = this.urgency(dl) * factor;
      if(u > best.score) best = { score:u, deadline:dl, days:this.daysLeft(dl), specific: factor === 1 };
    });
    return best;
  },
  /** "Prova de Redes em 5 dias" / "Entrega do Projeto amanhã". */
  phrase(dl){
    const n = this.daysLeft(dl);
    const when = n === null ? '' : n < 0 ? `venceu ${fmtRelativePast(dl.date)}` : n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`;
    return `${dl.title} ${when}`.trim();
  },
  /** "Entrega em 6 dias" · "Prova hoje" · "Prazo venceu há 2 dias". */
  dueText(dl){
    const info = deadlineTypeInfo(dl.type);
    const n = this.daysLeft(dl);
    if(this.isDone(dl)) return 'Concluído' + (dl.completedAt ? ' em ' + fmtDateBR(str(dl.completedAt).slice(0,10)) : '');
    if(n === null) return info.dueWord;
    if(n < 0) return `${info.dueWord} venceu há ${-n} ${-n === 1 ? 'dia' : 'dias'}`;
    if(n === 0) return `${info.dueWord} hoje`;
    if(n === 1) return `${info.dueWord} amanhã`;
    return `${info.dueWord} em ${n} dias`;
  }
};

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
        return PriorityEngine.disciplinePriorityWeight(i.priority) * this._deadlineMultiplier(i.disciplineId);
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

  /** Prazo ativo e próximo aumenta o peso da disciplina (até 1,6×). */
  _deadlineMultiplier(disciplineId){
    return 1 + PLANNER.DEADLINE_BOOST * DeadlineEngine.forDiscipline(disciplineId).score;
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
    const ws = dateToISO(startOfWeek(dateRef || today()));
    return DerivedCache.get('weekProgress:' + ws, () => this._computeWeekProgress(dateRef));
  },

  _computeWeekProgress(dateRef){
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
    // prioridade alta do tópico merece um pouco mais de tempo, sem distorcer a conta
    const factor = PriorityEngine.minutesFactor(topic);
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

    // v5.2 — a prioridade do tópico MODULA o intervalo-base (não o substitui).
    // "Esqueci" continua voltando no dia seguinte, qualquer que seja a prioridade.
    if(outcome !== 'forgot'){
      interval = Math.max(1, Math.round(interval * PriorityEngine.reviewIntervalModifier(topic)));
    }
    // Prazo ativo ligado a ESTE tópico: a próxima revisão cai antes dele.
    // A estratégia escolhida pelo usuário não é alterada.
    const dlInfo = DeadlineEngine.forTopic(topic);
    if(dlInfo.specific && dlInfo.days !== null && dlInfo.days >= 2 && interval > dlInfo.days - 1){
      interval = Math.max(1, dlInfo.days - 1);
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
    const future = state.deadlines.some(dl => !DeadlineEngine.isDone(dl) && dl.disciplineId === d.id && (daysUntilISO(dl.date) ?? -1) >= 0);
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
    // Lista consultada dezenas de vezes por render (uma vez por disciplina).
    // O resultado é o mesmo enquanto os dados não mudarem.
    return DerivedCache.get('dueReviews:' + ref, () => this.allScheduled()
      .filter(t => t.reviewDueDate <= ref)
      .sort((a,b) => a.reviewDueDate.localeCompare(b.reviewDueDate) || sortByName(a,b)));
  },

  /** Contagem de vencidas por disciplina, calculada de uma vez só. */
  dueCountMap(){
    return DerivedCache.get('dueCountMap:' + todayISO(), () => {
      const m = new Map();
      this.getDueReviews().forEach(t => m.set(t.disciplineId, (m.get(t.disciplineId) || 0) + 1));
      return m;
    });
  },

  getUpcomingReviews(days){
    const from = addDaysISO(todayISO(), 1);
    const to = addDaysISO(todayISO(), days || 7);
    return this.allScheduled()
      .filter(t => t.reviewDueDate >= from && t.reviewDueDate <= to)
      .sort((a,b) => a.reviewDueDate.localeCompare(b.reviewDueDate) || sortByName(a,b));
  },

  dueCountFor(disciplineId){ return this.dueCountMap().get(disciplineId) || 0; },
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

    // prioridade: tópico pesa 70%, disciplina 30% (PriorityEngine). Pode subir ou descer.
    score += PriorityEngine.reviewQueueModifier(topic);
    const tp = PriorityEngine.clamp(topic.priority);
    const disc = getDiscipline(topic.disciplineId);
    if(tp >= 4) reasons.push(`prioridade ${PRIORITY_LABELS[tp].toLowerCase()}`);
    else if(tp === 3 && disc && PriorityEngine.clamp(disc.priority) === 5) reasons.push(`${disc.name} é prioridade muito alta`);

    const mastery = topic.masteryLevel || REVIEW_INITIAL_MASTERY;
    if(mastery <= 2){ score += W.LOW_MASTERY * ((3 - mastery) / 2); reasons.push(`domínio ${mastery}/5`); }

    if(topic.lastReviewOutcome === 'forgot'){ score += W.BAD_LAST_RESULT; reasons.push('você esqueceu na última revisão'); }
    else if(topic.lastReviewOutcome === 'hard'){ score += W.BAD_LAST_RESULT * 0.6; reasons.push('você teve dificuldade na última revisão'); }

    const fails = topic.reviewFailures || 0;
    if(fails >= 2){ score += Math.min(W.FORGET_RATE, fails * 3); reasons.push(`já esqueceu ${fails} vezes`); }

    // prazo: prioridade × proximidade. Prazo de outro tópico não conta.
    const dl = DeadlineEngine.forTopic(topic);
    if(dl.score > 0){
      score += W.DEADLINE * dl.score;
      if(dl.days !== null && dl.days <= 14) reasons.push(DeadlineEngine.phrase(dl.deadline));
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
  /**
   * Componentes normalizados (0..1) de uma disciplina. Cada fator é limitado a
   * 0..1 antes de receber peso, então prioridade + prazo + revisões nunca somam
   * um valor capaz de travar a recomendação numa só disciplina por semanas.
   */
  scoreDiscipline(disc, ctx){
    const prog = ctx.deficits.get(disc.id);
    const planned = prog ? prog.planned : 0;
    const realized = prog ? prog.realized : (ctx.realizedByDisc.get(disc.id) || 0);
    const remaining = prog ? prog.remaining : 0;

    // Sem plano ativo, todas partem de um déficit neutro para não travar a recomendação.
    const deficitScore = planned > 0 ? clamp(remaining / planned, 0, 1) : 0.5;
    const priorityScore = clamp(PriorityEngine.recommendationModifier(disc), 0, 1);

    const lastISO = lastStudyISO(disc.id);
    const daysSince = lastISO === null ? RECO.RECENCY_CAP_DAYS : (daysSinceISO(lastISO) || 0);
    const recencyScore = clamp(daysSince / RECO.RECENCY_CAP_DAYS, 0, 1);

    const dlInfo = DeadlineEngine.forDiscipline(disc.id);
    const deadline = dlInfo.deadline ? { dl: dlInfo.deadline, days: dlInfo.days, score: dlInfo.score } : null;
    const deadlineScore = clamp(dlInfo.score, 0, 1);

    const dueTopics = ReviewEngine.getDueReviews().filter(t => t.disciplineId === disc.id);
    const dueCount = dueTopics.length;
    const overdue = ReviewEngine.maxOverdueDaysFor(disc.id);
    // revisões de tópicos prioritários pressionam um pouco mais (±25%), sempre limitado a 1
    const meanAttention = dueCount ? sum(dueTopics, t => PriorityEngine.effectiveTopicAttention(t)) / dueCount : 0;
    const reviewPressureScore = clamp(((dueCount / RECO.REVIEW_CAP) + (overdue > 0 ? 0.2 : 0)) * (1 + 0.25 * meanAttention), 0, 1);

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

  _lowMastery(disciplineId){
    const tps = topicsOf(disciplineId).filter(t => t.masteryLevel);
    if(!tps.length) return 0.5;
    const avg = sum(tps, t => t.masteryLevel) / tps.length;
    return clamp(1 - ((avg - 1) / 4), 0, 1);
  },

  /**
   * Escolhe o tópico da vez dentro da disciplina. Dentro de uma disciplina só a
   * prioridade do TÓPICO importa (a da disciplina é igual para todos).
   * Ordem: revisão vencida (fila inteligente) → prazo do próprio tópico →
   * domínio baixo → sem contato há dias → não iniciado → em andamento.
   */
  pickTopic(disciplineId){
    const tps = topicsOf(disciplineId);
    if(!tps.length) return { topic:null, suggestedType:null, reason:null };
    const w = t => PriorityEngine.topicPriorityWeight(t.priority);
    const byPriority = (a, b) => w(b) - w(a);

    const due = tps.filter(t => t.reviewEnabled && t.reviewDueDate && t.reviewDueDate <= todayISO())
                   .map(t => ReviewEngine.scoreDue(t))
                   .sort((a, b) => b.score - a.score);
    if(due.length) return { topic:due[0].topic, suggestedType:'revisao', reason:'revisão pendente deste tópico' };

    const withDeadline = tps.map(t => ({ t, dl: DeadlineEngine.forTopic(t) }))
      .filter(x => x.dl.specific && x.dl.score >= DEADLINE_MODEL.NOTEWORTHY)
      .sort((a, b) => b.dl.score - a.dl.score);
    if(withDeadline.length) return { topic:withDeadline[0].t, suggestedType:null, reason: DeadlineEngine.phrase(withDeadline[0].dl.deadline) };

    const inStudy = tps.filter(t => topicStatus(t) === 'em_estudo' || topicStatus(t) === 'em_revisao');
    const lowRetention = inStudy.filter(t => (t.masteryLevel || 5) <= 2)
                                .sort((a, b) => ((a.masteryLevel || 5) - (b.masteryLevel || 5)) || byPriority(a, b));
    if(lowRetention.length) return { topic:lowRetention[0], suggestedType:null, reason:'tópico com domínio baixo' };

    // tempo sem contato ponderado pela prioridade do tópico
    const stale = inStudy.filter(t => t.lastStudiedAt && (daysSinceISO(t.lastStudiedAt) || 0) >= 3)
                         .sort((a, b) => ((daysSinceISO(b.lastStudiedAt) || 0) * w(b)) - ((daysSinceISO(a.lastStudiedAt) || 0) * w(a)));
    if(stale.length) return { topic:stale[0], suggestedType:null, reason:'em estudo, mas sem contato há dias' };

    const notStarted = tps.filter(t => topicStatus(t) === 'nao_iniciado').sort(byPriority);   // sort estável: mantém a ordem manual
    if(notStarted.length) return { topic:notStarted[0], suggestedType:null, reason:'próximo tópico ainda não iniciado' };

    if(inStudy.length) return { topic:inStudy.slice().sort(byPriority)[0], suggestedType:null, reason:'continuar o conteúdo em andamento' };
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

  /** Frases explicáveis a partir dos componentes que realmente pesaram. Nunca o score. */
  buildReasons(disc, scored, topicPick){
    const r = [];
    const f = scored.facts;
    if(f.planned > 0 && f.remaining > 0) r.push(`ainda faltam ${fmtDuration(f.remaining)} de ${disc.name} no plano desta semana`);
    else if(f.planned > 0 && f.remaining === 0) r.push('plano semanal desta disciplina já cumprido');
    const dp = PriorityEngine.clamp(disc.priority);
    if(dp >= 4) r.push(`${disc.name} é prioridade ${PRIORITY_LABELS[dp].toLowerCase()}`);
    const topic = topicPick && topicPick.topic;
    if(topic && PriorityEngine.clamp(topic.priority) >= 4) r.push(`${topic.name} é prioridade ${PriorityEngine.label(topic.priority).toLowerCase()}`);
    if(f.lastISO === null) r.push('ainda sem nenhuma sessão registrada');
    else if(f.daysSince >= 2) r.push(`último estudo ${fmtRelativePast(f.lastISO)}`);
    if(f.dueCount > 0) r.push(`${f.dueCount} ${f.dueCount === 1 ? 'revisão pendente' : 'revisões pendentes'}${f.overdue > 0 ? ` (atraso de ${f.overdue} ${f.overdue===1?'dia':'dias'})` : ''}`);
    if(f.deadline && f.deadline.days !== null && f.deadline.days <= 30 && !(topicPick && topicPick.reason === DeadlineEngine.phrase(f.deadline.dl))){
      r.push(DeadlineEngine.phrase(f.deadline.dl));
    }
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
   ANALYTICS SCOPE — "o que analisar": tudo, uma Área de Estudo, uma
   disciplina ou um tópico. Toda filtragem das Análises passa por aqui.
   ========================================================================= */
const NO_AREA_ID = '__none__';
const SCOPE_KIND_LABEL = { all:'Tudo', area:AREA_TERM, discipline:'Disciplina', topic:'Tópico' };

function defaultAnalyticsScope(){ return { type:'all', areaId:null, disciplineId:null, topicId:null }; }

const AnalyticsScope = {
  /** Converte a escolha salva em um escopo utilizável. Entidade removida → volta para "Tudo". */
  resolve(raw){
    const s = Object.assign(defaultAnalyticsScope(), raw || {});
    const areaPath = (d) => {
      const a = d && d.areaId ? getArea(d.areaId) : null;
      return a ? [a.name] : [];
    };
    if(s.type === 'area'){
      if(s.areaId === NO_AREA_ID){
        const ids = state.disciplines.filter(d => !d.areaId || !getArea(d.areaId)).map(d => d.id);
        return { type:'area', areaId:NO_AREA_ID, disciplineId:null, topicId:null,
                 discIds:new Set(ids), label:NO_AREA_LABEL, path:[NO_AREA_LABEL] };
      }
      const a = getArea(s.areaId);
      if(a){
        const ids = state.disciplines.filter(d => d.areaId === a.id).map(d => d.id);
        return { type:'area', areaId:a.id, disciplineId:null, topicId:null,
                 discIds:new Set(ids), label:a.name, path:[a.name] };
      }
    } else if(s.type === 'discipline'){
      const d = getDiscipline(s.disciplineId);
      if(d){
        return { type:'discipline', areaId:d.areaId || null, disciplineId:d.id, topicId:null,
                 discIds:new Set([d.id]), label:d.name, path:[...areaPath(d), d.name] };
      }
    } else if(s.type === 'topic'){
      const t = getTopic(s.topicId);
      const d = t ? getDiscipline(t.disciplineId) : null;
      if(t && d){
        return { type:'topic', areaId:d.areaId || null, disciplineId:d.id, topicId:t.id,
                 discIds:new Set([d.id]), label:t.name, path:[...areaPath(d), d.name, t.name] };
      }
    }
    return { type:'all', areaId:null, disciplineId:null, topicId:null, discIds:null,
             label:'Todos os estudos', path:[], fellBack: s.type !== 'all' };
  },
  key(r){ return [r.type, r.areaId || '', r.disciplineId || '', r.topicId || ''].join(':'); },
  kindLabel(r){ return SCOPE_KIND_LABEL[r.type] || 'Tudo'; },
  /** "Tecnologia › Redes de Computadores › OSPF" */
  pathText(r){ return r.type === 'all' ? 'Todos os estudos' : r.path.join(' › '); },
  isAll(r){ return r.type === 'all'; },

  hasSession(r, s){
    if(r.type === 'all') return true;
    if(r.type === 'topic') return s.topicId === r.topicId;
    return r.discIds.has(s.disciplineId);
  },
  hasDiscipline(r, id){ return r.type === 'all' || r.discIds.has(id); },
  hasTopic(r, t){
    if(r.type === 'topic') return t.id === r.topicId;
    return r.type === 'all' || r.discIds.has(t.disciplineId);
  },
  /** 'own' = prazo do escopo · 'discipline' = prazo da disciplina inteira (escopo de tópico) · null = fora. */
  deadlineRelation(r, dl){
    if(r.type === 'all') return 'own';
    if(r.type === 'topic'){
      if(dl.topicId && dl.topicId === r.topicId) return 'own';
      if(!dl.topicId && dl.disciplineId === r.disciplineId) return 'discipline';
      return null;
    }
    return dl.disciplineId && r.discIds.has(dl.disciplineId) ? 'own' : null;
  },
  sessions(r, range){
    const list = range ? sessionsInRange(range) : state.sessions;
    return r.type === 'all' ? list : list.filter(s => this.hasSession(r, s));
  },
  disciplines(r){ return activeDisciplines().filter(d => this.hasDiscipline(r, d.id)); },
  topics(r){
    return state.topics.filter(t => {
      if(t.archived || !this.hasTopic(r, t)) return false;
      const d = getDiscipline(t.disciplineId);
      return d && !d.archived;
    });
  }
};

/** Número seguro para exibir: nunca "NaN", "Infinity" ou "undefined". */
function safePct(v){ return isNum(v) ? fmtPct(v) : '—'; }
function plural(n, one, many){ return `${n} ${n === 1 ? one : many}`; }

/* =========================================================================
   ANALYTICS ENGINE — calcula tudo uma vez por (período, escopo) e guarda
   o resultado em cache até os dados mudarem.
   Frases são sempre factuais: descrevem o que aconteceu, nunca a causa.
   ========================================================================= */
const AnalyticsEngine = {
  _cache: new Map(),
  invalidate(){ this._cache.clear(); },

  build(range, rawScope){
    const scope = AnalyticsScope.resolve(rawScope);
    const key = [dateToISO(range.start), dateToISO(range.end), AnalyticsScope.key(scope),
                 todayISO(), weekStartDow()].join('|');
    const hit = this._cache.get(key);
    if(hit) return hit;
    const a = this._compute(range, scope);
    if(this._cache.size >= 16) this._cache.clear();
    this._cache.set(key, a);
    return a;
  },

  _compute(range, scope){
    const sessions = AnalyticsScope.sessions(scope, range);
    const days = rangeDays(range);
    const prevRange = this.previousRange(range);
    const prevSessions = AnalyticsScope.sessions(scope, prevRange);

    const totals = this.totals(sessions, days);
    const previousComparison = this.compare(totals, this.totals(prevSessions, rangeDays(prevRange)), prevRange);

    const topicKey = s => s.topicId || '__none__';
    const topicLabel = id => {
      if(id === '__none__') return 'Sem tópico definido';
      const t = getTopic(id); return t ? t.name : '(tópico removido)';
    };
    const byDiscipline = this.groupMinutes(sessions, s => s.disciplineId, id => disciplineName(id));
    const byArea = this.groupMinutes(sessions,
      s => { const d = getDiscipline(s.disciplineId); return d && d.areaId && getArea(d.areaId) ? d.areaId : NO_AREA_ID; },
      id => id === NO_AREA_ID ? NO_AREA_LABEL : (getArea(id) ? getArea(id).name : '(área removida)'));
    const byTopic = this.groupMinutes(sessions, topicKey, topicLabel);
    const byType = this.typeDistribution(sessions);
    const byWeekday = this.weekdayDistribution(sessions);
    const difficulty = this.difficulty(sessions);
    const planAdherence = this.planAdherence(range, scope);
    const reviews = this.reviewStats(range, scope, sessions);
    const content = this.contentStats(scope);
    const deadlines = this.deadlineStats(range, scope, sessions);
    const priorities = this.priorityStats(scope, sessions);
    const attention = this.attentionTopics(scope, range);
    const projection = this.projection(scope);

    const a = { range, days, scope, sessions, totals, previousComparison, byDiscipline, byArea, byTopic,
                byType, byWeekday, difficulty, planAdherence, reviews, content, deadlines, priorities,
                attention, projection };
    a.summary = this.summary(a);
    a.insights = this.insights(a);
    a.positives = this.positives(a);
    a.warnings = this.warnings(a);
    return a;
  },

  totals(sessions, days){
    const minutes = sum(sessions, s => s.minutes || 0);
    const credits = sum(sessions, s => s.credits || 0);
    const activeDays = new Set(sessions.map(s => s.date)).size;
    return {
      minutes, credits, count: sessions.length, activeDays, days,
      avgSession: sessions.length ? minutes / sessions.length : 0,
      avgPerDay: days > 0 ? minutes / days : 0,
      avgPerActiveDay: activeDays > 0 ? minutes / activeDays : 0,
      consistency: days > 0 ? (activeDays / days) * 100 : 0
    };
  },

  previousRange(range){
    const n = rangeDays(range);
    const end = addDays(range.start, -1);
    return { start: addDays(end, -(n - 1)), end };
  },

  compare(cur, prev, prevRange){
    if(!prev || prev.minutes <= 0) return { available:false, prevRange, prev };
    const delta = (a, b) => b > 0 ? ((a - b) / b) * 100 : null;
    return {
      available:true, prevRange, prev,
      minutesDelta: delta(cur.minutes, prev.minutes),
      sessionsDelta: delta(cur.count, prev.count),
      activeDaysDelta: delta(cur.activeDays, prev.activeDays),
      creditsDelta: delta(cur.credits, prev.credits)
    };
  },

  groupMinutes(sessions, keyFn, labelFn){
    const map = new Map();
    sessions.forEach(s => {
      const k = keyFn(s);
      if(k === null || k === undefined) return;
      const cur = map.get(k) || { key:k, minutes:0, credits:0, count:0 };
      cur.minutes += s.minutes || 0; cur.credits += s.credits || 0; cur.count++;
      map.set(k, cur);
    });
    const total = sum(Array.from(map.values()), x => x.minutes);
    return Array.from(map.values())
      .map(x => ({ ...x, label: labelFn(x.key), pct: total > 0 ? (x.minutes / total) * 100 : 0 }))
      .sort((a,b) => (b.minutes - a.minutes) || str(a.label).localeCompare(str(b.label), 'pt-BR'));
  },

  typeDistribution(sessions){
    const map = new Map();
    sessions.forEach(s => { const k = s.type || '__none__'; map.set(k, (map.get(k) || 0) + 1); });
    const total = sessions.length;
    const minutesOf = k => sum(sessions.filter(s => (s.type || '__none__') === k), s => s.minutes || 0);
    const rows = SESSION_TYPES.map(t => ({ key:t.v, label:t.label, count: map.get(t.v) || 0, minutes: minutesOf(t.v) }));
    if(map.get('__none__')) rows.push({ key:'__none__', label:'Não informado', count: map.get('__none__'), minutes: minutesOf('__none__') });
    return rows.map(r => ({ ...r, pct: total > 0 ? (r.count / total) * 100 : 0 }));
  },

  weekdayDistribution(sessions){
    const names = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    const order = weekStartDow() === 1 ? [1,2,3,4,5,6,0] : [0,1,2,3,4,5,6];
    const mins = [0,0,0,0,0,0,0];
    sessions.forEach(s => { const d = parseISO(s.date); if(d) mins[d.getDay()] += s.minutes || 0; });
    return order.map(i => ({ dow:i, label:names[i], minutes:mins[i] }));
  },

  difficulty(sessions){
    const withD = sessions.filter(s => s.difficulty);
    const counts = DIFFICULTIES.map(d => ({ ...d, count: withD.filter(s => s.difficulty === d.v).length }));
    const avg = withD.length ? sum(withD, s => s.difficulty) / withD.length : null;
    const groupAvg = (list, keyFn, labelFn) => {
      const m = new Map();
      list.forEach(s => { const k = keyFn(s); if(!m.has(k)) m.set(k, []); m.get(k).push(s.difficulty); });
      return Array.from(m.entries())
        .map(([id, vals]) => ({ id, label: labelFn(id), avg: sum(vals) / vals.length, count: vals.length }))
        .sort((a,b) => b.avg - a.avg);
    };
    return {
      avg, count: withD.length, counts,
      perDiscipline: groupAvg(withD, s => s.disciplineId, id => disciplineName(id)),
      perTopic: groupAvg(withD.filter(s => s.topicId), s => s.topicId, id => { const t = getTopic(id); return t ? t.name : '(tópico removido)'; })
    };
  },

  /**
   * Planejado × realizado usando o plano que existia em cada semana tocada
   * pelo período. O plano é por disciplina: no escopo de tópico ele não se aplica.
   */
  planAdherence(range, scope){
    const empty = { applicable: scope.type !== 'topic', hasPlan:false, planned:0, realized:0, weeks:[], perDiscipline:[], pct:null };
    if(scope.type === 'topic') return empty;
    const weeks = [];
    let cursor = startOfWeek(range.start);
    const last = startOfWeek(range.end);
    let guard = 0;
    const scoped = AnalyticsScope.sessions(scope, range);
    while(cursor <= last && guard++ < 520){
      const ws = dateToISO(cursor);
      const wp = state.weeklyPlans.find(w => w.weekStart === ws);
      const wStart = cursor, wEnd = addDays(cursor, 6);
      const clipStart = wStart < range.start ? range.start : wStart;
      const clipEnd = wEnd > range.end ? range.end : wEnd;
      const coveredDays = diffDays(clipEnd, clipStart) + 1;
      const factor = clamp(coveredDays / 7, 0, 1);          // semana parcial conta proporcionalmente
      const a = dateToISO(clipStart), b = dateToISO(clipEnd);
      const realized = sum(scoped.filter(s => s.date >= a && s.date <= b), s => s.minutes || 0);
      const allocs = wp ? (wp.allocations || []).filter(x => AnalyticsScope.hasDiscipline(scope, x.disciplineId)) : [];
      const planned = sum(allocs, x => x.targetMinutes || 0) * factor;
      weeks.push({ weekStart: ws, weeklyPlan: wp || null, allocs, planned, realized, factor, coveredDays,
                   weekNumber: isoWeekNumber(wStart),
                   pct: planned > 0 ? (realized / planned) * 100 : null });
      cursor = addDays(cursor, 7);
    }
    const planned = sum(weeks, w => w.planned);
    const realized = sum(weeks, w => w.realized);
    const hasPlan = planned > 0;
    if(!hasPlan) return { ...empty, weeks, realized };

    const map = new Map();
    weeks.forEach(w => w.allocs.forEach(al => {
      const cur = map.get(al.disciplineId) || { disciplineId:al.disciplineId, planned:0, realized:0 };
      cur.planned += (al.targetMinutes || 0) * w.factor;
      map.set(al.disciplineId, cur);
    }));
    scoped.forEach(s => {
      const cur = map.get(s.disciplineId) || { disciplineId:s.disciplineId, planned:0, realized:0 };
      cur.realized += s.minutes || 0;
      map.set(s.disciplineId, cur);
    });
    const perDiscipline = [];
    map.forEach(v => {
      const d = getDiscipline(v.disciplineId);
      perDiscipline.push({ ...v, label: d ? d.name : '(disciplina removida)', archived: d ? !!d.archived : true,
                           priority: d ? PriorityEngine.clamp(d.priority) : PRIORITY_DEFAULT,
                           pct: v.planned > 0 ? (v.realized / v.planned) * 100 : null });
    });
    perDiscipline.sort((a,b) => (a.pct === null ? 999 : a.pct) - (b.pct === null ? 999 : b.pct));
    return { applicable:true, hasPlan, planned, realized, weeks, perDiscipline, pct: (realized / planned) * 100 };
  },

  /** Revisões concluídas no período × previstas (vencidas no período), dentro do escopo. */
  reviewStats(range, scope, sessions){
    const done = sessions.filter(s => s.type === 'revisao' || s.reviewOutcome);
    const a = dateToISO(range.start), b = dateToISO(range.end);
    const inScope = t => AnalyticsScope.hasTopic(scope, t);
    const scheduledTopics = ReviewEngine.allScheduled().filter(inScope);
    const scheduledInRange = scheduledTopics.filter(t => t.reviewDueDate >= a && t.reviewDueDate <= b).length;
    const due = ReviewEngine.getDueReviews().filter(inScope);
    const overdueList = due.filter(t => (daysUntilISO(t.reviewDueDate) || 0) < 0);
    const outcomes = REVIEW_OUTCOMES.map(o => ({ ...o, count: done.filter(s => s.reviewOutcome === o.v).length }));

    // uso e resultado por método — descritivo, nunca causal
    const methodMap = new Map();
    done.filter(x => x.reviewMethod).forEach(x => {
      if(!methodMap.has(x.reviewMethod)) methodMap.set(x.reviewMethod, { used:0, good:0 });
      const m = methodMap.get(x.reviewMethod);
      m.used++;
      if(x.reviewOutcome === 'remembered' || x.reviewOutcome === 'mastered') m.good++;
    });
    const byMethod = Array.from(methodMap.entries())
      .map(([k,v]) => ({ method:k, label:methodLabel(k), used:v.used, good:v.good, rate: v.used ? (v.good / v.used) * 100 : null }))
      .sort((x,y) => y.used - x.used);

    const forgetful = AnalyticsScope.topics(scope)
      .filter(t => (t.reviewFailures || 0) >= 2)
      .sort((x,y) => (y.reviewFailures || 0) - (x.reviewFailures || 0))
      .slice(0, 5);

    const withMastery = scheduledTopics.filter(t => t.masteryLevel);
    const avgMastery = withMastery.length ? sum(withMastery, t => t.masteryLevel) / withMastery.length : null;
    const expected = scheduledInRange + done.length;
    const upcoming = ReviewEngine.getUpcomingReviews(7).filter(inScope);
    return {
      completed: done.length, scheduled: scheduledInRange, expected,
      rate: expected > 0 ? (done.length / expected) * 100 : null,
      overdueNow: overdueList.length, overdueList, dueToday: due.length, dueList: due, upcoming,
      outcomes, minutes: sum(done, s => s.minutes || 0), sessionsList: done,
      byMethod, forgetful, avgMastery, scheduledCount: scheduledTopics.length
    };
  },

  /** Conteúdo estudado (cobertura) e consolidado (domínio) no escopo. */
  contentStats(scope){
    const discs = AnalyticsScope.disciplines(scope);
    const topics = AnalyticsScope.topics(scope);
    const status = new Map(topics.map(t => [t.id, topicStatus(t)]));
    const per = discs.map(d => {
      const tps = topics.filter(t => t.disciplineId === d.id);
      const total = tps.length;
      const covered = tps.filter(t => status.get(t.id) !== 'nao_iniciado').length;
      const mastered = tps.filter(t => status.get(t.id) === 'dominado').length;
      return { discipline:d, total, covered, mastered,
               coverage: total ? covered / total * 100 : null, mastery: total ? mastered / total * 100 : null };
    }).filter(x => x.total > 0);
    const total = topics.length;
    const covered = topics.filter(t => status.get(t.id) !== 'nao_iniciado').length;
    const mastered = topics.filter(t => status.get(t.id) === 'dominado').length;
    const byStatus = Object.keys(TOPIC_STATUS_LABEL).map(k => ({ key:k, label:TOPIC_STATUS_LABEL[k],
      count: topics.filter(t => status.get(t.id) === k).length }));
    const weakest = topics.filter(t => t.masteryLevel)
      .sort((a,b) => (a.masteryLevel - b.masteryLevel) || sortByName(a,b))
      .slice(0, 5);
    const notStarted = topics.filter(t => status.get(t.id) === 'nao_iniciado')
      .sort((a,b) => (PriorityEngine.clamp(b.priority) - PriorityEngine.clamp(a.priority)) || sortByName(a,b));
    return {
      totalTopics: total, covered, mastered, byStatus,
      coverage: total > 0 ? (covered / total) * 100 : null,
      masteryPct: total > 0 ? (mastered / total) * 100 : null,
      perDiscipline: per, weakest, notStarted, status
    };
  },

  /** Prazos do escopo: próximos, vencidos, concluídos no período. */
  deadlineStats(range, scope, sessions){
    const a = dateToISO(range.start), b = dateToISO(range.end);
    const rel = new Map();
    const all = state.deadlines.filter(dl => { const r = AnalyticsScope.deadlineRelation(scope, dl); if(r) rel.set(dl.id, r); return !!r; });
    const studiedFor = dl => {
      const list = dl.topicId ? sessions.filter(s => s.topicId === dl.topicId)
                 : dl.disciplineId ? sessions.filter(s => s.disciplineId === dl.disciplineId) : [];
      return sum(list, s => s.minutes || 0);
    };
    const open = all.filter(dl => !DeadlineEngine.isDone(dl))
      .sort((x,y) => str(x.date).localeCompare(str(y.date)))
      .map(dl => ({ dl, days: DeadlineEngine.daysLeft(dl), relation: rel.get(dl.id), studied: studiedFor(dl),
                    started: DeadlineEngine.hasStarted(dl) }));
    const upcoming = open.filter(x => x.days !== null && x.days >= 0);
    const overdue = open.filter(x => x.days !== null && x.days < 0);
    const completedInRange = all.filter(dl => DeadlineEngine.isDone(dl) && dl.completedAt &&
      str(dl.completedAt).slice(0,10) >= a && str(dl.completedAt).slice(0,10) <= b);
    const dueInRange = all.filter(dl => dl.date >= a && dl.date <= b);
    return { all, open, upcoming, overdue, completedInRange, dueInRange,
             next: upcoming[0] || null, soon: upcoming.filter(x => x.days <= 14) };
  },

  /** Como o tempo se distribuiu entre as prioridades (valores atuais de prioridade). */
  priorityStats(scope, sessions){
    const total = sum(sessions, s => s.minutes || 0);
    const discs = AnalyticsScope.disciplines(scope);
    const byDisc = [1,2,3,4,5].map(p => {
      const ids = new Set(state.disciplines.filter(d => PriorityEngine.clamp(d.priority) === p).map(d => d.id));
      const minutes = sum(sessions.filter(s => ids.has(s.disciplineId)), s => s.minutes || 0);
      return { p, minutes, pct: total > 0 ? minutes / total * 100 : 0, count: discs.filter(d => PriorityEngine.clamp(d.priority) === p).length };
    });
    const withTopic = sessions.filter(s => s.topicId && getTopic(s.topicId));
    const topicTotal = sum(withTopic, s => s.minutes || 0);
    const topics = AnalyticsScope.topics(scope);
    const byTopic = [1,2,3,4,5].map(p => {
      const minutes = sum(withTopic.filter(s => PriorityEngine.clamp(getTopic(s.topicId).priority) === p), s => s.minutes || 0);
      return { p, minutes, pct: topicTotal > 0 ? minutes / topicTotal * 100 : 0, count: topics.filter(t => PriorityEngine.clamp(t.priority) === p).length };
    });
    const studiedDisc = new Set(sessions.map(s => s.disciplineId));
    const studiedTopic = new Set(sessions.map(s => s.topicId).filter(Boolean));
    const highDiscNoTime = discs.length > 1
      ? discs.filter(d => PriorityEngine.clamp(d.priority) >= 4 && !studiedDisc.has(d.id)).sort(sortByName) : [];
    const highTopicNoTime = scope.type === 'topic' ? []
      : topics.filter(t => PriorityEngine.clamp(t.priority) >= 4 && !studiedTopic.has(t.id))
              .sort((a,b) => (PriorityEngine.clamp(b.priority) - PriorityEngine.clamp(a.priority)) || sortByName(a,b));
    const highMinutes = sum(byDisc.filter(x => x.p >= 4), x => x.minutes);
    return {
      total, byDisc, byTopic, topicTotal, highDiscNoTime, highTopicNoTime,
      highDiscShare: total > 0 ? highMinutes / total * 100 : null,
      hasHighDisc: discs.some(d => PriorityEngine.clamp(d.priority) >= 4),
      mixedDisc: new Set(discs.map(d => PriorityEngine.clamp(d.priority))).size > 1,
      mixedTopic: new Set(topics.map(t => PriorityEngine.clamp(t.priority))).size > 1
    };
  },

  /**
   * Tópicos que merecem atenção agora. Cada um traz os fatos que o colocaram
   * na lista; a prioridade só ajusta a ordem, nunca inventa motivo.
   */
  attentionTopics(scope, range){
    const out = [];
    const b = dateToISO(range.end);
    AnalyticsScope.topics(scope).forEach(t => {
      const reasons = [];
      let score = 0;
      if(t.reviewEnabled && t.reviewDueDate && t.reviewDueDate <= todayISO()){
        const late = -(daysUntilISO(t.reviewDueDate) || 0);
        if(late > 0){ reasons.push(`revisão atrasada há ${plural(late, 'dia', 'dias')}`); score += 3 + Math.min(late, 14) / 7; }
        else { reasons.push('revisão para hoje'); score += 2; }
      }
      const fails = t.reviewFailures || 0;
      if(fails >= 2){ reasons.push(`esquecido ${fails} vezes nas revisões`); score += 1.5 + Math.min(fails, 5) * 0.3; }
      const st = topicStatus(t);
      if(t.masteryLevel && t.masteryLevel <= 2 && st !== 'nao_iniciado'){ reasons.push(`domínio ${t.masteryLevel}/5`); score += 1; }
      const dl = DeadlineEngine.forTopic(t);
      if(dl.deadline && dl.score >= DEADLINE_MODEL.NOTEWORTHY * (dl.specific ? 1 : DEADLINE_MODEL.DISCIPLINE_WIDE_ON_TOPIC)){
        reasons.push(DeadlineEngine.phrase(dl.deadline)); score += 2 * dl.score;
      }
      const p = PriorityEngine.clamp(t.priority);
      if(p >= 4 && st === 'nao_iniciado'){ reasons.push(`prioridade ${PRIORITY_LABELS[p].toLowerCase()} e ainda não iniciado`); score += 1; }
      if(!reasons.length) return;
      // prioridade só reordena (±30%)
      score *= 1 + 0.3 * PriorityEngine.effectiveTopicAttention(t);
      out.push({ topic:t, discipline:getDiscipline(t.disciplineId), reasons, score, priority:p });
    });
    void b;
    return out.sort((x,y) => (y.score - x.score) || sortByName(x.topic, y.topic)).slice(0, 6);
  },

  /** Ritmo médio das últimas semanas (só com histórico suficiente). */
  projection(scope){
    const weeks = [];
    for(let i = 1; i <= 4; i++){
      const ws = startOfWeek(addDays(today(), -7 * i));
      const we = addDays(ws, 6);
      const list = AnalyticsScope.sessions(scope, { start:ws, end:we });
      weeks.push({ minutes: sum(list, s => s.minutes || 0), sessions: list.length });
    }
    const withData = weeks.filter(w => w.minutes > 0);
    if(withData.length < 3 || sum(weeks, w => w.sessions) < 6){
      return { available:false, reason:'Ainda não há histórico suficiente: são necessárias ao menos 3 semanas com registros.' };
    }
    const avg = sum(withData, w => w.minutes) / withData.length;
    let target = null;
    const plan = PlannerEngine.activePlan();
    if(plan && scope.type === 'all') target = plan.weeklyAvailableMinutes || null;
    else if(scope.type !== 'topic'){
      const wp = state.weeklyPlans.find(w => w.weekStart === dateToISO(startOfWeek(today())));
      const t = wp ? sum((wp.allocations || []).filter(x => AnalyticsScope.hasDiscipline(scope, x.disciplineId)), x => x.targetMinutes || 0) : 0;
      target = t > 0 ? t : null;
    }
    return { available:true, weeksConsidered: withData.length, avgWeeklyMinutes: avg, target,
             meetsTarget: target ? avg >= target * 0.95 : null, gap: target ? avg - target : null };
  },

  /* ---------- textos determinísticos ---------- */

  /** "Seu período em resumo": poucas frases, na ordem em que as pessoas perguntam. */
  summary(a){
    const out = [];
    const t = a.totals;
    const where = a.scope.type === 'all' ? '' : ` em ${a.scope.label}`;
    if(t.count === 0){
      out.push(`Nenhuma sessão registrada${where} neste período.`);
    } else {
      out.push(`Você estudou ${fmtDuration(t.minutes)}${where} em ${plural(t.count, 'sessão', 'sessões')}, com estudo em ${t.activeDays} de ${plural(a.days, 'dia', 'dias')}.`);
    }
    const pa = a.planAdherence;
    if(pa.hasPlan) out.push(`Cumpriu ${safePct(pa.pct)} do plano: ${fmtDuration(pa.realized)} de ${fmtDuration(pa.planned)} planejadas.`);
    if(t.count > 0 && a.scope.type !== 'topic' && a.scope.type !== 'discipline' && a.byDiscipline.length > 1){
      const top = a.byDiscipline[0];
      out.push(`${top.label} recebeu mais tempo (${safePct(top.pct)}).`);
    } else if(t.count > 0 && a.scope.type === 'discipline'){
      const top = a.byTopic.find(x => x.key !== '__none__');
      if(top) out.push(`${top.label} foi o tópico mais estudado (${fmtDuration(top.minutes)}).`);
    }
    const r = a.reviews;
    if(r.completed > 0 || r.overdueNow > 0){
      const parts = [];
      if(r.completed > 0) parts.push(`concluiu ${plural(r.completed, 'revisão', 'revisões')}`);
      if(r.overdueNow > 0) parts.push(`${plural(r.overdueNow, 'revisão está atrasada', 'revisões estão atrasadas')} agora`);
      out.push(capFirst(parts.join('; ')) + '.');
    }
    const next = a.deadlines.next;
    if(next) out.push(`Próximo prazo: ${DeadlineEngine.phrase(next.dl)}.`);
    if(a.previousComparison.available && isNum(a.previousComparison.minutesDelta) && t.count > 0){
      const d = a.previousComparison.minutesDelta;
      if(Math.abs(d) >= 5) out.push(`Você estudou ${fmtNumber(Math.abs(d), 0)}% ${d >= 0 ? 'mais' : 'menos'} que no período anterior equivalente.`);
      else out.push('O tempo de estudo ficou parecido com o do período anterior equivalente.');
    }
    return out;
  },

  /** Insights factuais — ajudam a enxergar; nunca afirmam causa. */
  insights(a){
    const out = [];
    const t = a.totals;
    const sc = a.scope;
    if(t.count === 0 && !a.deadlines.open.length && !a.reviews.overdueNow){
      out.push('Nenhuma sessão registrada neste período. Escolha um período maior ou registre uma sessão para ver mais detalhes.');
      return out;
    }

    // plano
    const pa = a.planAdherence;
    if(pa.hasPlan){
      pa.perDiscipline.filter(x => x.pct !== null && x.pct < 70 && x.planned > 0 && !x.archived).slice(0, 2)
        .forEach(x => out.push(`${x.label} recebeu ${safePct(x.pct)} do tempo planejado (${fmtDuration(x.realized)} de ${fmtDuration(x.planned)}).`));
      pa.perDiscipline.filter(x => x.pct !== null && x.pct > 130 && x.planned > 0 && !x.archived).slice(0, 1)
        .forEach(x => out.push(`${x.label} recebeu ${fmtNumber(x.pct - 100, 0)}% mais tempo que o planejado.`));
    }

    // prioridades
    const pr = a.priorities;
    if(t.count > 0 && sc.type !== 'discipline' && sc.type !== 'topic' && pr.hasHighDisc && pr.mixedDisc && isNum(pr.highDiscShare)){
      out.push(`Disciplinas com prioridade alta ou muito alta receberam ${safePct(pr.highDiscShare)} do tempo.`);
    }
    pr.highDiscNoTime.slice(0, 2).forEach(d =>
      out.push(`${d.name} tem prioridade ${PRIORITY_LABELS[PriorityEngine.clamp(d.priority)].toLowerCase()} e não teve sessões neste período.`));
    if(sc.type === 'discipline' || sc.type === 'area'){
      const n = pr.highTopicNoTime.length;
      if(n > 0 && t.count > 0) out.push(`${plural(n, 'tópico de prioridade alta ou muito alta não foi estudado', 'tópicos de prioridade alta ou muito alta não foram estudados')} neste período.`);
    }

    // distribuição
    if(t.count > 0 && sc.type !== 'discipline' && sc.type !== 'topic' && a.byDiscipline.length){
      const top = a.byDiscipline[0];
      if(top.pct > 60 && a.byDiscipline.length > 1) out.push(`${top.label} concentrou ${safePct(top.pct)} do tempo; ${a.byDiscipline.length - 1 === 1 ? 'a outra disciplina dividiu' : `as outras ${a.byDiscipline.length - 1} disciplinas dividiram`} o restante.`);
    }

    // prazos
    a.deadlines.soon.slice(0, 2).forEach(x => {
      const ctx = x.dl.topicId ? (getTopic(x.dl.topicId) || {}).name : x.dl.disciplineId ? disciplineName(x.dl.disciplineId) : null;
      if(ctx) out.push(`${DeadlineEngine.phrase(x.dl)}; ${ctx} recebeu ${fmtDuration(x.studied)} neste período.`);
      else out.push(`${DeadlineEngine.phrase(x.dl)}.`);
    });
    if(a.deadlines.overdue.length) out.push(`${plural(a.deadlines.overdue.length, 'prazo passou da data e continua em aberto', 'prazos passaram da data e continuam em aberto')}.`);
    if(a.deadlines.completedInRange.length) out.push(`${plural(a.deadlines.completedInRange.length, 'prazo foi concluído', 'prazos foram concluídos')} neste período.`);

    // revisões
    const r = a.reviews;
    if(r.forgetful.length){ const f = r.forgetful[0]; out.push(`${f.name} já foi esquecido ${f.reviewFailures} vezes nas revisões.`); }
    const highLate = r.overdueList.filter(x => PriorityEngine.clamp(x.priority) >= 4).length;
    if(highLate) out.push(`${plural(highLate, 'tópico de prioridade alta ou muito alta está', 'tópicos de prioridade alta ou muito alta estão')} com revisão atrasada.`);
    if(r.avgMastery !== null && r.avgMastery < 2.5) out.push(`O domínio médio dos tópicos em revisão está em ${fmtNumber(r.avgMastery, 1)}/5.`);
    const solid = r.byMethod.filter(x => x.used >= 5);
    if(solid.length){
      const best = solid.slice().sort((x,y) => (y.rate || 0) - (x.rate || 0))[0];
      out.push(`Nas ${best.used} revisões com ${best.label.toLowerCase()}, ${best.good} terminaram como "Lembrei bem" ou "Dominei".`);
    }

    // disciplinas paradas (no máximo 2, para não virar lista)
    if(sc.type !== 'topic'){
      AnalyticsScope.disciplines(sc).map(d => ({ d, last: lastStudyISO(d.id) }))
        .filter(x => x.last && daysSinceISO(x.last) >= 7)
        .sort((x,y) => x.last.localeCompare(y.last)).slice(0, 2)
        .forEach(x => out.push(`${x.d.name} não recebe registros há ${daysSinceISO(x.last)} dias.`));
    }

    // dificuldade
    if(a.difficulty.avg !== null){
      const hardest = a.difficulty.perTopic.filter(x => x.count >= 2)[0] || (sc.type === 'all' || sc.type === 'area' ? a.difficulty.perDiscipline.filter(x => x.count >= 2)[0] : null);
      if(hardest) out.push(`${hardest.label} teve a maior dificuldade percebida: ${fmtNumber(hardest.avg, 1)}/5.`);
    }

    // conteúdo
    if(a.content.coverage !== null && sc.type !== 'topic'){
      out.push(`Você já estudou ${a.content.covered} de ${plural(a.content.totalTopics, 'tópico cadastrado', 'tópicos cadastrados')} (${safePct(a.content.coverage)}); ${a.content.mastered} ${a.content.mastered === 1 ? 'está consolidado' : 'estão consolidados'}.`);
    }

    // tipos
    const typed = a.byType.filter(x => x.key !== '__none__' && x.count > 0);
    const typedTotal = sum(typed, x => x.count);
    if(typedTotal >= 3){
      const top = typed.slice().sort((x,y) => y.count - x.count)[0];
      out.push(`${fmtNumber((top.count / typedTotal) * 100, 0)}% das sessões classificadas foram do tipo "${top.label}".`);
    }

    if(a.projection.available && a.projection.target){
      out.push(a.projection.meetsTarget
        ? `A média das últimas ${a.projection.weeksConsidered} semanas (${fmtDuration(a.projection.avgWeeklyMinutes)}) acompanha o objetivo semanal.`
        : `A média das últimas ${a.projection.weeksConsidered} semanas (${fmtDuration(a.projection.avgWeeklyMinutes)}) está ${fmtDuration(Math.abs(a.projection.gap))} abaixo do objetivo semanal.`);
    }
    return out.length ? out : ['Nada fora do comum neste período.'];
  },

  positives(a){
    const out = [];
    const t = a.totals;
    if(a.planAdherence.hasPlan && a.planAdherence.pct >= 90) out.push(`Plano cumprido em ${safePct(a.planAdherence.pct)}.`);
    if(a.days >= 3 && t.consistency >= 50) out.push(`Estudo em ${t.activeDays} de ${a.days} dias.`);
    if(a.reviews.completed > 0 && a.reviews.overdueNow === 0) out.push(`${plural(a.reviews.completed, 'revisão concluída', 'revisões concluídas')} e nenhuma atrasada.`);
    if(a.previousComparison.available && isNum(a.previousComparison.minutesDelta) && a.previousComparison.minutesDelta >= 10)
      out.push(`${fmtNumber(a.previousComparison.minutesDelta, 0)}% mais tempo que no período anterior.`);
    if(a.deadlines.completedInRange.length) out.push(`${plural(a.deadlines.completedInRange.length, 'prazo concluído', 'prazos concluídos')}.`);
    const good = a.reviews.outcomes.filter(o => o.v === 'remembered' || o.v === 'mastered');
    const goodN = sum(good, o => o.count);
    if(a.reviews.completed >= 3 && goodN / a.reviews.completed >= 0.7) out.push(`${goodN} de ${a.reviews.completed} revisões terminaram como "Lembrei bem" ou "Dominei".`);
    return out;
  },

  warnings(a){
    const out = [];
    if(a.reviews.overdueNow) out.push(`${plural(a.reviews.overdueNow, 'revisão atrasada', 'revisões atrasadas')}.`);
    a.deadlines.overdue.slice(0, 3).forEach(x => out.push(`${x.dl.title}: ${DeadlineEngine.dueText(x.dl).toLowerCase()}.`));
    a.deadlines.soon.filter(x => x.days <= 7 && x.studied === 0 && (x.dl.disciplineId || x.dl.topicId)).slice(0, 2)
      .forEach(x => out.push(`${DeadlineEngine.phrase(x.dl)}, sem estudo registrado para ele neste período.`));
    a.priorities.highDiscNoTime.slice(0, 2).forEach(d => out.push(`${d.name} (prioridade ${PriorityEngine.text(d.priority)}) sem sessões no período.`));
    if(a.planAdherence.hasPlan){
      a.planAdherence.perDiscipline.filter(x => x.pct !== null && x.pct < 50 && x.planned > 0 && !x.archived).slice(0, 2)
        .forEach(x => out.push(`${x.label} com ${safePct(x.pct)} do tempo planejado.`));
    }
    a.reviews.forgetful.slice(0, 2).forEach(tp => out.push(`${tp.name} esquecido ${tp.reviewFailures} vezes.`));
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
      // v5.2: prioridade 1–5; backups antigos trazem `importance` (low/normal/high)
      priority: normalizePriority(t.priority, t.importance),
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
    const topicDisc = new Map(data.topics.map(t => [t.id, t.disciplineId]));
    const isoOrNull = v => parseISO(str(v)) ? str(v).slice(0,10) : null;
    data.deadlines = data.deadlines.filter(d => d && d.id && !dlIds.has(d.id) && dlIds.add(d.id)).map(d => {
      // v5.2: tipo, status, início, orientações e anotações. Backups antigos
      // (date/importance/completed) são convertidos aqui, sem perda.
      let disciplineId = (d.disciplineId && discIds.has(d.disciplineId)) ? str(d.disciplineId) : null;
      let topicId = (d.topicId && topicIds.has(d.topicId)) ? str(d.topicId) : null;
      if(topicId && !disciplineId) disciplineId = topicDisc.get(topicId) || null;
      if(topicId && topicDisc.get(topicId) !== disciplineId) topicId = null;   // tópico precisa ser da disciplina
      const status = DEADLINE_STATUSES.some(x => x.v === d.status) ? d.status : (d.completed ? 'completed' : 'pending');
      return {
        id:str(d.id), title: str(d.title).slice(0, 160) || 'Prazo',
        type: DEADLINE_TYPES.some(x => x.v === d.type) ? d.type : 'other',
        date: isoOrNull(d.date) || isoOrNull(d.dueDate) || todayISO(),
        startDate: isoOrNull(d.startDate),
        disciplineId, topicId,
        priority: normalizePriority(d.priority, d.importance),
        status,
        instructions: str(d.instructions).slice(0, 5000),
        notes: str(d.notes).slice(0, 5000),
        completedAt: status === 'completed' ? (str(d.completedAt) || null) : null,
        createdAt:str(d.createdAt) || nowISO(), updatedAt:str(d.updatedAt) || nowISO()
      };
    });

    data.settings = sanitizeSettings(data.settings);

    if(data.disciplines.length === 0 && data.sessions.length === 0 && data.areas.length === 0){
      throw new Error('Arquivo inválido: o backup não contém dados para restaurar.');
    }

    return { data, warnings, format: isV2 ? 'v2' : 'v3' };
  },

  _arr(v){ return Array.isArray(v) ? v : []; },

  /**
   * Substitui todo o conteúdo do banco pelo backup.
   *
   * v5.2.1 — limpeza e regravação passam a acontecer na MESMA transação. Antes
   * eram duas operações independentes: se o navegador fechasse, travasse ou o
   * disco falhasse entre elas, o usuário ficava com o banco VAZIO e sem o backup
   * gravado. Agora, ou o estado novo entra inteiro, ou o antigo permanece
   * exatamente como estava.
   */
  async restoreInto(data){
    const stores = ['areas','disciplines','topics','sessions','plans','weeklyPlans','deadlines','settings'];
    await DB.transactional(stores, api => {
      stores.forEach(st => api.clear(st));
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
  distributionMode: 'discipline',
  openDisciplineId: null,
  showArchivedDisciplines: false,
  history: { search:'', areaId:'', disciplineId:'', topicId:'', period:'todos', type:'', difficulty:'' },
  planDraft: null,            // rascunho editável da tela de Planejamento
  weekOffset: 0,              // navegação de semanas no relatório semanal
  planExpanded: false,        // v5: true quando o usuário pediu os controles detalhados
  reviewQueue: null,          // v4: itens restantes da sessão de revisão montada
  helpDoor: 'start',          // v5: 'start' | 'use' | 'learn' | 'faq'
  prevView: null,             // v5.1: tela anterior (contexto do relato de problema)
  openDeadlineId: null,       // v5.2: prazo aberto no painel lateral
  analyticsScope: { type:'all', areaId:null, disciplineId:null, topicId:null },   // v5.2: o que analisar
  analyticsLast: { areaId:null, disciplineId:null, topicId:null },               // v5.2: última escolha de cada tipo
  calMode: 'view',            // v5.2: 'view' (detalhes do dia) | 'select' (escolher intervalo)
  calSel: { start:null, end:null },
  calFocus: null,             // dia com foco de teclado no calendário
  calRefocus: null
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

/* =========================================================================
   CAMADAS DE SOBREPOSIÇÃO (v5.2.1)

   Modal, painel lateral, busca de comandos e modo foco tinham quatro problemas
   confirmados em teste:

     · o painel lateral abria ATRÁS do modal (z-index 95 contra 100). O "?" de
       ajuda dentro de qualquer modal parecia um botão morto — mas o foco do
       teclado ia para o painel invisível;
     · um único Esc fechava o modal E o painel ao mesmo tempo;
     · o Tab escapava da camada e ia para a página atrás;
     · a página atrás rolava com a camada aberta, e o foco não voltava para o
       botão que abriu.

   Uma pilha única resolve os quatro: quem abre por último fica por cima (z-index
   calculado), só o topo recebe Esc, o Tab circula dentro da camada, a rolagem de
   fundo é travada enquanto houver camada e o foco volta ao ponto de partida.
   ========================================================================= */
const OVERLAY_BASE_Z = 100;
const OVERLAY_STEP_Z = 5;
const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

const Overlay = {
  stack: [],

  _lockScroll(){
    if(this.stack.length !== 1) return;                 // só na primeira camada
    const gap = window.innerWidth - document.documentElement.clientWidth;
    if(gap > 0) document.documentElement.style.setProperty('--overlay-gap', gap + 'px');
    document.documentElement.classList.add('overlay-open');
  },
  _unlockScroll(){
    if(this.stack.length) return;                       // ainda há camada aberta
    document.documentElement.classList.remove('overlay-open');
    document.documentElement.style.removeProperty('--overlay-gap');
  },

  focusables(panel){
    if(!panel) return [];
    return $$(FOCUSABLE_SELECTOR, panel)
      .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);
  },

  /**
   * Registra uma camada.
   *   root  — elemento de fundo (recebe o z-index calculado)
   *   panel — caixa onde o foco fica preso
   *   onEsc — o que fazer quando o Esc chega NESTA camada
   */
  open(root, panel, onEsc, opts){
    const o = opts || {};
    const entry = {
      root, panel, onEsc,
      opener: (o.opener !== undefined) ? o.opener : document.activeElement,
      trap: o.trap !== false
    };
    this.stack.push(entry);
    if(root) root.style.zIndex = String(OVERLAY_BASE_Z + (this.stack.length - 1) * OVERLAY_STEP_Z);
    this._lockScroll();
    return entry;
  },

  close(entry){
    const i = entry ? this.stack.indexOf(entry) : -1;
    if(i < 0) return;
    this.stack.splice(i, 1);
    if(entry.root) entry.root.style.zIndex = '';
    this._unlockScroll();
    const back = entry.opener;
    if(back && typeof back.focus === 'function' && document.contains(back)){
      try { back.focus({ preventScroll:true }); } catch(_){ try { back.focus(); } catch(__){} }
    }
  },

  get top(){ return this.stack.length ? this.stack[this.stack.length - 1] : null; },
  get isOpen(){ return this.stack.length > 0; },

  /** Um único ouvinte, em captura: roda antes dos atalhos globais. */
  bind(){
    document.addEventListener('keydown', (e) => {
      const top = this.top;
      if(!top) return;

      if(e.key === 'Escape'){
        e.preventDefault();
        e.stopImmediatePropagation();         // nenhuma camada de baixo reage
        if(typeof top.onEsc === 'function') top.onEsc();
        return;
      }

      if(e.key !== 'Tab' || !top.trap) return;
      const list = this.focusables(top.panel);
      if(!list.length){ e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement;
      if(!top.panel || !top.panel.contains(active)){
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if(e.shiftKey && active === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && active === last){ e.preventDefault(); first.focus(); }
    }, true);
  }
};

let modalCloser = null;
/**
 * Abre um modal. `build(close)` devolve { title, content, actions }.
 * Fecha com ESC, clique fora ou chamando close().
 */
function openModal(build, opts){
  const root = $('#modal-root'), box = $('#modal-box');
  const options = opts || {};

  // Só existe um #modal-root. Abrir um modal por cima de outro deixava os
  // ouvintes do primeiro pendurados no documento — e um Esc fechava os dois.
  if(typeof modalCloser === 'function'){
    const previous = modalCloser;
    modalCloser = null;
    try { previous(null); } catch(err){ console.error(err); }
  }

  const opener = document.activeElement;
  let layer = null, closed = false;

  const close = (result) => {
    if(closed) return;                      // fechar duas vezes não desfaz o foco
    closed = true;
    root.hidden = true;
    clear($('#modal-content')); clear($('#modal-actions'));
    root.removeEventListener('mousedown', onBackdrop);
    Overlay.close(layer);
    if(modalCloser === close) modalCloser = null;
    if(options.onClose) options.onClose(result);
  };
  const onBackdrop = (e) => { if(e.target === root && options.dismissible !== false) close(null); };

  const cfg = build(close) || {};
  box.className = 'modal' + (options.size ? ' ' + options.size : '');
  $('#modal-title').textContent = cfg.title || '';
  // Sem título visível (boas-vindas), aria-labelledby apontaria para um elemento
  // vazio e o diálogo ficaria sem nome para leitores de tela.
  if(cfg.title) box.removeAttribute('aria-label');
  else box.setAttribute('aria-label', options.ariaLabel || 'Janela do Ciclo');

  mount($('#modal-content'), cfg.content || null);
  mount($('#modal-actions'), ...(cfg.actions || []));
  guardModalActions($('#modal-actions'));
  root.hidden = false;
  root.addEventListener('mousedown', onBackdrop);
  modalCloser = close;
  layer = Overlay.open(root, box, () => { if(options.dismissible !== false) close(null); }, { opener });

  const focusTarget = box.querySelector('input,select,textarea,button');
  if(focusTarget) setTimeout(() => { if(!closed) focusTarget.focus(); }, 30);
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
  // v5.2.1 — telas acessadas pelo botão "Mais" (Disciplinas, Histórico, Ajuda,
  // Dados, Configurações) não marcavam nenhum item: o usuário perdia a referência
  // de onde estava. Agora o próprio "Mais" fica marcado nesses casos.
  const inMore = ['disciplines','history','help','data','settings'].includes(view);
  $$('#nav-mobile .mb-item').forEach(b => {
    const on = b.dataset.view ? (b.dataset.view === view) : inMore;
    if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
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
        const dateInput = h('input', { type:'date', id:'rm-date', value: (p.date && p.date <= todayISO()) ? p.date : todayISO(), max: todayISO() });
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
      // o rótulo da ação principal acompanha a aba escolhida: o botão precisa
      // dizer o que vai acontecer, não o que aconteceria na abertura do modal.
      primaryBtn.textContent = mode === 'timer' ? 'Iniciar sessão' : 'Salvar sessão';
    }

    const primaryBtn = h('button', { class:'btn primary', type:'button', text:'Iniciar sessão',
      onclick: async () => {
        if(!discId){ toast('Escolha uma disciplina.', 'err'); return; }
        if(mode === 'timer'){ close(); startTimer(discId, topicId || null, type); return; }
        const minutes = Number(($('#rm-min') || {}).value);
        if(!(minutes > 0)){ toast('Informe os minutos estudados.', 'err'); return; }
        const date = ($('#rm-date') || {}).value || todayISO();
        const comment = (($('#rm-comment') || {}).value || '').trim();
        close();
        await saveSession({ disciplineId:discId, topicId: topicId || null, date, minutes, type, difficulty, comment, reviewOutcome: (type === 'revisao' ? outcome : null) });
      } });

    rebuild();

    return {
      title:'Registrar progresso',
      content,
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
        primaryBtn
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
        h('p', { class:'hero-text', text:'Pode ser uma matéria, um idioma, uma certificação ou qualquer outra coisa que você queira aprender. Leva alguns segundos.' }),
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
      : 'Quando você estudar um tópico, ele entra automaticamente no ciclo de revisão.' }));
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

  /* --- 3b. prazos que se aproximam --- */
  const dlCard = upcomingDeadlinesCard();
  if(dlCard) side.push(dlCard);

  /* --- 4. guia inicial e organização (sempre dispensáveis) --- */
  const startGuide = startGuideCard();
  if(startGuide) side.push(startGuide);
  const nudge = areaNudgeCard('today');
  if(nudge) side.push(nudge);

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

/** Card da próxima melhor ação: disciplina, tópico, tempo, motivo e um CTA. */
function nextActionCard(top){
  const isReview = top.suggestedType === 'revisao';
  return h('section', { class:'card next-action interactive', 'aria-labelledby':'na-title' },
    h('div', { class:'na-head' },
      h('p', { class:'na-eyebrow' }, isReview ? 'Próxima revisão' : 'Próxima sessão', helpDot('recomendacao')),
      h('button', { class:'linkbtn muted', type:'button', text:'Por quê?', onclick:() => explainAction(top) })),
    h('div', { class:'na-body' },
      h('div', { class:'na-main' },
        h('h3', { class:'na-disc', id:'na-title', text: top.discipline.name }),
        h('p', { class:'na-topic', text: top.topic ? top.topic.name : 'Sem tópico específico' }),
        h('div', { class:'na-meta' },
          h('span', { class:'na-dur' }, icon('i-today', 'nav-icon'), h('span', { class:'num', text: fmtDuration(top.duration) })),
          isReview ? h('span', { class:'pill brass', text:'revisão' }) : null),
        h('ul', { class:'reasons na-reasons' }, top.reasons.slice(0,3).map(r => h('li', { text: capFirst(r) })))),
      h('div', { class:'na-cta' },
        h('button', { class:'btn primary lg', type:'button',
          onclick:() => startTimer(top.discipline.id, top.topic ? top.topic.id : null, top.suggestedType) },
          icon('i-play'), isReview ? 'Começar revisão' : 'Começar a estudar'),
        top.topic ? h('button', { class:'linkbtn', type:'button', text:'Ver tópico', onclick:() => openTopicDrawer(top.topic.id) }) : null)),
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
      'Quando você estuda um tópico com revisões ativadas, ele volta aqui no momento certo — você não precisa agendar nada.',
      h('div', { class:'empty-actions' },
        h('button', { class:'btn primary', type:'button', text:'Ver como funciona', onclick:() => openInteractiveGuide('ig-revisao') }),
        h('button', { class:'btn ghost', type:'button', text:'Adicionar um tópico',
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
      statBox(String(ReviewEngine.allScheduled().length), 'tópicos no ciclo', null, 'rev-cycle')),
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
          ' · prioridade ' + PriorityEngine.text(t.priority) + ' · ~' + minutes + ' min' }),
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
              h('div', { class:'hint', text: d ? 'Prioridade ' + PriorityEngine.text(d.priority) : '' })),
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
   v5.2 — COMPONENTES DE PRIORIDADE
   Um único seletor 1–5 para Disciplina, Tópico e Prazo. Funciona com mouse,
   toque e teclado (setas, Home, End). Número + texto: nunca só cor.
   ========================================================================= */
function priorityPicker(opts){
  const o = opts || {};
  let value = PriorityEngine.clamp(o.value);
  const labelId = (o.id || 'prio') + '-label';
  const wrap = h('div', { class:'prio-picker', id: o.id || null });
  const group = h('div', { class:'prio-options', role:'radiogroup', 'aria-labelledby': o.labelledBy || labelId });
  const desc = h('p', { class:'prio-desc', 'aria-live':'polite' });

  const buttons = PRIORITY_LEVELS.map(level => {
    const b = h('button', { type:'button', class:'prio-opt p' + level.v, role:'radio', dataset:{ v:String(level.v) },
      'aria-label': `${level.v} — ${level.label}` },
      h('span', { class:'prio-num num', text:String(level.v) }),
      h('span', { class:'prio-word', text:level.label }));
    b.addEventListener('click', () => select(level.v, false));
    b.addEventListener('keydown', (e) => {
      let next = null;
      if(e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, value + 1);
      else if(e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, value - 1);
      else if(e.key === 'Home') next = 1;
      else if(e.key === 'End') next = 5;
      if(next !== null){ e.preventDefault(); select(next, true); }
    });
    group.appendChild(b);
    return b;
  });

  function paint(){
    buttons.forEach(b => {
      const on = Number(b.dataset.v) === value;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    clear(desc);
    desc.append(h('strong', { text:`${value} — ${PRIORITY_LABELS[value]}` }), ' ', h('span', { text: PriorityEngine.hint(value, o.context) }));
  }
  function select(v, focus){
    value = PriorityEngine.clamp(v);
    paint();
    if(focus){ const b = buttons[value - 1]; if(b) b.focus(); }
    if(typeof o.onChange === 'function') o.onChange(value);
  }

  if(o.label){
    wrap.append(h('div', { class:'prio-label', id:labelId },
      h('span', { text:o.label }), o.helpKey ? helpDot(o.helpKey) : null));
  }
  wrap.append(group, desc);
  paint();
  wrap.getValue = () => value;
  wrap.setValue = (v) => { value = PriorityEngine.clamp(v); paint(); };
  return wrap;
}

/** Selo compacto de prioridade: "5 · Muito alta" com barras de nível. */
function priorityChip(p, opts){
  const v = PriorityEngine.clamp(p);
  const o = opts || {};
  return h('span', { class:'prio-chip p' + v + (o.compact ? ' compact' : ''), title:`Prioridade ${v} — ${PRIORITY_LABELS[v]}`,
      'aria-label': `Prioridade ${v}, ${PRIORITY_LABELS[v].toLowerCase()}` },
    h('span', { class:'prio-bars', 'aria-hidden':'true' }, [1,2,3,4,5].map(i => h('i', { class: i <= v ? 'on' : '' }))),
    h('span', { class:'prio-text', 'aria-hidden':'true', text: o.compact ? String(v) : `${v} · ${PRIORITY_LABELS[v]}` }));
}

/** "30 de setembro de 2026" */
function fmtDateLong(iso){
  const d = parseISO(iso);
  return d ? `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}` : '—';
}

/** "Tecnologia › Redes de Computadores" (ou só a disciplina, quando não há área). */
function disciplinePath(disc){
  if(!disc) return '';
  const a = disc.areaId ? getArea(disc.areaId) : null;
  return a ? `${a.name} › ${disc.name}` : disc.name;
}

/* =========================================================================
   TELA: DISCIPLINAS — Área de Estudo → Disciplina → Tópico, e Prazos.
   ========================================================================= */
function renderDisciplines(){
  const root = $('#disciplines-body');
  const parts = [];

  const header = h('div', { class:'card structure-card' },
    h('div', { class:'card-head' },
      h('div', null,
        h('p', { class:'card-title', style:'margin:0' }, 'Estrutura dos seus estudos', helpDot('estrutura')),
        h('p', { class:'hierarchy-legend' },
          h('span', { text:AREA_TERM }), h('span', { class:'sep', 'aria-hidden':'true', text:'›' }),
          h('span', { text:'Disciplina' }), h('span', { class:'sep', 'aria-hidden':'true', text:'›' }),
          h('span', { text:'Tópico' }))),
      h('div', { class:'row auto' },
        h('button', { class:'btn ghost sm', type:'button', onclick:() => openAreaModal(null) }, icon('i-plus'), AREA_TERM),
        h('button', { class:'btn primary sm', type:'button', onclick:() => openDisciplineModal(null) }, icon('i-plus'), 'Disciplina'))),
    h('label', { class:'inline-check' },
      (() => { const c = h('input', { type:'checkbox', checked: ui.showArchivedDisciplines });
               c.addEventListener('change', () => { ui.showArchivedDisciplines = c.checked; renderDisciplines(); }); return c; })(),
      'Mostrar disciplinas arquivadas')
  );
  parts.push(header);

  const nudge = areaNudgeCard('disciplines');
  if(nudge) parts.push(nudge);

  const list = ui.showArchivedDisciplines ? state.disciplines : activeDisciplines();
  if(!list.length){
    parts.push(card(null, emptyState('Você ainda não adicionou nada para estudar',
      'Comece com apenas uma disciplina — por exemplo Matemática, Inglês, Anatomia ou Redes de Computadores. Áreas de Estudo e tópicos podem vir depois.',
      h('div', { class:'empty-actions' },
        h('button', { class:'btn primary', type:'button', text:'Adicionar uma disciplina', onclick:() => openDisciplineModal(null) }),
        h('button', { class:'btn ghost', type:'button', text:'Como organizar meus estudos?', onclick:() => openInteractiveGuide('ig-estrutura') })))));
  } else {
    const groups = new Map();
    list.forEach(d => {
      const key = d.areaId && getArea(d.areaId) ? d.areaId : '__none__';
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    });

    state.areas.slice().filter(a => !a.archived).sort(sortByName).forEach(area => {
      const items = groups.get(area.id) || [];
      parts.push(h('section', { class:'area-group', 'aria-label': `${AREA_TERM}: ${area.name}` },
        h('div', { class:'area-head' },
          h('div', { class:'area-titles' },
            h('span', { class:'area-kicker', text:AREA_TERM }),
            h('h3', { class:'area-name', text:area.name })),
          h('span', { class:'area-count', text: items.length === 1 ? '1 disciplina' : `${items.length} disciplinas` }),
          h('button', { class:'linkbtn muted', type:'button', text:'editar', 'aria-label':`Editar ${area.name}`, onclick:() => openAreaModal(area) })),
        items.length
          ? h('div', { class:'disc-grid' }, items.slice().sort(sortByName).map(d => disciplineCard(d)))
          : h('div', { class:'area-empty' },
              h('span', { text:'Nenhuma disciplina nesta área ainda.' }),
              h('button', { class:'linkbtn', type:'button', text:'+ adicionar disciplina aqui', onclick:() => openDisciplineModal(null, { areaId:area.id }) }))));
    });

    const loose = groups.get('__none__');
    if(loose && loose.length){
      parts.push(h('section', { class:'area-group is-loose', 'aria-label':'Disciplinas ainda não organizadas' },
        h('div', { class:'area-head' },
          h('div', { class:'area-titles' },
            h('span', { class:'area-kicker', text:NO_AREA_LABEL }),
            h('h3', { class:'area-name', text:'Ainda não organizadas' })),
          h('span', { class:'area-count', text: loose.length === 1 ? '1 disciplina' : `${loose.length} disciplinas` }),
          h('button', { class:'linkbtn', type:'button', text:'organizar em uma Área', onclick:() => openAreaModal(null) })),
        h('div', { class:'disc-grid' }, loose.slice().sort(sortByName).map(d => disciplineCard(d)))));
    }
  }

  parts.push(deadlinesCard());
  mount(root, parts);
}

function disciplineCard(d){
  const prog = disciplineProgress(d.id);
  const weekProg = PlannerEngine.getCurrentWeekProgress().perDiscipline.find(x => x.disciplineId === d.id);
  const last = lastStudyISO(d.id);
  const due = ReviewEngine.dueCountFor(d.id);
  const tps = topicsOf(d.id);
  const meta = [];
  meta.push(prog.total > 0 ? `${prog.total} ${prog.total === 1 ? 'tópico' : 'tópicos'} · ${prog.mastered} ${prog.mastered === 1 ? 'consolidado' : 'consolidados'}` : 'sem tópicos ainda');
  meta.push(`último estudo ${fmtRelativePast(last)}`);
  if(weekProg) meta.push(`semana ${fmtDuration(weekProg.realized)}/${fmtDuration(weekProg.planned)}`);

  // prévia dos tópicos mais prioritários (a ordem manual desempata)
  const preview = tps.slice().sort((a,b) => PriorityEngine.clamp(b.priority) - PriorityEngine.clamp(a.priority)).slice(0, 4);

  return h('div', { class:'disc-card' + (d.archived ? ' is-archived' : '') },
    h('button', { class:'dc-open', type:'button', onclick:() => openDisciplineDetail(d.id) },
      h('span', { class:'dc-top' },
        h('span', { class:'dc-titles' },
          h('span', { class:'dc-kicker', text:'Disciplina' }),
          h('span', { class:'dc-name' }, d.name, d.archived ? h('span', { class:'pill', text:'arquivada' }) : null)),
        h('span', { class:'dc-right' },
          h('span', { class:'dc-pct num', text: prog.coverage !== null ? fmtPct(prog.coverage) : '—' }),
          h('span', { class:'dc-pct-l', text:'conteúdo estudado' }))),
      h('span', { class:'dc-prio' }, h('span', { class:'dc-prio-l', text:'Prioridade' }), priorityChip(d.priority)),
      prog.total > 0 ? progressBar(prog.coverage, prog.coverage >= 100 ? 'done' : null, 'disc-' + d.id) : h('span', { class:'bar is-empty', 'aria-hidden':'true' }),
      preview.length ? h('span', { class:'dc-topics' },
        preview.map(t => h('span', { class:'dc-topic' },
          h('span', { class:'dc-topic-name', text:t.name }),
          priorityChip(t.priority, { compact:true }))),
        tps.length > preview.length ? h('span', { class:'dc-topic more', text:`+${tps.length - preview.length}` }) : null) : null,
      h('span', { class:'dc-meta' },
        h('span', { text: meta.join(' · ') }),
        due > 0 ? h('span', { class:'pill brass', text: due + (due === 1 ? ' revisão' : ' revisões') }) : null)),
    d.archived ? null : h('div', { class:'dc-actions dc-hover' },
      h('button', { class:'btn ghost sm', type:'button', 'aria-label':'Estudar ' + d.name,
        onclick:() => openRegisterModal({ disciplineId:d.id }) }, icon('i-play'), 'Estudar'),
      h('button', { class:'btn ghost sm', type:'button', 'aria-label':'Adicionar tópico em ' + d.name,
        onclick:() => openTopicModal(d.id, null) }, icon('i-plus'), 'Tópico')));
}

/* ---------- incentivo gentil a organizar em Áreas (nunca bloqueia) ---------- */
const AREA_NUDGE_SNOOZE_DAYS = 21;
function areaNudgeCard(where){
  if(state.settings.helpMode === 'off') return null;
  const loose = activeDisciplines().filter(d => !d.areaId || !getArea(d.areaId));
  if(!loose.length) return null;
  if(where === 'today'){
    // só depois de o usuário já ter recebido valor, e nunca durante uma sessão
    if(TimerService.isActive) return null;
    if(!(activeDisciplines().length >= 2 || state.sessions.length >= 1)) return null;
    if(loose.length < 2 && state.areas.length > 0) return null;
  }
  const dismissed = state.meta.areaNudgeDismissedAt;
  if(dismissed){
    const days = Math.floor((Date.now() - new Date(dismissed).getTime()) / 86400000);
    if(days < AREA_NUDGE_SNOOZE_DAYS) return null;
  }
  const exampleDisc = loose[0];
  const exampleTopic = topicsOf(exampleDisc.id)[0];
  return h('div', { class:'card nudge-card', role:'note' },
    h('div', { class:'nudge-main' },
      h('p', { class:'card-title', style:'margin-bottom:4px', text:'Organize seus estudos' }),
      h('p', { class:'hint', style:'margin:0 0 10px', text:`Áreas de Estudo ajudam a agrupar disciplinas relacionadas. ${loose.length === 1 ? 'Uma disciplina ainda está' : loose.length + ' disciplinas ainda estão'} sem área.` }),
      h('div', { class:'mini-tree', 'aria-label':'Exemplo de organização' },
        h('div', { class:'mt-row lvl0' }, h('span', { class:'mt-tag', text:AREA_TERM }), 'Tecnologia'),
        h('div', { class:'mt-row lvl1' }, h('span', { class:'mt-tag', text:'Disciplina' }), exampleDisc.name),
        h('div', { class:'mt-row lvl2' }, h('span', { class:'mt-tag', text:'Tópico' }), exampleTopic ? exampleTopic.name : 'OSPF'))),
    h('div', { class:'nudge-actions' },
      h('button', { class:'btn primary sm', type:'button', onclick:() => openAreaModal(null, { preselect: loose.map(d => d.id) }) }, icon('i-plus'), 'Criar uma Área de Estudo'),
      h('button', { class:'btn ghost sm', type:'button', text:'Agora não', onclick: async () => {
        await setMeta('areaNudgeDismissedAt', nowISO());
        render();
        toast('A organização por Áreas continua disponível em Disciplinas e na Ajuda.', 'info');
      } })));
}

function isDesktopUI(){
  return window.matchMedia('(min-width:861px)').matches;
}

/**
 * Detalhe da disciplina. No computador abre em painel lateral (mantém a lista
 * visível ao lado); no celular abre em modal.
 */
function openDisciplineDetail(discId){
  ui.openDisciplineId = discId;
  const d = getDiscipline(discId);
  if(!d) return;
  if(isDesktopUI()){ openDisciplineDrawer(d); return; }
  openModal(close => ({
    title: d.name,
    content: disciplineDetailBody(d, { leave: close, reopen: () => { close(); openDisciplineDetail(discId); } }),
    actions:[ h('button', { class:'btn ghost', type:'button', text:'Fechar', onclick:() => close() }) ]
  }), { size:'wide' });
}

function openDisciplineDrawer(d){
  const refreshDrawer = () => { const fresh = getDiscipline(d.id); if(fresh && Drawer.isOpen) Drawer.open(fresh.name, disciplineDetailBody(fresh, ctx)); };
  const ctx = { leave: () => Drawer.close(), reopen: refreshDrawer };
  Drawer.open(d.name, disciplineDetailBody(d, ctx));
}

/** Conteúdo do detalhe (painel no computador, modal no celular). */
function disciplineDetailBody(d, ctx){
  const prog = disciplineProgress(d.id);
  const weekProg = PlannerEngine.getCurrentWeekProgress().perDiscipline.find(x => x.disciplineId === d.id);
  const topics = topicsOf(d.id, true);
  const visible = topics.filter(t => !t.archived);
  const area = d.areaId ? getArea(d.areaId) : null;

  /* adicionar tópico: digitar o nome e confirmar em um modal focado */
  const addInput = h('input', { type:'text', id:'dd-new-topic', maxlength:'80', autocomplete:'off',
    placeholder: visible.length ? 'Ex.: ' + (visible[visible.length - 1].name === 'OSPF' ? 'VLAN' : 'OSPF') : 'Ex.: OSPF', 'aria-label':'Nome do novo tópico' });
  const addHint = h('p', { class:'hint', style:'margin-top:6px', text:'Digite o nome e clique em Adicionar para escolher a prioridade.' });
  const submitAdd = () => {
    const name = addInput.value.trim();
    if(!name){
      addHint.textContent = 'Escreva o nome do tópico primeiro.';
      addHint.classList.add('warn-text');
      addInput.focus();
      return;
    }
    ctx.leave();
    openTopicModal(d.id, null, { name });
  };
  addInput.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); submitAdd(); } });

  const topicList = h('div', { class:'topic-list' });
  if(!visible.length){
    topicList.append(h('p', { class:'hint', text:'Nenhum tópico ainda. Tópicos são as partes da disciplina — por exemplo, em Redes de Computadores: Subnetting, VLAN, OSPF.' }));
  } else {
    visible.forEach((t, i) => {
      const st = topicStatus(t);
      topicList.append(h('div', { class:'topic-row' },
        statusMark(st),
        h('button', { class:'tr-main', type:'button',
          onclick:() => { if(isDesktopUI()) openTopicDrawer(t.id); else { ctx.leave(); openTopicModal(d.id, t); } } },
          h('span', { class:'tr-name', text:t.name }),
          h('span', { class:'tr-meta', text:
            TOPIC_STATUS_LABEL[st] +
            (t.masteryLevel ? ` · domínio ${t.masteryLevel}/5` : '') +
            (t.reviewDueDate ? ` · revisão ${fmtRelativeFuture(t.reviewDueDate)}` : (t.reviewEnabled ? '' : ' · revisão desligada')) })),
        priorityChip(t.priority),
        h('span', { class:'row-actions' },
          h('button', { class:'icon-btn mini', type:'button', text:'↑', title:'Subir', 'aria-label':`Subir ${t.name}`, disabled: i === 0,
            onclick: async () => { await moveTopic(t.id, -1); ctx.reopen(); } }),
          h('button', { class:'icon-btn mini', type:'button', text:'↓', title:'Descer', 'aria-label':`Descer ${t.name}`, disabled: i === visible.length - 1,
            onclick: async () => { await moveTopic(t.id, 1); ctx.reopen(); } }),
          h('button', { class:'linkbtn', type:'button', text:'editar', 'aria-label':`Editar ${t.name}`,
            onclick:() => { ctx.leave(); openTopicModal(d.id, t); } }))
      ));
    });
  }

  const archived = topics.filter(t => t.archived);
  if(archived.length){
    topicList.append(h('p', { class:'hint', style:'margin-top:10px', text:`${archived.length} tópico(s) arquivado(s) — histórico preservado.` }));
    archived.forEach(t => topicList.append(h('div', { class:'topic-row is-archived' },
      statusMark(topicStatus(t)),
      h('div', { class:'tr-main' }, h('div', { class:'tr-name', text:t.name }), h('div', { class:'tr-meta', text:'arquivado' })),
      h('button', { class:'linkbtn', type:'button', text:'reativar',
        onclick: async () => { t.archived = false; await persist('topics', t); await refresh(); ctx.reopen(); toast(t.name, 'ok', { title:'Tópico reativado' }); } }))));
  }

  const dls = state.deadlines.filter(x => x.disciplineId === d.id && !DeadlineEngine.isDone(x))
    .sort((a,b) => str(a.date).localeCompare(str(b.date)));

  return h('div', { class:'disc-detail' },
    h('p', { class:'detail-path' },
      h('span', { class:'dp-kicker', text:AREA_TERM }),
      area ? h('span', { text:area.name }) : h('span', { class:'muted-text', text:'Ainda sem área' }),
      h('span', { class:'sep', 'aria-hidden':'true', text:'›' }),
      h('span', { class:'dp-kicker', text:'Disciplina' }), h('span', { text:d.name })),
    h('div', { class:'detail-prio' }, h('span', { text:'Prioridade da disciplina' }), priorityChip(d.priority)),
    h('div', { class:'stat-grid', style:'margin:14px 0' },
      statBox(weekProg ? fmtDuration(weekProg.planned) : '—', 'planejado na semana'),
      statBox(weekProg ? fmtDuration(weekProg.realized) : fmtDuration(minutesInRange({ start:startOfWeek(today()), end:endOfWeek(today()) }, d.id)), 'realizado'),
      statBox(prog.coverage !== null ? fmtPct(prog.coverage) : '—', 'conteúdo estudado'),
      statBox(fmtRelativePast(lastStudyISO(d.id)), 'último estudo')),
    prog.total > 0 ? h('div', { style:'margin-bottom:16px' },
      h('p', { class:'hint', style:'margin-bottom:6px' }, `Conteúdo estudado ${fmtPct(prog.coverage)} · consolidado ${fmtPct(prog.mastery)}`, helpDot('cobertura')),
      barWithTip(prog.coverage, null, d.name, [
        ['Tópicos', String(prog.total)],
        ['Iniciados', String(prog.covered)],
        ['Consolidados', String(prog.mastered)]
      ])) : null,
    h('div', { class:'topic-add' },
      h('p', { class:'section-label' }, 'Tópicos', helpDot('prioridadeTopico')),
      h('div', { class:'topic-add-row' },
        addInput,
        h('button', { class:'btn primary sm', type:'button', onclick:submitAdd }, icon('i-plus'), 'Adicionar')),
      addHint,
      h('button', { class:'linkbtn muted', type:'button', text:'Adicionar vários de uma vez',
        onclick:() => { ctx.leave(); openBulkTopicModal(d.id); } })),
    topicList,
    dls.length ? h('div', { style:'margin-top:18px' },
      h('p', { class:'section-label', text:'Prazos desta disciplina' }),
      h('div', { class:'dl-mini-list' }, dls.slice(0, 4).map(dl => deadlineMiniRow(dl, ctx)))) : null,
    h('div', { class:'row auto', style:'margin-top:20px' },
      d.archived ? null : h('button', { class:'btn primary sm', type:'button', onclick:() => { ctx.leave(); openRegisterModal({ disciplineId:d.id }); } }, icon('i-play'), 'Estudar agora'),
      h('button', { class:'btn ghost sm', type:'button', text:'Editar disciplina', onclick:() => { ctx.leave(); openDisciplineModal(d); } }),
      h('button', { class:'btn ghost sm', type:'button', text:'+ Prazo', onclick:() => { ctx.leave(); openDeadlineModal(null, { disciplineId:d.id }); } }),
      h('button', { class:'btn ghost sm', type:'button', text: d.archived ? 'Reativar' : 'Arquivar',
        onclick: async () => { ctx.leave(); await toggleArchiveDiscipline(d.id); } }))
  );
}

/* ---------- CRUD: Áreas de Estudo ---------- */
function openAreaModal(area, opts){
  // Só é edição quando recebemos uma área de verdade. Protege handlers que
  // repassem o Event por engano (ex.: onclick:openAreaModal).
  if(area && typeof area.id !== 'string'){
    console.warn('openAreaModal recebeu um argumento que não é uma área; tratando como nova área.', area);
    area = null;
  }
  const o = (opts && !(opts instanceof Event)) ? opts : {};
  openModal(close => {
    const nameIn = h('input', { type:'text', id:'ar-name', value: area ? area.name : '', placeholder:'Ex.: Tecnologia', maxlength:'60', autocomplete:'off' });

    // disciplinas que podem ficar nesta área: as desta área e as ainda sem área
    const candidates = activeDisciplines()
      .filter(d => (area && d.areaId === area.id) || !d.areaId || !getArea(d.areaId))
      .sort(sortByName);
    const preselect = new Set(o.preselect || []);
    const checks = candidates.map(d => {
      const c = h('input', { type:'checkbox', value:d.id, checked: area ? d.areaId === area.id : preselect.has(d.id) });
      return { d, c };
    });

    const content = h('div',
      h('p', { class:'modal-sub', text:'Uma Área de Estudo organiza disciplinas relacionadas. Cada Disciplina reúne os Tópicos que você estuda.' }),
      h('div', { class:'mini-tree', style:'margin-bottom:16px' },
        h('div', { class:'mt-row lvl0' }, h('span', { class:'mt-tag', text:AREA_TERM }), 'Tecnologia'),
        h('div', { class:'mt-row lvl1' }, h('span', { class:'mt-tag', text:'Disciplina' }), 'Redes de Computadores'),
        h('div', { class:'mt-row lvl2' }, h('span', { class:'mt-tag', text:'Tópico' }), 'OSPF')),
      h('div', { class:'field' }, h('label', { for:'ar-name', text:'Nome da Área de Estudo' }), nameIn,
        h('p', { class:'hint', text:'Outros exemplos: Faculdade, Escola, Idiomas, Música, Concurso.' })),
      checks.length ? h('fieldset', { class:'check-list' },
        h('legend', { text: area ? 'Disciplinas desta área' : 'Colocar nesta área (opcional)' }),
        checks.map(({ d, c }) => h('label', { class:'check-row' }, c, h('span', { text:d.name })))) : null,
      area ? null : h('p', { class:'hint', style:'margin-top:10px', text:'Área de Estudo não tem prioridade: ela serve só para organizar.' })
    );

    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text: area ? 'Salvar' : 'Criar Área de Estudo', onclick: async () => {
        const name = nameIn.value.trim();
        if(!name){ nameIn.setAttribute('aria-invalid','true'); nameIn.focus(); toast('Escreva o nome da Área de Estudo.', 'err'); return; }
        const dup = state.areas.find(x => x.name.toLowerCase() === name.toLowerCase() && (!area || x.id !== area.id));
        if(dup){ nameIn.setAttribute('aria-invalid','true'); toast(`Você já tem a Área "${dup.name}".`, 'err'); return; }
        const target = area ? Object.assign({}, area, { name, updatedAt: nowISO() }) : newArea(name);
        const changed = [];
        checks.forEach(({ d, c }) => {
          const want = c.checked ? target.id : (d.areaId === target.id ? null : d.areaId);
          if((d.areaId || null) !== (want || null)) changed.push(Object.assign({}, d, { areaId: want || null, updatedAt: nowISO() }));
        });
        close();
        try {
          await DB.transactional(changed.length ? ['areas','disciplines'] : ['areas'], api => {
            api.put('areas', target);
            changed.forEach(d => api.put('disciplines', d));
          });
          ui.planDraft = null;
          await refresh();
          const moved = changed.filter(d => d.areaId === target.id).length;
          toast(moved ? `${moved} ${moved === 1 ? 'disciplina organizada' : 'disciplinas organizadas'} em ${name}.` : 'Adicione disciplinas a ela quando quiser.', 'ok',
            { title: area ? 'Área de Estudo atualizada' : `${name} criada` });
        } catch(err){
          console.error('Falha ao salvar a área:', err);
          toast('Tente novamente. Nada foi alterado.', 'err', { title:'Não foi possível salvar a Área de Estudo' });
        }
      } })
    ];
    if(area){
      actions.unshift(h('button', { class:'linkbtn danger', type:'button', text:'excluir área', onclick: async () => {
        const inside = state.disciplines.filter(d => d.areaId === area.id);
        close();
        const ok = await confirmModal(inside.length
          ? `Excluir a Área "${area.name}"? ${inside.length === 1 ? 'A disciplina dela fica' : `As ${inside.length} disciplinas dela ficam`} sem área — nenhuma disciplina, tópico ou sessão é apagado.`
          : `Excluir a Área "${area.name}"?`, { confirmLabel:'Excluir área' });
        if(!ok) return;
        try {
          await DB.transactional(['areas','disciplines'], api => {
            api.delete('areas', area.id);
            inside.forEach(d => api.put('disciplines', Object.assign({}, d, { areaId:null, updatedAt: nowISO() })));
          });
          await refresh();
          toast(inside.length ? 'As disciplinas continuam disponíveis em "Ainda não organizadas".' : area.name, 'info', { title:'Área de Estudo excluída' });
        } catch(err){
          console.error('Falha ao excluir a área:', err);
          toast('Tente novamente. Nada foi alterado.', 'err', { title:'Não foi possível excluir a área' });
        }
      } }));
    }
    return { title: area ? 'Editar Área de Estudo' : 'Nova Área de Estudo', content, actions };
  });
}

/* ---------- CRUD: Disciplinas ---------- */
function openDisciplineModal(disc, opts){
  if(disc && typeof disc.id !== 'string') disc = null;       // Event recebido por engano
  const o = (opts && !(opts instanceof Event)) ? opts : {};
  openModal(close => {
    const nameIn = h('input', { type:'text', id:'dm-name', value: disc ? disc.name : '', placeholder:'Ex.: Redes de Computadores', maxlength:'80', autocomplete:'off' });
    let priority = disc ? PriorityEngine.clamp(disc.priority) : PRIORITY_DEFAULT;

    /* Área de Estudo — opcional, com criação na hora */
    const initialArea = disc ? (disc.areaId && getArea(disc.areaId) ? disc.areaId : '') : (o.areaId && getArea(o.areaId) ? o.areaId : '');
    const areaSel = h('select', { id:'dm-area' });
    areaSel.appendChild(h('option', { value:'' }, 'Sem área (organizar depois)'));
    state.areas.slice().sort(sortByName).forEach(a => areaSel.appendChild(h('option', { value:a.id, selected: a.id === initialArea }, a.name)));
    areaSel.appendChild(h('option', { value:'__new__' }, '+ Criar nova Área de Estudo…'));
    const newAreaIn = h('input', { type:'text', id:'dm-new-area', maxlength:'60', placeholder:'Ex.: Tecnologia', autocomplete:'off', 'aria-label':'Nome da nova Área de Estudo' });
    const newAreaBox = h('div', { class:'inline-new', hidden:true }, newAreaIn,
      h('p', { class:'hint', text:'A nova Área de Estudo é criada junto com a disciplina.' }));
    areaSel.addEventListener('change', () => {
      newAreaBox.hidden = areaSel.value !== '__new__';
      if(!newAreaBox.hidden) setTimeout(() => newAreaIn.focus(), 20);
    });

    const prio = priorityPicker({ value:priority, context:'discipline', id:'dm-prio', label:'Prioridade', helpKey:'prioridade',
      onChange: v => { priority = v; } });

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
      .forEach(x => stratSel.appendChild(h('option', { value:x.v, selected:x.v === dStrategy }, x.label)));
    stratSel.addEventListener('change', () => { dStrategy = stratSel.value; });

    const methodSel = h('select', { id:'dm-method' });
    [{ v:'inherit', label:'Usar o padrão geral (' + methodLabel(state.settings.defaultReviewMethod) + ')' }]
      .concat(REVIEW_METHODS.map(m => ({ v:m.v, label:m.label })))
      .forEach(x => methodSel.appendChild(h('option', { value:x.v, selected:x.v === dMethod }, x.label)));
    methodSel.addEventListener('change', () => { dMethod = methodSel.value; });

    const advanced = h('details', { class:'advanced' },
      h('summary', null, 'Opções avançadas'),
      h('div', { class:'advanced-body' },
        h('div', { class:'field' }, h('label', { for:'dm-nature' }, 'Natureza do conteúdo', helpDot('natureza')), natureSel,
          h('p', { class:'hint', text:'Orienta o método de revisão sugerido. Pode deixar em Mista.' })),
        h('div', { class:'field' }, h('label', { for:'dm-strategy' }, 'Estratégia de revisão', helpDot('estrategia')), stratSel),
        h('div', { class:'field' }, h('label', { for:'dm-method' }, 'Método de revisão', helpDot('metodo')), methodSel),
        h('div', { class:'field tight' }, h('label', { for:'dm-mpc' }, 'Minutos por crédito', helpDot('creditos')), mpcIn,
          h('p', { class:'hint', text:'Quantos minutos valem 1 crédito nesta disciplina.' }))));

    const content = h('div',
      h('div', { class:'field' },
        h('label', { for:'dm-name', text: disc ? 'Nome da disciplina' : 'Qual disciplina você quer adicionar?' }), nameIn,
        disc ? null : h('p', { class:'hint', text:'Disciplina é o que você estuda. Ex.: Matemática, Inglês, Direito Penal, Violão.' })),
      h('div', { class:'field' },
        h('label', { for:'dm-area' }, AREA_TERM, h('span', { class:'optional', text:'opcional' }), helpDot('areaEstudo')),
        areaSel, newAreaBox,
        h('p', { class:'hint', text:'É o contexto maior onde esta disciplina se encaixa.' }),
        h('p', { class:'example-line' },
          h('span', { text:'Tecnologia → Redes de Computadores' }),
          h('span', { text:'Faculdade → Direito Penal' }),
          h('span', { text:'Música → Violão' }))),
      h('div', { class:'field' }, prio),
      advanced
    );

    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text: disc ? 'Salvar' : 'Adicionar disciplina', onclick: async () => {
        const name = nameIn.value.trim();
        if(!name){ nameIn.setAttribute('aria-invalid','true'); nameIn.focus(); toast('Escreva o nome da disciplina.', 'err'); return; }
        const dup = state.disciplines.find(x => !x.archived && x.name.toLowerCase() === name.toLowerCase() && (!disc || x.id !== disc.id));
        if(dup){ nameIn.setAttribute('aria-invalid','true'); toast(`Você já tem "${dup.name}".`, 'err'); return; }

        let areaId = areaSel.value || null;
        let createdArea = null;
        if(areaId === '__new__'){
          const areaName = newAreaIn.value.trim();
          if(!areaName){ newAreaIn.setAttribute('aria-invalid','true'); newAreaIn.focus(); toast('Escreva o nome da nova Área de Estudo ou escolha "Sem área".', 'err'); return; }
          const existing = state.areas.find(a => a.name.toLowerCase() === areaName.toLowerCase());
          if(existing) areaId = existing.id;
          else { createdArea = newArea(areaName); areaId = createdArea.id; }
        }
        const mpc = Math.max(1, Math.round(Number(mpcIn.value) || 20));
        close();
        try {
          let entity;
          if(disc){
            entity = Object.assign({}, disc, { name, areaId, priority, minutesPerCredit:mpc,
              contentNature:nature, reviewStrategy:dStrategy, preferredReviewMethod:dMethod, updatedAt: nowISO() });
          } else {
            entity = newDiscipline(name, areaId, priority);
            Object.assign(entity, { minutesPerCredit:mpc, contentNature:nature, reviewStrategy:dStrategy, preferredReviewMethod:dMethod });
          }
          await DB.transactional(createdArea ? ['areas','disciplines'] : ['disciplines'], api => {
            if(createdArea) api.put('areas', createdArea);
            api.put('disciplines', entity);
          });
          ui.planDraft = null;
          await refresh();
          const where = areaId ? ` em ${getArea(areaId) ? getArea(areaId).name : ''}` : '';
          toast(disc ? `Prioridade ${PriorityEngine.text(priority)}${where}.`
                     : `Prioridade ${PriorityEngine.text(priority)}${where}. Adicione tópicos quando quiser.`, 'ok',
            { title: disc ? `${name} atualizada` : `${name} adicionada` });
        } catch(err){
          console.error('Falha ao salvar a disciplina:', err);
          toast('Tente novamente. Nada foi alterado.', 'err', { title:'Não foi possível salvar a disciplina' });
        }
      } })
    ];
    if(disc){
      actions.unshift(h('button', { class:'btn ghost', type:'button', text: disc.archived ? 'Reativar' : 'Arquivar',
        onclick: async () => { close(); await toggleArchiveDiscipline(disc.id); } }));
      actions.unshift(h('button', { class:'linkbtn danger', type:'button', text:'excluir definitivamente',
        onclick: async () => { close(); await deleteDisciplineForever(disc.id); } }));
    }
    return { title: disc ? 'Editar disciplina' : 'Nova disciplina', content, actions };
  }, { size:'wide' });
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


/* ---------- CRUD: Tópicos ---------- */
function topicReviewOptions(disciplineId, topic){
  let tStrategy = topic ? (topic.reviewStrategy || 'inherit') : 'inherit';
  let tMethod = topic ? (topic.preferredReviewMethod || 'inherit') : 'inherit';
  const tStratSel = h('select', { id:'tm-strategy' });
  [{ v:'inherit', label:'Usar o padrão da disciplina (' + strategyLabel(ReviewEngine.effectiveStrategy({ disciplineId, reviewStrategy:'inherit' })) + ')' }]
    .concat(REVIEW_STRATEGIES.map(x => ({ v:x.v, label:x.label })))
    .forEach(x => tStratSel.appendChild(h('option', { value:x.v, selected:x.v === tStrategy }, x.label)));
  tStratSel.addEventListener('change', () => { tStrategy = tStratSel.value; });
  const tMethodSel = h('select', { id:'tm-method' });
  [{ v:'inherit', label:'Usar o padrão da disciplina' }]
    .concat(REVIEW_METHODS.map(m => ({ v:m.v, label:m.label })))
    .forEach(x => tMethodSel.appendChild(h('option', { value:x.v, selected:x.v === tMethod }, x.label)));
  tMethodSel.addEventListener('change', () => { tMethod = tMethodSel.value; });
  const node = h('details', { class:'advanced' },
    h('summary', null, 'Opções de revisão'),
    h('div', { class:'advanced-body' },
      h('p', { class:'hint', style:'margin:0 0 10px', text:'Por padrão o tópico segue a disciplina. Só mude se este conteúdo pedir algo diferente.' }),
      h('div', { class:'field' }, h('label', { for:'tm-strategy' }, 'Estratégia', helpDot('estrategia')), tStratSel),
      h('div', { class:'field tight' }, h('label', { for:'tm-method' }, 'Método preferido', helpDot('metodo')), tMethodSel),
      topic && topic.reviewDueDate ? h('p', { class:'hint', style:'margin-top:10px', text:`Mudar a estratégia ou a prioridade não altera a revisão já marcada (${fmtRelativeFuture(topic.reviewDueDate)}); vale a partir da próxima resposta.` }) : null));
  return { node, get strategy(){ return tStrategy; }, get method(){ return tMethod; } };
}

function reviewToggle(checked){
  const chk = h('input', { type:'checkbox', id:'tm-review', checked });
  return { chk, node: h('div', { class:'field' },
    h('label', { class:'check-row strong', for:'tm-review' }, chk, h('span', { text:'Incluir nas revisões' })),
    h('p', { class:'hint', style:'margin-left:26px', text:'O Ciclo avisará quando for hora de revisar este tópico.' })) };
}

/**
 * Adicionar ou editar UM tópico. opts.name pré-preenche o nome digitado na
 * disciplina; opts.returnTo === false não reabre a disciplina ao salvar.
 */
function openTopicModal(disciplineId, topic, opts){
  if(topic && typeof topic.id !== 'string') topic = null;
  const o = (opts && !(opts instanceof Event)) ? opts : {};
  const disc = getDiscipline(disciplineId);
  if(!disc){ toast('Escolha uma disciplina primeiro.', 'err'); return; }
  openModal(close => {
    const nameIn = h('input', { type:'text', id:'tm-name', value: topic ? topic.name : (o.name || ''), placeholder:'Ex.: OSPF', maxlength:'80', autocomplete:'off' });
    let priority = topic ? PriorityEngine.clamp(topic.priority) : PRIORITY_DEFAULT;
    const prio = priorityPicker({ value:priority, context:'topic', id:'tm-prio', label:'Prioridade', helpKey:'prioridadeTopico',
      onChange: v => { priority = v; } });
    const rev = reviewToggle(topic ? topic.reviewEnabled : !!state.settings.autoReviewNewTopics);
    const advanced = topicReviewOptions(disciplineId, topic);

    const content = h('div',
      h('p', { class:'modal-sub' }, h('span', { class:'muted-text', text:'Disciplina: ' }), disciplinePath(disc)),
      h('div', { class:'field' }, h('label', { for:'tm-name', text:'Nome do tópico' }), nameIn,
        topic ? null : h('p', { class:'hint', text:'Um conteúdo específico da disciplina. Ex.: Subnetting, VLAN, OSPF.' })),
      h('div', { class:'field' }, prio),
      rev.node,
      advanced.node,
      topic && topic.reviewDueDate ? h('p', { class:'hint', style:'margin-top:12px',
        text:`Próxima revisão ${fmtRelativeFuture(topic.reviewDueDate)} · intervalo atual ${topic.reviewIntervalDays} dia(s) · domínio ${topic.masteryLevel || '—'}/5` }) : null,
      topic ? null : h('button', { class:'linkbtn muted', type:'button', style:'margin-top:12px', text:'Prefere adicionar vários tópicos de uma vez?',
        onclick:() => { close(); openBulkTopicModal(disciplineId); } })
    );

    const done = () => { if(o.returnTo !== false) openDisciplineDetail(disciplineId); };

    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => { close(); if(o.name) done(); } }),
      h('button', { class:'btn primary', type:'button', text: topic ? 'Salvar' : 'Adicionar tópico', onclick: async () => {
        const name = nameIn.value.trim();
        if(!name){ nameIn.setAttribute('aria-invalid','true'); nameIn.focus(); toast('Escreva o nome do tópico.', 'err'); return; }
        const dup = topicsOf(disciplineId).find(x => x.name.toLowerCase() === name.toLowerCase() && (!topic || x.id !== topic.id));
        if(dup){ nameIn.setAttribute('aria-invalid','true'); toast(`"${dup.name}" já existe em ${disc.name}.`, 'err'); return; }
        close();
        try {
          if(topic){
            const updated = Object.assign({}, topic, { name, priority, reviewEnabled: rev.chk.checked,
              reviewStrategy: advanced.strategy, preferredReviewMethod: advanced.method, updatedAt: nowISO() });
            delete updated.importance;
            await DB.put('topics', updated);
            await refresh();
            toast(`${name} · prioridade ${PriorityEngine.text(priority)}`, 'ok', { title:'Tópico atualizado' });
          } else {
            const existing = topicsOf(disciplineId, true);
            const order = existing.length ? Math.max(...existing.map(t => t.sortOrder || 0)) + 10 : 10;
            const t = newTopic(disciplineId, name, order);
            Object.assign(t, { priority, reviewEnabled: rev.chk.checked, reviewStrategy: advanced.strategy, preferredReviewMethod: advanced.method });
            await DB.put('topics', t);
            await refresh();
            toast(`${disc.name} › ${name} · prioridade ${PriorityEngine.text(priority)}`, 'ok', { title:'Tópico adicionado' });
          }
          done();
        } catch(err){
          console.error('Falha ao salvar o tópico:', err);
          toast('Tente novamente. Nada foi alterado.', 'err', { title:'Não foi possível salvar o tópico' });
        }
      } })
    ];
    if(topic){
      actions.unshift(h('button', { class:'btn ghost', type:'button', text:'Arquivar', onclick: async () => {
        close();
        const ok = await confirmModal('Arquivar este tópico? Ele sai das opções ativas e a revisão fica pausada — o histórico é preservado.', { confirmLabel:'Arquivar', danger:false });
        if(!ok){ done(); return; }
        await persist('topics', Object.assign(topic, { archived:true }));
        await refresh();
        toast(topic.name, 'info', { title:'Tópico arquivado' });
        done();
      } }));
    }
    return { title: topic ? 'Editar tópico' : 'Adicionar tópico', content, actions };
  });
}

/** Opção secundária: vários tópicos de uma vez, um por linha. */
function openBulkTopicModal(disciplineId){
  const disc = getDiscipline(disciplineId);
  if(!disc) return;
  openModal(close => {
    const area = h('textarea', { id:'tm-multi', placeholder:'Subnetting\nVLAN\nOSPF', style:'min-height:120px' });
    let priority = PRIORITY_DEFAULT;
    const prio = priorityPicker({ value:priority, context:'topic', id:'tm-bulk-prio', label:'Prioridade de todos', onChange: v => { priority = v; } });
    const rev = reviewToggle(!!state.settings.autoReviewNewTopics);
    return {
      title:'Adicionar vários tópicos',
      content: h('div',
        h('p', { class:'modal-sub' }, h('span', { class:'muted-text', text:'Disciplina: ' }), disciplinePath(disc)),
        h('div', { class:'field' }, h('label', { for:'tm-multi', text:'Tópicos (um por linha)' }), area,
          h('p', { class:'hint', text:'Todos recebem a mesma prioridade. Você pode ajustar cada um depois.' })),
        h('div', { class:'field' }, prio),
        rev.node),
      actions:[
        h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => { close(); openDisciplineDetail(disciplineId); } }),
        h('button', { class:'btn primary', type:'button', text:'Adicionar tópicos', onclick: async () => {
          const known = new Set(topicsOf(disciplineId).map(t => t.name.toLowerCase()));
          const seen = new Set();
          const lines = area.value.split('\n').map(x => x.trim()).filter(x => {
            const k = x.toLowerCase();
            if(!x || known.has(k) || seen.has(k)) return false;
            seen.add(k); return true;
          });
          if(!lines.length){ area.setAttribute('aria-invalid','true'); area.focus(); toast('Escreva ao menos um tópico novo, um por linha.', 'err'); return; }
          close();
          const existing = topicsOf(disciplineId, true);
          let order = existing.length ? Math.max(...existing.map(t => t.sortOrder || 0)) : 0;
          const created = lines.map(name => {
            order += 10;
            return Object.assign(newTopic(disciplineId, name, order), { priority, reviewEnabled: rev.chk.checked });
          });
          try {
            await DB.putMany('topics', created);
            await refresh();
            toast(created.slice(0, 3).map(t => t.name).join(', ') + (created.length > 3 ? ` e mais ${created.length - 3}` : '') + ` · ${disc.name}`,
              'ok', { title: created.length === 1 ? 'Tópico adicionado' : `${created.length} tópicos adicionados` });
          } catch(err){
            console.error(err);
            toast('Tente novamente. Nada foi alterado.', 'err', { title:'Não foi possível adicionar os tópicos' });
          }
          openDisciplineDetail(disciplineId);
        } })
      ]
    };
  }, { size:'wide' });
}

/* =========================================================================
   PRAZOS — provas, trabalhos, projetos, tarefas, demandas e entregas.
   ========================================================================= */
function deadlinesCard(){
  const open = DeadlineEngine.open();
  const done = state.deadlines.filter(d => DeadlineEngine.isDone(d))
    .sort((a,b) => str(b.completedAt || b.updatedAt).localeCompare(str(a.completedAt || a.updatedAt)));
  const c = h('section', { class:'card deadlines-section', id:'deadlines-section', 'aria-labelledby':'dl-heading' },
    h('div', { class:'card-head' },
      h('div', null,
        h('p', { class:'card-title', id:'dl-heading', style:'margin:0' }, 'Prazos', helpDot('prazo')),
        h('p', { class:'hint', style:'margin:2px 0 0', text:'Provas, trabalhos, projetos, tarefas, demandas e entregas.' })),
      h('button', { class:'btn primary sm', type:'button', onclick:() => openDeadlineModal(null) }, icon('i-plus'), 'Adicionar prazo')));
  if(!state.deadlines.length){
    c.append(h('div', { class:'empty' },
      h('strong', { text:'Nenhum prazo cadastrado' }),
      h('span', { text:'Use prazos para acompanhar datas importantes como provas, trabalhos, projetos, tarefas e entregas. Quanto mais perto e mais prioritário, mais ele pesa nas sugestões.' }),
      h('div', { class:'empty-actions' },
        h('button', { class:'btn primary', type:'button', onclick:() => openDeadlineModal(null) }, icon('i-plus'), 'Adicionar prazo'),
        h('button', { class:'btn ghost', type:'button', text:'Como funcionam os prazos?', onclick:() => openHelpArticleDrawer('prazos') }))));
    return c;
  }
  if(open.length){
    c.append(h('div', { class:'dl-grid' }, open.map(dl => deadlineCard(dl))));
  } else {
    c.append(h('p', { class:'hint', text:'Nenhum prazo em aberto. Os concluídos continuam guardados abaixo.' }));
  }
  if(done.length){
    c.append(h('details', { class:'advanced done-deadlines' },
      h('summary', null, `Concluídos (${done.length})`),
      h('div', { class:'dl-grid' }, done.slice(0, 30).map(dl => deadlineCard(dl)))));
  }
  return c;
}

function deadlineStatusPill(dl){
  if(DeadlineEngine.isDone(dl)) return h('span', { class:'pill teal', text:'Concluído' });
  if(DeadlineEngine.isOverdue(dl)) return h('span', { class:'pill danger', text:'Data passou' });
  if(dl.status === 'in_progress') return h('span', { class:'pill brass', text:'Em andamento' });
  return h('span', { class:'pill', text:'Pendente' });
}

function deadlineCard(dl){
  const info = deadlineTypeInfo(dl.type);
  const disc = dl.disciplineId ? getDiscipline(dl.disciplineId) : null;
  const topic = dl.topicId ? getTopic(dl.topicId) : null;
  const done = DeadlineEngine.isDone(dl);
  const n = DeadlineEngine.daysLeft(dl);
  const soon = !done && n !== null && n >= 0 && n <= 7;
  return h('article', { class:'dl-card' + (done ? ' is-done' : '') + (soon ? ' is-soon' : '') + (DeadlineEngine.isOverdue(dl) ? ' is-overdue' : '') },
    h('div', { class:'dl-top' },
      h('span', { class:'dl-type', text:info.label }),
      deadlineStatusPill(dl),
      !done && !DeadlineEngine.hasStarted(dl) ? h('span', { class:'pill', text:`começa em ${fmtDateBR(dl.startDate)}` }) : null),
    h('h4', { class:'dl-title', text:dl.title }),
    h('p', { class:'dl-context', text: disc ? (disc.name + (topic ? ' › ' + topic.name : '')) : 'Sem disciplina' }),
    h('p', { class:'dl-when' },
      h('strong', { text: DeadlineEngine.dueText(dl) }),
      h('span', { text: fmtDateLong(dl.date) })),
    h('div', { class:'dl-foot' },
      priorityChip(dl.priority),
      h('div', { class:'dl-actions' },
        h('button', { class:'btn ghost sm', type:'button', text:'Ver detalhes', 'aria-label':`Ver detalhes de ${dl.title}`, onclick:() => openDeadlineDrawer(dl.id) }),
        done
          ? h('button', { class:'btn ghost sm', type:'button', text:'Reabrir', 'aria-label':`Reabrir ${dl.title}`, onclick: once(() => setDeadlineStatus(dl.id, 'pending')) })
          : h('button', { class:'btn ghost sm', type:'button', 'aria-label':`Concluir ${dl.title}`, onclick: once(() => setDeadlineStatus(dl.id, 'completed')) }, icon('i-check'), 'Concluir'))));
}

/** Linha compacta (Hoje, detalhe da disciplina e do tópico). */
function deadlineMiniRow(dl, ctx){
  const info = deadlineTypeInfo(dl.type);
  const topic = dl.topicId ? getTopic(dl.topicId) : null;
  const disc = dl.disciplineId ? getDiscipline(dl.disciplineId) : null;
  return h('button', { class:'dl-mini' + (DeadlineEngine.isOverdue(dl) ? ' is-overdue' : ''), type:'button',
      onclick:() => { if(ctx && ctx.leave && !isDesktopUI()) ctx.leave(); openDeadlineDrawer(dl.id); } },
    h('span', { class:'dl-mini-main' },
      h('span', { class:'dl-mini-title' }, h('span', { class:'dl-type', text:info.label }), dl.title),
      h('span', { class:'dl-mini-sub', text: [DeadlineEngine.dueText(dl), disc ? disc.name + (topic ? ' › ' + topic.name : '') : null].filter(Boolean).join(' · ') })),
    priorityChip(dl.priority, { compact:true }));
}

async function setDeadlineStatus(id, status){
  const dl = state.deadlines.find(d => d.id === id);
  if(!dl || !DEADLINE_STATUSES.some(x => x.v === status)) return;
  const updated = Object.assign({}, dl, {
    status,
    completedAt: status === 'completed' ? (dl.completedAt || nowISO()) : null,
    updatedAt: nowISO()
  });
  try {
    await DB.put('deadlines', updated);
    await refresh();
    if(Drawer.isOpen && ui.openDeadlineId === id) openDeadlineDrawer(id);
    const msg = {
      completed:  ['Prazo concluído', 'Ele deixa de influenciar suas recomendações e continua no histórico.'],
      in_progress:['Prazo em andamento', updated.title],
      pending:    ['Prazo reaberto', 'Ele volta a influenciar as recomendações quando estiver ativo.']
    }[status];
    toast(msg[1], status === 'completed' ? 'ok' : 'info', { title: msg[0] });
  } catch(err){
    console.error(err);
    toast('Tente novamente. Nada foi alterado.', 'err', { title:'Não foi possível atualizar o prazo' });
  }
}

async function deleteDeadline(id){
  const dl = state.deadlines.find(d => d.id === id);
  if(!dl) return;
  const ok = await confirmModal(`Excluir o prazo "${dl.title}"? Esta ação não pode ser desfeita. Se ele já foi cumprido, prefira marcá-lo como concluído.`, { confirmLabel:'Excluir prazo' });
  if(!ok) return;
  try {
    await DB.delete('deadlines', id);
    if(Drawer.isOpen && ui.openDeadlineId === id) Drawer.close();
    await refresh();
    toast(dl.title, 'info', { title:'Prazo excluído' });
  } catch(err){
    console.error(err);
    toast('Tente novamente.', 'err', { title:'Não foi possível excluir o prazo' });
  }
}

/** Frase humana sobre como o prazo está pesando agora. */
function deadlineInfluenceText(dl){
  if(DeadlineEngine.isDone(dl)) return 'Concluído: não influencia mais suas recomendações.';
  if(!DeadlineEngine.hasStarted(dl)) return `Ainda não influencia suas recomendações. Passa a contar em ${fmtDateLong(dl.startDate)}.`;
  if(DeadlineEngine.isOverdue(dl)) return 'A data já passou. Marque como concluído quando terminar, ou edite a data.';
  const u = DeadlineEngine.urgency(dl);
  const level = u >= 0.6 ? 'bastante' : u >= 0.3 ? 'moderadamente' : 'pouco, por enquanto';
  const target = dl.topicId && getTopic(dl.topicId) ? `o tópico ${getTopic(dl.topicId).name}` : dl.disciplineId && getDiscipline(dl.disciplineId) ? `a disciplina ${getDiscipline(dl.disciplineId).name}` : null;
  if(!target) return 'Sem disciplina vinculada: aparece na sua lista, mas não altera recomendações.';
  return `Está influenciando ${level} as sugestões para ${target}. Quanto mais perto a data, maior o peso.`;
}

function openDeadlineDrawer(id){
  const dl = state.deadlines.find(d => d.id === id);
  if(!dl) return;
  const info = deadlineTypeInfo(dl.type);
  const disc = dl.disciplineId ? getDiscipline(dl.disciplineId) : null;
  const topic = dl.topicId ? getTopic(dl.topicId) : null;
  const statusCtl = segmented(DEADLINE_STATUSES.map(x => ({ value:x.v, label:x.label })), dl.status,
    v => setDeadlineStatus(dl.id, v), 'Status do prazo');

  const rows = [
    ['Tipo', info.label],
    ['Disciplina', disc ? disciplinePath(disc) : '—'],
    ['Tópico', topic ? topic.name : '—'],
    [info.dateLabel, fmtDateLong(dl.date)],
    ['Início', dl.startDate ? fmtDateLong(dl.startDate) : 'sem data de início']
  ];
  const body = h('div', { class:'dl-detail' },
    h('p', { class:'dl-when big' }, h('strong', { text: DeadlineEngine.dueText(dl) })),
    h('dl', { class:'kv-list' }, rows.map(([k, v]) => h('div', null, h('dt', { text:k }), h('dd', { text:v })))),
    h('div', { class:'detail-prio', style:'margin-top:14px' }, h('span', { text:'Prioridade' }), priorityChip(dl.priority)),
    h('p', { class:'hint', text: PriorityEngine.hint(dl.priority, 'deadline') }),
    h('div', { class:'field', style:'margin-top:16px' }, h('label', { text:'Status' }), statusCtl),
    h('p', { class:'influence-note' }, icon('i-info', 'nav-icon'), h('span', { text: deadlineInfluenceText(dl) })),
    dl.instructions ? h('div', { class:'text-block' }, h('p', { class:'section-label', text:'Orientações' }), h('p', { class:'pre-text', text:dl.instructions })) : null,
    dl.notes ? h('div', { class:'text-block' }, h('p', { class:'section-label', text:'Anotações' }), h('p', { class:'pre-text', text:dl.notes })) : null,
    h('div', { class:'row auto', style:'margin-top:20px' },
      DeadlineEngine.isDone(dl)
        ? h('button', { class:'btn ghost sm', type:'button', text:'Reabrir', onclick: once(() => setDeadlineStatus(dl.id, 'pending')) })
        : h('button', { class:'btn primary sm', type:'button', onclick: once(() => setDeadlineStatus(dl.id, 'completed')) }, icon('i-check'), 'Concluir'),
      h('button', { class:'btn ghost sm', type:'button', text:'Editar', onclick:() => { Drawer.close(); openDeadlineModal(dl); } }),
      topic && isDesktopUI() ? h('button', { class:'btn ghost sm', type:'button', text:'Ver tópico', onclick:() => openTopicDrawer(topic.id) }) : null,
      h('button', { class:'linkbtn danger', type:'button', text:'excluir', onclick:() => deleteDeadline(dl.id) })));
  Drawer.open(dl.title, body, { onClose:() => { ui.openDeadlineId = null; } });
  ui.openDeadlineId = id;             // depois do open: trocar de conteúdo limpa o anterior
}

function openDeadlineModal(dl, preset){
  if(dl && typeof dl.id !== 'string') dl = null;
  const p = (preset && !(preset instanceof Event)) ? preset : {};
  openModal(close => {
    let type = dl ? dl.type : (p.type || 'exam');
    let priority = dl ? PriorityEngine.clamp(dl.priority) : PRIORITY_DEFAULT;
    let status = dl ? dl.status : 'pending';
    let discId = dl ? (dl.disciplineId || '') : (p.disciplineId || '');
    let topicId = dl ? (dl.topicId || '') : (p.topicId || '');

    const titleIn = h('input', { type:'text', id:'dl-title', value: dl ? dl.title : '', maxlength:'120', autocomplete:'off', placeholder:'Ex.: Prova de Redes' });
    const dateIn = h('input', { type:'date', id:'dl-date', value: dl ? dl.date : '' , required:true });
    const dateLabel = h('label', { for:'dl-date' });
    const startIn = h('input', { type:'date', id:'dl-start', value: dl && dl.startDate ? dl.startDate : '' });
    const setDateLabel = () => { clear(dateLabel); dateLabel.append(deadlineTypeInfo(type).dateLabel, h('span', { class:'req', text:' *', 'aria-hidden':'true' })); };
    setDateLabel();

    const typeChips = h('div', { class:'chips', role:'radiogroup', 'aria-label':'Tipo de prazo' });
    DEADLINE_TYPES.forEach(t => {
      const b = h('button', { class:'chip', type:'button', role:'radio', 'aria-checked': t.v === type ? 'true':'false', 'aria-pressed': t.v === type ? 'true':'false', text:t.label });
      b.addEventListener('click', () => {
        type = t.v;
        $$('.chip', typeChips).forEach(x => { x.setAttribute('aria-pressed','false'); x.setAttribute('aria-checked','false'); });
        b.setAttribute('aria-pressed','true'); b.setAttribute('aria-checked','true');
        setDateLabel();
        titleIn.placeholder = `Ex.: ${t.v === 'exam' ? 'Prova de Redes' : t.v === 'project' ? 'Projeto de Redes' : t.v === 'assignment' ? 'Trabalho de História' : t.label + ' de Inglês'}`;
      });
      typeChips.appendChild(b);
    });

    const discSel = h('select', { id:'dl-disc' });
    discSel.appendChild(h('option', { value:'' }, 'Nenhuma'));
    disciplineOptions(false).forEach(x => discSel.appendChild(h('option', { value:x.value, selected: x.value === discId }, x.label)));
    if(discId && !getDiscipline(discId)) discId = '';
    const topicSel = h('select', { id:'dl-topic' });
    const fillTopics = () => {
      clear(topicSel);
      topicSel.appendChild(h('option', { value:'' }, discId ? 'Toda a disciplina' : 'Escolha uma disciplina primeiro'));
      if(discId) topicsOf(discId).forEach(t => topicSel.appendChild(h('option', { value:t.id, selected: t.id === topicId }, t.name)));
      if(topicId && !topicsOf(discId).some(t => t.id === topicId)) topicId = '';
      topicSel.disabled = !discId;
    };
    fillTopics();
    discSel.addEventListener('change', () => { discId = discSel.value; topicId = ''; fillTopics(); });
    topicSel.addEventListener('change', () => { topicId = topicSel.value; });

    const prio = priorityPicker({ value:priority, context:'deadline', id:'dl-prio', label:'Prioridade', helpKey:'prazo', onChange: v => { priority = v; } });
    const statusCtl = segmented(DEADLINE_STATUSES.map(x => ({ value:x.v, label:x.label })), status, v => { status = v; }, 'Status');

    const instrIn = h('textarea', { id:'dl-instr', maxlength:'5000', placeholder:'Ex.: Entregar relatório com topologia, endereçamento e testes.' });
    instrIn.value = dl ? str(dl.instructions) : '';
    const notesIn = h('textarea', { id:'dl-notes', maxlength:'5000', placeholder:'Ex.: O professor também pediu capturas do simulador.' });
    notesIn.value = dl ? str(dl.notes) : '';
    const errBox = h('p', { class:'err', role:'alert' });

    const content = h('div', { class:'dl-form' },
      h('div', { class:'field' }, h('label', { text:'Tipo' }), typeChips),
      h('div', { class:'field' }, h('label', { for:'dl-title' }, 'Título', h('span', { class:'req', text:' *', 'aria-hidden':'true' })), titleIn),
      h('div', { class:'row' },
        h('div', { class:'field' }, dateLabel, dateIn),
        h('div', { class:'field' }, h('label', { for:'dl-start' }, 'Data de início', h('span', { class:'optional', text:'opcional' })), startIn,
          h('p', { class:'hint', text:'Antes desta data, o prazo não influencia suas recomendações.' }))),
      h('div', { class:'row' },
        h('div', { class:'field' }, h('label', { for:'dl-disc' }, 'Disciplina', h('span', { class:'optional', text:'opcional' })), discSel,
          h('p', { class:'hint', text:'O prazo passa a influenciar esta disciplina.' })),
        h('div', { class:'field' }, h('label', { for:'dl-topic' }, 'Tópico', h('span', { class:'optional', text:'opcional' })), topicSel,
          h('p', { class:'hint', text:'Se escolher, só este tópico recebe atenção extra.' }))),
      h('div', { class:'field' }, prio),
      h('div', { class:'field' }, h('label', { text:'Status' }), statusCtl),
      h('details', { class:'advanced', open: !!(dl && (dl.instructions || dl.notes)) },
        h('summary', null, 'Orientações e anotações'),
        h('div', { class:'advanced-body' },
          h('div', { class:'field' }, h('label', { for:'dl-instr', text:'Orientações' }), instrIn,
            h('p', { class:'hint', text:'O que precisa ser feito ou quais são os requisitos.' })),
          h('div', { class:'field tight' }, h('label', { for:'dl-notes', text:'Anotações' }), notesIn,
            h('p', { class:'hint', text:'Observações pessoais sobre este prazo.' })))),
      errBox);

    const fail = (msg, field) => { errBox.textContent = msg; if(field){ field.setAttribute('aria-invalid','true'); field.focus(); } };

    const actions = [
      h('button', { class:'btn ghost', type:'button', text:'Cancelar', onclick:() => close() }),
      h('button', { class:'btn primary', type:'button', text: dl ? 'Salvar' : 'Adicionar prazo', onclick: async () => {
        [titleIn, dateIn, startIn].forEach(x => x.removeAttribute('aria-invalid'));
        const title = titleIn.value.trim();
        if(!title) return fail('Dê um título ao prazo. Ex.: Prova de Redes.', titleIn);
        if(!parseISO(dateIn.value)) return fail(`Informe a ${deadlineTypeInfo(type).dateLabel.toLowerCase()}.`, dateIn);
        const start = startIn.value && parseISO(startIn.value) ? startIn.value : null;
        if(start && start > dateIn.value) return fail('A data de início precisa ser anterior ou igual à data do prazo.', startIn);
        const data = {
          title, type, date: dateIn.value, startDate: start,
          disciplineId: discId || null, topicId: (discId && topicId) ? topicId : null,
          priority, status,
          instructions: instrIn.value.trim(), notes: notesIn.value.trim(),
          completedAt: status === 'completed' ? ((dl && dl.completedAt) || nowISO()) : null
        };
        close();
        try {
          const entity = dl ? Object.assign({}, dl, data, { updatedAt: nowISO() }) : newDeadline(data);
          await DB.put('deadlines', entity);
          await refresh();
          toast(`${deadlineTypeInfo(type).label} · ${DeadlineEngine.dueText(entity)} · prioridade ${PriorityEngine.text(priority)}`, 'ok',
            { title: dl ? 'Prazo atualizado' : `${title} adicionado` });
        } catch(err){
          console.error('Falha ao salvar o prazo:', err);
          toast('Tente novamente. Nada foi alterado.', 'err', { title:'Não foi possível salvar o prazo' });
        }
      } })
    ];
    if(dl) actions.unshift(h('button', { class:'linkbtn danger', type:'button', text:'excluir', onclick: async () => { close(); await deleteDeadline(dl.id); } }));
    return { title: dl ? 'Editar prazo' : 'Novo prazo', content, actions };
  }, { size:'wide' });
}

/** Mantido por compatibilidade com chamadas antigas. */
async function completeDeadline(id){ return setDeadlineStatus(id, 'completed'); }

/** Cartão "Próximos prazos" da tela Hoje. */
function upcomingDeadlinesCard(){
  const list = DeadlineEngine.open().filter(dl => {
    const n = DeadlineEngine.daysLeft(dl);
    return n !== null && n <= 30;
  });
  if(!list.length) return null;
  return h('div', { class:'card' },
    h('div', { class:'card-head' },
      h('p', { class:'card-title', style:'margin:0' }, 'Próximos prazos', helpDot('prazo')),
      h('button', { class:'linkbtn', type:'button', text:'ver todos', onclick:() => {
        setView('disciplines');
        setTimeout(() => { const el = $('#deadlines-section'); if(el) el.scrollIntoView({ block:'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }, 60);
      } })),
    h('div', { class:'dl-mini-list' }, list.slice(0, 4).map(dl => deadlineMiniRow(dl))),
    list.length > 4 ? h('p', { class:'hint', style:'margin-top:8px', text:`+ ${list.length - 4} prazo(s) nos próximos 30 dias.` }) : null);
}

/* =========================================================================
   TELA: ANÁLISES — v5.2
   Duas perguntas no topo (o que analisar? qual período?) e duas camadas:
   1) entender rápido: resumo, cartões principais, tópicos que merecem atenção;
   2) explorar: calendário, gráficos, prioridades, plano, conteúdo, revisões.
   ========================================================================= */
const ANALYTICS_PRESETS = [
  { v:'hoje',   label:'Hoje',            explain:'Só o dia de hoje.' },
  { v:'semana', label:'Esta semana',     explain:'A semana atual inteira, incluindo os dias que ainda vão chegar.' },
  { v:'7d',     label:'Últimos 7 dias',  explain:'Hoje e os 6 dias anteriores.' },
  { v:'mes',    label:'Este mês',        explain:'Do dia 1 ao último dia do mês atual.' },
  { v:'30d',    label:'Últimos 30 dias', explain:'Hoje e os 29 dias anteriores.' },
  { v:'tudo',   label:'Tudo',            explain:'Desde a primeira sessão registrada até hoje.' }
];
const CUSTOM_PERIOD_EXPLAIN = 'Você escolhe as datas: use os campos abaixo ou selecione um intervalo no calendário.';

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
      const first = parseISO(min) || t;
      return { start: first > t ? t : first, end:t };
    }
    default: return { start:startOfWeek(t), end:endOfWeek(t) };
  }
}
function periodPresetLabel(){
  const p = ANALYTICS_PRESETS.find(x => x.v === ui.periodPreset);
  return p ? p.label : 'Período personalizado';
}
function setAnalyticsPeriod(range, preset){
  const s = range.start <= range.end ? range.start : range.end;
  const e = range.start <= range.end ? range.end : range.start;
  ui.period = { start:s, end:e };
  ui.periodPreset = preset || null;
  ui.calSel = { start:null, end:null };
  ui.calMode = 'view';
  ui.calMonth = new Date(e.getFullYear(), e.getMonth(), 1);
}
function applyPreset(preset){
  setAnalyticsPeriod(presetRange(preset), preset);
  renderAnalytics();
}
function applyPresetSilently(preset){
  ui.periodPreset = preset;
  ui.period = presetRange(preset);
  ui.calMonth = new Date(ui.period.end.getFullYear(), ui.period.end.getMonth(), 1);
}

/** Troca o escopo e redesenha. `ids` pode trazer areaId / disciplineId / topicId. */
function setAnalyticsScope(type, ids){
  const s = Object.assign(defaultAnalyticsScope(), { type }, ids || {});
  ui.analyticsScope = s;
  if(s.areaId) ui.analyticsLast.areaId = s.areaId;
  if(s.disciplineId) ui.analyticsLast.disciplineId = s.disciplineId;
  if(s.topicId) ui.analyticsLast.topicId = s.topicId;
  if(ui.view !== 'analytics') setView('analytics');
  else renderAnalytics();
}
/** Atalho usado pelos detalhes: "Analisar só esta disciplina". */
function analyzeOnly(type, id){
  Drawer.close();
  const ids = type === 'area' ? { areaId:id } : type === 'discipline' ? { disciplineId:id } : { topicId:id };
  setAnalyticsScope(type, ids);
  focusAnalyticsTop();
  toast('Os números abaixo agora consideram só esta seleção.', 'info', { title:'Análise atualizada' });
}
function focusAnalyticsTop(){
  requestAnimationFrame(() => {
    const bar = $('#an-context');
    if(bar){ bar.scrollIntoView({ block:'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }
  });
}
function focusAnalyticsControls(){
  const box = $('#an-controls');
  if(!box) return;
  box.scrollIntoView({ block:'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  const first = box.querySelector('[aria-checked="true"], button, select');
  if(first) setTimeout(() => first.focus({ preventScroll:true }), prefersReducedMotion() ? 0 : 250);
  box.classList.remove('is-flash'); void box.offsetWidth; box.classList.add('is-flash');
}

/** Opções de escopo disponíveis agora (só aparecem quando fazem sentido). */
function scopeAvailability(){
  const discs = activeDisciplines();
  const areas = activeAreas();
  const loose = discs.some(d => !d.areaId || !getArea(d.areaId));
  const topics = state.topics.some(t => !t.archived && discs.some(d => d.id === t.disciplineId));
  return { area: areas.length > 0, loose, discipline: discs.length > 0, topic: topics };
}

/** Escolhe um bom padrão ao trocar o tipo de escopo: o último usado, senão o mais estudado no período. */
function defaultScopeId(type){
  const last = ui.analyticsLast || {};
  const minutesBy = new Map();
  const add = (k, m) => minutesBy.set(k, (minutesBy.get(k) || 0) + m);
  const sess = ui.period ? sessionsInRange(ui.period) : state.sessions;
  const pick = (ids, lastId) => {
    if(lastId && ids.includes(lastId)) return lastId;
    const best = ids.slice().sort((a,b) => (minutesBy.get(b) || 0) - (minutesBy.get(a) || 0))[0];
    return best || null;
  };
  if(type === 'area'){
    sess.forEach(s => { const d = getDiscipline(s.disciplineId); add(d && d.areaId && getArea(d.areaId) ? d.areaId : NO_AREA_ID, s.minutes || 0); });
    const ids = activeAreas().slice().sort(sortByName).map(a => a.id);
    if(scopeAvailability().loose) ids.push(NO_AREA_ID);
    return { areaId: pick(ids, last.areaId) };
  }
  if(type === 'discipline'){
    sess.forEach(s => add(s.disciplineId, s.minutes || 0));
    return { disciplineId: pick(activeDisciplines().slice().sort(sortByName).map(d => d.id), last.disciplineId) };
  }
  if(type === 'topic'){
    sess.forEach(s => { if(s.topicId) add(s.topicId, s.minutes || 0); });
    const ids = AnalyticsScope.topics({ type:'all' }).map(t => t.id);
    return { topicId: pick(ids, last.topicId) };
  }
  return {};
}

function renderAnalytics(){
  const root = $('#analytics-body');
  if(!root) return;
  if(!ui.period) applyPresetSilently(state.settings.defaultPeriod || 'semana');
  let a = AnalyticsEngine.build(ui.period, ui.analyticsScope);
  if(a.scope.fellBack){
    ui.analyticsScope = defaultAnalyticsScope();
    a = AnalyticsEngine.build(ui.period, ui.analyticsScope);
    toast('O item que estava sendo analisado não existe mais. Mostrando todos os estudos.', 'info', { title:'Análise ajustada' });
  }
  const parts = [];
  parts.push(analyticsContextBar(a));

  if(!state.sessions.length){
    parts.push(card(null, emptyState('Nada para analisar ainda',
      'Registre sua primeira sessão e as análises aparecem aqui: quanto você estudou, o que recebeu mais tempo, como estão as revisões e os prazos.',
      h('button', { class:'btn primary', type:'button', text:'Registrar sessão', onclick:() => openRegisterModal() }))));
    const dl = a.deadlines.open.length ? analyticsDeadlinesCard(a) : null;
    if(dl) parts.push(dl);
    mount(root, parts);
    return;
  }

  parts.push(analyticsControlsCard(a));

  /* ---------- camada 1: entender rápido ---------- */
  parts.push(h('h2', { class:'an-layer', id:'an-layer-1' }, h('span', { text:'Entenda rápido' }),
    h('span', { class:'an-layer-sub', text:'O essencial do período. Clique em um cartão para ver os detalhes.' })));
  parts.push(analyticsSummaryCard(a));
  parts.push(analyticsMetricCards(a));
  const quick = [];
  if(AnalyticsScope.topics(a.scope).length) quick.push(analyticsAttentionCard(a));
  if(a.deadlines.all.length) quick.push(analyticsDeadlinesCard(a));
  if(quick.length) parts.push(h('div', { class:'an-grid an-grid-2' }, quick));

  /* ---------- camada 2: explorar ---------- */
  parts.push(h('h2', { class:'an-layer', id:'an-layer-2' }, h('span', { text:'Explore os detalhes' }),
    h('span', { class:'an-layer-sub', text:'Calendário, gráficos e comparações para ir mais fundo.' })));
  parts.push(h('div', { class:'an-grid an-grid-2 an-cal-row' }, analyticsCalendarCard(a), analyticsTimeCard(a)));

  const grid = [];
  grid.push(analyticsDistributionCard(a));
  const prio = analyticsPriorityCard(a);
  if(prio) grid.push(prio);
  if(a.planAdherence.hasPlan && a.planAdherence.perDiscipline.length) grid.push(analyticsPlanCard(a));
  if(a.content.totalTopics > 0) grid.push(analyticsContentCard(a));
  if(a.reviews.expected > 0 || a.reviews.completed > 0 || a.reviews.overdueNow > 0) grid.push(analyticsReviewsCard(a));
  grid.push(analyticsDifficultyCard(a));
  grid.push(analyticsTypesCard(a));
  if(a.scope.type !== 'topic') grid.push(weeklyReportCard(a.scope));
  grid.push(analyticsProjectionCard(a));
  parts.push(h('div', { class:'an-grid' }, grid));

  parts.push(analyticsInsightsCard(a));
  parts.push(analyticsExportCard(a));

  mount(root, parts);
  if(ui.calRefocus){
    const el = root.querySelector(`.cal-day[data-date="${ui.calRefocus}"]`);
    ui.calRefocus = null;
    if(el) el.focus({ preventScroll:true });
  }
}

/* ---------- topo: contexto e controles ---------- */
function analyticsContextBar(a){
  const kind = AnalyticsScope.kindLabel(a.scope);
  return h('div', { class:'an-context', id:'an-context', role:'status', 'aria-live':'polite' },
    h('span', { class:'an-context-k', text:'Analisando' }),
    h('span', { class:'an-context-v' },
      a.scope.type === 'all' ? null : h('span', { class:'an-context-kind', text: kind }),
      h('strong', { class:'an-context-path', text: AnalyticsScope.pathText(a.scope) }),
      h('span', { class:'an-context-sep', 'aria-hidden':'true', text:'·' }),
      h('span', { class:'an-context-period', text: `${periodPresetLabel()} — ${fmtRangeLabel(ui.period)}` })),
    state.sessions.length ? h('button', { class:'btn ghost sm', type:'button', text:'Alterar',
      'aria-label':'Alterar o que está sendo analisado ou o período', onclick:() => focusAnalyticsControls() }) : null);
}

function analyticsControlsCard(a){
  const av = scopeAvailability();
  const opts = [
    { v:'all', label:'Tudo', show:true },
    { v:'area', label:'Uma Área de Estudo', show: av.area },
    { v:'discipline', label:'Uma disciplina', show: av.discipline },
    { v:'topic', label:'Um tópico', show: av.topic }
  ].filter(o => o.show);

  const scopeGroup = h('div', { class:'chips an-choice', role:'radiogroup', 'aria-labelledby':'an-q-scope' });
  opts.forEach(o => {
    const on = a.scope.type === o.v;
    scopeGroup.append(h('button', { class:'chip', type:'button', role:'radio', 'aria-checked': on ? 'true' : 'false',
      tabindex: on ? '0' : '-1', text:o.label, dataset:{ v:o.v },
      onclick:() => { if(o.v === a.scope.type) return; setAnalyticsScope(o.v, defaultScopeId(o.v)); } }));
  });
  radioKeys(scopeGroup);

  let picker = null;
  if(a.scope.type === 'area'){
    const sel = h('select', { id:'an-scope-area', onchange:(e) => setAnalyticsScope('area', { areaId:e.target.value }) });
    activeAreas().slice().sort(sortByName).forEach(ar => sel.append(h('option', { value:ar.id, selected: ar.id === a.scope.areaId }, ar.name)));
    if(av.loose || a.scope.areaId === NO_AREA_ID) sel.append(h('option', { value:NO_AREA_ID, selected: a.scope.areaId === NO_AREA_ID }, `${NO_AREA_LABEL} (ainda não organizadas)`));
    picker = h('div', { class:'field tight an-picker' }, h('label', { for:'an-scope-area', text:'Qual Área de Estudo?' }), sel);
  } else if(a.scope.type === 'discipline'){
    const sel = h('select', { id:'an-scope-disc', onchange:(e) => setAnalyticsScope('discipline', { disciplineId:e.target.value }) });
    disciplineGroupsForSelect(a.scope.disciplineId).forEach(g => {
      const og = h('optgroup', { label:g.label });
      g.items.forEach(d => og.append(h('option', { value:d.id, selected: d.id === a.scope.disciplineId }, d.name + (d.archived ? ' (arquivada)' : ''))));
      sel.append(og);
    });
    picker = h('div', { class:'field tight an-picker' }, h('label', { for:'an-scope-disc', text:'Qual disciplina?' }), sel);
  } else if(a.scope.type === 'topic'){
    const sel = h('select', { id:'an-scope-topic', onchange:(e) => setAnalyticsScope('topic', { topicId:e.target.value }) });
    disciplineGroupsForSelect(a.scope.disciplineId).forEach(g => g.items.forEach(d => {
      const tps = topicsOf(d.id).slice();
      const cur = a.scope.topicId && getTopic(a.scope.topicId);
      if(cur && cur.disciplineId === d.id && !tps.includes(cur)) tps.push(cur);
      if(!tps.length) return;
      const og = h('optgroup', { label: g.label === NO_AREA_LABEL || g.single ? d.name : `${g.label} › ${d.name}` });
      tps.forEach(t => og.append(h('option', { value:t.id, selected: t.id === a.scope.topicId }, `${d.name} › ${t.name}`)));
      sel.append(og);
    }));
    picker = h('div', { class:'field tight an-picker' }, h('label', { for:'an-scope-topic', text:'Qual tópico?' }), sel);
  }

  const scopeHint = {
    all:'Todas as disciplinas e tópicos, inclusive os ainda não organizados em Áreas.',
    area:'Todas as disciplinas desta Área de Estudo e os tópicos delas.',
    discipline:'Só esta disciplina e os tópicos dela.',
    topic:'Só este tópico. Prazos da disciplina inteira também aparecem, identificados.'
  }[a.scope.type];

  /* período */
  const periodGroup = h('div', { class:'chips an-choice', role:'radiogroup', 'aria-labelledby':'an-q-period' });
  ANALYTICS_PRESETS.forEach(p => {
    const on = ui.periodPreset === p.v;
    periodGroup.append(h('button', { class:'chip', type:'button', role:'radio', 'aria-checked': on ? 'true':'false',
      tabindex: on ? '0' : '-1', text:p.label, onclick:() => applyPreset(p.v) }));
  });
  const customOn = !ui.periodPreset;
  periodGroup.append(h('button', { class:'chip', type:'button', role:'radio', 'aria-checked': customOn ? 'true':'false',
    tabindex: customOn ? '0' : '-1', text:'Personalizado',
    onclick:() => { if(ui.periodPreset){ ui.periodPreset = null; renderAnalytics(); const el = $('#per-start'); if(el) el.focus(); } } }));
  if(!periodGroup.querySelector('[tabindex="0"]')) periodGroup.firstChild.setAttribute('tabindex', '0');
  radioKeys(periodGroup);

  const preset = ANALYTICS_PRESETS.find(x => x.v === ui.periodPreset);
  const explain = h('p', { class:'hint an-explain' },
    h('strong', { text: fmtRangeLabel(ui.period) }),
    ` · ${plural(rangeDays(ui.period), 'dia', 'dias')}. ${preset ? preset.explain : CUSTOM_PERIOD_EXPLAIN}`);

  let custom = null;
  if(customOn){
    const startIn = h('input', { type:'date', id:'per-start', value: dateToISO(ui.period.start) });
    const endIn = h('input', { type:'date', id:'per-end', value: dateToISO(ui.period.end) });
    const apply = () => {
      const s = parseISO(startIn.value), e = parseISO(endIn.value);
      if(!s || !e){ toast('Preencha a data inicial e a data final.', 'warn', { title:'Faltam datas' }); return; }
      if(rangeDays({ start: s < e ? s : e, end: s < e ? e : s }) > 3660){ toast('Escolha um intervalo de até 10 anos.', 'warn'); return; }
      setAnalyticsPeriod({ start:s, end:e }, null);
      renderAnalytics();
      if(s > e) toast('As datas estavam invertidas e foram colocadas em ordem.', 'info');
    };
    [startIn, endIn].forEach(i => i.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); apply(); } }));
    custom = h('div', { class:'row auto an-custom' },
      h('div', { class:'field tight' }, h('label', { for:'per-start', text:'Data inicial' }), startIn),
      h('div', { class:'field tight' }, h('label', { for:'per-end', text:'Data final' }), endIn),
      h('button', { class:'btn sm', type:'button', text:'Aplicar datas', onclick: apply }));
  }

  return h('div', { class:'card an-controls', id:'an-controls' },
    h('div', { class:'an-q' },
      h('p', { class:'an-q-title', id:'an-q-scope' }, h('span', { class:'an-q-n', 'aria-hidden':'true', text:'1' }), 'O que você quer analisar?', helpDot('escopo')),
      scopeGroup, picker, h('p', { class:'hint an-explain', text: scopeHint })),
    h('div', { class:'an-q' },
      h('p', { class:'an-q-title', id:'an-q-period' }, h('span', { class:'an-q-n', 'aria-hidden':'true', text:'2' }), 'Qual período?', helpDot('periodo')),
      periodGroup, explain, custom));
}

/** Setas movem a seleção em grupos de rádio feitos com botões (padrão ARIA). */
function radioKeys(group){
  group.addEventListener('keydown', (e) => {
    const items = $$('[role="radio"]', group);
    const i = items.indexOf(document.activeElement);
    if(i < 0) return;
    let n = null;
    if(e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % items.length;
    else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + items.length) % items.length;
    else if(e.key === 'Home') n = 0;
    else if(e.key === 'End') n = items.length - 1;
    if(n === null) return;
    e.preventDefault();
    items.forEach((it, k) => it.setAttribute('tabindex', k === n ? '0' : '-1'));
    items[n].focus();
  });
}

/** Disciplinas agrupadas por Área de Estudo, para selects. */
function disciplineGroupsForSelect(includeId){
  const list = activeDisciplines().slice();
  const extra = includeId ? getDiscipline(includeId) : null;
  if(extra && !list.includes(extra)) list.push(extra);
  const groups = [];
  activeAreas().slice().sort(sortByName).forEach(ar => {
    const items = list.filter(d => d.areaId === ar.id).sort(sortByName);
    if(items.length) groups.push({ label: ar.name, items });
  });
  const loose = list.filter(d => !d.areaId || !getArea(d.areaId) || getArea(d.areaId).archived).sort(sortByName);
  if(loose.length) groups.push({ label: NO_AREA_LABEL, items: loose });
  if(groups.length === 1) groups[0].single = true;
  return groups;
}

/* ---------- camada 1 ---------- */
function analyticsSummaryCard(a){
  return h('div', { class:'card an-summary' },
    h('div', { class:'card-head' },
      h('p', { class:'card-title', style:'margin:0', text:'Seu período em resumo' }),
      h('button', { class:'linkbtn', type:'button', text:'Copiar resumo', onclick:() => copySummary(a) })),
    h('ul', { class:'an-summary-list' }, a.summary.map(s => h('li', { text:s }))));
}

function metricCard(o){
  const val = String(o.value);
  const prev = UiMemory.stats.get('an:' + o.key);
  UiMemory.stats.set('an:' + o.key, val);
  const changed = prev !== undefined && prev !== val && !prefersReducedMotion();
  return h('button', { class:'an-metric' + (o.muted ? ' is-muted' : ''), type:'button', dataset:{ metric:o.key },
      'aria-label': `${o.label}: ${val}${o.sub ? '. ' + o.sub : ''}. Ver detalhes`, onclick: o.onOpen },
    h('span', { class:'an-metric-l', text:o.label }),
    h('span', { class:'an-metric-v' + (changed ? ' is-updated' : '') + (/\d/.test(val) ? '' : ' is-text'), text:val }),
    o.sub ? h('span', { class:'an-metric-s', text:o.sub }) : null,
    o.delta ? h('span', { class:'an-metric-d ' + o.delta.dir, text:o.delta.text }) : null,
    h('span', { class:'an-metric-go', 'aria-hidden':'true', text:'Ver detalhes ›' }));
}

function analyticsMetricCards(a){
  const t = a.totals, cmp = a.previousComparison;
  const delta = v => (cmp.available && isNum(v)) ? { text:`${v >= 0 ? '↑' : '↓'} ${fmtNumber(Math.abs(v), 0)}% vs. período anterior`, dir: v >= 0 ? 'up' : 'down' } : null;
  const cards = [];
  cards.push(metricCard({ key:'time', label:'Tempo estudado', value: fmtDuration(t.minutes),
    sub: t.count ? `${fmtDuration(t.avgPerActiveDay)} por dia de estudo` : 'nenhum registro no período',
    delta: delta(cmp.minutesDelta), onOpen:() => openAnalyticsDrawer('time', a) }));
  cards.push(metricCard({ key:'sessions', label:'Sessões', value: String(t.count),
    sub: `${t.activeDays} de ${plural(a.days, 'dia', 'dias')} com estudo`,
    delta: delta(cmp.sessionsDelta), onOpen:() => openAnalyticsDrawer('sessions', a) }));
  const pa = a.planAdherence;
  cards.push(metricCard({ key:'plan', label: METRIC_WORDS.adherence.title,
    value: pa.hasPlan ? safePct(pa.pct) : '—',
    sub: pa.hasPlan ? `${fmtDuration(pa.realized)} de ${fmtDuration(pa.planned)}`
       : !pa.applicable ? 'o plano semanal é por disciplina' : 'sem plano para este período',
    muted: !pa.hasPlan, onOpen:() => openAnalyticsDrawer('plan', a) }));
  const r = a.reviews;
  cards.push(metricCard({ key:'reviews', label:'Revisões concluídas', value: String(r.completed),
    sub: r.overdueNow ? `${plural(r.overdueNow, 'atrasada', 'atrasadas')} agora` : (r.scheduledCount ? 'nenhuma atrasada agora' : 'nenhum tópico em revisão'),
    onOpen:() => openAnalyticsDrawer('reviews', a) }));
  const c = a.content;
  if(a.scope.type === 'topic'){
    const tp = getTopic(a.scope.topicId);
    const st = tp ? topicStatus(tp) : 'nao_iniciado';
    cards.push(metricCard({ key:'content', label:'Situação do tópico', value: TOPIC_STATUS_LABEL[st],
      sub: tp && tp.masteryLevel ? `domínio ${tp.masteryLevel}/5` : 'domínio ainda não avaliado',
      onOpen:() => openAnalyticsDrawer('content', a) }));
  } else {
    cards.push(metricCard({ key:'content', label: METRIC_WORDS.coverage.title,
      value: c.totalTopics ? `${c.covered} de ${c.totalTopics}` : '—',
      sub: c.totalTopics ? `${safePct(c.coverage)} dos tópicos · ${c.mastered} ${c.mastered === 1 ? 'consolidado' : 'consolidados'}` : 'nenhum tópico cadastrado',
      muted: !c.totalTopics, onOpen:() => openAnalyticsDrawer('content', a) }));
  }
  return h('div', { class:'an-metrics', role:'group', 'aria-label':'Números principais do período' }, cards);
}

function openTopicFromAnalytics(t){
  if(isDesktopUI()) openTopicDrawer(t.id);
  else { Drawer.close(); openTopicModal(t.disciplineId, t, { returnTo:false }); }
}

function analyticsAttentionCard(a){
  const c = h('div', { class:'card an-attention' },
    h('p', { class:'card-title' }, 'Tópicos que merecem atenção', helpDot('atencao')));
  if(!a.attention.length){
    c.append(h('p', { class:'hint', text:'Nenhum tópico pede atenção especial agora: sem revisões atrasadas, esquecimentos repetidos ou prazos próximos.' }));
    return c;
  }
  c.append(h('p', { class:'hint', style:'margin-bottom:8px', text:'Revisões atrasadas, esquecimentos, domínio baixo e prazos próximos. A prioridade ajuda a ordenar.' }));
  const list = h('ul', { class:'an-att-list' });
  a.attention.forEach(x => {
    list.append(h('li', null, h('button', { class:'an-att', type:'button', onclick:() => openTopicFromAnalytics(x.topic) },
      h('span', { class:'an-att-main' },
        h('span', { class:'an-att-name', text:x.topic.name }),
        h('span', { class:'an-att-path', text: x.discipline ? x.discipline.name : '' }),
        h('span', { class:'an-att-why', text: capFirst(x.reasons.join(' · ')) })),
      priorityChip(x.priority, { compact:true }))));
  });
  c.append(list);
  if(a.reviews.dueToday) c.append(h('div', { class:'row auto', style:'margin-top:10px' },
    h('button', { class:'btn sm', type:'button', text:'Abrir revisões', onclick:() => setView('reviews') })));
  return c;
}

function analyticsDeadlinesCard(a){
  const d = a.deadlines;
  const c = h('div', { class:'card an-deadlines' },
    h('div', { class:'card-head' },
      h('p', { class:'card-title', style:'margin:0' }, 'Prazos', helpDot('prazo')),
      h('button', { class:'linkbtn', type:'button', text:'+ Adicionar prazo',
        onclick:() => openDeadlineModal(null, { disciplineId: a.scope.disciplineId || null, topicId: a.scope.topicId || null }) })));
  const shown = d.overdue.concat(d.upcoming).slice(0, 5);
  if(!shown.length){
    c.append(h('p', { class:'hint', text: d.completedInRange.length
      ? `Nenhum prazo em aberto. ${plural(d.completedInRange.length, 'prazo foi concluído', 'prazos foram concluídos')} neste período.`
      : 'Nenhum prazo em aberto aqui.' }));
    return c;
  }
  const box = h('div', { class:'dl-mini-list' });
  shown.forEach(x => {
    const row = deadlineMiniRow(x.dl);
    if(x.relation === 'discipline') row.append(h('span', { class:'an-tag', text:'da disciplina' }));
    box.append(row);
  });
  c.append(box);
  if(d.completedInRange.length) c.append(h('p', { class:'hint', style:'margin-top:8px',
    text:`${plural(d.completedInRange.length, 'prazo concluído', 'prazos concluídos')} neste período.` }));
  return c;
}

/* ---------- detalhes (drawers) ---------- */
function drawerIntro(text){ return h('p', { class:'drawer-intro', text }); }
function drawerSection(title, ...children){
  return h('section', { class:'dr-section' }, h('h3', { class:'section-label', text:title }), children);
}
function hbarRow(label, pct, valueText, color, onClick){
  const bar = h('div', { class:'hbar' }, h('span', { style:`width:${clamp(isNum(pct) ? pct : 0, 0, 100)}%${color ? ';background:' + color : ''}` }));
  if(onClick){
    return h('button', { class:'hbar-row is-action', type:'button', onclick:onClick, 'aria-label': `${label}: ${valueText}` },
      h('span', { class:'hl', text:label }), bar, h('span', { class:'hv', text:valueText }));
  }
  return h('div', { class:'hbar-row' }, h('span', { class:'hl', text:label }), bar, h('span', { class:'hv', text:valueText }));
}
function scopeWords(a){ return a.scope.type === 'all' ? 'em todos os estudos' : `em ${a.scope.label}`; }

/** Linhas de tempo "um nível abaixo" do escopo, com atalho para analisar só aquele item. */
function breakdownRows(a){
  const sc = a.scope;
  if(sc.type === 'all'){
    return { title:'Por disciplina', rows: a.byDiscipline.map(x => ({ ...x, go: getDiscipline(x.key) ? () => analyzeOnly('discipline', x.key) : null })) };
  }
  if(sc.type === 'area'){
    return { title:'Por disciplina', rows: a.byDiscipline.map(x => ({ ...x, go: getDiscipline(x.key) ? () => analyzeOnly('discipline', x.key) : null })) };
  }
  if(sc.type === 'discipline'){
    return { title:'Por tópico', rows: a.byTopic.map(x => ({ ...x, go: getTopic(x.key) ? () => analyzeOnly('topic', x.key) : null })) };
  }
  return { title:'Por tipo de sessão', rows: a.byType.filter(x => x.count > 0).map(x => ({ key:x.key, label:x.label, minutes:x.minutes, count:x.count,
    pct: a.totals.minutes > 0 ? x.minutes / a.totals.minutes * 100 : 0 })) };
}

function openAnalyticsDrawer(kind, a){
  const body = h('div', { class:'an-drawer' });
  const ctx = h('p', { class:'an-drawer-ctx', text: `${AnalyticsScope.pathText(a.scope)} · ${fmtRangeLabel(a.range)}` });
  body.append(ctx);
  let title = '';
  const t = a.totals;

  if(kind === 'time'){
    title = 'Tempo estudado';
    body.append(drawerIntro(`Soma dos minutos de todas as sessões registradas ${scopeWords(a)} no período.`));
    body.append(h('div', { class:'stat-grid compact' },
      statBox(fmtDuration(t.minutes), 'total'),
      statBox(fmtDuration(t.avgPerDay), 'média por dia do período'),
      statBox(fmtDuration(t.avgPerActiveDay), 'média por dia com estudo'),
      statBox(fmtDuration(t.avgSession), 'duração média da sessão'),
      statBox(fmtNumber(t.credits), 'créditos')));
    const cmp = a.previousComparison;
    body.append(h('p', { class:'hint', style:'margin-top:10px', text: cmp.available
      ? `Período anterior equivalente (${fmtRangeLabel(cmp.prevRange)}): ${fmtDuration(cmp.prev.minutes)}.`
      : 'Não há registros no período anterior equivalente para comparar.' }));
    const bd = breakdownRows(a);
    if(bd.rows.length){
      const max = Math.max(1, ...bd.rows.map(x => x.minutes));
      body.append(drawerSection(bd.title, bd.rows.slice(0, 12).map(x =>
        hbarRow(x.label, x.minutes / max * 100, `${fmtDuration(x.minutes)} · ${safePct(x.pct)}`, null, x.go))));
      if(bd.rows.some(x => x.go)) body.append(h('p', { class:'hint', text:'Clique em uma linha para analisar só aquele item.' }));
    }
    if(t.count){
      const maxW = Math.max(1, ...a.byWeekday.map(x => x.minutes));
      body.append(drawerSection('Por dia da semana', a.byWeekday.map(x =>
        hbarRow(x.label, x.minutes / maxW * 100, fmtDuration(x.minutes)))));
    }
  }

  else if(kind === 'sessions'){
    title = 'Sessões';
    body.append(drawerIntro(`Cada registro de estudo é uma sessão. Aqui estão as sessões ${scopeWords(a)} no período.`));
    body.append(h('div', { class:'stat-grid compact' },
      statBox(String(t.count), 'sessões'),
      statBox(`${t.activeDays}/${a.days}`, 'dias com estudo'),
      statBox(fmtDuration(t.avgSession), 'duração média'),
      statBox(a.difficulty.avg !== null ? fmtNumber(a.difficulty.avg, 1) + '/5' : '—', 'dificuldade média')));
    const list = a.sessions.slice().sort((x,y) => y.date.localeCompare(x.date) || str(y.createdAt).localeCompare(str(x.createdAt)));
    if(!list.length) body.append(h('p', { class:'hint', style:'margin-top:12px', text:'Nenhuma sessão neste período.' }));
    else {
      const ul = h('ul', { class:'an-sess-list' });
      list.slice(0, 40).forEach(s => {
        const topic = topicLabelOf(s);
        ul.append(h('li', null, h('button', { class:'an-sess', type:'button', 'aria-label':`Editar sessão de ${fmtDateBR(s.date)}`,
            onclick:() => { Drawer.close(); openEditSessionModal(s.id); } },
          h('span', { class:'an-sess-date', text: fmtDateBR(s.date) }),
          h('span', { class:'an-sess-main' },
            h('span', { class:'an-sess-title', text: disciplineName(s.disciplineId) + (topic ? ' › ' + topic : '') }),
            h('span', { class:'an-sess-sub', text: [sessionTypeLabel(s.type), s.reviewOutcome ? reviewOutcomeLabel(s.reviewOutcome) : null].filter(Boolean).join(' · ') })),
          h('span', { class:'an-sess-min', text: fmtDuration(s.minutes) }))));
      });
      body.append(drawerSection(list.length > 40 ? `As 40 mais recentes de ${list.length}` : 'Lista', ul));
      if(list.length > 40) body.append(h('button', { class:'linkbtn', type:'button', text:'Ver todas no Histórico',
        onclick:() => { Drawer.close(); ui.history.period = 'analises'; setView('history'); } }));
      const maxT = Math.max(1, ...a.byType.map(x => x.count));
      body.append(drawerSection('Tipos de sessão', a.byType.filter(x => x.count > 0).map(x =>
        hbarRow(x.label, x.count / maxT * 100, `${x.count} · ${safePct(x.pct)}`))));
    }
  }

  else if(kind === 'plan'){
    title = METRIC_WORDS.adherence.title;
    const pa = a.planAdherence;
    body.append(drawerIntro('Quanto do tempo planejado para a semana foi realmente estudado. Também chamado de aderência ao plano. Cada semana é comparada com o plano que existia naquela semana.'));
    if(!pa.applicable){
      body.append(h('p', { class:'influence-note', text:'O plano semanal distribui tempo entre disciplinas, não entre tópicos. Para ver o plano cumprido, analise a disciplina deste tópico.' }));
      if(a.scope.disciplineId) body.append(h('button', { class:'btn sm', type:'button', text:'Analisar a disciplina', onclick:() => analyzeOnly('discipline', a.scope.disciplineId) }));
    } else if(!pa.hasPlan){
      body.append(h('p', { class:'influence-note', text:'Não havia tempo planejado para este período (ou para esta seleção). O plano é opcional: as análises de tempo continuam funcionando sem ele.' }));
      body.append(h('button', { class:'btn sm', type:'button', text:'Abrir Planejamento', onclick:() => { Drawer.close(); setView('plan'); } }));
    } else {
      body.append(h('div', { class:'stat-grid compact' },
        statBox(safePct(pa.pct), 'plano cumprido'),
        statBox(fmtDuration(pa.planned), 'planejado'),
        statBox(fmtDuration(pa.realized), 'realizado')));
      body.append(drawerSection('Por disciplina', pa.perDiscipline.filter(x => x.planned > 0 || x.realized > 0).map(x =>
        hbarRow(x.label, x.pct === null ? 0 : x.pct,
          x.pct === null ? `${fmtDuration(x.realized)} (sem plano)` : `${fmtDuration(x.realized)} de ${fmtDuration(x.planned)} · ${safePct(x.pct)}`,
          x.pct === null ? null : x.pct >= 100 ? 'var(--teal)' : x.pct < 60 ? 'var(--danger)' : 'var(--brass)',
          a.scope.type !== 'discipline' && getDiscipline(x.disciplineId) ? () => analyzeOnly('discipline', x.disciplineId) : null))));
      const weeks = pa.weeks.filter(w => w.planned > 0 || w.realized > 0);
      if(weeks.length > 1) body.append(drawerSection('Por semana', weeks.map(w =>
        hbarRow(`Semana ${w.weekNumber}${w.coveredDays < 7 ? ` (${w.coveredDays} ${w.coveredDays === 1 ? 'dia' : 'dias'})` : ''}`,
          w.pct === null ? 0 : w.pct, w.pct === null ? `${fmtDuration(w.realized)} (sem plano)` : `${safePct(w.pct)}`))));
      body.append(h('p', { class:'hint', style:'margin-top:8px', text:'Em semanas cortadas pelo período, o tempo planejado é proporcional aos dias incluídos.' }));
    }
  }

  else if(kind === 'reviews'){
    title = 'Revisões';
    const r = a.reviews;
    body.append(drawerIntro('Revisões concluídas no período, revisões que venciam no período e a situação de agora. Revisar faz o conteúdo voltar à memória antes de ser esquecido.'));
    body.append(h('div', { class:'stat-grid compact' },
      statBox(String(r.completed), 'concluídas'),
      statBox(String(r.scheduled), 'ainda previstas no período'),
      statBox(String(r.overdueNow), 'atrasadas agora'),
      statBox(String(r.upcoming.length), 'nos próximos 7 dias')));
    if(r.completed){
      const mx = Math.max(1, ...r.outcomes.map(o => o.count));
      body.append(drawerSection('Como foram', r.outcomes.map(o => hbarRow(o.label, o.count / mx * 100, String(o.count)))));
    }
    if(r.byMethod.length){
      const mm = Math.max(1, ...r.byMethod.map(x => x.used));
      body.append(drawerSection('Métodos usados', r.byMethod.map(x => hbarRow(x.label, x.used / mm * 100, `${x.used}×`))));
    }
    if(r.dueList.length){
      body.append(drawerSection('Para revisar agora', h('ul', { class:'an-att-list' }, r.dueList.slice(0, 12).map(tp =>
        h('li', null, h('button', { class:'an-att', type:'button', onclick:() => openTopicFromAnalytics(tp) },
          h('span', { class:'an-att-main' },
            h('span', { class:'an-att-name', text:tp.name }),
            h('span', { class:'an-att-why', text: `${disciplineName(tp.disciplineId)} · ${(daysUntilISO(tp.reviewDueDate) || 0) < 0 ? 'atrasada há ' + plural(-daysUntilISO(tp.reviewDueDate), 'dia', 'dias') : 'para hoje'}` })),
          priorityChip(tp.priority, { compact:true })))))));
    }
    if(r.forgetful.length){
      body.append(drawerSection('Esquecidos com mais frequência', r.forgetful.map(tp =>
        hbarRow(tp.name, clamp((tp.reviewFailures / 5) * 100, 10, 100), `${tp.reviewFailures}×`, 'var(--danger)', () => openTopicFromAnalytics(tp)))));
    }
    if(r.avgMastery !== null) body.append(h('p', { class:'hint', style:'margin-top:10px', text:`Domínio médio dos tópicos em revisão: ${fmtNumber(r.avgMastery, 1)}/5.` }));
    body.append(h('div', { class:'row auto', style:'margin-top:14px' },
      h('button', { class:'btn sm', type:'button', text:'Abrir revisões', onclick:() => { Drawer.close(); setView('reviews'); } })));
  }

  else if(kind === 'content'){
    const c = a.content;
    if(a.scope.type === 'topic'){
      const tp = getTopic(a.scope.topicId);
      title = 'Situação do tópico';
      body.append(drawerIntro('Como este tópico está agora, independentemente do período escolhido.'));
      if(tp){
        const sess = sessionsOfTopic(tp.id);
        const dl = h('dl', { class:'kv-list' });
        const kv = (k, v) => dl.append(h('div', null, h('dt', { text:k }), h('dd', { text:v })));
        kv('Situação', TOPIC_STATUS_LABEL[topicStatus(tp)]);
        kv('Prioridade', PriorityEngine.text(tp.priority));
        kv('Domínio', tp.masteryLevel ? `${tp.masteryLevel}/5` : 'ainda não avaliado');
        kv('Revisões', tp.reviewEnabled ? (tp.reviewDueDate ? `próxima em ${fmtDateBR(tp.reviewDueDate)}` : 'ativadas, começam depois do primeiro estudo') : 'desativadas');
        kv('Sessões (total)', `${sess.length} · ${fmtDuration(sum(sess, s => s.minutes || 0))}`);
        kv('Vezes esquecido', String(tp.reviewFailures || 0));
        body.append(dl);
        body.append(h('div', { class:'row auto', style:'margin-top:14px' },
          h('button', { class:'btn sm', type:'button', text:'Abrir tópico', onclick:() => openTopicFromAnalytics(tp) })));
      }
    } else {
      title = METRIC_WORDS.coverage.title;
      body.append(drawerIntro('Conteúdo estudado = tópicos que você já começou (também chamado de cobertura). Consolidado = tópicos que passaram por revisões com bom resultado (também chamado de domínio). Mostra a situação de agora, não só do período.'));
      if(!c.totalTopics){
        body.append(h('p', { class:'influence-note', text:'Ainda não há tópicos cadastrados aqui. Tópicos são as partes de uma disciplina, como "Derivadas" em Matemática.' }));
      } else {
        body.append(h('div', { class:'stat-grid compact' },
          statBox(`${c.covered}/${c.totalTopics}`, 'estudados'),
          statBox(safePct(c.coverage), 'do conteúdo'),
          statBox(String(c.mastered), 'consolidados')));
        const mx = Math.max(1, ...c.byStatus.map(x => x.count));
        body.append(drawerSection('Situação dos tópicos', c.byStatus.map(x => hbarRow(x.label, x.count / mx * 100, String(x.count)))));
        if(c.perDiscipline.length > 1 || a.scope.type !== 'discipline'){
          body.append(drawerSection('Por disciplina', c.perDiscipline.slice().sort((x,y) => (y.coverage || 0) - (x.coverage || 0)).map(x =>
            hbarRow(x.discipline.name, x.coverage, `${x.covered}/${x.total} · ${safePct(x.coverage)}`, null,
              a.scope.type !== 'discipline' ? () => analyzeOnly('discipline', x.discipline.id) : null))));
        }
        if(c.weakest.length) body.append(drawerSection('Menor domínio', c.weakest.map(tp =>
          hbarRow(tp.name, tp.masteryLevel / 5 * 100, `${tp.masteryLevel}/5`, tp.masteryLevel <= 2 ? 'var(--danger)' : 'var(--brass)', () => openTopicFromAnalytics(tp)))));
        const ns = c.notStarted.slice(0, 8);
        if(ns.length) body.append(drawerSection('Ainda não iniciados', h('ul', { class:'an-att-list' }, ns.map(tp =>
          h('li', null, h('button', { class:'an-att', type:'button', onclick:() => openTopicFromAnalytics(tp) },
            h('span', { class:'an-att-main' }, h('span', { class:'an-att-name', text:tp.name }), h('span', { class:'an-att-path', text:disciplineName(tp.disciplineId) })),
            priorityChip(tp.priority, { compact:true })))))));
      }
    }
  }

  Drawer.open(title, body);
}

/* ---------- camada 2: calendário ---------- */
function analyticsCalendarCard(a){
  const inSelect = ui.calMode === 'select';
  const head = h('div', { class:'card-head' },
    h('p', { class:'card-title', style:'margin:0' }, 'Calendário', helpDot('calendario')),
    inSelect
      ? h('button', { class:'btn ghost sm', type:'button', text:'Cancelar seleção', onclick:() => { ui.calMode = 'view'; ui.calSel = { start:null, end:null }; renderAnalytics(); } })
      : h('button', { class:'btn ghost sm', type:'button', text:'Selecionar intervalo',
          onclick:() => { ui.calMode = 'select'; ui.calSel = { start:null, end:null }; renderAnalytics(); const g = $('.cal-grid [tabindex="0"]'); if(g) g.focus(); } }));
  const c = h('div', { class:'card an-cal' + (inSelect ? ' is-selecting' : '') }, head);
  if(inSelect){
    const sel = ui.calSel || {};
    let msg, actions = null;
    if(!sel.start) msg = 'Clique no primeiro dia do intervalo.';
    else if(!sel.end) msg = `Início: ${fmtDateBR(sel.start)}. Agora clique no último dia.`;
    else {
      const r = { start: parseISO(sel.start), end: parseISO(sel.end) };
      msg = `${fmtRangeLabel(r)} · ${plural(rangeDays(r), 'dia', 'dias')}`;
      actions = h('div', { class:'row auto' },
        h('button', { class:'btn primary sm', type:'button', text:'Analisar este período', onclick:() => {
          setAnalyticsPeriod(r, null); renderAnalytics(); focusAnalyticsTop();
          toast(fmtRangeLabel(r), 'ok', { title:'Período aplicado' });
        } }),
        h('button', { class:'btn ghost sm', type:'button', text:'Cancelar', onclick:() => { ui.calMode = 'view'; ui.calSel = { start:null, end:null }; renderAnalytics(); } }));
    }
    c.append(h('div', { class:'cal-select-bar', role:'status', 'aria-live':'polite' }, h('span', { text:msg }), actions));
  }
  c.append(calendarHeatmap(a));
  return c;
}

function calendarHeatmap(a){
  const monthDate = ui.calMonth || new Date();
  const scope = a ? a.scope : AnalyticsScope.resolve(ui.analyticsScope);
  const y = monthDate.getFullYear(), mo = monthDate.getMonth();
  const inSelect = ui.calMode === 'select';
  const wrap = h('div', { class:'cal' });
  const goMonth = (delta) => { ui.calMonth = new Date(y, mo + delta, 1); renderAnalytics(); };
  wrap.append(h('div', { class:'cal-head' },
    h('button', { class:'btn ghost sm', type:'button', text:'‹', 'aria-label':'Mês anterior', onclick:() => goMonth(-1) }),
    h('span', { class:'cal-month', 'aria-live':'polite', text:`${MONTHS[mo]} de ${y}` }),
    h('button', { class:'btn ghost sm', type:'button', text:'›', 'aria-label':'Próximo mês', onclick:() => goMonth(1) }),
    h('button', { class:'linkbtn', type:'button', text:'mês atual', style:'margin-left:auto',
      onclick:() => { const t = new Date(); ui.calMonth = new Date(t.getFullYear(), t.getMonth(), 1); renderAnalytics(); } })));

  const dows = weekStartDow() === 1 ? ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'] : ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  wrap.append(h('div', { class:'cal-dows', 'aria-hidden':'true' }, dows.map(d => h('span', { text:d }))));

  const total = new Date(y, mo + 1, 0).getDate();
  const monthSessions = AnalyticsScope.sessions(scope, { start:new Date(y, mo, 1), end:new Date(y, mo, total) });
  const minutesByDay = new Map();
  monthSessions.forEach(s => minutesByDay.set(s.date, (minutesByDay.get(s.date) || 0) + (s.minutes || 0)));
  const max = Math.max(0, ...minutesByDay.values());
  const dueDays = new Set(state.deadlines.filter(dl => !DeadlineEngine.isDone(dl) && AnalyticsScope.deadlineRelation(scope, dl)).map(dl => dl.date));

  const firstDow = new Date(y, mo, 1).getDay();
  const blanks = (firstDow - weekStartDow() + 7) % 7;
  const grid = h('div', { class:'cal-grid', role:'group', 'aria-label': inSelect ? 'Escolha o primeiro e o último dia do intervalo' : 'Dias do mês; escolha um dia para ver os detalhes' });
  for(let i = 0; i < blanks; i++) grid.append(h('div', { class:'cal-day blank', 'aria-hidden':'true' }));

  const sISO = dateToISO(ui.period.start), eISO = dateToISO(ui.period.end), tISO = todayISO();
  const sel = ui.calSel || {};
  const selA = sel.start && sel.end ? (sel.start < sel.end ? sel.start : sel.end) : sel.start;
  const selB = sel.start && sel.end ? (sel.start < sel.end ? sel.end : sel.start) : sel.start;
  const monthISO = d => dateToISO(new Date(y, mo, d));
  // dia que recebe o foco do teclado (roving tabindex)
  let focusISO = ui.calFocus && ui.calFocus.slice(0, 7) === monthISO(1).slice(0, 7) ? ui.calFocus
    : (tISO.slice(0, 7) === monthISO(1).slice(0, 7) ? tISO : (eISO.slice(0, 7) === monthISO(1).slice(0, 7) ? eISO : monthISO(1)));

  for(let day = 1; day <= total; day++){
    const iso = monthISO(day);
    const m = minutesByDay.get(iso) || 0;
    let lvl = 0;
    if(max > 0 && m > 0){ const r = m / max; lvl = r >= .75 ? 4 : r >= .5 ? 3 : r >= .25 ? 2 : 1; }
    let cls = 'cal-day';
    if(inSelect){
      if(selA && iso >= selA && iso <= selB) cls += ' inrange';
      if(iso === selA || iso === selB) cls += ' edge';
    } else {
      if(iso >= sISO && iso <= eISO) cls += ' inrange';
      if(iso === sISO || iso === eISO) cls += ' edge';
    }
    if(iso === tISO) cls += ' today';
    if(iso > tISO) cls += ' future';
    const parts = [fmtDateLong(iso), m > 0 ? fmtDuration(m) + ' de estudo' : 'sem registros'];
    if(dueDays.has(iso)) parts.push('tem prazo');
    if(!inSelect && iso >= sISO && iso <= eISO) parts.push('dentro do período analisado');
    const btn = h('button', { type:'button', class:cls, dataset:{ date: iso }, tabindex: iso === focusISO ? '0' : '-1',
      'aria-label': parts.join(', '), 'aria-pressed': inSelect ? ((iso === selA || iso === selB) ? 'true' : 'false') : null },
      h('span', { class:'cal-num', text:String(day) }),
      dueDays.has(iso) ? h('span', { class:'cal-due', 'aria-hidden':'true' }) : null,
      h('span', { class:'lv', style: lvl ? `background:var(--heat-${lvl})` : null }));
    Tooltip.attach(btn, () => dayTip(iso, scope));
    btn.addEventListener('click', () => {
      ui.calFocus = iso;
      if(ui.calMode === 'select'){
        const s = ui.calSel || {};
        if(!s.start || s.end) ui.calSel = { start:iso, end:null };
        else ui.calSel = iso < s.start ? { start:iso, end:s.start } : { start:s.start, end:iso };
        ui.calRefocus = iso;
        renderAnalytics();
      } else {
        openDayDrawer(iso, scope);
      }
    });
    grid.append(btn);
  }
  grid.addEventListener('keydown', (e) => {
    const cur = e.target.closest && e.target.closest('.cal-day');
    if(!cur || !cur.dataset.date) return;
    const step = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7 }[e.key];
    let target = null;
    if(step) target = addDays(parseISO(cur.dataset.date), step);
    else if(e.key === 'PageUp') target = new Date(y, mo - 1, Math.min(parseISO(cur.dataset.date).getDate(), new Date(y, mo, 0).getDate()));
    else if(e.key === 'PageDown') target = new Date(y, mo + 1, Math.min(parseISO(cur.dataset.date).getDate(), new Date(y, mo + 2, 0).getDate()));
    else if(e.key === 'Home') target = new Date(y, mo, 1);
    else if(e.key === 'End') target = new Date(y, mo, total);
    if(!target) return;
    e.preventDefault();
    const iso = dateToISO(target);
    const el = grid.querySelector(`.cal-day[data-date="${iso}"]`);
    if(el){
      $$('.cal-day[tabindex="0"]', grid).forEach(x => x.setAttribute('tabindex', '-1'));
      el.setAttribute('tabindex', '0');
      el.focus();
      ui.calFocus = iso;
    } else {
      ui.calFocus = iso; ui.calRefocus = iso;
      ui.calMonth = new Date(target.getFullYear(), target.getMonth(), 1);
      renderAnalytics();
    }
  });
  wrap.append(grid);
  wrap.append(h('div', { class:'cal-legend' },
    h('span', { text:'menos' }),
    [0,1,2,3,4].map(i => h('span', { class:'sw', style:`background:var(--heat-${i})` })),
    h('span', { text:'mais tempo' }),
    dueDays.size ? h('span', { class:'cal-legend-due' }, h('span', { class:'cal-due', 'aria-hidden':'true' }), 'prazo') : null));
  wrap.append(h('p', { class:'hint', style:'margin-top:6px', text: inSelect
    ? 'Escolha o primeiro e o último dia. A ordem não importa.'
    : 'Escolha um dia para ver o que foi estudado. Para analisar vários dias, use "Selecionar intervalo". Setas do teclado movem entre os dias.' }));
  return wrap;
}

function sessionsOfDay(iso, scope){
  return state.sessions.filter(x => x.date === iso && AnalyticsScope.hasSession(scope, x));
}

/** Resumo de um dia no tooltip do calendário. */
function dayTip(iso, scope){
  const sc = scope || AnalyticsScope.resolve(ui.analyticsScope);
  const list = sessionsOfDay(iso, sc);
  if(!list.length) return tipBody(fmtDateBR(iso), [], 'Sem registros neste dia.');
  const byDisc = new Map();
  list.forEach(x => byDisc.set(x.disciplineId, (byDisc.get(x.disciplineId) || 0) + (x.minutes || 0)));
  const rows = [...byDisc.entries()].sort((a,b) => b[1] - a[1]).slice(0, 5).map(([id, min]) => [disciplineName(id), fmtDuration(min)]);
  return tipBody(fmtDateBR(iso), [
    ['Tempo', fmtDuration(sum(list, x => x.minutes || 0))],
    ['Sessões', String(list.length)],
    '-'
  ].concat(rows));
}

/** Detalhes de um dia (modo visualização do calendário). */
function openDayDrawer(iso, scope){
  const sc = scope || AnalyticsScope.resolve(ui.analyticsScope);
  const list = sessionsOfDay(iso, sc).slice().sort((x,y) => str(x.createdAt).localeCompare(str(y.createdAt)));
  const body = h('div', { class:'an-drawer' });
  body.append(h('p', { class:'an-drawer-ctx', text: AnalyticsScope.pathText(sc) }));
  const total = sum(list, x => x.minutes || 0);
  if(!list.length){
    body.append(h('p', { class:'influence-note', text: iso > todayISO() ? 'Este dia ainda não chegou.' : 'Nenhuma sessão registrada neste dia.' }));
  } else {
    body.append(h('div', { class:'stat-grid compact' },
      statBox(fmtDuration(total), 'tempo'),
      statBox(String(list.length), list.length === 1 ? 'sessão' : 'sessões'),
      statBox(String(list.filter(s => s.type === 'revisao' || s.reviewOutcome).length), 'revisões')));
    const ul = h('ul', { class:'an-sess-list' });
    list.forEach(s => {
      const topic = topicLabelOf(s);
      ul.append(h('li', null, h('button', { class:'an-sess', type:'button', 'aria-label':'Editar esta sessão',
          onclick:() => { Drawer.close(); openEditSessionModal(s.id); } },
        h('span', { class:'an-sess-main' },
          h('span', { class:'an-sess-title', text: disciplineName(s.disciplineId) + (topic ? ' › ' + topic : '') }),
          h('span', { class:'an-sess-sub', text: [sessionTypeLabel(s.type), s.difficulty ? 'dificuldade ' + s.difficulty + '/5' : null, s.reviewOutcome ? reviewOutcomeLabel(s.reviewOutcome) : null].filter(Boolean).join(' · ') })),
        h('span', { class:'an-sess-min', text: fmtDuration(s.minutes) }))));
    });
    body.append(drawerSection('Sessões', ul));
  }
  const due = state.deadlines.filter(dl => dl.date === iso && AnalyticsScope.deadlineRelation(sc, dl));
  if(due.length) body.append(drawerSection('Prazos neste dia', h('div', { class:'dl-mini-list' }, due.map(dl => deadlineMiniRow(dl)))));
  body.append(h('div', { class:'row auto', style:'margin-top:16px' },
    h('button', { class:'btn primary sm', type:'button', text:'Analisar este dia', onclick:() => {
      const d = parseISO(iso);
      Drawer.close();
      setAnalyticsPeriod({ start:d, end:d }, iso === todayISO() ? 'hoje' : null);
      renderAnalytics(); focusAnalyticsTop();
    } }),
    iso <= todayISO() ? h('button', { class:'btn ghost sm', type:'button', text:'Registrar sessão neste dia', onclick:() => { Drawer.close(); openRegisterModal({ mode:'manual', date: iso, disciplineId: sc.disciplineId || null, topicId: sc.topicId || null }); } }) : null));
  Drawer.open(fmtDateLong(iso), body);
}

/* ---------- gráfico de tempo ---------- */
function analyticsTimeCard(a){
  return h('div', { class:'card' },
    h('p', { class:'card-title', text:'Tempo ao longo do período' }),
    timeChart(a));
}

function timeChart(a){
  const days = a.days;
  const granularity = days > 180 ? 'month' : days > 31 ? 'week' : 'day';
  const buckets = new Map();
  const add = (key, label, minutes, range) => {
    if(!buckets.has(key)) buckets.set(key, { key, label, minutes:0, range });
    buckets.get(key).minutes += minutes;
  };
  if(granularity === 'day'){
    for(let i = 0; i < days; i++){ const d = addDays(a.range.start, i); add(dateToISO(d), String(d.getDate()), 0, { start:d, end:d }); }
    a.sessions.forEach(s => { const d = parseISO(s.date); if(d) add(s.date, String(d.getDate()), s.minutes || 0, { start:d, end:d }); });
  } else if(granularity === 'week'){
    let ws = startOfWeek(a.range.start);
    while(ws <= a.range.end){
      add(dateToISO(ws), `${ws.getDate()}/${ws.getMonth()+1}`, 0, { start: ws < a.range.start ? a.range.start : ws, end: addDays(ws, 6) > a.range.end ? a.range.end : addDays(ws, 6) });
      ws = addDays(ws, 7);
    }
    a.sessions.forEach(s => { const w = startOfWeek(parseISO(s.date)); const k = dateToISO(w); if(buckets.has(k)) buckets.get(k).minutes += s.minutes || 0; });
  } else {
    let m = new Date(a.range.start.getFullYear(), a.range.start.getMonth(), 1);
    while(m <= a.range.end){
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      add(`${m.getFullYear()}-${String(m.getMonth()).padStart(2,'0')}`, `${MONTHS_ABBR[m.getMonth()]}${m.getMonth() === 0 ? '/' + String(m.getFullYear()).slice(2) : ''}`, 0,
        { start: m < a.range.start ? a.range.start : m, end: end > a.range.end ? a.range.end : end });
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    }
    a.sessions.forEach(s => { const d = parseISO(s.date); const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`; if(buckets.has(k)) buckets.get(k).minutes += s.minutes || 0; });
  }
  const series = Array.from(buckets.values()).sort((x,y) => x.key < y.key ? -1 : 1);
  if(!series.length || series.every(s => s.minutes === 0)) return h('p', { class:'hint', text:'Sem registros neste período.' });
  const max = Math.max(...series.map(s => s.minutes), 1);
  const unit = { day:'dia', week:'semana', month:'mês' }[granularity];
  const chart = h('div', { class:'tchart', role:'group', 'aria-label':`Tempo por ${unit}` });
  series.forEach(s => {
    const col = h('button', { class:'tcol' + (s.minutes ? '' : ' is-empty'), type:'button',
      'aria-label': `${granularity === 'day' ? fmtDateBR(s.key) : (granularity === 'week' ? 'Semana de ' + s.label : s.label)}: ${fmtDuration(s.minutes)}. Ver detalhes`,
      onclick:() => openBucketDrawer(s, granularity, a) },
      h('span', { class:'tb', style:`height:${(s.minutes / max) * 100}%` }),
      h('span', { class:'tl', text:s.label }));
    Tooltip.attach(col, () => bucketTip(s, granularity, a.scope));
    chart.appendChild(col);
  });
  return h('div', null, chart,
    h('p', { class:'hint', style:'margin-top:6px', text:`Cada barra é um ${unit}. Clique em uma barra para ver os detalhes.` }));
}

function bucketSessions(bucket, scope){ return AnalyticsScope.sessions(scope, bucket.range); }

function bucketTip(bucket, granularity, scope){
  const list = bucketSessions(bucket, scope || AnalyticsScope.resolve(ui.analyticsScope));
  const byDisc = new Map();
  list.forEach(x => byDisc.set(x.disciplineId, (byDisc.get(x.disciplineId) || 0) + (x.minutes || 0)));
  const rows = [...byDisc.entries()].sort((a,b) => b[1] - a[1]).slice(0, 5).map(([id, min]) => [disciplineName(id), fmtDuration(min)]);
  const head = granularity === 'day' ? fmtDateBR(bucket.key) : fmtRangeLabel(bucket.range);
  const sub = `${fmtDuration(bucket.minutes)} · ${plural(list.length, 'sessão', 'sessões')}`;
  return tipBody(head, rows.length ? [[sub, '']].concat(['-']).concat(rows) : [], rows.length ? null : sub);
}

function openBucketDrawer(bucket, granularity, a){
  if(granularity === 'day'){ openDayDrawer(bucket.key, a.scope); return; }
  const list = bucketSessions(bucket, a.scope);
  const body = h('div', { class:'an-drawer' });
  body.append(h('p', { class:'an-drawer-ctx', text: AnalyticsScope.pathText(a.scope) }));
  body.append(h('div', { class:'stat-grid compact' },
    statBox(fmtDuration(sum(list, s => s.minutes || 0)), 'tempo'),
    statBox(String(list.length), 'sessões'),
    statBox(String(new Set(list.map(s => s.date)).size), 'dias com estudo')));
  const useTopics = a.scope.type === 'discipline' || a.scope.type === 'topic';
  const rows = AnalyticsEngine.groupMinutes(list, s => useTopics ? (s.topicId || '__none__') : s.disciplineId,
    id => useTopics ? (id === '__none__' ? 'Sem tópico definido' : ((getTopic(id) || {}).name || '(tópico removido)')) : disciplineName(id));
  if(rows.length){
    const mx = Math.max(1, ...rows.map(r => r.minutes));
    body.append(drawerSection(useTopics ? 'Por tópico' : 'Por disciplina', rows.slice(0, 12).map(r => hbarRow(r.label, r.minutes / mx * 100, `${fmtDuration(r.minutes)} · ${safePct(r.pct)}`))));
  }
  body.append(h('div', { class:'row auto', style:'margin-top:16px' },
    h('button', { class:'btn primary sm', type:'button', text:'Analisar este período', onclick:() => {
      Drawer.close(); setAnalyticsPeriod(bucket.range, null); renderAnalytics(); focusAnalyticsTop();
    } })));
  Drawer.open(fmtRangeLabel(bucket.range), body);
}

/* ---------- distribuição (rosca) ---------- */
function distributionModes(scope){
  const hasAreas = activeAreas().length > 0;
  switch(scope.type){
    case 'all':        return (hasAreas ? [['area','Áreas']] : []).concat([['discipline','Disciplinas'], ['topic','Tópicos']]);
    case 'area':       return [['discipline','Disciplinas'], ['topic','Tópicos']];
    case 'discipline': return [['topic','Tópicos'], ['type','Tipos de sessão']];
    default:           return [['type','Tipos de sessão']];
  }
}

function analyticsDistributionCard(a){
  const modes = distributionModes(a.scope);
  let mode = ui.distributionMode;
  if(!modes.some(m => m[0] === mode)) mode = modes.some(m => m[0] === 'discipline') ? 'discipline' : modes[0][0];
  const toggle = h('div', { class:'chips', role:'group', 'aria-label':'Agrupar por' }, modes.map(([v, l]) =>
    h('button', { class:'chip', type:'button', 'aria-pressed': mode === v ? 'true' : 'false', text:l,
      onclick:() => { ui.distributionMode = v; renderAnalytics(); } })));
  let rows;
  if(mode === 'area') rows = a.byArea;
  else if(mode === 'discipline') rows = a.byDiscipline;
  else if(mode === 'topic') rows = a.byTopic;
  else rows = a.byType.filter(x => x.minutes > 0).map(x => ({ key:x.key, label:x.label, minutes:x.minutes, count:x.count,
    pct: a.totals.minutes > 0 ? x.minutes / a.totals.minutes * 100 : 0 })).sort((x,y) => y.minutes - x.minutes);

  // no máximo 7 fatias + "Outros"
  let shown = rows;
  if(rows.length > 8){
    const rest = rows.slice(7);
    shown = rows.slice(0, 7).concat([{ key:'__others__', label:`Outros (${rest.length})`, minutes: sum(rest, r => r.minutes),
      count: sum(rest, r => r.count), pct: sum(rest, r => r.pct), others: rest }]);
  }
  const content = shown.length
    ? h('div', { class:'donut-wrap' }, donutChart(shown, mode, a), donutLegend(shown, mode, a))
    : h('p', { class:'hint', text:'Sem registros neste período.' });
  return cardWithAction('Para onde foi o tempo', toggle, content);
}

function distributionAction(row, mode){
  if(row.key === '__others__' || row.key === '__none__') return null;
  if(mode === 'area') return row.key === NO_AREA_ID || getArea(row.key) ? () => analyzeOnly('area', row.key) : null;
  if(mode === 'discipline') return getDiscipline(row.key) ? () => analyzeOnly('discipline', row.key) : null;
  if(mode === 'topic') return getTopic(row.key) ? () => analyzeOnly('topic', row.key) : null;
  return null;
}

function openDistributionDrawer(row, mode, a){
  const body = h('div', { class:'an-drawer' });
  body.append(h('p', { class:'an-drawer-ctx', text: `${AnalyticsScope.pathText(a.scope)} · ${fmtRangeLabel(a.range)}` }));
  body.append(h('div', { class:'stat-grid compact' },
    statBox(fmtDuration(row.minutes), 'tempo'),
    statBox(safePct(row.pct), 'do tempo do período'),
    statBox(String(row.count), row.count === 1 ? 'sessão' : 'sessões')));
  if(row.others){
    const mx = Math.max(1, ...row.others.map(r => r.minutes));
    body.append(drawerSection('Itens agrupados', row.others.map(r => hbarRow(r.label, r.minutes / mx * 100, `${fmtDuration(r.minutes)} · ${safePct(r.pct)}`, null, distributionAction(r, mode)))));
  }
  if(mode === 'discipline' && getDiscipline(row.key)){
    const d = getDiscipline(row.key);
    const dl = h('dl', { class:'kv-list' });
    const kv = (k, v) => dl.append(h('div', null, h('dt', { text:k }), h('dd', { text:v })));
    kv(AREA_TERM, areaNameOf(d));
    kv('Prioridade', PriorityEngine.text(d.priority));
    const pd = a.planAdherence.perDiscipline.find(x => x.disciplineId === d.id);
    if(pd && pd.planned > 0) kv('Plano', `${fmtDuration(pd.realized)} de ${fmtDuration(pd.planned)} (${safePct(pd.pct)})`);
    body.append(dl);
  } else if(mode === 'topic' && getTopic(row.key)){
    const tp = getTopic(row.key);
    const dl = h('dl', { class:'kv-list' });
    const kv = (k, v) => dl.append(h('div', null, h('dt', { text:k }), h('dd', { text:v })));
    kv('Disciplina', disciplineName(tp.disciplineId));
    kv('Prioridade', PriorityEngine.text(tp.priority));
    kv('Situação', TOPIC_STATUS_LABEL[topicStatus(tp)]);
    body.append(dl);
  }
  const go = distributionAction(row, mode);
  const goLabel = { area:'Analisar só esta Área de Estudo', discipline:'Analisar só esta disciplina', topic:'Analisar só este tópico' }[mode];
  if(go) body.append(h('div', { class:'row auto', style:'margin-top:16px' }, h('button', { class:'btn primary sm', type:'button', text:goLabel, onclick:go })));
  Drawer.open(row.label, body);
}

function donutChart(rows, mode, a){
  const total = sum(rows, r => r.minutes) || 1;
  const R = 45, C = 60, circ = 2 * Math.PI * R;
  const svg = svgEl('svg', { id:'donut-svg', viewBox:'0 0 120 120', class:'donut', 'aria-hidden':'true', focusable:'false' });
  svg.append(svgEl('circle', { cx:C, cy:C, r:R, fill:'none', stroke:'var(--line-soft)', 'stroke-width':16 }));
  let offset = 0;
  rows.forEach((r, i) => {
    const seg = (r.minutes / total) * circ;
    const c = svgEl('circle', { cx:C, cy:C, r:R, fill:'none', stroke:PALETTE[i % PALETTE.length], 'stroke-width':16,
      'stroke-dasharray':`${seg} ${circ - seg}`, 'stroke-dashoffset':-offset, transform:`rotate(-90 ${C} ${C})`,
      'data-seg': String(i) });
    c.addEventListener('click', () => openDistributionDrawer(r, mode, a));
    c.addEventListener('mouseenter', () => donutHighlight(i, true));
    c.addEventListener('mouseleave', () => donutHighlight(i, false));
    svg.append(c);
    offset += seg;
  });
  svg.append(svgEl('text', { x:C, y:C - 2, 'text-anchor':'middle', class:'donut-total' }, fmtDuration(sum(rows, r => r.minutes))));
  svg.append(svgEl('text', { x:C, y:C + 13, 'text-anchor':'middle', class:'donut-sub' }, 'no total'));
  return svg;
}
function donutHighlight(i, on){
  const svg = $('#donut-svg');
  if(!svg) return;
  $$('circle[data-active]', svg).forEach(c => c.removeAttribute('data-active'));
  if(on){ svg.setAttribute('data-dim','1'); const c = svg.querySelector(`circle[data-seg="${i}"]`); if(c) c.setAttribute('data-active','1'); }
  else svg.removeAttribute('data-dim');
}
function donutLegend(rows, mode, a){
  const box = h('ul', { class:'legend', 'aria-label':'Distribuição do tempo' });
  rows.forEach((r, i) => {
    const row = h('button', { class:'legend-row', type:'button', 'data-hoverable':'1',
        'aria-label': `${r.label}: ${fmtDuration(r.minutes)}, ${safePct(r.pct)} do tempo. Ver detalhes`,
        onclick:() => openDistributionDrawer(r, mode, a) },
      h('span', { class:'sw', style:`background:${PALETTE[i % PALETTE.length]}` }),
      h('span', { class:'lb', text:r.label }),
      h('span', { class:'num', text:`${fmtDuration(r.minutes)} · ${safePct(r.pct)}` }));
    ['mouseenter','focus'].forEach(ev => row.addEventListener(ev, () => donutHighlight(i, true)));
    ['mouseleave','blur'].forEach(ev => row.addEventListener(ev, () => donutHighlight(i, false)));
    box.appendChild(h('li', null, row));
  });
  return box;
}

/* ---------- prioridades ---------- */
function analyticsPriorityCard(a){
  const pr = a.priorities;
  const sc = a.scope;
  const showDisc = (sc.type === 'all' || sc.type === 'area') && pr.total > 0 && pr.mixedDisc;
  const showTopic = sc.type !== 'topic' && pr.topicTotal > 0 && pr.mixedTopic;
  if(!showDisc && !showTopic && !pr.highDiscNoTime.length && !pr.highTopicNoTime.length){
    if(sc.type !== 'topic') return null;
    const tp = getTopic(sc.topicId), d = getDiscipline(sc.disciplineId);
    if(!tp || !d) return null;
    return h('div', { class:'card' }, h('p', { class:'card-title' }, 'Prioridade', helpDot('prioridade')),
      h('div', { class:'an-prio-pair' },
        h('div', null, h('span', { class:'section-label', text:'Deste tópico' }), priorityChip(tp.priority)),
        h('div', null, h('span', { class:'section-label', text:'Da disciplina' }), priorityChip(d.priority))),
      h('p', { class:'hint', style:'margin-top:10px', text: PriorityEngine.hint(tp.priority, 'topic') }));
  }
  const c = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Tempo por prioridade', helpDot('prioridade')));
  const block = (title, rows, totalMin) => {
    const mx = Math.max(1, ...rows.map(r => r.minutes));
    return h('div', { class:'an-prio-block' },
      h('p', { class:'section-label', text:title }),
      rows.slice().reverse().filter(r => r.count > 0 || r.minutes > 0).map(r => h('div', { class:'hbar-row' },
        h('span', { class:'hl' }, priorityChip(r.p, { compact:false })),
        h('div', { class:'hbar' }, h('span', { style:`width:${r.minutes / mx * 100}%` })),
        h('span', { class:'hv', text: r.minutes ? `${fmtDuration(r.minutes)} · ${safePct(r.pct)}` : '—' }))),
      (totalMin === pr.topicTotal && totalMin !== pr.total)
        ? h('p', { class:'hint', text:'Considera só sessões com tópico definido.' })
        : null);
  };
  if(showDisc) c.append(block('Disciplinas', pr.byDisc, pr.total));
  if(showTopic) c.append(block('Tópicos', pr.byTopic, pr.topicTotal));
  if(pr.highDiscNoTime.length){
    c.append(h('p', { class:'section-label', style:'margin-top:12px', text:'Prioridade alta, sem sessões no período' }));
    c.append(h('div', { class:'chips' }, pr.highDiscNoTime.slice(0, 8).map(d =>
      h('button', { class:'chip', type:'button', text:`${d.name} · ${PriorityEngine.clamp(d.priority)}`, onclick:() => analyzeOnly('discipline', d.id) }))));
  }
  if(pr.highTopicNoTime.length && sc.type !== 'all'){
    c.append(h('p', { class:'section-label', style:'margin-top:12px', text:'Tópicos de prioridade alta não estudados no período' }));
    c.append(h('div', { class:'chips' }, pr.highTopicNoTime.slice(0, 8).map(tp =>
      h('button', { class:'chip', type:'button', text:`${tp.name} · ${PriorityEngine.clamp(tp.priority)}`, onclick:() => openTopicFromAnalytics(tp) }))));
    if(pr.highTopicNoTime.length > 8) c.append(h('p', { class:'hint', text:`e mais ${pr.highTopicNoTime.length - 8}.` }));
  }
  c.append(h('p', { class:'hint', style:'margin-top:10px', text:'Usa a prioridade atual de cada disciplina e tópico. Prioridade alta não precisa receber todo o tempo: é só uma referência.' }));
  return c;
}

/* ---------- plano, conteúdo, revisões, dificuldade, tipos ---------- */
function analyticsPlanCard(a){
  const c = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Planejado × realizado', helpDot('aderencia')));
  a.planAdherence.perDiscipline.forEach(x => {
    if(x.planned <= 0 && x.realized <= 0) return;
    const pct = x.pct === null ? 0 : x.pct;
    c.append(hbarRow(x.label, pct, x.pct === null ? `${fmtDuration(x.realized)} (sem plano)` : safePct(pct),
      pct >= 100 ? 'var(--teal)' : pct < 60 ? 'var(--danger)' : 'var(--brass)'));
  });
  c.append(h('p', { class:'hint', style:'margin-top:8px', text:'Cada semana é comparada com o plano que existia naquela semana.' }));
  return c;
}

function analyticsContentCard(a){
  const ct = a.content;
  const c = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Progresso no conteúdo', helpDot('cobertura')));
  if(a.scope.type === 'topic'){
    const tp = getTopic(a.scope.topicId);
    const st = tp ? topicStatus(tp) : 'nao_iniciado';
    c.append(h('div', { class:'stat-grid compact' },
      statBox(TOPIC_STATUS_LABEL[st], 'situação'),
      statBox(tp && tp.masteryLevel ? `${tp.masteryLevel}/5` : '—', 'domínio'),
      statBox(tp && tp.reviewDueDate && tp.reviewEnabled ? fmtDateBR(tp.reviewDueDate) : '—', 'próxima revisão')));
    return c;
  }
  c.append(h('div', { class:'stat-grid compact', style:'margin-bottom:12px' },
    statBox(`${ct.covered} de ${ct.totalTopics}`, METRIC_WORDS.coverage.title, { text:`${safePct(ct.coverage)} · também chamado de cobertura`, dir:'' }),
    statBox(`${ct.mastered} de ${ct.totalTopics}`, METRIC_WORDS.mastery.title, { text:`${safePct(ct.masteryPct)} · também chamado de domínio`, dir:'' })));
  if(a.scope.type === 'discipline'){
    const mx = Math.max(1, ...ct.byStatus.map(x => x.count));
    ct.byStatus.forEach(x => c.append(hbarRow(x.label, x.count / mx * 100, String(x.count))));
  } else {
    ct.perDiscipline.slice().sort((x,y) => (y.coverage || 0) - (x.coverage || 0)).slice(0, 10)
      .forEach(x => c.append(hbarRow(x.discipline.name, x.coverage, safePct(x.coverage), null, () => analyzeOnly('discipline', x.discipline.id))));
  }
  if(ct.weakest.length){
    c.append(h('p', { class:'section-label', style:'margin-top:14px', text:'Menor domínio' }));
    ct.weakest.forEach(tp => c.append(hbarRow(tp.name, (tp.masteryLevel / 5) * 100, tp.masteryLevel + '/5',
      tp.masteryLevel <= 2 ? 'var(--danger)' : 'var(--brass)', () => openTopicFromAnalytics(tp))));
  }
  return c;
}

function analyticsReviewsCard(a){
  const r = a.reviews;
  const rc = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Revisões', helpDot('dominio')),
    h('div', { class:'stat-grid compact', style:'margin-bottom:10px' },
      statBox(String(r.completed), 'concluídas'),
      statBox(String(r.scheduled), 'ainda previstas'),
      statBox(r.rate !== null ? safePct(r.rate) : '—', 'feitas / esperadas'),
      statBox(String(r.overdueNow), 'atrasadas agora')));
  const outMax = Math.max(1, ...r.outcomes.map(o => o.count));
  if(r.completed > 0) r.outcomes.forEach(o => rc.append(hbarRow(o.label, o.count / outMax * 100, String(o.count))));
  if(r.forgetful.length){
    rc.append(h('p', { class:'section-label', style:'margin-top:14px', text:'Esquecidos com mais frequência' }));
    r.forgetful.forEach(tp => rc.append(hbarRow(tp.name, clamp((tp.reviewFailures / 5) * 100, 10, 100), tp.reviewFailures + '×', 'var(--danger)', () => openTopicFromAnalytics(tp))));
  }
  rc.append(h('button', { class:'linkbtn', type:'button', style:'margin-top:10px', text:'Ver detalhes das revisões', onclick:() => openAnalyticsDrawer('reviews', a) }));
  return rc;
}

function analyticsDifficultyCard(a){
  const c = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Dificuldade percebida', helpDot('dificuldade')));
  if(a.difficulty.count === 0){
    c.append(h('p', { class:'hint', text:'Nenhuma sessão deste período teve dificuldade informada.' }));
    return c;
  }
  c.append(h('p', { class:'hint', style:'margin-bottom:10px', text:`Média ${fmtNumber(a.difficulty.avg, 1)}/5 em ${plural(a.difficulty.count, 'registro', 'registros')}. Mostra como o estudo pareceu, não o seu desempenho.` }));
  const max = Math.max(1, ...a.difficulty.counts.map(x => x.count));
  a.difficulty.counts.forEach(d => c.append(hbarRow(d.label, d.count / max * 100, String(d.count), d.color)));
  const per = a.scope.type === 'discipline' || a.scope.type === 'topic' ? a.difficulty.perTopic : a.difficulty.perDiscipline;
  if(per.length > 1){
    c.append(h('p', { class:'section-label', style:'margin-top:14px', text: a.scope.type === 'discipline' ? 'Média por tópico' : 'Média por disciplina' }));
    per.slice(0, 8).forEach(x => c.append(hbarRow(x.label, x.avg / 5 * 100, fmtNumber(x.avg, 1) + '/5')));
  }
  return c;
}

function analyticsTypesCard(a){
  const c = h('div', { class:'card' }, h('p', { class:'card-title' }, 'Tipos de sessão', helpDot('tiposessao')));
  if(!a.totals.count){ c.append(h('p', { class:'hint', text:'Sem sessões neste período.' })); return c; }
  const maxType = Math.max(1, ...a.byType.map(x => x.count));
  a.byType.forEach(t => c.append(hbarRow(t.label, t.count / maxType * 100, t.count ? `${t.count} · ${safePct(t.pct)}` : '0')));
  return c;
}

function analyticsProjectionCard(a){
  const p = a.projection;
  return card('Ritmo das últimas semanas', p.available
    ? h('div',
        h('p', { text:`Média das últimas ${p.weeksConsidered} semanas: ${fmtDuration(p.avgWeeklyMinutes)} por semana.` }),
        p.target ? h('p', { class:'hint', style:'margin-top:6px', text: p.meetsTarget
          ? `Acompanha o objetivo de ${fmtDuration(p.target)} por semana.`
          : `O objetivo é ${fmtDuration(p.target)} por semana; a média está ${fmtDuration(Math.abs(p.gap))} abaixo.` }) : null,
        h('p', { class:'hint', style:'margin-top:6px', text:'Não depende do período escolhido acima: considera sempre as 4 semanas completas mais recentes.' }))
    : h('p', { class:'hint', text:p.reason }));
}

function analyticsInsightsCard(a){
  return h('div', { class:'card' },
    h('p', { class:'card-title' }, 'Observações do período', helpDot('insights')),
    h('p', { class:'hint', style:'margin-bottom:8px', text:'Fatos calculados a partir dos seus registros. Eles mostram o que aconteceu, não explicam o porquê.' }),
    h('div', { class:'insights' }, a.insights.map(t => h('div', { class:'insight', text:t }))));
}

function analyticsExportCard(a){
  return h('div', { class:'card an-export' },
    h('div', { class:'an-export-main' },
      h('p', { class:'card-title', style:'margin:0 0 4px', text:'Levar este resumo com você' }),
      h('p', { class:'hint', text:'Gerado aqui no seu navegador, com o escopo e o período escolhidos. Inclui números, nomes e prazos; comentários de sessões e anotações pessoais ficam de fora.' })),
    h('div', { class:'row auto' },
      h('button', { class:'btn', type:'button', onclick:() => copySummary(a) }, icon('i-check'), 'Copiar resumo'),
      h('button', { class:'btn primary', type:'button', onclick: once(async () => downloadReport(a)) }, icon('i-data'), 'Baixar relatório (.txt)')));
}

/* ---------- relatório semanal (respeita o escopo) ---------- */
function weeklyReportCard(scope){
  const sc = scope || AnalyticsScope.resolve(ui.analyticsScope);
  const ref = addDays(today(), ui.weekOffset * 7);
  const ws = startOfWeek(ref), we = endOfWeek(ref);
  const range = { start:ws, end:we };
  const wp = state.weeklyPlans.find(w => w.weekStart === dateToISO(ws));
  const sess = AnalyticsScope.sessions(sc, range);
  const allocs = wp ? (wp.allocations || []).filter(x => AnalyticsScope.hasDiscipline(sc, x.disciplineId)) : [];
  const planned = sum(allocs, x => x.targetMinutes || 0);
  const realized = sum(sess, s => s.minutes || 0);
  const reviews = sess.filter(s => s.type === 'revisao' || s.reviewOutcome).length;
  const a = dateToISO(ws), b = dateToISO(we);
  const scheduled = ReviewEngine.allScheduled().filter(t => AnalyticsScope.hasTopic(sc, t) && t.reviewDueDate >= a && t.reviewDueDate <= b).length;

  const nav = h('div', { class:'row auto' },
    h('button', { class:'btn ghost sm', type:'button', text:'‹', 'aria-label':'Semana anterior', onclick:() => { ui.weekOffset--; renderAnalytics(); } }),
    h('span', { class:'hint', text:`Semana ${isoWeekNumber(ws)} · ${fmtDateBR(a)} a ${fmtDateBR(b)}` }),
    h('button', { class:'btn ghost sm', type:'button', text:'›', 'aria-label':'Próxima semana', disabled: ui.weekOffset >= 0,
      onclick:() => { if(ui.weekOffset < 0){ ui.weekOffset++; renderAnalytics(); } } }));

  const c = cardWithAction('Semana a semana', nav);
  c.append(h('div', { class:'stat-grid compact' },
    statBox(fmtDuration(realized), 'realizado'),
    statBox(planned > 0 ? fmtDuration(planned) : '—', 'planejado'),
    statBox(planned > 0 ? safePct((realized / planned) * 100) : '—', 'plano cumprido'),
    statBox(String(sess.length), 'sessões'),
    statBox(String(new Set(sess.map(s => s.date)).size), 'dias com estudo'),
    statBox(`${reviews}/${scheduled + reviews}`, 'revisões')));
  if(allocs.length){
    const perDisc = allocs.map(al => {
      const r = sum(sess.filter(s => s.disciplineId === al.disciplineId), s => s.minutes || 0);
      return { label: disciplineName(al.disciplineId), planned: al.targetMinutes || 0, realized: r,
               pct: al.targetMinutes > 0 ? (r / al.targetMinutes) * 100 : null };
    }).filter(x => x.planned > 0 || x.realized > 0).sort((x,y) => (y.pct || 0) - (x.pct || 0));
    if(perDisc.length > 1){
      c.append(h('p', { class:'section-label', style:'margin-top:14px', text:'Por disciplina' }));
      perDisc.forEach(x => c.append(hbarRow(x.label, x.pct || 0, x.pct === null ? fmtDuration(x.realized) : safePct(x.pct),
        (x.pct || 0) >= 100 ? 'var(--teal)' : 'var(--brass)')));
    }
  } else if(!wp){
    c.append(h('p', { class:'hint', style:'margin-top:10px', text:'Esta semana não tinha um plano registrado.' }));
  }
  return c;
}

/* ---------- resumo copiável e relatório .txt ---------- */
function reportHeaderLines(a){
  return [
    `Analisando: ${a.scope.type === 'all' ? 'Todos os estudos' : AnalyticsScope.kindLabel(a.scope) + ' — ' + AnalyticsScope.pathText(a.scope)}`,
    `Período: ${periodPresetLabel()} — ${fmtRangeLabel(a.range)} (${plural(a.days, 'dia', 'dias')})`
  ];
}

function buildSummaryText(a){
  const L = ['CICLO — RESUMO DE ESTUDOS', ''];
  L.push(...reportHeaderLines(a), '');
  a.summary.forEach(s => L.push(`• ${s}`));
  L.push('');
  L.push(`Tempo: ${fmtDuration(a.totals.minutes)} · Sessões: ${a.totals.count} · Dias com estudo: ${a.totals.activeDays} de ${a.days}`);
  if(a.planAdherence.hasPlan) L.push(`Plano cumprido: ${safePct(a.planAdherence.pct)} (${fmtDuration(a.planAdherence.realized)} de ${fmtDuration(a.planAdherence.planned)})`);
  if(a.reviews.completed || a.reviews.overdueNow) L.push(`Revisões: ${a.reviews.completed} concluídas · ${a.reviews.overdueNow} atrasadas agora`);
  if(a.deadlines.upcoming.length) L.push(`Próximos prazos: ${a.deadlines.upcoming.slice(0, 3).map(x => DeadlineEngine.phrase(x.dl)).join('; ')}`);
  if(a.insights.length){
    L.push('', 'Observações:');
    a.insights.slice(0, 6).forEach(i => L.push(`• ${i}`));
  }
  return L.join('\n');
}

function reportSlug(scope){
  if(scope.type === 'all') return '';
  const s = normalizeText(scope.label).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s;
}
function reportFilename(a){
  const slug = reportSlug(a.scope);
  return `ciclo-relatorio${slug ? '-' + slug : ''}-${todayISO()}.txt`;
}

function buildStudyReportText(a){
  const L = [];
  const now = new Date();
  const section = (title) => { L.push('', title, '-'.repeat(title.length)); };
  const bullet = (t) => L.push(`- ${t}`);
  L.push('CICLO — RELATÓRIO DE ESTUDOS');
  L.push(`Gerado em ${fmtDateBR(dateToISO(now))} às ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);

  section('ESCOPO');
  if(a.scope.type === 'all') L.push('Todos os estudos (todas as Áreas de Estudo, disciplinas e tópicos).');
  else {
    L.push(`${AnalyticsScope.kindLabel(a.scope)}: ${a.scope.label}`);
    L.push(`Caminho: ${AnalyticsScope.pathText(a.scope)}`);
    if(a.scope.type === 'area') L.push(`Disciplinas incluídas: ${AnalyticsScope.disciplines(a.scope).map(d => d.name).sort((x,y) => x.localeCompare(y, 'pt-BR')).join(', ') || 'nenhuma'}`);
  }

  section('PERÍODO');
  L.push(`${periodPresetLabel()}: ${fmtDateBR(dateToISO(a.range.start))} a ${fmtDateBR(dateToISO(a.range.end))} (${plural(a.days, 'dia', 'dias')})`);

  section('RESUMO');
  a.summary.forEach(bullet);

  section('PRIORIDADES');
  const pr = a.priorities;
  if(a.scope.type === 'topic'){
    const tp = getTopic(a.scope.topicId), d = getDiscipline(a.scope.disciplineId);
    if(tp) L.push(`Prioridade do tópico: ${PriorityEngine.text(tp.priority)}`);
    if(d) L.push(`Prioridade da disciplina: ${PriorityEngine.text(d.priority)}`);
  } else {
    if(a.scope.type !== 'discipline' && pr.total > 0){
      L.push('Tempo por prioridade das disciplinas:');
      pr.byDisc.slice().reverse().filter(r => r.count || r.minutes).forEach(r => bullet(`${PriorityEngine.text(r.p)}: ${fmtDuration(r.minutes)} (${safePct(r.pct)})`));
    }
    if(a.scope.type === 'discipline'){
      const d = getDiscipline(a.scope.disciplineId);
      if(d) L.push(`Prioridade da disciplina: ${PriorityEngine.text(d.priority)}`);
    }
    if(pr.topicTotal > 0){
      L.push('Tempo por prioridade dos tópicos (sessões com tópico):');
      pr.byTopic.slice().reverse().filter(r => r.count || r.minutes).forEach(r => bullet(`${PriorityEngine.text(r.p)}: ${fmtDuration(r.minutes)} (${safePct(r.pct)})`));
    }
    if(pr.highDiscNoTime.length) L.push(`Prioridade alta sem sessões no período: ${pr.highDiscNoTime.map(d => d.name).join(', ')}`);
    if(pr.total === 0 && !pr.highDiscNoTime.length) L.push('Sem sessões no período para comparar prioridades.');
  }

  section('TEMPO');
  const t = a.totals;
  L.push(`Tempo total: ${fmtDuration(t.minutes)}`);
  L.push(`Sessões: ${t.count}`);
  L.push(`Dias com estudo: ${t.activeDays} de ${a.days}`);
  L.push(`Média por dia do período: ${fmtDuration(t.avgPerDay)}`);
  L.push(`Média por dia com estudo: ${fmtDuration(t.avgPerActiveDay)}`);
  L.push(`Duração média da sessão: ${fmtDuration(t.avgSession)}`);
  L.push(`Créditos: ${fmtNumber(t.credits)}`);
  const cmp = a.previousComparison;
  L.push(cmp.available
    ? `Período anterior equivalente (${fmtDateBR(dateToISO(cmp.prevRange.start))} a ${fmtDateBR(dateToISO(cmp.prevRange.end))}): ${fmtDuration(cmp.prev.minutes)}${isNum(cmp.minutesDelta) ? ` (${cmp.minutesDelta >= 0 ? '+' : '−'}${fmtNumber(Math.abs(cmp.minutesDelta), 0)}%)` : ''}`
    : 'Período anterior equivalente: sem registros para comparar.');
  if(t.count){
    L.push('Por dia da semana:');
    a.byWeekday.forEach(x => bullet(`${x.label}: ${fmtDuration(x.minutes)}`));
    const typed = a.byType.filter(x => x.count > 0);
    if(typed.length){
      L.push('Por tipo de sessão:');
      typed.forEach(x => bullet(`${x.label}: ${x.count} (${safePct(x.pct)})`));
    }
    if(a.difficulty.avg !== null) L.push(`Dificuldade percebida média: ${fmtNumber(a.difficulty.avg, 1)}/5 (${plural(a.difficulty.count, 'registro', 'registros')})`);
  }

  section('PLANEJAMENTO');
  const pa = a.planAdherence;
  if(!pa.applicable) L.push('O plano semanal é definido por disciplina; não se aplica a um tópico isolado.');
  else if(!pa.hasPlan) L.push('Sem tempo planejado para este período.');
  else {
    L.push(`Planejado: ${fmtDuration(pa.planned)}`);
    L.push(`Realizado: ${fmtDuration(pa.realized)}`);
    L.push(`Plano cumprido: ${safePct(pa.pct)}`);
    L.push('Observação: semanas cortadas pelo período contam proporcionalmente.');
  }

  section('DISCIPLINAS');
  const discRows = a.scope.type === 'topic' ? [getDiscipline(a.scope.disciplineId)].filter(Boolean) : AnalyticsScope.disciplines(a.scope);
  const extraIds = a.byDiscipline.map(x => x.key).filter(id => !discRows.some(d => d.id === id));
  const discLines = discRows.map(d => ({ d, id:d.id, name:d.name }))
    .concat(extraIds.map(id => ({ d:getDiscipline(id), id, name:disciplineName(id) })));
  if(!discLines.length) L.push('Nenhuma disciplina neste escopo.');
  discLines.map(x => ({ ...x, g: a.byDiscipline.find(r => r.key === x.id), p: pa.perDiscipline.find(r => r.disciplineId === x.id) }))
    .sort((x,y) => ((y.g ? y.g.minutes : 0) - (x.g ? x.g.minutes : 0)) || x.name.localeCompare(y.name, 'pt-BR'))
    .forEach(x => {
      const parts = [];
      if(x.d) parts.push(`${AREA_TERM}: ${areaNameOf(x.d)}`, `prioridade ${PriorityEngine.text(x.d.priority)}`);
      if(x.d && x.d.archived) parts.push('arquivada');
      parts.push(`tempo ${x.g ? `${fmtDuration(x.g.minutes)} (${safePct(x.g.pct)})` : '0min'}`);
      if(x.p && x.p.planned > 0) parts.push(`plano ${fmtDuration(x.p.realized)} de ${fmtDuration(x.p.planned)} (${safePct(x.p.pct)})`);
      const prog = x.d ? a.content.perDiscipline.find(r => r.discipline.id === x.id) : null;
      if(prog && a.scope.type !== 'topic') parts.push(`conteúdo estudado ${prog.covered}/${prog.total}`);
      bullet(`${x.name} — ${parts.join(' · ')}`);
    });

  section('TÓPICOS');
  const topicsInScope = AnalyticsScope.topics(a.scope);
  if(!topicsInScope.length) L.push('Nenhum tópico cadastrado neste escopo.');
  else {
    const mins = new Map(a.byTopic.map(r => [r.key, r.minutes]));
    const ordered = topicsInScope.slice().sort((x,y) => ((mins.get(y.id) || 0) - (mins.get(x.id) || 0)) ||
      (PriorityEngine.clamp(y.priority) - PriorityEngine.clamp(x.priority)) || sortByName(x, y));
    const limit = 40;
    ordered.slice(0, limit).forEach(tp => {
      const parts = [a.scope.type === 'discipline' || a.scope.type === 'topic' ? null : disciplineName(tp.disciplineId),
        `prioridade ${PriorityEngine.text(tp.priority)}`, TOPIC_STATUS_LABEL[a.content.status.get(tp.id) || topicStatus(tp)],
        tp.masteryLevel ? `domínio ${tp.masteryLevel}/5` : null,
        `tempo no período ${fmtDuration(mins.get(tp.id) || 0)}`].filter(Boolean);
      bullet(`${tp.name} — ${parts.join(' · ')}`);
    });
    if(ordered.length > limit) L.push(`(e mais ${ordered.length - limit} tópicos sem tempo no período)`);
    const noTopic = mins.get('__none__');
    if(noTopic) L.push(`Sessões sem tópico definido: ${fmtDuration(noTopic)}`);
  }

  section('REVISÕES');
  const r = a.reviews;
  L.push(`Concluídas no período: ${r.completed}`);
  L.push(`Ainda previstas no período: ${r.scheduled}`);
  L.push(`Atrasadas agora: ${r.overdueNow}`);
  L.push(`Previstas para os próximos 7 dias: ${r.upcoming.length}`);
  if(r.completed){
    L.push('Resultados:');
    r.outcomes.forEach(o => bullet(`${o.label}: ${o.count}`));
  }
  if(r.byMethod.length){
    L.push('Métodos usados:');
    r.byMethod.forEach(m => bullet(`${m.label}: ${m.used}×`));
  }
  if(r.forgetful.length) L.push(`Esquecidos com mais frequência: ${r.forgetful.map(tp => `${tp.name} (${tp.reviewFailures}×)`).join(', ')}`);
  if(r.avgMastery !== null) L.push(`Domínio médio dos tópicos em revisão: ${fmtNumber(r.avgMastery, 1)}/5`);

  section('PRAZOS');
  const dls = a.deadlines;
  if(!dls.all.length) L.push('Nenhum prazo neste escopo.');
  else {
    const line = (dl, rel) => {
      const info = deadlineTypeInfo(dl.type);
      const where = dl.disciplineId ? disciplineName(dl.disciplineId) + (dl.topicId && getTopic(dl.topicId) ? ' › ' + getTopic(dl.topicId).name : '') : 'sem disciplina';
      return `${dl.title} — ${info.label} · ${fmtDateBR(dl.date)} (${DeadlineEngine.dueText(dl).toLowerCase()}) · prioridade ${PriorityEngine.text(dl.priority)} · ${deadlineStatusLabel(dl.status)} · ${where}${dl.startDate ? ` · início ${fmtDateBR(dl.startDate)}` : ''}${rel === 'discipline' ? ' · prazo da disciplina' : ''}`;
    };
    if(dls.open.length){ L.push('Em aberto:'); dls.open.forEach(x => bullet(line(x.dl, x.relation))); }
    if(dls.completedInRange.length){ L.push('Concluídos no período:'); dls.completedInRange.forEach(dl => bullet(line(dl))); }
    const doneOther = dls.all.filter(dl => DeadlineEngine.isDone(dl) && !dls.completedInRange.includes(dl)).length;
    if(doneOther) L.push(`Outros prazos concluídos (fora do período): ${doneOther}`);
  }

  section('PONTOS DE ATENÇÃO');
  const att = a.warnings.slice();
  a.attention.forEach(x => att.push(`${x.topic.name} (${x.discipline ? x.discipline.name : ''}): ${x.reasons.join('; ')}`));
  if(att.length) att.forEach(bullet); else L.push('Nenhum ponto de atenção.');

  section('PONTOS POSITIVOS');
  if(a.positives.length) a.positives.forEach(bullet); else L.push('Nenhum destaque positivo calculado para este período.');

  section('INSIGHTS');
  a.insights.forEach(bullet);

  section('INFORMAÇÕES');
  bullet(`Relatório gerado localmente pelo Ciclo ${APP_VERSION}. Nenhum dado foi enviado para a internet.`);
  bullet('Tempo, sessões e revisões concluídas consideram apenas o escopo e o período acima.');
  bullet('Conteúdo, domínio, revisões atrasadas e prazos em aberto mostram a situação no momento da geração.');
  bullet('Prioridades usam os valores atuais de cada disciplina, tópico e prazo.');
  bullet('Comentários das sessões, orientações e anotações pessoais dos prazos não são incluídos.');
  bullet('As observações descrevem fatos dos registros; não indicam causas.');
  return L.join('\n') + '\n';
}

async function downloadReport(a){
  const data = a || AnalyticsEngine.build(ui.period, ui.analyticsScope);
  try {
    const name = reportFilename(data);
    Backup.download(name, '\ufeff' + buildStudyReportText(data), 'text/plain;charset=utf-8');
    toast(name, 'ok', { title:'Relatório baixado' });
  } catch(err){
    console.error('Falha ao gerar o relatório:', err);
    toast('Tente novamente. Se continuar, use "Copiar resumo".', 'err', { title:'Não foi possível gerar o relatório' });
  }
}

async function copySummary(a){
  const text = buildSummaryText(a || AnalyticsEngine.build(ui.period, ui.analyticsScope));
  if(await copyToClipboard(text)){
    toast('Cole onde quiser: anotações, mensagem ou planilha.', 'ok', { title:'Resumo copiado' });
  } else {
    openModal(close => ({
      title:'Resumo do período',
      content: h('div',
        h('p', { class:'modal-sub', text:'Não foi possível copiar automaticamente. Selecione o texto abaixo e copie.' }),
        (() => { const ta = h('textarea', { style:'min-height:240px', readonly:true, 'aria-label':'Resumo do período' }); ta.value = text; setTimeout(() => { ta.focus(); ta.select(); }, 60); return ta; })()),
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
      selectField('hf-area', AREA_TERM, areaOpts, f.areaId, e => { f.areaId = e.target.value; f.disciplineId = ''; f.topicId = ''; renderHistory(); }),
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
            // v5.2.1 — antes só tema e animações eram reaplicados; a densidade
            // vinda do backup só valia depois de recarregar a página.
            applySettingsEffects();
            syncThemeControls();
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
   RENDER — despachante por tela
   ========================================================================= */
function render(){
  DerivedCache.bump();            // consultas derivadas sempre frescas a cada desenho
  AnalyticsEngine.invalidate();   // dados podem ter mudado sem passar por loadAll
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
  Overlay.bind();     // Esc/Tab/rolagem das camadas — antes de qualquer atalho global
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
  // v5.2.1 — no celular a barra de ferramentas é oculta; estas duas ações viviam
  // só nela e ficavam inalcançáveis. Agora existem também no cabeçalho móvel.
  const pm = $('#open-palette-m'); if(pm) pm.addEventListener('click', () => Palette.open());
  const hm = $('#screen-help-m');  if(hm) hm.addEventListener('click', () => openScreenHelp());
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
      if(Palette.isOpen){ Palette.close(); return; }
      // evita empilhar a busca sobre um modal/painel já aberto
      if(Overlay.isOpen) return;
      Palette.open();
      return;
    }

    // Esc de camadas já foi tratado pela pilha (Overlay.bind, em captura).
    if(e.key === 'Escape'){ Tooltip.hide(); return; }

    if(e.ctrlKey || e.metaKey || e.altKey) return;
    if(typing) return;
    if(Overlay.isOpen) return;                 // nenhum atalho global sob uma camada

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

  // v5.1 → v5.2: importância → prioridade (1–5) e prazos 2.0. Sem reagendar nada.
  try {
    await runV52Migration();
  } catch(err){
    console.error('Falha na migração v5.2:', err);
    toast('Seus dados continuam intactos. Recarregue a página para tentar de novo.', 'err',
      { title:'Não foi possível atualizar o formato de prioridades e prazos' });
  }

  await loadAll();
  const vEl = $('#app-version');
  if(vEl) vEl.textContent = 'v' + APP_VERSION;     // uma única fonte de verdade
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
  let offerTries = 0;
  setTimeout(function waitThenOffer(){
    // espera um modal de abertura sair, mas desiste em vez de sondar para sempre
    if(Overlay.isOpen && offerTries++ < 10){ setTimeout(waitThenOffer, 1200); return; }
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
  _layer: null,
  open(title, contentNode, opts){
    const root = document.getElementById('drawer-root');
    const o = opts || {};
    const wasOpen = !root.hidden;
    const opener = wasOpen ? undefined : document.activeElement;
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
      root.addEventListener('mousedown', this._onBackdrop);
      // Registrado na pilha: fica acima do modal que o abriu e é quem recebe o Esc.
      this._layer = Overlay.open(root, document.getElementById('drawer-panel'), () => Drawer.close(), { opener });
    }
    const focusable = document.getElementById('drawer-panel').querySelector('button,a,input,select,textarea');
    if(focusable) setTimeout(() => { if(!root.hidden) focusable.focus(); }, 40);
    // trocar de conteúdo encerra o contexto anterior (ex.: prazo aberto no painel)
    if(wasOpen && this._onCloseCb){ const prev = this._onCloseCb; this._onCloseCb = null; prev(); }
    this._onCloseCb = o.onClose || null;
  },
  close(){
    const root = document.getElementById('drawer-root');
    if(!root || root.hidden) return;
    root.hidden = true;
    clear(document.getElementById('drawer-content'));
    root.removeEventListener('mousedown', this._onBackdrop);
    Tooltip.hide();
    if(this._onCloseCb){ const cb = this._onCloseCb; this._onCloseCb = null; cb(); }
    Overlay.close(this._layer);                  // devolve o foco a quem abriu
    this._layer = null;
  },
  get isOpen(){ const r = document.getElementById('drawer-root'); return r && !r.hidden; },
  _onBackdrop(e){ if(e.target === document.getElementById('drawer-root')) Drawer.close(); }
};

/* =========================================================================
   COMMAND PALETTE — navegação, disciplinas, tópicos, ajuda e ações.
   ========================================================================= */
const Palette = {
  items: [],
  filtered: [],
  index: 0,
  _layer: null,

  buildIndex(){
    const items = [];
    const push = (group, label, sub, icon, run, searchExtra) => items.push({ group, label, sub, icon, run, n: normalizeText(label + ' ' + (sub||'') + ' ' + (searchExtra||'')) });

    Object.keys(VIEW_TITLES).forEach(v => {
      push('Navegação', VIEW_TITLES[v], null, NAV_ICONS[v] || 'i-arrow', () => setView(v));
    });

    push('Ações', 'Registrar sessão', 'abre o cronômetro ou o registro manual', 'i-plus', () => openRegisterModal(), 'estudar iniciar timer');
    push('Ações', 'Adicionar prazo', 'prova, trabalho, projeto, tarefa ou entrega', 'i-plan', () => openDeadlineModal(null), 'prazo prova trabalho entrega projeto tarefa data');
    push('Ações', 'Nova Área de Estudo', 'organizar disciplinas relacionadas', 'i-disc', () => openAreaModal(null), 'area organizar agrupar');
    push('Ações', 'Nova disciplina', null, 'i-disc', () => openDisciplineModal(null), 'disciplina materia adicionar');
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

    DeadlineEngine.open().forEach(dl => {
      push('Prazos', dl.title, DeadlineEngine.dueText(dl), 'i-plan', () => openDeadlineDrawer(dl.id), 'prazo ' + deadlineTypeInfo(dl.type).label);
    });

    state.topics.filter(t => !t.archived).forEach(t => {
      const d = getDiscipline(t.disciplineId);
      if(!d || d.archived) return;
      push('Tópicos', t.name, d.name, 'i-disc', () => { if(isDesktopUI()) openTopicDrawer(t.id); else openTopicModal(d.id, t, { returnTo:false }); }, 'topico estudar ' + d.name);
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
    if(this.isOpen) return;
    this.buildIndex();
    const root = document.getElementById('palette-root');
    const input = document.getElementById('palette-input');
    root.hidden = false;
    input.value = '';
    this.filter('');
    document.addEventListener('keydown', this._onKey, true);
    root.addEventListener('mousedown', this._onBackdrop);
    // Esc, Tab e rolagem de fundo ficam com a pilha; setas e Enter continuam aqui.
    this._layer = Overlay.open(root, root.querySelector('.palette'), () => Palette.close());
    setTimeout(() => input.focus(), 30);
  },

  close(){
    const root = document.getElementById('palette-root');
    if(!root || root.hidden) return;
    root.hidden = true;
    document.removeEventListener('keydown', this._onKey, true);
    root.removeEventListener('mousedown', this._onBackdrop);
    Overlay.close(this._layer);
    this._layer = null;
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
    if(e.key === 'ArrowDown'){ e.preventDefault(); Palette.move(1); }
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
  _layer: null,
  enter(){
    if(!TimerService.isActive){ toast('Inicie uma sessão para usar o modo foco.', 'err'); return; }
    if(this.isOpen) return;
    const root = document.getElementById('focus-root');
    root.hidden = false;
    document.documentElement.classList.add('focus-active');
    this.render();
    this.tick = setInterval(() => this.renderClock(), 1000);
    this._layer = Overlay.open(root, root.querySelector('.focus-inner'), () => FocusMode.exit());
    const first = document.querySelector('#focus-actions button');
    if(first) setTimeout(() => first.focus(), 40);
  },
  exit(){
    const root = document.getElementById('focus-root');
    if(!root || root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove('focus-active');
    clearInterval(this.tick); this.tick = null;
    Overlay.close(this._layer);
    this._layer = null;
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
  }
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
  analytics:   { id:'analytics-v52',     title:'Como ler suas análises',
                 steps:['Escolha o que analisar: tudo, uma Área de Estudo, uma disciplina ou um tópico.',
                        'Escolha o período: hoje, esta semana, este mês ou as datas que quiser.',
                        'Leia o resumo e os cartões principais. Clique em um cartão para ver os detalhes.',
                        'Quando quiser ir mais fundo, use o calendário, os gráficos e as observações.'] },
  disciplines: { id:'disciplines-v52',   title:'Área de Estudo → Disciplina → Tópico',
                 text:'A disciplina é o que você estuda; os tópicos são as partes dela. A Área de Estudo é opcional e só organiza. Dê prioridade de 1 a 5 quando quiser.' }
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
    h('div', { class:'tip-main' }, h('strong', { text:tip.title }),
      tip.steps ? h('ol', { class:'tip-steps' }, tip.steps.map(x => h('li', { text:x }))) : h('span', { text:tip.text })),
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

  const tDeadlines = state.deadlines.filter(dl => !DeadlineEngine.isDone(dl) &&
    (dl.topicId === t.id || (!dl.topicId && dl.disciplineId === t.disciplineId)))
    .sort((a,b) => str(a.date).localeCompare(str(b.date)));

  const body = h('div',
    h('p', { class:'detail-path' },
      h('span', { class:'dp-kicker', text:'Tópico de' }),
      h('span', { text: disc ? disciplinePath(disc) : '' })),
    h('div', { class:'prio-pair' },
      h('div', { class:'detail-prio' }, h('span', { text:'Prioridade do tópico' }), priorityChip(t.priority)),
      disc ? h('div', { class:'detail-prio muted' }, h('span', { text:'Prioridade da disciplina' }), priorityChip(disc.priority)) : null),
    h('p', { class:'hint', style:'margin:6px 0 14px', text: PriorityEngine.hint(t.priority, 'topic') }),
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
    tDeadlines.length ? h('div', { style:'margin-bottom:16px' },
      h('p', { class:'section-label', text:'Prazos relacionados' }),
      h('div', { class:'dl-mini-list' }, tDeadlines.slice(0, 3).map(dl => deadlineMiniRow(dl)))) : null,
    h('p', { class:'card-title', text:'Sessões recentes' }),
    recent,
    h('div', { class:'row auto', style:'margin-top:16px' },
      h('button', { class:'btn primary sm', type:'button', text:'Estudar', onclick:() => { Drawer.close(); startTimer(t.disciplineId, t.id, null); } }),
      t.reviewEnabled ? h('button', { class:'btn ghost sm', type:'button', text:'Revisar', onclick:() => { Drawer.close(); startTimer(t.disciplineId, t.id, 'revisao'); } }) : null,
      h('button', { class:'btn ghost sm', type:'button', text:'Editar', onclick:() => { Drawer.close(); openTopicModal(t.disciplineId, t); } }),
      disc ? h('button', { class:'linkbtn', type:'button', text:'ver disciplina', onclick:() => openDisciplineDetail(disc.id) }) : null)
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
  // dueText já concorda com o tipo do prazo ("Prova venceu há 2 dias"),
  // enquanto fmtRelativeFuture é escrito no feminino (serve às revisões).
  if(f.deadline) rows.push(['Prazo', DeadlineEngine.dueText(f.deadline.dl)]);

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
  // v5.2: a Área de Estudo é opcional e tem seu próprio convite discreto;
  // por isso não entra nesta lista. O plano semanal fica por último.
  const hasPlan = !!PlannerEngine.activePlan();
  const hasDiscipline = activeDisciplines().length > 0;
  const hasTopic = state.topics.some(t => !t.archived);
  const hasSession = state.sessions.length > 0;
  const understandsReview = ReviewEngine.allScheduled().length > 0 || !!state.meta.reviewPrimerSeen;

  return [
    { id:'disc',    done:hasDiscipline, label:'Adicione uma disciplina',
      action:{ text:'Adicionar disciplina', run:() => { setView('disciplines'); setTimeout(() => openDisciplineModal(null), 250); } } },
    { id:'session', done:hasSession,    label:'Faça sua primeira sessão',
      action:{ text:'Registrar sessão', run:() => openRegisterModal() } },
    { id:'topic',   done:hasTopic,      label:'Adicione seu primeiro tópico',
      action:{ text:'Adicionar tópico', run:() => {
        const d = activeDisciplines()[0];
        if(d) openTopicModal(d.id, null); else setView('disciplines');
      } } },
    { id:'review',  done:understandsReview, label:'Entenda sua primeira revisão',
      action:{ text:'Ver como funciona', run:openReviewPrimer } },
    { id:'plan',    done:hasPlan,       label:'Defina seu tempo semanal',
      action:{ text:'Definir agora', run:() => setView('plan') } }
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

/* =========================================================================
   NOVIDADES DA VERSÃO — uma única vez, para quem já usava.
   ========================================================================= */
function maybeShowWhatsNew(){
  if(state.settings.seenWhatsNew === APP_VERSION) return;
  // usuário realmente novo não precisa de "novidades": ele tem o onboarding
  if(!state.sessions.length && !activeDisciplines().length) return;

  const markSeen = async () => { state.settings.seenWhatsNew = APP_VERSION; await saveSettings(); };
  const seen = str(state.settings.seenWhatsNew);
  const cameFrom52 = /^5\.2/.test(seen);          // já viu as novidades da 5.2
  const cameFrom51 = /^5\.1/.test(seen);
  const mig = state.meta.v52MigrationSummary || {};
  const converted = isNum(mig.topics) && mig.topics > 0
    ? `A importância de ${mig.topics} ${mig.topics === 1 ? 'tópico foi convertida' : 'tópicos foi convertida'} para a nova escala (baixa → 2, normal → 3, alta → 4). Nenhuma revisão foi reagendada.`
    : 'Tópicos e prazos antigos foram convertidos para a nova escala. Nenhuma revisão foi reagendada.';

  /* v5.2.1 — quem já viu as novidades da 5.2 não deve receber o anúncio da 5.2
     de novo só porque a versão mudou. Recebe a nota curta de estabilização. */
  const cfg = cameFrom52
    ? { title:'Ciclo 5.2.1',
        sub:'Uma atualização de acabamento. Seus dados, revisões, prazos e planos continuam como estavam.',
        items:[
          'Correções de estabilidade, acessibilidade e acabamento visual em todas as telas.',
          'Telas Hoje e Disciplinas bem mais rápidas com muitas disciplinas e sessões.',
          'Restauração de backup mais segura: agora acontece em uma operação única.',
          'No celular, a busca e a "Ajuda desta tela" ficaram acessíveis no topo.'
        ],
        note:null }
    : { title:'Novidades do Ciclo 5.2',
        sub: cameFrom51
          ? 'Seus dados, revisões e planos continuam como estavam.'
          : 'O Diário de Estudos agora se chama Ciclo. Seus dados, revisões e planos continuam como estavam.',
        items:[
          'Estrutura em três níveis: Área de Estudo → Disciplina → Tópico. A Área de Estudo continua opcional.',
          'Uma só escala de prioridade, de 1 (muito baixa) a 5 (muito alta), para disciplinas, tópicos e prazos.',
          'Prazos completos: tipo, data de início, status, orientações e anotações.',
          'Análises novas: escolha o que analisar e o período, clique nos cartões para ver detalhes e baixe um relatório em texto.'
        ],
        note: converted };

  openModal(close => ({
    title: cfg.title,
    content: h('div', { class:'whats-new' },
      h('div', { class:'wn-brand', 'aria-hidden':'true' }, icon('i-brand', 'welcome-icon')),
      h('p', { class:'modal-sub', text: cfg.sub }),
      h('ul', { class:'reasons' }, cfg.items.map(x => h('li', { text:x }))),
      cfg.note ? h('p', { class:'hint', style:'margin-top:10px', text: cfg.note }) : null),
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
        h('p', { class:'hint', id:'wc-ex', style:'margin-bottom:12px', text:'Pode ser uma matéria, um idioma, uma certificação ou qualquer outra coisa que você queira aprender. Depois você adiciona mais.' }),
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

    /* --- tópico (opcional) --- */
    const topicField = h('div', { class:'field' });
    function buildTopicField(){
      clear(topicField);
      const known = disciplineId ? topicsOf(disciplineId) : [];
      topicField.append(h('label', { for:'qs-topic' }, 'Tópico ', h('span', { class:'optional', text:'opcional' })));
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
        title:'Adicionar como tópico?',
        content: h('div',
          h('p', { class:'modal-sub', text:`"${topicName}" ainda não está em ${disc.name}.` }),
          h('p', { class:'hint', text:'Adicionar permite que o Ciclo acompanhe suas revisões e seu progresso nesse tópico. Também dá para seguir sem adicionar.' })),
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
              toast(`${topicName} · ${disc.name}`, 'ok', { title:'Tópico adicionado' });
              startTimer(disc.id, t.id, null);
            } catch(err){
              console.error(err);
              toast('Não foi possível adicionar o tópico. A sessão continua.', 'err');
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
  openDisciplines: () => setView('disciplines'),
  addDeadline:   () => openDeadlineModal(null),
  openAnalytics: () => setView('analytics')
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
  if(tree.area) box.append(h('div', { class:'tree-area' }, h('span', { class:'tree-tag', text:AREA_TERM }), tree.area));
  box.append(h('div', { class:'tree-disc' }, h('span', { class:'tree-tag', text:'Disciplina' }), tree.discipline));
  (tree.topics || []).forEach(t =>
    box.append(h('div', { class:'tree-topic' }, h('span', { class:'tree-tag', text:'Tópico' }), t)));
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

/** v5.2 — Demonstração da estrutura: troca de exemplo e vê a árvore mudar. */
function structureDemoNode(){
  const list = HIERARCHY_EXAMPLES;
  const box = h('div', { class:'demo' });
  const treeSlot = h('div', { 'aria-live':'polite' });
  const chips = h('div', { class:'chips', role:'group', 'aria-label':'Exemplos', style:'margin:8px 0 12px' });
  const show = (i) => {
    $$('.chip', chips).forEach((c, k) => c.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
    const ex = list[i];
    mount(treeSlot, guideTree({ area: ex.area, discipline: ex.discipline, topics: ex.topics }),
      h('p', { class:'hint', style:'margin-top:8px', text: ex.note }));
  };
  list.forEach((ex, i) => chips.append(h('button', { class:'chip', type:'button', 'aria-pressed':'false', text: ex.label, onclick:() => show(i) })));
  box.append(h('p', { class:'demo-label', text:'EXPERIMENTE' }),
    h('p', { class:'hint', text:'Escolha um exemplo para ver como os três níveis se encaixam.' }), chips, treeSlot,
    h('p', { class:'demo-note', text:'Este é só um exemplo. Nada aqui é salvo nos seus dados.' }));
  show(0);
  return box;
}

/** v5.2 — Demonstração da escala de prioridade. */
function priorityDemoNode(){
  const box = h('div', { class:'demo' });
  const out = h('p', { class:'hint', 'aria-live':'polite', style:'margin-top:10px' });
  const update = (v) => {
    const mult = { 1:'um pouco mais espaçadas', 2:'levemente mais espaçadas', 3:'no ritmo normal', 4:'levemente mais próximas', 5:'um pouco mais próximas' }[v];
    out.textContent = `Com prioridade ${PriorityEngine.text(v)}, as revisões deste tópico ficam ${mult}. O resultado de cada revisão continua sendo o que mais pesa.`;
  };
  box.append(h('p', { class:'demo-label', text:'EXPERIMENTE' }),
    h('p', { class:'hint', style:'margin-bottom:8px', text:'Tópico de exemplo: Derivadas (Matemática).' }),
    priorityPicker({ value:3, context:'topic', id:'demo-prio', label:'Prioridade do tópico', onChange: update }),
    out,
    h('p', { class:'demo-note', text:'Este é só um exemplo. Nada aqui é salvo nos seus dados.' }));
  update(3);
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
    h('div', null, h('div', { text:r.name }), h('div', { class:'hint', text:'Prioridade ' + PriorityEngine.text(r.priority) })),
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
    g.demo === 'structure' ? structureDemoNode() : null,
    g.demo === 'priority' ? priorityDemoNode() : null,
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
      h('p', { class:'prose', style:'margin-top:8px', text:'Tente responder sem consultar seu material. Depois você diz como foi — e o Ciclo decide quando esse tópico deve voltar.' }),
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
  if(Overlay.isOpen) return;                      // nunca empilha sobre outra camada
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

  // (a) disciplinas com prazo ativo em até 10 dias que ainda não estão intensivas
  const candidatas = [];
  activeDisciplines().forEach(d => {
    if(d.reviewStrategy === 'intensive') return;
    if(state.meta['intensiveDismissed_' + d.id]) return;
    const x = state.deadlines
      .filter(dl => dl.disciplineId === d.id && DeadlineEngine.isActive(dl))
      .map(dl => ({ dl, days: DeadlineEngine.daysLeft(dl) }))
      .filter(e => e.days <= 10)
      .sort((a,b) => a.days - b.days)[0];
    if(x && topicsOf(d.id).some(t => t.reviewEnabled)) candidatas.push({ d, x });
  });

  candidatas.slice(0, 2).forEach(({ d, x }) => {
    const info = deadlineTypeInfo(x.dl.type);
    box.append(h('div', { class:'card elevated suggestion' },
      h('p', { class:'hint prose', style:'margin-bottom:10px',
        text:`${info.label}: ${DeadlineEngine.phrase(x.dl)}, em ${d.name}. Quer usar revisão intensiva nesta disciplina até lá? Os intervalos ficam mais curtos. Nada muda sem a sua confirmação.` }),
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
  });

  // (b) intensiva sem prazo futuro: oferecer voltar ao ritmo normal.
  // v5.1: um prazo HOJE (0 dias) conta como futuro — antes `0 || -1` o descartava —
  // e "Continuar intensiva" passa a ser respeitado (antes o aviso reaparecia sempre).
  const expiradas = activeDisciplines().filter(d => {
    if(d.reviewStrategy !== 'intensive') return false;
    if(state.meta['intensiveKeep_' + d.id]) return false;
    return !state.deadlines.some(x => {
      if(DeadlineEngine.isDone(x) || x.disciplineId !== d.id) return false;
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
