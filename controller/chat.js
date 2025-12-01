document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");
    const messagesContainer = document.getElementById("chatMessages");
    // Conversa local mantida no cliente para enviar histórico completo ao servidor
    const conversation = [];

    // Função para adicionar mensagens na tela
    function addMessage(text, sender = "user") {
        const msg = document.createElement("div");
        msg.classList.add("message", sender);

        // Para mensagens do bot: renderizamos Markdown -> HTML e sanitizamos com DOMPurify
        if (sender === "bot") {
            if (window.marked && window.DOMPurify) {
                try {
                    const unsafeHtml = marked.parse(text || "");
                    const safeHtml = DOMPurify.sanitize(unsafeHtml, { ADD_ATTR: ['target'] });
                    msg.innerHTML = safeHtml;
                } catch (e) {
                    // fallback seguro: mostrar texto simples com quebras preservadas
                    msg.textContent = text;
                    msg.style.whiteSpace = 'pre-wrap';
                }
            } else {
                // bibliotecas não carregadas: fallback
                msg.textContent = text;
                msg.style.whiteSpace = 'pre-wrap';
            }
        } else {
            // mensagens do usuário: manter como texto (não permitir HTML)
            msg.textContent = text;
        }

        messagesContainer.appendChild(msg);

        // Scroll sempre para o final
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

   async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // 1. Pega o usuário do localStorage para ter o ID
        const user = JSON.parse(localStorage.getItem('usuario')); // <--- MUDANÇA IMPORTANTE

        // adicionar mensagem do usuário na UI e no histórico local
        addMessage(text, "user");
        conversation.push({ role: "user", content: text });
        input.value = "";

        // Antes de enviar, truncar o histórico
        function getTruncatedHistory(conv, maxItems = 12, maxChars = 1500) {
            const recent = conv.slice(-maxItems);
            return recent.map(msg => ({
                role: msg.role,
                content: (typeof msg.content === 'string') ? msg.content.slice(0, maxChars) : ''
            }));
        }

        try {
            const truncated = getTruncatedHistory(conversation, 12, 1500);
            
            // 2. Agora enviamos o PACOTE COMPLETO para o Python
            const payload = {
                usuario_id: user ? user.id : null, // <--- MUDANÇA: Manda o ID
                message: text,                     // <--- MUDANÇA: Manda a msg atual separada
                history: truncated
            };

            const response = await fetch("http://localhost:5000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload) // Envia o payload novo
            });

            const data = await response.json();

            // Se der erro no Python, mostramos aqui
            if (!response.ok) {
                throw new Error(data.error || "Erro no servidor");
            }

            const botReply = data.reply || "Erro ao processar resposta.";
            addMessage(botReply, "bot");
            conversation.push({ role: "assistant", content: botReply });

        } catch (error) {
            console.error(error);
            addMessage("Desculpe, tive um erro ao conectar. Tente recarregar a página.", "bot");
        }
    }

    // Enviar ao clicar
    sendBtn.addEventListener("click", sendMessage);

    // Ajustes para textarea: Enter envia mensagem, Ctrl+Enter insere nova linha
    function autoResize() {
        // reset para calcular corretamente
        input.style.height = 'auto';
        const max = 200; // px
        input.style.height = Math.min(input.scrollHeight, max) + 'px';
    }

    // inicializa altura correta
    autoResize();

    input.addEventListener('input', autoResize);

    // Enviar ao apertar Enter; Ctrl+Enter ou Shift+Enter inserem nova linha.
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            // Se Ctrl ou Shift estiverem pressionados, inserimos explicitamente uma nova linha
            if (e.ctrlKey || e.shiftKey) {
                e.preventDefault();
                const start = input.selectionStart;
                const end = input.selectionEnd;
                const value = input.value;
                // inserir '\n' no cursor, preservando seleção
                input.value = value.slice(0, start) + "\n" + value.slice(end);
                // mover cursor para após a nova linha
                const caret = start + 1;
                input.selectionStart = input.selectionEnd = caret;
                // ajustar altura após alteração
                autoResize();
                return;
            }

            // Enter sem modificador: enviar mensagem
            e.preventDefault();
            sendMessage();
        }
    });
});