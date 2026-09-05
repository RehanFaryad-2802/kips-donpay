import React, { useState, useEffect, useCallback } from "react";
import { QrCode, Plus, ArrowLeft, Shield, Wallet } from "lucide-react";

const ACCOUNT_TYPES = ["JazzCash", "Easypaisa", "HBL", "Bank Transfer"];

const THEMES = [
  { id: "general", label: "General Event", emoji: "📌", color: "#D9AF3E", soft: "rgba(217,175,62,0.18)", pageBg: "#252014", surface: "#342C1C" },
  { id: "independence", label: "Independence Day", emoji: "🇵🇰", color: "#32B968", soft: "rgba(50,185,104,0.2)", pageBg: "#0F2A1D", surface: "#173B2A" },
  { id: "milad", label: "Milad-un-Nabi", emoji: "🌙", color: "#E2B83F", soft: "rgba(226,184,63,0.2)", pageBg: "#2B2412", surface: "#3B311A" },
  { id: "convocation", label: "Convocation", emoji: "🎓", color: "#6689D6", soft: "rgba(102,137,214,0.2)", pageBg: "#172039", surface: "#233354" },
  { id: "sports", label: "Sports Gala", emoji: "🏆", color: "#F0783E", soft: "rgba(240,120,62,0.2)", pageBg: "#2A1810", surface: "#3C2417" },
  { id: "cultural", label: "Cultural Mela", emoji: "🎨", color: "#D166B9", soft: "rgba(209,102,185,0.2)", pageBg: "#2C1829", surface: "#42233B" },
  { id: "charity", label: "Charity Drive", emoji: "🤝", color: "#35C2B7", soft: "rgba(53,194,183,0.2)", pageBg: "#102B2A", surface: "#19403E" },
  { id: "farewell", label: "Farewell", emoji: "🎊", color: "#A477D9", soft: "rgba(164,119,217,0.2)", pageBg: "#241832", surface: "#35234B" },
];

const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

// Best-effort guess from the event title, so the admin gets a sensible default they can still override.
const suggestTheme = (title) => {
  const t = (title || "").toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));
  if (has("independence", "14 august", "azadi", "pakistan day", "flag hoisting")) return "independence";
  if (has("milad", "mawlid", "rabi ul awal", "rabi-ul-awal", "eid milad", "naat")) return "milad";
  if (has("convocation", "graduation", "degree", "farewell dinner")) return "convocation";
  if (has("sports", "gala", "tournament", "match", "olympiad", "athletics")) return "sports";
  if (has("mela", "cultural", "festival", "fest", "carnival")) return "cultural";
  if (has("charity", "welfare", "relief", "flood", "donation drive", "fundraiser")) return "charity";
  if (has("farewell", "alumni", "reunion", "send-off", "send off")) return "farewell";
  return "general";
};

const genId = () => Math.random().toString(36).slice(2, 10);

const qrUrl = (data) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(data)}`;

// Copies text to the clipboard; returns true/false so callers can show feedback.
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    return false;
  }
};

const currency = (n) =>
  "Rs " + Number(n || 0).toLocaleString("en-PK");

// datetime-local values ("2026-08-14T08:00") are stored as-is and read back as local time.
const fmtDate = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};
const fmtTime = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};
const formatSchedule = (eventDate) => {
  if (!eventDate) return "";
  return `${fmtDate(eventDate)} · ${fmtTime(eventDate)}`;
};

const closestCampaignTheme = (campaigns) => {
  if (!campaigns.length) return THEMES[0];
  const target = Date.now();
  const openCampaigns = campaigns.filter((campaign) => !campaign.closed);
  const candidates = openCampaigns.length ? openCampaigns : campaigns;
  return candidates.reduce((closest, campaign) => {
    if (!campaign.eventDate) return closest;
    const distance = Math.abs(new Date(campaign.eventDate).getTime() - target);
    return !closest || distance < closest.distance
      ? { theme: getTheme(campaign.theme), distance }
      : closest;
  }, null)?.theme || THEMES[0];
};

const MAX_EVENT_IMAGES = 8;
const DONOR_PROFILE_KEY = "campus-fund-donor-profile";

const loadDonorProfile = () => {
  try {
    return JSON.parse(localStorage.getItem(DONOR_PROFILE_KEY) || "{}");
  } catch (error) {
    return {};
  }
};

const paidDonationKey = (campaignId, profile) => {
  const identity = [profile.name, profile.department, profile.programme]
    .map((value) => (value || "").trim().toLowerCase())
    .join("|");
  return `campus-fund-paid:${campaignId}:${encodeURIComponent(identity)}`;
};

const hasPaidDonation = (campaignId, profile) => {
  try {
    return localStorage.getItem(paidDonationKey(campaignId, profile)) === "yes";
  } catch (error) {
    return false;
  }
};

const markPaidDonation = (campaignId, profile) => {
  try {
    localStorage.setItem(paidDonationKey(campaignId, profile), "yes");
  } catch (error) {
    // The success state still works when browser storage is unavailable.
  }
};

const introSeenKey = (campaignId) => `campus-fund-intro-seen:${campaignId}`;
const hasSeenIntro = (campaignId) => {
  try {
    return localStorage.getItem(introSeenKey(campaignId)) === "yes";
  } catch (error) {
    return false;
  }
};

const markIntroSeen = (campaignId) => {
  try {
    localStorage.setItem(introSeenKey(campaignId), "yes");
  } catch (error) {
    // Continue without persistence when browser storage is unavailable.
  }
};

// Resize + compress a picked image file down to a small JPEG data URL so it's cheap to store.
const fileToCompressedDataUrl = (file, maxDim = 900, quality = 0.72) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read that image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });

// Same-origin API — works in dev (via the Vite proxy) and in production
// (the Express server serves both the API and the built client).
const API = "/api";
const isAdminPortal = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "1";

export default function CampusFund() {
  const [role, setRole] = useState("donor"); // donor | admin
  const [adminKey, setAdminKey] = useState("");
  const adminPortal = isAdminPortal();
  const [adminLoginOpen, setAdminLoginOpen] = useState(adminPortal);
  const [adminLoginError, setAdminLoginError] = useState("");
  const [campaigns, setCampaigns] = useState(null);
  const [donations, setDonations] = useState(null);
  const [selected, setSelected] = useState(null); // campaign id
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [toast, setToast] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    try {
      const [cRes, dRes] = await Promise.all([fetch(`${API}/campaigns`), fetch(`${API}/donations`)]);
      if (!cRes.ok || !dRes.ok) throw new Error("Server error");
      setCampaigns(await cRes.json());
      setDonations(await dRes.json());
      setLoadError(false);
    } catch (e) {
      setCampaigns([]);
      setDonations([]);
      setLoadError(true);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCampaign = async (campaign) => {
    try {
      const res = await fetch(`${API}/campaigns`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify(campaign),
      });
      if (!res.ok) throw new Error("Failed");
      const created = await res.json();
      setCampaigns((prev) => [created, ...prev]);
      setShowNewCampaign(false);
      flash("Event created");
    } catch (e) {
      flash("Could not create the event — check your connection and try again");
    }
  };

  const addDonation = async (donation) => {
    try {
      const res = await fetch(`${API}/donations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donation),
      });
      if (!res.ok) throw new Error("Failed");
      const created = await res.json();
      setDonations((prev) => [created, ...prev]);
      flash("Contribution logged");
    } catch (e) {
      flash("Could not log that — check your connection and try again");
      throw e;
    }
  };

  const updateCampaign = async (campaignId, patch) => {
    // Optimistic update so photo/theme/schedule edits feel instant.
    setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, ...patch } : c)));
    try {
      const res = await fetch(`${API}/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? updated : c)));
    } catch (e) {
      flash("Could not save that change — reloading");
      load();
    }
  };

  const closeCampaign = (id) => {
    const c = campaigns.find((c) => c.id === id);
    const closed = !c.closed;
    updateCampaign(id, { closed, closedAt: closed ? Date.now() : null });
  };

  const deleteCampaign = async (id) => {
    try {
      const res = await fetch(`${API}/campaigns/${id}`, { method: "DELETE", headers: adminHeaders });
      if (!res.ok) throw new Error("Failed");
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      setDonations((prev) => prev.filter((d) => d.campaignId !== id));
      setSelected(null);
      flash("Event deleted");
    } catch (e) {
      flash("Could not delete the event — check your connection and try again");
    }
  };

  const seedDemo = async () => {
    try {
      const res = await fetch(`${API}/seed`, { method: "POST", headers: adminHeaders });
      if (!res.ok) throw new Error("Failed");
      await load();
      flash("Sample data loaded");
    } catch (e) {
      flash("Could not load sample data — check your connection");
    }
  };

  const verifyAdmin = async (key) => {
    const res = await fetch(`${API}/admin/verify`, { headers: { "x-admin-key": key } });
    if (!res.ok) throw new Error("Invalid admin key");
    setAdminKey(key);
    setRole("admin");
    setAdminLoginOpen(false);
    setAdminLoginError("");
  };

  const adminHeaders = { "Content-Type": "application/json", "x-admin-key": adminKey };

  const raisedTotal = (campaignId) =>
    donations
      .filter((d) => d.campaignId === campaignId)
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  if (!loaded) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>Opening the ledger…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>
          Can't reach the server. Make sure it's running, then{" "}
          <button onClick={load} style={{ ...styles.secondaryBtn, marginLeft: 4 }}>retry</button>
        </div>
      </div>
    );
  }

  const activeCampaign = campaigns.find((c) => c.id === selected);
  const pageTheme = activeCampaign ? getTheme(activeCampaign.theme) : closestCampaignTheme(campaigns);
  const pageThemeStyles = {
    "--accent": pageTheme.color,
    "--accent-soft": pageTheme.soft,
    "--page-bg": pageTheme.pageBg,
    "--surface": pageTheme.surface,
    "--border": `${pageTheme.color}88`,
    "--text": "#F3F6F4",
    "--muted": "#B5C0BD",
  };

  return (
    <div style={{ ...styles.page, ...pageThemeStyles }} className="cf-page">
      <style>{fontFace}</style>
      <header style={styles.header} className="cf-header">
        <div style={styles.brand}>
          <div style={styles.brandMark}>CF</div>
          <div>
            <div style={styles.brandTitle}>Campus Fund</div>
            <div style={styles.brandSub} className="cf-brand-sub">Event contributions, logged openly</div>
          </div>
        </div>
        <div style={styles.roleSwitch} className="cf-role-switch">
          {!adminPortal && role !== "admin" && (
            <button
              onClick={() => { setRole("donor"); setSelected(null); }}
              style={{ ...styles.roleBtn, ...(role === "donor" ? styles.roleBtnActive : {}) }}
            >
              <Wallet size={15} style={{ marginRight: 6 }} />
              Give
            </button>
          )}
          {(adminPortal || role === "admin") && (
            <button
              onClick={() => {
                if (role === "admin") {
                  setRole("donor");
                  setSelected(null);
                } else {
                  setAdminLoginOpen(true);
                }
              }}
              style={{ ...styles.roleBtn, ...(role === "admin" ? styles.roleBtnActive : {}) }}
            >
              <Shield size={15} style={{ marginRight: 6 }} />
              {role === "admin" ? "Admin" : "Admin login"}
            </button>
          )}
        </div>
      </header>

      {toast && <div style={styles.toast} className="cf-toast">{toast}</div>}

      <main style={styles.main} className="cf-main">
        {adminLoginOpen && role !== "admin" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await verifyAdmin(e.currentTarget.elements.adminKey.value);
              } catch (error) {
                setAdminLoginError("That admin key is not valid.");
              }
            }}
            style={{ ...styles.form, ...styles.adminLogin }}
          >
            <h1 style={styles.h1} className="cf-h1">Admin access</h1>
            <Field label="Admin key">
              <input name="adminKey" type="password" autoFocus style={styles.input} />
            </Field>
            {adminLoginError && <div style={styles.error}>{adminLoginError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" style={styles.primaryBtn}>Unlock admin</button>
              <button type="button" onClick={() => setAdminLoginOpen(false)} style={styles.secondaryBtn}>Cancel</button>
            </div>
          </form>
        )}

        {role === "donor" && !activeCampaign && (
          <DonorList campaigns={campaigns} raisedTotal={raisedTotal} onOpen={setSelected} />
        )}

        {role === "donor" && activeCampaign && (
          <DonorDetail
            campaign={activeCampaign}
            onBack={() => setSelected(null)}
            onSubmit={addDonation}
          />
        )}

        {role === "admin" && !showNewCampaign && !activeCampaign && (
          <AdminList
            campaigns={campaigns}
            raisedTotal={raisedTotal}
            onNew={() => setShowNewCampaign(true)}
            onOpen={setSelected}
            onSeed={seedDemo}
          />
        )}

        {role === "admin" && showNewCampaign && (
          <NewCampaignForm onCancel={() => setShowNewCampaign(false)} onCreate={addCampaign} />
        )}

        {role === "admin" && activeCampaign && !showNewCampaign && (
          <AdminDetail
            campaign={activeCampaign}
            donations={donations.filter((d) => d.campaignId === activeCampaign.id)}
            onBack={() => setSelected(null)}
            onToggleClose={() => closeCampaign(activeCampaign.id)}
            onDelete={() => deleteCampaign(activeCampaign.id)}
            onUpdateCampaign={(patch) => updateCampaign(activeCampaign.id, patch)}
            flash={flash}
          />
        )}
      </main>
    </div>
  );
}

const CLOSED_VISIBLE_MS = 12 * 60 * 60 * 1000; // how long a closed event still shows to donors

function DonorList({ campaigns, raisedTotal, onOpen }) {
  const open = campaigns.filter((c) => !c.closed);
  const closed = campaigns.filter(
    (c) => c.closed && (!c.closedAt || Date.now() - c.closedAt < CLOSED_VISIBLE_MS)
  );
  return (
    <div>
      <h1 style={styles.h1} className="cf-h1">What's happening on campus</h1>
      <p style={styles.lead}>Pick an event, scan the QR code, send what you can, then log it below.</p>

      {open.length === 0 && (
        <EmptyState text="No events open right now. Check back once one is posted." />
      )}

      <div style={styles.grid} className="cf-grid">
        {open.map((c) => (
          <CampaignCard key={c.id} c={c} raised={raisedTotal(c.id)} onOpen={() => onOpen(c.id)} />
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <div style={styles.sectionDivider}>Closed</div>
          <div style={styles.grid} className="cf-grid">
            {closed.map((c) => (
              <CampaignCard key={c.id} c={c} raised={raisedTotal(c.id)} onOpen={() => onOpen(c.id)} dim />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CampaignCard({ c, raised, onOpen, dim }) {
  const cover = c.images && c.images.length ? c.images[0].dataUrl : null;
  const schedule = formatSchedule(c.eventDate);
  const theme = getTheme(c.theme);
  return (
    <button onClick={onOpen} style={{ ...styles.card, ...(dim ? { opacity: 0.55 } : {}), borderTop: `3px solid ${theme.color}` }}>
      {cover && <img src={cover} alt="" style={styles.cardCover} />}
      <div style={{ ...styles.themeBadge, background: theme.soft, color: theme.color }}>
        <span>{theme.emoji}</span>{theme.label}
      </div>
      <div style={styles.cardTitle}>{c.title}</div>
      <div style={styles.cardDesc}>{c.description}</div>
      {(schedule || c.venue) && (
        <div style={{ ...styles.cardSchedule, color: theme.color, marginBottom: 0 }}>
          {schedule}
          {schedule && c.venue ? " · " : ""}
          {c.venue}
        </div>
      )}
      {c.closed && <div style={styles.closedTag}>Closed</div>}
    </button>
  );
}

function ThemeIntroEffect({ theme, campaignId }) {
  const [visible, setVisible] = useState(() => !hasSeenIntro(campaignId));

  useEffect(() => {
    if (!visible) return undefined;
    markIntroSeen(campaignId);
    const timer = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(timer);
  }, [campaignId, visible]);

  if (!visible) return null;

  const confettiPalettes = {
    independence: ["#32B968", "#F3F7F0", "#D4AF37"],
    milad: ["#E2B83F", "#FFF0A8", "#A87920"],
    convocation: ["#6689D6", "#F2C14E", "#DDE7FF"],
    sports: ["#F0783E", "#FFD166", "#F7F7F2"],
    cultural: ["#D166B9", "#F4A261", "#55C1FF"],
    charity: ["#35C2B7", "#B8F2E6", "#F3F7F0"],
    farewell: ["#A477D9", "#F19CFF", "#FFD166"],
    general: ["#FF4D6D", "#FF9F1C", "#FFD166", "#2EC4B6", "#42A5F5"],
  };
  const confettiColors = confettiPalettes[theme.id] || confettiPalettes.general;
  const confetti = Array.from({ length: 46 }, (_, index) => {
    const angle = (index / 46) * Math.PI * 2;
    const distance = 22 + (index % 7) * 5;
    return {
      color: confettiColors[index % confettiColors.length],
      x: Math.round(Math.cos(angle) * distance),
      y: Math.round(Math.sin(angle) * distance + 18 + (index % 5) * 7),
      rotate: (index * 47) % 360,
      delay: (index % 9) * 35,
      width: 5 + (index % 3) * 2,
      height: 9 + (index % 4) * 3,
    };
  });

  return (
    <div
      style={{ ...styles.themeIntro, "--intro-color": theme.color }}
      className={`cf-theme-intro cf-intro-${theme.id}`}
      aria-hidden="true"
    >
      <div style={styles.introGlow} />
      <div className="cf-intro-decor" />
      <div style={styles.introMotifs}>
        {confetti.map((piece, index) => (
          <span
            key={index}
            className="cf-confetti"
            style={{
              "--confetti-color": piece.color,
              "--confetti-x": `${piece.x}vw`,
              "--confetti-y": `${piece.y}vh`,
              "--confetti-rotate": `${piece.rotate}deg`,
              "--confetti-delay": `${piece.delay}ms`,
              "--confetti-width": `${piece.width}px`,
              "--confetti-height": `${piece.height}px`,
            }}
          />
        ))}
      </div>
      <div style={styles.introTitle}>{theme.label}</div>
    </div>
  );
}

function DonorDetail({ campaign, onBack, onSubmit }) {
  const savedProfile = loadDonorProfile();
  const [form, setForm] = useState({
    name: savedProfile.name || "",
    department: savedProfile.department || "",
    programme: savedProfile.programme || "",
    amount: "",
    ref: "",
  });
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [sent, setSent] = useState(() => hasPaidDonation(campaign.id, savedProfile));

  useEffect(() => {
    try {
      localStorage.setItem(DONOR_PROFILE_KEY, JSON.stringify({
        name: form.name,
        department: form.department,
        programme: form.programme,
      }));
    } catch (error) {
      // The form still works when browser storage is unavailable.
    }
  }, [form.name, form.department, form.programme]);

  const schedule = formatSchedule(campaign.eventDate);
  const theme = getTheme(campaign.theme);
  const [copied, setCopied] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotError, setScreenshotError] = useState("");
  const copyAccountNumber = async () => {
    const ok = await copyToClipboard(campaign.accountNumber);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleScreenshotFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      // Keep resolution/quality higher than event photos — the transaction ID and amount need to stay readable.
      setScreenshot(await fileToCompressedDataUrl(file, 1000, 0.85));
      setScreenshotError("");
    } catch (err) {
      setScreenshotError("Couldn't read that image — try a different file.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.department.trim() || !form.programme.trim() || !form.amount) {
      setError("Fill in your name, department, programme, and the amount.");
      return;
    }
    if (Number(form.amount) <= 0) {
      setError("Amount should be more than zero.");
      return;
    }
    if (!screenshot) {
      setError("Attach a screenshot of your payment so it can be verified.");
      return;
    }
    setError("");
    try {
      await onSubmit({
        campaignId: campaign.id,
        donorName: form.name.trim(),
        department: form.department.trim(),
        programme: form.programme.trim(),
        amount: Number(form.amount),
        ref: form.ref.trim(),
        screenshot,
      });
      markPaidDonation(campaign.id, form);
      setForm((prev) => ({ ...prev, amount: "", ref: "" }));
      setScreenshot(null);
      setSent(true);
    } catch (e) {
      // onSubmit already showed a toast — keep the form filled in so nothing's lost.
    }
  };

  return (
    <div style={styles.narrow}>
      <ThemeIntroEffect theme={theme} campaignId={campaign.id} />
      <button onClick={onBack} style={styles.backBtn}><ArrowLeft size={16} style={{ marginRight: 6 }} />All events</button>

      <h1 style={styles.h1} className="cf-h1">{campaign.title}</h1>
      <div style={{ ...styles.themeBadge, background: theme.soft, color: theme.color }}>
        <span>{theme.emoji}</span>{theme.label}
      </div>
      {(schedule || campaign.venue) && (
        <div style={{ ...styles.detailSchedule, color: theme.color }}>
          {schedule}
          {schedule && campaign.venue ? " · " : ""}
          {campaign.venue}
        </div>
      )}
      <p style={styles.lead}>{campaign.description}</p>

      {campaign.images && campaign.images.length > 0 && (
        <div style={styles.gallery} className="cf-gallery">
          {campaign.images.map((img) => (
            <img
              key={img.id}
              src={img.dataUrl}
              alt=""
              style={styles.galleryThumb}
              onClick={() => setLightbox(img.dataUrl)}
            />
          ))}
        </div>
      )}

      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={styles.lightboxImg} />
        </div>
      )}

      <div style={styles.payBox} className="cf-pay-box">
        <img
          src={campaign.paymentQrImage || qrUrl(`${campaign.accountType} ${campaign.accountNumber} ${campaign.accountTitle}`)}
          alt="Payment QR code"
          style={styles.qrImg}
          className="cf-qr"
        />
        <div style={styles.payDetails}>
          <div style={styles.payRow}><span style={styles.payLabel}>Send via</span><span>{campaign.accountType}</span></div>
          <div style={styles.payRow}>
            <span style={styles.payLabel}>Account no.</span>
            <span style={styles.mono}>
              {campaign.accountNumber}{" "}
              <button type="button" onClick={copyAccountNumber} style={styles.copyBtn}>{copied ? "Copied" : "Copy"}</button>
            </span>
          </div>
          <div style={styles.payRow}><span style={styles.payLabel}>Account title</span><span>{campaign.accountTitle}</span></div>
          <div style={styles.hint}>
            {campaign.paymentQrImage
              ? "Scan this from your own payment app's \"Scan QR\" option — it fills in the recipient for you. On your own phone, it's usually faster to tap Copy and paste the number into your app's send-money screen."
              : "Tap Copy and paste the number into your payment app's send-money screen. Ask the organiser to add a Scan & Pay QR for a faster option."}
          </div>
        </div>
      </div>

      {campaign.closed ? (
        <div style={styles.closedNotice}>This event is closed and no longer accepting contributions.</div>
      ) : sent ? (
        <div style={styles.closedNotice}>
          Thanks — your contribution has been logged.
          <button
            onClick={() => setSent(false)}
            style={{ ...styles.secondaryBtn, marginTop: 10 }}
          >
            Donate more
          </button>
        </div>
      ) : (
        <form onSubmit={submit} style={styles.form}>
          <div style={styles.formRow2} className="cf-form-row2">
            <Field label="Your name">
              <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ayesha Khan" />
            </Field>
            <Field label="Amount sent">
              <input style={styles.input} type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 500" />
            </Field>
          </div>
          <div style={styles.formRow2} className="cf-form-row2">
            <Field label="Department">
              <input style={styles.input} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Computer Science" />
            </Field>
            <Field label="Programme">
              <input style={styles.input} value={form.programme} onChange={(e) => setForm({ ...form, programme: e.target.value })} placeholder="e.g. BS(CS) 2023" />
            </Field>
          </div>
          <Field label="Transaction ID (optional, speeds up verification)">
            <input style={styles.input} value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="e.g. TXN00123456" />
          </Field>
          <Field label="Screenshot of your payment (required)">
            {screenshot ? (
              <div style={styles.galleryThumbWrap}>
                <img src={screenshot} alt="" style={styles.galleryThumb} />
                <button type="button" onClick={() => setScreenshot(null)} style={styles.removeImgBtn}>×</button>
              </div>
            ) : (
              <label style={styles.uploadTile}>
                + Add screenshot
                <input type="file" accept="image/*" onChange={handleScreenshotFile} style={{ display: "none" }} />
              </label>
            )}
            {screenshotError && <div style={styles.error}>{screenshotError}</div>}
          </Field>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.primaryBtn}>Log my contribution</button>
        </form>
      )}
    </div>
  );
}

function AdminList({ campaigns, raisedTotal, onNew, onOpen, onSeed }) {
  return (
    <div>
      <div style={styles.adminHeaderRow} className="cf-admin-header-row">
        <h1 style={styles.h1} className="cf-h1">Events</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSeed} style={styles.secondaryBtn}>Load sample data</button>
          <button onClick={onNew} style={styles.primaryBtn}><Plus size={16} style={{ marginRight: 6 }} />New event</button>
        </div>
      </div>
      {campaigns.length === 0 ? (
        <div>
          <EmptyState text="No events yet. Create one, or load sample data to see how it works." />
        </div>
      ) : (
        <div style={styles.adminTable}>
          {campaigns.map((c) => {
            const theme = getTheme(c.theme);
            return (
              <button key={c.id} onClick={() => onOpen(c.id)} style={{ ...styles.adminRow, borderLeft: `3px solid ${theme.color}` }} className="cf-admin-row">
                <div>
                  <div style={styles.cardTitle}>{theme.emoji} {c.title}</div>
                  <div style={styles.cardMeta}>{c.accountType} · {c.accountNumber}</div>
                </div>
                <div style={styles.adminRowRight} className="cf-admin-row-right">
                  <div style={styles.donorAmount}>{currency(raisedTotal(c.id))}</div>
                  {c.closed && <div style={styles.closedTag}>Closed</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCampaignForm({ onCancel, onCreate }) {
  const [form, setForm] = useState({
    title: "", description: "", goal: "",
    accountType: ACCOUNT_TYPES[0], accountNumber: "", accountTitle: "",
    venue: "", eventDate: "",
  });
  const [themeId, setThemeId] = useState("general");
  const [themeTouched, setThemeTouched] = useState(false);
  const [images, setImages] = useState([]);
  const [paymentQrImage, setPaymentQrImage] = useState(null);
  const [error, setError] = useState("");

  const handleTitleChange = (title) => {
    setForm((prev) => ({ ...prev, title }));
    if (!themeTouched) setThemeId(suggestTheme(title));
  };

  const pickTheme = (id) => {
    setThemeId(id);
    setThemeTouched(true);
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_EVENT_IMAGES - images.length;
    if (room <= 0) {
      setError(`You can attach up to ${MAX_EVENT_IMAGES} photos.`);
      return;
    }
    try {
      const picked = await Promise.all(
        files.slice(0, room).map(async (f) => ({ id: genId(), dataUrl: await fileToCompressedDataUrl(f) }))
      );
      setImages((prev) => [...prev, ...picked]);
    } catch (err) {
      setError("Couldn't read one of those images — try a different file.");
    }
  };

  const removeImage = (id) => setImages((prev) => prev.filter((img) => img.id !== id));

  const handleQrFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      // Higher quality / larger size than event photos — a blurry QR won't scan.
      setPaymentQrImage(await fileToCompressedDataUrl(file, 500, 0.92));
    } catch (err) {
      setError("Couldn't read that QR image — try a different file.");
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.accountNumber.trim() || !form.accountTitle.trim()) {
      setError("Event title, account number, and account title are required.");
      return;
    }
    onCreate({ ...form, goal: Number(form.goal) || 0, images, paymentQrImage, theme: themeId });
  };

  return (
    <div style={styles.narrow}>
      <button onClick={onCancel} style={styles.backBtn}><ArrowLeft size={16} style={{ marginRight: 6 }} />Cancel</button>
      <h1 style={styles.h1} className="cf-h1">New event</h1>
      <form onSubmit={submit} style={styles.form}>
        <Field label="Event title">
          <input style={styles.input} value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="e.g. Spring Convocation Fund" />
        </Field>
        <Field label="Description">
          <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the money is for" />
        </Field>

        <div style={styles.sectionDivider}>Theme</div>
        <div style={styles.themeGrid} className="cf-theme-grid">
          {THEMES.map((t) => {
            const active = t.id === themeId;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => pickTheme(t.id)}
                style={{
                  ...styles.themeSwatch,
                  background: t.soft,
                  borderColor: active ? t.color : "var(--border)",
                  boxShadow: active ? `0 0 0 1px ${t.color}` : "none",
                }}
              >
                <span style={{ fontSize: 18 }}>{t.emoji}</span>
                <span style={{ color: active ? t.color : "#C7CDD6", fontWeight: active ? 700 : 500 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        <Field label="Goal amount (optional)">
          <input style={styles.input} type="number" min="0" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="e.g. 50000" />
        </Field>

        <div style={styles.sectionDivider}>Schedule & venue</div>
        <Field label="Venue / location">
          <input style={styles.input} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="e.g. Main Auditorium" />
        </Field>
        <Field label="Event date (when will the event happen)">
          <input style={styles.input} type="datetime-local" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
        </Field>

        <div style={styles.sectionDivider}>Receiving account</div>
        <div style={styles.formRow2} className="cf-form-row2">
          <Field label="Payment method">
            <select style={styles.input} value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Account number">
            <input style={styles.input} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="e.g. 0300-1234567" />
          </Field>
        </div>
        <Field label="Account title">
          <input style={styles.input} value={form.accountTitle} onChange={(e) => setForm({ ...form, accountTitle: e.target.value })} placeholder="e.g. Bilal Ahmed" />
        </Field>
        <Field label="Scan & Pay QR (optional, but makes scanning actually work)">
          {paymentQrImage ? (
            <div style={styles.galleryThumbWrap}>
              <img src={paymentQrImage} alt="" style={styles.galleryThumb} />
              <button type="button" onClick={() => setPaymentQrImage(null)} style={styles.removeImgBtn}>×</button>
            </div>
          ) : (
            <label style={styles.uploadTile}>
              + Add QR
              <input type="file" accept="image/*" onChange={handleQrFile} style={{ display: "none" }} />
            </label>
          )}
          <div style={styles.hint}>
            From the receiving account's own app: JazzCash / Easypaisa / bank app → "Receive Money" or "My QR" → screenshot it.
          </div>
        </Field>

        <div style={styles.sectionDivider}>Event photos (optional)</div>
        <div style={styles.gallery} className="cf-gallery">
          {images.map((img) => (
            <div key={img.id} style={styles.galleryThumbWrap}>
              <img src={img.dataUrl} alt="" style={styles.galleryThumb} />
              <button type="button" onClick={() => removeImage(img.id)} style={styles.removeImgBtn}>×</button>
            </div>
          ))}
          {images.length < MAX_EVENT_IMAGES && (
            <label style={styles.uploadTile}>
              + Add photos
              <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
            </label>
          )}
        </div>

        {error && <div style={styles.error}>{error}</div>}
        <button type="submit" style={styles.primaryBtn}><QrCode size={16} style={{ marginRight: 6 }} />Create & generate QR</button>
      </form>
    </div>
  );
}

function AdminDetail({ campaign, donations, onBack, onToggleClose, onDelete, onUpdateCampaign, flash }) {
  const total = donations.reduce((s, d) => s + Number(d.amount), 0);
  const images = campaign.images || [];
  const [lightbox, setLightbox] = useState(null);
  const [imgError, setImgError] = useState("");
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    venue: campaign.venue || "", eventDate: campaign.eventDate || "",
  });
  const [themeDraft, setThemeDraft] = useState(campaign.theme || "general");

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_EVENT_IMAGES - images.length;
    if (room <= 0) {
      setImgError(`You can attach up to ${MAX_EVENT_IMAGES} photos per event.`);
      return;
    }
    try {
      const picked = await Promise.all(
        files.slice(0, room).map(async (f) => ({ id: genId(), dataUrl: await fileToCompressedDataUrl(f) }))
      );
      setImgError("");
      onUpdateCampaign({ images: [...images, ...picked] });
      flash && flash(picked.length > 1 ? "Photos added" : "Photo added");
    } catch (err) {
      setImgError("Couldn't read one of those images — try a different file.");
    }
  };

  const removeImage = (id) => onUpdateCampaign({ images: images.filter((img) => img.id !== id) });

  const [qrError, setQrError] = useState("");
  const handleQrFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      // Higher quality / larger size than event photos — a blurry QR won't scan.
      const dataUrl = await fileToCompressedDataUrl(file, 500, 0.92);
      setQrError("");
      onUpdateCampaign({ paymentQrImage: dataUrl });
      flash && flash("Payment QR updated");
    } catch (err) {
      setQrError("Couldn't read that image — try a different file.");
    }
  };

  const startEditSchedule = () => {
    setScheduleForm({ venue: campaign.venue || "", eventDate: campaign.eventDate || "" });
    setThemeDraft(campaign.theme || "general");
    setEditingSchedule(true);
  };

  const saveSchedule = (e) => {
    e.preventDefault();
    onUpdateCampaign({ venue: scheduleForm.venue.trim(), eventDate: scheduleForm.eventDate, theme: themeDraft });
    setEditingSchedule(false);
    flash && flash("Event details updated");
  };

  const schedule = formatSchedule(campaign.eventDate);
  const theme = getTheme(campaign.theme);

  return (
    <div>
      <button onClick={onBack} style={styles.backBtn}><ArrowLeft size={16} style={{ marginRight: 6 }} />All events</button>
      <div style={styles.adminHeaderRow} className="cf-admin-header-row">
        <h1 style={styles.h1} className="cf-h1">{campaign.title}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onToggleClose} style={styles.secondaryBtn}>{campaign.closed ? "Reopen event" : "Close event"}</button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${campaign.title}"? This also removes its ${donations.length} logged donation(s). This can't be undone.`)) {
                onDelete();
              }
            }}
            style={{ ...styles.secondaryBtn, borderColor: "#E08A8A", color: "#E08A8A" }}
          >
            Delete event
          </button>
        </div>
      </div>

      <div style={styles.sectionDivider}>Theme, schedule & venue</div>
      {editingSchedule ? (
        <form onSubmit={saveSchedule} style={{ ...styles.form, marginBottom: 20 }}>
          <div style={styles.themeGrid} className="cf-theme-grid">
            {THEMES.map((t) => {
              const active = t.id === themeDraft;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setThemeDraft(t.id)}
                  style={{
                    ...styles.themeSwatch,
                    background: t.soft,
                    borderColor: active ? t.color : "var(--border)",
                    boxShadow: active ? `0 0 0 1px ${t.color}` : "none",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{t.emoji}</span>
                  <span style={{ color: active ? t.color : "#C7CDD6", fontWeight: active ? 700 : 500 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
          <Field label="Venue / location">
            <input style={styles.input} value={scheduleForm.venue} onChange={(e) => setScheduleForm({ ...scheduleForm, venue: e.target.value })} placeholder="e.g. Main Auditorium" />
          </Field>
          <Field label="Event date (when will the event happen)">
            <input style={styles.input} type="datetime-local" value={scheduleForm.eventDate} onChange={(e) => setScheduleForm({ ...scheduleForm, eventDate: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={styles.primaryBtn}>Save</button>
            <button type="button" onClick={() => setEditingSchedule(false)} style={styles.secondaryBtn}>Cancel</button>
          </div>
        </form>
      ) : (
        <div style={styles.scheduleBox}>
          <div>
            <div style={{ ...styles.themeBadge, background: theme.soft, color: theme.color, marginBottom: 8 }}>
              <span>{theme.emoji}</span>{theme.label}
            </div>
            {schedule && <div style={styles.donorName}>{schedule}</div>}
            <div style={styles.donorDept}>{campaign.venue || "No venue set"}</div>
          </div>
          <button onClick={startEditSchedule} style={styles.secondaryBtn}>Edit</button>
        </div>
      )}

      <div style={styles.sectionDivider}>Photos</div>
      <div style={styles.gallery} className="cf-gallery">
        {images.map((img) => (
          <div key={img.id} style={styles.galleryThumbWrap}>
            <img src={img.dataUrl} alt="" style={styles.galleryThumb} onClick={() => setLightbox(img.dataUrl)} />
            <button type="button" onClick={() => removeImage(img.id)} style={styles.removeImgBtn}>×</button>
          </div>
        ))}
        {images.length < MAX_EVENT_IMAGES && (
          <label style={styles.uploadTile}>
            + Add photos
            <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
          </label>
        )}
      </div>
      {imgError && <div style={styles.error}>{imgError}</div>}

      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={styles.lightboxImg} />
        </div>
      )}

      <div style={styles.payBox} className="cf-pay-box">
        <img
          src={campaign.paymentQrImage || qrUrl(`${campaign.accountType} ${campaign.accountNumber} ${campaign.accountTitle}`)}
          alt="Payment QR code"
          style={styles.qrImg}
          className="cf-qr"
        />
        <div style={styles.payDetails}>
          <div style={styles.payRow}><span style={styles.payLabel}>Receiving</span><span>{campaign.accountType} · {campaign.accountNumber}</span></div>
          <div style={styles.payRow}><span style={styles.payLabel}>Title</span><span>{campaign.accountTitle}</span></div>
          <div style={styles.payRow}><span style={styles.payLabel}>Total received</span><span style={styles.donorAmount}>{currency(total)}</span></div>
        </div>
      </div>
      <label style={{ ...styles.secondaryBtn, display: "inline-block", cursor: "pointer", marginTop: -14, marginBottom: 20 }}>
        {campaign.paymentQrImage ? "Replace Scan & Pay QR" : "Upload Scan & Pay QR"}
        <input type="file" accept="image/*" onChange={handleQrFile} style={{ display: "none" }} />
      </label>
      {qrError && <div style={styles.error}>{qrError}</div>}
      <div style={styles.hint}>
        Get this from the receiving account's own app — JazzCash / Easypaisa / bank app → "Receive Money" or "My QR" → screenshot it. That's what makes scanning actually work for donors.
      </div>

      <div style={styles.sectionDivider}>Who's sent ({donations.length})</div>
      {donations.length === 0 ? <EmptyState text="No contributions logged yet." small /> : (
        <ul style={styles.donorList}>
          {donations.map((d) => (
            <li key={d.id} style={styles.adminDonationRow}>
              <div>
                <div style={styles.donorName}>{d.donorName}</div>
                <div style={styles.donorDept}>{d.department} · {d.programme}{d.ref ? ` · Ref: ${d.ref}` : ""}</div>
                {d.screenshot && (
                  <button type="button" onClick={() => setLightbox(d.screenshot)} style={{ ...styles.copyBtn, marginTop: 6, marginLeft: 0 }}>
                    View screenshot
                  </button>
                )}
              </div>
              <div style={styles.donorAmount}>{currency(d.amount)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ text, small }) {
  return <div style={{ ...styles.empty, ...(small ? { padding: "16px 0", fontSize: 13.5 } : {}) }}>{text}</div>;
}

const fontFace = `
  @import url('https://fonts.cdnfonts.com/css/lora');

  html, body, #root { min-height: 100%; background: var(--page-bg, #101820); }
  html, body { overflow-x: hidden; margin: 0; }
  .cf-page { overflow-x: hidden; width: 100%; min-height: 100vh; box-sizing: border-box; }
  .cf-header { flex-wrap: wrap; gap: 12px; }
  .cf-form-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .cf-pay-box { display: flex; gap: 20px; align-items: center; }
  .cf-admin-row { flex-wrap: wrap; gap: 10px; }
  .cf-admin-row-right { flex-wrap: wrap; }
  .cf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .cf-theme-intro { animation: cf-intro-fade 2.2s ease forwards; }
  .cf-intro-motif { animation: cf-intro-float 1.8s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--intro-index) * 70ms); }
  @keyframes cf-intro-fade {
    0%, 78% { opacity: 1; }
    100% { opacity: 0; visibility: hidden; }
  }
  @keyframes cf-intro-float {
    0% { opacity: 0; transform: translateY(55px) scale(.45) rotate(-14deg); }
    18% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-25vh) scale(1.25) rotate(14deg); }
  }
  .cf-confetti {
    position: absolute; left: 50%; top: 38%; width: var(--confetti-width); height: var(--confetti-height);
    background: var(--confetti-color); border-radius: 2px; opacity: 0;
    animation: cf-confetti-burst 2.4s cubic-bezier(.16,.8,.24,1) var(--confetti-delay) both;
  }
  @keyframes cf-confetti-burst {
    0% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg) scale(.2); }
    10% { opacity: 1; }
    55% { opacity: 1; transform: translate(calc(-50% + var(--confetti-x)), calc(-50% + var(--confetti-y) * .45)) rotate(var(--confetti-rotate)) scale(1); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--confetti-x)), calc(-50% + var(--confetti-y))) rotate(calc(var(--confetti-rotate) + 180deg)) scale(.75); }
  }
  .cf-intro-decor { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); opacity: .8; }
  .cf-intro-independence .cf-intro-decor { width: 150px; height: 150px; border: 2px solid var(--intro-color); border-radius: 50%; animation: cf-firework 1.8s ease-out both; box-shadow: 0 0 0 24px rgba(50,185,104,.12), 0 0 0 48px rgba(212,175,55,.08); }
  .cf-intro-independence .cf-intro-decor::before, .cf-intro-independence .cf-intro-decor::after { content: ""; position: absolute; inset: 25px; border: 1px dashed #F3F7F0; border-radius: 50%; }
  .cf-intro-independence .cf-intro-decor::after { inset: 50px; border-color: #D4AF37; }
  .cf-intro-milad .cf-intro-decor { width: 88px; height: 88px; border-radius: 50%; background: var(--intro-color); animation: cf-moon-rise 1.8s ease-out both; }
  .cf-intro-milad .cf-intro-decor::before { content: ""; position: absolute; width: 88px; height: 88px; left: 27px; top: -12px; border-radius: 50%; background: rgba(5,10,8,.9); }
  .cf-intro-milad .cf-intro-decor::after { content: ""; position: absolute; width: 10px; height: 10px; left: -38px; top: -24px; background: #FFF0A8; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); box-shadow: 124px 44px 0 2px #FFF0A8, 32px 118px 0 0 #E2B83F; }
  .cf-intro-convocation .cf-intro-decor { width: 160px; height: 3px; background: var(--intro-color); animation: cf-rise-lines 1.8s ease-out both; box-shadow: 0 -28px 0 rgba(242,193,78,.8), 0 28px 0 rgba(221,231,255,.8); }
  .cf-intro-convocation .cf-intro-decor::after { content: ""; position: absolute; width: 3px; height: 110px; left: 78px; top: -54px; background: var(--intro-color); box-shadow: -46px 0 0 rgba(102,137,214,.55), 46px 0 0 rgba(242,193,78,.55); }
  .cf-intro-sports .cf-intro-decor { width: 150px; height: 78px; border: 3px solid var(--intro-color); border-radius: 50%; transform: translate(-50%, -50%) rotate(-18deg); animation: cf-speed 1.8s ease-out both; }
  .cf-intro-sports .cf-intro-decor::before, .cf-intro-sports .cf-intro-decor::after { content: ""; position: absolute; width: 190px; height: 3px; left: -22px; top: 18px; background: #FFD166; box-shadow: 0 35px 0 #F7F7F2; }
  .cf-intro-sports .cf-intro-decor::after { top: 53px; width: 110px; left: 20px; background: var(--intro-color); box-shadow: none; }
  .cf-intro-cultural .cf-intro-decor { width: 150px; height: 150px; border: 4px solid var(--intro-color); border-radius: 50%; transform: translate(-50%, -50%) rotate(22deg); animation: cf-ribbon 1.8s ease-out both; }
  .cf-intro-cultural .cf-intro-decor::before, .cf-intro-cultural .cf-intro-decor::after { content: ""; position: absolute; inset: 18px -20px; border: 3px solid #F4A261; border-radius: 50%; transform: rotate(55deg); }
  .cf-intro-cultural .cf-intro-decor::after { inset: -20px 18px; border-color: #55C1FF; transform: rotate(-55deg); }
  .cf-intro-charity .cf-intro-decor { width: 150px; height: 76px; border: 3px solid var(--intro-color); border-radius: 50%; animation: cf-link 1.8s ease-out both; }
  .cf-intro-charity .cf-intro-decor::before, .cf-intro-charity .cf-intro-decor::after { content: ""; position: absolute; width: 70px; height: 70px; top: 0; border: 3px solid #B8F2E6; border-radius: 50%; }
  .cf-intro-charity .cf-intro-decor::before { left: -32px; }
  .cf-intro-charity .cf-intro-decor::after { right: -32px; }
  .cf-intro-farewell .cf-intro-decor { width: 55px; height: 72px; border: 3px solid var(--intro-color); border-radius: 50%; animation: cf-balloons 1.8s ease-out both; box-shadow: 58px 15px 0 -3px #F19CFF, 112px -8px 0 -5px #FFD166; }
  .cf-intro-farewell .cf-intro-decor::after { content: ""; position: absolute; width: 2px; height: 80px; left: 25px; top: 68px; background: var(--intro-color); box-shadow: 58px 0 0 #F19CFF, 112px 0 0 #FFD166; }
  @keyframes cf-firework { from { opacity: 0; transform: translate(-50%, -50%) scale(.1); } to { opacity: .85; transform: translate(-50%, -50%) scale(1); } }
  @keyframes cf-moon-rise { from { opacity: 0; transform: translateY(35px) scale(.2); } to { opacity: .9; transform: translateY(0) scale(1); } }
  @keyframes cf-rise-lines { from { opacity: 0; transform: translate(-50%, 70px) scaleX(.2); } to { opacity: .85; transform: translate(-50%, 0) scaleX(1); } }
  @keyframes cf-speed { from { opacity: 0; transform: translate(-50%, -50%) translateX(-100px) rotate(-18deg); } to { opacity: .85; transform: translate(-50%, -50%) rotate(-18deg); } }
  @keyframes cf-ribbon { from { opacity: 0; transform: translate(-50%, -50%) rotate(-100deg) scale(.2); } to { opacity: .85; transform: translate(-50%, -50%) rotate(22deg) scale(1); } }
  @keyframes cf-link { from { opacity: 0; transform: translate(-50%, -50%) scaleX(.2); } to { opacity: .85; transform: translate(-50%, -50%) scaleX(1); } }
  @keyframes cf-balloons { from { opacity: 0; transform: translate(-50%, 80px) scale(.3); } to { opacity: .85; transform: translate(-50%, 0) scale(1); } }
  @media (prefers-reduced-motion: reduce) {
    .cf-theme-intro, .cf-intro-motif { animation: none; }
    .cf-theme-intro { opacity: 0; visibility: hidden; }
  }

  @media (max-width: 680px) {
    .cf-main { padding: 20px 16px 0 !important; max-width: 100% !important; box-sizing: border-box; }
    .cf-header { padding: 14px 16px !important; }
    .cf-brand-sub { display: none; }
    .cf-h1 { font-size: 21px !important; }
    .cf-form-row2 { grid-template-columns: 1fr !important; gap: 12px !important; }
    .cf-theme-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .cf-pay-box { flex-direction: column !important; align-items: stretch !important; text-align: center; padding: 16px !important; }
    .cf-qr { width: 150px !important; height: 150px !important; margin: 0 auto; }
    .cf-grid { grid-template-columns: 1fr !important; }
    .cf-admin-row { flex-direction: column !important; align-items: flex-start !important; }
    .cf-admin-row-right { width: 100%; justify-content: space-between; }
    .cf-admin-header-row { flex-direction: column !important; align-items: stretch !important; gap: 10px; }
    .cf-admin-header-row > div { display: flex; }
    .cf-role-switch button { padding: 7px 10px !important; font-size: 12.5px !important; }
    .cf-toast { left: 16px !important; right: 16px !important; transform: none !important; width: auto; text-align: center; }
    .cf-gallery img, .cf-gallery label { width: 96px !important; height: 72px !important; }
  }
`;

const styles = {
  page: {
    fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
    background: "var(--page-bg)",
    color: "var(--text)",
    minHeight: "100vh",
    padding: "0 0 48px",
  },
  loadingWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: 240, background: "var(--page-bg, #18202A)", color: "var(--muted, #B5C0BD)", fontFamily: "Georgia, serif" },
  loadingText: { fontSize: 14 },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "20px 28px", borderBottom: "1px solid var(--border)",
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  brandMark: {
    width: 36, height: 36, borderRadius: 8, background: "var(--accent)", color: "#101820",
    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14,
    fontFamily: "Georgia, serif",
  },
  brandTitle: { fontSize: 17, fontWeight: 600, letterSpacing: 0.2, color: "var(--text)" },
  brandSub: { fontSize: 11.5, color: "var(--muted)", fontFamily: "system-ui, sans-serif", marginTop: 1 },
  roleSwitch: { display: "flex", gap: 4, background: "var(--surface)", padding: 4, borderRadius: 10 },
  roleBtn: {
    display: "flex", alignItems: "center", padding: "7px 14px", borderRadius: 7, border: "none",
    background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer",
    fontFamily: "system-ui, sans-serif", fontWeight: 500,
  },
  roleBtnActive: { background: "var(--accent-soft)", color: "var(--accent)" },
  main: { maxWidth: 920, margin: "0 auto", padding: "36px 28px 0" },
  h1: { fontSize: 26, fontWeight: 600, margin: "0 0 8px", letterSpacing: 0.1 },
  lead: { fontSize: 14.5, color: "var(--muted)", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, margin: "0 0 24px", maxWidth: 560 },
  detailSchedule: { fontSize: 12.5, color: "var(--accent)", fontFamily: "system-ui, sans-serif", marginBottom: 8, fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 },
  card: {
    textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
    padding: "18px 18px 16px", cursor: "pointer", color: "var(--text)", position: "relative",
    fontFamily: "inherit", transition: "border-color 0.15s ease",
  },
  cardCover: { width: "100%", height: 110, objectFit: "cover", borderRadius: 8, marginBottom: 12, display: "block", background: "var(--page-bg)" },
  cardTitle: { fontSize: 16, fontWeight: 600, marginBottom: 6 },
  cardDesc: { fontSize: 12.5, color: "var(--muted)", fontFamily: "system-ui, sans-serif", lineHeight: 1.5, marginBottom: 14, minHeight: 32 },
  cardSchedule: { fontSize: 11.5, color: "var(--accent)", fontFamily: "system-ui, sans-serif", marginBottom: 8 },
  cardMeta: { fontSize: 12.5, fontFamily: "system-ui, sans-serif", color: "var(--accent)", fontWeight: 600 },
  closedTag: {
    position: "absolute", top: 14, right: 14, fontSize: 10.5, color: "var(--muted)",
    border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px", fontFamily: "system-ui, sans-serif",
  },
  sectionDivider: {
    fontSize: 11.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)",
    fontFamily: "system-ui, sans-serif", margin: "28px 0 12px", fontWeight: 600,
  },
  backBtn: {
    display: "flex", alignItems: "center", background: "none", border: "none", color: "var(--muted)",
    fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18, fontFamily: "system-ui, sans-serif",
  },
  payBox: {
    display: "flex", gap: 20, background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, padding: 20, marginBottom: 24, alignItems: "center",
  },
  qrImg: { width: 130, height: 130, borderRadius: 8, background: "#fff", padding: 6, flexShrink: 0 },
  payDetails: { flex: 1, minWidth: 0 },
  payRow: {
    display: "flex", justifyContent: "space-between", fontSize: 13.5, fontFamily: "system-ui, sans-serif",
    padding: "5px 0", borderBottom: "1px solid var(--border)",
  },
  payLabel: { color: "var(--muted)" },
  mono: { fontFamily: "'Courier New', monospace" },
  copyBtn: {
    fontFamily: "system-ui, sans-serif", fontSize: 11, background: "var(--accent-soft)", color: "var(--accent)",
    border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", marginLeft: 4,
  },
  hint: { fontSize: 11.5, color: "#6B7480", fontFamily: "system-ui, sans-serif", lineHeight: 1.5, marginTop: 10 },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 },
  themeSwatch: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px",
    borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", fontSize: 11,
    fontFamily: "system-ui, sans-serif", textAlign: "center", lineHeight: 1.3,
  },
  themeBadge: {
    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
    padding: "4px 10px", borderRadius: 20, fontFamily: "system-ui, sans-serif", marginBottom: 10,
  },
  gallery: { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginBottom: 20 },
  galleryThumbWrap: { position: "relative", flexShrink: 0 },
  galleryThumb: { width: 120, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", display: "block", background: "var(--surface)" },
  removeImgBtn: {
    position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
    background: "#E08A8A", color: "#101820", border: "none", fontSize: 12, lineHeight: "20px",
    cursor: "pointer", fontFamily: "system-ui, sans-serif", fontWeight: 700, padding: 0,
  },
  uploadTile: {
    width: 120, height: 88, borderRadius: 8, border: "1px dashed var(--border)", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)",
    fontSize: 11.5, fontFamily: "system-ui, sans-serif", cursor: "pointer", textAlign: "center",
    padding: 6, background: "var(--surface)",
  },
  lightboxOverlay: {
    position: "fixed", inset: 0, background: "rgba(10,13,18,0.92)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 100, cursor: "zoom-out", padding: 24,
  },
  lightboxImg: { maxWidth: "100%", maxHeight: "100%", borderRadius: 10 },
  themeIntro: {
    position: "fixed", inset: 0, zIndex: 90, overflow: "hidden", pointerEvents: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(5, 10, 8, 0.78)",
  },
  introGlow: {
    position: "absolute", width: 220, height: 220, borderRadius: "50%",
    background: "var(--intro-color)", opacity: 0.2, filter: "blur(48px)",
  },
  introMotifs: {
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 26,
  },
  introTitle: {
    position: "relative", color: "var(--intro-color)", fontSize: 23, fontWeight: 700,
    textShadow: "0 2px 18px rgba(0,0,0,.8)", textAlign: "center",
  },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  formRow2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 12, color: "var(--muted)", fontFamily: "system-ui, sans-serif" },
  input: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
    color: "#EDE6D6", fontSize: 14, fontFamily: "system-ui, sans-serif", outline: "none",
  },
  error: { color: "#E08A8A", fontSize: 12.5, fontFamily: "system-ui, sans-serif" },
  primaryBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "#101820",
    border: "none", borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
    fontFamily: "system-ui, sans-serif", marginTop: 4,
  },
  secondaryBtn: {
    background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "system-ui, sans-serif",
  },
  donorList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  donorItem: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    borderBottom: "1px solid var(--border)", paddingBottom: 10, fontFamily: "system-ui, sans-serif",
  },
  donorName: { fontSize: 13.5, fontWeight: 600 },
  donorDept: { fontSize: 11.5, color: "var(--muted)", marginTop: 2 },
  donorAmount: { fontSize: 13.5, fontWeight: 700, color: "var(--accent)" },
  closedNotice: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14,
    fontSize: 13, color: "var(--muted)", fontFamily: "system-ui, sans-serif",
  },
  scheduleBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", marginBottom: 24, gap: 12,
  },
  adminHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  adminTable: { display: "flex", flexDirection: "column", gap: 10 },
  adminRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", cursor: "pointer",
    color: "var(--text)", fontFamily: "inherit", textAlign: "left",
  },
  adminRowRight: { display: "flex", alignItems: "center", gap: 12 },
  adminDonationRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    borderBottom: "1px solid var(--border)", paddingBottom: 12, fontFamily: "system-ui, sans-serif",
  },
  empty: {
    color: "#5C6675", fontSize: 13.5, fontFamily: "system-ui, sans-serif", padding: "24px 0", textAlign: "center",
  },
  narrow: { maxWidth: 520 },
  adminLogin: { maxWidth: 380, marginBottom: 30 },
  toast: {
    position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "var(--surface)",
    color: "var(--text)", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontFamily: "system-ui, sans-serif",
    border: "1px solid var(--border)", zIndex: 50,
  },
};