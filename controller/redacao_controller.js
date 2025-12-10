let temaAtualId = 1;
document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem('usuario'));
    if (!user) {
        alert("Faça login para acessar a redação.");
        window.location.href = "index.html";
        return;
    }

    carregarTemas(); 
});

async function carregarTemas() {
    const titulo = document.getElementById('titulo-tema');
    const apoio = document.getElementById('texto-apoio');
    
    titulo.innerText = "Gerando tema com IA...";
    
    try {
        const res = await fetch('http://127.0.0.1:5000/redacao/tema');
        const data = await res.json();

        if (res.ok) {
            titulo.innerText = data.tema;
            apoio.innerText = data.texto_apoio || "Escreva uma redação dissertativa-argumentativa sobre o tema acima.";

            if (data.id) {
                temaAtualId = data.id; 
                console.log("Tema carregado ID:", temaAtualId); 
            }
        } else {
            titulo.innerText = "Tema Livre";
            temaAtualId = 1;
        }
    } catch (error) {
        console.error("Erro:", error);
        titulo.innerText = "Modo Offline";
        temaAtualId = 1;
    }
}


function gerarNovoTema() {
    carregarTemas();
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function enviarParaCorrecao() {
    const user = JSON.parse(localStorage.getItem('usuario'));
    const texto = document.getElementById('texto-redacao').value;
    const fileInput = document.getElementById('input-foto');
    const btn = document.getElementById('btn-enviar');

    if (!texto.trim() && fileInput.files.length === 0) {
        alert("Por favor, escreva o texto ou envie uma foto da redação.");
        return;
    }

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Corrigindo...';
    btn.disabled = true;

    try {
        let imagemBase64 = null;
        
        if (fileInput.files.length > 0) {
            imagemBase64 = await toBase64(fileInput.files[0]);
        }

        const payload = {
            usuario_id: user.id,
            tema_id: temaAtualId, 
            texto: texto,
            imagem: imagemBase64
        };

        const res = await fetch('http://localhost:5000/redacao/enviar', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const resultado = await res.json();

        if (res.ok) {
            exibirResultado(resultado);
        } else {
            console.error("Erro Back:", resultado);
            alert("Erro na correção: " + (resultado.error || "Tente novamente."));
        }

    } catch (error) {
        console.error("Erro JS:", error);
        alert("Erro de conexão com o servidor.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}


function exibirResultado(data) {
   
    const secaoResultado = document.getElementById('resultado-correcao');
    secaoResultado.classList.remove('hidden');
    
    
    secaoResultado.scrollIntoView({ behavior: 'smooth' });

   
    const notaDisplay = document.getElementById('nota-total-display');
    notaDisplay.innerText = data.nota_total;
    
   
    notaDisplay.className = ""; 
    if (data.nota_total >= 800) notaDisplay.classList.add('nota-verde');
    else if (data.nota_total >= 500) notaDisplay.classList.add('nota-amarela');
    else notaDisplay.classList.add('nota-vermelha');

    
    document.getElementById('feedback-geral').innerText = data.comentario_geral;


    const notas = data.notas_por_competencia || {};
    const detalhes = data.detalhes_erros || {};

    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((key) => {

        const elNota = document.getElementById(`nota-${key}`);
        if (elNota) {
            elNota.innerText = notas[key] !== undefined ? notas[key] : 0;
        }

        const elDetalhe = document.getElementById(`detalhe-${key}`);
        if (elDetalhe) {
            elDetalhe.innerText = detalhes[key] || "Sem comentários detalhados para esta competência.";
        }
    });
}