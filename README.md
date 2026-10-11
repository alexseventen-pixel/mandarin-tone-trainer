# Mandarin Tone Trainer — три режима оценки

Локальное приложение для VS Code с одним выпадающим списком:

1. **ToneMirror · local DTW** — бесплатно, работает в браузере без сервера модели.
2. **TonePerfect · cloud API** — сохранённая платная оценка через API.
3. **CREPE · local neural pitch tracker** — бесплатная локальная нейросеть.

Все режимы показывают общий балл, результат каждого слога, ожидаемый и услышанный тон, временные границы, диагностические показатели и полный JSON.

Для публикации через GitHub на Render откройте [RENDER.md](RENDER.md). В проект уже добавлены готовые `render.yaml` и `render-full.yaml`.

## Папки

```text
mandarin-tone-trainer-vscode/
├── public/
│   ├── index.html              интерфейс и выбор режима
│   ├── style.css               оформление
│   └── app.js                  микрофон, YIN, DTW, графики и отчёт
├── server/
│   ├── server.js               локальный Node.js-сервер
│   ├── config.js               настройки .env
│   └── providers/
│       ├── toneperfect.js      TonePerfect API
│       └── crepe.js            мост к локальному CREPE
├── crepe_service/
│   ├── app.py                  нейросеть CREPE и оценка тонов
│   └── requirements.txt        Python-зависимости
├── .env.example
└── package.json
```

## Основной запуск

Нужен [Node.js 20+](https://nodejs.org/).

1. Откройте папку через **File → Open Folder…** в VS Code.
2. Скопируйте `.env.example` в новый файл `.env`.
3. Откройте **Terminal → New Terminal**.
4. Выполните `npm start`.
5. Откройте [http://localhost:3000](http://localhost:3000).

Для режима **ToneMirror** больше ничего устанавливать не нужно.

## TonePerfect

В `.env`:

```env
TONEPERFECT_API_KEY=ваш_ключ
CREPE_URL=http://127.0.0.1:8001/assess
PORT=3000
```

Перезапустите `npm start` после замены ключа. Файл `.env` исключён из Git и не передаётся браузеру.

## CREPE

Рекомендуется Python 3.10 или 3.11. В новом терминале VS Code:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r crepe_service/requirements.txt
npm run crepe
```

На Windows:

```powershell
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r crepe_service/requirements.txt
python crepe_service/app.py
```

Оставьте CREPE-сервис работающим. В другом терминале выполните `npm start`, откройте приложение и выберите **CREPE · local neural pitch tracker**.

Первый анализ может идти дольше: TensorFlow загружает модель. Размер модели задаётся перед запуском переменной `CREPE_MODEL`: `tiny`, `small`, `medium`, `large` или `full`. Начните с `tiny`.

## Различия режимов

### ToneMirror · local DTW

- звук не покидает браузер;
- YIN извлекает основную частоту;
- высота нормализуется относительно голоса пользователя;
- DTW сравнивает кривую каждого слога с четырьмя китайскими тонами;
- работает быстрее всего и без ключа;
- границы слогов приблизительные, по паузам и энергии.

Это самостоятельная реализация того же подхода: pitch tracking, нормализация и Dynamic Time Warping. Код стороннего проекта в папку не копировался.

### TonePerfect

- отправляет запись в облачный API;
- показывает все поля, которые вернул сервис;
- требует API-ключ и расходует кредиты.

### CREPE

- использует локальную свёрточную нейросеть для F0;
- после CREPE применяется нормализация и DTW;
- показывает confidence, диапазон голоса, Hz, полутона и расстояния до каждого тона;
- запись остаётся на компьютере;
- требует Python и TensorFlow.

## Максимально подробный вывод

Нажмите **Complete analysis data** под результатом. Там доступны движок и версия, длительность, sample rate, tone score, временные границы, ожидаемый и услышанный тон, voiced ratio, median/min/max Hz, диапазон в полутонах, DTW distance, расстояния до тонов 1–4, confidence CREPE, нормализованная кривая и значения pitch.

## Где что менять

- Выпадающий список и подписи: `public/index.html`
- Цвета и размеры: `public/style.css`
- ToneMirror, YIN, DTW и отображение: `public/app.js`
- TonePerfect: `server/providers/toneperfect.js`
- Передача записи в CREPE: `server/providers/crepe.js`
- Работа CREPE: `crepe_service/app.py`

## Ограничение

ToneMirror и CREPE измеряют форму высоты голоса, но пока используют приблизительное разделение связной речи на слоги. Для длинных предложений следующим улучшением будет forced alignment по известному тексту и пиньиню.

## Частые проблемы

**CREPE не отвечает:** проверьте, что отдельный терминал показывает `CREPE service: http://127.0.0.1:8001/assess`.

**TensorFlow не устанавливается:** используйте Python 3.10 или 3.11 и создайте новое `.venv`.

**Микрофон не работает:** разрешите микрофон для `localhost` в Chrome или Edge.

**TonePerfect не видит ключ:** проверьте `.env`, строку `TONEPERFECT_API_KEY` и перезапустите Node.js-сервер.
