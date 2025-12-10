document.addEventListener("DOMContentLoaded", async () => {
    const user = getUsuario();
    if (!user) {
        console.log("Usuário não logado.");
        return;
    }

    await carregarGraficoEvolucao(user.id);

    await carregarGraficosMateria(user.id);
});

async function carregarGraficoEvolucao(userId) {
    const ctx = document.getElementById('graficoEvolucao');

    if (!ctx) {
        console.error("ERRO CRÍTICO: Não achei o <canvas id='graficoEvolucao'> no HTML!");
        return; 
    }

    try {
        console.log("Buscando dados de evolução...");
        const res = await fetch(`http://localhost:5000/api/graficos/evolucao/${userId}`);
        
        if (!res.ok) throw new Error(`Erro API: ${res.status}`);

        const dados = await res.json();
        console.log("Dados Evolução Recebidos:", dados);

        if (!dados.notas || dados.notas.length === 0) {
            ctx.parentElement.innerHTML = `
                <div style="text-align: center; color: #666; padding: 50px;">
                    <i class="fas fa-chart-line" style="font-size: 40px; margin-bottom: 10px; color: #ccc;"></i>
                    <p>Você ainda não tem histórico de simulados.</p>
                    <a href="simulado.html" style="color: #1d4e98; font-weight: bold;">Começar agora</a>
                </div>`;
            return;
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: dados.labels,
                datasets: [{
                    label: 'Nota Total',
                    data: dados.notas,
                    borderColor: '#1d4e98',
                    backgroundColor: 'rgba(29, 78, 152, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#1d4e98',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1d4e98',
                        padding: 10,
                        displayColors: false,
                        callbacks: { label: (c) => `Nota: ${c.raw}` }
                    }
                },
                scales: {
                    y: { beginAtZero: false, suggestedMin: 0, suggestedMax: 1000 },
                    x: { grid: { display: false } }
                }
            }
        });

    } catch (e) {
        console.error("Erro JS Evolução:", e);
        ctx.parentElement.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar gráfico: ${e.message}</p>`;
    }
}
async function carregarGraficosMateria(userId) {
    try {
        console.log("Buscando dados de desempenho...");
        const res = await fetch(`http://localhost:5000/dashboard/materias/${userId}`);
        const dados = await res.json();
        console.log("Dados recebidos:", dados)

        if (!dados || dados.length === 0) {
            console.log("Nenhum dado encontrado. Mostrando aviso de vazio.");
            const containers = document.querySelectorAll('.subject-charts');
            containers.forEach(div => {
                div.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #888;">
                        <i class="fas fa-chart-pie" style="font-size: 40px; margin-bottom: 15px; display: block; color: #ddd;"></i>
                        <p>Realize um simulado para ver seu desempenho aqui.</p>
                        <a href="simulado.html" style="color: #1d4e98; font-weight: bold; text-decoration: none;">Ir para Simulado</a>
                    </div>
                `;
            });
            return;
        }

        const mapaIDs = {
            "linguagens": "chart-Linguagens",
            "ciencias-humanas": "chart-Humanas",
            "ciencias-natureza": "chart-Natureza",
            "matematica": "chart-Matemática"
        };

        dados.forEach(dado => {
            let canvasId = mapaIDs[dado.materia]; 
            console.log(`Tentando desenhar '${dado.materia}' no ID: ${canvasId}`);
            if(!canvasId) {
                const nome = dado.materia.toLowerCase();
                if(nome.includes("humanas")) canvasId = "chart-Humanas";
                else if(nome.includes("natureza")) canvasId = "chart-Natureza";
                else if(nome.includes("linguagens")) canvasId = "chart-Linguagens";
                else if(nome.includes("matematica")) canvasId = "chart-Matemática";
            }

            const canvasElement = document.getElementById(canvasId);

            if (canvasElement) {
                if (canvasElement.chartInstance) {
                    canvasElement.chartInstance.destroy();
                }

                const newChart = new Chart(canvasElement, {
                    type: 'doughnut',
                    data: {
                        labels: ['Acertos', 'Erros'],
                        datasets: [{
                            data: [dado.percentual, 100 - dado.percentual],
                            backgroundColor: [
                                '#4CAF50', 
                                '#FF5252'  
                            ],
                            borderWidth: 0,
                            borderRadius: 20, 
                            hoverOffset: 5   
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false, 
                        cutout: '75%', 
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    usePointStyle: true,
                                    padding: 20,
                                    font: { family: "'Segoe UI', sans-serif", size: 12 }
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(29, 78, 152, 0.9)', 
                                padding: 12,
                                cornerRadius: 8,
                                displayColors: false, 
                                callbacks: {
                                    label: function(context) {
                                        return ` ${context.label}: ${context.raw}%`;
                                    }
                                }
                            },
                            title: {
                                display: true,
                                text: `${Math.round(dado.percentual)}%`,
                                position: 'bottom',
                                color: '#1d4e98',
                                font: { size: 24, weight: 'bold' },
                                padding: { bottom: 10 }
                            }
                        },
                        animation: {
                            animateScale: true,
                            animateRotate: true
                        }
                    }
                });
                
                canvasElement.chartInstance = newChart;

                const container = canvasElement.parentElement.parentElement; 
                
                const msgAntiga = container.querySelector('.feedback-msg');
                if(msgAntiga) msgAntiga.remove();

                const msg = document.createElement('div');
                msg.className = 'feedback-msg';
                msg.innerText = dado.mensagem;
                
                if (dado.percentual >= 70) {
                    msg.style.color = '#2e7d32';
                    msg.style.backgroundColor = '#e8f5e9';
                    msg.style.border = '1px solid #c8e6c9';
                } else if (dado.percentual < 50) {
                    msg.style.color = '#c62828';
                    msg.style.backgroundColor = '#ffebee';
                    msg.style.border = '1px solid #ffcdd2';
                } else {
                    msg.style.color = '#ef6c00';
                    msg.style.backgroundColor = '#fff3e0';
                    msg.style.border = '1px solid #ffe0b2';
                }
                container.appendChild(msg);
            } else {
                console.warn(`Elemento HTML com ID '${canvasId}' não encontrado para a matéria: ${dado.materia}`);
            }
        });
    } catch (e) {
        console.error("Erro fatal ao gerar gráficos:", e);
    }
}