let dataset = [];
let fraseAtual = null;
let acertos = 0;
let erros = 0;

// memória simples de erros
let dificuldade = {}; // {linha: score}

// níveis configurados do mais fácil ao mais difícil
const ordemCEFR = ["A1", "A2", "B1", "B2", "C1"];

// carregar dataset
async function carregarDados() {
  const resp = await fetch("data/frases_es.json");
  dataset = await resp.json();
  proximaFrase();
}

function escolherFrase() {
  // priorizar frases com mais erros
  const pesos = dataset.map((f) => {
    const base = 1;
    const penalidade = dificuldade[f.linha] || 0;
    return base + penalidade * 3; // frases erradas mais vezes aparecem mais
  });

  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;

  for (let i = 0; i < dataset.length; i++) {
    r -= pesos[i];
    if (r <= 0) return dataset[i];
  }

  return dataset[0];
}

function proximaFrase() {
  fraseAtual = escolherFrase();

  document.getElementById("fraseESP").textContent = fraseAtual.ESP;
  document.getElementById("linhaDisplay").textContent = fraseAtual.linha;
  document.getElementById("nivelDisplay").textContent = fraseAtual.CEFR;
  document.getElementById("resultado").textContent = "";
  document.getElementById("respostaUsuario").value = "";
}

function ouvirFrase() {
  if (!fraseAtual) return;

  const utter = new SpeechSynthesisUtterance(fraseAtual.ESP);
  utter.lang = "es-ES";
  speechSynthesis.speak(utter);
}

function conferir() {
  const resp = document.getElementById("respostaUsuario").value.trim();
  const correta = fraseAtual.PTBR.trim();

  if (resp.toLowerCase() === correta.toLowerCase()) {
    acertos++;
    document.getElementById("resultado").textContent = "✅ Correto!";
    document.getElementById("resultado").classList = "text-green-400 text-center text-lg";
    dificuldade[fraseAtual.linha] = Math.max((dificuldade[fraseAtual.linha] || 0) - 1, 0);
  } else {
    erros++;
    document.getElementById("resultado").textContent = `❌ Errado. Correto: ${correta}`;
    document.getElementById("resultado").classList = "text-red-400 text-center text-lg";
    dificuldade[fraseAtual.linha] = (dificuldade[fraseAtual.linha] || 0) + 1;
  }

  document.getElementById("acertos").textContent = acertos;
  document.getElementById("erros").textContent = erros;
}

// eventos
document.getElementById("btnOuvir").onclick = ouvirFrase;
document.getElementById("btnConferir").onclick = conferir;
document.getElementById("btnProxima").onclick = proximaFrase;

// iniciar
carregarDados();
