import { readDB, writeDB, genId } from "./_db.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const db = await readDB();
    const { campaignId } = req.query;
    const list = campaignId
      ? db.donations.filter((d) => d.campaignId === campaignId)
      : db.donations;
    return res.status(200).json(list);
  }

  if (req.method === "POST") {
    const { campaignId, donorName, accountName, programme, amount } = req.body || {};
    if (!campaignId || !donorName || !accountName || !programme || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const db = await readDB();
    const donation = { ...req.body, id: genId(), createdAt: Date.now() };
    db.donations.unshift(donation);
    await writeDB(db);
    return res.status(201).json(donation);
  }

  res.status(405).json({ error: "Method not allowed" });
}