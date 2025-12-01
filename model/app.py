import os
import logging
import json
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from urllib.parse import quote_plus
from openai import OpenAI
from sqlalchemy import text  # IMPORTANTE: Para rodar SQL puro (Procedures/Views)

# --- 1. CONFIGURAÇÕES INICIAIS ---
load_dotenv()
logging.basicConfig(level=logging.INFO)

api_key = os.getenv("OPENAI_API_KEY")

if api_key:
    # Mostra os 5 primeiros letras da chave para você ver se carregou
    print(f"✅ SUCESSO: Chave de API carregada iniciando com: {api_key[:5]}...")
    client = OpenAI(api_key=api_key)
else:
    print("❌ ERRO CRÍTICO: O Python NÃO achou a chave no .env!")
    client = None
# ----------------------

# Configuração da String de Conexão (Mantendo a lógica do seu time)
def get_database_uri():
    database_url = os.getenv('DATABASE_URL')
    if database_url: return database_url

    host = os.getenv('DB_HOST', 'localhost')
    port = os.getenv('DB_PORT', '5432')
    raw_name = os.getenv('DB_NAME', 'prepar_ai')
    raw_user = os.getenv('DB_USER', 'postgres')
    raw_password = os.getenv('DB_PASS') or os.getenv('DB_PASSWORD') or ''

    # Tratamento de caracteres especiais na senha
    try:
        user_enc = quote_plus(str(raw_user))
        name_enc = quote_plus(str(raw_name))
        password_enc = quote_plus(str(raw_password))
    except Exception:
        user_enc, name_enc, password_enc = raw_user, raw_name, raw_password

    # Força UTF8 para evitar erro com acentos
    options = '?options=-c%20client_encoding=UTF8'
    return f'postgresql+psycopg2://{user_enc}:{password_enc}@{host}:{port}/{name_enc}{options}'

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) # Libera geral

app.config['SQLALCHEMY_DATABASE_URI'] = get_database_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- 2. MODELO DE USUÁRIO (ORM) ---
class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False)
    senha_hash = db.Column(db.String(200), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'nome': self.nome, 'email': self.email}

# ==============================================================================
# 3. ROTAS DE AUTENTICAÇÃO (Mantido do seu time)
# ==============================================================================

@app.route('/')
def index():
    return jsonify({'message': 'API PreparAI Online 🚀'}), 200

@app.route('/create_tables', methods=['POST'])
def create_tables():
    try:
        db.create_all()
        return jsonify({'status': 'tabelas verificadas'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add_user', methods=['POST'])
def add_user():
    data = request.get_json() or {}
    try:
        if not data.get('email') or not data.get('senha'):
             return jsonify({'error': 'Dados incompletos'}), 400

        if Usuario.query.filter_by(email=data.get('email')).first():
            return jsonify({'error': 'Email já cadastrado'}), 400
        
        novo_user = Usuario(
            nome=data.get('nome'),
            email=data.get('email'),
            senha_hash=generate_password_hash(data.get('senha'))
        )
        db.session.add(novo_user)
        db.session.commit()
        return jsonify({'message': 'Sucesso', 'user': novo_user.to_dict(), 'success': True}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}
        user = Usuario.query.filter_by(email=data.get('email')).first()
        
        if not user or not check_password_hash(user.senha_hash, data.get('senha')):
            return jsonify({'error': 'Credenciais inválidas'}), 401

        return jsonify({'status': 'ok', 'user': user.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==============================================================================
# 4. ROTAS DO DASHBOARD (INTEGRAÇÃO COM AS VIEWS)
# ==============================================================================

@app.route('/dashboard/resumo/<int:usuario_id>', methods=['GET'])
def get_dashboard_resumo(usuario_id):
    try:
        # 1. Conta Simulados Finalizados (aqueles que têm nota)
        sql_simulados = text("SELECT COUNT(*) FROM exames WHERE usuario_id = :uid AND nota_total IS NOT NULL")
        total_simulados = db.session.execute(sql_simulados, {'uid': usuario_id}).scalar() or 0

        # 2. Conta Redações
        sql_redacoes = text("SELECT COUNT(*) FROM redacoes WHERE usuario_id = :uid")
        total_redacoes = db.session.execute(sql_redacoes, {'uid': usuario_id}).scalar() or 0

        # 3. Calcula Média Geral dos Simulados
        sql_media = text("SELECT AVG(nota_total) FROM exames WHERE usuario_id = :uid AND nota_total IS NOT NULL")
        media_geral = db.session.execute(sql_media, {'uid': usuario_id}).scalar() or 0

        # Mensagem motivacional simples
        msg = "Vamos praticar!"
        if total_simulados > 0:
            msg = f"Você já fez {total_simulados} simulados. Continue assim!"

        return jsonify({
            "simulados": total_simulados,
            "redacoes": total_redacoes,
            "media_geral": round(float(media_geral), 1),
            "mensagem": msg
        }), 200

    except Exception as e:
        print(f"Erro no Dashboard: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/dashboard/materias/<int:usuario_id>', methods=['GET'])
def get_dashboard_materias(usuario_id):
    try:
        # Busca dados detalhados por matéria
        results = db.session.execute(text("SELECT * FROM dashboard_feedback_materias WHERE usuario_id = :uid"), {'uid': usuario_id}).fetchall()
        
        lista = []
        for row in results:
            lista.append({
                "materia": row.materia_nome,
                "percentual": float(row.percentual_acertos),
                "mensagem": row.mensagem,
                "cor": row.cor_hex
            })
        return jsonify(lista), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==============================================================================
# 5. ROTAS DE SIMULADO (USANDO A PROCEDURE MÁGICA)
# ==============================================================================

@app.route('/simulado/iniciar', methods=['POST'])
def iniciar_simulado():
    data = request.get_json()
    usuario_id = data.get('usuario_id')
    try:
        # Cria um exame vazio
        sql = text("INSERT INTO exames (usuario_id, tipo) VALUES (:uid, 'SIMULADO') RETURNING id")
        result = db.session.execute(sql, {'uid': usuario_id})
        db.session.commit()
        return jsonify({'exame_id': result.fetchone()[0]}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/simulado/questoes', methods=['GET'])
def buscar_questoes():
    try:
        # Busca 10 questões aleatórias (pode aumentar o LIMIT)
        sql = text("""
            SELECT q.id, q.enunciado, q.alternativa_a, q.alternativa_b, 
                   q.alternativa_c, q.alternativa_d, q.alternativa_e, m.nome as materia
            FROM questoes q
            JOIN materias m ON m.id = q.materia_id
            ORDER BY RANDOM() LIMIT 25
        """)
        questoes = db.session.execute(sql).fetchall()
        
        response = []
        for q in questoes:
            response.append({
                "id": q.id,
                "texto": q.enunciado,
                "materia": q.materia,
                "opcoes": [
                    {"letra": "A", "texto": q.alternativa_a},
                    {"letra": "B", "texto": q.alternativa_b},
                    {"letra": "C", "texto": q.alternativa_c},
                    {"letra": "D", "texto": q.alternativa_d},
                    {"letra": "E", "texto": q.alternativa_e}
                ]
            })
        return jsonify(response), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/simulado/responder', methods=['POST'])
def responder_questao():
    data = request.get_json() # {exame_id, questao_id, resposta}
    try:
        # Verifica gabarito
        sql_gabarito = text("SELECT resposta_correta FROM questoes WHERE id = :qid")
        gabarito = db.session.execute(sql_gabarito, {'qid': data['questao_id']}).fetchone()[0]
        acertou = str(data['resposta']).upper() == str(gabarito).upper()

        # Salva resposta
        sql = text("""
            INSERT INTO exames_questoes (exame_id, questao_id, resposta_usuario, correta)
            VALUES (:eid, :qid, :resp, :correta)
            ON CONFLICT (exame_id, questao_id) DO UPDATE SET resposta_usuario = :resp, correta = :correta
        """)
        db.session.execute(sql, {'eid': data['exame_id'], 'qid': data['questao_id'], 'resp': data['resposta'], 'correta': acertou})
        db.session.commit()
        return jsonify({'status': 'salvo'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/simulado/finalizar', methods=['POST'])
def finalizar_simulado():
    data = request.get_json()
    exame_id = data.get('exame_id')
    try:
        # AQUI ESTÁ O TRUNFO: Chama a procedure do banco!
        sql_proc = text("SELECT fn_finalizar_exame(:eid)")
        db.session.execute(sql_proc, {'eid': exame_id})
        db.session.commit()
        
        # Retorna o resultado calculado
        sql_res = text("SELECT nota_total, acertos, erros FROM exames WHERE id = :eid")
        resultado = db.session.execute(sql_res, {'eid': exame_id}).fetchone()
        return jsonify({'nota': float(resultado.nota_total) if resultado.nota_total else 0, 'acertos': resultado.acertos, 'erros': resultado.erros}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
    # ==============================================================================
# ROTA: DETALHES DO SIMULADO (REVISÃO)
# ==============================================================================
@app.route('/simulado/detalhes/<int:exame_id>', methods=['GET'])
def get_detalhes_exame(exame_id):
    try:
        # Busca as questões respondidas nesse exame
        sql = text("""
            SELECT 
                q.enunciado, 
                q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e,
                q.resposta_correta,
                eq.resposta_usuario,
                m.nome as materia
            FROM exames_questoes eq
            JOIN questoes q ON eq.questao_id = q.id
            JOIN materias m ON q.materia_id = m.id
            WHERE eq.exame_id = :eid
        """)
        
        result = db.session.execute(sql, {'eid': exame_id}).fetchall()
        
        detalhes = []
        for row in result:
            detalhes.append({
                'enunciado': row.enunciado,
                'materia': row.materia,
                'marcada': row.resposta_usuario, # O que ele marcou (ex: 'A')
                'gabarito': row.resposta_correta, # A certa (ex: 'C')
                'opcoes': {
                    'A': row.alternativa_a,
                    'B': row.alternativa_b,
                    'C': row.alternativa_c,
                    'D': row.alternativa_d,
                    'E': row.alternativa_e
                }
            })
            
        return jsonify(detalhes), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==============================================================================
# 6. ROTAS DE REDAÇÃO
# ==============================================================================

@app.route('/redacao/tema', methods=['GET'])
def get_tema_redacao():
    # Se não tiver API Key, usa backup
    temas_backup = [
        "Os desafios do combate à fome no Brasil",
        "A importância da preservação da Amazônia",
        "Impactos da inteligência artificial no mercado de trabalho",
        "Caminhos para combater a intolerância religiosa no Brasil",
        "A democratização do acesso ao cinema no Brasil",
        "Desafios para a valorização de comunidades e povos tradicionais no Brasil",
        "Estigmas associados às doenças mentais na sociedade brasileira"
    ]

    # Função auxiliar para retornar um backup
    def retornar_backup(motivo):
        import random
        escolhido = random.choice(temas_backup)
        texto_padrao = "Este é um tema de backup gerado automaticamente pois a IA está indisponível no momento."
        print(f"⚠️ Usando backup. Motivo: {motivo}")
        return jsonify({'id': 1, 'tema': escolhido, 'texto_apoio': texto_padrao}), 200
    
    if not client:
        return retornar_backup("Sem API Key configurada")
    
    try:
        # 1. Configura o Prompt
        prompt_sistema = """
        VOCÊ É UM ASSISTENTE ESTRITAMENTE FOCADO NO ENEM.
        VOCÊ NÃO É UMA WIKIPÉDIA. VOCÊ NÃO É O GOOGLE.

        Sua única função é ensinar conteúdos curriculares do Ensino Médio.

        PROTOCOLO DE RESPOSTA (Siga nesta ordem):

        
        FILTRO DE IDENTIDADE:
        Se for "Oi", "Tudo bem", "Quem é você": Responda amigavelmente que você é o PreparAI, focado no ENEM.

                
        FILTRO DE CONTEÚDO (A LISTA BRANCA):
        O assunto é Matemática, Física, Química, Biologia, História, Geografia, Filosofia, Sociologia, Português, Literatura ou Redação?
        É uma figura HISTÓRICA relevante (ex: Napoleão, Getúlio Vargas, Platão)?-> SIM: Pode responder e ensinar.

                
        FILTRO DE BLOQUEIO (A LISTA NEGRA):
        O assunto é: Futebol, Celebridades Vivas, Youtubers, Games, Receitas, Fofoca, Política atual (fora de contexto sociológico) ou Entretenimento?
        A pergunta é "Quem é [Nome de Famoso/Jogador]"?-> AÇÃO IMEDIATA: RECUSE A RESPOSTA.-> DIGA: "Meu foco é exclusivo para matérias do ENEM. Não tenho permissão para falar sobre esportes, entretenimento ou celebridades. Vamos estudar algo?"

                EXEMPLO PRÁTICO:
                
        User: "Quem é Neymar?" -> Bot: "Não falo sobre celebridades. Vamos estudar?" (BLOQUEAR)
        User: "Quem foi Dom Pedro II?" -> Bot: "Foi o segundo imperador..." (RESPONDER)
        User: "Fale sobre o Flamengo" -> Bot: "Não falo sobre futebol..." (BLOQUEAR)
        NÃO TENTE CONTEXTUALIZAR O NEYMAR. APENAS BLOQUEIE."""
        
        # 2. Chama a OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini", 
            messages=[{"role": "user", "content": prompt_sistema}],
            temperature=0.8
        )
        
        # 3. Processa o Retorno
        content = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
        dados_ia = json.loads(content)

        # 4. Salva no Banco e pega o ID
        # Adicionei 'RETURNING id' no final do SQL
        sql_save = text("INSERT INTO temas_redacao (tema, texto_de_apoio, gerado_por_ia) VALUES (:tema, :apoio, TRUE) RETURNING id")
        
        result = db.session.execute(sql_save, {'tema': dados_ia['tema'], 'apoio': dados_ia['texto_apoio']})
        novo_id = result.fetchone()[0] 
        db.session.commit()

        # 5. Retorna Sucesso com o ID correto
        return jsonify({
            'id': novo_id,
            'tema': dados_ia['tema'], 
            'texto_apoio': dados_ia['texto_apoio']
        }), 200

    except Exception as e:
        # SE DER QUALQUER ERRO (IA ou Banco), usa o backup
        return retornar_backup(f"Erro no processo: {str(e)}")
    
@app.route('/redacao/gerar-tema', methods=['POST'])
def gerar_tema_ia():
    # Mesma lógica do GET, mantido para compatibilidade se seu front usar POST
    return get_tema_redacao()

# ==============================================================================
# 2. ROTA: ENVIAR REDAÇÃO (Texto ou Imagem)
# ==============================================================================
@app.route('/redacao/enviar', methods=['POST'])
def enviar_redacao():
    if not client: 
        return jsonify({'error': 'Sem API KEY configurada'}), 500

    data = request.get_json()
    usuario_id = data.get('usuario_id')
    tema_id = data.get('tema_id')
    texto_usuario = data.get('texto') 
    imagem_base64 = data.get('imagem')

    print(f"DEBUG: Recebido usuario_id={usuario_id}, tema_id={tema_id}") # Log para ajudar

    if not usuario_id:
        return jsonify({'error': 'Usuário não identificado. Faça login novamente.'}), 400
    
    # Se tema_id for None, definimos um padrão (ex: 1) ou deixamos None se o banco aceitar NULL
    try:
        # --- PASSO 1: Buscar o Nome do Tema no Banco ---
        titulo_tema = "Tema Livre / Não informado"
        if tema_id:
            # Tenta converter para int, caso venha como string do form
            try:
                tid = int(tema_id)
                res_tema = db.session.execute(text("SELECT tema FROM temas_redacao WHERE id = :tid"), {'tid': tid}).fetchone()
                if res_tema: titulo_tema = res_tema.tema
            except: pass
        else:
            tema_id = 1
        prompt_sistema = """
        Atue como um corretor oficial do ENEM. Seja rigoroso e analise as 5 competências.

        O TEMA DA REDAÇÃO É: "{titulo_tema}"

        Sua análise deve seguir ESTRITAMENTE esta ordem lógica (não pule etapas):

       ETAPA 1: CLASSIFICAÇÃO
        - "FUGA": Texto fala de assunto totalmente diferente.
        - "TANGENTE": Texto fala do assunto geral, mas ignora o recorte específico.
        - "OK": Texto aborda o tema corretamente.

        ETAPA 2: NOTAS
        - Se "FUGA": Todas as notas 0.
        - Se "TANGENTE": C2, C3 e C5 máximo 40.
        - Se "OK": Avalie 0-200.
        
        SE RECEBER UMA IMAGEM: 
        1. Transcreva o texto manuscrito fielmente para o campo "texto_transcrito".
        2. Corrija baseando-se na transcrição.
        
        SE RECEBER APENAS TEXTO:
        1. Copie o texto recebido para o campo "texto_transcrito".
        2. Corrija o texto.

        SAÍDA OBRIGATÓRIA (JSON cru, sem markdown):
        {{
            "situacao_tema": "FUGA" ou "TANGENTE" ou "OK",
            "texto_transcrito": "Texto completo...",
            "notas": {{ "c1": 0, "c2": 0, "c3": 0, "c4": 0, "c5": 0 }},
            "comentario_geral": "Se houver fuga ao tema, escreva APENAS: 'Redação zerada por fuga ao tema'. Caso contrário, faça um resumo de 3 linhas.",
            "detalhes_competencias": {{
                "c1": "...", "c2": "...", "c3": "...", "c4": "...", "c5": "..."
            }}
        }}
        """

        # --- PASSO 3: Montar as Mensagens para a IA ---
        mensagens_api = [{"role": "system", "content": prompt_sistema}]

        if imagem_base64:
            # Cenário A: Imagem
            mensagens_api.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": f"O tema da redação é: '{titulo_tema}'. Por favor, transcreva e corrija esta imagem."},
                    {"type": "image_url", "image_url": {"url": imagem_base64}}
                ]
            })
            model_to_use = "gpt-4o-mini"  # Modelo com capacidade de visão
        else:
            if not texto_usuario:
                 return jsonify({'error': 'Nenhum texto ou imagem fornecido.'}), 400
            mensagens_api.append({"role": "user", "content": f"Tema: '{titulo_tema}'.\nRedação:\n{texto_usuario}"})
            model_to_use = "gpt-4o-mini"

        # --- PASSO 4: Chamada à OpenAI ---
        # Usamos gpt-4o pois é o melhor para ler imagens (vision)
        response = client.chat.completions.create(model=model_to_use, messages=mensagens_api, temperature=0.4, max_tokens=4096)

        # --- PASSO 5: Processar o Retorno ---
        conteudo_ia = response.choices[0].message.content
        resultado_ia = json.loads(conteudo_ia.replace("```json", "").replace("```", "").strip())
        situacao = resultado_ia.get('situacao_tema', 'OK').upper()
        texto_final = resultado_ia.get('texto_transcrito')
        if not texto_final:
            texto_final = texto_usuario
        if not texto_final:
            texto_final = " [ERRO: Texto não transcrito pela IA] "
        uid_int = int(usuario_id)
        tid_int = int(tema_id)
        # --- PASSO 6: Salvar tudo no Banco (Transação) ---
        
        # A. Salva a Redação
        sql_insert = text("INSERT INTO redacoes (usuario_id, tema_id, texto, enviado_em) VALUES (:uid, :tid, :txt, NOW()) RETURNING id")
        rid = db.session.execute(sql_insert, {'uid': uid_int, 'tid': tid_int, 'txt': texto_final}).fetchone()[0]

        # 2. Salva Notas
        notas = resultado_ia.get('notas', {})
        if situacao == 'FUGA':
            print("🚨 FUGA DETECTADA: Zerando tudo.")
            notas = { 'c1': 0, 'c2': 0, 'c3': 0, 'c4': 0, 'c5': 0 }
            resultado_ia['comentario_geral'] = f"REDAÇÃO ZERADA. Fuga ao tema '{titulo_tema}'."
        
        elif situacao == 'TANGENTE':
            print("⚠️ TANGENCIAMENTO: Aplicando teto de 40 pontos.")
            # Força as notas baixas antes de salvar no banco
            notas['c2'] = min(notas.get('c2', 0), 40)
            notas['c3'] = min(notas.get('c3', 0), 40)
            notas['c5'] = min(notas.get('c5', 0), 40)
            resultado_ia['comentario_geral'] = f"NOTA REBAIXADA. Você tangenciou o tema '{titulo_tema}'."

        # Calcula soma para o insert final
        soma_total = sum(int(notas.get(f'c{i}', 0)) for i in range(1, 6))

        # --- 4. SALVAMENTO NO BANCO ---
        
        # A. Cria Redação
        rid = db.session.execute(text("""
            INSERT INTO redacoes (usuario_id, tema_id, texto, enviado_em) 
            VALUES (:uid, :tid, :txt, NOW()) RETURNING id
        """), {'uid': usuario_id, 'tid': tema_id, 'txt': texto_final}).fetchone()[0]

        # B. Salva Competências (A TRIGGER DISPARA AQUI!)
        # Como estamos salvando as notas JÁ PENALIZADAS (ex: 40), a trigger vai somar 40.
        for i in range(1, 6):
            db.session.execute(text("INSERT INTO redacoes_competencias (redacao_id, competencia, nota) VALUES (:rid, :comp, :n)"), 
                               {'rid': rid, 'comp': i, 'n': int(notas.get(f'c{i}', 0))})

        # C. Salva Avaliação Final
        # Enviamos 'soma_total' para satisfazer o NOT NULL, mas o valor é igual ao da trigger.
        json_str = json.dumps(resultado_ia)
        
        db.session.execute(text("""
            INSERT INTO redacoes_avaliacao_final (redacao_id, nota_total, observacoes, detalhamento_ia) 
            VALUES (:rid, :nt, :obs, :det)
            ON CONFLICT (redacao_id) 
            DO UPDATE SET observacoes = :obs, detalhamento_ia = :det, nota_total = :nt
        """), {'rid': rid, 'nt': soma_total, 'obs': resultado_ia.get('comentario_geral'), 'det': json_str})

        db.session.commit()

        return jsonify({
            'message': 'Sucesso',
            'id': rid,
            'nota_total': soma_total,
            'notas_por_competencia': notas,
            'comentario_geral': resultado_ia.get('comentario_geral'),
            'detalhes_erros': resultado_ia.get('detalhes_competencias', {})
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"ERRO: {e}")
        return jsonify({'error': str(e)}), 500
    
# ==============================================================================
# ROTA: HISTÓRICO UNIFICADO (CORREÇÃO FINAL)
# ==============================================================================
# ==============================================================================
# ROTA: HISTÓRICO (COM CORREÇÃO DE DATAS/TIMEZONE)
# ==============================================================================
@app.route('/historico/<int:usuario_id>', methods=['GET'])
def get_historico(usuario_id):
    historico_geral = []
    
    # Função para remover fuso horário e evitar o erro de comparação
    def limpar_fuso(dt):
        if dt and hasattr(dt, 'replace'):
            return dt.replace(tzinfo=None)
        return dt

    try:
        # --- 1. BUSCA SIMULADOS ---
        try:
            sql_simulados = text("""
                SELECT id, criado_em, tipo, nota_total, acertos, erros 
                FROM exames 
                WHERE usuario_id = :uid AND nota_total IS NOT NULL 
            """)
            res_sim = db.session.execute(sql_simulados, {'uid': usuario_id}).fetchall()

            for row in res_sim:
                # Limpa o fuso horário antes de salvar
                data_banco = limpar_fuso(row.criado_em)
                
                historico_geral.append({
                    'categoria': 'SIMULADO',
                    'id': row.id,
                    'data_raw': data_banco,
                    'data': data_banco.strftime('%d/%m/%Y às %H:%M') if data_banco else 'Data n/a',
                    'titulo': 'Simulado ENEM',
                    'nota': float(row.nota_total) if row.nota_total else 0,
                    'info_extra': {'acertos': row.acertos, 'erros': row.erros}
                })
        except Exception as e_sim:
            print(f"⚠️ Erro ao buscar Simulados: {e_sim}")

        # --- 2. BUSCA REDAÇÕES ---
        try:
            sql_redacoes = text("""
                SELECT 
                    r.id, 
                    raf.nota_total, 
                    r.enviado_em, 
                    t.tema 
                FROM redacoes r
                JOIN redacoes_avaliacao_final raf ON r.id = raf.redacao_id
                LEFT JOIN temas_redacao t ON r.tema_id = t.id
                WHERE r.usuario_id = :uid
            """)
            
            res_red = db.session.execute(sql_redacoes, {'uid': usuario_id}).fetchall()

            for row in res_red:
                tema_nome = row.tema if row.tema else "Tema Livre"
                
                # Limpa o fuso horário aqui também
                data_obj = limpar_fuso(row.enviado_em)
                
                data_formatada = data_obj.strftime('%d/%m/%Y às %H:%M') if data_obj else "Data desc."

                historico_geral.append({
                    'categoria': 'REDACAO',
                    'id': row.id,
                    'data_raw': data_obj, 
                    'data': data_formatada,
                    'titulo': f'Redação: {tema_nome}',
                    'nota': float(row.nota_total) if row.nota_total else 0,
                    'info_extra': {}
                })
        except Exception as e_red:
            print(f"⚠️ Erro ao buscar Redações: {e_red}")

        # 3. ORDENAÇÃO (Agora vai funcionar pois todas as datas estão limpas)
        itens_validos = [x for x in historico_geral if x.get('data_raw')]
        
        itens_validos.sort(key=lambda x: x['data_raw'], reverse=True)

        for item in itens_validos:
            del item['data_raw']
            
        return jsonify(itens_validos), 200

    except Exception as e:
        print(f"🔥 ERRO FATAL GERAL: {e}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/redacao/detalhes/<int:redacao_id>', methods=['GET'])
def get_detalhes_redacao(redacao_id):
    try:
        # 1. Busca dados gerais (Texto, Tema, Nota Final, Comentário)
        sql_geral = text("""
            SELECT 
                r.texto, 
                t.tema, 
                raf.nota_total, 
                raf.observacoes as feedback_geral,
                raf.detalhamento_ia,
                r.enviado_em
            FROM redacoes r
            JOIN redacoes_avaliacao_final raf ON r.id = raf.redacao_id
            LEFT JOIN temas_redacao t ON r.tema_id = t.id
            WHERE r.id = :rid
        """)
        geral = db.session.execute(sql_geral, {'rid': redacao_id}).fetchone()

        if not geral:
            return jsonify({'error': 'Redação não encontrada'}), 404

        # 2. Busca notas por competência
        sql_comp = text("SELECT competencia, nota FROM redacoes_competencias WHERE redacao_id = :rid ORDER BY competencia")
        comps = db.session.execute(sql_comp, {'rid': redacao_id}).fetchall()
        notas_comp = {f"c{c.competencia}": c.nota for c in comps}

        detalhes_texto = {}
        if geral.detalhamento_ia:
            import json
            dados_ia = geral.detalhamento_ia if isinstance(geral.detalhamento_ia, dict) else json.loads(geral.detalhamento_ia)
            detalhes_texto = dados_ia.get('detalhes_competencias', {})

        return jsonify({
            'tema': geral.tema if geral.tema else "Tema Livre",
            'texto': geral.texto,
            'nota_total': float(geral.nota_total),
            'feedback_geral': geral.feedback_geral,
            'data': geral.enviado_em.strftime('%d/%m/%Y às %H:%M') if geral.enviado_em else '-',
            'competencias': notas_comp,
            'competencias_texto': detalhes_texto
        }), 200

    except Exception as e:
        print(f"Erro detalhes redação: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    if not client: return jsonify({'error': 'Sem API KEY'}), 500
    
    data = request.get_json()
    usuario_id = data.get('usuario_id') # IMPORTANTE: Front tem que mandar isso agora 
    msg_usuario = data.get('message')
    historico = data.get('history', [])
    
    
    try:
        sessao_id = None
        
        # 1. Se tem usuário, salva no banco
        if usuario_id:
            # Tenta achar sessão aberta
            res = db.session.execute(text("SELECT id FROM chat_sessoes WHERE usuario_id=:uid AND finalizado_em IS NULL LIMIT 1"), {'uid': usuario_id}).fetchone()
            if res:
                sessao_id = res[0]
            else:
                # Cria nova
                new_s = db.session.execute(text("INSERT INTO chat_sessoes (usuario_id) VALUES (:uid) RETURNING id"), {'uid': usuario_id})
                sessao_id = new_s.fetchone()[0]
                db.session.commit()

            # Salva msg do user
            db.session.execute(text("INSERT INTO chat_mensagens (sessao_id, usuario_id, remetente, mensagem) VALUES (:sid, :uid, 'user', :msg)"), 
                               {'sid': sessao_id, 'uid': usuario_id, 'msg': msg_usuario})
            db.session.commit()

        # 2. Chama OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": "Você é o PreparAI, um assistente educativo."}] + historico + [{"role": "user", "content": msg_usuario}]
        )
        ai_reply = response.choices[0].message.content


        # 3. Pós-processamento: bloqueia respostas sobre tópicos fora do ENEM (ex: celebridades)
        try:
            import re
            forbidden = [r"\bculinaria\b", r"\besporte\b", r"\bpalavroes\b" r"\bcelebridade\b", r"\byoutuber\b", r"\bformula1\b", r"\bchurrasco\b", r"\btecnologia\b", r"\bbem-estar\b", r"\bsaude\b", r"\bjogos\b",r"\bvideo-games\b", r"\bworld-of-warcraft\b", r"\bWoW\b", r"\bftc\b", r"\bfifa\b", r"\bnfl\b", r"\bnba\b", r"\bcelebridades\b", r"\bfilmes\b", r"\bseries\b", r"\bpolitica atual\b"]
            ai_lower = ai_reply.lower() if isinstance(ai_reply, str) else ''
            blocked = any(re.search(pat, ai_lower, flags=re.IGNORECASE) for pat in forbidden)
        except Exception:
            blocked = False

        if blocked:
            # Mensagem padrão de recusa (conforme regras ENEM)
            ai_reply = "Meu foco é exclusivo para matérias do ENEM. Não tenho permissão para falar sobre esportes, entretenimento ou celebridades. Vamos estudar algo?"

        # 4. Salva resposta da IA
        if sessao_id:
            db.session.execute(text("INSERT INTO chat_mensagens (sessao_id, usuario_id, remetente, mensagem) VALUES (:sid, :uid, 'bot', :msg)"), 
                               {'sid': sessao_id, 'uid': usuario_id, 'msg': ai_reply})
            db.session.commit()

        return jsonify({'reply': ai_reply})

    except Exception as e:
        print("\n\n🔥 ERRO FATAL NA OPENAI (LEIA ABAIXO) 🔥")
        print(f"TIPO DO ERRO: {type(e)}")
        print(f"MENSAGEM: {e}")
        print("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n\n")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('APP_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

        