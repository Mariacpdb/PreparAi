
const formRegistro = document.getElementById("registroForm");

if (formRegistro) {
    formRegistro.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nome = document.getElementById("nome").value;
        const email = document.getElementById("email").value;
        const senha = document.getElementById("senha").value;

       
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

            if (!res.ok) {
                const errorData = await res.json();
                alert(errorData.error || 'Erro ao cadastrar usuário');
                return;
            }

            
            alert("Cadastro realizado com sucesso! Agora faça seu login.");
            
            window.location.href = "index.html"; 

        } catch (err) {
            console.error('Erro na requisição:', err);
            alert('Erro ao conectar ao servidor. Verifique se o backend está rodando.');
        }
    });
} else {
    console.warn("Formulário de registro não encontrado.");
}