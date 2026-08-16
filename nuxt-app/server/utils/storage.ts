import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif'
}

const MAGIC_SIGNATURES: Array<{ mimeType: string, bytes: number[], offset?: number, trailing?: number[] }> = [
  { mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 8, trailing: [0x57, 0x45, 0x42, 0x50] }
]

export function sniffMimeType(data: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (data.length < sig.bytes.length) {
      continue
    }
    if (!sig.bytes.every((byte, i) => data[i] === byte)) {
      continue
    }
    if (sig.trailing) {
      const offset = sig.offset ?? sig.bytes.length
      if (data.length < offset + sig.trailing.length) {
        continue
      }
      if (!sig.trailing.every((byte, i) => data[offset + i] === byte)) {
        continue
      }
    }
    return sig.mimeType
  }
  return null
}

export interface StoredFile {
  key: string
  mimeType: string
  size: number
}

const memesStorage = useStorage('memes')

export const storage = {
  async save(data: Buffer, mimeType: string): Promise<StoredFile> {
    const ext = EXTENSIONS[mimeType] || '.bin'
    const key = `${randomUUID()}${ext}`
    await memesStorage.setItemRaw(key, data)
    return { key, mimeType, size: data.byteLength }
  },

  async saveThumb(data: Buffer): Promise<StoredFile> {
    const key = `${randomUUID()}.webp`
    await memesStorage.setItemRaw(key, data)
    return { key, mimeType: 'image/webp', size: data.byteLength }
  },

  async read(key: string): Promise<Buffer | null> {
    try {
      const data = await memesStorage.getItemRaw(key)
      return data instanceof Buffer ? data : null
    } catch {
      return null
    }
  },

  async remove(key: string): Promise<void> {
    await memesStorage.removeItem(key).catch(() => {})
  }
}

export async function generateThumbnail(data: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(data, { animated: false })
      .resize(256, 256, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  } catch {
    return null
  }
}
