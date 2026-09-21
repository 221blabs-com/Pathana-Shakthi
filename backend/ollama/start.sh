#!/bin/sh
set -e

# Render assigns the listening port via $PORT at runtime — bake that into
# OLLAMA_HOST here rather than in the Dockerfile's ENV, since $PORT doesn't
# exist yet at image build time.
export OLLAMA_HOST="0.0.0.0:${PORT:-11434}"

ollama serve &
SERVER_PID=$!

echo "Waiting for Ollama server to come up..."
until ollama list >/dev/null 2>&1; do
  sleep 1
done

MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"
echo "Pulling $MODEL..."
ollama pull "$MODEL"

wait "$SERVER_PID"
