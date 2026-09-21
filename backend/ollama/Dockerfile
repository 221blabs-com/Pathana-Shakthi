FROM ollama/ollama:latest

COPY backend/ollama/start.sh /start.sh
RUN chmod +x /start.sh

ENV OLLAMA_MODEL=qwen2.5:3b

CMD ["/start.sh"]
