# Rust Hub

Static React hub for Rust base guide videos and lightweight monument notes.

## Features

- YouTube playlist sync through the public XML feed.
- Video search, sorting, inferred tags, favorites, and copy-link actions.
- Monument hub with simple cards, detail pages, and name search.
- Persisted light/dark theme.
- Countdown to the next scheduled video sync window.
- Manual fallback videos through `public/data/extra-videos.json`.

## Commands

```bash
npm install
npm run sync:playlist
npm run dev
npm run build
npm run preview
```

## Data

Playlist data is generated from:

```text
https://www.youtube.com/feeds/videos.xml?playlist_id=PLzzSo-3QjuUrdl5aArPofdMsjCzC5DAQd
```

`npm run sync:playlist` writes `public/data/playlist.json`. Monument notes live in
`public/data/monuments.json`.

GitHub Actions runs playlist sync before building and on a 30-minute schedule.
Private playlists are not supported by this no-backend setup.

## Deployment

GitHub Pages deployment is handled by `.github/workflows/deploy.yml`. In the
repository settings, set Pages source to GitHub Actions.
