# Rust Hub

Статический React-хаб по Rust: видео по базам, короткие заметки по РТ и калькулятор рейда.

## Возможности

- Синхронизация YouTube-плейлиста через публичный XML feed.
- Поиск видео, сортировка, теги, избранное и копирование ссылок.
- Раздел РТ с карточками, страницами деталей, поиском по названию и медиа-плейсхолдерами.
- Калькулятор рейда с целями, вариантами взрывчатки и расчётом серы и угля.
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
`public/data/monuments.json`, а данные калькулятора — в `public/data/raid.json`.
Изображения РТ, целей и предметов нужно добавлять в `public/media/` по списку из
`public/media/README.txt`; до этого интерфейс показывает плейсхолдеры.

GitHub Actions запускает sync перед сборкой и по расписанию раз в 30 минут.
Приватные плейлисты в этой no-backend схеме не поддерживаются.

## Деплой

Деплой на GitHub Pages описан в `.github/workflows/deploy.yml`. В настройках
репозитория Pages должен использовать источник GitHub Actions.
