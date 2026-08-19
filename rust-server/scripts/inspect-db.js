const mongoose = require("mongoose");

(async () => {
  await mongoose.connect("mongodb://localhost:27017/ohmymeme");
  const db = mongoose.connection.db;
  const memes = db.collection("memes");
  const groups = db.collection("groups");

  const agg = await memes
    .aggregate([
      {
        $group: {
          _id: null,
          min: { $min: "$createdAt" },
          max: { $max: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  console.log("createdAt range:", JSON.stringify(agg[0] || null));

  const gs = await groups
    .find({})
    .project({ name: 1, isFavorites: 1, isRecent: 1, isUngrouped: 1 })
    .toArray();
  gs.forEach((g) =>
    console.log(
      "group:",
      JSON.stringify({
        id: String(g._id),
        name: g.name,
        fav: !!g.isFavorites,
        rec: !!g.isRecent,
        ung: !!g.isUngrouped,
      })
    )
  );

  const extAgg = await memes
    .aggregate([
      { $project: { ext: { $arrayElemAt: [{ $split: ["$storageKey", "."] }, -1] } } },
      { $group: { _id: "$ext", count: { $sum: 1 } } },
    ])
    .toArray();
  console.log("extensions:", JSON.stringify(extAgg));

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
