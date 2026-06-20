import { env, UIKind, workspace } from 'vscode'
import { homedir, hostname, userInfo } from 'os'
import { RemoteEnvironmentInfo, WorkspaceFolderInfo } from './RemoteEnvironmentInfo'

export function detectRemoteEnvironment(): RemoteEnvironmentInfo {
  const remoteName = env.remoteName
  const folders = workspace.workspaceFolders ?? []
  const workspaceFolders: WorkspaceFolderInfo[] = folders.map((folder) => ({
    name: folder.name,
    fsPath: folder.uri.fsPath,
    uri: folder.uri.toString()
  }))
  const remoteAuthority = folders[0]?.uri.authority || undefined
  return {
    isRemote: remoteName !== undefined,
    isRemoteSsh: remoteName === 'ssh-remote',
    remoteName,
    remoteAuthority,
    host: parseSshHost(remoteAuthority),
    appName: env.appName,
    appHost: env.appHost,
    uiKind: env.uiKind === UIKind.Web ? 'web' : 'desktop',
    machineId: env.machineId,
    sessionId: env.sessionId,
    platform: process.platform,
    nodeVersion: process.version,
    hostname: safe(hostname),
    username: safe(() => userInfo().username),
    homeDir: homedir(),
    shell: env.shell,
    workspaceName: workspace.name,
    workspaceFolders,
    envKeys: Object.keys(process.env).length
  }
}

function parseSshHost(authority?: string): string | undefined {
  if (!authority) {
    return undefined
  }
  const separator = authority.indexOf('+')
  return separator >= 0 ? authority.slice(separator + 1) : authority
}

function safe(read: () => string): string {
  try {
    return read()
  } catch {
    return 'unknown'
  }
}
