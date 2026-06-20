import type { ReactNode } from 'react'
import type { DirectoryEntry } from '@shared/protocol'
import { setiFileIcon } from './seti'

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function ImageThumbnail({ entry }: { entry: DirectoryEntry }) {
  return <img className="thumb-media" src={entry.uri} alt={entry.name} loading="lazy" draggable={false} />
}

export function renderThumbnail(entry: DirectoryEntry): ReactNode {
  if (entry.isDirectory) {
    return <span className="thumb-glyph codicon codicon-folder" />
  }
  if (entry.uri && imageExtensions.has(extensionOf(entry.name))) {
    return <ImageThumbnail entry={entry} />
  }
  const icon = setiFileIcon(entry.name)
  return <span className="thumb-glyph seti-icon" style={{ color: icon.color }}>{icon.c}</span>
}
