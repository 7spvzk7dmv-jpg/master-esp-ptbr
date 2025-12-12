// ==========================
// CONFIGURAÇÕES GERAIS
// ==========================

const DATASET_URL = "data/frases_es.json";
let frases = [];
let filaInteligente = [];
let fraseAtual = null;

// Histórico local por frase (linha): acertos, erros, último resultado
let historico = JSON.parse(localStorage.getItem("historico_es")) || {};

// Dificuldade interna usada pelo modo adaptativo
let nivelAtual = "AUTO";

// Pesos SRS para repetição inteligente
const PESO_ACERTO = 0.8;
const PESO_ERRO = 2.5;

// Similaridade mínima para considerar “quase certo”
const SIM_MIN = 0.82;


// ==========================
// CARREGAR DATASET
// ==========================
async function carregarFrases() {
    const resposta = await fetch(DATASET_URL);
    frases = await resposta.json();
    construirFilaInicial();
    proximaFrase();
}


// ==========================
// FILA INTELIGENTE
// ==========================
function construirFilaInicial() {
    filaInteligente = [];

    frases.forEach(f => {
        const hist = historico[f.linha] || { acertos: 0, erros: 0 };

        // Score base da fila — quanto menor, mais prioritária
        const erros = hist.erros || 0;
        const acertos = hist.acertos || 0;

        let score = 1 + erros * 2 - acertos * 0.5;
        if (score < 1) score = 1;

        filaInteligente.push({ ...f, score });
    });

    // Ordena para priorizar frases "difíceis"
    filaInteligente.sort((a, b) => b.score - a.score);
}


// ==========================
// ESCOLHA ADAPTATIVA DA FRASE
// ==========================
function escolherFraseAdaptativa() {
    const distribuicao = {
        "A1": 0.35,
        "A2": 0.30,
        "B1": 0.20,
        "B2": 0.15
    };

    const r = Math.random();
    let acumulado = 0;

    for (const nivel of ["A1", "A2", "B1", "B2"]) {
        acumulado += distribuicao[nivel];
        if (r <= acumulado) {
            const candidatas = filaInteligente.filter(f => f.nivel === nivel);
            if (candidatas.length > 0) {
                return candidatas[Math.floor(Math.random() * candidatas.length)];
            }
        }
    }

    return filaInteligente[Math.floor(Math.random() * filaInteligente.length)];
}


// ==========================
// EXIBIR FRASE
// ==========================
function proximaFrase() {
    fraseAtual = escolherFraseAdaptativa();

    document.getElementById("frase-es").innerText = fraseAtual.ESP;
    document.getElementById("linha-info").innerText = "Linha " + fraseAtual.linha;
    document.getElementById("resultado").innerText = "";
    document.getElementById("resposta").value = "";
}


// ==========================
// TTS — VOZ ESPANHOL DA ESPANHA
// ==========================
function falarFrase() {
    const utter = new SpeechSynthesisUtterance(fraseAtual.ESP);
    utter.lang = "es-ES";
    speechSynthesis.speak(utter);
}


// ==========================
// SIMILARIDADE PARA TOLERÂNCIA
// ==========================
function similaridade(a, b) {
    a = a.toLowerCase().trim();
    b = b.toLowerCase().trim();

    if (a === b) return 1.0;

    const arrA = a.split("");
    const arrB = b.split("");
    const len = Math.max(arrA.length, arrB.length);
    let iguais = 0;

    for (let i = 0; i < len; i++) {
        if (arrA[i] === arrB[i]) iguais++;
    }

    return iguais / len;
}


// ==========================
// CONFERIR TRADUÇÃO
// ==========================
function conferir() {
    const resp = document.getElementById("resposta").value.trim();
    const correta = fraseAtual.PTBR.trim();

    const sim = similaridade(resp, correta);
    const acertou = sim >= SIM_MIN;

    atualizarHistorico(fraseAtual.linha, acertou);

    document.getElementById("resultado").innerHTML =
        acertou
            ? "✔ Correto! Tradução: <b>" + correta + "</b>"
            : "✖ Tradução incorreta.<br>Resposta correta: <b>" + correta + "</b>";

    construirFilaInicial();
}


// ==========================
// HISTÓRICO POR FRASE
// ==========================
function atualizarHistorico(linha, acertou) {
    if (!historico[linha]) historico[linha] = { acertos: 0, erros: 0 };

    if (acertou) historico[linha].acertos++;
    else historico[linha].erros++;

    localStorage.setItem("historico_es", JSON.stringify(historico));
}


// ==========================
// BOTÕES
// ==========================
document.getElementById("btn-ouvir").onclick = falarFrase;
document.getElementById("btn-conferir").onclick = conferir;
document.getElementById("btn-proxima").onclick = proximaFrase;


// ==========================
// INICIALIZAÇÃO
// ==========================
carregarFrases();
