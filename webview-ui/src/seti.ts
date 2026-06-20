import data from './setiData.json'

export interface SetiIcon {
  c: string
  color?: string
}

const extLang: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascriptreact',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescriptreact',
  json: 'json', jsonc: 'jsonc', jsonl: 'jsonl',
  md: 'markdown', markdown: 'markdown',
  py: 'python', pyw: 'python', pyi: 'python',
  go: 'go', rs: 'rust', rb: 'ruby', java: 'java', cs: 'csharp',
  c: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', xml: 'xml',
  yml: 'yaml', yaml: 'yaml',
  sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', ksh: 'shellscript',
  php: 'php', swift: 'swift', kt: 'kotlin', kts: 'kotlin',
  dart: 'dart', lua: 'lua', pl: 'perl', pm: 'perl', sql: 'sql',
  ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
  m: 'objective-c', mm: 'objective-cpp',
  clj: 'clojure', cljs: 'clojure', cljc: 'clojure',
  coffee: 'coffeescript', fs: 'fsharp', fsx: 'fsharp', fsi: 'fsharp',
  groovy: 'groovy', jl: 'julia', tex: 'latex', latex: 'latex',
  ini: 'properties', conf: 'properties', cfg: 'properties', properties: 'properties',
  bat: 'bat', cmd: 'bat', hbs: 'handlebars', handlebars: 'handlebars', gd: 'godot'
}

const defs = data.defs as Record<string, SetiIcon>
const names = data.names as Record<string, string>
const exts = data.exts as Record<string, string>
const langs = data.langs as Record<string, string>

function resolveId(name: string): string {
  const lower = name.toLowerCase()
  if (names[lower]) {
    return names[lower]
  }
  const parts = lower.split('.')
  for (let i = 1; i < parts.length; i++) {
    const candidate = parts.slice(i).join('.')
    if (exts[candidate]) {
      return exts[candidate]
    }
  }
  const lang = extLang[parts[parts.length - 1]]
  if (lang && langs[lang]) {
    return langs[lang]
  }
  return data.file
}

export function setiFileIcon(name: string): SetiIcon {
  return defs[resolveId(name)] ?? defs[data.file]
}
