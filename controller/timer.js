document.addEventListener("DOMContentLoaded", () => {
    // 1. Carrega CSS
    if (!document.querySelector('link[href="styles/styles-timer.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'styles/styles-timer.css'; 
        document.head.appendChild(link);
    }
    criarWidgetRelogio();
    carregarEstadoTimer(); // Recupera memória
});

let timerInterval;
let estaRodando = false;
let ultimaAtualizacao = Date.now();

// ESTADO GLOBAL (Memória de cada modo)
let estado = {
    modoAtual: 'pomodoro',
    dados: {
        pomodoro: { tempo: 1500, status: 'foco', ciclos: 0 }, // 25 min
        redacao: { tempo: 0, status: 'contando' },            // 0 min
        simulado: { tempo: 18000, status: 'contando' }        // 5 horas
    }
};

// --- CRIAÇÃO DO WIDGET ---
function criarWidgetRelogio() {
    const div = document.createElement('div');
    div.innerHTML = `
        <button class="timer-toggle-btn" onclick="toggleTimer()" title="Timer de Estudos">
            <i class="fas fa-stopwatch"></i>
        </button>

        <div class="timer-panel" id="painelRelogio">
            <div class="timer-tabs">
                <div class="timer-tab" id="tab-pomodoro" onclick="mudarModo('pomodoro')">🍅 Pomodoro</div>
                <div class="timer-tab" id="tab-redacao" onclick="mudarModo('redacao')">📝 Redação</div>
                <div class="timer-tab" id="tab-simulado" onclick="mudarModo('simulado')">🎓 Simulado</div>
            </div>
            
            <div class="timer-body">
                <span class="timer-status" id="timerLabel">...</span>
                <div class="timer-display" id="timerDisplay">00:00</div>
                <p id="ciclosInfo" style="font-size:0.8rem; color:#888; margin-top:-5px; margin-bottom:15px;">Ciclo: 1/4</p>
                
                <div class="timer-controls">
                    <button class="btn-control btn-play" id="btnPlay" onclick="iniciarTimer()">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn-control btn-pause" id="btnPause" onclick="pausarTimer()" style="display:none;">
                        <i class="fas fa-pause"></i>
                    </button>
                    <button class="btn-control btn-reset" onclick="resetarTimer()">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

// --- FUNÇÕES DE CONTROLE ---

window.toggleTimer = function() {
    document.getElementById('painelRelogio').classList.toggle('active');
};

window.mudarModo = function(novoModo) {
    pausarTimer(); // Pausa ao trocar de aba para não bugar
    estado.modoAtual = novoModo; // Apenas troca o foco, não reseta valores
    
    atualizarInterface();
    salvarEstadoTimer();
};

window.iniciarTimer = function() {
    if (estaRodando) return;
    estaRodando = true;
    ultimaAtualizacao = Date.now();
    
    atualizarInterface();
    salvarEstadoTimer();

    timerInterval = setInterval(() => {
        const agora = Date.now();
        const delta = Math.floor((agora - ultimaAtualizacao) / 1000);

        if (delta >= 1) {
            ultimaAtualizacao = agora;
            processarTempo(delta); // Função separada para lógica
            atualizarInterface();
            salvarEstadoTimer();
        }
    }, 1000);
};

function processarTempo(delta) {
    const modo = estado.modoAtual;
    const dados = estado.dados[modo];

    if (modo === 'redacao') {
        // Redação CONTA PARA CIMA (Cronômetro)
        dados.tempo += delta;
    } else {
        // Outros CONTAM PARA BAIXO (Timer)
        if (dados.tempo > 0) {
            dados.tempo -= delta;
        } else {
            // Acabou o tempo
            if (modo === 'pomodoro') {
                logicaPomodoro(dados);
            } else {
                tocarAlarme("Tempo esgotado!");
                pausarTimer();
            }
        }
    }
}

window.pausarTimer = function() {
    estaRodando = false;
    clearInterval(timerInterval);
    atualizarInterface();
    salvarEstadoTimer();
};

window.resetarTimer = function() {
    pausarTimer();
    const modo = estado.modoAtual;
    
    // Reseta apenas o modo atual para o padrão
    if (modo === 'pomodoro') {
        estado.dados.pomodoro = { tempo: 1500, status: 'foco', ciclos: 0 };
    } else if (modo === 'redacao') {
        estado.dados.redacao = { tempo: 0, status: 'contando' };
    } else {
        estado.dados.simulado = { tempo: 18000, status: 'contando' };
    }
    
    atualizarInterface();
    salvarEstadoTimer();
};

// --- LÓGICA POMODORO ---
function logicaPomodoro(dados) {
    tocarAlarme("Ciclo finalizado!");
    
    if (dados.status === 'foco') {
        dados.ciclos++;
        if (dados.ciclos >= 4) {
            dados.status = 'pausa_longa';
            dados.tempo = 15 * 60; // 15 min
            dados.ciclos = 0; // Reseta ciclos
        } else {
            dados.status = 'pausa';
            dados.tempo = 5 * 60; // 5 min
        }
    } else {
        dados.status = 'foco';
        dados.tempo = 25 * 60; // 25 min
    }
}

// --- VISUAL ---
function atualizarInterface() {
    const modo = estado.modoAtual;
    const dados = estado.dados[modo];
    
    // 1. Abas
    document.querySelectorAll('.timer-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${modo}`).classList.add('active');

    // 2. Display de Tempo
    const horas = Math.floor(dados.tempo / 3600);
    const minutos = Math.floor((dados.tempo % 3600) / 60);
    const segundos = dados.tempo % 60;
    
    let texto = "";
    if (horas > 0 || modo === 'simulado') texto += `${String(horas).padStart(2, '0')}:`;
    texto += `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
    
    const display = document.getElementById('timerDisplay');
    if (display) display.innerText = texto;

    // 3. Labels e Status
    const label = document.getElementById('timerLabel');
    const ciclosInfo = document.getElementById('ciclosInfo');
    
    label.className = "timer-status";
    
    if (modo === 'pomodoro') {
        ciclosInfo.style.display = 'block';
        ciclosInfo.innerText = `Ciclo: ${dados.ciclos + 1}/4`;
        
        if (dados.status === 'foco') {
            label.innerText = "🔥 Hora de Focar!";
            label.classList.add('status-foco');
        } else {
            const tipoPausa = dados.status === 'pausa_longa' ? "Longa (15m)" : "Curta (5m)";
            label.innerText = `☕ Pausa ${tipoPausa}`;
            label.classList.add('status-pausa');
        }
    } else if (modo === 'redacao') {
        ciclosInfo.style.display = 'none';
        label.innerText = "✏️Tempo de Escrita";
        label.classList.add('status-foco');
    } else {
        ciclosInfo.style.display = 'none';
        label.innerText = "⏰Tempo Restante";
        label.classList.add('status-foco');
    }

    // 4. Botões
    const btnPlay = document.getElementById('btnPlay');
    const btnPause = document.getElementById('btnPause');
    if (btnPlay && btnPause) {
        btnPlay.style.display = estaRodando ? 'none' : 'flex';
        btnPause.style.display = estaRodando ? 'flex' : 'none';
    }
    
    if (estaRodando) document.title = `${texto} - PreparAI`;
    else document.title = "PreparAI";
}

// --- PERSISTÊNCIA ---
function salvarEstadoTimer() {
    // Salva tudo: modo atual e os tempos de cada um
    localStorage.setItem('preparai_timer_full', JSON.stringify({
        estado: estado,
        estaRodando: estaRodando,
        ultimaAtualizacao: ultimaAtualizacao
    }));
}

function carregarEstadoTimer() {
    const salvo = localStorage.getItem('preparai_timer_full');
    if (salvo) {
        const obj = JSON.parse(salvo);
        
        // Recupera dados salvos
        if (obj.estado) estado = obj.estado;
        
        // Lógica de tempo offline (tempo que passou com aba fechada)
        if (obj.estaRodando) {
            const agora = Date.now();
            const passou = Math.floor((agora - obj.ultimaAtualizacao) / 1000);
            
            // Aplica o tempo que passou no modo que estava ativo
            const modo = estado.modoAtual;
            const dados = estado.dados[modo];
            
            if (modo === 'redacao') {
                dados.tempo += passou;
            } else {
                dados.tempo = Math.max(0, dados.tempo - passou);
            }
            
            // Continua rodando
            iniciarTimer();
        } else {
            atualizarInterface();
        }
    } else {
        atualizarInterface(); // Primeira vez
    }
}

function tocarAlarme(msg) {
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        oscillator.type = "sine"; oscillator.frequency.value = 800;
        oscillator.connect(context.destination); oscillator.start();
        setTimeout(() => oscillator.stop(), 500); 
    } catch(e) {}
    alert("⏰ " + msg);
}