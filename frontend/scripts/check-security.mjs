// Run with: npm run check:security
// A safety net that fails when someone (including me, in a later milestone) breaks one of our security rules.
// It only READS files. Rules are explained in README.md under "Security notes".
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.cwd()
const srcDir = join(root, 'src')
const problems = []

function walk(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) files.push(full)
  }
  return files
}

const TOKEN_FILE = ['src', 'services', 'tokenStorage.ts'].join('/')
const rules = [
  { name: 'raw HTML rendering (dangerouslySetInnerHTML)', pattern: /dangerouslySetInnerHTML/ },
  { name: 'writing HTML with innerHTML / insertAdjacentHTML / document.write', pattern: /\.innerHTML\s*=|insertAdjacentHTML|document\.write\s*\(/ },
  { name: 'eval() or new Function()', pattern: /\beval\s*\(|new\s+Function\s*\(/ },
  { name: 'logging something token-like', pattern: /console\.\w+\([^)]*(token|authorization|bearer|password)/i },
  { name: 'a Razorpay secret in the frontend', pattern: /razorpay_key_secret|RAZORPAY_KEY_SECRET|key_secret/i },
  { name: 'putting a token in a URL', pattern: /[?&]token=\$\{[^}]*(getToken|session)/i },
]

const files = existsSync(srcDir) ? walk(srcDir) : []
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/')
  const text = readFileSync(file, 'utf8')
  for (const rule of rules) if (rule.pattern.test(text)) problems.push(`${rel}: ${rule.name}`)
  // Only the token store may touch browser storage, so token handling stays in ONE place.
  if (rel !== TOKEN_FILE && /\b(localStorage|sessionStorage)\b/.test(text))
    problems.push(`${rel}: uses localStorage/sessionStorage directly (only ${TOKEN_FILE} may)`)
}

// Anything starting with VITE_ is copied into the public website, so it must never look like a secret.
for (const name of readdirSync(root).filter((n) => n === '.env' || n.startsWith('.env.'))) {
  const text = readFileSync(join(root, name), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const key = line.split('=')[0].trim()
    if (/^VITE_/.test(key) && /(SECRET|PASSWORD|PRIVATE|TOKEN)/i.test(key)) problems.push(`${name}: ${key} looks like a secret, but VITE_ values are public`)
  }
}

if (problems.length) {
  console.error('Security check FAILED:')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`Security checks passed (${files.length} source files scanned).`)
