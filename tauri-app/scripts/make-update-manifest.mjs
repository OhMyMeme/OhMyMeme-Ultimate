// OhMyMemeUltimate Desktop 自动更新清单生成器（tauri-plugin-updater v2 的 latest.json）
// 用法：
//   node make-update-manifest.mjs \
//     --version 0.3.0 \
//     --installer OhMyMemeUltimate_Desktop_0.3.0_x64-setup.exe \
//     --signature <tauri signer sign 输出的 base64 签名> \
//     --url https://github.com/<owner>/<repo>/releases/download/v0.3.0/OhMyMemeUltimate_Desktop_0.3.0_x64-setup.exe \
//     [--notes "更新说明"] \
//     [--out latest.json]
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const REQUIRED = ['version', 'installer', 'signature', 'url']

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      throw new Error(`无法识别的参数: ${arg}`)
    }
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`参数 --${key} 缺少值`)
    }
    args[key] = value
    i++
  }
  return args
}

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

let args
try {
  args = parseArgs(process.argv.slice(2))
} catch (error) {
  fail(error.message)
}

for (const key of REQUIRED) {
  const value = (args[key] || '').trim()
  if (!value) {
    fail(`缺少必填参数: --${key}`)
  }
  args[key] = value
}

if (/^v/i.test(args.version)) {
  fail(`version 不应带 v 前缀，应与 tauri.conf.json 的 version 字段一致（如 0.3.0 或 0.3.0-beta.1）`)
}
if (!/^\d+\.\d+\.\d+/.test(args.version)) {
  fail(`version 格式不正确: ${args.version}（应为 semver，如 0.3.0 或 0.3.0-beta.1）`)
}

if (!existsSync(args.installer)) {
  fail(`安装包不存在: ${args.installer}`)
}

if (!/^[A-Za-z0-9+/]+={0,2}$/.test(args.signature)) {
  fail('signature 不是有效的 base64（请用 npx tauri signer sign 生成）')
}

if (!/^https?:\/\//.test(args.url)) {
  fail(`url 应为 http(s) 下载地址: ${args.url}`)
}

const manifest = {
  version: args.version,
  notes: args.notes || '',
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: args.signature,
      url: args.url
    }
  }
}

const outFile = path.resolve(args.out || 'latest.json')
writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

console.log(`✅ 已生成更新清单: ${outFile}`)
console.log(`   version : ${manifest.version}`)
console.log(`   pub_date: ${manifest.pub_date}`)
console.log(`   url     : ${manifest.platforms['windows-x86_64'].url}`)
