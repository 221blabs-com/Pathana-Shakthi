FROM ollama/ollama:latest

COPY backend/ollama/start.sh /start.sh
RUN chmod +x /start.sh

ENV OLLAMA_MODEL=qwen2.5:3b

# The base image sets ENTRYPOINT ["ollama"], so a bare CMD here gets run as
# an argument to that ("ollama /start.sh") instead of replacing it — hence
# the explicit empty ENTRYPOINT.
ENTRYPOINT []
CMD ["/start.sh"]
