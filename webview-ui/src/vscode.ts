import type { WebviewToHost } from '@shared/protocol'

interface VsCodeApi {
  postMessage(message: WebviewToHost): void
  getState<T>(): T | undefined
  setState<T>(state: T): void
}

declare function acquireVsCodeApi(): VsCodeApi

export const vscode = acquireVsCodeApi()
