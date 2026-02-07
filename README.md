# TheAdBowl

**Live Super Bowl LIX commercial scoreboard** — tracking every ad's views, engagement, and trending velocity in real time.

[**View Live**](https://jerrysoer.github.io/theadbowl)

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────┐
│   GitHub Pages       │  fetch  │   Vercel Serverless      │
│   (Static Frontend) │ ──────► │   /api/youtube           │
│                     │ ◄────── │   (API Proxy)            │
│   Vanilla JS        │  JSON   │                          │
│   Editorial CSS     │         │   ┌──────────────────┐   │
│   No dependencies   │         │   │ YouTube Data API │   │
│                     │         │   │ v3 (secured key) │   │
└─────────────────────┘         │   └──────────────────┘   │
                                └──────────────────────────┘
```

**Frontend** serves from GitHub Pages (`/docs`). **API proxy** runs on Vercel, keeping the YouTube API key out of the browser. Edge caching (60s TTL) + client-side refresh (2min) keeps quota usage well under YouTube's 10K daily limit.

## Why Vanilla JS?

My other projects use Next.js, React, and TypeScript. This one intentionally goes framework-free to demonstrate:

- DOM manipulation and event handling without abstractions
- Class-based module organization (no bundler, no imports)
- Manual XSS prevention (escape functions, no JSX auto-escaping)
- Progressive enhancement patterns (loading → error → content states)

Zero npm dependencies. Zero build step. Just HTML, CSS, and JS.

## Why Split Architecture?

Keeping the frontend static and the API on Vercel shows understanding of:

- **Security** — API keys never reach the client
- **Cost** — GitHub Pages is free; Vercel hobby tier is free
- **Caching** — Edge cache on the proxy, separate from the static CDN
- **Separation of concerns** — Frontend can evolve independently of the API

## Features

- Real-time YouTube stats (views, likes, comments) for every Super Bowl ad
- Sort by **Views**, **Engagement Rate**, or **Trending Velocity**
- Trending detection — tracks view count deltas between refreshes
- Per-card **Copy Link** and **Share on X** buttons
- Dynamic context banner (countdown → game day → post-game)
- Editorial magazine design (Playfair Display + IBM Plex Sans)
- Top 3 ads get featured card layout with gold/silver/bronze badges
- Fully responsive (mobile → tablet → desktop)
- Accessible: ARIA roles, keyboard navigation, focus-visible, reduced motion
- Auto-refresh every 2 minutes

## Quick Start

### Frontend (local preview)

```bash
cd docs
python3 -m http.server 8000
# Open http://localhost:8000
```

> Note: API calls will fail locally unless you also deploy the Vercel proxy.

### API Proxy (deploy to Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel --prod

# Set your YouTube API key
vercel env add YOUTUBE_API_KEY
```

### GitHub Pages

1. Push to `main` on GitHub
2. Settings → Pages → Source: `main`, folder: `/docs`
3. Your site goes live at `https://jerrysoer.github.io/theadbowl`

### Updating Ads

Edit `docs/data/video-ids.json` to add/remove ads:

```json
{
  "videoId": "YOUTUBE_VIDEO_ID",
  "brand": "Brand Name",
  "adTitle": "Ad Title",
  "category": "Food & Beverage",
  "celebrity": "Celebrity Name"
}
```

Or use the scraper to find ads automatically:

```bash
GOOGLE_API_KEY=your_key python scripts/scrape-ads.py > docs/data/video-ids.json
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Vanilla JS (ES6+) | Leaderboard logic, DOM rendering |
| Styling | CSS Custom Properties | Design system, responsive grid |
| Fonts | Google Fonts | Playfair Display + IBM Plex Sans |
| API Proxy | Vercel Serverless | YouTube API key security |
| Data | YouTube Data API v3 | Video statistics |
| Hosting | GitHub Pages | Static site hosting |
| Analytics | Umami | Privacy-friendly analytics |

## What I Learned

- **Vanilla JS is underrated** — Without React's re-render model, you think harder about when and how to update the DOM. The result is often faster and more predictable.
- **XSS prevention is manual work** — Framework-free means writing your own escape functions. This made me appreciate what JSX does automatically.
- **Split architecture is simple and powerful** — The frontend doesn't care where the API lives. Swapping Vercel for Cloudflare Workers would take minutes.
- **Edge caching is free performance** — One `s-maxage` header saves hundreds of YouTube API calls per day.

## License

MIT
