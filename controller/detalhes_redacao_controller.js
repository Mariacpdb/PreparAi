document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const redacaoId = params.get('id');

    if (!redacaoId) {
        alert("Redação não encontrada.");
        window.location.href = "historico.html";
        return;
    }

    try {
        const res = await fetch(`http://localhost:5000/redacao/detalhes/${redacaoId}`);
        
        if (res.ok) {
            const data = await res.json();

            // 1. Cabeçalho
            document.getElementById('tema-titulo').innerText = data.tema;
            document.getElementById('data-envio').innerText = "Enviado em: " + data.data;
            
            // 2. Texto da Redação
            document.getElementById('texto-completo').innerText = data.texto;

            // 3. Nota Total Colorida
            const elNota = document.getElementById('nota-total-display');
            elNota.innerText = data.nota_total;
            
            elNota.className = "nota-display"; // Reseta classes
            if (data.nota_total > 700) {
                elNota.classList.add('nota-verde');
            } else if (data.nota_total >= 500) {
                elNota.classList.add('nota-amarela');
            } else {
                elNota.classList.add('nota-vermelha');
            }
            // 4. Feedback Geral
            document.getElementById('feedback-geral').innerText = data.feedback_geral || "Sem observações gerais.";

            // 5. Lista de Competências (Com Detalhes!)
            const containerComp = document.querySelector('.competencias-list');
            containerComp.innerHTML = ""; // Limpa lista antiga

            // Mapeamento de nomes bonitos
            const nomesComp = {
                'c1': 'Norma Culta',
                'c2': 'Tema e Estrutura',
                'c3': 'Argumentação',
                'c4': 'Coesão Textual',
                'c5': 'Proposta de Intervenção'
            };

            ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(key => {
                const nota = data.competencias[key] || 0;
                const texto = data.competencias_texto[key] || "Sem comentários específicos.";
                const nome = nomesComp[key];

                // Cria o HTML do Card
                const cardHTML = `
                    <div class="comp-card">
                        <div class="comp-header">
                            <span class="comp-title"><strong>${key.toUpperCase()}:</strong> ${nome}</span>
                            <span class="comp-score">${nota}</span>
                        </div>
                        <div class="comp-body">
                            <p>${texto}</p>
                        </div>
                    </div>
                `;
                containerComp.innerHTML += cardHTML;
            });

        } else {
            document.getElementById('texto-completo').innerText = "Erro ao carregar redação.";
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
    }
});