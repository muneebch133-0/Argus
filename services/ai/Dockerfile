FROM python:3.14.6-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
RUN addgroup -S argus && adduser -S argus -G argus
COPY requirements.txt ./
RUN pip install --requirement requirements.txt
COPY --chown=argus:argus app ./app
USER argus
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
