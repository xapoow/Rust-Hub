import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Play, Star } from 'lucide-react'
import './App.css'

const FAVORITES_STORAGE_KEY = 'rust-hub-favorites'
const FETCH_INTERVAL_MS = 30 * 60 * 1000
const MONUMENTS_URL = `${import.meta.env.BASE_URL}data/monuments.json`
const PLAYLIST_DATA_URL = `${import.meta.env.BASE_URL}data/playlist.json`
const RAID_DATA_URL = `${import.meta.env.BASE_URL}data/raid.json`
const RAID_TARGETS_URL = `${import.meta.env.BASE_URL}data/raid-targets.json`
const SITE_TITLE = 'Rust Hub'
const THEME_STORAGE_KEY = 'rust-hub-theme'
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

  if (hash === '/raid-calculator') {
    return { name: 'raid' }
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

function getRadiationLevel(radiation) {
  if (radiation === 'Высокая') return 'high'
  if (radiation === 'Средняя') return 'medium'
  return 'low'
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
        const [playlistResponse, monumentsResponse, raidResponse, raidTargetsResponse] = await Promise.all([
          fetch(`${PLAYLIST_DATA_URL}?v=${cacheKey}`, { cache: 'no-store' }),
          fetch(`${MONUMENTS_URL}?v=${cacheKey}`, { cache: 'no-store' }),
          fetch(`${RAID_DATA_URL}?v=${cacheKey}`, { cache: 'no-store' }),
          fetch(`${RAID_TARGETS_URL}?v=${cacheKey}`, { cache: 'no-store' }),
        ])

        if (!playlistResponse.ok) {
          throw new Error(`Ошибка загрузки плейлиста: ${playlistResponse.status}`)
        }

        if (!monumentsResponse.ok) {
          throw new Error(`Ошибка загрузки РТ: ${monumentsResponse.status}`)
        }

        if (!raidResponse.ok) {
          throw new Error(`Ошибка загрузки калькулятора рейда: ${raidResponse.status}`)
        }

        if (!raidTargetsResponse.ok) {
          throw new Error(`Ошибка загрузки целей рейда: ${raidTargetsResponse.status}`)
        }

        const [playlist, monuments, raid, raidTargets] = await Promise.all([
          playlistResponse.json(),
          monumentsResponse.json(),
          raidResponse.json(),
          raidTargetsResponse.json(),
        ])

        if (!ignore) {
          setHubData({
            monuments,
            playlist,
            raid: { ...raid, ...raidTargets },
          })
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
      initialView={route.name === 'monuments' ? 'monuments' : route.name === 'raid' ? 'raid' : 'videos'}
      monumentsData={hubData.monuments}
      playlist={hubData.playlist}
      raidData={hubData.raid}
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

function HomePage({ initialView, monumentsData, playlist, raidData, theme, onThemeToggle }) {
  const [activeView, setActiveView] = useState(initialView)

  useEffect(() => {
    setActiveView(initialView)
  }, [initialView])

  return (
    <main className="shell">
      <Header
        activeView={activeView}
        monumentsData={monumentsData}
        playlist={playlist}
        raidData={raidData}
        setActiveView={setActiveView}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />

      {activeView === 'videos' ? <VideosHub playlist={playlist} /> : null}
      {activeView === 'monuments' ? <MonumentsHub monumentsData={monumentsData} /> : null}
      {activeView === 'raid' ? <RaidCalculator raidData={raidData} /> : null}
    </main>
  )
}

function Header({ activeView, monumentsData, playlist, raidData, setActiveView, theme, onThemeToggle }) {
  const goToView = (view) => {
    const routes = {
      monuments: '#/monuments',
      raid: '#/raid-calculator',
      videos: '#/videos',
    }

    window.location.hash = routes[view]
    setActiveView(view)
  }

  return (
    <header className="page-header">
      <div className="header-primary">
        <div className="header-brand">
          <div className="header-title-row">
            <h1>{SITE_TITLE}</h1>
            <span>Хаб по Rust</span>
          </div>
          <p className="subtitle">
            Видео по базам, заметки по РТ и быстрый расчёт рейда.
          </p>
        </div>

        <div className="header-controls">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <nav className="view-tabs" aria-label="Разделы Rust Hub">
            <button
              className={activeView === 'videos' ? 'active' : ''}
              onClick={() => goToView('videos')}
              type="button"
            >
              <span>Видео</span>
              <strong>{playlist.videos.length}</strong>
            </button>
            <button
              className={activeView === 'monuments' ? 'active' : ''}
              onClick={() => goToView('monuments')}
              type="button"
            >
              <span>РТ</span>
              <strong>{monumentsData.monuments.length}</strong>
            </button>
            <button
              className={activeView === 'raid' ? 'active' : ''}
              onClick={() => goToView('raid')}
              type="button"
            >
              <span>Рейд</span>
              <strong>{raidData.targets.length}</strong>
            </button>
          </nav>
        </div>
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
            placeholder="Космодром, Очистные сооружения, Сфера..."
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
  const radiationLevel = getRadiationLevel(monument.radiation)

  return (
    <a
      className={`monument-card radiation-${radiationLevel}`}
      href={`#/monuments/${encodeURIComponent(monument.id)}`}
    >
      <MediaSlot className="monument-thumb" label={monument.name} src={monument.imageUrl} />
      <div className="monument-labels">
        <span className="monument-tier">{monument.tier}</span>
        <span className="radiation-badge">
          <span aria-hidden="true" />
          Радиация: {monument.radiation}
        </span>
      </div>
      <strong>{monument.name}</strong>
      <span>{monument.summary}</span>
      <span className="monument-facts">
        Карты: {monument.cards.length ? monument.cards.join(', ') : 'Нет'} · Фьюз:{' '}
        {monument.requiresFuse ? 'Нужен' : 'Не нужен'} · Дизель:{' '}
        {monument.dieselCount ? `${monument.dieselCount} шт.` : 'Нет'}
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

  const radiationLevel = getRadiationLevel(monument.radiation)

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

      <section className={`monument-detail radiation-${radiationLevel}`}>
        <MediaSlot className="monument-hero-image" label={monument.name} src={monument.imageUrl} />
        <div className="monument-labels">
          <span className="monument-tier">{monument.tier}</span>
          <span className="radiation-badge">
            <span aria-hidden="true" />
            Радиация: {monument.radiation}
          </span>
        </div>
        <h1>{monument.name}</h1>
        <p>{monument.summary}</p>

        <div className="monument-stat-grid">
          <InfoStat label="Радиация" value={monument.radiation} />
          <InfoStat label="Карты" value={monument.cards.length ? monument.cards.join(', ') : 'Нет'} />
          <InfoStat label="Фьюз" value={monument.requiresFuse ? 'Нужен' : 'Не нужен'} />
          <InfoStat label="Переработчик" value={monument.hasRecycler ? 'Есть' : 'Нет'} />
          <InfoStat
            label="Дизель"
            value={monument.dieselCount ? `${monument.dieselCount} шт.` : 'Нет'}
          />
        </div>
      </section>
    </main>
  )
}

function RaidCalculator({ raidData }) {
  const [copied, setCopied] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [targetGroup, setTargetGroup] = useState('all')
  const [targetQuery, setTargetQuery] = useState('')
  const [selectedTargetId, setSelectedTargetId] = useState(raidData.targets[0]?.id ?? '')
  const targets = useMemo(
    () =>
      raidData.targets.map((target) => ({
        ...target,
        costs: target.costs ?? raidData.costProfiles?.[target.costProfile] ?? {},
      })),
    [raidData.costProfiles, raidData.targets],
  )
  const targetGroups = useMemo(
    () => [...new Set(targets.map((target) => target.group))],
    [targets],
  )
  const visibleTargets = useMemo(() => {
    const normalizedQuery = targetQuery.trim().toLocaleLowerCase('ru-RU')

    return targets.filter((target) => {
      const matchesGroup = targetGroup === 'all' || target.group === targetGroup
      const searchableText = `${target.name} ${target.category} ${target.group}`.toLocaleLowerCase('ru-RU')

      return matchesGroup && (!normalizedQuery || searchableText.includes(normalizedQuery))
    })
  }, [targetGroup, targetQuery, targets])

  useEffect(() => {
    if (
      visibleTargets.length > 0 &&
      !visibleTargets.some((target) => target.id === selectedTargetId)
    ) {
      setSelectedTargetId(visibleTargets[0].id)
    }
  }, [selectedTargetId, visibleTargets])

  const selectedTarget =
    targets.find((target) => target.id === selectedTargetId) ?? targets[0]
  const numberFormat = useMemo(() => new Intl.NumberFormat('ru-RU'), [])

  if (!selectedTarget) {
    return <div className="empty-results">В справочнике пока нет целей для рейда.</div>
  }

  const normalizedQuantity = Math.min(100, Math.max(1, Number(quantity) || 1))
  const results = raidData.methods.map((method) => {
    const amount = Math.ceil((selectedTarget.costs[method.id] ?? 0) * normalizedQuantity)
    const craftCount = Math.ceil(amount / (method.yield ?? 1))
    const craftedAmount = craftCount * (method.yield ?? 1)

    return {
      ...method,
      amount,
      craftedAmount,
      steps: method.craftSteps.map((step) => ({
        ...step,
        amount: step.amount * craftCount,
        ingredients: Object.entries(step.ingredients).map(([resourceId, resourceAmount]) => ({
          ...raidData.resources[resourceId],
          amount: resourceAmount * craftCount,
          id: resourceId,
        })),
        outputResource:
          step.output === 'result'
            ? { imageUrl: method.imageUrl, name: method.name }
            : raidData.resources[step.output],
      })),
      totals: Object.entries(method.totalResources).map(([resourceId, resourceAmount]) => ({
        ...raidData.resources[resourceId],
        amount: resourceAmount * craftCount,
        id: resourceId,
      })),
    }
  })

  const copyCalculation = async () => {
    const lines = results.map((result) => {
      const resources = result.totals
        .map((resource) => `${resource.name}: ${numberFormat.format(resource.amount)}`)
        .join(', ')

      return `${result.name}: ${result.amount} шт. — ${resources}`
    })

    await copyText(
      `${selectedTarget.name}, ${normalizedQuantity} шт.\n${lines.join('\n')}\n${window.location.href}`,
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <section className="raid-calculator" aria-labelledby="raid-title">
      <div className="raid-heading">
        <div>
          <p className="eyebrow">Быстрый расчёт ресурсов</p>
          <h2 id="raid-title">Калькулятор рейда</h2>
          <p>Выберите цель и количество. Ниже появятся варианты рейда и стоимость крафта.</p>
        </div>
        <label className="quantity-control">
          <span>Количество целей</span>
          <input
            inputMode="numeric"
            max="100"
            min="1"
            onChange={(event) => setQuantity(event.target.value)}
            onBlur={() => setQuantity(normalizedQuantity)}
            type="number"
            value={quantity}
          />
        </label>
      </div>

      <div className="raid-layout">
        <section className="raid-target-panel" aria-labelledby="target-title">
          <div className="raid-target-panel-heading">
            <h3 id="target-title">Что рейдим</h3>
            <span>{visibleTargets.length} из {targets.length}</span>
          </div>
          <div className="raid-target-controls">
            <label>
              <span>Поиск цели</span>
              <input
                onChange={(event) => setTargetQuery(event.target.value)}
                placeholder="Стена, дверь, окно..."
                type="search"
                value={targetQuery}
              />
            </label>
            <label>
              <span>Категория</span>
              <select onChange={(event) => setTargetGroup(event.target.value)} value={targetGroup}>
                <option value="all">Все категории</option>
                {targetGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="raid-target-list">
            {visibleTargets.map((target) => (
              <button
                aria-pressed={target.id === selectedTarget.id}
                className={`raid-target ${target.id === selectedTarget.id ? 'active' : ''}`}
                key={target.id}
                onClick={() => setSelectedTargetId(target.id)}
                type="button"
              >
                <MediaSlot className="raid-target-media" label={target.shortLabel} src={target.imageUrl} />
                <span>
                  <strong>{target.name}</strong>
                  <small>{target.category}</small>
                </span>
              </button>
            ))}
            {visibleTargets.length === 0 ? (
              <p className="raid-target-empty">По этому запросу целей нет.</p>
            ) : null}
          </div>
        </section>

        <section className="raid-results" aria-labelledby="result-title">
          <div className="raid-result-header">
            <div>
              <span>Расчёт для</span>
              <h3 id="result-title">
                {selectedTarget.name} × {normalizedQuantity}
              </h3>
            </div>
            <button className="copy-button" onClick={copyCalculation} type="button">
              {copied ? 'Скопировано' : 'Скопировать расчёт'}
            </button>
          </div>

          <div className="raid-method-list">
            {results.map((result) => (
              <article className="raid-method" key={result.id}>
                <div className="raid-method-summary">
                  <MediaSlot className="raid-method-media" label={result.shortLabel} src={result.imageUrl} />
                  <div className="raid-method-name">
                    <strong>{result.name}</strong>
                    <span>{result.amount} шт.</span>
                    {result.craftedAmount > result.amount ? (
                      <small>Крафт пачками: получится {result.craftedAmount} шт.</small>
                    ) : null}
                  </div>
                </div>

                <ol className="raid-craft-chain" aria-label={`Цепочка крафта: ${result.name}`}>
                  {result.steps.map((step, stepIndex) => (
                    <li key={`${result.id}-${step.output}-${stepIndex}`}>
                      <div className="raid-step-ingredients">
                        {step.ingredients.map((resource) => (
                          <ResourceAmount
                            amount={resource.amount}
                            key={resource.id}
                            numberFormat={numberFormat}
                            resource={resource}
                          />
                        ))}
                      </div>
                      <span className="raid-step-arrow" aria-hidden="true">→</span>
                      <ResourceAmount
                        amount={step.amount}
                        numberFormat={numberFormat}
                        resource={step.outputResource}
                        result
                      />
                    </li>
                  ))}
                </ol>

                <div className="raid-resource-total">
                  <span>Итого ресурсов</span>
                  <div>
                    {result.totals.map((resource) => (
                      <ResourceAmount
                        amount={resource.amount}
                        key={resource.id}
                        numberFormat={numberFormat}
                        resource={resource}
                      />
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="raid-disclaimer">
            Значения ориентировочные для твёрдой стороны построек. После обновлений баланса Rust
            сверяйте цифры с актуальными игровыми данными.
          </p>
        </section>
      </div>
    </section>
  )
}

function ResourceAmount({ amount, numberFormat, resource, result = false }) {
  return (
    <span className={`resource-amount ${result ? 'is-result' : ''}`}>
      <ResourceIcon resource={resource} />
      <span>
        <small>{resource.name}</small>
        <strong>{numberFormat.format(amount)}</strong>
      </span>
    </span>
  )
}

function ResourceIcon({ resource }) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [resource.imageUrl])

  if (hasError || !resource.imageUrl) {
    return <span className="resource-icon is-placeholder" aria-hidden="true">{resource.name.slice(0, 1)}</span>
  }

  return (
    <span className="resource-icon">
      <img alt="" onError={() => setHasError(true)} src={resource.imageUrl} />
    </span>
  )
}

function MediaSlot({ className, label, src }) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  const relativePath = src?.replace(/^\.\/media\//, '')

  return (
    <div className={`${className} media-slot ${hasError || !src ? 'is-placeholder' : ''}`}>
      {!hasError && src ? (
        <img alt="" loading="lazy" onError={() => setHasError(true)} src={src} />
      ) : (
        <span className="media-placeholder" aria-label={`Место для изображения: ${label}`}>
          <strong>{label}</strong>
          <small>{relativePath || 'Добавьте изображение в public/media'}</small>
        </span>
      )}
    </div>
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
        <span>Последнее обновление</span>
        <strong>{formatDateTime(playlist.syncedAt)}</strong>
      </div>
      <FetchCountdown />
      <div>
        <span>Видео из YouTube</span>
        <strong>{feedCount}</strong>
      </div>
      <div>
        <span>Добавлено вручную</span>
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

function FetchCountdown() {
  const [now, setNow] = useState(() => Date.now())
  const nextFetchAt = getNextFetchAt(now)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="fetch-countdown" aria-live="polite">
      <span>Следующее обновление</span>
      <strong>{formatCountdown(nextFetchAt - now)}</strong>
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
            <Play fill="currentColor" size={22} strokeWidth={2} />
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
        <div className="card-icon-actions">
          <button
            className={`icon-button favorite-button ${favorite ? 'active' : ''}`}
            onClick={() => onFavoriteToggle(video.id)}
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            title={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          >
            <Star aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} size={18} />
          </button>
          <button
            className="icon-button copy-button"
            onClick={copyVideoLink}
            type="button"
            aria-label={copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
            title={copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
          >
            {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
          </button>
        </div>
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
