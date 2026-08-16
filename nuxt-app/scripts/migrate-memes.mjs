import mongoose from 'mongoose'

const uri = process.env.NUXT_MONGOOSE_URI
if (!uri) {
  console.error('缺少 NUXT_MONGOOSE_URI，请设置环境变量或用 --env-file=.env 运行')
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db

const groupNames = await db.collection('memes').distinct('group').catch(() => [])

const groupIdByName = new Map()
for (const name of groupNames) {
  if (name == null || name === '') {
    continue
  }
  let group = await db.collection('groups').findOne({ name })
  if (!group) {
    const now = new Date()
    const res = await db.collection('groups').insertOne({ name, createdAt: now, updatedAt: now })
    group = { _id: res.insertedId }
  }
  groupIdByName.set(name, group._id)
}

let migrated = 0
const cursor = db.collection('memes').find({ groupId: { $exists: false } })
const bulk = db.collection('memes').initializeUnorderedBulkOp()
for await (const meme of cursor) {
  const groupId = groupIdByName.get(meme.group)
  if (!groupId) {
    continue
  }
  bulk.find({ _id: meme._id }).updateOne({ $set: { groupId }, $unset: { group: '' } })
  migrated++
}
if (migrated > 0) {
  await bulk.execute()
}

console.log(`迁移完成：新建/复用 ${groupIdByName.size} 个分组，转换 ${migrated} 个表情`)

await mongoose.disconnect()
