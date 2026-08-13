import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(root, '.env')

if (existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

await import(resolve(root, '.output/server/index.mjs'))
