import { readDB, writeDB, requireAdmin } from "../_db.js";

const VALID_STATUSES = ["unverified", "verified", "failed"];

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const { id } = req.query;
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const db = await readDB();
  const idx = db.donations.findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ error: "Donation not found" });

  db.donations[idx] = { ...db.donations[idx], status };
  await writeDB(db);
  res.status(200).json(db.donations[idx]);
}
