import { readDB, writeDB, requireAdmin } from "../_db.js";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "PATCH") {
    if (!requireAdmin(req, res)) return;
    const db = await readDB();
    const idx = db.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Event not found" });
    db.campaigns[idx] = { ...db.campaigns[idx], ...req.body };
    await writeDB(db);
    return res.status(200).json(db.campaigns[idx]);
  }

  if (req.method === "DELETE") {
    if (!requireAdmin(req, res)) return;
    const db = await readDB();
    const idx = db.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Event not found" });
    db.campaigns.splice(idx, 1);
    db.donations = db.donations.filter((d) => d.campaignId !== id);
    await writeDB(db);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
