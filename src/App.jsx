import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DATA_URL = `${import.meta.env.BASE_URL}data/playlist.json`
const SITE_TITLE = 'Base guides Rust'
const THEME_STORAGE_KEY = 'rust-bases-theme'
const PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLzzSo-3QjuUrdl5aArPofdMsjCzC5DAQd'

function getInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }
  } catch {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

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
  const [theme, setTheme] = useState(getInitialTheme)
  const [playlist, setPlaylist] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage errors; theme still works for the current session.
    }
  }, [theme])

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

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  if (status === 'loading') {
    return <StatusView title="Загружаем плейлист" theme={theme} onThemeToggle={toggleTheme} />
  }

  if (status === 'error') {
    return (
      <StatusView
        title="Плейлист не загрузился"
        detail={error || 'Проверьте, что data/playlist.json доступен после сборки.'}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
    )
  }

  if (!playlist?.videos?.length) {
    return (
      <StatusView
        title="В плейлисте нет видео"
        detail="После обновления YouTube-плейлиста запустите синхронизацию данных."
        theme={theme}
        onThemeToggle={toggleTheme}
      />
    )
  }

  if (route.name === 'video') {
    return (
      <VideoPage
        selectedVideo={selectedVideo}
        requestedVideoId={route.videoId}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
    )
  }

  return <HomePage playlist={playlist} theme={theme} onThemeToggle={toggleTheme} />
}

function StatusView({ title, detail, theme, onThemeToggle }) {
  return (
    <main className="shell status-shell">
      <section className="status-panel" aria-live="polite">
        <p className="eyebrow">{SITE_TITLE}</p>
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </section>
    </main>
  )
}

function HomePage({ playlist, theme, onThemeToggle }) {
  return (
    <main className="shell">
      <Header playlist={playlist} theme={theme} onThemeToggle={onThemeToggle} />

      <section className="video-grid" aria-label="Видео плейлиста">
        {playlist.videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </section>
    </main>
  )
}

function Header({ playlist, theme, onThemeToggle }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">YouTube playlist</p>
        <h1>{SITE_TITLE}</h1>
        <p className="subtitle">
          {playlist.videos.length} видео по Rust base design от {playlist.channel.name}
        </p>
      </div>

      <div className="header-actions">
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        <a className="playlist-link" href={PLAYLIST_URL} target="_blank" rel="noreferrer">
          Открыть YouTube
        </a>
      </div>
    </header>
  )
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Switch color theme"
      aria-pressed={theme === 'dark'}
      onClick={onToggle}
    >
      <span className={theme === 'light' ? 'active' : ''}>Light</span>
      <span className={theme === 'dark' ? 'active' : ''}>Dark</span>
    </button>
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

function VideoPage({ selectedVideo, requestedVideoId, theme, onThemeToggle }) {
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
        <div className="nav-actions">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <a href={selectedVideo.youtubeUrl} target="_blank" rel="noreferrer">
            Смотреть на YouTube
          </a>
        </div>
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
          <p className="eyebrow">{SITE_TITLE}</p>
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
