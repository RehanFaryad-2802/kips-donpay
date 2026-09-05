# Campus Fund

A real, working website — not a Claude artifact anymore. Two parts:

```
campus-fund-app/
  server/   Express API + JSON-file database (server/data.json)
  client/   React app (Vite) — the UI you've been using
```

The server is the source of truth. Anyone who opens the site — on any
device, any browser, not just inside Claude — hits the same server and
sees the same events and contributions.

## Run it locally

You need [Node.js](https://nodejs.org) 18 or newer installed.

Admin changes require the `ADMIN_KEY` request key. For local development the
default key is `campus-admin`; set a private value in the server environment
for any shared or deployed installation. Open `http://localhost:5173/?admin=1`
to reach the admin login; normal users will not see an admin button.

**1. Start the server** (in one terminal):
```
cd server
npm install
npm run dev
```
It listens on `http://localhost:4000`.

**2. Start the client** (in another terminal):
```
cd client
npm install
npm run dev
```
It opens on `http://localhost:5173` and forwards API calls to the
server automatically (see `client/vite.config.js`). Open that URL in
your browser — this is the app.

Data is saved to `server/data.json` on disk, so it survives restarts.
Delete that file (or empty its arrays) any time you want to wipe all
events and contributions and start fresh.

## Put it online for real

The simplest path is one host running the server, which also serves
the built client — no separate frontend hosting, no CORS setup.

**1. Build the client:**
```
cd client
npm install
npm run build
```
This creates `client/dist/`.

**2. Run the server** — it automatically serves `client/dist/` alongside the API:
```
cd server
npm install
npm start
```

That's the whole app on one port. Deploy it anywhere that runs Node:

- **Render / Railway** — easiest options. Create a new "Web Service"
  from this repo, set the root/build to run the client build then
  start the server (build command: `cd client && npm install && npm run build`,
  start command: `cd server && npm install && npm start`). Both give
  you a free public URL.
- **A VPS (DigitalOcean, Hetznet, etc.)** — clone the repo, run the
  build + start steps above, keep it running with `pm2` or a systemd
  service, and put Nginx in front of it for a domain + HTTPS.
- **Your college's own server**, if they have one — same steps.

### One important thing about `server/data.json`

This app stores events and contributions in a plain file on the
server's disk. That's simple and works well for a single college
group, but two things to know:

1. **Some hosts (like most free tiers on Render/Railway) reset the
   disk on every deploy or restart.** If you go this route, look for
   a "persistent disk" or "volume" option in your host's settings and
   point it at the `server` folder — otherwise your data will vanish
   whenever the server restarts.
2. **If this grows beyond one campus group**, swap the JSON file for
   a real database (Postgres, SQLite, MongoDB — whatever you're
   comfortable with). Everything that touches storage lives in
   `server/server.js`'s `readDB`/`writeDB` functions — that's the
   only place you'd need to change.

## What changed from the Claude-artifact version

- Storage moved from Claude's built-in `window.storage` (which only
  works inside Claude.ai) to a real Express API + file database, so
  the site works standalone, anywhere.
- The "Load sample data" button now asks the server to seed the
  demo events, instead of writing them from the browser.
- Everything else — themes, photos, schedules, the donation flow — is
  unchanged.
