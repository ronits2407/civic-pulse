// Slides 5-6: dedup + validation, community + karma
module.exports = async function (ctx) {
  const { pres, newSlide, heading, iconBadge, card, icon, C } = ctx;

  // ---------- 5. DEDUP + VALIDATION ----------
  {
    const s = newSlide(false);
    heading(s, "Fewer duplicates. Fewer fakes.", false, "Signal over noise");
    const colX = [0.5, 5.15];
    const colW = 4.35;
    const cols = [
      {
        icon: "FaClone", title: "Agent 2: duplicates become signal",
        items: [
          ["Locate", "PostGIS finds same-category issues within 200 m."],
          ["Judge", "Gemini decides: is this the same physical problem?"],
          ["Merge", "A cluster is created and an Evolving Situation Update is added to the parent."],
        ],
      },
      {
        icon: "FaShieldAlt", title: "Agent 3: credibility before action",
        items: [
          ["Check", "Open-Meteo weather and web search, driven by a ReAct agent."],
          ["Score", "Photo evidence plus tool results give a 1-10 credibility score."],
          ["Route", "Below 6, the issue goes to neighbours for community review."],
        ],
      },
    ];
    for (let c = 0; c < 2; c++) {
      const x = colX[c];
      card(s, x, 1.5, colW, 3.45);
      iconBadge(s, await icon(cols[c].icon, C.WHITE), x + 0.25, 1.7, 0.55, C.TEAL_DK);
      s.addText(cols[c].title, { x: x + 0.95, y: 1.7, w: colW - 1.15, h: 0.55, fontFace: C.FONT, fontSize: 14, bold: true, color: C.INK, margin: 0, valign: "middle" });
      for (let r = 0; r < 3; r++) {
        const y = 2.55 + r * 0.78;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.25, y: y + 0.04, w: 0.85, h: 0.32, rectRadius: 0.08, fill: { color: C.TEAL_TINT }, line: { color: C.TEAL_TINT, width: 0 } });
        s.addText(cols[c].items[r][0], { x: x + 0.25, y: y + 0.04, w: 0.85, h: 0.32, fontFace: C.FONT, fontSize: 10.5, bold: true, color: C.TEAL_DK, align: "center", valign: "middle", margin: 0 });
        s.addText(cols[c].items[r][1], { x: x + 1.25, y, w: colW - 1.45, h: 0.68, fontFace: C.FONT, fontSize: 11.5, color: C.INK, margin: 0, valign: "top" });
      }
    }
    s.addNotes("Deduplication is deliberately scoped to a 200-metre radius and the same category, then an LLM judge confirms it is the same physical problem. This protects against false merges. The duplicate is closed and attached to a cluster, and the parent issue gets an evolving situation update. Validation uses a ReAct agent with a weather tool and web search; low scores are not rejected outright - they go to the community.");
  }

  // ---------- 6. COMMUNITY + KARMA ----------
  {
    const s = newSlide(false);
    heading(s, "Neighbours are the final validator", false, "Community trust");
    card(s, 0.5, 1.5, 4.3, 3.45);
    s.addText("Quorum voting", { x: 0.75, y: 1.65, w: 3.8, h: 0.3, fontFace: C.FONT, fontSize: 15, bold: true, color: C.INK, margin: 0 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.75, y: 2.1, w: 3.8, h: 0.7, rectRadius: 0.08, fill: { color: C.TEAL_TINT }, line: { color: C.TEAL_TINT, width: 0 } });
    s.addText("Low-credibility issue is shown to citizens within 1 km of it", {
      x: 0.9, y: 2.1, w: 3.5, h: 0.7, fontFace: C.FONT, fontSize: 11.5, color: C.INK, margin: 0, valign: "middle",
    });
    s.addImage({ data: await icon("FaChevronDown", C.TEAL_DK), x: 2.55, y: 2.86, w: 0.26, h: 0.18 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.75, y: 3.1, w: 3.8, h: 0.5, rectRadius: 0.08, fill: { color: C.NAVY }, line: { color: C.NAVY, width: 0 } });
    s.addText("3 votes reach quorum", { x: 0.75, y: 3.1, w: 3.8, h: 0.5, fontFace: C.FONT, fontSize: 12, bold: true, color: C.WHITE, align: "center", valign: "middle", margin: 0 });
    s.addImage({ data: await icon("FaChevronDown", C.TEAL_DK), x: 2.55, y: 3.66, w: 0.26, h: 0.18 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.75, y: 3.9, w: 1.8, h: 0.85, rectRadius: 0.08, fill: { color: "DDF4E4" }, line: { color: "DDF4E4", width: 0 } });
    s.addText([
      { text: "Confirmed", options: { bold: true, breakLine: true } },
      { text: "Pipeline resumes at Agent 4", options: {} },
    ], { x: 0.85, y: 3.9, w: 1.6, h: 0.85, fontFace: C.FONT, fontSize: 10.5, color: "14532D", margin: 0, valign: "middle" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.75, y: 3.9, w: 1.8, h: 0.85, rectRadius: 0.08, fill: { color: "FDE2E3" }, line: { color: "FDE2E3", width: 0 } });
    s.addText([
      { text: "Rejected", options: { bold: true, breakLine: true } },
      { text: "Closed, reporter loses karma", options: {} },
    ], { x: 2.85, y: 3.9, w: 1.6, h: 0.85, fontFace: C.FONT, fontSize: 10.5, color: "7F1D1D", margin: 0, valign: "middle" });

    card(s, 5.1, 1.5, 4.4, 3.45);
    s.addText("Karma ledger: points per action", { x: 5.3, y: 1.65, w: 4.0, h: 0.3, fontFace: C.FONT, fontSize: 15, bold: true, color: C.INK, margin: 0 });
    s.addChart(pres.charts.BAR, [{
      name: "Karma points",
      labels: ["Report", "Vote", "Confirmed", "Resolved", "Rejected"],
      values: [10, 2, 20, 50, -5],
    }], {
      x: 5.2, y: 2.0, w: 4.2, h: 2.85, barDir: "col",
      chartColors: [C.TEAL_DK, C.TEAL, C.TEAL_DK, C.AMBER, C.CORAL],
      showLegend: false, showTitle: false,
      showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.INK, dataLabelFontSize: 11, dataLabelFontBold: true,
      catAxisLabelColor: C.MUTED, catAxisLabelFontSize: 10, catAxisLabelFontFace: C.FONT,
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      barGapWidthPct: 45,
    });
    s.addNotes("If credibility is under 6, nearby citizens within 1 km review the issue. Three votes reach quorum. Confirmed issues resume the pipeline at Agent 4; rejected ones close and the reporter loses karma. Karma is a ledger: +10 for reporting, +2 for voting, +20 when a report is confirmed, +50 when the issue is resolved, minus 5 for a rejected report. It aligns incentives for honest reporting.");
  }
};
