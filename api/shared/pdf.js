const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 40;
const colors = {
  ink: [0.12, 0.19, 0.22],
  muted: [0.39, 0.47, 0.5],
  line: [0.82, 0.88, 0.9],
  soft: [0.96, 0.96, 0.96],
  deep: [0.36, 0.5, 0.55],
  navy: [0.07, 0.20, 0.35],
  gold: [0.72, 0.57, 0.29],
  white: [1, 1, 1]
};

function rgb([r, g, b], operator = "rg") {
  return `${r} ${g} ${b} ${operator}`;
}

function pdfTextString(value) {
  const text = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  return `(${text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

function wrapText(value, maxLength = 82) {
  const paragraphs = String(value || "Not provided").replace(/\r/g, "").split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    let current = "";

    for (const word of words) {
      if (!current) {
        current = word;
      } else if (`${current} ${word}`.length <= maxLength) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    if (!words.length) lines.push("");
  }

  return lines.length ? lines : ["Not provided"];
}

function textCommand({ x, y, text, font = "F1", size = 10, color = colors.ink }) {
  return [
    "BT",
    `/${font} ${size} Tf`,
    rgb(color),
    `${x} ${y} Td`,
    `${pdfTextString(text)} Tj`,
    "ET"
  ].join("\n");
}

function rectCommand({ x, y, width, height, fill, stroke }) {
  const commands = ["q"];
  if (fill) commands.push(rgb(fill));
  if (stroke) commands.push(rgb(stroke, "RG"));
  commands.push(`${x} ${y} ${width} ${height} re`);
  commands.push(fill && stroke ? "B" : fill ? "f" : "S");
  commands.push("Q");
  return commands.join("\n");
}

function lineCommand({ x1, y1, x2, y2, color = colors.line, width = 1 }) {
  return [
    "q",
    rgb(color, "RG"),
    `${width} w`,
    `${x1} ${y1} m`,
    `${x2} ${y2} l`,
    "S",
    "Q"
  ].join("\n");
}

function readChunk(buffer, offset) {
  const length = buffer.readUInt32BE(offset);
  const type = buffer.slice(offset + 4, offset + 8).toString("ascii");
  const data = buffer.slice(offset + 8, offset + 8 + length);
  return { length, type, data, next: offset + 12 + length };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function parsePng(buffer) {
  if (buffer.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const chunk = readChunk(buffer, offset);
    offset = chunk.next;
    if (chunk.type === "IHDR") {
      width = chunk.data.readUInt32BE(0);
      height = chunk.data.readUInt32BE(4);
      bitDepth = chunk.data[8];
      colorType = chunk.data[9];
    }
    if (chunk.type === "IDAT") idat.push(chunk.data);
    if (chunk.type === "IEND") break;
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!width || !height || bitDepth !== 8 || !channels) return null;

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const raw = Buffer.alloc(height * stride);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = inflated.slice(inputOffset, inputOffset + stride);
    inputOffset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? raw[y * stride + x - channels] : 0;
      const up = y > 0 ? raw[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? raw[(y - 1) * stride + x - channels] : 0;
      const value = row[x];
      let unfiltered = value;
      if (filter === 1) unfiltered = value + left;
      if (filter === 2) unfiltered = value + up;
      if (filter === 3) unfiltered = value + Math.floor((left + up) / 2);
      if (filter === 4) unfiltered = value + paeth(left, up, upLeft);
      raw[y * stride + x] = unfiltered & 255;
    }
  }

  const rgbData = Buffer.alloc(width * height * 3);
  const alphaData = colorType === 6 ? Buffer.alloc(width * height) : null;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels;
    rgbData[pixel * 3] = raw[source];
    rgbData[pixel * 3 + 1] = raw[source + 1];
    rgbData[pixel * 3 + 2] = raw[source + 2];
    if (alphaData) alphaData[pixel] = raw[source + 3];
  }

  return {
    width,
    height,
    rgb: zlib.deflateSync(rgbData),
    alpha: alphaData ? zlib.deflateSync(alphaData) : null
  };
}

function loadLogo() {
  const candidates = [
    path.join(__dirname, "wts-seal.png"),
    path.join(__dirname, "..", "..", "assets", "wts-seal.png"),
    path.join(process.cwd(), "assets", "wts-seal.png")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return parsePng(fs.readFileSync(candidate));
    }
  }
  return null;
}

function addObject(objects, body) {
  objects.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8"));
  return objects.length;
}

function makeStream(dictionary, stream) {
  const header = Buffer.from(`<< ${dictionary} /Length ${stream.length} >>\nstream\n`, "utf8");
  const footer = Buffer.from("\nendstream", "utf8");
  return Buffer.concat([header, stream, footer]);
}

function addFooter(commands, pageNumber) {
  commands.push(lineCommand({ x1: margin, y1: 44, x2: pageWidth - margin, y2: 44, color: colors.line }));
  commands.push(textCommand({
    x: margin,
    y: 28,
    text: "Confidential HR record. Store according to institutional retention policy.",
    size: 8,
    color: colors.muted
  }));
  commands.push(textCommand({
    x: pageWidth - 84,
    y: 28,
    text: `Page ${pageNumber}`,
    size: 8,
    color: colors.muted
  }));
}

function addHeader(commands, title, includeLogo) {
  if (includeLogo) {
    commands.push("q\n58 0 0 58 54 742 cm\n/Logo Do\nQ");
  } else {
    commands.push(rectCommand({ x: 54, y: 742, width: 58, height: 58, fill: colors.white, stroke: colors.line }));
    commands.push(textCommand({ x: 70, y: 768, text: "WTS", font: "F2", size: 13, color: colors.deep }));
  }
  commands.push(textCommand({ x: 145, y: 790, text: title, font: "F2", size: 23, color: colors.ink }));
  commands.push(textCommand({ x: 146, y: 766, text: "Western Theological Seminary", font: "F2", size: 10, color: colors.deep }));
  commands.push(textCommand({ x: 146, y: 747, text: "Staff Voice confidential form archive copy", size: 10, color: colors.muted }));
  commands.push(lineCommand({ x1: margin, y1: 715, x2: pageWidth - margin, y2: 715, color: colors.line }));
}

function metadataValue(sections, label) {
  return sections.find((section) => section.label === label)?.value || "Not provided";
}

function addMetadataBox(commands, sections) {
  commands.push(rectCommand({ x: margin, y: 626, width: pageWidth - margin * 2, height: 56, fill: colors.white, stroke: colors.line }));
  const items = [
    ["Case", String(metadataValue(sections, "Report ID")).slice(0, 8).toUpperCase()],
    ["Submitted", metadataValue(sections, "Submitted")],
    ["Type", metadataValue(sections, "What would you like to share")],
    ["Follow-up", metadataValue(sections, "HR follow-up requested")]
  ];
  const columnWidth = (pageWidth - margin * 2) / 4;
  items.forEach(([label, value], index) => {
    const x = margin + index * columnWidth + 14;
    if (index > 0) {
      commands.push(lineCommand({ x1: margin + index * columnWidth, y1: 626, x2: margin + index * columnWidth, y2: 682, color: colors.line }));
    }
    commands.push(textCommand({ x, y: 662, text: label.toUpperCase(), font: "F2", size: 7, color: colors.navy }));
    commands.push(textCommand({ x, y: 644, text: String(value).slice(0, 30), font: "F2", size: 10, color: colors.ink }));
  });

  commands.push(textCommand({ x: margin, y: 602, text: `Staff Council sharing: ${metadataValue(sections, "Share with Staff Council")}`, size: 9, color: colors.muted }));
  commands.push(textCommand({ x: margin, y: 584, text: `Specific area/process: ${metadataValue(sections, "Specific area or process")}`, size: 9, color: colors.muted }));
  commands.push(textCommand({ x: margin, y: 566, text: `Safety/urgency: ${metadataValue(sections, "Safety or urgency level")}`, size: 9, color: colors.muted }));
}

function drawSection(commands, section, y) {
  const value = section.value === undefined || section.value === null || section.value === ""
    ? "Not provided"
    : section.value;
  const lines = wrapText(value, 86);
  const bodyHeight = Math.max(30, 16 + lines.length * 12);
  const height = 24 + bodyHeight;

  commands.push(rectCommand({
    x: margin,
    y: y - 24,
    width: pageWidth - margin * 2,
    height: 24,
    fill: colors.navy
  }));
  commands.push(rectCommand({
    x: margin,
    y: y - height,
    width: pageWidth - margin * 2,
    height: bodyHeight,
    fill: colors.soft,
    stroke: colors.line
  }));
  commands.push(textCommand({
    x: margin + 8,
    y: y - 16,
    text: section.label,
    font: "F2",
    size: 8,
    color: colors.white
  }));

  lines.forEach((line, index) => {
    commands.push(textCommand({
      x: margin + 14,
      y: y - 42 - index * 12,
      text: line,
      size: 8.6,
      color: colors.ink
    }));
  });

  return height;
}

function buildTextPdf(title, sections) {
  const logo = loadLogo();
  const pages = [];
  let commands = [];
  let y = 552;

  addHeader(commands, title, Boolean(logo));
  addMetadataBox(commands, sections);

  const contentSections = sections.filter((section) => !["Report ID", "Submitted", "What would you like to share", "HR follow-up requested", "Share with Staff Council", "Specific area or process", "Safety or urgency level"].includes(section.label));
  for (const section of contentSections) {
    const value = section.value === undefined || section.value === null || section.value === "" ? "Not provided" : section.value;
    const estimatedHeight = 24 + Math.max(30, 16 + wrapText(value, 86).length * 12);
    if (y - estimatedHeight < 70) {
      addFooter(commands, pages.length + 1);
      pages.push(commands);
      commands = [];
      commands.push(textCommand({ x: margin, y: 792, text: title, font: "F2", size: 14, color: colors.ink }));
      commands.push(lineCommand({ x1: margin, y1: 774, x2: pageWidth - margin, y2: 774, color: colors.line }));
      y = 744;
    }
    const used = drawSection(commands, section, y);
    y -= used + 12;
  }
  addFooter(commands, pages.length + 1);
  pages.push(commands);

  const objects = [];
  const catalogRef = addObject(objects, "<< /Type /Catalog /Pages 2 0 R >>");
  const pagesRef = addObject(objects, "");
  const fontRef = addObject(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontRef = addObject(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let logoRef = null;
  let logoMaskRef = null;
  if (logo) {
    if (logo.alpha) {
      logoMaskRef = addObject(objects, makeStream(
        `/Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
        logo.alpha
      ));
    }
    logoRef = addObject(objects, makeStream(
      `/Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${logoMaskRef ? ` /SMask ${logoMaskRef} 0 R` : ""}`,
      logo.rgb
    ));
  }

  const pageRefs = [];
  pages.forEach((pageCommands) => {
    const stream = Buffer.from(pageCommands.join("\n"), "utf8");
    const contentRef = addObject(objects, makeStream("", stream));
    const xObjects = logoRef ? `/XObject << /Logo ${logoRef} 0 R >>` : "";
    const resources = `<< /Font << /F1 ${fontRef} 0 R /F2 ${boldFontRef} 0 R >> ${xObjects} >>`;
    const pageRef = addObject(objects, `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources ${resources} /Contents ${contentRef} 0 R >>`);
    pageRefs.push(pageRef);
  });

  objects[pagesRef - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`, "utf8");

  const chunks = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`, "utf8"), body, Buffer.from("\nendobj\n", "utf8"));
  });

  const beforeXref = Buffer.concat(chunks);
  const xrefOffset = beforeXref.length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  ].join("");

  return Buffer.concat([beforeXref, Buffer.from(xref, "utf8")]);
}

module.exports = {
  buildTextPdf
};
