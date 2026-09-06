import { readDB, writeDB, requireAdmin, genId } from "./_db.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const db = await readDB();
    return res.status(200).json(db.campaigns);
  }

  if (req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const db = await readDB();
    const campaign = {
      ...req.body,
      id: genId(),
      images: req.body.images || [],
      closed: false,
      createdAt: Date.now(),
    };
    db.campaigns.unshift(campaign);
    await writeDB(db);
    return res.status(201).json(campaign);
  }

  res.status(405).json({ error: "Method not allowed" });
}
