<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import NotesWindow from './components/NotesWindow.vue';
import { usePresentation } from './composables/usePresentation';
import { useKeyboardNav } from './composables/useKeyboardNav';
import { APP_VERSION, formatAppVersion, getAppDisplayName, resolveAppVersion } from './utils/version';
import PresentationViewer from './components/PresentationViewer.vue';
import PresentationPointer from './components/PresentationPointer.vue';
import PresentationToolbar from './components/PresentationToolbar.vue';
import SlideDrawer from './components/SlideDrawer.vue';
import NotesDrawer from './components/NotesDrawer.vue';
import ExportModal from './components/ExportModal.vue';
import AppIcon from './components/AppIcon.vue';
import {
  FolderOpen,
  Presentation,
  Play,
  FileCode,
  Sparkles,
  ZoomIn,
  PenTool,
  Cpu,
  ArrowRight,
} from 'lucide-vue-next';

// Detect if this instance is running as the popout presenter notes window
const isNotesPopout = ref(false);

if (isTauri()) {
  try {
    const currentWin = getCurrentWindow();
    if (currentWin.label === 'notes_popout') {
      isNotesPopout.value = true;
    }
  } catch (err) {
    console.error('Failed to get current window label:', err);
  }
}

if (
  window.location.search.includes('view=notes') ||
  window.location.search.includes('mode=notes') ||
  window.location.hash.includes('notes')
) {
  isNotesPopout.value = true;
}

const presentation = usePresentation();
const { state, hasPdfLoaded } = presentation;

// Initialize keyboard navigation hooks and cross-window sync only in main window
if (!isNotesPopout.value) {
  useKeyboardNav();
  presentation.initExternalNotesSync();
}

const isDragOver = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const appVersion = ref(APP_VERSION);
const unlistenFns: Array<() => void> = [];

async function handleDroppedPaths(paths: string[] | undefined) {
  isDragOver.value = false;
  if (!paths || paths.length === 0) return;

  const pdfPath = paths.find((p) => p.toLowerCase().endsWith('.pdf'));
  if (pdfPath) {
    await presentation.loadPdfFromPath(pdfPath);
  } else {
    alert('Please drop a PDF document!');
  }
}

onMounted(async () => {
  appVersion.value = await resolveAppVersion();
  const displayTitle = getAppDisplayName(appVersion.value);
  if (!isNotesPopout.value) {
    document.title = displayTitle;
    if (isTauri()) {
      try {
        const currentWin = getCurrentWindow();
        await currentWin.setTitle(displayTitle);
      } catch {
        // Ignore window title update errors in non-main contexts
      }

      try {
        const unlistenWebviewDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
          const payload = event.payload;
          if (payload.type === 'enter' || payload.type === 'over') {
            isDragOver.value = true;
          } else if (payload.type === 'leave') {
            isDragOver.value = false;
          } else if (payload.type === 'drop') {
            await handleDroppedPaths(payload.paths);
          }
        });
        unlistenFns.push(unlistenWebviewDrop);
      } catch {
        // Ignore webview drag-drop listener errors
      }

      try {
        const unlistenBackendDrop = await listen<string[]>('native-file-drop', async (event) => {
          await handleDroppedPaths(event.payload);
        });
        unlistenFns.push(unlistenBackendDrop);
      } catch {
        // Ignore backend drop listener errors
      }
    }
  }
});

onUnmounted(() => {
  while (unlistenFns.length > 0) {
    const fn = unlistenFns.pop();
    try {
      fn?.();
    } catch {
      // Ignore unlisten errors
    }
  }
});

function handleDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types?.includes('Files')) {
    isDragOver.value = true;
  }
}

function handleDragOver(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
  isDragOver.value = true;
}

function handleDragLeave(e: DragEvent) {
  const currentTarget = e.currentTarget as HTMLElement | null;
  const relatedTarget = e.relatedTarget as Node | null;
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return;
  }
  isDragOver.value = false;
}

async function loadPdfFileObject(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    alert('Please drop a PDF document!');
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    await presentation.loadPdfData(file.name || 'document.pdf', buffer, null);
  } catch {
    const reader = new FileReader();
    reader.onload = async () => {
      if (reader.result instanceof ArrayBuffer) {
        await presentation.loadPdfData(file.name || 'document.pdf', reader.result, null);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  void loadPdfFileObject(files[0]);
  target.value = '';
}

function handleDrop(e: DragEvent) {
  isDragOver.value = false;
  if (!e.dataTransfer) return;

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );
    void loadPdfFileObject(pdfFile || files[0]);
    return;
  }

  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          void loadPdfFileObject(file);
          return;
        }
      }
    }
  }
}
</script>

<template>
  <!-- Popout Presenter Notes Window for Dual-Screen View -->
  <NotesWindow v-if="isNotesPopout" />

  <!-- Main Presentation Application -->
  <div
    v-else
    class="app-container"
    :class="{
      'presentation-active': state.mode === 'presentation',
      'laser-active': state.activeTool === 'laser',
      'drag-over': isDragOver
    }"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- Hidden file input for web fallback -->
    <input
      ref="fileInputRef"
      type="file"
      accept="application/pdf"
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- Laser Pointer & Spotlight Overlay -->
    <PresentationPointer
      :container-width="1920"
      :container-height="1080"
    />

    <!-- Top App Navigation Bar (Visible in Normal Mode) -->
    <header v-if="state.mode !== 'presentation'" class="top-nav">
      <div class="nav-left">
        <div class="brand">
          <div class="brand-logo">
            <AppIcon :size="30" />
          </div>
          <span class="brand-title">{{ getAppDisplayName(appVersion) }}</span>
        </div>

        <div v-if="hasPdfLoaded" class="pdf-info-pill">
          <Presentation :size="14" />
          <span class="file-name" :title="state.currentPdfName">{{ state.currentPdfName }}</span>
          <span class="page-badge">{{ state.currentPage }} / {{ state.numPages }}</span>
        </div>
      </div>

      <div class="nav-right">
        <!-- Open File Button -->
        <button
          class="nav-btn"
          title="Open Local PDF File"
          @click="presentation.openPdfFileDialog"
        >
          <FolderOpen :size="16" />
          <span>Open PDF</span>
        </button>

        <!-- Sample PDF Button -->
        <button
          v-if="!hasPdfLoaded"
          class="nav-btn secondary"
          @click="presentation.loadSamplePdf"
        >
          <Sparkles :size="16" />
          <span>Sample Presentation</span>
        </button>

        <!-- Fit Mode Switcher (When PDF loaded) -->
        <div v-if="hasPdfLoaded" class="fit-controls">
          <button
            class="fit-btn"
            :class="{ active: state.fitMode === 'contain' }"
            title="Fit to Page"
            @click="state.fitMode = 'contain'"
          >
            Fit Page
          </button>
          <button
            class="fit-btn"
            :class="{ active: state.fitMode === 'fit-width' }"
            title="Fit to Width"
            @click="state.fitMode = 'fit-width'"
          >
            Fit Width
          </button>
        </div>

        <!-- Markdown Export Center -->
        <button
          v-if="hasPdfLoaded"
          class="nav-btn"
          title="Markdown Presenter Notes"
          @click="state.showExportModal = true"
        >
          <FileCode :size="16" />
          <span>Presenter Notes</span>
        </button>

        <!-- Enter Presentation Mode Button (F5) -->
        <button
          v-if="hasPdfLoaded"
          class="nav-btn primary-start-btn"
          title="Start Fullscreen Presentation (F5)"
          @click="presentation.togglePresentationMode(true)"
        >
          <Play :size="16" />
          <span>Start Presentation (F5)</span>
        </button>
      </div>
    </header>

    <!-- Main Workspace Content Area -->
    <main class="main-viewport">
      <!-- State 1: PDF Viewer Loaded -->
      <template v-if="hasPdfLoaded">
        <PresentationViewer />
        <PresentationToolbar />
        <SlideDrawer />
        <NotesDrawer />
        <ExportModal />
      </template>

      <!-- State 2: Welcome / Empty State (No PDF loaded) -->
      <div v-else class="welcome-screen">
        <div class="welcome-card">
          <div class="welcome-icon-box">
            <AppIcon :size="88" />
          </div>

          <div class="welcome-version-pill">
            <span>Version {{ formatAppVersion(appVersion) }}</span>
          </div>

          <h2>{{ getAppDisplayName(appVersion) }}</h2>
          <p class="welcome-subtitle">
            A modern, PowerPoint-grade presentation experience with laser pointer, drawing annotations, and 100% offline Markdown notes with LaTeX math rendering.
          </p>

          <div class="welcome-actions">
            <button
              class="hero-btn primary"
              @click="presentation.openPdfFileDialog"
            >
              <FolderOpen :size="18" />
              <span>Open Local PDF File</span>
            </button>

            <button
              class="hero-btn secondary"
              @click="presentation.loadSamplePdf"
            >
              <Sparkles :size="18" />
              <span>Load Sample Presentation</span>
            </button>
          </div>

          <div
            class="dropzone-box"
            @click="fileInputRef?.click()"
          >
            <p>Or drag and drop a PDF file here to open</p>
          </div>

          <!-- Feature Highlights Grid -->
          <div class="feature-grid">
            <div class="feature-item">
              <div class="f-icon red"><Sparkles :size="20" /></div>
              <h4>PPT Laser Pointer</h4>
              <p>Simulates physical presentation remotes with red, green, and blue laser dots plus click pulse effects</p>
            </div>

            <div class="feature-item">
              <div class="f-icon yellow"><ZoomIn :size="20" /></div>
              <h4>Mouse Wheel Vector Zoom</h4>
              <p>Smoothly magnify and pan around the cursor focus with true vector clarity; reset anytime</p>
            </div>

            <div class="feature-item">
              <div class="f-icon blue"><PenTool :size="20" /></div>
              <h4>Drawing & Fast Undo</h4>
              <p>Smooth pen & highlighter annotations with Ctrl+Z undo and Ctrl+R redo shortcuts</p>
            </div>

            <div class="feature-item">
              <div class="f-icon purple"><FileCode :size="20" /></div>
              <h4>Offline Markdown Notes</h4>
              <p>Pure Markdown format with LaTeX math rendering; works 100% offline with zero dependencies</p>
            </div>

            <div class="feature-item">
              <div class="f-icon emerald"><Cpu :size="20" /></div>
              <h4>Native Cross-Platform</h4>
              <p>Built on Rust + Tauri 2.0 for consistent high performance across Windows, macOS, and Linux</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Drag & Drop Overlay Feedback -->
    <div v-if="isDragOver" class="drop-feedback-overlay">
      <div class="drop-feedback-box">
        <ArrowRight :size="48" />
        <h3>Release to load PDF presentation</h3>
      </div>
    </div>
  </div>
</template>

<style>
/* Global resets & typography */
* {
  box-sizing: border-box;
}

body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif;
  background-color: #090d16;
  color: #f8fafc;
}

/* KaTeX custom overrides for clean presentation notes */
.katex-display-wrapper {
  margin: 8px 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
}

.katex {
  font-size: 1.1em;
}

.katex-error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  padding: 2px 4px;
  border-radius: 4px;
}
</style>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #090d16;
  overflow: hidden;
  position: relative;
}

.app-container.presentation-active {
  background-color: #000000;
}

.app-container.laser-active .main-viewport,
.app-container.laser-active .main-viewport * {
  cursor: none !important;
}

/* Top Navigation Bar */
.top-nav {
  height: 52px;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  user-select: none;
  z-index: 700;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-logo {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #f8fafc;
}

.version-badge {
  background: rgba(59, 130, 246, 0.16);
  border: 1px solid rgba(59, 130, 246, 0.35);
  color: #93c5fd;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.pdf-info-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #94a3b8;
}

.file-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e2e8f0;
  font-weight: 500;
}

.page-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.nav-btn.secondary {
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.1);
}
.nav-btn.secondary:hover {
  background: rgba(59, 130, 246, 0.2);
}

.primary-start-btn {
  background: #2563eb;
  border-color: #3b82f6;
  color: white;
  font-weight: 600;
}
.primary-start-btn:hover {
  background: #1d4ed8;
}

.fit-controls {
  display: flex;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 2px;
}

.fit-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.fit-btn.active {
  background: #3b82f6;
  color: white;
}

/* Main Viewport */
.main-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
}

/* Welcome Screen */
.welcome-screen {
  flex: 1;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.welcome-card {
  max-width: 820px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.welcome-icon-box {
  width: 88px;
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  filter: drop-shadow(0 12px 24px rgba(37, 99, 235, 0.35));
}

.welcome-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.welcome-version-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
}

.welcome-card h2 {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 10px 0;
  letter-spacing: -0.5px;
}

.welcome-subtitle {
  font-size: 15px;
  color: #94a3b8;
  max-width: 620px;
  line-height: 1.6;
  margin: 0 0 28px 0;
}

.welcome-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.hero-btn {
  padding: 12px 22px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.hero-btn.primary {
  background: #2563eb;
  color: white;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
}
.hero-btn.primary:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.hero-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.hero-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.dropzone-box {
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 14px 28px;
  cursor: pointer;
  margin-bottom: 36px;
  color: #64748b;
  font-size: 13px;
  transition: all 0.2s ease;
}
.dropzone-box:hover {
  border-color: #3b82f6;
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.05);
}

/* Feature Grid */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  width: 100%;
}

.feature-item {
  background: #131b2e;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 18px;
  text-align: left;
}

.f-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.f-icon.red { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.f-icon.yellow { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.f-icon.blue { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.f-icon.purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
.f-icon.emerald { background: rgba(16, 185, 129, 0.15); color: #34d399; }

.feature-item h4 {
  margin: 0 0 6px 0;
  font-size: 14px;
  color: #f1f5f9;
  font-weight: 600;
}

.feature-item p {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

/* Drop Feedback */
.drop-feedback-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(12px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drop-feedback-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #60a5fa;
  border: 3px dashed #3b82f6;
  border-radius: 20px;
  padding: 40px 60px;
}

.drop-feedback-box h3 {
  margin: 0;
  font-size: 20px;
  color: #ffffff;
}
</style>
