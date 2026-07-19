import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { XMLParser } from 'fast-xml-parser'

const PLAYLIST_ID = 'PLzzSo-3QjuUrdl5aArPofdMsjCzC5DAQd'
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(rootDir, 'public', 'data', 'playlist.json')

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function getThumbnail(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

const response = await fetch(FEED_URL)

if (!response.ok) {
  throw new Error(`YouTube feed request failed: ${response.status} ${response.statusText}`)
}

const xml = await response.text()
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
})
const parsed = parser.parse(xml)
const feed = parsed.feed

if (!feed) {
  throw new Error('YouTube feed response did not contain a feed node')
}

const videos = asArray(feed.entry)
  .map((entry) => {
    const id = entry.videoId

    if (!id) return null

    return {
      id,
      title: entry.title ?? 'Untitled video',
      author: entry.author?.name ?? '',
      publishedAt: entry.published ?? '',
      thumbnailUrl: entry.group?.thumbnail?.url ?? getThumbnail(id),
      youtubeUrl: `https://www.youtube.com/watch?v=${id}&list=${PLAYLIST_ID}`,
    }
  })
  .filter(Boolean)

const playlist = {
  id: PLAYLIST_ID,
  title: feed.title ?? 'YouTube playlist',
  channel: {
    id: feed.channelId ?? '',
    name: feed.author?.name ?? '',
    url: feed.author?.uri ?? '',
  },
  syncedAt: new Date().toISOString(),
  sourceUrl: FEED_URL,
  videos,
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(`${outputPath}.tmp`, `${JSON.stringify(playlist, null, 2)}\n`)
await rename(`${outputPath}.tmp`, outputPath)

console.log(`Synced ${videos.length} videos from "${playlist.title}" to ${path.relative(rootDir, outputPath)}`)
