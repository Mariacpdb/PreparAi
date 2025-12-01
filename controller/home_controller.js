document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem('usuario'));
    
    // Se não tiver usuário logado, manda pro login
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // Preenche o nome do usuário na saudação
    const nomeElement = document.getElementById('msg-bem-vindo');
    if (nomeElement) {
        // Pega só o primeiro nome
        const primeiroNome = user.nome.split(' ')[0];
        nomeElement.innerText = `Olá, ${primeiroNome}!`;
    }

    // Busca os dados do Dashboard (KPIs)
    try {
        const res = await fetch(`http://localhost:5000/dashboard/resumo/${user.id}`);
        
        if (res.ok) {
            const dados = await res.json();
            
            // Atualiza os números na tela
            // O "|| 0" serve para garantir que mostre 0 se vier null
            document.getElementById('dash-simulados').innerText = dados.simulados || 0;
            document.getElementById('dash-redacoes').innerText = dados.redacoes || 0;
            document.getElementById('dash-media').innerText = dados.media_geral || 0;
            
            // Atualiza a mensagem de incentivo
            const msgElement = document.getElementById('dash-msg');
            if (msgElement && dados.mensagem) {
                msgElement.innerText = dados.mensagem;
            }
        } else {
            console.error("Erro ao buscar resumo:", await res.text());
        }
    } catch (e) {
        console.error("Erro de conexão na Home:", e);
    }
});