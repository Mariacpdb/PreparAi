let currentSessionId = null;

document.addEventListener("DOMContentLoaded", async () => {
    const input = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");
    const messagesContainer = document.getElementById("chatMessages");
    const user = JSON.parse(localStorage.getItem('usuario'));
    let conversation = [];

    if (!user) return;

    function formatarTextoIA(texto) {
        if (!texto) return "";
        let tratado = texto.replace(/\\/g, '\\\\');
        tratado = tratado.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
        tratado = tratado.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
        return tratado;
    }

    function addMessage(text, sender = "user") {
        const msgContainer = document.createElement("div");
        msgContainer.style.display = "flex";
        msgContainer.style.flexDirection = "column";
        msgContainer.style.width = "100%";

        const msg = document.createElement("div");
        msg.classList.add("message", sender);

        if (sender === "bot") {
            const textoSeguro = formatarTextoIA(text);
            if (window.marked && window.DOMPurify) {
                try {
                    const unsafeHtml = marked.parse(textoSeguro || "");
                    const safeHtml = DOMPurify.sanitize(unsafeHtml, { ADD_ATTR: ['target'] });
                    msg.innerHTML = safeHtml;
                } catch (e) {
                    msg.textContent = text;
                    msg.style.whiteSpace = 'pre-wrap';
                }
            } else {
                msg.textContent = text;
                msg.style.whiteSpace = 'pre-wrap';
            }
        } else {
            msg.textContent = text;
        }

        msgContainer.appendChild(msg);

        if (sender === "bot" && !text.includes("typing-dot") && !text.includes("Desculpe, tive um erro")) {
            const btnWrapper = document.createElement("div");
            btnWrapper.className = "magic-button-wrapper";
            
            const btn = document.createElement("button");
            btn.className = "btn-magic";
            btn.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> Explicação simplificada (Como se tivesse 5 anos)`

            const magicSound = new Audio('sounds/magic.mp3');
            magicSound.volume = 0.5;
            
            btn.onclick = (e) => {
                magicSound.currentTime = 0;
                magicSound.play().catch(e => console.log("Navegador bloqueou o som autoplay (normal)"));

                btn.classList.add('casting-spell');
                setTimeout(() => {
                    btn.classList.remove('casting-spell');
                },3000);

                const trecho = text.substring(0, 100) + "...";
                const promptSimples = `Explique isso que você acabou de falar ("${trecho}") de forma extremamente didática e lúdica, como se eu tivesse 5 anos. Use analogias do dia a dia.`;
                
                addMessage("🪄 Explique como se eu tivesse 5 anos...", "user");
                conversation.push({ role: "user", content: promptSimples });
                
                enviarParaBackend(promptSimples);
            };
            
            btnWrapper.appendChild(btn);
            msgContainer.appendChild(btnWrapper);
        }

        messagesContainer.appendChild(msgContainer);

        if (sender === "bot" && window.MathJax) {
            window.MathJax.typesetPromise([msg]).then(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }).catch((err) => console.log('Erro MathJax:', err));
        } else {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    async function enviarParaBackend(texto) {
        showLoading();

        function getTruncatedHistory(conv, maxItems = 12, maxChars = 1500) {
            const recent = conv.slice(-maxItems);
            return recent.map(msg => ({
                role: msg.role,
                content: (typeof msg.content === 'string') ? msg.content.slice(0, maxChars) : ''
            }));
        }

        try {
            const truncated = getTruncatedHistory(conversation, 12, 1500);
            
            const payload = {
                usuario_id: user.id, 
                message: texto,                     
                history: truncated
            };

            const response = await fetch("http://localhost:5000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload) 
            });

            const data = await response.json();
            removeLoading();

            if (!response.ok) throw new Error(data.error || "Erro no servidor");

            const botReply = data.reply || "Erro ao processar resposta.";
            
            addMessage(botReply, "bot");
            conversation.push({ role: "assistant", content: botReply });
            
            if (conversation.length <= 2) {
                carregarListaSessoes();
            }

        } catch (error) {
            removeLoading();
            console.error(error);
            addMessage("Desculpe, tive um erro ao conectar. Tente recarregar a página.", "bot");
        }
    }

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, "user");
        conversation.push({ role: "user", content: text });
        input.value = "";
        autoResize();

        await enviarParaBackend(text);
    }

    async function carregarListaSessoes() {
        const lista = document.getElementById('lista-sessoes');
        if (!lista) return;

        try {
            const res = await fetch(`http://localhost:5000/api/chat/sessoes/${user.id}`);
            if (res.ok) {
                const sessoes = await res.json();
                lista.innerHTML = "";

                sessoes.forEach(sessao => {
                    const div = document.createElement('div');
                    div.className = 'session-item';
                    if (sessao.id === currentSessionId) div.classList.add('active');
                    div.innerHTML = `<i class="far fa-comments"></i> ${sessao.titulo}`;
                    
                    div.onclick = () => {
                        document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
                        div.classList.add('active');
                        loadChatHistory(sessao.id);
                    };
                    lista.appendChild(div);
                });
            }
        } catch (e) {
            console.error("Erro sidebar:", e);
        }
    }

    async function loadChatHistory(sessionId) {
        currentSessionId = sessionId;
        messagesContainer.innerHTML = '';
        conversation = [];

        try {
            let url = `http://localhost:5000/api/chat/historico/${user.id}`;
            if (sessionId) url += `?sessao_id=${sessionId}`;

            const res = await fetch(url);
            
            if (res.ok) {
                const history = await res.json();

                if (history.length === 0) {
                    const nome = user.nome.split(' ')[0];
                    addMessage(`Olá, ${nome}! Sou o PreparAI. Como posso ajudar nos seus estudos hoje?`, "bot");
                } else {
                    history.forEach(item => {
                        const senderClass = item.role === 'user' ? 'user' : 'bot';
                        const textContent = item.content || "";
                        addMessage(textContent, senderClass);
                        conversation.push({ role: item.role, content: textContent });
                    });
                }
            }
        } catch (error) {
            console.error("Erro chat:", error);
        }
    }

    window.criarNovoChat = async function() {
        if(!confirm("Deseja iniciar uma nova conversa?")) return;
        try {
            const res = await fetch('http://localhost:5000/api/chat/novo', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ usuario_id: user.id })
            });
            if(res.ok) {
                await carregarListaSessoes(); 
                loadChatHistory(null);
            }
        } catch(e) { console.error(e); }
    };

    function showLoading() {
        const loadingDiv = document.createElement("div");
        loadingDiv.id = "loading-bubble";
        loadingDiv.classList.add("message", "loading");
        loadingDiv.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function removeLoading() {
        const loadingDiv = document.getElementById("loading-bubble");
        if (loadingDiv) loadingDiv.remove();
    }

    function autoResize() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    }

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener('input', autoResize);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    await carregarListaSessoes();
    await loadChatHistory(null);
});