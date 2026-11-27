"""Os limites dos campos, num lugar só.

Os schemas validam com estes números, e `GET /preferencias/opcoes` os entrega
ao front (`Limites`, em schemas/preferencia.py). O servidor é a fonte: o front
só guarda uma cópia de reserva (`frontend/lib/vocabulario.ts`) para validar sem
esperar a rede, e um teste do front confere que ela bate com esta.
Os poemas não têm limite de caracteres.
"""

# Cadastro e perfil (schemas/user.py e schemas/auth.py).
USERNAME_MIN = 3
USERNAME_MAX = 30
# O bcrypt ignora o que passa de 72 bytes: duas senhas iguais até ali virariam a
# mesma senha: recusamos em vez de truncar calado. O máximo conta bytes.
SENHA_MIN = 8
SENHA_MAX = 72
NOME_MAX = 80
BIO_MAX = 1000
AVATAR_URL_MAX = 500

# Poema (schemas/post.py): só o título tem teto.
POEMA_TITULO_MAX = 200

# Antologia (schemas/antologia.py).
ANTOLOGIA_NOME_MAX = 100
ANTOLOGIA_DESCRICAO_MAX = 1000

# Renga (schemas/renga.py): quantas estrofes ela pode ter, contando a do criador.
RENGA_TITULO_MAX = 200
RENGA_LIMITE_PADRAO = 12
RENGA_LIMITE_MIN = 3
RENGA_LIMITE_MAX = 40
RENGA_CONVIDADOS_MAX = 50

# Oficina (schemas/oficina.py): teto da análise, para a rota sem login não virar
# abuso. O poema continua sem limite; só a oficina para de marcar acima disto.
OFICINA_MAX_CARACTERES = 10_000

# Mensagem (schemas/mensagem.py): pode ser um poema colado inteiro, mas não um livro.
MENSAGEM_MAX_CARACTERES = 10_000

# Inteiros que vão para o banco (ids, offsets, versos): as colunas são INTEGER,
# int4 no Postgres. Fora disto o banco recusa e a rota daria 500; o schema dá 422.
INT4_MIN = -(2**31)
INT4_MAX = 2**31 - 1

