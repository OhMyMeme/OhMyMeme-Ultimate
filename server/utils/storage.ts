import { randomUUID } from 'node:crypto'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg'
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
