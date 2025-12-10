document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const exameId = params.get('id');

    if (!exameId) {
        alert("Exame não encontrado.");
        window.location.href = "historico.html";
        return;
    }

    const area = document.getElementById('revisaoArea');
    const dataDisplay = document.getElementById('data-exame-display');

    try {
        const res = await fetch(`http://localhost:5000/simulado/detalhes/${exameId}`);
        const dados = await res.json();

        if (dataDisplay) {
            dataDisplay.innerText = dados.data || "Data desconhecida";
        }

        const questoes = dados.questoes || [];

        area.innerHTML = ""; 

        questoes.forEach((q, index) => {
            const card = document.createElement('article');
            card.className = 'question-card';

            let enunciadoSeguro = q.enunciado ? q.enunciado.replace(/\\/g, '\\\\') : "";
            
            enunciadoSeguro = enunciadoSeguro
                .replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')
                .replace(/\\\(/g, '$').replace(/\\\)/g, '$');

            const enunciadoFormatado = window.marked ? 
                DOMPurify.sanitize(marked.parse(enunciadoSeguro)) : q.enunciado;

    
            let htmlOpcoes = '';
            ['A', 'B', 'C', 'D', 'E'].forEach(letra => {
                if (q.opcoes[letra]) {
                    let classeCss = '';
                    let icone = '';

                  
                 
                    if (letra === q.gabarito) {
                        classeCss = 'option-correct';
                        icone = '<i class="fas fa-check" style="float:right; color:green;"></i>';
                    }
                
                    else if (letra === q.marcada && q.marcada !== q.gabarito) {
                        classeCss = 'option-wrong';
                        icone = '<i class="fas fa-times" style="float:right; color:red;"></i>';
                    }

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
                    <div class="question-text">${enunciadoFormatado}</div>
                    <ul class="options-list readonly">
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
        area.innerHTML = "<p>Erro ao carregar detalhes.</p>";
    }
});
