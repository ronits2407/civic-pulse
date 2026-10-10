const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");

const C = {
  NAVY: "0B1B2B",
  NAVY_CARD: "13293D",
  NAVY_LINE: "23415D",
  TEAL: "14B8A6",
  TEAL_DK: "0F766E",
  TEAL_TINT: "D5F5F0",
  AMBER: "F59E0B",
  CORAL: "E5484D",
  LIGHT_BG: "F3F6F9",
  INK: "0F2233",
  MUTED: "5B6B7B",
  MUTED_DK: "9FB3C8",
  SOFT: "CFE3F2",
  WHITE: "FFFFFF",
  FONT: "Arial",
};

async function icon(name, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(fa[name], { color: "#" + color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// always build a fresh object: pptxgenjs mutates option objects
const shadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 2, angle: 90, opacity: 0.12 });

function createContext() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625
  pres.title = "CivicPulse - Hackathon Pitch";
  pres.author = "Team CivicPulse";

  let n = 0;
  function newSlide(dark) {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: dark ? C.NAVY : C.LIGHT_BG };
    if (n > 1) {
      s.addText(String(n), {
        x: 9.0, y: 5.2, w: 0.5, h: 0.25, fontFace: C.FONT, fontSize: 10,
        color: dark ? C.MUTED_DK : C.MUTED, align: "right", margin: 0,
      });
      s.addText("CivicPulse", {
        x: 0.5, y: 5.2, w: 2, h: 0.25, fontFace: C.FONT, fontSize: 10,
        color: dark ? C.MUTED_DK : C.MUTED, margin: 0,
      });
    }
    return s;
  }

  function heading(s, text, dark, kicker) {
    if (kicker) {
      s.addText(kicker.toUpperCase(), {
        x: 0.5, y: 0.35, w: 9, h: 0.25, fontFace: C.FONT, fontSize: 11, bold: true,
        color: dark ? C.TEAL : C.TEAL_DK, charSpacing: 3, margin: 0,
      });
    }
    s.addText(text, {
      x: 0.5, y: 0.62, w: 9, h: 0.65, fontFace: C.FONT, fontSize: 28, bold: true,
      color: dark ? C.WHITE : C.INK, margin: 0, valign: "top",
    });
  }

  function iconBadge(s, img, x, y, d, fill) {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 } });
    const pad = d * 0.27;
    s.addImage({ data: img, x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
  }

  // white card with soft shadow
  function card(s, x, y, w, h, fill) {
    const f = fill || C.WHITE;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: f }, line: { color: f, width: 0 }, shadow: shadow() });
  }

  return { pres, newSlide, heading, iconBadge, card, icon, C };
}

module.exports = { createContext };
