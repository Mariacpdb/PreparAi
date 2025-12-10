import os
import logging
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from urllib.parse import quote_plus
from openai import OpenAI
from sqlalchemy import text 

load_dotenv()
logging.basicConfig(level=logging.INFO)

api_key = os.getenv("OPENAI_API_KEY")

if api_key:

    print(f"✅ SUCESSO: Chave de API carregada iniciando com: {api_key[:5]}...")
    client = OpenAI(api_key=api_key)
else:
    print("❌ ERRO CRÍTICO: O Python NÃO achou a chave no .env!")
    client = None



def get_database_uri():
    database_url = os.getenv('DATABASE_URL')
    if database_url: return database_url

    host = os.getenv('DB_HOST', 'localhost')
    port = os.getenv('DB_PORT', '5432')
    raw_name = os.getenv('DB_NAME', 'prepar_ai')
    raw_user = os.getenv('DB_USER', 'postgres')
    raw_password = os.getenv('DB_PASS') or os.getenv('DB_PASSWORD') or ''


    try:
        user_enc = quote_plus(str(raw_user))
        name_enc = quote_plus(str(raw_name))
        password_enc = quote_plus(str(raw_password))
    except Exception:
        user_enc, name_enc, password_enc = raw_user, raw_name, raw_password


    options = '?options=-c%20client_encoding=UTF8'
    return f'postgresql+psycopg2://{user_enc}:{password_enc}@{host}:{port}/{name_enc}{options}'

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) 

app.config['SQLALCHEMY_DATABASE_URI'] = get_database_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False)
    senha_hash = db.Column(db.String(200), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'nome': self.nome, 'email': self.email}


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


@app.route('/dashboard/resumo/<int:usuario_id>', methods=['GET'])
def get_dashboard_resumo(usuario_id):
    try:
    
        sql_simulados = text("SELECT COUNT(*) FROM exames WHERE usuario_id = :uid AND nota_total IS NOT NULL")
        total_simulados = db.session.execute(sql_simulados, {'uid': usuario_id}).scalar() or 0

    
        sql_redacoes = text("SELECT COUNT(*) FROM redacoes WHERE usuario_id = :uid")
        total_redacoes = db.session.execute(sql_redacoes, {'uid': usuario_id}).scalar() or 0

    
        sql_media = text("SELECT AVG(nota_total) FROM exames WHERE usuario_id = :uid AND nota_total IS NOT NULL")
        media_geral = db.session.execute(sql_media, {'uid': usuario_id}).scalar() or 0

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
    
@app.route('/api/graficos/evolucao/<int:usuario_id>', methods=['GET'])
def get_dados_grafico(usuario_id):
    try:
        sql = text("""
            SELECT criado_em, nota_total 
            FROM exames 
            WHERE usuario_id = :uid AND nota_total IS NOT NULL
            ORDER BY criado_em ASC
        """)
        
        resultados = db.session.execute(sql, {'uid': usuario_id}).fetchall()
        
        labels = []
        notas = []  
        
        for row in resultados:
            if row.criado_em:
                dia = row.criado_em.strftime('%d/%m')
                labels.append(dia)
                notas.append(float(row.nota_total))
            
        return jsonify({'labels': labels, 'notas': notas})

    except Exception as e:
        print(f"Erro gráfico evolução: {e}")
        return jsonify({'error': str(e)}), 500    


@app.route('/simulado/iniciar', methods=['POST'])
def iniciar_simulado():
    data = request.get_json()
    usuario_id = data.get('usuario_id')
    try:
    
        sql = text("INSERT INTO exames (usuario_id, tipo) VALUES (:uid, 'SIMULADO') RETURNING id")
        result = db.session.execute(sql, {'uid': usuario_id})
        db.session.commit()
        return jsonify({'exame_id': result.fetchone()[0]}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/simulado/questoes', methods=['GET'])
def buscar_questoes():
    try:
    
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
    data = request.get_json()
    try:
        
        sql_gabarito = text("SELECT resposta_correta FROM questoes WHERE id = :qid")
        gabarito = db.session.execute(sql_gabarito, {'qid': data['questao_id']}).fetchone()[0]
        acertou = str(data['resposta']).upper() == str(gabarito).upper()

        
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
    
        sql_proc = text("SELECT fn_finalizar_exame(:eid)")
        db.session.execute(sql_proc, {'eid': exame_id})
        db.session.commit()
        
    
        sql_res = text("SELECT nota_total, acertos, erros FROM exames WHERE id = :eid")
        resultado = db.session.execute(sql_res, {'eid': exame_id}).fetchone()
        return jsonify({'nota': float(resultado.nota_total) if resultado.nota_total else 0, 'acertos': resultado.acertos, 'erros': resultado.erros}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    

@app.route('/simulado/detalhes/<int:exame_id>', methods=['GET'])
def get_detalhes_exame(exame_id):
    try:

        sql_exame = text("SELECT criado_em FROM exames WHERE id = :eid")
        exame = db.session.execute(sql_exame, {'eid': exame_id}).fetchone()
        
        if not exame:
            return jsonify({'error': 'Exame não encontrado'}), 404
            
        data_formatada = exame.criado_em.strftime('%d/%m/%Y às %H:%M') if exame.criado_em else "-"
    
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
                'marcada': row.resposta_usuario, 
                'gabarito': row.resposta_correta, 
                'opcoes': {
                    'A': row.alternativa_a,
                    'B': row.alternativa_b,
                    'C': row.alternativa_c,
                    'D': row.alternativa_d,
                    'E': row.alternativa_e
                }
            })
            
        return jsonify({
            'data': data_formatada,
            'questoes': detalhes}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/redacao/tema', methods=['GET'])
def get_tema_redacao():
    print("--- INICIANDO GERAÇÃO DE TEMA ---")
   
    def usar_backup(motivo):
        print(f"⚠️ FALHA NA IA: {motivo}. Usando Backup.")
        temas = [
        "Os desafios do combate à fome no Brasil",
        "A importância da preservação da Amazônia",
        "Impactos da inteligência artificial no mercado de trabalho",
        "Caminhos para combater a intolerância religiosa no Brasil",
        "A democratização do acesso ao cinema no Brasil",
        "Desafios para a valorização de comunidades e povos tradicionais no Brasil",
        "Estigmas associados às doenças mentais na sociedade brasileira"
    ]
        import random
        return jsonify({
            'id': 1, 
            'tema': random.choice(temas), 
            'texto_apoio': "Backup: IA indisponível."
        }), 200
    
    if not client:
        return usar_backup("Sem API Key configurada")
    
    try:
        prompt_sistema = """
        Você é um especialista no ENEM. Crie um tema de redação completo, inédito e busque textos de apoios para esse tema igual como o enem faz e disponibilize 3 para o usuario.
        Retorne APENAS um JSON válido neste formato (sem markdown):
        {
            "tema": "Título do Tema",
            "texto_apoio": "Texto motivador 1... Texto motivador 2... Texto motivador 3..."
        }
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini", 
            messages=[{"role": "user", "content": prompt_sistema}],
            temperature=0.8
        )
        content = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
        dados_ia = json.loads(content)

        try:
            sql_save = text("INSERT INTO temas_redacao (tema, texto_de_apoio, gerado_por_ia) VALUES (:tema, :apoio, TRUE) RETURNING id")
            result = db.session.execute(sql_save, {'tema': dados_ia['tema'], 'apoio': dados_ia['texto_apoio']})
            novo_id = result.fetchone()[0]
            db.session.commit()

            print(f"✅ TEMA CRIADO COM SUCESSO: ID {novo_id}")

        except Exception as e:
            print(f"Aviso: erro ao salvar tema no histórico: {e}")

        return jsonify({'id': novo_id, 'tema': dados_ia['tema'], 'texto_apoio': dados_ia['texto_apoio']}), 200

    except Exception as e:
        return usar_backup(f"Erro na API OpenAI: {str(e)}")
    
@app.route('/redacao/gerar-tema', methods=['POST'])
def gerar_tema_ia():
    
    return get_tema_redacao()


@app.route('/redacao/enviar', methods=['POST'])
def enviar_redacao():
    if not client: 
        return jsonify({'error': 'Sem API KEY configurada'}), 500

    data = request.get_json()
    usuario_id = data.get('usuario_id')
    tema_id_raw = data.get('tema_id')
    texto_usuario = data.get('texto') 
    imagem_base64 = data.get('imagem')

    print(f"DEBUG: Recebido usuario_id={usuario_id}, tema_id={tema_id_raw}")

    if not usuario_id:
        return jsonify({'error': 'Usuário não identificado. Faça login novamente.'}), 400
    
    final_tema_id = 1
    titulo_tema = "Tema Livre / Não informado"

    if tema_id_raw:
        try:
            parsed_id = int(tema_id_raw)
            final_tema_id = parsed_id
            res_tema = db.session.execute(text("SELECT tema FROM temas_redacao WHERE id = :tid"), {'tid': final_tema_id}).fetchone()
            if res_tema: titulo_tema = res_tema.tema
            else:
                print(f"AVISO: ID {final_tema_id} não encontrado no banco. Usando ID mas sem título específico.")
        except ValueError:
            print("ERRO: tema_id não é um número válido. Usando Backup (1).")
            final_tema_id = 1
    else:
        print("AVISO: tema_id veio vazio ou nulo. Usando Backup (1).")

    try:    
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

        
        mensagens_api = [{"role": "system", "content": prompt_sistema}]

        if imagem_base64:
            
            mensagens_api.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": f"O tema da redação é: '{titulo_tema}'. Por favor, transcreva e corrija esta imagem."},
                    {"type": "image_url", "image_url": {"url": imagem_base64}}
                ]
            })
            model_to_use = "gpt-4o-mini"  
        else:
            if not texto_usuario:
                 return jsonify({'error': 'Nenhum texto ou imagem fornecido.'}), 400
            mensagens_api.append({"role": "user", "content": f"Tema: '{titulo_tema}'.\nRedação:\n{texto_usuario}"})
            model_to_use = "gpt-4o-mini"


        response = client.chat.completions.create(model=model_to_use, messages=mensagens_api, temperature=0.4, max_tokens=4096)

        conteudo_ia = response.choices[0].message.content
        resultado_ia = json.loads(conteudo_ia.replace("```json", "").replace("```", "").strip())
        situacao = resultado_ia.get('situacao_tema', 'OK').upper()
        texto_final = resultado_ia.get('texto_transcrito')
        if not texto_final: texto_final = texto_usuario if texto_usuario else " [Texto Imagem] "
    
        notas = resultado_ia.get('notas', {})
        if situacao == 'FUGA':
            print("🚨 FUGA DETECTADA: Zerando tudo.")
            notas = { 'c1': 0, 'c2': 0, 'c3': 0, 'c4': 0, 'c5': 0 }
            resultado_ia['comentario_geral'] = f"REDAÇÃO ZERADA. Fuga ao tema '{titulo_tema}'."
        
        elif situacao == 'TANGENTE':
            print("⚠️ TANGENCIAMENTO: Aplicando teto de 40 pontos.")

            notas['c2'] = min(notas.get('c2', 0), 40)
            notas['c3'] = min(notas.get('c3', 0), 40)
            notas['c5'] = min(notas.get('c5', 0), 40)
            resultado_ia['comentario_geral'] = f"NOTA REBAIXADA. Você tangenciou o tema '{titulo_tema}'."

        soma_total = sum(int(notas.get(f'c{i}', 0)) for i in range(1, 6))

        sql_insert = text("""
            INSERT INTO redacoes (usuario_id, tema_id, texto, enviado_em) 
            VALUES (:uid, :tid, :txt, NOW()) RETURNING id
        """)
    
        rid = db.session.execute(sql_insert, {
            'uid': int(usuario_id), 
            'tid': final_tema_id, 
            'txt': texto_final
        }).fetchone()[0]

        for i in range(1, 6):
            db.session.execute(text("INSERT INTO redacoes_competencias (redacao_id, competencia, nota) VALUES (:rid, :comp, :n)"), 
                               {'rid': rid, 'comp': i, 'n': int(notas.get(f'c{i}', 0))})

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
            'tema_usado': titulo_tema,
            'tema_id_usado': final_tema_id,
            'nota_total': soma_total,
            'notas_por_competencia': notas,
            'comentario_geral': resultado_ia.get('comentario_geral'),
            'detalhes_erros': resultado_ia.get('detalhes_competencias', {})
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"ERRO: {e}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/historico/<int:usuario_id>', methods=['GET'])
def get_historico(usuario_id):
    historico_geral = []
    
    def limpar_fuso(dt):
        if dt and hasattr(dt, 'replace'):
            return dt.replace(tzinfo=None)
        return dt

    try:

        try:
            sql_simulados = text("""
                SELECT id, criado_em, tipo, nota_total, acertos, erros 
                FROM exames 
                WHERE usuario_id = :uid AND nota_total IS NOT NULL 
            """)
            res_sim = db.session.execute(sql_simulados, {'uid': usuario_id}).fetchall()

            for row in res_sim:

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
    usuario_id = data.get('usuario_id') 
    msg_usuario = data.get('message')
    historico = data.get('history', [])
    
    try:
        sessao_id = None

        if usuario_id:

            res = db.session.execute(text("SELECT id FROM chat_sessoes WHERE usuario_id=:uid AND finalizado_em IS NULL LIMIT 1"), {'uid': usuario_id}).fetchone()
            if res:
                sessao_id = res[0]
            else:
                new_s = db.session.execute(text("INSERT INTO chat_sessoes (usuario_id) VALUES (:uid) RETURNING id"), {'uid': usuario_id})
                sessao_id = new_s.fetchone()[0]
                db.session.commit()

            db.session.execute(text("INSERT INTO chat_mensagens (sessao_id, usuario_id, remetente, mensagem) VALUES (:sid, :uid, 'user', :msg)"), 
                               {'sid': sessao_id, 'uid': usuario_id, 'msg': msg_usuario})
            db.session.commit()

        prompt_sistema = """
        VOCÊ É O PREPARAI, UM TUTOR ESPECIALIZADO NO ENEM E ENSINO MÉDIO.
        Sua missão é auxiliar estudantes com explicações didáticas, resolução de questões e contextualização de matérias..

        DIRETRIZ MESTRA (O "VIÉS ACADÊMICO"):
        Você deve analisar a INTENÇÃO da pergunta do usuário.
        - Assuntos gerais (tecnologia, esportes, música, cultura pop, entre outros...) SÓ SÃO PERMITIDOS se forem abordados sob uma ótica acadêmica, histórica, sociológica, física ou biológica.
        - Assuntos com viés de consumo, fofoca, opinião pessoal, preços ou entretenimento puro DEVEM SER RECUSADOS educadamente.

        EXEMPLOS DE COMPORTAMENTO (USE COMO REGRA):

        Caso 1: Tecnologia (Contexto Comercial - PROIBIDO)
        Usuário: "Quanto custa o notebook Dell mais recente?"
        PreparAI: "Meu foco é o ENEM e conteúdos educacionais. Não forneço informações de preços ou recomendações de compras. Mas posso te explicar como funciona o processador dele se quiser estudar informática!"

        Caso 2: Tecnologia (Contexto Educacional - PERMITIDO)
        Usuário: "Como a evolução dos computadores impactou o mercado de trabalho?"
        PreparAI: (Explica sobre Revolução Técnico-Científica-Informacional, Globalização e Sociologia do Trabalho).

        Caso 3: Esportes (Contexto Fofoca - PROIBIDO)
        Usuário: "O Neymar jogou bem ontem?"
        PreparAI: "Eu sou um assistente focado nos estudos para o ENEM. Não acompanho notícias de jogos ou celebridades. Vamos voltar para os estudos?"

        Caso 4: Esportes (Contexto Físico/Biológico - PERMITIDO)
        Usuário: "Qual a física por trás do chute de curva no futebol?"
        PreparAI: (Explica sobre o Efeito Magnus, dinâmica de fluidos e vetores).

        Caso 5: Sentimental/Pessoal (PROIBIDO)
        Usuário: "Estou me sentindo muito triste hoje."
        PreparAI: "Sinto muito que esteja assim. Como sou uma IA focada em ensino, não posso oferecer conselhos pessoais, mas sugiro que procure apoio de amigos ou profissionais. Se quiser distrair a mente estudando, estou aqui."

        REGRAS DE RESPOSTA:
        1. Seja didático, objetivo e use linguagem adequada ao Ensino Médio.
        2. Se a pergunta for recusada, sugira um tema correlato que seja educacional.
        3. NUNCA saia do personagem. Você não é o ChatGPT, você é o PreparAI.

        REGRAS DE MATEMÁTICA (CRÍTICO):
        1. Use SEMPRE o cifrão ($) para fórmulas. NUNCA use [ ] ou ( ).
        2. ESCAPE TODAS AS BARRAS INVERTIDAS.
           - Errado: \frac{a}{b}
           - Certo: \\frac{a}{b}  (Use duas barras!)
        
        Exemplo Inline: $ E = mc^2 $
        Exemplo Bloco: $$ x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} $$
        """

        messages_payload = [{"role": "system", "content": prompt_sistema}] + historico + [{"role": "user", "content": msg_usuario}]
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages_payload,
            temperature=0.5 
        )
        ai_reply = response.choices[0].message.content

        if sessao_id:
            db.session.execute(text("INSERT INTO chat_mensagens (sessao_id, usuario_id, remetente, mensagem) VALUES (:sid, :uid, 'bot', :msg)"), 
                               {'sid': sessao_id, 'uid': usuario_id, 'msg': ai_reply})
            db.session.commit()

        return jsonify({'reply': ai_reply})
    
    except Exception as e:
        print(f"ERRO CHAT: {e}") 
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/chat/sessoes/<int:usuario_id>', methods=['GET'])
def get_usuario_sessoes(usuario_id):
    try:
        sql = text("""
            SELECT s.id, s.iniciado_em, 
                   (SELECT mensagem FROM chat_mensagens WHERE sessao_id = s.id ORDER BY id ASC LIMIT 1) as resumo
            FROM chat_sessoes s
            WHERE s.usuario_id = :uid
            ORDER BY s.iniciado_em DESC
        """)
        
        result = db.session.execute(sql, {'uid': usuario_id}).fetchall()
        
        sessoes = []
        for row in result:
            titulo = row.resumo if row.resumo else "Nova Conversa"
            if len(titulo) > 30: titulo = titulo[:27] + "..."
            
            sessoes.append({
                'id': row.id,
                'data': row.iniciado_em.strftime('%d/%m %H:%M'),
                'titulo': titulo
            })
            
        return jsonify(sessoes), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/chat/novo', methods=['POST'])
def novo_chat_sessao():
    data = request.get_json()
    usuario_id = data.get('usuario_id')
    
    try:
        db.session.execute(text("UPDATE chat_sessoes SET finalizado_em = NOW() WHERE usuario_id = :uid AND finalizado_em IS NULL"), {'uid': usuario_id})
        
        sql_new = text("INSERT INTO chat_sessoes (usuario_id) VALUES (:uid) RETURNING id")
        new_id = db.session.execute(sql_new, {'uid': usuario_id}).fetchone()[0]
        db.session.commit()
        
        return jsonify({'message': 'Nova sessão criada', 'sessao_id': new_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500    


@app.route('/api/chat/historico/<int:usuario_id>', methods=['GET'])
def get_chat_historico(usuario_id):
    sessao_id = request.args.get('sessao_id')

    try:
        if sessao_id:
            sql = text("""
                SELECT remetente, mensagem, enviado_em 
                FROM chat_mensagens 
                WHERE sessao_id = :sid AND usuario_id = :uid
                ORDER BY enviado_em ASC
            """)
        
            params = {'sid': sessao_id, 'uid': usuario_id}
        else:
            sql = text("""
                SELECT m.remetente, m.mensagem, m.enviado_em 
                FROM chat_mensagens m
                JOIN chat_sessoes s ON m.sessao_id = s.id
                WHERE s.usuario_id = :uid AND s.finalizado_em IS NULL
                ORDER BY m.enviado_em ASC
            """)
            params = {'uid': usuario_id}
        
        result = db.session.execute(sql, params).fetchall()
        
        historico = []
        for row in result:
            role_openai = 'user' if row.remetente == 'user' else 'assistant'
            historico.append({
                'role': role_openai,
                'content': row.mensagem,
                'data': row.enviado_em.strftime('%d/%m %H:%M') if row.enviado_em else ''
            })
            
        return jsonify(historico), 200

    except Exception as e:
        print(f"Erro ao buscar histórico do chat: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/dashboard/recomendacao/<int:usuario_id>', methods=['GET'])
def get_recomendacao_estudos(usuario_id):
    if not client: return jsonify({'error': 'Sem IA'}), 500

    try:
        sql = text("""
            SELECT 
                m.nome as materia,
                COUNT(*) as total_questoes,
                SUM(CASE WHEN eq.correta = TRUE THEN 1 ELSE 0 END) as acertos
            FROM exames_questoes eq
            JOIN exames e ON eq.exame_id = e.id
            JOIN questoes q ON eq.questao_id = q.id
            JOIN materias m ON q.materia_id = m.id
            WHERE e.usuario_id = :uid
            GROUP BY m.nome
        """)
        
        resultados = db.session.execute(sql, {'uid': usuario_id}).fetchall()
        
        if not resultados:
            return jsonify({
                'titulo': 'Comece a Praticar!',
                'texto': 'Ainda não tenho dados suficientes. Faça seu primeiro simulado para eu analisar seus pontos fortes e fracos!'
            })

        pior_materia = None
        menor_taxa = 101.0
        
        for row in resultados:
            if row.total_questoes < 3: continue
            
            taxa = (row.acertos / row.total_questoes) * 100
            if taxa < menor_taxa:
                menor_taxa = taxa
                pior_materia = row.materia

        if not pior_materia:
            return jsonify({
                'titulo': 'Continue Assim!',
                'texto': 'Seus dados iniciais estão ótimos. Continue fazendo simulados para refinarmos a análise.'
            })
        
        prompt = f"""
        Aja como um mentor pedagógico experiente do ENEM.
        O aluno está com dificuldade crítica em: {pior_materia} (Aproveitamento de apenas {menor_taxa:.1f}%).
        
        Gere um conselho curto e direto (máximo 3 frases) sugerindo um tópico chave dessa matéria que costuma cair muito no ENEM e como estudar ele.
        Não use saudações. Vá direto ao ponto. Ex: "Em Matemática, foque em Regra de Três..."
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=100
        )
        
        conselho_ia = response.choices[0].message.content

        return jsonify({
            'titulo': f'Foco em {pior_materia} 🎯',
            'texto': conselho_ia
        })

    except Exception as e:
        print(f"Erro recomendação: {e}")
        return jsonify({'texto': 'Não foi possível gerar a recomendação agora.'}), 500


    except Exception as e:
        print("\n\n🔥 ERRO FATAL NA OPENAI🔥")
        print(f"TIPO DO ERRO: {type(e)}")
        print(f"MENSAGEM: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('APP_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

        
