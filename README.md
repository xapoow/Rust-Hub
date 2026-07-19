# Base guides Rust

Static React landing for a YouTube playlist with Rust base design videos.
The interface includes a persisted light/dark theme toggle.
It also shows a countdown to the next scheduled playlist sync window.

## Commands

```bash
npm install
npm run sync:playlist
npm run dev
npm run build
npm run preview
```

## Playlist Data

The playlist data is generated from the public YouTube XML feed:

```text
https://www.youtube.com/feeds/videos.xml?playlist_id=PLzzSo-3QjuUrdl5aArPofdMsjCzC5DAQd
```

`npm run sync:playlist` writes the normalized result to
`public/data/playlist.json`. GitHub Actions runs the same sync before building
and also runs daily so the deployed site can pick up playlist changes.

Private playlists are not supported by this no-backend setup. The playlist must
be public or unlisted with a feed that is accessible without authentication, and
individual videos must allow iframe embedding.

## Deployment

GitHub Pages deployment is handled by `.github/workflows/deploy.yml`. In the
repository settings, set Pages source to GitHub Actions.
