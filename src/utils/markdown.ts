import katex from 'katex';
import type { PageAnnotations } from '../types/presentation';

/**
 * Render mixed Markdown + LaTeX formulas ($...$ and $$...$$) into HTML completely offline using local KaTeX.
 * Fully supports Unicode / CJK characters and offline fonts with zero network requests.
 */
export function renderLatexAndMarkdown(text: string): string {
  if (!text) return '';

  // 1. Process block math $$...$$ first
  let html = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      return `<div class="katex-display-wrapper">${katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      })}</div>`;
    } catch {
      return `<pre class="katex-error">$$${escapeHtml(math)}$$</pre>`;
    }
  });

  // 2. Process inline math $...$
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<code class="katex-error">$${escapeHtml(math)}</code>`;
    }
  });

  // 3. Process markdown formatting: headers, bold, italics, lists, code, blockquotes
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('### ')) {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      processedLines.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      processedLines.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      processedLines.push(`<h1>${formatInline(trimmed.slice(2))}</h1>`);
      continue;
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        processedLines.push('<ul class="note-list">');
        inList = true;
      }
      processedLines.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
      continue;
    } else if (inList) {
      processedLines.push('</ul>');
      inList = false;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      processedLines.push(`<blockquote>${formatInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    // Regular line / paragraph
    if (trimmed === '') {
      processedLines.push('<div class="note-empty-line"></div>');
    } else {
      processedLines.push(`<p>${formatInline(line)}</p>`);
    }
  }

  if (inList) {
    processedLines.push('</ul>');
  }

  return processedLines.join('');
}

function formatInline(text: string): string {
  // Bold
  let out = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a clean standalone offline Markdown handout
 */
export function generateMarkdownHandout(options: {
  title: string;
  totalPages: number;
  notes: Record<number, PageAnnotations>;
}): string {
  const { title, totalPages, notes } = options;
  const dateStr = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let md = `# ${title} - Presentation Notes & Script\n\n`;
  md += `> **Total Slides**: ${totalPages}  \n`;
  md += `> **Exported at**: ${dateStr}  \n`;
  md += `> **Format**: Standard Markdown (Supports LaTeX Math Formulas)\n\n`;
  md += `---\n\n`;

  let hasAnyNotes = false;

  for (let page = 1; page <= totalPages; page++) {
    const pageData = notes[page];
    const presenterNotes = pageData?.presenterNotes?.trim() || '';
    const strokesCount = pageData?.strokes?.length || 0;

    md += `## Slide ${page} / ${totalPages}\n\n`;

    if (presenterNotes) {
      hasAnyNotes = true;
      md += `${presenterNotes}\n\n`;
    } else {
      md += `*(No notes for this slide)*\n\n`;
    }

    if (strokesCount > 0) {
      md += `> ✏️ *This slide contains ${strokesCount} drawing/highlight annotations*\n\n`;
    }

    md += `---\n\n`;
  }

  if (!hasAnyNotes) {
    md += `\n*Note: No presentation notes have been entered yet. Press "N" to open the notes panel to add notes.*\n`;
  }

  return md;
}
