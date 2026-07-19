import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DATA_URL = `${import.meta.env.BASE_URL}data/playlist.json`
const FAVORITES_STORAGE_KEY = 'rust-bases-favorites'
const FETCH_INTERVAL_MS = 30 * 60 * 1000
const SITE_TITLE = 'Base guides Rust'
const THEME_STORAGE_KEY = 'rust-bases-theme'
const PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLzzSo-3QjuUrdl5aArPofdMsjCzC5DAQd'

const TAG_RULES = [
  ['solo', /\bsolo\b/i],
  ['duo', /\bduo\b/i],
  ['2x2', /\b2\s*x\s*2\b/i],
  ['3x3', /\b3\s*x\s*3\b/i],
  ['starter', /starter|старт/i],
  ['bunker', /bunker|бункер/i],
  ['opencore', /opencore|опенкор/i],
  ['cheap', /cheap|деш/i],
  ['2025', /\b2025\b/],
  ['2026', /\b2026\b/],
]

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

function getInitialFavorites() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]')

    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === 'string')
    }
  } catch {
    return []
  }

  return []
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

function formatDateTime(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function getNextFetchAt(now) {
  return Math.ceil((now + 1) / FETCH_INTERVAL_MS) * FETCH_INTERVAL_MS
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getVideoTags(video) {
  const text = `${video.title} ${video.author}`

  return TAG_RULES.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag)
}

function sortVideos(videos, sortMode) {
  return [...videos].sort((firstVideo, secondVideo) => {
    if (sortMode === 'oldest') {
      return new Date(firstVideo.publishedAt) - new Date(secondVideo.publishedAt)
    }

    if (sortMode === 'title') {
      return firstVideo.title.localeCompare(secondVideo.title, 'ru')
    }

    return new Date(secondVideo.publishedAt) - new Date(firstVideo.publishedAt)
  })
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
    return <StatusView title="Loading playlist" theme={theme} onThemeToggle={toggleTheme} />
  }

  if (status === 'error') {
    return (
      <StatusView
        title="Playlist failed to load"
        detail={error || 'Check that data/playlist.json is available after build.'}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
    )
  }

  if (!playlist?.videos?.length) {
    return (
      <StatusView
        title="No videos in playlist"
        detail="Run playlist sync after updating the YouTube playlist."
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
  const [activeTag, setActiveTag] = useState('all')
  const [favorites, setFavorites] = useState(getInitialFavorites)
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('newest')
  const favoriteIds = useMemo(() => new Set(favorites), [favorites])
  const enrichedVideos = useMemo(
    () =>
      playlist.videos.map((video) => ({
        ...video,
        tags: getVideoTags(video),
      })),
    [playlist.videos],
  )
  const availableTags = useMemo(
    () => [...new Set(enrichedVideos.flatMap((video) => video.tags))].sort(),
    [enrichedVideos],
  )
  const visibleVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filteredVideos = enrichedVideos.filter((video) => {
      const matchesQuery =
        !normalizedQuery ||
        `${video.title} ${video.author}`.toLowerCase().includes(normalizedQuery)
      const matchesTag =
        activeTag === 'all' ||
        (activeTag === 'favorites' ? favoriteIds.has(video.id) : video.tags.includes(activeTag))

      return matchesQuery && matchesTag
    })

    return sortVideos(filteredVideos, sortMode)
  }, [activeTag, enrichedVideos, favoriteIds, query, sortMode])

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
    } catch {
      // Ignore storage errors; favorites still work for the current session.
    }
  }, [favorites])

  const toggleFavorite = (videoId) => {
    setFavorites((currentFavorites) =>
      currentFavorites.includes(videoId)
        ? currentFavorites.filter((favoriteId) => favoriteId !== videoId)
        : [...currentFavorites, videoId],
    )
  }

  return (
    <main className="shell">
      <Header playlist={playlist} theme={theme} onThemeToggle={onThemeToggle} />

      <PlaylistControls
        activeTag={activeTag}
        availableTags={availableTags}
        favoriteCount={favorites.length}
        query={query}
        resultCount={visibleVideos.length}
        setActiveTag={setActiveTag}
        setQuery={setQuery}
        setSortMode={setSortMode}
        sortMode={sortMode}
        totalCount={playlist.videos.length}
      />

      <section className="video-grid" aria-label="Playlist videos">
        {visibleVideos.map((video) => (
          <VideoCard
            favorite={favoriteIds.has(video.id)}
            key={video.id}
            onFavoriteToggle={toggleFavorite}
            video={video}
          />
        ))}
      </section>

      {!visibleVideos.length ? (
        <div className="empty-results">No videos match the current search and filters.</div>
      ) : null}
    </main>
  )
}

function PlaylistControls({
  activeTag,
  availableTags,
  favoriteCount,
  query,
  resultCount,
  setActiveTag,
  setQuery,
  setSortMode,
  sortMode,
  totalCount,
}) {
  return (
    <section className="playlist-controls" aria-label="Playlist controls">
      <div className="control-row">
        <label className="search-box">
          <span>Search</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title or author"
            type="search"
            value={query}
          />
        </label>

        <label className="sort-box">
          <span>Sort</span>
          <select onChange={(event) => setSortMode(event.target.value)} value={sortMode}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A-Z</option>
          </select>
        </label>
      </div>

      <div className="tag-list" aria-label="Tags">
        <FilterButton active={activeTag === 'all'} onClick={() => setActiveTag('all')}>
          All
        </FilterButton>
        <FilterButton
          active={activeTag === 'favorites'}
          disabled={favoriteCount === 0}
          onClick={() => setActiveTag('favorites')}
        >
          Favorites {favoriteCount}
        </FilterButton>
        {availableTags.map((tag) => (
          <FilterButton active={activeTag === tag} key={tag} onClick={() => setActiveTag(tag)}>
            {tag}
          </FilterButton>
        ))}
      </div>

      <p className="result-count">
        Showing {resultCount} of {totalCount}
      </p>
    </section>
  )
}

function FilterButton({ active, children, disabled = false, onClick }) {
  return (
    <button
      className={active ? 'filter-chip active' : 'filter-chip'}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function Header({ playlist, theme, onThemeToggle }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">YouTube playlist</p>
        <h1>{SITE_TITLE}</h1>
        <p className="subtitle">
          {playlist.videos.length} videos about Rust base design by {playlist.channel.name}
        </p>
        <FetchCountdown syncedAt={playlist.syncedAt} />
      </div>

      <div className="header-actions">
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        <a className="playlist-link" href={PLAYLIST_URL} target="_blank" rel="noreferrer">
          Open YouTube
        </a>
      </div>
    </header>
  )
}

function FetchCountdown({ syncedAt }) {
  const [now, setNow] = useState(() => Date.now())
  const nextFetchAt = getNextFetchAt(now)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="fetch-countdown" aria-live="polite">
      <span>Next fetch in about</span>
      <strong>{formatCountdown(nextFetchAt - now)}</strong>
      {syncedAt ? <span>Last sync: {formatDateTime(syncedAt)}</span> : null}
    </div>
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

function VideoCard({ favorite, onFavoriteToggle, video }) {
  return (
    <article className="video-card">
      <a className="video-card-link" href={`#/video/${encodeURIComponent(video.id)}`}>
        <span className="thumb-wrap">
          <img src={video.thumbnailUrl} alt="" loading="lazy" />
          <span className="play-badge" aria-hidden="true">
            Play
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

      <div className="card-actions">
        <div className="card-tags" aria-label="Video tags">
          {video.tags.length
            ? video.tags.map((tag) => <span key={tag}>{tag}</span>)
            : <span>untagged</span>}
        </div>
        <button
          className={favorite ? 'favorite-button active' : 'favorite-button'}
          onClick={() => onFavoriteToggle(video.id)}
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {favorite ? 'Saved' : 'Save'}
        </button>
      </div>
    </article>
  )
}

function VideoPage({ selectedVideo, requestedVideoId, theme, onThemeToggle }) {
  if (!selectedVideo) {
    return (
      <main className="shell status-shell">
        <section className="status-panel">
          <p className="eyebrow">Video not found</p>
          <h1>{requestedVideoId}</h1>
          <a className="playlist-link" href="#/">
            Back to grid
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <nav className="top-nav" aria-label="Navigation">
        <a href="#/">Back to videos</a>
        <div className="nav-actions">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <a href={selectedVideo.youtubeUrl} target="_blank" rel="noreferrer">
            Watch on YouTube
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
