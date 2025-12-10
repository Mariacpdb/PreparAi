const API_URL = "http://localhost:5000";


function getUsuario() {
    const u = localStorage.getItem('usuario');
    return u ? JSON.parse(u) : null;
}


async function login(email, senha) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, senha })
    });
    const data = await res.json();
    if(data.status === 'ok') {
        localStorage.setItem('usuario', JSON.stringify(data.user));
        return true;
    }
    return false;
}


async function iniciarSimulado() {
    const u = getUsuario();
    if(!u) { alert("Faça login!"); window.location.href='index.html'; return; }
    
    const res = await fetch(`${API_URL}/simulado/iniciar`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ usuario_id: u.id })
    });
    const data = await res.json();
    localStorage.setItem('exame_atual', data.exame_id);
    return data.exame_id;
}

async function carregarQuestoes() {
    const res = await fetch(`${API_URL}/simulado/questoes`);
    return await res.json();
}

async function responderQuestao(qId, resp) {
    const eid = localStorage.getItem('exame_atual');
    await fetch(`${API_URL}/simulado/responder`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ exame_id: eid, questao_id: qId, resposta: resp })
    });
}

async function finalizarSimulado() {
    const eid = localStorage.getItem('exame_atual');
    const res = await fetch(`${API_URL}/simulado/finalizar`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ exame_id: eid })
    });
    const data = await res.json();
    alert(`Nota final: ${data.nota}`);
    window.location.href = 'home.html';
}

async function carregarDashboardData(uid) {
    const res = await fetch(`${API_URL}/dashboard/resumo/${uid}`);
    return await res.json();
}

async function carregarMateriasData(uid) {
    const res = await fetch(`${API_URL}/dashboard/materias/${uid}`);
    return await res.json();
}
