import { reactive, computed, watch } from 'vue';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  PresentationMode,
  PointerTool,
  LaserColor,
  PageAnnotations,
  DrawingStroke,
} from '../types/presentation';
import { pdfService } from '../services/pdfService';
import { createSamplePresentationPdf } from '../utils/samplePdf';
import {
  saveAnnotationsToStorage,
  loadAnnotationsFromStorage,
  saveUserPreferences,
  loadUserPreferences,
  saveLivePresentationSync,
  type LivePresentationSyncData,
} from '../utils/storage';
import { generateMarkdownHandout } from '../utils/markdown';

const savedPrefs = loadUserPreferences();

const state = reactive({
  currentPdfName: '',
  currentPdfPath: null as string | null,
  numPages: 0,
  currentPage: 1,
  mode: 'normal' as PresentationMode,
  activeTool: 'cursor' as PointerTool,
  laserColor: (savedPrefs.laserColor as LaserColor) || 'red',
  laserSize: 14,
  penColor: savedPrefs.penColor || '#ef4444',
  penWidth: savedPrefs.penWidth ?? 4,
  highlighterColor: savedPrefs.highlighterColor || '#ffe600',
  highlighterWidth: savedPrefs.highlighterWidth ?? 24,
  blackScreen: false,
  whiteScreen: false,
  showThumbnails: false,
  showNotesDrawer: false,
  notesWindowMode: savedPrefs.notesWindowMode || 'popup',
  showExportModal: false,
  fitMode: 'contain' as 'contain' | 'fit-width' | 'fit-height',
  zoomScale: 1.0,
  panX: 0,
  panY: 0,
  isLoading: false,
  errorMessage: '',
});

// Watch preference changes and persist them
watch(
  [
    () => state.penWidth,
    () => state.penColor,
    () => state.highlighterWidth,
    () => state.highlighterColor,
    () => state.laserColor,
    () => state.notesWindowMode,
  ],
  () => {
    saveUserPreferences({
      penWidth: state.penWidth,
      penColor: state.penColor,
      highlighterWidth: state.highlighterWidth,
      highlighterColor: state.highlighterColor,
      laserColor: state.laserColor,
      notesWindowMode: state.notesWindowMode,
    });
  }
);

const annotations = reactive<Record<number, PageAnnotations>>({});
const strokeRedoStack = reactive<Record<number, DrawingStroke[]>>({});

function initPageAnnotations(page: number): PageAnnotations {
  if (!annotations[page]) {
    annotations[page] = {
      pageNumber: page,
      strokes: [],
      presenterNotes: '',
    };
  }
  return annotations[page];
}

// Cross-window synchronization state (BroadcastChannel + LocalStorage + Tauri Event Bus)
const NOTES_CHANNEL_NAME = 'pdf-presenter-notes-sync';
let notesSyncChannel: BroadcastChannel | null = null;
let isSyncListenerInitialized = false;

function buildLiveSyncPayload(): LivePresentationSyncData {
  const allNotes: Record<number, string> = {};
  const maxPage = Math.max(
    state.numPages,
    ...Object.keys(annotations).map((k) => Number(k) || 0),
    1
  );
  for (let p = 1; p <= maxPage; p++) {
    allNotes[p] = annotations[p]?.presenterNotes || '';
  }

  return {
    title: state.currentPdfName.replace(/\.pdf$/i, '') || 'Presentation Notes',
    currentPdfName: state.currentPdfName,
    page: state.currentPage,
    numPages: Math.max(state.numPages, 1),
    notes: annotations[state.currentPage]?.presenterNotes || '',
    allNotes,
    blackScreen: state.blackScreen,
    whiteScreen: state.whiteScreen,
    updatedAt: Date.now(),
  };
}

function syncToExternalNotesWindow() {
  if (state.numPages <= 0 && !state.currentPdfName) return;

  const payload = buildLiveSyncPayload();
  saveLivePresentationSync(payload);

  if (notesSyncChannel) {
    try {
      notesSyncChannel.postMessage({
        type: 'sync',
        ...payload,
      });
    } catch (err) {
      console.warn('BroadcastChannel postMessage error:', err);
    }
  }

  if (isTauri()) {
    import('@tauri-apps/api/event')
      .then(({ emit }) => emit('presenter-notes-sync', payload))
      .catch(() => {});
  }
}

// Watch annotations changes and save to storage + sync to external notes window
watch(
  () => annotations,
  () => {
    if (state.currentPdfName) {
      saveAnnotationsToStorage(state.currentPdfName, annotations);
    }
    syncToExternalNotesWindow();
  },
  { deep: true }
);

// Watch presentation state changes and sync to external notes window
watch(
  [
    () => state.currentPage,
    () => state.numPages,
    () => state.currentPdfName,
    () => state.blackScreen,
    () => state.whiteScreen,
  ],
  () => {
    syncToExternalNotesWindow();
  }
);

export function usePresentation() {
  const isPresentation = computed(() => state.mode === 'presentation');
  const hasPdfLoaded = computed(() => state.numPages > 0);

  const currentPageAnnotations = computed((): PageAnnotations => {
    return initPageAnnotations(state.currentPage);
  });

  const canUndo = computed(() => {
    return (currentPageAnnotations.value?.strokes?.length || 0) > 0;
  });

  const canRedo = computed(() => {
    return (strokeRedoStack[state.currentPage]?.length || 0) > 0;
  });

  function handleIncomingNotesCommand(data: any) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'request_sync') {
      syncToExternalNotesWindow();
    } else if (data.type === 'update_notes' && typeof data.notes === 'string') {
      const targetPage = typeof data.page === 'number' && data.page >= 1 ? data.page : state.currentPage;
      const pageNotes = initPageAnnotations(targetPage);
      if (pageNotes.presenterNotes !== data.notes) {
        pageNotes.presenterNotes = data.notes;
      }
    } else if (data.type === 'prev_page') {
      prevPage();
    } else if (data.type === 'next_page') {
      nextPage();
    } else if (data.type === 'go_to_page' && typeof data.page === 'number') {
      goToPage(data.page);
    } else if (data.type === 'toggle_black_screen') {
      toggleBlackScreen();
    } else if (data.type === 'toggle_white_screen') {
      toggleWhiteScreen();
    }
  }

  function initExternalNotesSync() {
    if (typeof window === 'undefined') return;

    if (!notesSyncChannel && typeof BroadcastChannel !== 'undefined') {
      notesSyncChannel = new BroadcastChannel(NOTES_CHANNEL_NAME);
      notesSyncChannel.onmessage = (event) => {
        handleIncomingNotesCommand(event.data);
      };
    }

    if (!isSyncListenerInitialized) {
      isSyncListenerInitialized = true;
      if (isTauri()) {
        import('@tauri-apps/api/event')
          .then(({ listen }) => {
            listen('presenter-notes-command', (event) => {
              handleIncomingNotesCommand(event.payload);
            });
          })
          .catch(() => {});
      }
    }
  }

  async function loadPdfData(
    name: string,
    data: Uint8Array | ArrayBuffer,
    path: string | null = null
  ) {
    state.isLoading = true;
    state.errorMessage = '';
    resetZoom();
    try {
      const count = await pdfService.loadPdf(data);
      state.numPages = count;
      state.currentPage = 1;
      state.currentPdfName = name;
      state.currentPdfPath = path;

      // Restore saved annotations
      const saved = loadAnnotationsFromStorage(name);
      for (const key of Object.keys(annotations)) {
        delete annotations[Number(key)];
      }
      Object.assign(annotations, saved);

      // Preload current page annotations
      initPageAnnotations(1);
      syncToExternalNotesWindow();
    } catch (err: any) {
      console.error('Failed to load PDF:', err);
      state.errorMessage = `Failed to load PDF: ${err?.message || err}`;
    } finally {
      state.isLoading = false;
    }
  }

  async function loadSamplePdf() {
    const pdfData = createSamplePresentationPdf();
    await loadPdfData('Sample-Presentation.pdf', pdfData, null);

    // Populate helpful sample presenter notes for slide 1 & 2
    if (!annotations[1]?.presenterNotes) {
      initPageAnnotations(1).presenterNotes =
`# Welcome Presenter!
- This slide serves as an introduction to the presentation system.
- Press **L** to toggle the PPT Laser Pointer.
- Use mouse wheel to **zoom in/out locally**; click "Fit Page" or "Fit Width" anytime to reset zoom.
- Pen and highlighter support shortcuts **Ctrl+Z** (Undo) and **Ctrl+R** (Redo).
- Supports standard Markdown syntax and math formulas: e.g., mass-energy equivalence $E = mc^2$ and Gaussian integral $\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$.
- Operates **completely offline** with pure Markdown and zero external dependencies.`;
    }

    if (!annotations[2]?.presenterNotes) {
      initPageAnnotations(2).presenterNotes =
`# Physics and Mathematical Theory
Key overview of Maxwell's Equations:
$$
\\begin{aligned}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\
\\nabla \\cdot \\mathbf{B} &= 0 \\\\
\\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\
\\nabla \\times \\mathbf{B} &= \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}
\\end{aligned}
$$
During your talk, use the mouse wheel to zoom in on formula details, and use shortcuts to highlight or annotate.`;
    }

    saveAnnotationsToStorage(state.currentPdfName, annotations);
    syncToExternalNotesWindow();
  }

  async function loadPdfFromPath(filePath: string) {
    if (!filePath) return;
    if (!filePath.toLowerCase().endsWith('.pdf')) {
      state.errorMessage = 'Please select or drop a valid PDF document (.pdf).';
      return;
    }

    try {
      state.isLoading = true;
      state.errorMessage = '';
      const bytes = await invoke<number[]>('read_pdf_file', { path: filePath });
      const uint8 = new Uint8Array(bytes);
      const fileName = filePath.replace(/\\/g, '/').split('/').pop() || 'document.pdf';
      await loadPdfData(fileName, uint8, filePath);
    } catch (err: any) {
      console.error('File read error:', err);
      state.errorMessage = `Failed to open file: ${err?.message || err}`;
    } finally {
      state.isLoading = false;
    }
  }

  async function openPdfFileDialog() {
    try {
      const filePath = await invoke<string | null>('pick_pdf_file');
      if (!filePath) return;
      await loadPdfFromPath(filePath);
    } catch (err: any) {
      console.error('File dialog / read error:', err);
      state.errorMessage = `Failed to open file: ${err?.message || err}`;
    }
  }

  function nextPage() {
    if (state.currentPage < state.numPages) {
      state.currentPage++;
      state.blackScreen = false;
      state.whiteScreen = false;
      resetZoom();
    }
  }

  function prevPage() {
    if (state.currentPage > 1) {
      state.currentPage--;
      state.blackScreen = false;
      state.whiteScreen = false;
      resetZoom();
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= state.numPages) {
      state.currentPage = page;
      state.blackScreen = false;
      state.whiteScreen = false;
      resetZoom();
    }
  }

  async function togglePresentationMode(force?: boolean) {
    const nextMode = typeof force === 'boolean' ? force : state.mode !== 'presentation';
    state.mode = nextMode ? 'presentation' : 'normal';

    // If entering presentation mode, default to laser pointer if on normal cursor
    if (nextMode && state.activeTool === 'cursor') {
      state.activeTool = 'laser';
    } else if (!nextMode && state.activeTool === 'laser') {
      state.activeTool = 'cursor';
    }

    try {
      await invoke('set_fullscreen', { fullscreen: nextMode });
    } catch {
      // Fallback to web fullscreen
      if (nextMode && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!nextMode && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  function setTool(tool: PointerTool) {
    state.activeTool = tool;
  }

  function toggleBlackScreen() {
    state.blackScreen = !state.blackScreen;
    if (state.blackScreen) state.whiteScreen = false;
  }

  function toggleWhiteScreen() {
    state.whiteScreen = !state.whiteScreen;
    if (state.whiteScreen) state.blackScreen = false;
  }

  function toggleThumbnails() {
    state.showThumbnails = !state.showThumbnails;
  }

  function toggleNotesDrawer() {
    state.showNotesDrawer = !state.showNotesDrawer;
  }

  // Drawing Stroke manipulation with full Undo / Redo
  function addStroke(stroke: DrawingStroke) {
    const pageNotes = initPageAnnotations(state.currentPage);
    pageNotes.strokes.push(stroke);
    // Clear redo history when a new action is performed
    strokeRedoStack[state.currentPage] = [];
  }

  function clearCurrentPageStrokes() {
    const pageNotes = initPageAnnotations(state.currentPage);
    if (pageNotes.strokes.length > 0) {
      strokeRedoStack[state.currentPage] = [...pageNotes.strokes];
      pageNotes.strokes = [];
    }
  }

  function undoStroke() {
    const pageNotes = initPageAnnotations(state.currentPage);
    if (pageNotes.strokes.length > 0) {
      const popped = pageNotes.strokes.pop()!;
      if (!strokeRedoStack[state.currentPage]) {
        strokeRedoStack[state.currentPage] = [];
      }
      strokeRedoStack[state.currentPage].push(popped);
    }
  }

  function redoStroke() {
    const redoList = strokeRedoStack[state.currentPage];
    if (redoList && redoList.length > 0) {
      const restored = redoList.pop()!;
      const pageNotes = initPageAnnotations(state.currentPage);
      pageNotes.strokes.push(restored);
    }
  }

  function updatePresenterNotes(text: string) {
    const pageNotes = initPageAnnotations(state.currentPage);
    pageNotes.presenterNotes = text;
  }

  // Zoom and pan functions
  function zoomAt(factorDelta: number, clientX?: number, clientY?: number, containerRect?: DOMRect) {
    const oldScale = state.zoomScale;
    let newScale = oldScale * factorDelta;
    newScale = Math.max(1.0, Math.min(5.0, newScale));

    // When scaling back to 1.0 or lower, reset position to center
    if (newScale <= 1.01) {
      resetZoom();
      return;
    }

    if (clientX !== undefined && clientY !== undefined && containerRect) {
      const relX = (clientX - containerRect.left) - containerRect.width / 2;
      const relY = (clientY - containerRect.top) - containerRect.height / 2;

      const scaleRatio = newScale / oldScale;
      state.panX = state.panX * scaleRatio - relX * (scaleRatio - 1);
      state.panY = state.panY * scaleRatio - relY * (scaleRatio - 1);
    }

    state.zoomScale = newScale;
  }

  function resetZoom() {
    state.zoomScale = 1.0;
    state.panX = 0;
    state.panY = 0;
  }

  function setFitMode(mode: 'contain' | 'fit-width' | 'fit-height') {
    state.fitMode = mode;
    resetZoom();
  }

  function setPenWidth(width: number) {
    state.penWidth = Math.max(1, Math.min(40, width));
  }

  function setHighlighterWidth(width: number) {
    state.highlighterWidth = Math.max(4, Math.min(80, width));
  }

  function toggleNotesWindowMode() {
    state.notesWindowMode = state.notesWindowMode === 'popup' ? 'drawer' : 'popup';
  }

  function getMarkdownSource(): string {
    return generateMarkdownHandout({
      title: state.currentPdfName.replace(/\.pdf$/i, '') || 'Presentation Notes',
      totalPages: state.numPages,
      notes: annotations,
    });
  }

  async function openNotesPopoutWindow() {
    initExternalNotesSync();
    syncToExternalNotesWindow();
    // Hide the in-page notes overlay in the main window so the slide view is unobstructed
    state.showNotesDrawer = false;

    try {
      if (isTauri()) {
        await invoke('open_notes_window');
        syncToExternalNotesWindow();
        setTimeout(() => syncToExternalNotesWindow(), 150);
        setTimeout(() => syncToExternalNotesWindow(), 400);
        return;
      }
    } catch (err) {
      console.warn('Tauri open_notes_window invoke failed or not in desktop environment:', err);
    }

    const url = '/?view=notes';
    const win = window.open(
      url,
      'pdf_presenter_notes_popout',
      'width=960,height=680,menubar=no,toolbar=no,status=no,resizable=yes'
    );
    if (!win) {
      const fallbackTab = window.open(url, '_blank');
      if (!fallbackTab) {
        alert('Popup window was blocked by the browser. Please allow popups for this site in your browser settings.');
      }
    } else {
      win.focus();
      setTimeout(() => syncToExternalNotesWindow(), 200);
    }
  }

  return {
    state,
    annotations,
    isPresentation,
    hasPdfLoaded,
    currentPageAnnotations,
    canUndo,
    canRedo,
    initExternalNotesSync,
    syncToExternalNotesWindow,
    loadPdfData,
    loadPdfFromPath,
    loadSamplePdf,
    openPdfFileDialog,
    nextPage,
    prevPage,
    goToPage,
    togglePresentationMode,
    setTool,
    setPenWidth,
    setHighlighterWidth,
    toggleNotesWindowMode,
    toggleBlackScreen,
    toggleWhiteScreen,
    toggleThumbnails,
    toggleNotesDrawer,
    openNotesPopoutWindow,
    addStroke,
    clearCurrentPageStrokes,
    undoStroke,
    redoStroke,
    updatePresenterNotes,
    zoomAt,
    resetZoom,
    setFitMode,
    getMarkdownSource,
  };
}
