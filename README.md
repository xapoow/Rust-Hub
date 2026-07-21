# Rust Hub

Статический React-хаб по Rust: видео по базам, короткие заметки по РТ и быстрые справочные карточки.

## Возможности

- Синхронизация YouTube-плейлиста через публичный XML feed.
- Поиск видео, сортировка, теги, избранное и копирование ссылок.
- Раздел РТ с карточками, страницами деталей, поиском по названию и локальными превью.
- Сохраняемая светлая/темная тема.
- Счетчик до следующего запланированного обновления видео.
- Ручной fallback для видео через `public/data/extra-videos.json`.

## Команды

```bash
npm install
npm run sync:playlist
npm run dev
npm run build
npm run preview
```

## Данные

Данные плейлиста генерируются из:

```text
https://www.youtube.com/feeds/videos.xml?playlist_id=PLzzSo-3QjuUrdl5aArPofdMsjCzC5DAQd
```

`npm run sync:playlist` записывает `public/data/playlist.json`. Заметки по РТ лежат в
`public/data/monuments.json`, а превью РТ лежат в `public/images/monuments/`.

GitHub Actions запускает sync перед сборкой и по расписанию раз в 30 минут.
Приватные плейлисты в этой no-backend схеме не поддерживаются.

## Деплой

Деплой на GitHub Pages описан в `.github/workflows/deploy.yml`. В настройках
репозитория Pages должен использовать источник GitHub Actions.
