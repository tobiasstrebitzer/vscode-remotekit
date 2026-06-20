import type { DirectoryEntry, ViewMode } from '@shared/protocol'
import { renderThumbnail } from './renderers'

interface Props {
  entries: DirectoryEntry[]
  loaded: boolean
  mode: Exclude<ViewMode, 'tree'>
  onActivate: (entry: DirectoryEntry) => void
}

const columns: Record<Props['mode'], number> = {
  small: 4,
  medium: 2,
  large: 1
}

export function Gallery({ entries, loaded, mode, onActivate }: Props) {
  if (entries.length === 0) {
    return loaded ? <div className="tree-empty">Empty folder</div> : null
  }
  return (
    <div className="gallery" style={{ gridTemplateColumns: `repeat(${columns[mode]}, minmax(0, 1fr))` }}>
      {entries.map(entry => (
        <div
          key={entry.path}
          className="thumb"
          title={entry.path}
          data-vscode-context={entry.isDirectory
            ? JSON.stringify({ webviewSection: 'remotekit.folder', path: entry.path, preventDefaultContextMenuItems: true })
            : undefined}
          onClick={() => onActivate(entry)}
        >
          <div className="thumb-surface">{renderThumbnail(entry)}</div>
          <div className="thumb-name">{entry.name}</div>
        </div>
      ))}
    </div>
  )
}
