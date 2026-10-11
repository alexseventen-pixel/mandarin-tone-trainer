# Развёртывание на Render

## Перед началом

Загрузите распакованное содержимое проекта в GitHub. Файл `.env` не загружайте.

Проект содержит две конфигурации:

- `render.yaml` — безопасный старт: бесплатный Node.js-сервис, ToneMirror и TonePerfect.
- `render-full.yaml` — Node.js плюс отдельный CREPE-сервис. CREPE использует платный план с 2 GB RAM.

## Вариант 1: бесплатный Render

В этом варианте работают:

- ToneMirror · local DTW;
- TonePerfect · cloud API.

CREPE можно оставить запущенным на другом сервере и указать его адрес позднее.

1. Откройте https://dashboard.render.com/
2. Нажмите **New → Blueprint**.
3. Подключите GitHub и выберите репозиторий проекта.
4. Render автоматически найдёт `render.yaml`.
5. В поле `TONEPERFECT_API_KEY` вставьте ключ TonePerfect.
6. `CREPE_URL` можно оставить пустым, если CREPE пока не размещён.
7. Нажмите **Apply**.
8. Дождитесь статуса **Live**.
9. Откройте адрес вида:

```text
https://mandarin-tone-trainer-xxxx.onrender.com
```

Каждый следующий push в GitHub будет автоматически обновлять приложение.

## Вариант 2: все три режима

CREPE загружает TensorFlow и модель, поэтому 512 MB бесплатного сервиса недостаточно. Конфигурация использует:

- бесплатный Node.js web service;
- приватный Python service `1c-2g` для CREPE.

1. В Render выберите **New → Blueprint**.
2. Подключите GitHub-репозиторий.
3. В настройке Blueprint file укажите:

```text
render-full.yaml
```

4. Проверьте, что Render показывает два сервиса:
   - `mandarin-tone-trainer`;
   - `mandarin-tone-crepe`.
5. Вставьте `TONEPERFECT_API_KEY`.
6. Перед подтверждением проверьте стоимость плана `1c-2g`.
7. Нажмите **Apply**.

Render сам передаст внутренний адрес CREPE в Node.js-приложение. Публично CREPE-сервис открыт не будет.

## Если приложение уже создано вручную

Для Node.js web service:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

Переменные:

```text
TONEPERFECT_API_KEY = ваш ключ
CREPE_URL = адрес CREPE-сервиса
```

Для CREPE:

```text
Service type: Private Service
Runtime: Python
Build Command: pip install -r crepe_service/requirements.txt
Start Command: python crepe_service/app.py
Plan: 1c-2g или больше
```

Переменные:

```text
PYTHON_VERSION = 3.11.11
CREPE_MODEL = tiny
```

## Ключ TonePerfect

Ключ должен находиться в **Environment** сервиса Render. Не записывайте его в `.env.example`, `render.yaml` или GitHub.

После изменения ключа выберите **Save, rebuild, and deploy**.

## Проверка

Откройте:

```text
https://ваш-сервис.onrender.com/health
```

Исправный сервер отвечает:

```json
{"status":"ok"}
```

Затем откройте главную страницу, выберите движок и сделайте короткую запись.
