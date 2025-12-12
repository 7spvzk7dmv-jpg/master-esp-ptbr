let dataset = [];
let fraseAtual = null;

// ==========================
// ESTADO PERSISTENTE
// ==========================
let estado = {
  acertos: 0,
  erros: 0
};

let dificuldade = {}; // {linha: score}

// ==========================
// LOCAL STORAGE
// ==========================
function salvarEstado() {
  localStorage.setItem("srs_estado", JSON.stringify(estado));
  localStorage.setItem("srs_dificuldade", JSON.stringify(dificuldade));
}

function carregarEstado() {
  const est = localStorage.getItem("srs_estado");
  const dif = localStorage.getItem("srs_dificuldade");

  if (est) estado = JSON.parse(est);
  if (dif) dificuldade = JSON.parse(dif);

  document.getElementById("acertos").textContent = estado.acertos;
  document.getElementById("erros").textContent = estado.erros;
}

// ==========================
// NORMALIZAÇÃO DE TEXTO
// ==========================
function normalizarTexto(txt) {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remove acentos
    .replace(/[^\w\s]/g, "")          // remove TODA pontuação
    .replace(/\b(o|a|os|as|um|uma|uns|umas|de|do|da|dos|das)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ==========================
// SIMILARIDADE (LEVENSHTEIN)
// ==========================
function similaridade(a, b) {
  if (!a || !b) return 0;

  const m = [];
  const al = a.length;
  const bl = b.length;

  for (let i = 0; i <= bl; i++) m[i] = [i];
  for (let j = 0; j <= al; j++) m[0][j] = j;

  for (let i = 1; i <= bl; i++) {
    for (let j = 1; j <= al; j++) {
      m[i][j] =
        b[i - 1] === a[j - 1]
          ? m[i - 1][j - 1]
          : Math.min(
              m[i - 1][j - 1] + 1,
              m[i][j - 1] + 1,
              m[i - 1][j] + 1
            );
    }
  }

  return 1 - m[bl][al] / Math.max(al, bl);
}

// ==========================
// SINÔNIMOS BÁSICOS
// ==========================
const sinonimos = {
  cansado: ["exausto", "fatigado"],
  feliz: ["contente", "alegre"],
  triste: ["abatido", "infeliz"],
  rapido: ["veloz", "ligeiro"],
  aprender: ["estudar"],
  continuar: ["seguir", "prosseguir"],
  certeza: ["seguranca"],
  resolver: ["solucionar"]
};

// ==========================
// DATASET
// ==========================
async function carregarDados() {
  try {
    const resp = await fetch("data/frases_es.json", { cache: "no-store" });
    if (!resp.ok) throw new Error("Erro HTTP");

    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0)
      throw new Error("JSON inválido");

    dataset = data.map((item, i) => ({
      ...item,
      linha: i + 1
    }));

    carregarEstado();
    proximaFrase();
  } catch (e) {
    console.error(e);
    document.getElementById("fraseESP").textContent =
      "❌ Erro ao carregar o dataset";
  }
}

// ==========================
// SRS – ESCOLHA DE FRASE
// ==========================
function escolherFrase() {
  const pesos = dataset.map(f => 1 + (dificuldade[f.linha] || 0) * 4);

  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;

  for (let i = 0; i < dataset.length; i++) {
    r -= pesos[i];
    if (r <= 0) return dataset[i];
  }

  return dataset[0];
}

// ==========================
// UI
// ==========================
function proximaFrase() {
  fraseAtual = escolherFrase();

  document.getElementById("fraseESP").textContent = fraseAtual.ESP;
  document.getElementById("linhaDisplay").textContent = fraseAtual.linha;
  document.getElementById("nivelDisplay").textContent = fraseAtual.CEFR;

  document.getElementById("resultado").textContent = "";
  document.getElementById("respostaUsuario").value = "";
}

// ==========================
// ÁUDIO
// ==========================
function ouvirFrase() {
  if (!fraseAtual || !("speechSynthesis" in window)) return;

  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(fraseAtual.ESP);
  u.lang = "es-ES";
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

// ==========================
// CONFERÊNCIA INTELIGENTE
// ==========================
function conferir() {
  if (!fraseAtual) return;

  const resposta = normalizarTexto(
    document.getElementById("respostaUsuario").value
  );
  const correta = normalizarTexto(fraseAtual.PTBR);

  let corretaFlag = false;

  if (resposta === correta) corretaFlag = true;
  if (similaridade(resposta, correta) >= 0.78) corretaFlag = true;

  for (const k in sinonimos) {
    if (correta.includes(k)) {
      sinonimos[k].forEach(s => {
        if (resposta.includes(s)) corretaFlag = true;
      });
    }
  }

  const resEl = document.getElementById("resultado");

  if (corretaFlag) {
    estado.acertos++;
    dificuldade[fraseAtual.linha] =
      Math.max((dificuldade[fraseAtual.linha] || 0) - 1, 0);

    resEl.textContent = "✅ Correto (sentido equivalente)";
    resEl.className = "text-green-400 text-center text-lg";
  } else {
    estado.erros++;
    dificuldade[fraseAtual.linha] =
      (dificuldade[fraseAtual.linha] || 0) + 1;

    resEl.textContent = `❌ Correto esperado: ${fraseAtual.PTBR}`;
    resEl.className = "text-red-400 text-center text-lg";
  }

  document.getElementById("acertos").textContent = estado.acertos;
  document.getElementById("erros").textContent = estado.erros;

  salvarEstado();
}

// ==========================
// EVENTOS
// ==========================
document.getElementById("btnOuvir").onclick = ouvirFrase;
document.getElementById("btnConferir").onclick = conferir;
document.getElementById("btnProxima").onclick = proximaFrase;

// ==========================
// INIT
// ==========================
document.addEventListener("DOMContentLoaded", carregarDados);
