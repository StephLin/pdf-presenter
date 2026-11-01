/**
 * Pure TypeScript Generator for a Multi-page Sample Presentation PDF.
 * Valid PDF 1.4 binary format, works 100% offline without external dependencies.
 */
export function createSamplePresentationPdf(): Uint8Array {
  const slides = [
    {
      title: "Cross-Platform PDF Presentation Engine",
      subtitle: "Tauri 2.0 + Vue 3 + Rust + XeLaTeX Presentation System",
      author: "Presenter / Academic Speaker",
      items: [
        "Interactive PowerPoint-like presentation experience for PDF documents",
        "PowerPoint Laser Pointer & Spotlight modes with live visual feedback",
        "Freehand ink pen and translucent highlighter for on-screen markup",
        "Full offline support for mathematical formulas and CJK typography",
      ],
      footnote: "Press F5 to Enter Fullscreen Presentation Mode | Press L for Laser Pointer",
    },
    {
      title: "Advanced Mathematical Foundations",
      subtitle: "XeLaTeX Formula Support: Quantum Mechanics & Electrodynamics",
      author: "Theoretical Physics & Applied Mathematics",
      items: [
        "Schrodinger Equation: i hbar d/dt |psi> = H |psi>",
        "Maxwell's Equations: div E = rho/epsilon_0, div B = 0",
        "Faraday's Law: curl E = -dB/dt",
        "Ampere-Maxwell Law: curl B = mu_0 J + mu_0 epsilon_0 dE/dt",
      ],
      footnote: "Add floating XeLaTeX notes or presenter notes using the toolbar",
    },
    {
      title: "Machine Learning & Optimization",
      subtitle: "Convex Optimization and Deep Neural Networks",
      author: "Artificial Intelligence Laboratory",
      items: [
        "Objective: Minimize empirical risk L(theta) = 1/N sum L(f(x_i), y_i)",
        "Gradient Descent step: theta_{t+1} = theta_t - eta grad L(theta_t)",
        "Attention Mechanism: Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V",
        "Euler-Lagrange Equation: d/dt (partial L / partial v) = partial L / partial q",
      ],
      footnote: "Try using the Spotlight mode (S key) to highlight specific equations",
    },
    {
      title: "Cross-Platform Native Architecture",
      subtitle: "Operating System Independence & High Performance",
      author: "Systems Architecture",
      items: [
        "Rust Backend: High throughput, safe native filesystem & process bridge",
        "Zero Cloud Dependency: 100% offline KaTeX fonts, PDF.js canvas rendering",
        "Identical experience across Windows, macOS, and Linux platforms",
        "Portable XeLaTeX export with native CJK font auto-detection",
      ],
      footnote: "Press G to toggle Slide Grid Sorter | Press N to open Notes Drawer",
    },
    {
      title: "Summary & Presentation Controls",
      subtitle: "Quick Keyboard Shortcuts & Gesture Reference",
      author: "Reference Guide",
      items: [
        "Navigation: [Space] / [Right Arrow] next, [Left Arrow] previous",
        "Presentation Mode: [F5] Start, [Esc] Exit presentation",
        "Visual Aids: [L] Laser Pointer, [S] Spotlight, [D] Drawing Pen, [H] Highlighter",
        "Screen Focus: [B] Black Screen toggle, [W] White Screen toggle",
      ],
      footnote: "Export notes as a compilable XeLaTeX document via the Notes menu",
    },
  ];

  const objects: string[] = [];
  const byteOffsets: number[] = [];
  let buffer = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";

  function addObj(content: string): number {
    const id = objects.length + 1;
    byteOffsets.push(buffer.length);
    const objStr = `${id} 0 obj\n${content}\nendobj\n`;
    buffer += objStr;
    objects.push(objStr);
    return id;
  }

  // Font object 1 (Helvetica)
  const fontHelveticaId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // Font object 2 (Helvetica-Bold)
  const fontBoldId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  // Font object 3 (Helvetica-Oblique)
  const fontItalicId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");

  const pageIds: number[] = [];

  // Slide width 16:9 ratio: 960 x 540 pt
  const W = 960;
  const H = 540;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    let stream = "";

    // Background gradient/fill: Deep modern slate presentation background
    stream += "q\n";
    stream += "0.07 0.09 0.13 rg\n"; // Dark slate #121722
    stream += `0 0 ${W} ${H} re f\n`;

    // Accent top banner line
    stream += "0.22 0.44 0.98 rg\n"; // Royal electric blue
    stream += `0 ${H - 6} ${W} 6 re f\n`;

    // Decorative slide card
    stream += "0.11 0.14 0.20 rg\n"; // Card background #1c2433
    stream += `40 40 ${W - 80} ${H - 90} re f\n`;

    // Slide number pill badge
    stream += "0.18 0.23 0.32 rg\n";
    stream += `${W - 140} ${H - 95} 80 30 re f\n`;
    stream += "BT\n";
    stream += `/F2 12 Tf\n`;
    stream += "0.60 0.70 0.90 rg\n";
    stream += `${W - 125} ${H - 77} Td\n`;
    stream += `(${i + 1} / ${slides.length}) Tj\n`;
    stream += "ET\n";

    // Title text
    stream += "BT\n";
    stream += `/F2 26 Tf\n`;
    stream += "0.95 0.96 0.98 rg\n"; // Pure bright white
    stream += `70 ${H - 100} Td\n`;
    stream += `(${escapePdf(slide.title)}) Tj\n`;
    stream += "ET\n";

    // Subtitle text
    stream += "BT\n";
    stream += `/F3 14 Tf\n`;
    stream += "0.45 0.65 0.98 rg\n"; // Vibrant blue
    stream += `70 ${H - 130} Td\n`;
    stream += `(${escapePdf(slide.subtitle)}) Tj\n`;
    stream += "ET\n";

    // Divider line
    stream += "0.25 0.30 0.42 RG\n1.5 w\n";
    stream += `70 ${H - 150} m ${W - 70} ${H - 150} l S\n`;

    // Bullet items
    let curY = H - 195;
    for (let j = 0; j < slide.items.length; j++) {
      const item = slide.items[j];
      
      // Bullet icon dot
      stream += "0.28 0.52 0.98 rg\n";
      stream += `85 ${curY + 4} 8 8 re f\n`;

      // Item text
      stream += "BT\n";
      stream += `/F1 15 Tf\n`;
      stream += "0.85 0.88 0.92 rg\n";
      stream += `110 ${curY} Td\n`;
      stream += `(${escapePdf(item)}) Tj\n`;
      stream += "ET\n";

      curY -= 48;
    }

    // Footnote / shortcut tip at bottom of card
    stream += "0.15 0.19 0.27 rg\n";
    stream += `60 55 ${W - 120} 32 re f\n`;
    stream += "BT\n";
    stream += `/F3 11 Tf\n`;
    stream += "0.55 0.62 0.75 rg\n";
    stream += `80 67 Td\n`;
    stream += `(${escapePdf(slide.footnote)}) Tj\n`;
    stream += "ET\n";

    stream += "Q\n";

    const streamLen = stream.length;
    const contentObjId = addObj(`<< /Length ${streamLen} >>\nstream\n${stream}\nendstream`);

    // Page object placeholder (we will fill Pages parent ID later)
    const pageObjId = addObj(
      `<< /Type /Page /Parent PAGE_PARENT_PLACEHOLDER /MediaBox [0 0 ${W} ${H}] ` +
      `/Contents ${contentObjId} 0 R ` +
      `/Resources << /Font << /F1 ${fontHelveticaId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontItalicId} 0 R >> >> >>`
    );
    pageIds.push(pageObjId);
  }

  // Pages container object
  const kidsStr = pageIds.map(id => `${id} 0 R`).join(" ");
  const pagesObjContent = `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageIds.length} >>`;
  const pagesObjId = addObj(pagesObjContent);

  // Replace parent placeholder in each Page object
  for (const pid of pageIds) {
    const idx = pid - 1;
    objects[idx] = objects[idx].replace("PAGE_PARENT_PLACEHOLDER", `${pagesObjId} 0 R`);
  }

  // Catalog object
  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`);

  // Re-serialize all objects to calculate accurate byte offsets for xref table
  let finalBuffer = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const finalOffsets: number[] = [];

  for (let i = 0; i < objects.length; i++) {
    finalOffsets.push(finalBuffer.length);
    finalBuffer += objects[i];
  }

  const xrefOffset = finalBuffer.length;
  finalBuffer += `xref\n0 ${objects.length + 1}\n`;
  finalBuffer += "0000000000 65535 f \n";

  for (let i = 0; i < objects.length; i++) {
    const offsetStr = String(finalOffsets[i]).padStart(10, "0");
    finalBuffer += `${offsetStr} 00000 n \n`;
  }

  finalBuffer += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
  finalBuffer += `startxref\n${xrefOffset}\n%%EOF\n`;

  // Convert string to Uint8Array
  const uint8 = new Uint8Array(finalBuffer.length);
  for (let i = 0; i < finalBuffer.length; i++) {
    uint8[i] = finalBuffer.charCodeAt(i) & 0xff;
  }

  return uint8;
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
