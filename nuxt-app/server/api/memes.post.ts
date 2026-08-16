const MAX_FILES = 50
const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_REQUEST_SIZE = MAX_FILES * MAX_FILE_SIZE

function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() || ''
  const cleaned = base.split('').filter((char) => {
    const code = char.charCodeAt(0)
    return code >= 32 && code !== 127
  }).join('').trim()
  return cleaned || '未命名'
}

export default defineEventHandler(async (event) => {
  const contentLength = Number(getHeader(event, 'content-length') || 0)
  if (contentLength > MAX_REQUEST_SIZE) {
    throw createError({ statusCode: 413, message: '请求体过大' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, message: '缺少 multipart 表单数据' })
  }

  const rawGroupId = form.find(f => f.name === 'groupId')?.data.toString().trim()
  let groupId: string
  if (rawGroupId) {
    groupId = requireValidId(rawGroupId, '无效的分组')
    const group = await GroupSchema.findById(groupId)
    if (!group) {
      throw createError({ statusCode: 400, message: '分组不存在' })
    }
    if (group.isFavorites) {
      throw createError({ statusCode: 400, message: '不能上传到收藏分组' })
    }
    if (group.isRecent) {
      throw createError({ statusCode: 400, message: '不能上传到最近使用分组' })
    }
  } else {
    const ungrouped = await getUngroupedGroup()
    if (!ungrouped) {
      throw createError({ statusCode: 500, message: '未分组初始化失败' })
    }
    groupId = String(ungrouped._id)
  }

  const files = form.filter(f => f.name === 'files' && f.filename)

  if (!files.length) {
    throw createError({ statusCode: 400, message: '未选择文件' })
  }
  if (files.length > MAX_FILES) {
    throw createError({ statusCode: 400, message: `单次最多上传 ${MAX_FILES} 个文件` })
  }

  const savedKeys: string[] = []
  const results: Array<{ name: string, status: 'created' | 'failed', reason?: string }> = []

  try {
    for (const file of files) {
      const name = sanitizeFilename(file.filename as string)

      if (!file.data.byteLength) {
        results.push({ name, status: 'failed', reason: '文件为空' })
        continue
      }
      if (file.data.byteLength > MAX_FILE_SIZE) {
        results.push({ name, status: 'failed', reason: '文件超过 20MB' })
        continue
      }

      const mimeType = sniffMimeType(file.data)
      if (!mimeType) {
        results.push({ name, status: 'failed', reason: '格式不支持（仅 PNG/GIF/JPEG/WebP）' })
        continue
      }

      const stored = await storage.save(file.data, mimeType)
      savedKeys.push(stored.key)

      const thumb = await generateThumbnail(file.data)
      let thumbKey: string | undefined
      if (thumb) {
        const thumbStored = await storage.saveThumb(thumb)
        savedKeys.push(thumbStored.key)
        thumbKey = thumbStored.key
      }

      await MemeSchema.create({
        name,
        groupId,
        storageKey: stored.key,
        thumbKey,
        mimeType: stored.mimeType,
        size: stored.size
      })
      results.push({ name, status: 'created' })
    }

    if (results.some(result => result.status === 'created')) {
      broadcastRealtime('memes-changed', { groupId: String(groupId) })
    }
    return { results }
  } catch (error) {
    await Promise.allSettled(savedKeys.map(key => storage.remove(key)))
    throw error
  }
})
