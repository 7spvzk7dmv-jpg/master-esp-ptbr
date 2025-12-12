let dataset = [];
let fraseAtual = null;

let acertos = 0;
let erros = 0;

// dificuldade por linha (SRS simples)
let dificuldade = {};

// ==========================
// UTILIDADES DE TEXTO
// ==========================
function normalizarTexto(txt) {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\b(o|a|os|as|um|uma|uns|umas|de|do|da|dos|das)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// similaridade textual (Levenshtein simplificado)
function similaridade(a, b) {
  const matriz = [];
  const lenA = a.length;
  const lenB = b.length;

  for (let i = 0; i <= lenB; i++) matriz[i] = [i];
  for (let j = 0; j <= lenA; j++) matriz[0][j] = j;

  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      matriz[i][j] =
        b[i - 1] === a[j - 1]
          ? matriz[i - 1][j - 1]
          : Math.min(
              matriz[i - 1][j - 1] + 1,
              matriz[i][j - 1] + 1,
              matriz[i - 1][j] + 1
            );
    }
  }

  const dist = matriz[lenB][lenA];
  const maxLen = Math.max(lenA, lenB);
  return 1 - dist / maxLen;
}

// mapa básico de sinônimos PT-BR
const sinonimos = {
  cansado: ["exausto", "fatigado"],
  feliz: ["contente", "alegre"],
  triste: ["abatido", "infeliz"],
  rapido: ["veloz", "ligeiro"],
  aprender: ["estudar"],
  continuar: ["seguir", "prosseguir"],
  certeza: ["seguranca"],
  tempo: ["prazo"],
  resolver: ["solucionar"]
};

// ==========================
// CARREGAMENTO DO DATASET
// ==========================
async function carregarDados() {
  try {
    const resp = await fetch("data/frases_es.json", { cache: "no-store" });

    if (!resp.ok) {
      throw new Error(`Erro HTTP ${resp.status}`);
    }

    const data = await resp.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("JSON inválido ou vazio");
    }

    // adiciona número da linha dinamicamente
    dataset = data.map((item, index) => ({
      ...item,
      linha: index + 1
    }));

    proximaFrase();
  } catch (err) {
    console.error("Erro ao carregar dataset:", err);
    document.getElementById("fraseESP").textContent =
      "❌ Erro ao carregar o dataset";
  }
}

// ==========================
// SELEÇÃO DE FRASE (SRS)
// ==========================
function escolherFrase() {
  const pesos = dataset.map(f => {
    const pen = dificuldade[f.linha] || 0;
    return 1 + pen * 3;
  });

  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;

  for (let i = 0; i < dataset.length; i++) {
    r -= pesos[i];
    if (r <= 0) return dataset[i];
  }

  return dataset[0];
}

// ==========================
// EXIBIÇÃO
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
// ÁUDIO (Web Speech API)
// ==========================
function ouvirFrase() {
  if (!fraseAtual || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(fraseAtual.ESP);
  utter.lang = "es-ES";
  utter.rate = 0.95;

  window.speechSynthesis.speak(utter);
}

// ==========================
// CONFERÊNCIA MODERADA
// ==========================
function conferir() {
  if (!fraseAtual) return;

  const respostaBruta =
    document.getElementById("respostaUsuario").value;

  const corretaBruta = fraseAtual.PTBR;

  const resposta = normalizarTexto(respostaBruta);
  const correta = normalizarTexto(corretaBruta);

  let corretaFlag = false;

  // 1) igualdade normalizada
  if (resposta === correta) corretaFlag = true;

  // 2) similaridade textual
  if (similaridade(resposta, correta) >= 0.75) corretaFlag = true;

  // 3) sinônimos
  for (const chave in sinonimos) {
    if (correta.includes(chave)) {
      sinonimos[chave].forEach(s => {
        if (resposta.includes(s)) corretaFlag = true;
      });
    }
  }

  const resultadoEl = document.getElementById("resultado");

  if (corretaFlag) {
    acertos++;
    resultadoEl.textContent = "✅ Correto (sentido equivalente)";
    resultadoEl.className = "text-green-400 text-center text-lg";

    dificuldade[fraseAtual.linha] =
      Math.max((dificuldade[fraseAtual.linha] || 0) - 1, 0);
  } else {
    erros++;
    resultadoEl.textContent = `❌ Correto esperado: ${fraseAtual.PTBR}`;
    resultadoEl.className = "text-red-400 text-center text-lg";

    dificuldade[fraseAtual.linha] =
      (dificuldade[fraseAtual.linha] || 0) + 1;
  }

  document.getElementById("acertos").textContent = acertos;
  document.getElementById("erros").textContent = erros;
}

// ==========================
// EVENTOS
// ==========================
document.getElementById("btnOuvir").addEventListener("click", ouvirFrase);
document.getElementById("btnConferir").addEventListener("click", conferir);
document.getElementById("btnProxima").addEventListener("click", proximaFrase);

// ==========================
// INIT
// ==========================
document.addEventListener("DOMContentLoaded", carregarDados);
