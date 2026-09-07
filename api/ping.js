import { supabase } from "./_db.js";

// Dedicated lightweight endpoint for uptime/keep-alive pings (e.g. cron-job.org).
// Queries only the row's id — never the campaigns/donations JSON — so the
// response stays tiny even as your data grows, while still counting as real
// database activity to Supabase (preventing its 7-day inactivity pause).
export default async function handler(req, res) {
  const { error } = await supabase.from("campus_fund").select("id").eq("id", 1).single();
  if (error) return res.status(500).json({ ok: false });
  res.status(200).json({ ok: true, pingedAt: Date.now() });
}