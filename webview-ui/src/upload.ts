import type { UploadFile } from '@shared/protocol'

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function readUploadFiles(items: { name: string; file: File }[]): Promise<UploadFile[]> {
  return Promise.all(items.map(async ({ name, file }) => ({
    name,
    data: toBase64(new Uint8Array(await file.arrayBuffer()))
  })))
}

export function pastedName(file: File, index: number): string {
  if (file.name) {
    return file.name
  }
  const ext = file.type.split('/')[1] || 'bin'
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `pasted-${stamp}${index ? '-' + index : ''}.${ext}`
}
