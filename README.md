# Mandarin Tone Trainer — локальная версия для VS Code

Это упрощённая версия проекта, которую можно открыть обычной папкой в VS Code.

В проекте нет сборщика, базы данных и обязательных внешних библиотек. Нужен только **Node.js 20 или новее**.

## Что находится в папках

```text
mandarin-tone-trainer-vscode/
├── public/
│   ├── index.html       страница приложения
│   ├── style.css        внешний вид
│   └── app.js           микрофон, график и отображение результата
├── server/
│   ├── server.js        локальный веб-сервер и маршрут /api/assess
│   ├── config.js        чтение настроек из .env
│   └── providers/
│       ├── toneperfect.js   подключение TonePerfect
│       └── local.js         подключение собственной локальной модели
├── .env.example
├── .gitignore
└── package.json
```

Ключ хранится только в файле `.env` на вашем компьютере. Браузер его не получает.

## Первый запуск

1. Установите [Node.js](https://nodejs.org/) версии 20 или новее.
2. Откройте VS Code.
3. Выберите **File → Open Folder…** и откройте папку `mandarin-tone-trainer-vscode`.
4. В левой панели VS Code найдите `.env.example`.
5. Сделайте его копию с именем `.env`.
6. Вставьте ключ TonePerfect:

```env
AI_PROVIDER=toneperfect
TONEPERFECT_API_KEY=ваш_ключ
PORT=3000
```

7. Откройте терминал VS Code: **Terminal → New Terminal**.
8. Выполните:

```bash
npm start
```

9. Откройте в браузере:

[http://localhost:3000](http://localhost:3000)

Для остановки сервера нажмите **Ctrl+C** в терминале.

## Как заменить ключ

Откройте файл `.env` и замените значение:

```env
TONEPERFECT_API_KEY=новый_ключ
```

После изменения остановите сервер сочетанием **Ctrl+C** и снова выполните `npm start`.

Не добавляйте файл `.env` в GitHub. Он уже указан в `.gitignore`.

## Режим разработки

Можно запустить:

```bash
npm run dev
```

Node.js будет автоматически перезапускать сервер после изменений в серверных файлах. После изменения файлов из `public` достаточно обновить страницу браузера.

## Как подключить локальную нейросеть

В файле `.env` переключите провайдера:

```env
AI_PROVIDER=local
LOCAL_AI_URL=http://127.0.0.1:8000/assess
PORT=3000
```

Теперь проект отправляет запись на ваш локальный адрес.

Запрос имеет формат JSON:

```json
{
  "audioBase64": "UklGR...",
  "text": "一对夫妻怕熊破坏院子里的围栏。",
  "pinyin": "yi1 dui4 fu1 qi1 pa4 xiong2 po4 huai4 yuan4 zi3 li3 de5 wei2 lan2",
  "language": "zh-CN"
}
```

`audioBase64` содержит WAV, mono, 16 kHz.

Адаптер находится в `server/providers/local.js`. Если ваша модель принимает файл, другой JSON или использует иной URL, меняйте только этот файл.

## Какой ответ ожидает интерфейс

Минимальный ответ:

```json
{
  "assessable": true,
  "scores": {
    "overall": 86,
    "tone": 82,
    "pronunciation": 88
  },
  "words": [
    {
      "word": "一",
      "pinyin": "yi1",
      "score": 92,
      "phones": [
        {
          "dimension": "tone",
          "expected": 1,
          "heard": 1,
          "score": 92,
          "decision": "no_correction"
        }
      ]
    }
  ]
}
```

Для `decision` интерфейс понимает:

- `no_correction` — тон произнесён хорошо;
- `review` — тон нужно повторить;
- `uncertain` — модель не уверена.

Массив `words` должен содержать по одному элементу на каждый китайский иероглиф.

## Где менять интерфейс

- Надписи и разметка: `public/index.html`
- Цвета и расположение элементов: `public/style.css`
- Запись микрофона, локальный график и отображение ответа: `public/app.js`
- TonePerfect API: `server/providers/toneperfect.js`
- Своя модель: `server/providers/local.js`

## Частые проблемы

### Страница не открывается

Убедитесь, что терминал показывает:

```text
Mandarin Tone Trainer: http://localhost:3000
```

### Микрофон не работает

Разрешите доступ к микрофону для `localhost` в браузере. Лучше использовать Chrome или Edge.

### TonePerfect сообщает, что ключ отсутствует

Проверьте, что файл называется именно `.env`, а строка `TONEPERFECT_API_KEY` содержит ключ без лишних пробелов.

### Локальная модель не отвечает

Сначала отдельно запустите вашу модель и проверьте адрес `LOCAL_AI_URL`. Затем перезапустите этот проект.
