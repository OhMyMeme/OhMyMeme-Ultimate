import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(root, '.env')

if (existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

await import(pathToFileURL(resolve(root, '.output/server/index.mjs')).href)
