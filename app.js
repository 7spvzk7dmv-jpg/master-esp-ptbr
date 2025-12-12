let frases = [];
let fila = []; // filas SRS (erros voltam mais vezes)
let fraseAtual = null;

let acertos = 0;
let erros = 0;

async function carregarDataset() {
    const resp = await fetch("./data/frases_es.json");
    frases = await resp.json();

    // Inicializa fila (todas com peso 1)
    fila = frases.map((f, idx) => ({
        idx,
        peso: 1
    }));

    sortearFrase();
}

function sortearFrase() {
    // sorteio ponderado por peso
    const total = fila.reduce((acc, f) => acc + f.peso, 0);
    let r = Math.random() * total;

    for (const item of fila) {
        r -= item.peso;
        if (r <= 0) {
            fraseAtual = frases[item.idx];
            atualizarTela(item.idx);
            return;
        }
    }
}

function atualizarTela(idx) {
    document.getElementById("fraseEsp").textContent = fraseAtual.ESP;
    document.getElementById("linhaNum").textContent = idx + 1;
    document.getElementById("nivelCEFR").textContent = fraseAtual.CEFR;

    document.getElementById("respostaUsuario").value = "";
    document.getElementById("resultado").textContent = "";
}

function conferir() {
    const resposta = document.getElementById("respostaUsuario").value.trim();
    const correta = fraseAtual.PTBR.trim();

    const resEl = document.getElementById("resultado");

    if (!resposta) {
        resEl.textContent = "Digite uma resposta antes de conferir.";
        resEl.style.color = "black";
        return;
    }

    if (resposta.toLowerCase() === correta.toLowerCase()) {
        acertos++;
        resEl.textContent = "✔️ Correto!";
        resEl.style.color = "green";

        // diminui peso — aparece menos
        const item = fila.find(f => frases[f.idx] === fraseAtual);
        item.peso = Math.max(1, item.peso * 0.8);
    } else {
        erros++;
        resEl.textContent = `❌ Incorreto. Tradução correta: ${correta}`;
        resEl.style.color = "red";

        // aumenta peso — aparece mais
        const item = fila.find(f => frases[f.idx] === fraseAtual);
        item.peso *= 2;
    }

    document.getElementById("acertos").textContent = acertos;
    document.getElementById("erros").textContent = erros;
}

function ouvir() {
    if (!("speechSynthesis" in window)) {
        alert("Seu navegador não suporta Web Speech API.");
        return;
    }

    const msg = new SpeechSynthesisUtterance(fraseAtual.ESP);
    msg.lang = "es-ES";
    window.speechSynthesis.speak(msg);
}

document.getElementById("btnConferir").addEventListener("click", conferir);
document.getElementById("btnProxima").addEventListener("click", sortearFrase);
document.getElementById("btnOuvir").addEventListener("click", ouvir);

carregarDataset();
