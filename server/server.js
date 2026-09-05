import express from "express";
import cors from "cors";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { buildSeed } from "./seedData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 4000;
const ADMIN_KEY = process.env.ADMIN_KEY || "campus-admin";

const genId = () => crypto.randomBytes(6).toString("hex");

// --- Tiny JSON-file "database" ---------------------------------------
// Fine for a single campus group's scale. Writes are serialized through
// a queue so two requests landing at the same moment can't clobber each
// other. If you outgrow this, swap readDB/writeDB for a real database —
// nothing else in this file needs to change.
let writeQueue = Promise.resolve();

async function readDB() {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { campaigns: [], donations: [] };
  }
}

function writeDB(db) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DB_FILE, JSON.stringify(db, null, 2))
  );
  return writeQueue;
}

// --- App ---------------------------------------------------------------
const app = express();
app.use(cors());
// Event photos arrive as base64 data URLs, so the body can get sizeable.
app.use(express.json({ limit: "20mb" }));

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.get("x-admin-key") !== ADMIN_KEY) {
    return res.status(401).json({ error: "Admin access required" });
  }
  next();
}

router.get("/admin/verify", requireAdmin, (req, res) => {
  res.json({ ok: true });
});

router.get("/campaigns", async (req, res) => {
  const db = await readDB();
  res.json(db.campaigns);
});

router.post("/campaigns", requireAdmin, async (req, res) => {
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
  res.status(201).json(campaign);
});

router.patch("/campaigns/:id", requireAdmin, async (req, res) => {
  const db = await readDB();
  const idx = db.campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Event not found" });
  db.campaigns[idx] = { ...db.campaigns[idx], ...req.body };
  await writeDB(db);
  res.json(db.campaigns[idx]);
});

router.delete("/campaigns/:id", requireAdmin, async (req, res) => {
  const db = await readDB();
  const idx = db.campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Event not found" });
  db.campaigns.splice(idx, 1);
  db.donations = db.donations.filter((d) => d.campaignId !== req.params.id);
  await writeDB(db);
  res.json({ ok: true });
});

router.get("/donations", async (req, res) => {
  const db = await readDB();
  const { campaignId } = req.query;
  const list = campaignId
    ? db.donations.filter((d) => d.campaignId === campaignId)
    : db.donations;
  res.json(list);
});

router.post("/donations", async (req, res) => {
  const { campaignId, donorName, department, programme, amount } = req.body;
  if (!campaignId || !donorName || !department || !programme || !amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const db = await readDB();
  const donation = { ...req.body, id: genId(), createdAt: Date.now() };
  db.donations.unshift(donation);
  await writeDB(db);
  res.status(201).json(donation);
});

router.post("/seed", requireAdmin, async (req, res) => {
  const db = await readDB();
  const { campaigns, donations } = buildSeed(genId);
  const existingThemes = new Set(db.campaigns.map((campaign) => campaign.theme));
  const missingCampaigns = campaigns.filter((campaign) => !existingThemes.has(campaign.theme));
  const missingIds = new Set(missingCampaigns.map((campaign) => campaign.id));
  const missingDonations = donations.filter((donation) => missingIds.has(donation.campaignId));
  db.campaigns = [...missingCampaigns, ...db.campaigns];
  db.donations = [...missingDonations, ...db.donations];
  await writeDB(db);
  res.json({ ok: true, added: missingCampaigns.length });
});

app.use("/api", router);

// --- Serve the built React app in production ---------------------------
// After `npm run build` in /client, its output lands in /client/dist.
// This lets one Node process serve both the API and the site, so there's
// only one thing to deploy and no CORS to worry about in production.
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(200).send("Campus Fund API is running. Build the client to serve the site from here.");
  });
});

app.listen(PORT, () => {
  console.log(`Campus Fund server listening on http://localhost:${PORT}`);
});