/*
  app.js - ES -> PTBR trainer (full version)
  Features:
  - SRS (SM-2 simplified)
  - Tolerant correction (token overlap + Levenshtein)
  - Weighted queue / intelligent scheduling
  - History in localStorage
  - Dark mode, dashboard, export/reset
  - TTS in es-MX (Latino-Americana)
*/

const DATA_PATH = 'data/frases_es.json';
const STORAGE_KEY = 'srs_es_progress_v1';
const HISTORY_KEY = 'srs_es_history_v1';

let frases = [];
let srs = {};
let current = null;

const today = new Date().toISOString().slice(0,10);

const el = {
  linha: document.getElementById('linha'),
  frase: document.getElementById('fraseESP'),
  resposta: document.getElementById('resposta'),
  resultado: document.getElementById('resultado'),
  listenBtn: document.getElementById('listenBtn'),
  checkBtn: document.getElementById('checkBtn'),
  skipBtn: document.getElementById('skipBtn'),
  due: document.getElementById('due'),
  totalCount: document.getElementById('totalCount'),
  dueCount: document.getElementById('dueCount'),
  todayCorrect: document.getElementById('todayCorrect'),
  todayWrong: document.getElementById('todayWrong'),
  dashboard: document.getElementById('dashboard'),
  openDashboard: document.getElementById('openDashboard'),
  historyPanel: document.getElementById('historyPanel'),
  historyList: document.getElementById('historyList'),
  closeHistory: document.getElementById('closeHistory'),
  toggleTheme: document.getElementById('toggleTheme'),
  exportBtn: document.getElementById('exportBtn'),
  resetBtn: document.getElementById('resetBtn'),
  downloadData: document.getElementById('downloadData')
};

/* ============================================================
   NORMALIZAÇÃO + CORREÇÃO TOLERANTE
   ============================================================ */

function norm(s){
  if(!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[\"'`.,;:!?()\-]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function levenshtein(a,b){
  const m=[];
  for(let i=0;i<=a.length;i++) m[i]=[i];
  for(let j=0;j<=b.length;j++) m[0][j]=j;

  for(let i=1;i<=a.length;i++){
    for(let j=1;j<=b.length;j++){
      const cost = a[i-1]===b[j-1]?0:1;
      m[i][j]=Math.min(
        m[i-1][j]+1,
        m[i][j-1]+1,
        m[i-1][j-1]+cost
      );
    }
  }
  return m[a.length][b.length];
}

function isCorrect(user,target){
  const a = norm(user);
  const b = norm(target);

  if(a.length === 0) return false;
  if(a === b) return true;

  // Overlap de tokens ≥ 40%
  const at = a.split(" ");
  const bt = b.split(" ");
  const common = at.filter(t => bt.includes(t)).length;
  const ratio = common / Math.max(bt.length,1);

  if(ratio >= 0.40) return true;

  // Levenshtein ≤ 30%
  const dist = levenshtein(a,b);
  const maxDist = Math.ceil(b.length * 0.30);

  return dist <= maxDist;
}

/* ============================================================
   ARMAZENAMENTO LOCAL
   ============================================================ */

function loadJSON(path){ return fetch(path).then(r=>r.json()); }

function loadProgress(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) srs = JSON.parse(raw);
}

function saveProgress(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(srs));
}

function loadHistory(){
  const raw = localStorage.getItem(HISTORY_KEY);
  if(!raw) return [];
  try { return JSON.parse(raw); } catch(e){ return []; }
}

function pushHistory(entry){
  const h = loadHistory();
  h.unshift(entry);
  if(h.length > 500) h.length = 500;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

/* ============================================================
   SRS - INICIALIZAÇÃO
   ============================================================ */

function initSRS(linha){
  if(!srs[linha]){
    srs[linha] = {
      linha,
      interval: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      due: today,
      corrects: 0,
      wrongs: 0,
      lastAnswer: null
    };
  }
}

function initAll(){
  frases.forEach(f => initSRS(f.linha));
  saveProgress();
}

/* ============================================================
   SRS - SELEÇÃO DE CARTÃO (FILA INTELIGENTE)
   ============================================================ */

function computeDueCount(){
  const now = new Date().toISOString().slice(0,10);
  const due = Object.values(srs).filter(x => x.due <= now).length;
  el.dueCount.textContent = due;
  el.totalCount.textContent = frases.length;
}

function pickNext(){
  const now = new Date().toISOString().slice(0,10);

  let due = frases.filter(f => srs[f.linha].due <= now);

  if(due.length === 0){
    return frases.slice().sort((a,b)=>
      new Date(srs[a.linha].due) - new Date(srs[b.linha].due)
    )[0];
  }

  const weighted = due.map(f => {
    const meta = srs[f.linha];
    const weight = 1 + meta.lapses*3 + (meta.interval===0 ? 2 : 0);
    return {f, weight};
  });

  const total = weighted.reduce((s,w)=>s+w.weight,0);
  let r = Math.random() * total;

  for(const w of weighted){
    r -= w.weight;
    if(r <= 0) return w.f;
  }

  return weighted[weighted.length-1].f;
}

/* ============================================================
   RENDER E FALA
   ============================================================ */

function renderCard(card){
  current = card;
  el.linha.textContent = card.linha;
  el.frase.textContent = card.ESP;
  el.resposta.value = "";
  el.resultado.innerHTML = "";
  el.due.textContent = srs[card.linha].due;
}

function speak(text){
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";     // <- VOZ ESPANHA
  u.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* ============================================================
   SRS - APLICAÇÃO DO RESULTADO
   ============================================================ */

function applySRS(meta, correct){
  if(correct){
    meta.reps += 1;
    meta.corrects++;

    if(meta.reps === 1) meta.interval = 1;
    else if(meta.reps === 2) meta.interval = 3;
    else meta.interval = Math.round(meta.interval * meta.ease);

    meta.ease = Math.max(1.3, meta.ease + 0.03);

  } else {
    meta.lapses++;
    meta.wrongs++;
    meta.reps = 0;
    meta.interval = 0;
    meta.ease = Math.max(1.3, meta.ease - 0.15);
  }

  const next = new Date();
  next.setDate(next.getDate() + meta.interval);
  meta.due = next.toISOString().slice(0,10);
  meta.lastAnswer = new Date().toISOString();

  saveProgress();
}

/* ============================================================
   FEEDBACK AO USUÁRIO
   ============================================================ */

function showFeedback(correct, expected){
  if(correct){
    el.resultado.innerHTML = `
      <div class="ok">
        ✅ Correto!
        <br><small>${expected}</small>
      </div>`;
  } else {
    el.resultado.innerHTML = `
      <div class="bad">
        ❌ Incorreto.
        <br><strong>${expected}</strong>
      </div>`;
  }
}

/* ============================================================
   HANDLERS
   ============================================================ */

function handleCheck(){
  const ans = el.resposta.value.trim();
  const expected = current.PTBR;
  const correct = isCorrect(ans, expected);

  applySRS(srs[current.linha], correct);

  pushHistory({
    linha: current.linha,
    esp: current.ESP,
    answer: ans,
    correct,
    ptbr: expected,
    time: new Date().toISOString()
  });

  renderStats();
  showFeedback(correct, expected);
}

function handleSkip(){
  applySRS(srs[current.linha], false);
  pushHistory({
    linha: current.linha,
    esp: current.ESP,
    skipped: true,
    correct: false,
    ptbr: current.PTBR,
    time: new Date().toISOString()
  });
  renderStats();
  nextCard();
}

function nextCard(){
  renderCard(pickNext());
}

/* ============================================================
   HISTÓRICO E DASHBOARD
   ============================================================ */

function renderStats(){
  computeDueCount();
  const h = loadHistory();
  const t = today;

  el.todayCorrect.textContent = h.filter(x => x.time.slice(0,10)===t && x.correct).length;
  el.todayWrong.textContent = h.filter(x => x.time.slice(0,10)===t && !x.correct).length;
}

function renderHistoryPanel(){
  const h = loadHistory();
  el.historyList.innerHTML = "";

  h.slice(0,200).forEach(e=>{
    const li = document.createElement("li");
    li.innerHTML = `
      <small>${e.time}</small> —
      <strong>#${e.linha}</strong> —
      "${e.esp}"
      — ${e.correct ? "<span style='color:green'>✔</span>" : "<span style='color:red'>✖</span>"}
    `;
    el.historyList.appendChild(li);
  });
}

/* ============================================================
   DARK MODE, EXPORT, RESET
   ============================================================ */

function tryLoadTheme(){
  const t = localStorage.getItem("ui_theme");

  if(t){
    document.documentElement.setAttribute("data-theme", t);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }
}

function exportSRS(){
  const blob = new Blob([JSON.stringify(srs,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "srs_es_export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function resetProgress(){
  if(!confirm("Tem certeza que quer resetar TODO o progresso?")){
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
  srs = {};
  initAll();
  renderStats();
  nextCard();
}

/* ============================================================
   EVENTOS
   ============================================================ */

el.listenBtn.addEventListener("click", ()=> speak(current.ESP));
el.checkBtn.addEventListener("click", handleCheck);
el.skipBtn.addEventListener("click", handleSkip);

el.openDashboard.addEventListener("click", ()=>{
  el.dashboard.classList.toggle("hidden");
  renderStats();
});

el.toggleTheme.addEventListener("click", ()=>{
  const root = document.documentElement;
  const currentTheme = root.getAttribute("data-theme");
  const next = currentTheme === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("ui_theme", next);
});

if(el.closeHistory){
  el.closeHistory.addEventListener("click", ()=>{
    el.historyPanel.classList.add("hidden");
  });
}

if(el.exportBtn){
  el.exportBtn.addEventListener("click", exportSRS);
}

if(el.resetBtn){
  el.resetBtn.addEventListener("click", resetProgress);
}

if(el.downloadData){
  el.downloadData.addEventListener("click", ()=>{
    const data = { srs, history: loadHistory() };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    el.downloadData.href = url;
  });
}

/* ============================================================
   BOOT
   ============================================================ */

async function boot(){
  try{
    frases = await loadJSON(DATA_PATH);
  } catch(e){
    el.frase.textContent = "Erro ao carregar data/frases_es.json";
    console.error("Erro:", e);
    return;
  }

  loadProgress();
  initAll();
  renderStats();
  nextCard();
  tryLoadTheme();
}

boot();
