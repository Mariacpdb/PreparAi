const perguntas = [
  {
    texto: "O quanto você domina Matemática?",
    opcoes: ["Muito", "Razoavelmente", "Mediano", "Pouco", "Nada"]
  },
  {
    texto: "O quanto você domina Redação?",
    opcoes: ["Muito", "Razoavelmente", "Mediano", "Pouco", "Nada"]
  },
  {
    texto: "O quanto você domina Língua Portuguesa?",
    opcoes: ["Muito", "Razoavelmente", "Mediano", "Pouco", "Nada"]
  },
  {
    texto: "O quanto você domina Ciências Naturais?",
    opcoes: ["Muito", "Razoavelmente", "Mediano", "Pouco", "Nada"]
  },
  {
    texto: "O quanto você domina Ciências Humanas?",
    opcoes: ["Muito", "Razoavelmente", "Mediano", "Pouco", "Nada"]
  },
];

let indice = 0;
let respostas = [];

function mostrarPergunta() {
  const p = perguntas[indice];

  document.getElementById("pergunta").innerText = p.texto;

  const opcoesDiv = document.getElementById("opcoes");
  opcoesDiv.innerHTML = "";

  p.opcoes.forEach(op => {
    const btn = document.createElement("div");
    btn.className = "opcao";
    btn.innerText = op;

    btn.onclick = () => {
      respostas.push({ pergunta: p.texto, resposta: op });

      indice++;

      if (indice < perguntas.length) {
        mostrarPergunta();
      } else {
        finalizarQuestionario();
      }
    };

    opcoesDiv.appendChild(btn);
  });
}

function finalizarQuestionario() {
  document.querySelector(".container").innerHTML = `
    <h2>Obrigado!</h2>
    <p>Suas respostas foram registradas.</p>
  `;

  fetch("/api/salvar-questionario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(respostas)
  });
}

mostrarPergunta();