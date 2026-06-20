import { commands } from 'vscode'

export interface ActiveSshRemote {
  hostName: string
  config: {
    Host?: string
    HostName?: string
    User?: string
  }
}

export async function getActiveSshRemote(): Promise<ActiveSshRemote | undefined> {
  try {
    const result = await commands.executeCommand<ActiveSshRemote>('remote-internal.getActiveSshRemote')
    return result ?? undefined
  } catch {
    return undefined
  }
}
