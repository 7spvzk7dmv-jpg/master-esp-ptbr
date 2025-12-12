let dataset = [];
let fraseAtual = null;

let acertos = 0;
let erros = 0;

// memória simples de dificuldade por linha
// quanto maior o número, mais a frase reaparece
let dificuldade = {};

// ==========================
// CARREGAMENTO DO DATASET
// ==========================
async function carregarDados() {
  try {
    const resp = await fetch("data/frases_es.json", {
      cache: "no-store"
    });

    if (!resp.ok) {
      throw new Error(`Erro HTTP ${resp.status}`);
    }

    const data = await resp.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("JSON inválido ou vazio");
    }

    dataset = data;
    proximaFrase();

  } catch (err) {
    console.error("Falha ao carregar frases:", err);
    document.getElementById("fraseESP").textContent =
      "❌ Erro ao carregar o dataset";
  }
}

// ==========================
// SELEÇÃO DE FRASE (SRS)
// ==========================
function escolherFrase() {
  // pesos baseados em dificuldade
  const pesos = dataset.map(f => {
    const penalidade = dificuldade[f.linha] || 0;
    return 1 + penalidade * 3;
  });

  const total = pesos.reduce((a, b) => a + b, 0);
  let sorteio = Math.random() * total;

  for (let i = 0; i < dataset.length; i++) {
    sorteio -= pesos[i];
    if (sorteio <= 0) return dataset[i];
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
// CONFERÊNCIA DE RESPOSTA
// ==========================
function conferir() {
  if (!fraseAtual) return;

  const resposta = document
    .getElementById("respostaUsuario")
    .value
    .trim()
    .toLowerCase();

  const correta = fraseAtual.PTBR.trim().toLowerCase();

  const resultadoEl = document.getElementById("resultado");

  if (resposta === correta) {
    acertos++;
    resultadoEl.textContent = "✅ Correto!";
    resultadoEl.className = "text-green-400 text-center text-lg";

    dificuldade[fraseAtual.linha] =
      Math.max((dificuldade[fraseAtual.linha] || 0) - 1, 0);

  } else {
    erros++;
    resultadoEl.textContent = `❌ Errado. Correto: ${fraseAtual.PTBR}`;
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
// INICIALIZAÇÃO
// ==========================
document.addEventListener("DOMContentLoaded", carregarDados);
