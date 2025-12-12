/*
  app_es.js
  Español → PTBR
  - dataset: data/frases_es.json
  - TTS: es-ES (Espanha)
  - CEFR adaptativo (AUTO)
  - SRS (SM-2 simplificado)
  - Anti-falso-positivo: overlap >=55% ou Levenshtein <=18%
  - Código limpo (sem logs)
*/

const DATA_PATH_ES = "data/frases_es.json";
const STORAGE_KEY_ES = "srs_es_progress_v1";
const HISTORY_KEY_ES = "srs_es_history_v1";

let frasesEs = [];
let srsEs = {};
let currentEs = null;

let nivelAtualEs = "A1";
let janelaContagemEs = 0;
let acertosJanelaEs = 0;

const todayStrEs = new Date().toISOString().slice(0,10);

/* DOM elements (must exist in your ESP index.html) */
const elEs = {
  linha: document.getElementById("linha"),
  frase: document.getElementById("fraseESP"),
  resposta: document.getElementById("resposta"),
  resultado: document.getElementById("resultado"),
  listenBtn: document.getElementById("listenBtn"),
  checkBtn: document.getElementById("checkBtn"),
  skipBtn: document.getElementById("skipBtn"),
  due: document.getElementById("due"),
  totalCount: document.getElementById("totalCount"),
  dueCount: document.getElementById("dueCount"),
  todayCorrect: document.getElementById("todayCorrect"),
  todayWrong: document.getElementById("todayWrong"),
  dashboard: document.getElementById("dashboard"),
  historyPanel: document.getElementById("historyPanel"),
  historyList: document.getElementById("historyList"),
  closeHistory: document.getElementById("closeHistory"),
  openDashboard: document.getElementById("openDashboard"),
  toggleTheme: document.getElementById("toggleTheme"),
  exportBtn: document.getElementById("exportBtn"),
  resetBtn: document.getElementById("resetBtn"),
  downloadData: document.getElementById("downloadData")
};

/* ---------- Normalization & matching ---------- */
function normTextEs(s){
  if(!s) return "";
  return s.toString()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[\"'`.,;:!?()\-¿¡]/g,"")
    .replace(/\s+/g," ")
    .trim();
}

function levenshteinEs(a,b){
  const m = [];
  for(let i=0;i<=a.length;i++) m[i]=[i];
  for(let j=0;j<=b.length;j++) m[0][j]=j;
  for(let i=1;i<=a.length;i++){
    for(let j=1;j<=b.length;j++){
      const cost = a[i-1]===b[j-1]?0:1;
      m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+cost);
    }
  }
  return m[a.length][b.length];
}

function isCorrectEs(user, target){
  const a = normTextEs(user);
  const b = normTextEs(target);
  if(a.length===0) return false;
  if(a === b) return true;

  const at = a.split(" ");
  const bt = b.split(" ");
  const common = at.filter(t => bt.includes(t)).length;
  const ratio = common / Math.max(bt.length,1);
  if(ratio >= 0.55) return true;

  const dist = levenshteinEs(a,b);
  const maxDist = Math.ceil(b.length * 0.18);
  return dist <= maxDist;
}

/* ---------- Storage & history ---------- */
function loadProgressEs(){
  const raw = localStorage.getItem(STORAGE_KEY_ES);
  if(raw) try { srsEs = JSON.parse(raw); } catch(e){ srsEs = {}; }
}

function saveProgressEs(){
  localStorage.setItem(STORAGE_KEY_ES, JSON.stringify(srsEs));
}

function loadHistoryEs(){
  const raw = localStorage.getItem(HISTORY_KEY_ES);
  if(!raw) return [];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

function pushHistoryEs(entry){
  const h = loadHistoryEs();
  h.unshift(entry);
  if(h.length > 500) h.length = 500;
  localStorage.setItem(HISTORY_KEY_ES, JSON.stringify(h));
}

/* ---------- SRS init ---------- */
function initSrsEntryEs(linha){
  if(!srsEs[linha]){
    srsEs[linha] = {
      linha,
      reps: 0,
      ease: 2.5,
      interval: 0,
      lapses: 0,
      corrects: 0,
      wrongs: 0,
      due: todayStrEs
    };
  }
}

function initAllEs(){
  frasesEs.forEach(f => initSrsEntryEs(f.linha));
  saveProgressEs();
}

/* ---------- Selection & stats ---------- */
function computeDueCountEs(){
  const now = new Date().toISOString().slice(0,10);
  const due = Object.values(srsEs).filter(x => x.due <= now).length;
  if(elEs.dueCount) elEs.dueCount.textContent = due;
  if(elEs.totalCount) elEs.totalCount.textContent = frasesEs.length;
}

function pickNextEs(){
  const now = new Date().toISOString().slice(0,10);
  let candidates = frasesEs.filter(f => srsEs[f.linha] && srsEs[f.linha].due <= now);

  if(candidates.length === 0){
    candidates = frasesEs.filter(f => f.nivel === nivelAtualEs);
    if(candidates.length === 0) candidates = frasesEs.slice();
  }

  const weighted = candidates.map(f => {
    const meta = srsEs[f.linha] || {lapses:0, interval:0};
    const weight = 1 + (meta.lapses || 0) * 3 + ((meta.interval || 0) === 0 ? 2 : 0);
    return {f, weight};
  });

  const total = weighted.reduce((s,w) => s + w.weight, 0);
  let r = Math.random() * total;
  for(const w of weighted){
    r -= w.weight;
    if(r <= 0) return w.f;
  }
  return weighted[weighted.length - 1].f;
}

/* ---------- Render & TTS ---------- */
function renderCardEs(card){
  currentEs = card;
  if(elEs.linha) elEs.linha.textContent = card.linha;
  if(elEs.frase) elEs.frase.textContent = card.ESP || card.ESP;
  if(elEs.resposta) elEs.resposta.value = "";
  if(elEs.resultado) elEs.resultado.innerHTML = "";
  if(elEs.due && srsEs[card.linha]) elEs.due.textContent = srsEs[card.linha].due;
}

function speakEs(text){
  if(!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* ---------- Apply SRS ---------- */
function applySrsEs(meta, correct){
  if(correct){
    meta.reps = (meta.reps || 0) + 1;
    meta.corrects = (meta.corrects || 0) + 1;
    if(meta.reps === 1) meta.interval = 1;
    else if(meta.reps === 2) meta.interval = 3;
    else meta.interval = Math.round((meta.interval || 1) * meta.ease);
    meta.ease = Math.max(1.3, (meta.ease || 2.5) + 0.03);
  } else {
    meta.lapses = (meta.lapses || 0) + 1;
    meta.wrongs = (meta.wrongs || 0) + 1;
    meta.reps = 0;
    meta.interval = 0;
    meta.ease = Math.max(1.3, (meta.ease || 2.5) - 0.15);
  }
  const next = new Date();
  next.setDate(next.getDate() + (meta.interval || 0));
  meta.due = next.toISOString().slice(0,10);
  saveProgressEs();
}

/* ---------- Adaptive ---------- */
function updateAdaptiveEs(correct){
  janelaContagemEs++;
  if(correct) acertosJanelaEs++;
  if(janelaContagemEs >= 12){
    const acc = acertosJanelaEs / janelaContagemEs;
    if(acc >= 0.75){
      if(nivelAtualEs === "A1") nivelAtualEs = "A2";
      else if(nivelAtualEs === "A2") nivelAtualEs = "B1";
      else if(nivelAtualEs === "B1") nivelAtualEs = "B2";
      else if(nivelAtualEs === "B2") nivelAtualEs = "C1";
    } else if(acc <= 0.35){
      if(nivelAtualEs === "C1") nivelAtualEs = "B2";
      else if(nivelAtualEs === "B2") nivelAtualEs = "B1";
      else if(nivelAtualEs === "B1") nivelAtualEs = "A2";
      else if(nivelAtualEs === "A2") nivelAtualEs = "A1";
    }
    janelaContagemEs = 0;
    acertosJanelaEs = 0;
  }
}

/* ---------- Handlers ---------- */
function handleCheckEs(){
  const user = elEs.resposta ? elEs.resposta.value.trim() : "";
  const expected = currentEs ? currentEs.PTBR : "";
  const correct = isCorrectEs(user, expected);

  const meta = srsEs[currentEs.linha];
  applySrsEs(meta, correct);

  pushHistoryEs({
    time: new Date().toISOString(),
    linha: currentEs.linha,
    ESP: currentEs.ESP,
    PTBR: expected,
    answer: user,
    correct: correct,
    nivel: currentEs.nivel
  });

  updateAdaptiveEs(correct);

  if(elEs.resultado) {
    elEs.resultado.innerHTML = correct ? `<div class="ok">✅ Correto<br><small>${expected}</small></div>` : `<div class="bad">❌ Incorreto<br><strong>${expected}</strong></div>`;
  }

  renderStatsEs();
}

function handleSkipEs(){
  const meta = srsEs[currentEs.linha];
  applySrsEs(meta, false);
  pushHistoryEs({
    time: new Date().toISOString(),
    linha: currentEs.linha,
    ESP: currentEs.ESP,
    PTBR: currentEs.PTBR,
    skipped: true,
    correct: false,
    nivel: currentEs.nivel
  });
  renderStatsEs();
  nextCardEs();
}

function nextCardEs(){
  const card = pickNextEs();
  renderCardEs(card);
}

/* ---------- Stats / History ---------- */
function renderStatsEs(){
  computeDueCountEs();
  const history = loadHistoryEs();
  const t = new Date().toISOString().slice(0,10);
  if(elEs.todayCorrect) elEs.todayCorrect.textContent = history.filter(h => h.time && h.time.slice(0,10) === t && h.correct).length;
  if(elEs.todayWrong) elEs.todayWrong.textContent = history.filter(h => h.time && h.time.slice(0,10) === t && !h.correct).length;
}

function renderHistoryEs(){
  const h = loadHistoryEs();
  if(!elEs.historyList) return;
  elEs.historyList.innerHTML = "";
  h.slice(0,200).forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `<small>${item.time}</small> — <strong>#${item.linha}</strong> — "${item.ESP}" — ${item.correct ? "<span style='color:green'>✔</span>" : "<span style='color:red'>✖</span>"}`;
    elEs.historyList.appendChild(li);
  });
}

/* ---------- Theme, export, reset ---------- */
function tryLoadThemeEs(){
  const t = localStorage.getItem("ui_theme");
  if(t) document.documentElement.setAttribute("data-theme", t);
  else {
    const prefers = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute('data-theme', prefers ? "dark" : "light");
  }
}

function exportSrsEs(){
  const blob = new Blob([JSON.stringify(srsEs, null, 2)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "srs_es_export.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function resetProgressEs(){
  if(!confirm("Resetar todo o progresso do treino de Espanhol?")) return;
  localStorage.removeItem(STORAGE_KEY_ES);
  localStorage.removeItem(HISTORY_KEY_ES);
  srsEs = {};
  initAllEs();
  renderStatsEs();
  nextCardEs();
}

/* ---------- Events binding ---------- */
if(elEs.listenBtn) elEs.listenBtn.addEventListener("click", ()=> speakEs(currentEs ? currentEs.ESP : ""));
if(elEs.checkBtn) elEs.checkBtn.addEventListener("click", handleCheckEs);
if(elEs.skipBtn) elEs.skipBtn.addEventListener("click", handleSkipEs);
if(elEs.openDashboard) elEs.openDashboard.addEventListener("click", ()=> { if(elEs.dashboard) elEs.dashboard.classList.toggle("hidden"); renderStatsEs(); });
if(elEs.closeHistory) elEs.closeHistory.addEventListener("click", ()=> { if(elEs.historyPanel) elEs.historyPanel.classList.add("hidden"); });
if(elEs.toggleTheme) elEs.toggleTheme.addEventListener("click", ()=> {
  const root = document.documentElement;
  const cur = root.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("ui_theme", next);
});
if(elEs.exportBtn) elEs.exportBtn.addEventListener("click", exportSrsEs);
if(elEs.resetBtn) elEs.resetBtn.addEventListener("click", resetProgressEs);
if(elEs.downloadData) elEs.downloadData.addEventListener("click", ()=>{
  const data = { srs: srsEs, history: loadHistoryEs() };
  const blob = new Blob([JSON.stringify(data,null,2)], {type: "application/json"});
  elEs.downloadData.href = URL.createObjectURL(blob);
});

/* ---------- Boot ---------- */
async function bootEs(){
  try {
    frasesEs = await fetch(DATA_PATH_ES).then(r => r.json());
  } catch(e){
    if(elEs.frase) elEs.frase.textContent = "Erro ao carregar dataset (data/frases_es.json)";
    return;
  }
  loadProgressEs();
  initAllEs();
  renderStatsEs();
  tryLoadThemeEs();
  nextCardEs();
}

bootEs();
