# 🧠 PreparAI  
**Plataforma inteligente para estudos do ENEM com simulados, redação corrigida por IA, dashboard de desempenho e chatbot educacional.**

Este projeto foi desenvolvido por mim e meus colegas como uma solução completa para auxiliar estudantes na preparação para o ENEM. A aplicação integra frontend em **JavaScript**, backend em **Flask (Python)** e banco de dados **PostgreSQL**, além de recursos avançados de **IA (OpenAI)** para análise de redação e interação via chatbot.

---

## 🚀 Funcionalidades Principais

### ✔️ Simulados ENEM
- Questões reais organizadas por áreas de conhecimento  
- Correção automática  
- Feedback detalhado de acertos e erros  
- Revisão completa com gabarito colorido  

### ✔️ Correção de Redação por IA
- Envio de texto ou foto da redação  
- Transcrição automática (OCR com IA)  
- Avaliação segundo as 5 competências do ENEM  
- Análise completa + nota final  
- Banco de redações corrigidas para consulta  

### ✔️ Painel de Desempenho
- Gráficos dinâmicos (Chart.js)  
- Percentual de domínio por matéria  
- Histórico de evolução  
- Insights personalizados  

### ✔️ Chatbot Educacional
- Respostas inteligentes sobre estudos, conteúdos e explicações  
- Registro de histórico por usuário  
- Suporte contínuo para dúvidas  

### ✔️ Sistema de Usuários
- Cadastro  
- Login  
- Sessões salvas  
- Histórico completo (redações + simulados + chat)  

---

## 🏗️ Arquitetura do Projeto

Organizado no modelo MVC adaptado:

A3/

│

├── controller/ # Lógica do frontend (JS)


├── view/ # Páginas HTML


├── styles/ # CSS


├── img/ # Imagens e ícones


│

├── model/ # Backend (Flask + PostgreSQL + OpenAI)

│ ├── prompts/

│ └── app.py

│

├── requirements.txt

└── README.md



---

## 🛠️ Tecnologias Utilizadas

### **Frontend**
- HTML5  
- CSS3  
- JavaScript  
- Chart.js  
- DOMPurify  
- Marked  

### **Backend**
- Python  
- Flask  
- Flask-CORS  
- SQLAlchemy  
- OpenAI API  
- Psycopg2  

### **Banco de Dados**
- PostgreSQL  
- Procedures, triggers e views para processamento de simulados  

---

## ⚙️ Como Rodar o Projeto

### 1️⃣ Criar ambiente virtual
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
2️⃣ Instalar dependências
bash
Copiar código
pip install -r requirements.txt
3️⃣ Configurar variáveis de ambiente .env
ini
Copiar código
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seu_banco
DB_USER=postgres
DB_PASS=senha
OPENAI_API_KEY=xxxx
4️⃣ Rodar o backend
bash
Copiar código
python app.py
5️⃣ Abrir o frontend
Basta abrir os arquivos HTML da pasta /view usando o Live Server no VS Code.

📌 Endpoints Principais (Backend)
GET /health – Teste de saúde

POST /check_login

POST /add_user

POST /simulado – Corrige simulado

POST /redacao – Avalia redação

GET /historico – Retorna dados do usuário

POST /chat – Chat com IA

👥 Equipe do Projeto

Maria Clara Palhares Diniz Braz - 123222699
Breno Yohan Dantas de Oliveira - 123112963
Cauan Silva Oliveira - 12410020
Gabriel Henrique Martins - 1232020562
Kaíky Pimentel Ferreira - 124113526
Laysa Eduarda Moraes Serrão - 124114574
Yris Gabrielle Sother Oliveira Pereira dos Reis - 12412380

📚 Objetivo do Projeto
Criar uma plataforma que realmente ajudasse estudantes a se prepararem para o ENEM de forma inteligente, prática e personalizada — combinando tecnologia, usabilidade e inteligência artificial.

📄 Licença
Projeto aberto para fins educacionais.




