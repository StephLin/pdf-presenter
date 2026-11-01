<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePresentation } from '../composables/usePresentation';
import { renderLatexAndMarkdown } from '../utils/markdown';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Code,
  Eye,
  Columns,
  Sparkles,
  Maximize2,
  Minimize2,
  PanelRight,
  AppWindow,
  ExternalLink,
  Pin,
  PinOff,
  Move,
} from 'lucide-vue-next';

const presentation = usePresentation();
const { state, currentPageAnnotations } = presentation;

const viewMode = ref<'split' | 'edit' | 'preview'>('split');
const isMaximized = ref(false);
const isPinned = ref(false);
const windowPos = ref<{ x: number; y: number } | null>(null);
const notesWindowRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);

const isPopup = computed(() => state.notesWindowMode === 'popup');

const noteText = computed({
  get: () => currentPageAnnotations.value?.presenterNotes || '',
  set: (val: string) => presentation.updatePresenterNotes(val),
});

function insertSnippet(snippet: string) {
  noteText.value = (noteText.value ? noteText.value + '\n' : '') + snippet;
}

const latexSnippets = [
  { label: 'Inline Math', code: '$f(x) = ax^2 + bx + c$' },
  { label: 'Block Math', code: '$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$' },
  { label: 'Fraction', code: '$\\frac{a}{b}$' },
  { label: 'Sum', code: '$\\sum_{i=1}^{n} x_i$' },
  { label: 'Integral', code: '$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$' },
  { label: 'Matrix', code: '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$' },
  { label: 'Greek Letters', code: '$\\alpha, \\beta, \\gamma, \\theta, \\lambda, \\sigma$' },
];

let dragStart = { mouseX: 0, mouseY: 0, posX: 0, posY: 0 };

function startDrag(e: MouseEvent) {
  if (!isPopup.value || isMaximized.value) return;
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  // Don't drag if clicking buttons, inputs, textarea, or chips
  if (target.closest('button') || target.closest('input') || target.closest('textarea')) {
    return;
  }

  const el = notesWindowRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  dragStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    posX: rect.left,
    posY: rect.top,
  };
  isDragging.value = true;

  function onMouseMove(ev: MouseEvent) {
    const dx = ev.clientX - dragStart.mouseX;
    const dy = ev.clientY - dragStart.mouseY;
    const newX = Math.max(10, Math.min(window.innerWidth - 120, dragStart.posX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStart.posY + dy));
    windowPos.value = { x: newX, y: newY };
  }

  function onMouseUp() {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function toggleMaximize() {
  isMaximized.value = !isMaximized.value;
}

function switchMode(mode: 'popup' | 'drawer') {
  state.notesWindowMode = mode;
  if (mode === 'drawer') {
    isMaximized.value = false;
  }
}

const popupStyle = computed(() => {
  if (!isPopup.value) return {};
  if (isMaximized.value) {
    return {
      top: '3vh',
      left: '3vw',
      width: '94vw',
      height: '94vh',
      transform: 'none',
    };
  }
  if (windowPos.value) {
    return {
      top: `${windowPos.value.y}px`,
      left: `${windowPos.value.x}px`,
      transform: 'none',
      width: '760px',
      height: '560px',
      maxWidth: '94vw',
      maxHeight: '88vh',
    };
  }
  return {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '760px',
    height: '560px',
    maxWidth: '94vw',
    maxHeight: '88vh',
  };
});

async function openInSeparateWindow() {
  await presentation.openNotesPopoutWindow();
}

onMounted(() => {
  presentation.initExternalNotesSync();
});
</script>

<template>
  <div
    v-if="state.showNotesDrawer"
    class="notes-wrapper"
    :class="{
      'is-popup-mode': isPopup,
      'is-drawer-mode': !isPopup,
      'is-pinned': isPinned,
      'is-maximized': isMaximized
    }"
  >
    <!-- Modal Backdrop for Popup Mode (hidden when pinned so background is clickable) -->
    <div
      v-if="isPopup && !isPinned"
      class="notes-backdrop"
      @click="state.showNotesDrawer = false"
    />

    <!-- Notes Window / Drawer Box -->
    <div
      ref="notesWindowRef"
      class="notes-box"
      :class="{
        'is-popup': isPopup,
        'is-drawer': !isPopup,
        'is-dragging': isDragging
      }"
      :style="popupStyle"
    >
      <!-- Header / Titlebar -->
      <div
        class="notes-header"
        :class="{ 'draggable-header': isPopup && !isMaximized }"
        @mousedown="startDrag"
      >
        <div class="header-left">
          <Move v-if="isPopup && !isMaximized" :size="15" class="drag-icon" title="Drag to reposition window" />
          <span class="badge-title">Markdown</span>
          <h4>Presenter Notes & Script (Slide {{ state.currentPage }} / {{ state.numPages }})</h4>
        </div>

        <div class="header-actions">
          <!-- Slide Switcher in drawer -->
          <div class="page-switcher">
            <button
              class="nav-mini-btn"
              :disabled="state.currentPage <= 1"
              title="Previous slide notes (Left)"
              @click.stop="presentation.prevPage"
            >
              <ChevronLeft :size="15" />
            </button>
            <span class="page-count">{{ state.currentPage }} / {{ state.numPages }}</span>
            <button
              class="nav-mini-btn"
              :disabled="state.currentPage >= state.numPages"
              title="Next slide notes (Right)"
              @click.stop="presentation.nextPage"
            >
              <ChevronRight :size="15" />
            </button>
          </div>

          <!-- View mode toggles -->
          <div class="view-toggles">
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'edit' }"
              title="Edit only"
              @click.stop="viewMode = 'edit'"
            >
              <Code :size="14" />
            </button>
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'split' }"
              title="Split view"
              @click.stop="viewMode = 'split'"
            >
              <Columns :size="14" />
            </button>
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'preview' }"
              title="Preview only"
              @click.stop="viewMode = 'preview'"
            >
              <Eye :size="14" />
            </button>
          </div>

          <!-- Window Display Mode Switcher (Popup ⇋ Drawer) -->
          <button
            v-if="isPopup"
            class="icon-action-btn"
            title="Switch to side drawer mode"
            @click.stop="switchMode('drawer')"
          >
            <PanelRight :size="15" />
          </button>
          <button
            v-else
            class="icon-action-btn"
            title="Switch to pop-up window mode"
            @click.stop="switchMode('popup')"
          >
            <AppWindow :size="15" />
          </button>

          <!-- Pin Floating Toggle (Only in popup mode) -->
          <button
            v-if="isPopup"
            class="icon-action-btn"
            :class="{ active: isPinned }"
            :title="isPinned ? 'Unpin window (click backdrop to close)' : 'Pin window (keep visible during presentation)'"
            @click.stop="isPinned = !isPinned"
          >
            <PinOff v-if="isPinned" :size="15" />
            <Pin v-else :size="15" />
          </button>

          <!-- Pop out to External OS Window -->
          <button
            class="icon-action-btn"
            title="Open in separate window (recommended for dual displays)"
            @click.stop="openInSeparateWindow"
          >
            <ExternalLink :size="15" />
          </button>

          <!-- Maximize / Restore Toggle (Only in popup mode) -->
          <button
            v-if="isPopup"
            class="icon-action-btn"
            :title="isMaximized ? 'Restore window size' : 'Maximize window'"
            @click.stop="toggleMaximize"
          >
            <Minimize2 v-if="isMaximized" :size="15" />
            <Maximize2 v-else :size="15" />
          </button>

          <!-- Open Export Modal -->
          <button
            class="export-shortcut-btn"
            title="Export Markdown notes document"
            @click.stop="state.showExportModal = true"
          >
            <Download :size="13" />
            <span>Export</span>
          </button>

          <!-- Close Drawer / Window -->
          <button
            class="close-btn"
            title="Close notes (N / Esc)"
            @click.stop="state.showNotesDrawer = false"
          >
            <X :size="18" />
          </button>
        </div>
      </div>

      <!-- Quick Formula Insert Toolbar -->
      <div v-if="viewMode !== 'preview'" class="formula-shortcuts-bar">
        <span class="formula-label">
          <Sparkles :size="13" /> Math Snippets:
        </span>
        <div class="shortcuts-list">
          <button
            v-for="item in latexSnippets"
            :key="item.label"
            class="snippet-chip"
            @click="insertSnippet(item.code)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <!-- Body Content -->
      <div
        class="notes-content"
        :class="`layout-${viewMode}`"
      >
        <!-- Edit Area -->
        <div
          v-if="viewMode === 'edit' || viewMode === 'split'"
          class="pane edit-pane"
        >
          <div class="pane-title">LaTeX / Markdown Editor</div>
          <textarea
            v-model="noteText"
            class="latex-textarea"
            placeholder="Enter presentation notes or derivation formulas for this slide...
For example:
# Key Derivation
Maxwell's Equations:
$$\nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t}$$
- Remind audience to observe symmetry and wave equation derivation.
- Fully offline instant formula rendering."
            @keydown.stop
          />
        </div>

        <!-- Preview Area (Offline KaTeX rendering) -->
        <div
          v-if="viewMode === 'preview' || viewMode === 'split'"
          class="pane preview-pane"
        >
          <div class="pane-title">Live Markdown Preview (Offline)</div>
          <div
            v-if="noteText.trim()"
            class="rendered-output markdown-body"
            v-html="renderLatexAndMarkdown(noteText)"
          />
          <div v-else class="empty-hint">
            <p>No notes for this slide yet. Enter text or formulas in the left pane.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notes-wrapper {
  position: fixed;
  inset: 0;
  z-index: 790;
  pointer-events: none;
}

.notes-wrapper.is-drawer-mode {
  inset: auto 0 0 auto;
}

.notes-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  pointer-events: auto;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Notes Window / Box */
.notes-box {
  pointer-events: auto;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.notes-box.is-popup {
  position: fixed;
  animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: translate(-50%, -46%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.notes-box.is-drawer {
  position: fixed;
  bottom: 0;
  right: 0;
  width: 580px;
  max-width: 90vw;
  height: 65vh;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
  animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #1e293b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.notes-header.draggable-header {
  cursor: grab;
}
.notes-header.draggable-header:active {
  cursor: grabbing;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drag-icon {
  color: #64748b;
}

.badge-title {
  background: #2563eb;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.header-left h4 {
  margin: 0;
  font-size: 13px;
  color: #f1f5f9;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.page-count {
  font-size: 12px;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
  padding: 0 4px;
}

.nav-mini-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
}
.nav-mini-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}
.nav-mini-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.view-toggles {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  padding: 2px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.mode-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.mode-btn:hover {
  color: #ffffff;
}
.mode-btn.active {
  background: #3b82f6;
  color: #ffffff;
}

.icon-action-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.icon-action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}
.icon-action-btn.active {
  background: rgba(59, 130, 246, 0.25);
  border-color: #3b82f6;
  color: #60a5fa;
}

.export-shortcut-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.export-shortcut-btn:hover {
  background: #10b981;
  color: #ffffff;
}

.close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Formula Shortcut Bar */
.formula-shortcuts-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #162032;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  overflow-x: auto;
}

.formula-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #93c5fd;
  white-space: nowrap;
}

.shortcuts-list {
  display: flex;
  align-items: center;
  gap: 5px;
}

.snippet-chip {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.snippet-chip:hover {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

/* Content Area */
.notes-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  user-select: text;
}

.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pane-title {
  padding: 6px 14px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.edit-pane {
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.latex-textarea {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  background: #0f172a;
  color: #f1f5f9;
  border: none;
  padding: 12px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.preview-pane {
  background: #0b1120;
  overflow-y: auto;
}

.rendered-output {
  padding: 14px 18px;
  color: #e2e8f0;
  font-size: 13.5px;
  line-height: 1.65;
}

.rendered-output :deep(h1) {
  font-size: 18px;
  color: #60a5fa;
  margin-top: 0;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 4px;
}
.rendered-output :deep(h2) {
  font-size: 15px;
  color: #93c5fd;
  margin-top: 12px;
  margin-bottom: 6px;
}
.rendered-output :deep(h3) {
  font-size: 13.5px;
  color: #bfdbfe;
  margin-top: 10px;
  margin-bottom: 4px;
}
.rendered-output :deep(p) {
  margin-top: 0;
  margin-bottom: 8px;
}
.rendered-output :deep(.note-list) {
  padding-left: 20px;
  margin-top: 0;
  margin-bottom: 8px;
}
.rendered-output :deep(.inline-code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
.rendered-output :deep(.code-block) {
  background: #1e293b;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: monospace;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.rendered-output :deep(.katex-display-wrapper) {
  margin: 10px 0;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  overflow-x: auto;
}

.empty-hint {
  padding: 30px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}
</style>
