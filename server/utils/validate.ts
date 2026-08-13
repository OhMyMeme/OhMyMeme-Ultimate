import { isValidObjectId } from 'mongoose'

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && isValidObjectId(value)
}

export function requireValidId(value: unknown, message = '无效的 ID'): string {
  if (!isValidId(value)) {
    throw createError({ statusCode: 400, statusMessage: message })
  }
  return value
}
