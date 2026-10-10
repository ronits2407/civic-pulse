// Slides 3-4: solution, six-agent pipeline
module.exports = async function (ctx) {
  const { pres, newSlide, heading, iconBadge, card, icon, C } = ctx;

  // ---------- 3. SOLUTION ----------
  {
    const s = newSlide(false);
    heading(s, "One report in. A closed loop out.", false, "Our solution");
    const steps = [
      ["FaCamera", "1  Report", "Text, photo, video or voice, in any language, pinned by GPS or on a map."],
      ["FaRobot", "2  Understand", "Six AI agents translate, classify, de-duplicate, verify and brief the issue."],
      ["FaCheckCircle", "3  Resolve", "Admins get a prioritised, SLA-timed work order. Citizens track it live and earn karma."],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.5 + i * 3.1;
      card(s, x, 1.55, 2.8, 2.65);
      iconBadge(s, await icon(steps[i][0], C.WHITE), x + 0.25, 1.8, 0.7, C.TEAL_DK);
      s.addText(steps[i][1], { x: x + 0.25, y: 2.65, w: 2.3, h: 0.4, fontFace: C.FONT, fontSize: 18, bold: true, color: C.INK, margin: 0 });
      s.addText(steps[i][2], { x: x + 0.25, y: 3.1, w: 2.3, h: 1.0, fontFace: C.FONT, fontSize: 12, color: C.MUTED, margin: 0, valign: "top" });
      if (i < 2) {
        s.addImage({ data: await icon("FaChevronRight", C.TEAL_DK), x: x + 2.86, y: 2.75, w: 0.18, h: 0.26 });
      }
    }
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.45, w: 9, h: 0.55, fill: { color: C.NAVY }, line: { color: C.NAVY, width: 0 } });
    s.addText("Web PWA + native Android app on one shared backend, with realtime updates via Supabase", {
      x: 0.7, y: 4.45, w: 8.6, h: 0.55, fontFace: C.FONT, fontSize: 13, color: C.WHITE, margin: 0, valign: "middle",
    });
    s.addNotes("The experience for a citizen is simple: report in any form, then watch the system work. Behind that sits the six-agent pipeline on the next slide. The admin never sees raw noise - they see a verified, prioritised, SLA-stamped work order.");
  }

  // ---------- 4. SIX AGENT PIPELINE ----------
  {
    const s = newSlide(true);
    heading(s, "Six agents, one autonomous pipeline", true, "How it works");
    const agents = [
      ["FaLanguage", "Agent 0  Translation", "Detects the language and normalises to English. Keeps the original and a trace.", "Gemini Flash"],
      ["FaTags", "Agent 1  Classifier", "Reads text and image. Outputs category, severity 1-10 and emergency flag.", "Gemini Flash Vision"],
      ["FaClone", "Agent 2  Dedup", "PostGIS 200 m search plus an AI judge. Merges repeats into one cluster.", "PostGIS + Gemini"],
      ["FaShieldAlt", "Agent 3  Validation", "ReAct agent checks weather and the web. Scores credibility 1-10.", "LangGraph ReAct"],
      ["FaFileAlt", "Agent 4  Resolution", "RAG over municipal SOPs drafts a 150-200 word brief and SLA deadline.", "pgvector RAG"],
      ["FaChartLine", "Agent 5  Predictive", "Clusters history and forecasts the next hotspots. Admin-triggered.", "Gemini 2.5 Pro"],
    ];
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.5 + col * 3.1, y = 1.5 + row * 1.7;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 2.8, h: 1.55, fill: { color: C.NAVY_CARD }, line: { color: C.NAVY_LINE, width: 1 } });
      iconBadge(s, await icon(agents[i][0], C.NAVY), x + 0.18, y + 0.17, 0.48, C.TEAL);
      s.addText(agents[i][1], { x: x + 0.78, y: y + 0.14, w: 1.95, h: 0.28, fontFace: C.FONT, fontSize: 12, bold: true, color: C.WHITE, margin: 0 });
      s.addText(agents[i][3], { x: x + 0.78, y: y + 0.44, w: 1.95, h: 0.22, fontFace: C.FONT, fontSize: 10, color: C.TEAL, margin: 0 });
      s.addText(agents[i][2], { x: x + 0.18, y: y + 0.8, w: 2.45, h: 0.68, fontFace: C.FONT, fontSize: 10.5, color: C.SOFT, margin: 0, valign: "top" });
    }
    s.addText("LangGraph StateGraph  |  conditional branching  |  retry and resume from any failed stage", {
      x: 0.5, y: 4.9, w: 9, h: 0.25, fontFace: C.FONT, fontSize: 11, color: C.MUTED_DK, margin: 0, align: "center",
    });
    s.addNotes("Agents 0 to 4 run automatically on every report inside a LangGraph StateGraph. Failures route to a save node and can be retried from the exact failed stage. Agent 5 is the strategic one: it runs on demand for admins and looks at the whole city rather than one ticket.");
  }
};
