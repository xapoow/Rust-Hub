import { useEffect, useMemo, useState } from 'react'
import './App.css'

const FAVORITES_STORAGE_KEY = 'rust-hub-favorites'
const FETCH_INTERVAL_MS = 30 * 60 * 1000
const MONUMENTS_URL = `${import.meta.env.BASE_URL}data/monuments.json`
const PLAYLIST_DATA_URL = `${import.meta.env.BASE_URL}data/playlist.json`
const SITE_TITLE = 'Rust Hub'
const THEME_STORAGE_KEY = 'rust-hub-theme'
const PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLzzSo-3QjuUrdl5aArPofdMsjCzC5DAQd'

const TAG_RULES = [
  ['соло', /\bsolo\b/i],
  ['дуо', /\bduo\b/i],
  ['2x2', /\b2\s*x\s*2\b/i],
  ['3x3', /\b3\s*x\s*3\b/i],
  ['стартерка', /starter|старт/i],
  ['бункер', /bunker|бункер/i],
  ['опенкор', /opencore|опенкор/i],
  ['бюджетно', /cheap|деш/i],
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
  const monumentMatch = hash.match(/^\/monuments\/([^/?#]+)/)

  if (videoMatch) {
    return { name: 'video', videoId: decodeURIComponent(videoMatch[1]) }
  }

  if (monumentMatch) {
    return { name: 'monument', monumentId: decodeURIComponent(monumentMatch[1]) }
  }

  if (hash === '/videos') {
    return { name: 'videos' }
  }

  if (hash === '/monuments') {
    return { name: 'monuments' }
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

function getVideoShareUrl(videoId) {
  return `${window.location.origin}${window.location.pathname}#/video/${encodeURIComponent(videoId)}`
}

function getMonumentShareUrl(monumentId) {
  return `${window.location.origin}${window.location.pathname}#/monuments/${encodeURIComponent(monumentId)}`
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.append(input)
  input.select()
  document.execCommand('copy')
  input.remove()
}

function App() {
  const [route, setRoute] = useState(getRoute)
  const [theme, setTheme] = useState(getInitialTheme)
  const [hubData, setHubData] = useState(null)
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

    async function loadHubData() {
      try {
        const cacheKey = Date.now()
        const [playlistResponse, monumentsResponse] = await Promise.all([
          fetch(`${PLAYLIST_DATA_URL}?v=${cacheKey}`, { cache: 'no-store' }),
          fetch(`${MONUMENTS_URL}?v=${cacheKey}`, { cache: 'no-store' }),
        ])

        if (!playlistResponse.ok) {
          throw new Error(`Ошибка загрузки плейлиста: ${playlistResponse.status}`)
        }

        if (!monumentsResponse.ok) {
          throw new Error(`Ошибка загрузки РТ: ${monumentsResponse.status}`)
        }

        const [playlist, monuments] = await Promise.all([
          playlistResponse.json(),
          monumentsResponse.json(),
        ])

        if (!ignore) {
          setHubData({ monuments, playlist })
          setStatus('ready')
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Неизвестная ошибка загрузки данных')
          setStatus('error')
        }
      }
    }

    loadHubData()

    return () => {
      ignore = true
    }
  }, [])

  const selectedVideo = useMemo(() => {
    if (!hubData?.playlist || route.name !== 'video') return null
    return hubData.playlist.videos.find((video) => video.id === route.videoId) ?? null
  }, [hubData, route])

  const selectedMonument = useMemo(() => {
    if (!hubData?.monuments || route.name !== 'monument') return null
    return hubData.monuments.monuments.find((monument) => monument.id === route.monumentId) ?? null
  }, [hubData, route])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  if (status === 'loading') {
    return <StatusView title="Загружаем Rust Hub" theme={theme} onThemeToggle={toggleTheme} />
  }

  if (status === 'error') {
    return (
      <StatusView
        title="Rust Hub не загрузился"
        detail={error || 'Проверьте, что data-файлы доступны после сборки.'}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
    )
  }

  if (!hubData?.playlist?.videos?.length) {
    return (
      <StatusView
        title="В плейлисте нет видео"
        detail="Запустите синхронизацию после обновления YouTube-плейлиста."
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

  if (route.name === 'monument') {
    return (
      <MonumentPage
        monument={selectedMonument}
        requestedMonumentId={route.monumentId}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
    )
  }

  return (
    <HomePage
      initialView={route.name === 'monuments' ? 'monuments' : 'videos'}
      monumentsData={hubData.monuments}
      playlist={hubData.playlist}
      theme={theme}
      onThemeToggle={toggleTheme}
    />
  )
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

function HomePage({ initialView, monumentsData, playlist, theme, onThemeToggle }) {
  const [activeView, setActiveView] = useState(initialView)

  useEffect(() => {
    setActiveView(initialView)
  }, [initialView])

  const showVideos = activeView === 'videos'

  return (
    <main className="shell">
      <Header
        activeView={activeView}
        monumentsData={monumentsData}
        playlist={playlist}
        setActiveView={setActiveView}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />

      {showVideos ? (
        <VideosHub playlist={playlist} />
      ) : (
        <MonumentsHub monumentsData={monumentsData} />
      )}
    </main>
  )
}

function Header({ activeView, monumentsData, playlist, setActiveView, theme, onThemeToggle }) {
  const goToView = (view) => {
    window.location.hash = view === 'videos' ? '#/videos' : '#/monuments'
    setActiveView(view)
  }

  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">Хаб по Rust</p>
        <h1>{SITE_TITLE}</h1>
        <p className="subtitle">
          Простой хаб с видео по базам, заметками по РТ и быстрыми справками.
        </p>
        <FetchCountdown syncedAt={playlist.syncedAt} />
      </div>

      <div className="header-actions">
        <div className="view-tabs" aria-label="Hub sections">
          <button
            className={activeView === 'videos' ? 'active' : ''}
            onClick={() => goToView('videos')}
            type="button"
          >
            Видео {playlist.videos.length}
          </button>
          <button
            className={activeView === 'monuments' ? 'active' : ''}
            onClick={() => goToView('monuments')}
            type="button"
          >
            РТ {monumentsData.monuments.length}
          </button>
        </div>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        <a className="playlist-link" href={PLAYLIST_URL} target="_blank" rel="noreferrer">
          Открыть YouTube
        </a>
      </div>
    </header>
  )
}

function VideosHub({ playlist }) {
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
    <>
      <FeedStatus playlist={playlist} />

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

      <section className="video-grid" aria-label="Видео плейлиста">
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
        <div className="empty-results">Под текущий поиск и фильтры видео не найдены.</div>
      ) : null}
    </>
  )
}

function MonumentsHub({ monumentsData }) {
  const [query, setQuery] = useState('')
  const visibleMonuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return monumentsData.monuments
    }

    return monumentsData.monuments.filter((monument) =>
      `${monument.name} ${monument.summary}`.toLowerCase().includes(normalizedQuery),
    )
  }, [monumentsData.monuments, query])

  return (
    <>
      <section className="playlist-controls monument-controls" aria-label="Поиск по РТ">
        <label className="search-box">
          <span>Поиск по РТ</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Космодром, Аэродром, Купол..."
            type="search"
            value={query}
          />
        </label>
        <p className="result-count">
          Показано {visibleMonuments.length} из {monumentsData.monuments.length}
        </p>
      </section>

      <section className="monument-grid" aria-label="РТ Rust">
        {visibleMonuments.map((monument) => (
          <MonumentCard key={monument.id} monument={monument} />
        ))}
      </section>

      {!visibleMonuments.length ? (
        <div className="empty-results">Под текущий поиск РТ не найдены.</div>
      ) : null}
    </>
  )
}

function MonumentCard({ monument }) {
  return (
    <a className="monument-card" href={`#/monuments/${encodeURIComponent(monument.id)}`}>
      <span className="monument-thumb">
        <img src={monument.imageUrl} alt="" loading="lazy" />
      </span>
      <span className="monument-tier">{monument.tier}</span>
      <strong>{monument.name}</strong>
      <span>{monument.summary}</span>
      <span className="monument-facts">
        Радиация: {monument.radiation} · Карты: {monument.cards.length ? monument.cards.join(', ') : 'Нет'} · Фьюз:{' '}
        {monument.requiresFuse ? 'Нужен' : 'Не нужен'}
      </span>
    </a>
  )
}

function MonumentPage({ monument, requestedMonumentId, theme, onThemeToggle }) {
  const [copied, setCopied] = useState(false)

  if (!monument) {
    return (
      <main className="shell status-shell">
        <section className="status-panel">
          <p className="eyebrow">РТ не найдена</p>
          <h1>{requestedMonumentId}</h1>
          <a className="playlist-link" href="#/monuments">
            Назад к РТ
          </a>
        </section>
      </main>
    )
  }

  const copyMonumentLink = async () => {
    await copyText(getMonumentShareUrl(monument.id))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <main className="shell">
      <nav className="top-nav" aria-label="Навигация">
        <a href="#/monuments">Назад к РТ</a>
        <div className="nav-actions">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <button className="copy-button" onClick={copyMonumentLink} type="button">
            {copied ? 'Скопировано' : 'Скопировать ссылку'}
          </button>
        </div>
      </nav>

      <section className="monument-detail">
        <div className="monument-hero-image">
          <img src={monument.imageUrl} alt="" />
        </div>
        <p className="eyebrow">{monument.tier}</p>
        <h1>{monument.name}</h1>
        <p>{monument.summary}</p>

        <div className="monument-stat-grid">
          <InfoStat label="Радиация" value={monument.radiation} />
          <InfoStat label="Карты" value={monument.cards.length ? monument.cards.join(', ') : 'Нет'} />
          <InfoStat label="Фьюз" value={monument.requiresFuse ? 'Нужен' : 'Не нужен'} />
          <InfoStat label="Переработчик" value={monument.hasRecycler ? 'Есть' : 'Нет'} />
        </div>

        <section className="tips-panel">
          <h2>Короткие заметки</h2>
          <ul>
            {monument.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  )
}

function InfoStat({ label, value }) {
  return (
    <div className="info-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FeedStatus({ playlist }) {
  const feedCount = playlist.counts?.feed ?? playlist.videos.length
  const manualCount = playlist.counts?.manual ?? 0
  const totalCount = playlist.counts?.total ?? playlist.videos.length

  return (
    <section className="feed-status" aria-label="Feed status">
      <div>
        <span>Последний sync</span>
        <strong>{formatDateTime(playlist.syncedAt)}</strong>
      </div>
      <div>
        <span>Видео в feed</span>
        <strong>{feedCount}</strong>
      </div>
      <div>
        <span>Ручной fallback</span>
        <strong>{manualCount}</strong>
      </div>
      <div>
        <span>Всего на сайте</span>
        <strong>{totalCount}</strong>
      </div>
      <p>
        Источник: <a href={playlist.sourceUrl} target="_blank" rel="noreferrer">YouTube XML feed</a>.
        YouTube может не отдавать приватные, ограниченные по возрасту, детские или недоступные видео.
      </p>
    </section>
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
    <section className="playlist-controls" aria-label="Управление плейлистом">
      <div className="control-row">
        <label className="search-box">
          <span>Поиск видео</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название или автор"
            type="search"
            value={query}
          />
        </label>

        <label className="sort-box">
          <span>Сортировка</span>
          <select onChange={(event) => setSortMode(event.target.value)} value={sortMode}>
            <option value="newest">Новые сначала</option>
            <option value="oldest">Старые сначала</option>
            <option value="title">По названию</option>
          </select>
        </label>
      </div>

      <div className="tag-list" aria-label="Теги">
        <FilterButton active={activeTag === 'all'} onClick={() => setActiveTag('all')}>
          Все
        </FilterButton>
        <FilterButton
          active={activeTag === 'favorites'}
          disabled={favoriteCount === 0}
          onClick={() => setActiveTag('favorites')}
        >
          Избранное {favoriteCount}
        </FilterButton>
        {availableTags.map((tag) => (
          <FilterButton active={activeTag === tag} key={tag} onClick={() => setActiveTag(tag)}>
            {tag}
          </FilterButton>
        ))}
      </div>

      <p className="result-count">
        Показано {resultCount} из {totalCount}
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

function FetchCountdown({ syncedAt }) {
  const [now, setNow] = useState(() => Date.now())
  const nextFetchAt = getNextFetchAt(now)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="fetch-countdown" aria-live="polite">
      <span>Следующий fetch видео примерно через</span>
      <strong>{formatCountdown(nextFetchAt - now)}</strong>
      {syncedAt ? <span>Последний sync: {formatDateTime(syncedAt)}</span> : null}
    </div>
  )
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Переключить тему"
      aria-pressed={theme === 'dark'}
      onClick={onToggle}
    >
      <span className={theme === 'light' ? 'active' : ''}>Светлая</span>
      <span className={theme === 'dark' ? 'active' : ''}>Темная</span>
    </button>
  )
}

function VideoCard({ favorite, onFavoriteToggle, video }) {
  const [copied, setCopied] = useState(false)

  const copyVideoLink = async () => {
    await copyText(getVideoShareUrl(video.id))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <article className="video-card">
      <a className="video-card-link" href={`#/video/${encodeURIComponent(video.id)}`}>
        <span className="thumb-wrap">
          <img src={video.thumbnailUrl} alt="" loading="lazy" />
          <span className="play-badge" aria-hidden="true">
            Смотреть
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
        <div className="card-tags" aria-label="Теги видео">
          {video.tags.length
            ? video.tags.map((tag) => <span key={tag}>{tag}</span>)
            : <span>без тегов</span>}
        </div>
        <button
          className={favorite ? 'favorite-button active' : 'favorite-button'}
          onClick={() => onFavoriteToggle(video.id)}
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
        >
          {favorite ? 'В избранном' : 'В избранное'}
        </button>
        <button className="copy-button" onClick={copyVideoLink} type="button">
          {copied ? 'Скопировано' : 'Скопировать'}
        </button>
      </div>
    </article>
  )
}

function VideoPage({ selectedVideo, requestedVideoId, theme, onThemeToggle }) {
  const [copied, setCopied] = useState(false)

  if (!selectedVideo) {
    return (
      <main className="shell status-shell">
        <section className="status-panel">
          <p className="eyebrow">Видео не найдено</p>
          <h1>{requestedVideoId}</h1>
          <a className="playlist-link" href="#/videos">
            Назад к видео
          </a>
        </section>
      </main>
    )
  }

  const copyCurrentVideoLink = async () => {
    await copyText(getVideoShareUrl(selectedVideo.id))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <main className="shell">
      <nav className="top-nav" aria-label="Навигация">
        <a href="#/videos">Назад к видео</a>
        <div className="nav-actions">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <button className="copy-button" onClick={copyCurrentVideoLink} type="button">
            {copied ? 'Скопировано' : 'Скопировать ссылку'}
          </button>
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
