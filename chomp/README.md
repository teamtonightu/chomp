# Chomp — free deploy with working AI

Everything here can run at $0:
- **Hosting:** Vercel free plan
- **AI** (meal descriptions, meal photos, fridge scan, Kitchen recipes, nutrient estimates): Google Gemini free tier
- **Barcodes:** Open Food Facts, a free product database (no key). Real label numbers for millions of
  products; the AI is only used as a backup when a product isn't in it.

## 1. Get a free Gemini API key (2 min)
1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Click **Create API key** and copy it. No credit card needed.

Free-tier notes: there's a daily and per-minute request limit (see your limits in Google AI Studio →
Rate limits). If you hit it, the app says "Too many requests — wait a minute". Google may use free-tier
requests to improve its products, so don't log anything you'd want kept private from Google.

## 2. Deploy to Vercel (free)
Drag-and-drop static deploys do NOT run the AI function. Use GitHub:
1. Create a free GitHub account → New repository → "uploading an existing file" → drag in everything
   inside this `chomp` folder (keep the folders: `public`, `api`, etc.) → Commit.
2. https://vercel.com → sign in with GitHub → Add New → Project → import the repo → Deploy.
3. Project → Settings → Environment Variables → add `GEMINI_API_KEY` = your key → Save.
4. Deployments → ⋯ → **Redeploy** (keys only take effect after a redeploy).

(Already deployed with the old zip? Just replace the files in your GitHub repo — Vercel redeploys
itself — then add `GEMINI_API_KEY` and redeploy.)

## 3. Check it
Open your site → Today → Describe → "2 eggs and toast" → Estimate macros.
Barcode tab → type or snap a barcode → Look up product.
If it fails, the app tells you why:
- "missing its AI server function" → it was deployed as static files only (see step 2).
- "no working API key" → add `GEMINI_API_KEY` and redeploy.

## Home-screen app
On iPhone: open your site in Safari → Share → **Add to Home Screen**. It uses the Chomp gator icon.

## Want Claude instead later?
Add `ANTHROPIC_API_KEY` (from console.anthropic.com, paid per use) and `AI_PROVIDER=anthropic`, then redeploy.

## What's device-only on your own site
Goals, meals, checklist and photos are saved in that phone's browser, and the public Community feed is
off. Syncing across devices needs a database with logins (e.g. Supabase's free tier) — a separate upgrade.

## Files
- `public/` — the website (index.html, icons, manifest)
- `api/claude.js` — Vercel function · `netlify/functions/claude.mjs` — Netlify function
- `api/_core.js` — the shared code that calls Gemini (or Claude)
