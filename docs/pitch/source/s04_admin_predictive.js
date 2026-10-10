// Slides 7-8: admin + SOP SLA, predictive
module.exports = async function (ctx) {
  const { pres, newSlide, heading, iconBadge, card, icon, C } = ctx;

  // ---------- 7. ADMIN + SOP-GROUNDED SLA ----------
  {
    const s = newSlide(false);
    heading(s, "From report to work order, automatically", false, "For municipal teams");
    const feats = [
      ["FaInbox", "Civic inbox", "Triage by severity and SLA, internal comments, status updates."],
      ["FaMapMarkedAlt", "City map", "Every open issue on a live map with clusters."],
      ["FaRoute", "Route planner", "Field-team stops ordered by TSP via Google Routes API."],
      ["FaBolt", "Agent trace", "See each agent's reasoning and retry failed stages."],
    ];
    for (let i = 0; i < feats.length; i++) {
      const y = 1.5 + i * 0.87;
      card(s, 0.5, y, 4.6, 0.75);
      iconBadge(s, await icon(feats[i][0], C.TEAL_DK), 0.62, y + 0.115, 0.52, C.TEAL_TINT);
      s.addText(feats[i][1], { x: 1.3, y: y + 0.07, w: 3.7, h: 0.27, fontFace: C.FONT, fontSize: 13, bold: true, color: C.INK, margin: 0 });
      s.addText(feats[i][2], { x: 1.3, y: y + 0.36, w: 3.7, h: 0.34, fontFace: C.FONT, fontSize: 10.5, color: C.MUTED, margin: 0, valign: "top" });
    }
    card(s, 5.4, 1.5, 4.1, 3.35, C.NAVY);
    s.addText("SLA GROUNDED IN REAL SOPs", { x: 5.65, y: 1.7, w: 3.6, h: 0.25, fontFace: C.FONT, fontSize: 10.5, bold: true, color: C.TEAL, charSpacing: 2, margin: 0 });
    s.addText("Agent 4 retrieves the matching municipal SOP with pgvector, then sets the deadline from it. Never a guess.", {
      x: 5.65, y: 2.0, w: 3.6, h: 0.85, fontFace: C.FONT, fontSize: 12, color: C.SOFT, margin: 0, valign: "top",
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 5.65, y: 2.95, w: 3.6, h: 1.65, fill: { color: C.NAVY_CARD }, line: { color: C.NAVY_LINE, width: 1 } });
    s.addText([
      { text: "Retrieved SOP", options: { bold: true, color: C.TEAL, fontSize: 10.5, breakLine: true } },
      { text: "\"Potholes deeper than 5 cm on major arterial roads must be filled within 24 hours.\"", options: { color: C.WHITE, italic: true, fontSize: 12.5, breakLine: true } },
      { text: "Result: sla_deadline = now + 24 h", options: { color: C.AMBER, bold: true, fontSize: 12 } },
    ], { x: 5.85, y: 3.05, w: 3.2, h: 1.45, fontFace: C.FONT, margin: 0, valign: "middle", paraSpaceAfter: 8 });
    s.addNotes("The admin console is built around action: an inbox sorted by severity and SLA, a map, and a route planner that uses the Google Routes API with waypoint optimisation so field crews visit clustered issues in an efficient order. The SLA is not hallucinated - Agent 4 retrieves the relevant standard operating procedure via vector search and the deadline is computed in code from the hours it returns.");
  }

  // ---------- 8. PREDICTIVE ----------
  {
    const s = newSlide(true);
    heading(s, "From reactive to proactive", true, "Agent 5: predictive hotspots");
    const flow = [
      ["FaDatabase", "Issue history", "Lookback window of geolocated reports"],
      ["FaProjectDiagram", "Cluster", "Haversine geographic clustering, optional bbox"],
      ["FaBrain", "Gemini 2.5 Pro", "Finds patterns per cluster"],
      ["FaBell", "Alerts", "Saved to predictive_alerts, shown on the map"],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.5 + i * 2.3;
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.55, w: 2.0, h: 1.75, fill: { color: C.NAVY_CARD }, line: { color: C.NAVY_LINE, width: 1 } });
      iconBadge(s, await icon(flow[i][0], C.NAVY), x + 0.2, 1.72, 0.5, C.TEAL);
      s.addText(flow[i][1], { x: x + 0.2, y: 2.3, w: 1.65, h: 0.3, fontFace: C.FONT, fontSize: 13, bold: true, color: C.WHITE, margin: 0 });
      s.addText(flow[i][2], { x: x + 0.2, y: 2.62, w: 1.65, h: 0.6, fontFace: C.FONT, fontSize: 10.5, color: C.SOFT, margin: 0, valign: "top" });
      if (i < 3) s.addImage({ data: await icon("FaChevronRight", C.TEAL), x: x + 2.07, y: 2.32, w: 0.16, h: 0.23 });
    }
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 3.6, w: 5.2, h: 1.4, fill: { color: "08121D" }, line: { color: C.NAVY_LINE, width: 1 } });
    s.addText([
      { text: "{", options: { breakLine: true } },
      { text: "  \"predicted_category\": \"sanitation\",", options: { breakLine: true } },
      { text: "  \"confidence\": 0.82,", options: { breakLine: true } },
      { text: "  \"basis_summary\": \"Recurring drain blockages...\"", options: { breakLine: true } },
      { text: "}", options: {} },
    ], { x: 0.7, y: 3.7, w: 4.9, h: 1.2, fontFace: "Courier New", fontSize: 11, color: "9BE7DD", margin: 0, valign: "middle" });
    s.addText("Output schema, illustrative values", { x: 5.95, y: 3.65, w: 3.55, h: 0.25, fontFace: C.FONT, fontSize: 10, color: C.MUTED_DK, margin: 0 });
    s.addText("Planners act before the monsoon blocks the drain, not after the street floods.", {
      x: 5.95, y: 3.95, w: 3.55, h: 1.0, fontFace: C.FONT, fontSize: 14, bold: true, color: C.WHITE, margin: 0, valign: "top",
    });
    s.addNotes("Agent 5 is admin-triggered and uses Gemini 2.5 Pro. It clusters recent issues geographically, then asks the model for predictions per cluster: predicted category, confidence, and the evidence behind it. Results are stored in predictive_alerts and rendered on the admin map. The JSON shown is the output schema, with illustrative values. This shifts the city from firefighting to planning.");
  }
};
