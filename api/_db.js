// Shared helper used by every /api function. Replaces the old data.json
// file-based storage with a single row in Supabase (a free hosted Postgres
// database) so it survives serverless restarts and Vercel deploys.
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const genId = () => crypto.randomBytes(6).toString("hex");

export async function readDB() {
  const { data, error } = await supabase
    .from("campus_fund")
    .select("campaigns, donations")
    .eq("id", 1)
    .single();
  if (error || !data) return { campaigns: [], donations: [] };
  return { campaigns: data.campaigns || [], donations: data.donations || [] };
}

export async function writeDB(db) {
  const { error } = await supabase
    .from("campus_fund")
    .update({ campaigns: db.campaigns, donations: db.donations })
    .eq("id", 1);
  if (error) throw error;
}

// Returns true if the request is authorized as admin. Sends the 401 itself
// and returns false when it isn't, so callers can just `if (!requireAdmin(req, res)) return;`
export function requireAdmin(req, res) {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    res.status(401).json({ error: "Admin access required" });
    return false;
  }
  return true;
}
