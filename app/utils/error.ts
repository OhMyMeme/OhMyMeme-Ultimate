export function getErrorMessage(error: unknown, fallback = '请重试'): string {
  return (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
}
