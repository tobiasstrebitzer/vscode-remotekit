import { CancellationToken, commands, Disposable, FileSystemWatcher, FileType, Memento, RelativePattern, Uri, Webview, WebviewView, WebviewViewProvider, WebviewViewResolveContext, window, workspace } from 'vscode'
import { homedir } from 'os'
import { dirname, extname, join, parse, sep } from 'path'
import { readFileSync } from 'fs'
import { DirectoryEntry, HostToWebview, PathSegment, UploadFile, ViewMode, WebviewToHost } from './protocol'

export class RemoteFileExplorerViewProvider implements WebviewViewProvider, Disposable {
  static readonly viewId = 'remotekit.fileExplorer'

  private readonly workingRoot: string = workspace.workspaceFolders?.[0]?.uri.fsPath ?? homedir()
  private root: string = this.workingRoot
  private viewMode: ViewMode = 'tree'
  private view?: WebviewView
  private readonly watchers = new Map<string, FileSystemWatcher>()
  private readonly pendingRefresh = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(private readonly extensionUri: Uri, private readonly state: Memento) {
    this.viewMode = state.get<ViewMode>('viewMode', 'tree')
  }

  resolveWebviewView(view: WebviewView, _context: WebviewViewResolveContext, _token: CancellationToken): void {
    this.view = view
    view.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri, Uri.file(parse(this.workingRoot).root)] }
    view.webview.html = this.renderHtml(view.webview)
    view.webview.onDidReceiveMessage((message: WebviewToHost) => this.handleMessage(message))
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode
    void this.state.update('viewMode', mode)
    this.post({ type: 'viewMode', mode })
  }

  setRoot(path: string): void {
    this.root = path
    void this.postRoot(false)
  }

  setExplorerRoot(path: string): void {
    void commands.executeCommand('vscode.openFolder', Uri.file(path), { forceNewWindow: false })
  }

  resetRoot(): void {
    this.setRoot(this.workingRoot)
  }

  navigateToParent(): void {
    const parent = dirname(this.root)
    if (parent !== this.root) {
      this.setRoot(parent)
    }
  }

  refresh(): void {
    void this.postRoot(true)
  }

  dispose(): void {
    this.disposeWatchers()
  }

  private async handleMessage(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.post({ type: 'hint', dismissed: this.state.get('uploadHintDismissed', false) })
        this.post({ type: 'viewMode', mode: this.viewMode })
        await this.postRoot(false)
        break
      case 'dismissHint':
        await this.state.update('uploadHintDismissed', true)
        break
      case 'readDir':
        await this.postDir(message.path)
        break
      case 'setRoot':
        this.setRoot(message.path)
        break
      case 'open':
        await commands.executeCommand('vscode.open', Uri.file(message.path), { preview: true, preserveFocus: true })
        break
      case 'upload':
        await this.handleUpload(message.dir, message.files)
        break
    }
  }

  private async handleUpload(dir: string, files: UploadFile[]): Promise<void> {
    let written = 0
    const failed: string[] = []
    for (const file of files) {
      const target = await this.resolveUploadTarget(dir, file.name)
      if (!target) {
        continue
      }
      try {
        await workspace.fs.writeFile(target, Buffer.from(file.data, 'base64'))
        written++
      } catch {
        failed.push(file.name)
      }
    }
    if (written > 0) {
      await this.postDir(dir)
    }
    if (failed.length > 0) {
      void window.showErrorMessage(`Failed to upload ${failed.length} file(s): ${failed.join(', ')}`)
    } else if (written > 0) {
      void window.showInformationMessage(`Uploaded ${written} file(s) to ${dir}`)
    }
  }

  private async resolveUploadTarget(dir: string, name: string): Promise<Uri | undefined> {
    const uri = Uri.file(join(dir, name))
    if (!await this.exists(uri)) {
      return uri
    }
    const choice = await window.showInformationMessage(`"${name}" already exists in ${dir}.`, { modal: true }, 'Overwrite', 'Keep Both', 'Skip')
    if (choice === 'Overwrite') {
      return uri
    }
    if (choice === 'Keep Both') {
      return this.uniqueUri(dir, name)
    }
    return undefined
  }

  private async uniqueUri(dir: string, name: string): Promise<Uri> {
    const ext = extname(name)
    const base = name.slice(0, name.length - ext.length)
    let counter = 1
    let candidate = Uri.file(join(dir, `${base}-${counter}${ext}`))
    while (await this.exists(candidate)) {
      counter++
      candidate = Uri.file(join(dir, `${base}-${counter}${ext}`))
    }
    return candidate
  }

  private async exists(uri: Uri): Promise<boolean> {
    try {
      await workspace.fs.stat(uri)
      return true
    } catch {
      return false
    }
  }

  private post(message: HostToWebview): void {
    void this.view?.webview.postMessage(message)
  }

  private async postRoot(preserveExpanded: boolean): Promise<void> {
    this.disposeWatchers()
    this.post({ type: 'root', root: this.root, segments: this.pathSegments(this.root), preserveExpanded })
  }

  private async postDir(path: string): Promise<void> {
    const entries = await this.readDirectory(path)
    this.post({ type: 'dir', path, entries })
    this.watch(path)
  }

  private watch(path: string): void {
    if (this.watchers.has(path)) {
      return
    }
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(Uri.file(path), '*'), false, true, false)
    const onChange = () => this.scheduleDirRefresh(path)
    watcher.onDidCreate(onChange)
    watcher.onDidDelete(onChange)
    this.watchers.set(path, watcher)
  }

  private scheduleDirRefresh(path: string): void {
    clearTimeout(this.pendingRefresh.get(path))
    this.pendingRefresh.set(path, setTimeout(() => {
      this.pendingRefresh.delete(path)
      void this.postDir(path)
    }, 150))
  }

  private disposeWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.dispose()
    }
    this.watchers.clear()
    for (const timer of this.pendingRefresh.values()) {
      clearTimeout(timer)
    }
    this.pendingRefresh.clear()
  }

  private pathSegments(path: string): PathSegment[] {
    const segments: PathSegment[] = [{ label: sep, path: sep }]
    let current = ''
    for (const part of path.split(sep).filter(Boolean)) {
      current += sep + part
      segments.push({ label: part, path: current })
    }
    return segments
  }

  private async readDirectory(path: string): Promise<DirectoryEntry[]> {
    try {
      const entries = await workspace.fs.readDirectory(Uri.file(path))
      return entries
        .map(([name, type]) => this.toEntry(path, name, (type & FileType.Directory) !== 0))
        .sort(compareEntries)
    } catch {
      return []
    }
  }

  private toEntry(dir: string, name: string, isDirectory: boolean): DirectoryEntry {
    const path = join(dir, name)
    if (isDirectory) {
      return { name, path, isDirectory }
    }
    return { name, path, isDirectory, uri: this.view?.webview.asWebviewUri(Uri.file(path)).toString() }
  }

  private renderHtml(webview: Webview): string {
    const nonce = createNonce()
    const distUri = webview.asWebviewUri(Uri.joinPath(this.extensionUri, 'dist'))
    const codiconUri = webview.asWebviewUri(Uri.joinPath(this.extensionUri, 'dist', 'codicons', 'codicon.css'))
    const csp = [
      'default-src \'none\'',
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`
    ].join('; ')
    const head = `<meta http-equiv="Content-Security-Policy" content="${csp}">
  <base href="${distUri.toString()}/">
  <link id="vscode-codicon-stylesheet" rel="stylesheet" href="${codiconUri.toString()}" nonce="${nonce}">`
    let html: string
    try {
      html = readFileSync(join(this.extensionUri.fsPath, 'dist', 'index.html'), 'utf8')
    } catch {
      return '<!DOCTYPE html><html><body style="padding:8px;font-family:sans-serif">Run <code>pnpm run build:webview</code> to build the Remote File Explorer.</body></html>'
    }
    return html
      .replace('<head>', `<head>\n  ${head}`)
      .replace(/ crossorigin/g, '')
      .replace(/<script /g, `<script nonce="${nonce}" `)
  }
}

function compareEntries(a: DirectoryEntry, b: DirectoryEntry): number {
  if (a.isDirectory !== b.isDirectory) {
    return a.isDirectory ? -1 : 1
  }
  return a.name.localeCompare(b.name)
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let nonce = ''
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return nonce
}
