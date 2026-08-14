const MAX_FILES = 50
const MAX_FILE_SIZE = 20 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: '缺少 multipart 表单数据' })
  }

  const rawGroupId = form.find(f => f.name === 'groupId')?.data.toString().trim()
  const groupId = requireValidId(rawGroupId, '缺少有效的分组')

  const group = await GroupSchema.findById(groupId)
  if (!group) {
    throw createError({ statusCode: 400, statusMessage: '分组不存在' })
  }

  const files = form.filter(f => f.name === 'files' && f.filename)

  if (!files.length) {
    throw createError({ statusCode: 400, statusMessage: '未选择文件' })
  }
  if (files.length > MAX_FILES) {
    throw createError({ statusCode: 400, statusMessage: `单次最多上传 ${MAX_FILES} 个文件` })
  }

  for (const file of files) {
    if (!file.type?.startsWith('image/')) {
      throw createError({ statusCode: 415, statusMessage: '仅支持图片文件' })
    }
    if (file.data.byteLength > MAX_FILE_SIZE) {
      throw createError({ statusCode: 413, statusMessage: '单个文件不能超过 20MB' })
    }
  }

  const savedKeys: string[] = []
  try {
    const memes = []
    for (const file of files) {
      const stored = await storage.save(file.data, file.type as string)
      savedKeys.push(stored.key)
      memes.push(await MemeSchema.create({
        name: file.filename as string,
        groupId,
        storageKey: stored.key,
        mimeType: stored.mimeType,
        size: stored.size
      }))
    }
    broadcastRealtime('memes-changed', { groupId: String(groupId) })
    return memes.map(toMeme)
  } catch (error) {
    await Promise.allSettled(savedKeys.map(key => storage.remove(key)))
    throw error
  }
})
