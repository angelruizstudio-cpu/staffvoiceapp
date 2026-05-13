function pdfUnicodeString(value) {
  const text = String(value || "");
  const bytes = [0xfe, 0xff];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }
  return `<${Buffer.from(bytes).toString("hex").toUpperCase()}>`;
}

function wrapLine(line, maxLength = 92) {
  const words = String(line || "").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
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
  return lines.length ? lines : [""];
}

function buildTextPdf(title, sections) {
  const lines = [title, "", ...sections.flatMap((section) => {
    const value = section.value === undefined || section.value === null || section.value === ""
      ? "Not provided"
      : section.value;
    const wrapped = wrapLine(`${section.label}: ${value}`);
    return [wrapped[0], ...wrapped.slice(1).map((line) => `  ${line}`), ""];
  })];

  const linesPerPage = 46;
  const pages = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogRef = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesRef = addObject("");
  const fontRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageRefs = [];

  pages.forEach((pageLines, pageIndex) => {
    const content = [
      "BT",
      pageIndex === 0 ? "/F1 16 Tf" : "/F1 10 Tf",
      `50 ${pageIndex === 0 ? 760 : 750} Td`,
      pageIndex === 0 ? `${pdfUnicodeString(pageLines[0])} Tj` : ""
    ].filter(Boolean);

    const startLine = pageIndex === 0 ? 1 : 0;
    if (pageIndex === 0) content.push("/F1 10 Tf");
    for (const line of pageLines.slice(startLine)) {
      content.push("0 -15 Td");
      content.push(`${pdfUnicodeString(line)} Tj`);
    }
    content.push("ET");

    const stream = content.join("\n");
    const contentRef = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    const pageRef = addObject(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`);
    pageRefs.push(pageRef);
  });

  objects[pagesRef - 1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return Buffer.from(chunks.join(""), "utf8");
}

module.exports = {
  buildTextPdf
};
