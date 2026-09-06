import { readDB, writeDB, requireAdmin, genId } from "./_db.js";
import { buildSeed } from "./_seedData.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const db = await readDB();
  const { campaigns, donations } = buildSeed(genId);
  const existingThemes = new Set(db.campaigns.map((c) => c.theme));
  const missingCampaigns = campaigns.filter((c) => !existingThemes.has(c.theme));
  const missingIds = new Set(missingCampaigns.map((c) => c.id));
  const missingDonations = donations.filter((d) => missingIds.has(d.campaignId));
  db.campaigns = [...missingCampaigns, ...db.campaigns];
  db.donations = [...missingDonations, ...db.donations];
  await writeDB(db);
  res.status(200).json({ ok: true, added: missingCampaigns.length });
}
