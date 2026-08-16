import { readFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(scriptDir, '..')

if (process.env.NODE_ENV === 'production') {
  console.error('禁止在生产环境运行：该脚本仅限开发环境使用')
  process.exit(1)
}

function loadEnv() {
  const env = {}
  try {
    const content = readFileSync(path.join(appDir, '.env'), 'utf-8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }
      const eq = trimmed.indexOf('=')
      if (eq <= 0) {
        continue
      }
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch {
    // .env 不存在时回退到进程环境变量
  }
  return env
}

const env = loadEnv()
const uri = env.NUXT_MONGOOSE_URI || process.env.NUXT_MONGOOSE_URI

if (!uri) {
  console.error('缺少 NUXT_MONGOOSE_URI，请在 nuxt-app/.env 中配置')
  process.exit(1)
}

if (!/localhost|127\.0\.0\.1|0\.0\.0\.0|::1/.test(uri) && process.env.RESET_FORCE !== '1') {
  console.error('检测到非本地数据库连接串，拒绝清除。确认无误可设 RESET_FORCE=1 强制执行')
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db

let dropped = 0
for (const name of ['memes', 'groups']) {
  try {
    await db.collection(name).drop()
    dropped++
    console.log(`已删除集合: ${name}`)
  } catch (error) {
    if (error.codeName === 'NamespaceNotFound') {
      console.log(`集合不存在，跳过: ${name}`)
    } else {
      throw error
    }
  }
}
await mongoose.disconnect()
console.log(`数据库清理完成（删除 ${dropped} 个集合）`)

const storageDir = path.resolve(appDir, env.NUXT_STORAGE_LOCAL_DIR || '.data/uploads/memes')
await rm(storageDir, { recursive: true, force: true })
await mkdir(storageDir, { recursive: true })
console.log(`已清空上传文件夹: ${storageDir}`)

console.log('✅ 开发数据已全部清除')
