export interface WorkspaceFolderInfo {
  name: string
  fsPath: string
  uri: string
}

export interface RemoteEnvironmentInfo {
  isRemote: boolean
  isRemoteSsh: boolean
  remoteName?: string
  remoteAuthority?: string
  host?: string
  appName: string
  appHost: string
  uiKind: string
  machineId: string
  sessionId: string
  platform: NodeJS.Platform
  nodeVersion: string
  hostname: string
  username?: string
  homeDir: string
  shell?: string
  workspaceName?: string
  workspaceFolders: WorkspaceFolderInfo[]
  envKeys: number
}
