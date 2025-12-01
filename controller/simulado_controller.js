let questoesCache = [];
let exameAtualId = null;

// Função chamada pelo botão "Iniciar Simulado" no HTML
async function iniciarProva() {
    const user = JSON.parse(localStorage.getItem('usuario'));
    if (!user) { alert("Faça login!"); window.location.href='index.html'; return; }

    const btn = document.querySelector('.btn-start');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
    btn.disabled = true;

    try {
        // 1. Cria o exame no banco
        const res1 = await fetch('http://localhost:5000/simulado/iniciar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ usuario_id: user.id })
        });
        const data1 = await res1.json();
        
        if(res1.ok) {
            exameAtualId = data1.exame_id;
            localStorage.setItem('exame_atual', exameAtualId); // Salva caso atualize a pagina
            
            // 2. Busca as questões
            await carregarQuestoesDoBanco();
            
            // 3. Troca a tela (Intro -> Prova)
            document.getElementById('tela-intro').classList.add('hidden');
            document.getElementById('tela-prova').classList.remove('hidden');
            
            // Rola para o topo suavemente
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert("Erro ao criar exame: " + data1.error);
        }

    } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

async function carregarQuestoesDoBanco() {
    const area = document.getElementById('questionsArea');
    area.innerHTML = '<p style="text-align:center">Carregando questões...</p>';

    try {
        const res = await fetch('http://localhost:5000/simulado/questoes');
        questoesCache = await res.json();

        area.innerHTML = ""; // Limpa loading

        if (questoesCache.length === 0) {
            area.innerHTML = "<p>Nenhuma questão encontrada no banco.</p>";
            return;
        }

        // Gera o HTML para cada questão (Usando o estilo do seu colega)
        questoesCache.forEach((q, index) => {
            const card = document.createElement('article');
            card.className = 'question-card'; // Classe do CSS do colega

            // Gera as opções (A, B, C, D, E)
            let htmlOpcoes = '';
            ['A', 'B', 'C', 'D', 'E'].forEach(letra => {
                // Procura a opção na lista que veio do banco
                const opcaoObj = q.opcoes.find(o => o.letra === letra);
                // Só mostra se tiver texto e não for 'null'
                if(opcaoObj && opcaoObj.texto && opcaoObj.texto !== 'null') {
                    htmlOpcoes += `
                        <li>
                            <label>
                                <input type="radio" name="questao_${q.id}" value="${letra}" onchange="salvarResposta(${q.id}, '${letra}')"> 
                                <strong>${letra})</strong> ${opcaoObj.texto}
                            </label>
                        </li>
                    `;
                }
            });

            card.innerHTML = `
                <div class="question-card-header">
                    <h3 class="question-title">Questão ${index + 1} - ${q.materia}</h3>
                </div>
                <div class="question-body">
                    <p class="question-text">${q.texto}</p>
                    <ul class="options-list">
                        ${htmlOpcoes}
                    </ul>
                </div>
            `;
            area.appendChild(card);
        });

    } catch (e) {
        console.error(e);
        area.innerHTML = "<p>Erro ao carregar questões.</p>";
    }
}

async function salvarResposta(questaoId, resposta) {
    if (!exameAtualId) return;

    // Envia pro banco silenciosamente (sem travar a tela)
    await fetch('http://localhost:5000/simulado/responder', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            exame_id: exameAtualId,
            questao_id: questaoId,
            resposta: resposta
        })
    });
}

async function concluirProva() {
    if (!confirm("Tem certeza que deseja finalizar o simulado?")) return;

    const btn = document.getElementById('btn-finalizar');
    btn.innerText = "Calculando nota...";
    btn.disabled = true;

    try {
        // Chama a Procedure do banco para calcular tudo
        const res = await fetch('http://localhost:5000/simulado/finalizar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ exame_id: exameAtualId })
        });

        const resultado = await res.json();

        if (res.ok) {
            alert(`Simulado Finalizado!\n\nNota: ${resultado.nota}\nAcertos: ${resultado.acertos}\nErros: ${resultado.erros}`);
            window.location.href = "desempenho.html"; // Vai para os gráficos
        } else {
            alert("Erro ao finalizar: " + resultado.error);
        }

    } catch (e) {
        console.error(e);
        alert("Erro de conexão ao finalizar.");
    } finally {
        btn.innerText = "Finalizar Simulado";
        btn.disabled = false;
    }
}