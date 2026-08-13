import { defineMongooseModel } from '#nuxt/mongoose'

export interface GroupRecord {
  name: string
}

export const GroupSchema = defineMongooseModel<GroupRecord>({
  name: 'Group',
  schema: {
    name: { type: String, required: true, unique: true, trim: true }
  },
  options: {
    timestamps: true
  }
})
