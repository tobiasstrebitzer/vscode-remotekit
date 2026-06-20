import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DirectoryEntry, HostToWebview, PathSegment, ViewMode } from '@shared/protocol'
import { vscode } from './vscode'
import { Breadcrumb } from './Breadcrumb'
import { VscodeEnhancedTree, dropDirIndex, type TreeRow } from './VscodeEnhancedTree'
import { Gallery } from './Gallery'
import { UploadHint } from './UploadHint'
import { pastedName, readUploadFiles } from './upload'

export function App() {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [segments, setSegments] = useState<PathSegment[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [cache, setCache] = useState<Map<string, DirectoryEntry[]>>(new Map())
  const [selected, setSelected] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [hintDismissed, setHintDismissed] = useState(true)

  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  const requested = useRef<Set<string>>(new Set())

  const requestDir = useCallback((path: string) => {
    requested.current.add(path)
    vscode.postMessage({ type: 'readDir', path })
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebview>) => {
      const message = event.data
      if (message.type === 'root') {
        setRootPath(message.root)
        setSegments(message.segments)
        setCache(new Map())
        requested.current = new Set()
        if (!message.preserveExpanded) {
          setExpanded(new Set())
          setSelected(null)
        }
        requestDir(message.root)
        if (message.preserveExpanded) {
          for (const path of expandedRef.current) {
            requestDir(path)
          }
        }
      } else if (message.type === 'dir') {
        setCache(prev => {
          const next = new Map(prev)
          next.set(message.path, message.entries)
          return next
        })
      } else if (message.type === 'hint') {
        setHintDismissed(message.dismissed)
      } else if (message.type === 'viewMode') {
        setViewMode(message.mode)
      }
    }
    window.addEventListener('message', onMessage)
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [requestDir])

  const rows = useMemo<TreeRow[]>(() => {
    if (!rootPath) {
      return []
    }
    const root = cache.get(rootPath)
    if (!root) {
      return []
    }
    const out: TreeRow[] = []
    const walk = (entries: DirectoryEntry[], level: number) => {
      for (const entry of entries) {
        const isExpanded = entry.isDirectory && expanded.has(entry.path)
        out.push({ entry, level, expanded: isExpanded })
        if (isExpanded) {
          const children = cache.get(entry.path)
          if (children) {
            walk(children, level + 1)
          }
        }
      }
    }
    walk(root, 1)
    return out
  }, [rootPath, cache, expanded])

  const onToggle = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
        if (!cache.has(path) && !requested.current.has(path)) {
          requestDir(path)
        }
      }
      return next
    })
  }, [cache, requestDir])

  const onActivate = useCallback((entry: DirectoryEntry) => {
    setSelected(entry.path)
    if (entry.isDirectory) {
      onToggle(entry.path)
    } else {
      vscode.postMessage({ type: 'open', path: entry.path })
    }
  }, [onToggle])

  const onNavigate = useCallback((path: string) => {
    vscode.postMessage({ type: 'setRoot', path })
  }, [])

  const onGalleryActivate = useCallback((entry: DirectoryEntry) => {
    if (entry.isDirectory) {
      vscode.postMessage({ type: 'setRoot', path: entry.path })
    } else {
      vscode.postMessage({ type: 'open', path: entry.path })
    }
  }, [])

  const onDismissHint = useCallback(() => {
    setHintDismissed(true)
    vscode.postMessage({ type: 'dismissHint' })
  }, [])

  const selectedDir = useMemo(() => {
    if (!selected) {
      return rootPath
    }
    const index = rows.findIndex(row => row.entry.path === selected)
    if (index < 0) {
      return rootPath
    }
    const dirIndex = dropDirIndex(rows, index)
    return dirIndex >= 0 ? rows[dirIndex].entry.path : rootPath
  }, [selected, rows, rootPath])

  const sendUpload = useCallback(async (dir: string | null, items: { name: string; file: File }[]) => {
    if (!dir || items.length === 0) {
      return
    }
    const files = await readUploadFiles(items)
    if (files.length > 0) {
      vscode.postMessage({ type: 'upload', dir, files })
    }
  }, [])

  const onUpload = useCallback((files: File[]) => {
    void sendUpload(selectedDir, files.map(file => ({ name: file.name, file })))
  }, [selectedDir, sendUpload])

  const onDropFiles = useCallback((targetIndex: number, files: File[]) => {
    const dir = targetIndex >= 0 && rows[targetIndex] ? rows[targetIndex].entry.path : rootPath
    void sendUpload(dir, files.map(file => ({ name: file.name, file })))
  }, [rows, rootPath, sendUpload])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length === 0) {
        return
      }
      event.preventDefault()
      void sendUpload(selectedDir, files.map((file, index) => ({ name: pastedName(file, index), file })))
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [selectedDir, sendUpload])

  const loaded = rootPath !== null && cache.has(rootPath)

  return (
    <>
      <Breadcrumb segments={segments} onNavigate={onNavigate} onUpload={onUpload} />
      {viewMode === 'tree'
        ? (
          <VscodeEnhancedTree
            rows={rows}
            loaded={loaded}
            selected={selected}
            onSelect={setSelected}
            onToggle={onToggle}
            onActivate={onActivate}
            onDropFiles={onDropFiles}
          />
        )
        : (
          <Gallery
            entries={rootPath ? cache.get(rootPath) ?? [] : []}
            loaded={loaded}
            mode={viewMode}
            onActivate={onGalleryActivate}
          />
        )}
      {!hintDismissed && <UploadHint onDismiss={onDismissHint} />}
    </>
  )
}
