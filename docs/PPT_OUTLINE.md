# CivicPulse – Web PPT Outline (draft for approval)

Format: a Next.js route (`/deck`), full-screen slides, arrow-key / swipe navigation, the same cream/ink/pastel theme and pill UI as the site. Each slide has a headline, at most 3 short chips, and one visual. Live screenshots are real `<iframe>`s of the running app, inside a rounded browser-frame card. Speaker notes go in a collapsible pill, not on the slide.

## Narrative (23 slides)

| # | Slide | Visual | Key message (short) |
|---|-------|--------|---------------------|
| 1 | Title – CivicPulse | Pastel block collage | AI-powered civic reporting for Indian cities, starting with Nashik |
| 2 | The problem | 3 big number tiles | Reports vanish, duplicates pile up, nobody knows what to fix first |
| 3 | The solution | Flow strip: Report → 6 agents → Municipality → Receipt | Citizen to resolved, with proof |
| 4 | Landing page | iframe `/` | Bento stats, ticker, how-it-works |
| 5 | Login | iframe `/auth/login` | Google OAuth + email magic link, role-aware |
| 6 | Report in 30 seconds | iframe `/report` | Camera/webcam, geolocation, map picker, multilingual input |
| 7 | Six-agent LangGraph pipeline | Pastel node graph | Translation → Classifier → Dedup → Validation → Resolution (+ Predictive) |
| 8 | Agent 0 – Translation | Chip + example | Hindi/Marathi/transliterated text becomes English |
| 9 | Agent 1 – Classifier | Severity dial | Category, severity 1–10, emergency flag, auto title |
| 10 | Agent 2 – Deduplication | Agent2 map visual | pgvector cosine (0.85) + PostGIS 200 m radius, clusters |
| 11 | Agent 3 – Validation | Credibility gauge | Open-Meteo weather check + Gemini credibility; community verification below 6 |
| 12 | Agent 4 – Resolution | Civic brief card | Action brief, SLA from severity × category matrix, department routing |
| 13 | Agent 5 – Predictive hotspots | iframe predictive panel | k-means over history, Gemini Pro predicts next problems |
| 14 | Cline SDK – the AI backbone | Architecture diagram | See below |
| 15 | Citizen dashboard | iframe `/dashboard` | Realtime pipeline tracking, karma, leaderboard, map |
| 16 | Community verification and karma | Quorum diagram | Neighbours vote, quorum decides, karma ledger |
| 17 | Admin command centre | iframe `/admin/dashboard` | Inbox, map, KPIs, filters, AI reasoning trace |
| 18 | Route planner (TSP) | iframe route planner | Multi-stop crew routes optimised via Google Routes API waypoint optimisation, polyline on map |
| 19 | Municipality workspace and evidence | iframe `/municipality/dashboard` | Department-scoped inbox, completion proof, AI assessment, community review, admin adjudication |
| 20 | Emergency mesh network (mobile) | Phone mock + node graph | Offline phone-to-phone SOS relay over Nearby Connections, store-and-forward outbox |
| 21 | Impact Receipt | iframe `/receipt/<id>` | Shareable themed card when an issue is fixed |
| 22 | Google Cloud and tech stack | Logo wall | See below |
| 23 | Roadmap and thank-you | Pastel blocks | Next steps, link, team |
