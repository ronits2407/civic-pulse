// Slides 11-12: roadmap, closing
module.exports = async function (ctx) {
  const { pres, newSlide, heading, card, icon, C } = ctx;

  // ---------- 11. ROADMAP ----------
  {
    const s = newSlide(false);
    heading(s, "Working today. Scaling next.", false, "Roadmap");
    card(s, 0.5, 1.5, 4.35, 3.4);
    s.addText("Built and working", { x: 0.75, y: 1.65, w: 3.9, h: 0.35, fontFace: C.FONT, fontSize: 16, bold: true, color: C.TEAL_DK, margin: 0 });
    const done = [
      "Six-agent LangGraph pipeline",
      "Citizen dashboard with realtime updates",
      "Community quorum voting and karma",
      "Admin inbox, map, route planner",
      "Predictive hotspots (Agent 5)",
      "Web PWA and native Android app",
      "Cloud Run deploy with CI/CD",
    ];
    s.addText(done.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < done.length - 1 } })), {
      x: 0.75, y: 2.15, w: 3.9, h: 2.65, fontFace: C.FONT, fontSize: 13.5, color: C.INK, margin: 0, valign: "top", paraSpaceAfter: 9,
    });
    card(s, 5.15, 1.5, 4.35, 3.4, C.NAVY);
    s.addText("Next", { x: 5.4, y: 1.65, w: 3.9, h: 0.35, fontFace: C.FONT, fontSize: 16, bold: true, color: C.TEAL, margin: 0 });
    const next = [
      "Durable PostgresSaver checkpointer so pipelines resume across restarts",
      "Session-verified auth on every citizen route",
      "Hand-off to department ticketing systems",
      "Ward-level public accountability dashboards",
      "Roll out beyond Nashik by extending the SOP knowledge base",
    ];
    s.addText(next.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < next.length - 1 } })), {
      x: 5.4, y: 2.15, w: 3.9, h: 2.65, fontFace: C.FONT, fontSize: 13, color: C.WHITE, margin: 0, valign: "top", paraSpaceAfter: 9,
    });
    s.addNotes("Be upfront about where we are: the full flow works end to end. The honest next steps are production hardening - a durable checkpointer instead of in-memory state, and stricter session verification on citizen routes - and then integration with real departmental systems and expansion to other cities by extending the SOP knowledge base.");
  }

  // ---------- 12. CLOSING ----------
  {
    const s = newSlide(true);
    const cx = 8.2, cy = 2.8;
    [[3.0, 88], [2.1, 78], [1.3, 60]].forEach(([d, tr]) => {
      s.addShape(pres.shapes.OVAL, {
        x: cx - d / 2, y: cy - d / 2, w: d, h: d,
        fill: { color: C.TEAL, transparency: tr }, line: { color: C.TEAL, width: 1, transparency: 45 },
      });
    });
    s.addImage({ data: await icon("FaCheck", C.TEAL), x: cx - 0.3, y: cy - 0.3, w: 0.6, h: 0.6 });
    s.addText("Every report heard.", { x: 0.6, y: 1.35, w: 6.2, h: 0.8, fontFace: C.FONT, fontSize: 36, bold: true, color: C.WHITE, margin: 0 });
    s.addText("Every duplicate merged. Every fix tracked.", { x: 0.6, y: 2.1, w: 6.0, h: 0.55, fontFace: C.FONT, fontSize: 20, color: C.TEAL, margin: 0 });
    s.addText("CivicPulse gives citizens a voice and city teams a plan.", { x: 0.6, y: 2.9, w: 5.9, h: 0.7, fontFace: C.FONT, fontSize: 16, color: C.SOFT, margin: 0, valign: "top" });
    s.addText("Thank you. Live demo next.", { x: 0.6, y: 4.1, w: 5.6, h: 0.4, fontFace: C.FONT, fontSize: 14, bold: true, color: C.WHITE, margin: 0 });
    s.addNotes("Close: CivicPulse turns the civic complaint from a dead end into a closed loop. Offer the live demo: submit a report, watch the six agents run, then show the admin view and the predictive map.");
  }
};
