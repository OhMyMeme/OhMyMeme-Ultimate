import type { Meme } from '~/types'

export function useCopyMeme() {
  const toast = useToast()

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
      reader.readAsDataURL(blob)
    })
  }

  function blobToPng(source: Blob): Promise<Blob> {
    const url = URL.createObjectURL(source)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('canvas 2d 上下文不可用'))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url)
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('canvas toBlob 失败'))
          }
        }, 'image/png')
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('图片加载失败'))
      }
      img.src = url
    })
  }

  async function copyGif(blob: Blob) {
    const dataUrl = await blobToDataUrl(blob)
    const html = new Blob([`<img src="${dataUrl}">`], { type: 'text/html' })
    const png = await blobToPng(blob)

    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': html,
        'image/png': png
      })])
    } catch {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    }
  }

  async function copy(meme: Meme) {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      toast.add({ title: '复制失败', description: '当前浏览器不支持', color: 'error' })
      return
    }

    try {
      const res = await fetch(meme.url)
      if (!res.ok) {
        throw new Error(`fetch 失败: ${res.status} ${res.statusText}`)
      }

      const blob = await res.blob()

      if (meme.mimeType === 'image/gif') {
        await copyGif(blob)
        toast.add({ title: '已复制', description: 'GIF 已复制（粘贴到聊天/编辑器保留动画）', color: 'success' })
        return
      }

      try {
        await navigator.clipboard.write([new ClipboardItem({ [meme.mimeType]: blob })])
      } catch {
        const png = await blobToPng(blob)
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      }
      toast.add({ title: '已复制', color: 'success' })
    } catch {
      toast.add({ title: '复制失败', color: 'error' })
    }
  }

  return { copy }
}
