export default defineEventHandler(() => {
  return {
    ok: true,
    uptime: Math.round(process.uptime())
  }
})
