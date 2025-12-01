document.addEventListener("DOMContentLoaded", async () => {
    // 1. Pega o ID do exame lá da URL (ex: detalhes_simulado.html?id=10)
    const params = new URLSearchParams(window.location.search);
    const exameId = params.get('id');

    if (!exameId) {
        alert("Exame não encontrado.");
        window.location.href = "historico.html";
        return;
    }

    const area = document.getElementById('revisaoArea');

    try {
        const res = await fetch(`http://localhost:5000/simulado/detalhes/${exameId}`);
        const questoes = await res.json();

        area.innerHTML = ""; // Limpa loading

        questoes.forEach((q, index) => {
            const card = document.createElement('article');
            card.className = 'question-card';

            // Gera as opções com lógica de cor
            let htmlOpcoes = '';
            ['A', 'B', 'C', 'D', 'E'].forEach(letra => {
                if (q.opcoes[letra]) {
                    let classeCss = '';
                    let icone = '';

                    // LÓGICA DAS CORES:
                    
                    // 1. Se essa é a correta -> SEMPRE VERDE
                    if (letra === q.gabarito) {
                        classeCss = 'option-correct';
                        icone = '<i class="fas fa-check" style="float:right; color:green;"></i>';
                    }
                    // 2. Se o usuário marcou essa e estava ERRADA -> VERMELHO
                    else if (letra === q.marcada && q.marcada !== q.gabarito) {
                        classeCss = 'option-wrong';
                        icone = '<i class="fas fa-times" style="float:right; color:red;"></i>';
                    }

                    // Se o usuário marcou essa (mesmo sendo certa), deixamos o radio marcado
                    const checked = (letra === q.marcada) ? 'checked' : '';

                    htmlOpcoes += `
                        <li>
                            <label class="${classeCss}">
                                <input type="radio" disabled ${checked}> 
                                <strong>${letra})</strong> ${q.opcoes[letra]}
                                ${icone}
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
                    <p class="question-text">${q.enunciado}</p>
                    <ul class="options-list readonly">
                        ${htmlOpcoes}
                    </ul>
                </div>
            `;
            area.appendChild(card);
        });

    } catch (e) {
        console.error(e);
        area.innerHTML = "<p>Erro ao carregar detalhes.</p>";
    }
});