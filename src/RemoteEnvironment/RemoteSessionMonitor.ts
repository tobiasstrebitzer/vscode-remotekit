import { commands, Disposable, EventEmitter, LogOutputChannel, window, workspace } from 'vscode'
import { detectRemoteEnvironment } from './detectRemoteEnvironment'
import { getActiveSshRemote } from './getActiveSshRemote'
import { RemoteEnvironmentInfo } from './RemoteEnvironmentInfo'

const PROBE_COMMANDS = [
  'remote-internal.getConfiguredHostnames',
  'remote-internal.getSshFoldersHistory'
]

export class RemoteSessionMonitor {
  private readonly _onDidConnect = new EventEmitter<RemoteEnvironmentInfo>()
  readonly onDidConnect = this._onDidConnect.event

  private readonly _onDidDisconnect = new EventEmitter<void>()
  readonly onDidDisconnect = this._onDidDisconnect.event

  private readonly disposables: Disposable[] = []
  private connected = false

  constructor(private readonly log: LogOutputChannel) { }

  async start(): Promise<void> {
    const environment = detectRemoteEnvironment()

    if (environment.isRemoteSsh) {
      const activeRemote = await getActiveSshRemote()
      if (activeRemote) {
        environment.host = activeRemote.hostName
      }
    }

    this.logEnvironment(environment)

    if (environment.isRemoteSsh) {
      this.connected = true
      this._onDidConnect.fire(environment)
      void this.probeRemoteSsh()
    } else {
      this.log.info(`Not connected to a Remote SSH host (remoteName=${environment.remoteName ?? 'none'})`)
    }

    this.disposables.push(
      workspace.onDidChangeWorkspaceFolders((event) => {
        this.log.info(`Workspace folders changed: +${event.added.length} -${event.removed.length}`)
      }),
      window.onDidChangeWindowState((state) => {
        this.log.debug(`Window state changed: focused=${state.focused} active=${state.active}`)
      })
    )
  }

  dispose(): void {
    if (this.connected) {
      this.connected = false
      this.log.info('Disconnecting from Remote SSH session')
      this._onDidDisconnect.fire()
    }
    this.disposables.forEach((disposable) => disposable.dispose())
    this._onDidConnect.dispose()
    this._onDidDisconnect.dispose()
  }

  private async probeRemoteSsh(): Promise<void> {
    for (const command of PROBE_COMMANDS) {
      try {
        const result = await commands.executeCommand(command)
        this.log.info(`${command} →`, JSON.stringify(result))
      } catch (error) {
        this.log.warn(`${command} failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  private logEnvironment(environment: RemoteEnvironmentInfo): void {
    this.log.info('Remote environment detected:', JSON.stringify(environment))
    if (environment.isRemoteSsh) {
      this.log.info(`Connected to Remote SSH host '${environment.host ?? environment.remoteAuthority}' as '${environment.username ?? 'unknown'}' on ${environment.platform} (${environment.hostname})`)
      const directories = environment.workspaceFolders.map((folder) => folder.fsPath).join(', ')
      this.log.info(`Working directory: ${directories || '(none)'}`)
    }
  }
}
