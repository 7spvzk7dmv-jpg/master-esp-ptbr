
let DATA_PATH = 'data/frases_es.json';
let frases = [];
let srs = {};
let current = null;

const el = {
  linha: document.getElementById('linha'),
  frase: document.getElementById('frase'),
  resposta: document.getElementById('resposta'),
  feedback: document.getElementById('feedback'),
  listenBtn: document.getElementById('listenBtn'),
  checkBtn: document.getElementById('checkBtn'),
  skipBtn: document.getElementById('skipBtn'),
  due: document.getElementById('due')
};

function norm(s){return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').trim();}

function isCorrect(a,b){
  a=norm(a);b=norm(b);
  if(a===b) return true;
  return false;
}

function speak(text){
  let u=new SpeechSynthesisUtterance(text);
  u.lang='es-ES';
  speechSynthesis.speak(u);
}

async function boot(){
  frases = await fetch(DATA_PATH).then(r=>r.json());
  nextCard();
}

function nextCard(){
  current = frases[Math.floor(Math.random()*frases.length)];
  el.linha.textContent = current.linha;
  el.frase.textContent = current.ESP;
  el.resposta.value='';
  el.feedback.textContent='';
}

el.listenBtn.onclick=()=>speak(current.ESP);

el.checkBtn.onclick=()=>{
  let ok=isCorrect(el.resposta.value,current.PTBR);
  el.feedback.textContent = ok ? '✔️ Correto!' : '❌ Correto: '+current.PTBR;
};

el.skipBtn.onclick=nextCard;

boot();
