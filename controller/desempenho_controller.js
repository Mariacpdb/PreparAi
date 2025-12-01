document.addEventListener("DOMContentLoaded", async () => {
    const user = getUsuario();
    if (!user) {
        console.log("Usuário não logado.");
        return;
    }

    try {
        console.log("Buscando dados de desempenho...");
        const res = await fetch(`http://localhost:5000/dashboard/materias/${user.id}`);
        const dados = await res.json();
        console.log("Dados recebidos:", dados)

        // --- 1. TRATAMENTO SE NÃO TIVER DADOS (Aviso para o usuário) ---
        if (!dados || dados.length === 0) {
            console.log("Nenhum dado encontrado. Mostrando aviso de vazio.");
            const containers = document.querySelectorAll('.subject-charts');
            containers.forEach(div => {
                div.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #666;">
                        <i class="fas fa-chart-pie" style="font-size: 40px; margin-bottom: 10px; display: block; color: #ddd;"></i>
                        <p>Ainda não há dados suficientes.</p>
                        <a href="simulado.html" style="color: #1d4e98; font-weight: bold;">Faça um Simulado</a>
                    </div>
                `;
            });
            return;
        }

        // --- 2. MAPA DE IDs (Para ligar Banco -> HTML) ---
        // Ajuste aqui se os nomes no seu banco forem diferentes!
        const mapaIDs = {
            "linguagens": "chart-Linguagens",
            "ciencias-humanas": "chart-Humanas",
            "ciencias-natureza": "chart-Natureza",
            "matematica": "chart-Matemática"
        };

        // --- 3. DESENHA OS GRÁFICOS ---
        dados.forEach(dado => {
            // Tenta pegar o ID usando o mapa
            const canvasId = mapaIDs[dado.materia]; 
            console.log(`Tentando desenhar '${dado.materia}' no ID: ${canvasId}`);

            const canvasElement = document.getElementById(canvasId);

            if (canvasElement) {
                const acertos = dado.percentual;
                const erros = 100 - dado.percentual;

                // Destroi gráfico anterior se existir (evita bug de sobreposição)
                if (canvasElement.chartInstance) {
                    canvasElement.chartInstance.destroy();
                }

                const newChart = new Chart(canvasElement, {
                    type: 'doughnut',
                    data: {
                        labels: ['Acertos', 'Erros'],
                        datasets: [{
                            data: [acertos, erros],
                            backgroundColor: [
                                '#4CAF50', // Verde Vibrante
                                '#FF5252'  // Vermelho Suave
                            ],
                            borderWidth: 0,
                            borderRadius: 20, // Borda arredondada nas pontas (Fica lindo!)
                            hoverOffset: 10   // Efeito de "pulo" ao passar o mouse
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false, // Importante para respeitar o CSS
                        cutout: '75%', // Deixa o anel bem fininho e elegante
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
                                backgroundColor: 'rgba(29, 78, 152, 0.9)', // Tooltip Azul
                                padding: 12,
                                cornerRadius: 8,
                                displayColors: false, // Remove quadrado de cor do tooltip
                                callbacks: {
                                    label: function(context) {
                                        return ` ${context.label}: ${context.raw}%`;
                                    }
                                }
                            },
                            // Texto no Centro (Plugin Simples)
                            title: {
                                display: true,
                                text: `${Math.round(dado.percentual)}%`,
                                position: 'bottom', // Gambiarra visual ou usar plugin externo para centro
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
                
                // Salva instancia para poder destruir depois
                canvasElement.chartInstance = newChart;

                // --- MENSAGEM BONITA EMBAIXO ---
                const container = canvasElement.parentElement.parentElement; // Sobe para o card
                
                // Remove mensagem antiga
                const msgAntiga = container.querySelector('.feedback-msg');
                if(msgAntiga) msgAntiga.remove();

                const msg = document.createElement('div');
                msg.className = 'feedback-msg';
                msg.innerText = dado.mensagem;
                
                // Estiliza a cor do texto/borda baseado na nota
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
});