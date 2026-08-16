import { defineMongooseModel } from '#nuxt/mongoose'

export interface GroupRecord {
  name: string
  isFavorites: boolean
  isRecent: boolean
  isUngrouped: boolean
  createdAt?: Date
  updatedAt?: Date
}

export const GroupSchema = defineMongooseModel<GroupRecord>({
  name: 'Group',
  schema: {
    name: { type: String, required: true, unique: true, trim: true },
    isFavorites: { type: Boolean, default: false },
    isRecent: { type: Boolean, default: false },
    isUngrouped: { type: Boolean, default: false }
  },
  options: {
    timestamps: true
  }
})
