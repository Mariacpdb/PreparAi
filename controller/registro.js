// controller/registro.js - VERSÃO CORRIGIDA DEFINITIVA

const formRegistro = document.getElementById("registroForm");

if (formRegistro) {
    formRegistro.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nome = document.getElementById("nome").value;
        const email = document.getElementById("email").value;
        const senha = document.getElementById("senha").value;

        // Debug para ver se pegou os dados
        console.log("Enviando cadastro:", { nome, email, senha });

        if (!nome || !email || !senha) {
            alert("Por favor, preencha todos os campos!");
            return;
        }

        try {
            const res = await fetch("http://localhost:5000/add_user", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json; charset=UTF-8"
                },
                body: JSON.stringify({ nome, email, senha })
            });

            // Se der erro (tipo email duplicado), o backend manda 400 ou 500
            if (!res.ok) {
                const errorData = await res.json();
                alert(errorData.error || 'Erro ao cadastrar usuário');
                return;
            }

            // SE CHEGOU AQUI, O CADASTRO DEU CERTO (Status 200-299)
            // Não precisa checar 'data.status' aqui, porque o add_user retorna direto o usuário
            
            alert("Cadastro realizado com sucesso! Agora faça seu login.");
            
            // Redireciona para a tela de LOGIN (index.html) e não para a home
            window.location.href = "index.html"; 

        } catch (err) {
            console.error('Erro na requisição:', err);
            alert('Erro ao conectar ao servidor. Verifique se o backend está rodando.');
        }
    });
} else {
    console.warn("Formulário de registro não encontrado.");
}