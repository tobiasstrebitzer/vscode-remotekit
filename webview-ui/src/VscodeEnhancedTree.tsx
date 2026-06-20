import { type KeyboardEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DirectoryEntry } from '@shared/protocol'
import { setiFileIcon } from './seti'

export interface TreeRow {
  entry: DirectoryEntry
  level: number
  expanded: boolean
}

interface Props {
  rows: TreeRow[]
  loaded: boolean
  selected: string | null
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  onActivate: (entry: DirectoryEntry) => void
  onDropFiles: (targetIndex: number, files: File[]) => void
}

const ROW_HEIGHT = 22
const OVERSCAN = 8

export function dropDirIndex(rows: TreeRow[], hover: number): number {
  if (hover < 0 || hover >= rows.length) {
    return -1
  }
  const row = rows[hover]
  if (row.entry.isDirectory) {
    return hover
  }
  for (let above = hover - 1; above >= 0; above--) {
    if (rows[above].level < row.level && rows[above].entry.isDirectory) {
      return above
    }
  }
  return -1
}

export function VscodeEnhancedTree({ rows, loaded, selected, onSelect, onToggle, onActivate, onDropFiles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(0)
  const [focused, setFocused] = useState(false)
  const [dropDir, setDropDir] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    setViewport(el.clientHeight)
    const observer = new ResizeObserver(() => setViewport(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || selected === null) {
      return
    }
    const index = rows.findIndex(row => row.entry.path === selected)
    if (index < 0) {
      return
    }
    const top = index * ROW_HEIGHT
    if (top < el.scrollTop) {
      el.scrollTop = top
    } else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) {
      el.scrollTop = top + ROW_HEIGHT - el.clientHeight
    }
  }, [selected, rows])

  const move = useCallback((delta: number) => {
    const index = rows.findIndex(row => row.entry.path === selected)
    const next = index < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, index + delta))
    if (rows[next]) {
      onSelect(rows[next].entry.path)
    }
  }, [rows, selected, onSelect])

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (rows.length === 0) {
      return
    }
    const index = rows.findIndex(row => row.entry.path === selected)
    const row = index >= 0 ? rows[index] : null
    switch (event.key) {
      case 'ArrowDown':
        move(1)
        event.preventDefault()
        break
      case 'ArrowUp':
        move(-1)
        event.preventDefault()
        break
      case 'ArrowRight':
        if (row && row.entry.isDirectory && !row.expanded) {
          onToggle(row.entry.path)
        } else {
          move(1)
        }
        event.preventDefault()
        break
      case 'ArrowLeft':
        if (row && row.entry.isDirectory && row.expanded) {
          onToggle(row.entry.path)
        } else {
          move(-1)
        }
        event.preventDefault()
        break
      case 'Enter':
        if (row) {
          onActivate(row.entry)
        }
        event.preventDefault()
        break
    }
  }, [rows, selected, move, onToggle, onActivate])

  useEffect(() => {
    const hoverDir = (target: EventTarget | null): number => {
      const node = target instanceof HTMLElement ? target.closest('.tree-row') : null
      const hover = node instanceof HTMLElement && node.dataset.index !== undefined ? Number(node.dataset.index) : -1
      return dropDirIndex(rows, hover)
    }
    const onDragOver = (event: DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
      setDropDir(hoverDir(event.target))
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      const target = hoverDir(event.target)
      setDropDir(null)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length > 0) {
        onDropFiles(target, files)
      }
    }
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) {
        setDropDir(null)
      }
    }
    window.addEventListener('dragenter', onDragOver, true)
    window.addEventListener('dragover', onDragOver, true)
    window.addEventListener('drop', onDrop, true)
    window.addEventListener('dragleave', onDragLeave, true)
    return () => {
      window.removeEventListener('dragenter', onDragOver, true)
      window.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('drop', onDrop, true)
      window.removeEventListener('dragleave', onDragLeave, true)
    }
  }, [rows, onDropFiles])

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN)

  let regionStart = -1
  let regionEnd = -1
  if (dropDir !== null && dropDir >= 0 && rows[dropDir]) {
    regionStart = dropDir
    regionEnd = dropDir
    const level = rows[dropDir].level
    while (regionEnd + 1 < rows.length && rows[regionEnd + 1].level > level) {
      regionEnd++
    }
  }

  let className = focused ? 'tree focused' : 'tree'
  if (dropDir === -1) {
    className += ' drop-root'
  }

  return (
    <div
      ref={containerRef}
      className={className}
      tabIndex={0}
      role="tree"
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {rows.length === 0
        ? (loaded ? <div className="tree-empty">Empty folder</div> : null)
        : (
          <div className="tree-spacer" style={{ height: rows.length * ROW_HEIGHT }}>
            {rows.slice(start, end).map((row, offset) => {
              const index = start + offset
              return (
                <Row
                  key={row.entry.path}
                  row={row}
                  index={index}
                  top={index * ROW_HEIGHT}
                  selected={row.entry.path === selected}
                  dropTarget={index >= regionStart && index <= regionEnd}
                  dropFolder={index === regionStart}
                  onSelect={() => {
                    containerRef.current?.focus()
                    onSelect(row.entry.path)
                  }}
                  onActivate={() => onActivate(row.entry)}
                  onToggle={() => onToggle(row.entry.path)}
                />
              )
            })}
          </div>
        )}
    </div>
  )
}

interface RowProps {
  row: TreeRow
  index: number
  top: number
  selected: boolean
  dropTarget: boolean
  dropFolder: boolean
  onSelect: () => void
  onActivate: () => void
  onToggle: () => void
}

function Row({ row, index, top, selected, dropTarget, dropFolder, onSelect, onActivate, onToggle }: RowProps) {
  const { entry, level, expanded } = row
  const isDirectory = entry.isDirectory
  const fileIcon = isDirectory ? null : setiFileIcon(entry.name)
  const twistieClass = isDirectory
    ? 'tree-twistie collapsible ' + (expanded ? 'expanded' : 'collapsed')
    : 'tree-twistie'
  let rowClass = 'tree-row'
  if (selected) {
    rowClass += ' selected'
  }
  if (dropTarget) {
    rowClass += ' drop-target'
  }
  if (dropFolder) {
    rowClass += ' drop-folder'
  }
  return (
    <div
      className={rowClass}
      style={{ top }}
      data-index={index}
      role="treeitem"
      aria-level={level}
      aria-expanded={isDirectory ? expanded : undefined}
      title={entry.path}
      data-vscode-context={isDirectory
        ? JSON.stringify({ webviewSection: 'remotekit.folder', path: entry.path, preventDefaultContextMenuItems: true })
        : undefined}
      onMouseDown={onSelect}
      onClick={onActivate}
    >
      <div className="tree-indent" style={{ width: (level - 1) * 8 }}>
        {Array.from({ length: level - 1 }, (_, depth) => (
          <div key={depth} className="indent-guide" style={{ width: 8 }} />
        ))}
      </div>
      <div
        className={twistieClass}
        style={{ paddingLeft: level * 8 }}
        onClick={isDirectory ? (event => { event.stopPropagation(); onToggle() }) : undefined}
      />
      <div className="tree-contents">
        <span className={isDirectory ? 'tree-icon-label folder-icon' : 'tree-icon-label file-icon'}>
          {fileIcon && <span className="seti-icon tree-file-icon" style={{ color: fileIcon.color }}>{fileIcon.c}</span>}
          <span className="tree-label">{entry.name}</span>
        </span>
      </div>
    </div>
  )
}
