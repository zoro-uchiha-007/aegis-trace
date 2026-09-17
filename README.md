# AEGIS-TRACE — Production Cyber Forensics & SOC Investigation Console

**AEGIS-TRACE** is an autonomous cyber-forensics platform engineered for Security Operations Center (SOC) analysts and incident responders. Built on **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase (Postgres + RLS + Realtime)**, **MapLibre / Mapbox GL JS (3D Globe)**, and **ipinfo.io Geolocation API**.

---

## 🔑 Required API Keys & Where to Get Them

| Key Name | Provider | Purpose | Free Tier Limit | Where to Get |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Database & Auth endpoint | Free Project (500MB DB) | [supabase.com](https://supabase.com) → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Public Client API Key | Free | [supabase.com](https://supabase.com) → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side Admin Key | Free | [supabase.com](https://supabase.com) → Project Settings → API |
| `IPINFO_TOKEN` | ipinfo.io | Server-side IP Geolocation | 50,000 requests/month free | [ipinfo.io/signup](https://ipinfo.io/signup) → Access Token |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox | (Optional) 3D Vector Map tiles | 50,000 map loads/month free | [mapbox.com](https://mapbox.com) *(Optional: MapLibre Dark Matter fallback works automatically if empty)* |

---

## 💻 1. How to Run on Localhost

### Step 1: Open Terminal & Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Open `.env.local` and paste your Supabase URL, Anon Key, and IPinfo Token.

### Step 3: Run Supabase SQL Migration
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **SQL Editor** on the left menu.
3. Paste the contents of `supabase/migrations/20260916000000_init_aegis_trace.sql`.
4. Click **Run**. This creates all tables (`cases`, `case_evidence`, `case_findings`, `ioc`, `ip_geolocation`, `threat_graph_edges`, `route_hops`, `audit_log`), RLS policies, and seed data.

### Step 4: Start Local Development Server
```bash
npm run dev
```
Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🐙 2. How to Upload to GitHub

Open terminal in the project root directory (`d:\SIH FINAL`):

### Step 1: Initialize Git
```bash
git init
```

### Step 2: Stage & Commit Code
```bash
git add .
git commit -m "feat: initial release of AEGIS-TRACE SOC Forensics Console"
```

### Step 3: Create a New GitHub Repository
1. Go to [github.com/new](https://github.com/new).
2. Repository name: `aegis-trace` (or your choice).
3. Set to **Public** or **Private**.
4. Do **not** initialize with README or .gitignore (we already have them).
5. Click **Create repository**.

### Step 4: Link Remote & Push
```bash
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/aegis-trace.git
git push -u origin main
```

---

## ▲ 3. How to Deploy to Vercel

### Step 1: Import Project on Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New...** → **Project**.
3. Select your `aegis-trace` repository from the GitHub list and click **Import**.

### Step 2: Configure Environment Variables in Vercel
In the **Environment Variables** section during import (or in Project Settings → Environment Variables):
Add the following keys:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key`
- `SUPABASE_SERVICE_ROLE_KEY` = `your-service-role-key`
- `IPINFO_TOKEN` = `your-ipinfo-token`
- `NEXT_PUBLIC_MAPBOX_TOKEN` = *(optional)*

### Step 3: Deploy
Click **Deploy**! Vercel will build the Next.js application and generate your live production URL (e.g. `https://aegis-trace.vercel.app`).

---

## 🧪 Forensic Workflow Stages

1. **Access Gateway (`/login`)**: Secure analyst authentication + 1-click Quick Demo Sign-in.
2. **SOC Dashboard (`/`)**: Real-time dossier, telemetry streams, and audit logs.
3. **Stage 1 Fast Triage (`/stage-1-fast-triage`)**: SPF/DKIM/DMARC protocols & 0–100 radial threat score gauge.
4. **Stage 2 Deep Forensics (`/stage-2-deep-forensics`)**: Interactive audio waveform spectrogram & weaponized PDF payload inspection.
5. **Threat Graph (`/threat-graph`)**: Force-directed multi-vector node-link correlation graph with interactive IOC inspector.
6. **Geolocation & Infrastructure (`/geolocation-threat-infrastructure`)**: 3D Rotating Globe / Flat map with geodesic Great-Circle arcs and Haversine mileage tracking.
7. **Final Forensic Report (`/final-forensic-report`)**: Decision cockpit, FIPS 140-3 Hardware Cryptographic Seal, and PDF / STIX 2.1 exporter.
