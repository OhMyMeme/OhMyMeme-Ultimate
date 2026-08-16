export function getErrorMessage(error: unknown, fallback = '请重试'): string {
  const data = (error as { data?: { message?: string, statusMessage?: string } })?.data
  return data?.message ?? data?.statusMessage ?? fallback
}
