import { defineMongooseModel } from '#nuxt/mongoose'
import { Schema, type Types } from 'mongoose'

export interface MemeRecord {
  name: string
  groupId: Types.ObjectId
  tags: string[]
  storageKey: string
  thumbKey?: string
  mimeType: string
  size: number
  favorite: boolean
  usedAt?: Date
}

export const MemeSchema = defineMongooseModel<MemeRecord>({
  name: 'Meme',
  schema: {
    name: { type: String, required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    tags: { type: [String], default: [] },
    storageKey: { type: String, required: true, unique: true },
    thumbKey: { type: String, required: false },
    mimeType: { type: String, required: true },
    size: { type: Number, default: 0 },
    favorite: { type: Boolean, default: false },
    usedAt: { type: Date, required: false }
  },
  options: {
    timestamps: true
  },
  hooks: (schema) => {
    schema.index({ groupId: 1, createdAt: -1 })
    schema.index({ favorite: 1, createdAt: -1 })
    schema.index({ usedAt: -1 })
  }
})
