let questoesCache = [];
let exameAtualId = null;

async function iniciarProva() {
    const user = JSON.parse(localStorage.getItem('usuario'));
    if (!user) { alert("Faça login!"); window.location.href='index.html'; return; }

    const btn = document.querySelector('.btn-start');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
    btn.disabled = true;

    try {
        const res1 = await fetch('http://localhost:5000/simulado/iniciar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ usuario_id: user.id })
        });
        const data1 = await res1.json();
        
        if(res1.ok) {
            exameAtualId = data1.exame_id;
            localStorage.setItem('exame_atual', exameAtualId); 
            
            await carregarQuestoesDoBanco();
            
            document.getElementById('tela-intro').classList.add('hidden');
            document.getElementById('tela-prova').classList.remove('hidden');
            
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

        area.innerHTML = "";
        if (questoesCache.length === 0) {
            area.innerHTML = "<p>Nenhuma questão encontrada no banco.</p>";
            return;
        }

        questoesCache.forEach((q, index) => {
            const card = document.createElement('article');
            card.className = 'question-card';

            let textoSeguro = q.texto ? q.texto.replace(/\\/g, '\\\\') : "";
            
            // 2. Transforma delimitadores [ ] e ( ) em $$ e $ (caso tenha no banco)
            textoSeguro = textoSeguro
                .replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')
                .replace(/\\\(/g, '$').replace(/\\\)/g, '$');

            // 3. Agora pode converter para HTML
            const textoFormatado = window.marked ? 
                DOMPurify.sanitize(marked.parse(textoSeguro)) : q.texto;

            let htmlOpcoes = '';
            ['A', 'B', 'C', 'D', 'E'].forEach(letra => {

                const opcaoObj = q.opcoes.find(o => o.letra === letra);
                
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
                    <div class="question-text">${textoFormatado}</div>
                    <ul class="options-list">
                        ${htmlOpcoes}
                    </ul>
                </div>
            `;
            area.appendChild(card);
        });
        
        if (window.MathJax) {
            window.MathJax.typesetPromise();
        }

    } catch (e) {
        console.error(e);
        area.innerHTML = "<p>Erro ao carregar questões.</p>";
    }
}

async function salvarResposta(questaoId, resposta) {
    if (!exameAtualId) return;


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
        
        const res = await fetch('http://localhost:5000/simulado/finalizar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ exame_id: exameAtualId })
        });

        const resultado = await res.json();

        if (res.ok) {
            alert(`Simulado Finalizado!\n\nNota: ${resultado.nota}\nAcertos: ${resultado.acertos}\nErros: ${resultado.erros}`);
            window.location.href = "desempenho.html";
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