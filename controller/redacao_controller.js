let temaAtualId = 1;
document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem('usuario'));
    if (!user) {
        alert("Faça login para acessar a redação.");
        window.location.href = "index.html";
        return;
    }

    // Chama a função que estava faltando e causava o erro!
    carregarTemas(); 
});

// --- 1. FUNÇÃO PARA CARREGAR/GERAR TEMA ---
async function carregarTemas() {
    const titulo = document.getElementById('titulo-tema');
    const apoio = document.getElementById('texto-apoio');
    
    titulo.innerText = "Gerando tema com IA...";
    
    try {
        // Tenta buscar do backend
        const res = await fetch('http://localhost:5000/redacao/tema');
        const data = await res.json();

        if (res.ok) {
            titulo.innerText = data.tema;
            apoio.innerText = data.texto_apoio || "Escreva uma redação dissertativa-argumentativa sobre o tema acima.";

            if (data.id) {
                temaAtualId = data.id; 
                console.log("Tema carregado ID:", temaAtualId); // Debug
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


// Botão "Gerar Novo Tema" chama a mesma função
function gerarNovoTema() {
    carregarTemas();
}

// Função auxiliar para converter arquivo em Base64
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

    // Validação
    if (!texto.trim() && fileInput.files.length === 0) {
        alert("Por favor, escreva o texto ou envie uma foto da redação.");
        return;
    }

    // Efeito de "Carregando"
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Corrigindo...';
    btn.disabled = true;

    try {
        let imagemBase64 = null;
        
        // Se tiver arquivo, converte para Base64 antes de enviar
        if (fileInput.files.length > 0) {
            imagemBase64 = await toBase64(fileInput.files[0]);
        }

        // Monta o objeto JSON (igual o Python espera)
        const payload = {
            usuario_id: user.id,
            tema_id: temaAtualId, // Se tiver ID do tema na tela, capture aqui. Se não, deixe null ou fixo.
            texto: texto,
            imagem: imagemBase64 // Agora vai como string, não como arquivo bruto
        };

        // ATENÇÃO PARA A URL: No seu app.py a rota é /redacao/enviar
        // No seu JS antigo estava /redacao/corrigir. Ajustei para /enviar.
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
            // Se o Python mandou erro 400 ou 500 com mensagem JSON
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

// --- 3. EXIBIR RESULTADOS NA TELA ---
function exibirResultado(data) {
    // 1. Mostra a seção oculta
    const secaoResultado = document.getElementById('resultado-correcao');
    secaoResultado.classList.remove('hidden');
    
    // Rola a tela até o resultado
    secaoResultado.scrollIntoView({ behavior: 'smooth' });

    // 2. Preenche a Nota Final
    const notaDisplay = document.getElementById('nota-total-display');
    notaDisplay.innerText = data.nota_total;
    
    // Colore a nota
    notaDisplay.className = ""; 
    if (data.nota_total >= 900) notaDisplay.classList.add('nota-verde');
    else if (data.nota_total >= 600) notaDisplay.classList.add('nota-amarela');
    else notaDisplay.classList.add('nota-vermelha');

    // 3. Preenche o Feedback Geral
    document.getElementById('feedback-geral').innerText = data.comentario_geral;

    // 4. Preenche as Competências (C1 a C5)
    // Proteção: Se vier vazio, cria objetos vazios para não dar erro no JS
    const notas = data.notas_por_competencia || {};
    const detalhes = data.detalhes_erros || {};

    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((key) => {
        // Preenche a Nota (ex: 160)
        const elNota = document.getElementById(`nota-${key}`);
        if (elNota) {
            elNota.innerText = notas[key] !== undefined ? notas[key] : 0;
        }

        // Preenche o Texto Explicativo
        const elDetalhe = document.getElementById(`detalhe-${key}`);
        if (elDetalhe) {
            elDetalhe.innerText = detalhes[key] || "Sem comentários detalhados para esta competência.";
        }
    });
}