document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem('usuario'));
    
    
    if (!user) {
        window.location.href = "index.html";
        return;
    }

  
    const nomeElement = document.getElementById('msg-bem-vindo');
    if (nomeElement) {
        const primeiroNome = user.nome.split(' ')[0];
        nomeElement.innerText = `Olá, ${primeiroNome}!`;
    }


    try {
        const res = await fetch(`http://localhost:5000/dashboard/resumo/${user.id}`);
        
        if (res.ok) {
            const dados = await res.json();
            
            document.getElementById('dash-simulados').innerText = dados.simulados || 0;
            document.getElementById('dash-redacoes').innerText = dados.redacoes || 0;
            document.getElementById('dash-media').innerText = dados.media_geral || 0;
            
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

    const cardRec = document.getElementById('card-recomendacao');
    const tituloRec = document.getElementById('rec-titulo');
    const textoRec = document.getElementById('rec-texto');

    try {
        cardRec.style.display = 'flex';
        
        const resRec = await fetch(`http://localhost:5000/dashboard/recomendacao/${user.id}`);
        
        if (resRec.ok) {
            const dataRec = await resRec.json();
            tituloRec.innerText = dataRec.titulo;
            textoRec.innerText = dataRec.texto;
        } else {
            cardRec.style.display = 'none';
        }
    } catch (e) {
        console.error("Erro na recomendação:", e);
        cardRec.style.display = 'none';
    }
    
});