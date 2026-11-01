import { describe, it, expect } from 'vitest';
import {
  renderLatexAndMarkdown,
  generateMarkdownHandout,
} from '../utils/markdown';
import { createSamplePresentationPdf } from '../utils/samplePdf';
import type { PageAnnotations } from '../types/presentation';

describe('Markdown & Offline Math Parser', () => {
  it('renders inline math $...$ with KaTeX HTML', () => {
    const input = 'Mass-energy equivalence is $E = mc^2$, very elegant.';
    const output = renderLatexAndMarkdown(input);

    expect(output).toContain('Mass-energy equivalence is');
    expect(output).toContain('katex');
    expect(output).toContain('E = mc^2');
  });

  it('renders block math $$...$$ with display mode wrapper', () => {
    const input = '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$';
    const output = renderLatexAndMarkdown(input);

    expect(output).toContain('katex-display-wrapper');
    expect(output).toContain('katex-display');
  });

  it('handles mixed markdown and text', () => {
    const input = '# Core Theorem\n**Importance**: Let $f(x)$ be continuous.\n- Point 1: $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$';
    const output = renderLatexAndMarkdown(input);

    expect(output).toContain('<h1>Core Theorem</h1>');
    expect(output).toContain('<strong>Importance</strong>');
    expect(output).toContain('<ul class="note-list">');
    expect(output).toContain('katex');
  });

  it('handles invalid math gracefully without throwing errors', () => {
    const input = 'Unclosed math formula $\\frac{1}{2';
    expect(() => renderLatexAndMarkdown(input)).not.toThrow();
  });
});

describe('Markdown Handout Generator', () => {
  it('generates a clean, standalone Markdown lecture notes handout', () => {
    const sampleNotes: Record<number, PageAnnotations> = {
      1: {
        pageNumber: 1,
        strokes: [],
        presenterNotes: 'Slide 1 Notes:\n- Introduction to quantum mechanics.\n- Emphasize Schrodinger equation: $$i\\hbar \\frac{\\partial}{\\partial t} |\\psi\\rangle = \\hat{H} |\\psi\\rangle$$',
      },
      2: {
        pageNumber: 2,
        strokes: [
          {
            id: 's-1',
            tool: 'pen',
            color: '#ef4444',
            width: 3,
            opacity: 1,
            points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
          },
        ],
        presenterNotes: 'Slide 2 Notes: Includes handwritten markup.',
      },
    };

    const md = generateMarkdownHandout({
      title: 'Quantum Mechanics Lecture',
      totalPages: 2,
      notes: sampleNotes,
    });

    // Verify markdown headers and content
    expect(md).toContain('# Quantum Mechanics Lecture - Presentation Notes & Script');
    expect(md).toContain('## Slide 1 / 2');
    expect(md).toContain('## Slide 2 / 2');
    expect(md).toContain('Schrodinger equation');
    expect(md).toContain('drawing/highlight annotations');
  });

  it('handles empty notes gracefully', () => {
    const md = generateMarkdownHandout({
      title: 'Empty Presentation',
      totalPages: 1,
      notes: {},
    });

    expect(md).toContain('# Empty Presentation');
    expect(md).toContain('## Slide 1 / 1');
    expect(md).toContain('(No notes for this slide)');
  });
});

describe('Sample Presentation PDF Generator', () => {
  it('generates a valid PDF 1.4 binary stream with correct markers', () => {
    const bytes = createSamplePresentationPdf();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);

    // Verify PDF header %PDF-1.4
    const headerStr = String.fromCharCode(...bytes.slice(0, 8));
    expect(headerStr).toContain('%PDF-1.4');

    // Verify PDF trailer %%EOF
    const trailerStr = String.fromCharCode(...bytes.slice(bytes.length - 10));
    expect(trailerStr).toContain('%%EOF');
  });
});

describe('User Preferences & Stroke Width Settings', () => {
  it('saves and loads user preferences including pen width and notes mode', async () => {
    const { saveUserPreferences, loadUserPreferences } = await import('../utils/storage');

    saveUserPreferences({
      penWidth: 8,
      penColor: '#3b82f6',
      highlighterWidth: 36,
      notesWindowMode: 'popup',
    });

    const loaded = loadUserPreferences();
    expect(loaded.penWidth).toBe(8);
    expect(loaded.penColor).toBe('#3b82f6');
    expect(loaded.highlighterWidth).toBe(36);
    expect(loaded.notesWindowMode).toBe('popup');
  });

  it('updates pen width and clamps within safe boundaries', async () => {
    const { usePresentation } = await import('../composables/usePresentation');
    const presentation = usePresentation();

    presentation.setPenWidth(12);
    expect(presentation.state.penWidth).toBe(12);

    // Clamps minimum to 1
    presentation.setPenWidth(0);
    expect(presentation.state.penWidth).toBe(1);

    // Clamps maximum to 40
    presentation.setPenWidth(100);
    expect(presentation.state.penWidth).toBe(40);

    // Restore to standard
    presentation.setPenWidth(4);
    expect(presentation.state.penWidth).toBe(4);
  });

  it('toggles presenter notes window mode between popup and drawer', async () => {
    const { usePresentation } = await import('../composables/usePresentation');
    const presentation = usePresentation();

    presentation.state.notesWindowMode = 'popup';
    presentation.toggleNotesWindowMode();
    expect(presentation.state.notesWindowMode).toBe('drawer');

    presentation.toggleNotesWindowMode();
    expect(presentation.state.notesWindowMode).toBe('popup');
  });

  it('provides openNotesPopoutWindow method for dual screen presentation support', async () => {
    const { usePresentation } = await import('../composables/usePresentation');
    const presentation = usePresentation();
    expect(typeof presentation.openNotesPopoutWindow).toBe('function');
  });

  it('loads NotesWindow component without errors', async () => {
    const NotesWindow = await import('../components/NotesWindow.vue');
    expect(NotesWindow.default).toBeDefined();
  });

  it('persists and synchronizes live presenter notes state for the dual-screen window', async () => {
    const { usePresentation } = await import('../composables/usePresentation');
    const { loadLivePresentationSync } = await import('../utils/storage');
    const presentation = usePresentation();

    presentation.state.currentPdfName = 'Lecture-01.pdf';
    presentation.state.numPages = 3;
    presentation.state.currentPage = 1;
    presentation.updatePresenterNotes('# Slide 1 Key Points\n- Remember $E = mc^2$');
    presentation.syncToExternalNotesWindow();

    const synced = loadLivePresentationSync();
    expect(synced).not.toBeNull();
    expect(synced?.title).toBe('Lecture-01');
    expect(synced?.page).toBe(1);
    expect(synced?.numPages).toBe(3);
    expect(synced?.notes).toContain('# Slide 1 Key Points');
    expect(synced?.allNotes[1]).toContain('$E = mc^2$');
  });
});

describe('Application Versioning System', () => {
  it('reads canonical version 1.0.0 from package.json and formats display string', async () => {
    const { APP_VERSION, formatAppVersion, getAppDisplayName, resolveAppVersion } = await import('../utils/version');
    const pkg = await import('../../package.json');

    expect(APP_VERSION).toBe('1.0.0');
    expect(APP_VERSION).toBe(pkg.default.version);
    expect(formatAppVersion()).toBe('v1.0.0');
    expect(formatAppVersion('v1.0.0')).toBe('v1.0.0');
    expect(getAppDisplayName()).toBe('PDF Presenter v1.0.0');

    const resolved = await resolveAppVersion();
    expect(resolved).toBe('1.0.0');
  });
});
