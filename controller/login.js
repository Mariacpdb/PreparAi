const form = document.getElementById("loginForm");

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const senha = document.getElementById("senha").value;
        const btn = form.querySelector('button');
        const textoOriginal = btn.innerText;

        btn.innerText = "Entrando...";
        btn.disabled = true;

        try {
            const res = await fetch("http://localhost:5000/login", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json; charset=UTF-8"
                },
                body: JSON.stringify({ email, senha })
            });

            
            if (!res.ok) {
                const txt = await res.json();
                alert(txt.error || 'Erro no login');
                return;
            }

            const data = await res.json();

            if (data.status === 'ok') {
                localStorage.setItem("usuario", JSON.stringify(data.user));
                
                alert("Login realizado com sucesso! Bem-vindo(a) " + data.user.nome);
                window.location.href = "home.html";
            } else {
                alert(data.error || 'Login falhou');
            }

        } catch (err) {
            console.error('Erro:', err);
            alert('Não foi possível conectar ao servidor.');
        } finally {
            btn.innerText = textoOriginal;
             btn.disabled = false;
        }
    });
} else {
    console.warn('Formulário de login não encontrado');
}