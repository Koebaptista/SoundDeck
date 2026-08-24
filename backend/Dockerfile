# Imagem do servidor do deck. Só Python: Django, DRF e mutagen são puros, e
# psycopg vem com wheel binário — nada aqui precisa de compilador.
FROM python:3.12-slim

# Sem .pyc no diretório montado do host, e log saindo na hora — `docker compose
# logs -f` tem que mostrar o cue chegando enquanto ele chega.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# As dependências antes do código: mexer numa view não reinstala o Django.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
