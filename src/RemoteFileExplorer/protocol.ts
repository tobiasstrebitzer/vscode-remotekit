export type ViewMode = 'tree' | 'small' | 'medium' | 'large'

export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  uri?: string
}

export interface PathSegment {
  label: string
  path: string
}

export interface UploadFile {
  name: string
  data: string
}

export type HostToWebview =
  | { type: 'root'; root: string; segments: PathSegment[]; preserveExpanded: boolean }
  | { type: 'dir'; path: string; entries: DirectoryEntry[] }
  | { type: 'hint'; dismissed: boolean }
  | { type: 'viewMode'; mode: ViewMode }

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'readDir'; path: string }
  | { type: 'setRoot'; path: string }
  | { type: 'open'; path: string }
  | { type: 'upload'; dir: string; files: UploadFile[] }
  | { type: 'dismissHint' }
