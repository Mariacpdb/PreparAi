document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem('usuario'));
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const lista = document.getElementById('lista-historico');

    try {
        const res = await fetch(`http://localhost:5000/historico/${user.id}`);
        
        if (res.ok) {
            const dados = await res.json();
            
            lista.innerHTML = "";

            if (dados.length === 0) {
                lista.innerHTML = `
                    <div style="text-align:center; padding:40px; color:#999;">
                        <i class="fas fa-folder-open" style="font-size:3rem; margin-bottom:10px;"></i>
                        <p>Você ainda não realizou nenhum simulado.</p>
                    </div>
                `;
                return;
            }

            dados.forEach(item => {
                const card = document.createElement('div');
                if (item.categoria === 'SIMULADO') {
                    card.className = 'history-card simulado';
                    card.innerHTML = `
                        <div class="card-info">
                            <h3><i class="fas fa-graduation-cap"></i> ${item.titulo}</h3>
                            <div class="card-date">
                                <i class="far fa-calendar-alt"></i> ${item.data}
                            </div>
                        </div>
                        <div class="card-stats">
                            <div class="stat-item">
                                <span class="stat-value">${item.nota}</span>
                                <span class="stat-label">Nota</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value green">${item.info_extra.acertos}</span>
                                <span class="stat-label">Acertos</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value red">${item.info_extra.erros}</span>
                                <span class="stat-label">Erros</span>
                            </div>
                        </div>
                    `;
                 
                    card.onclick = () => window.location.href = `detalhes_simulado.html?id=${item.id}`;

                } else {
                    
                    card.className = 'history-card redacao';
                    card.innerHTML = `
                        <div class="card-info">
                            <h3><i class="fas fa-pen-nib"></i> ${item.titulo}</h3>
                            <div class="card-date">
                                <i class="far fa-calendar-alt"></i> ${item.data}
                            </div>
                        </div>
                        <div class="card-stats">
                            <div class="stat-item big-score">
                                <span class="stat-value purple">${item.nota}</span>
                                <span class="stat-label">Nota Final</span>
                            </div>
                        </div>
                    `;
                   
                    card.onclick = () => window.location.href = `detalhes_redacao.html?id=${item.id}`;
                }
                
                lista.appendChild(card);
            });

        } else {
            lista.innerHTML = "<p>Erro ao carregar histórico.</p>";
        }
    } catch (e) {
        console.error(e);
        lista.innerHTML = "<p>Erro de conexão.</p>";
    }
});
