// Slides 1-2: title, problem
module.exports = async function (ctx) {
  const { pres, newSlide, heading, iconBadge, card, icon, C } = ctx;

  // ---------- 1. TITLE ----------
  {
    const s = newSlide(true);
    const cx = 7.6, cy = 2.8;
    [[3.6, 85], [2.6, 75], [1.6, 55]].forEach(([d, tr]) => {
      s.addShape(pres.shapes.OVAL, {
        x: cx - d / 2, y: cy - d / 2, w: d, h: d,
        fill: { color: C.TEAL, transparency: tr }, line: { color: C.TEAL, width: 1, transparency: 40 },
      });
    });
    s.addShape(pres.shapes.OVAL, { x: cx - 0.55, y: cy - 0.55, w: 1.1, h: 1.1, fill: { color: C.TEAL }, line: { color: C.TEAL, width: 0 } });
    s.addImage({ data: await icon("FaMapMarkerAlt", C.NAVY), x: cx - 0.24, y: cy - 0.3, w: 0.48, h: 0.6 });

    s.addText("HACKATHON SUBMISSION  |  COMMUNITY HERO", {
      x: 0.6, y: 1.0, w: 5.5, h: 0.3, fontFace: C.FONT, fontSize: 11, bold: true, color: C.TEAL, charSpacing: 3, margin: 0,
    });
    s.addText("CivicPulse", {
      x: 0.6, y: 1.4, w: 5.6, h: 1.0, fontFace: C.FONT, fontSize: 54, bold: true, color: C.WHITE, margin: 0,
    });
    s.addText("AI agents that turn citizen complaints into resolved city problems.", {
      x: 0.6, y: 2.5, w: 5.0, h: 0.9, fontFace: C.FONT, fontSize: 20, color: C.SOFT, margin: 0, valign: "top",
    });
    s.addText("Problem Statement 2: Hyperlocal Problem Solver", {
      x: 0.6, y: 4.1, w: 5.5, h: 0.3, fontFace: C.FONT, fontSize: 12, color: C.MUTED_DK, margin: 0,
    });
    s.addText("Built for Nashik  |  Gemini 2.5  |  Google Cloud Run", {
      x: 0.6, y: 4.4, w: 5.5, h: 0.3, fontFace: C.FONT, fontSize: 12, color: C.MUTED_DK, margin: 0,
    });
    s.addNotes("Open: CivicPulse is an AI-powered civic issue platform for Indian cities, built for Problem Statement 2 - Hyperlocal Problem Solver. We built and seeded it around Nashik. In the next few minutes: the problem, the six-agent pipeline, and what makes it trustworthy and deployable today.");
  }

  // ---------- 2. PROBLEM ----------
  {
    const s = newSlide(false);
    heading(s, "Reporting is easy. Getting it fixed is not.", false, "The problem");
    card(s, 0.5, 1.5, 3.3, 3.4, C.NAVY);
    s.addText("A complaint goes in, and nothing comes back.", {
      x: 0.75, y: 1.75, w: 2.8, h: 1.7, fontFace: C.FONT, fontSize: 21, bold: true, color: C.WHITE, margin: 0, valign: "top",
    });
    s.addText("Municipal teams drown in raw, unsorted, unverified tickets. Citizens stop reporting.", {
      x: 0.75, y: 3.5, w: 2.8, h: 1.1, fontFace: C.FONT, fontSize: 13, color: C.MUTED_DK, margin: 0, valign: "top",
    });
    const rows = [
      ["FaClone", "Duplicate floods", "Fifty people report the same pothole. Fifty tickets, one problem."],
      ["FaSortAmountDown", "No triage", "A live wire and a faded sign sit in the same queue."],
      ["FaQuestionCircle", "Unverifiable claims", "Nobody checks whether a report is real or exaggerated."],
      ["FaEyeSlash", "Zero feedback", "Citizens never learn who owns it or when it will be fixed."],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 1.5 + i * 0.88;
      card(s, 4.1, y, 5.4, 0.76);
      iconBadge(s, await icon(rows[i][0], C.TEAL_DK), 4.25, y + 0.12, 0.52, C.TEAL_TINT);
      s.addText(rows[i][1], { x: 4.95, y: y + 0.08, w: 4.4, h: 0.28, fontFace: C.FONT, fontSize: 14, bold: true, color: C.INK, margin: 0 });
      s.addText(rows[i][2], { x: 4.95, y: y + 0.36, w: 4.4, h: 0.32, fontFace: C.FONT, fontSize: 11, color: C.MUTED, margin: 0, valign: "top" });
    }
    s.addNotes("The failure is not that people can't report - it's what happens after. Duplicates bury staff, there's no severity triage, nobody verifies claims, and the citizen is left in the dark. That broken loop is what CivicPulse fixes.");
  }
};
