# One container: builds the web app, serves it + the API on :7860 (Hugging Face Spaces free CPU tier).
FROM node:22-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt server/
RUN pip install --no-cache-dir -r server/requirements.txt \
 && python -c "import duckdb; c=duckdb.connect(); c.execute('INSTALL spatial; INSTALL httpfs')"
COPY server/ server/
COPY data/regions/ data/regions/
# 30-day outlook snapshot (rebuilt daily where the global aggregate exists; served as-is otherwise)
COPY data/global/outlook.json data/global/outlook.json
COPY --from=web /web/dist web/dist
ENV KW_DATA=/app/data PYTHONUNBUFFERED=1
WORKDIR /app/server
EXPOSE 7860
CMD ["uvicorn", "kw.api:app", "--host", "0.0.0.0", "--port", "7860"]
