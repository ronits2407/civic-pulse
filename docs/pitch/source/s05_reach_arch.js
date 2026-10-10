// Slides 9-10: reach, architecture
module.exports = async function (ctx) {
  const { pres, newSlide, heading, card, icon, C } = ctx;

  // ---------- 9. REACH ----------
  {
    const s = newSlide(false);
    heading(s, "Built for how India actually reports", false, "Reach");
    const cols = [
      ["FaLanguage", "Any language", "Citizens type in Hindi, Marathi or English. Agent 0 detects and translates, and the civic brief comes back in their language too."],
      ["FaMobileAlt", "Any device", "Installable Next.js PWA plus a native Android app (React Native / Expo) on the same backend and database."],
      ["FaShareAlt", "Shareable proof", "Every resolution gets an Impact Receipt: a 1200x630 share card generated at the edge, so wins spread."],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.5 + i * 3.1;
      card(s, x, 1.5, 2.8, 3.4);
      s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.75, w: 0.95, h: 0.95, fill: { color: C.TEAL_DK }, line: { color: C.TEAL_DK, width: 0 } });
      s.addImage({ data: await icon(cols[i][0], C.WHITE), x: x + 0.52, y: 2.02, w: 0.41, h: 0.41 });
      s.addText(cols[i][1], { x: x + 0.25, y: 2.95, w: 2.3, h: 0.4, fontFace: C.FONT, fontSize: 18, bold: true, color: C.INK, margin: 0 });
      s.addText(cols[i][2], { x: x + 0.25, y: 3.4, w: 2.35, h: 1.4, fontFace: C.FONT, fontSize: 13, color: C.MUTED, margin: 0, valign: "top" });
    }
    s.addNotes("Language is the first barrier in Indian civic tech, so translation is Agent 0 - it runs before everything else. The mobile app is a real React Native client, not a WebView, talking to the same API. The Impact Receipt gives citizens something to share when their issue is fixed.");
  }

  // ---------- 10. ARCHITECTURE ----------
  {
    const s = newSlide(true);
    heading(s, "Deployed on Google Cloud, powered by Gemini", true, "Architecture");
    const colY = 1.5, colH = 2.55;
    const col = (x, w, label, arr) => {
      s.addShape(pres.shapes.RECTANGLE, { x, y: colY, w, h: colH, fill: { color: C.NAVY_CARD }, line: { color: C.NAVY_LINE, width: 1 } });
      s.addText(label, { x: x + 0.15, y: colY + 0.12, w: w - 0.3, h: 0.25, fontFace: C.FONT, fontSize: 10, bold: true, color: C.TEAL, charSpacing: 2, margin: 0 });
      s.addText(arr.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < arr.length - 1 } })), {
        x: x + 0.15, y: colY + 0.5, w: w - 0.3, h: colH - 0.6, fontFace: C.FONT, fontSize: 11, color: C.WHITE, margin: 0, valign: "top", paraSpaceAfter: 6,
      });
    };
    col(0.5, 2.0, "CLIENTS", ["Web PWA (Next.js)", "Android app (Expo)", "Admin console", "Leaflet + OSM"]);
    col(2.85, 3.0, "CLOUD RUN  |  ASIA-SOUTH1", ["Next.js standalone container", "API routes + LangGraph agents", "Background pipeline via after()", "Retry / resume endpoints"]);
    col(6.2, 3.3, "SERVICES", ["Gemini 2.5 Flash / Pro + embeddings", "Google Maps Geocoding + Routes", "Supabase: Postgres, PostGIS, pgvector", "Supabase Auth, Storage, Realtime"]);
    s.addImage({ data: await icon("FaChevronRight", C.TEAL), x: 2.6, y: 2.62, w: 0.16, h: 0.23 });
    s.addImage({ data: await icon("FaChevronRight", C.TEAL), x: 5.95, y: 2.62, w: 0.16, h: 0.23 });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.3, w: 9, h: 0.7, fill: { color: C.TEAL_DK }, line: { color: C.TEAL_DK, width: 0 } });
    s.addText([
      { text: "CI/CD  ", options: { bold: true } },
      { text: "GitHub Actions > Workload Identity Federation (no stored keys) > Artifact Registry > Cloud Run" },
    ], { x: 0.7, y: 4.3, w: 8.6, h: 0.7, fontFace: C.FONT, fontSize: 12, color: C.WHITE, margin: 0, valign: "middle" });
    s.addNotes("The app ships as a multi-stage Docker image to Artifact Registry and runs on Cloud Run in asia-south1, close to our users. GitHub Actions authenticates with Workload Identity Federation, so there are no long-lived GCP credentials in the repo. Gemini does every language and vision task; Supabase gives us Postgres with PostGIS and pgvector in one place.");
  }
};
