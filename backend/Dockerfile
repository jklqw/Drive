FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libmagic1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 sfmp \
    && useradd --uid 10001 --gid sfmp --create-home --shell /usr/sbin/nologin sfmp \
    && mkdir -p /var/lib/sfmp_vault \
    && chown -R sfmp:sfmp /var/lib/sfmp_vault \
    && chmod 0750 /var/lib/sfmp_vault

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chown -R sfmp:sfmp /app

USER sfmp
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
