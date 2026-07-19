import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DATA_URL = `${import.meta.env.BASE_URL}data/playlist.json`
const PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLzzSo-3QjuUrdl5aArPofdMsjCzC5DAQd'

function getRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const videoMatch = hash.match(/^\/video\/([^/?#]+)/)

  if (videoMatch) {
    return { name: 'video', videoId: decodeURIComponent(videoMatch[1]) }
  }

  return { name: 'home' }
}

function formatDate(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function App() {
  const [route, setRoute] = useState(getRoute)
  const [playlist, setPlaylist] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadPlaylist() {
      try {
        const response = await fetch(DATA_URL)

        if (!response.ok) {
          throw new Error(`Playlist request failed: ${response.status}`)
        }

        const data = await response.json()

        if (!ignore) {
          setPlaylist(data)
          setStatus('ready')
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Unknown playlist error')
          setStatus('error')
        }
      }
    }

    loadPlaylist()

    return () => {
      ignore = true
    }
  }, [])

  const selectedVideo = useMemo(() => {
    if (!playlist || route.name !== 'video') return null
    return playlist.videos.find((video) => video.id === route.videoId) ?? null
  }, [playlist, route])

  if (status === 'loading') {
    return <StatusView title="Загружаем плейлист" />
  }

  if (status === 'error') {
    return (
      <StatusView
        title="Плейлист не загрузился"
        detail={error || 'Проверьте, что data/playlist.json доступен после сборки.'}
      />
    )
  }

  if (!playlist?.videos?.length) {
    return (
      <StatusView
        title="В плейлисте нет видео"
        detail="После обновления YouTube-плейлиста запустите синхронизацию данных."
      />
    )
  }

  if (route.name === 'video') {
    return (
      <VideoPage
        playlist={playlist}
        selectedVideo={selectedVideo}
        requestedVideoId={route.videoId}
      />
    )
  }

  return <HomePage playlist={playlist} />
}

function StatusView({ title, detail }) {
  return (
    <main className="shell status-shell">
      <section className="status-panel" aria-live="polite">
        <p className="eyebrow">Rust Bases</p>
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
      </section>
    </main>
  )
}

function HomePage({ playlist }) {
  return (
    <main className="shell">
      <Header playlist={playlist} />

      <section className="video-grid" aria-label="Видео плейлиста">
        {playlist.videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </section>
    </main>
  )
}

function Header({ playlist }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">YouTube playlist</p>
        <h1>{playlist.title}</h1>
        <p className="subtitle">
          {playlist.videos.length} видео по Rust base design от {playlist.channel.name}
        </p>
      </div>

      <a className="playlist-link" href={PLAYLIST_URL} target="_blank" rel="noreferrer">
        Открыть YouTube
      </a>
    </header>
  )
}

function VideoCard({ video }) {
  return (
    <a className="video-card" href={`#/video/${encodeURIComponent(video.id)}`}>
      <span className="thumb-wrap">
        <img src={video.thumbnailUrl} alt="" loading="lazy" />
        <span className="play-badge" aria-hidden="true">
          ▶
        </span>
      </span>
      <span className="video-meta">
        <strong>{video.title}</strong>
        <span>
          {video.author}
          {video.publishedAt ? ` · ${formatDate(video.publishedAt)}` : ''}
        </span>
      </span>
    </a>
  )
}

function VideoPage({ playlist, selectedVideo, requestedVideoId }) {
  if (!selectedVideo) {
    return (
      <main className="shell status-shell">
        <section className="status-panel">
          <p className="eyebrow">Видео не найдено</p>
          <h1>{requestedVideoId}</h1>
          <a className="playlist-link" href="#/">
            Вернуться к сетке
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <nav className="top-nav" aria-label="Навигация">
        <a href="#/">← Все видео</a>
        <a href={selectedVideo.youtubeUrl} target="_blank" rel="noreferrer">
          Смотреть на YouTube
        </a>
      </nav>

      <section className="watch-layout">
        <div className="player-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${selectedVideo.id}?rel=0&modestbranding=1`}
            title={selectedVideo.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>

        <aside className="watch-details">
          <p className="eyebrow">{playlist.title}</p>
          <h1>{selectedVideo.title}</h1>
          <p>
            {selectedVideo.author}
            {selectedVideo.publishedAt ? ` · ${formatDate(selectedVideo.publishedAt)}` : ''}
          </p>
        </aside>
      </section>
    </main>
  )
}

export default App
