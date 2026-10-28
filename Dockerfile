FROM python:3.11-slim

WORKDIR /app

# Non sono necessarie librerie esterne compilate, usa python standard
COPY etl.py server.py ./
COPY public/ ./public/

# Imposta porta predefinita
ENV PORT=8080
EXPOSE 8080

# Esegue ETL all'avvio del container se il db non esiste, poi lancia il server
CMD ["sh", "-c", "python etl.py && python server.py $PORT"]
