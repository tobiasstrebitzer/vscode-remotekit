import * as vscode from 'vscode'
import { RemoteFileExplorerViewProvider } from './RemoteFileExplorer/RemoteFileExplorerViewProvider'
import { RemoteSessionMonitor } from './RemoteEnvironment/RemoteSessionMonitor'

export function activate(context: vscode.ExtensionContext) {
  const log = vscode.window.createOutputChannel('RemoteKit', { log: true })
  context.subscriptions.push(log)

  const sessionMonitor = new RemoteSessionMonitor(log)
  void sessionMonitor.start()
  context.subscriptions.push(sessionMonitor)

  const fileExplorer = new RemoteFileExplorerViewProvider(context.extensionUri, context.globalState)
  context.subscriptions.push(
    fileExplorer,
    vscode.window.registerWebviewViewProvider(RemoteFileExplorerViewProvider.viewId, fileExplorer),
    vscode.commands.registerCommand('remotekit.fileExplorer.refresh', () => fileExplorer.refresh()),
    vscode.commands.registerCommand('remotekit.fileExplorer.navigateToParent', () => fileExplorer.navigateToParent()),
    vscode.commands.registerCommand('remotekit.fileExplorer.resetRoot', () => fileExplorer.resetRoot()),
    vscode.commands.registerCommand('remotekit.fileExplorer.setRoot', (context?: { path?: string }) => {
      if (context?.path) {
        fileExplorer.setRoot(context.path)
      }
    }),
    vscode.commands.registerCommand('remotekit.fileExplorer.setExplorerRoot', (context?: { path?: string }) => {
      if (context?.path) {
        fileExplorer.setExplorerRoot(context.path)
      }
    }),
    vscode.commands.registerCommand('remotekit.fileExplorer.viewAsTree', () => fileExplorer.setViewMode('tree')),
    vscode.commands.registerCommand('remotekit.fileExplorer.viewAsSmall', () => fileExplorer.setViewMode('small')),
    vscode.commands.registerCommand('remotekit.fileExplorer.viewAsMedium', () => fileExplorer.setViewMode('medium')),
    vscode.commands.registerCommand('remotekit.fileExplorer.viewAsLarge', () => fileExplorer.setViewMode('large'))
  )
}

export function deactivate() { }
