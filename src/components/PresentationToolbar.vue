<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePresentation } from '../composables/usePresentation';
import type { PointerTool, LaserColor } from '../types/presentation';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MousePointer,
  Sparkles,
  PenTool,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  FileText,
  LayoutGrid,
  Moon,
  Sun,
  Download,
  Check,
  ZoomOut,
  Maximize,
  ArrowLeftRight,
} from 'lucide-vue-next';

const presentation = usePresentation();
const { state, canUndo, canRedo } = presentation;

const isVisible = ref(true);
let hideTimer: any = null;
const isColorMenuOpen = ref(false);
const isPenMenuOpen = ref(false);
const isJumpInputOpen = ref(false);
const jumpPageInput = ref(state.currentPage);

const isPresentation = computed(() => state.mode === 'presentation');
const isZoomed = computed(() => state.zoomScale > 1.02);

const penColors = [
  '#ef4444', // Red
  '#f59e0b', // Amber/Yellow
  '#10b981', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#ffffff', // White
  '#0f172a', // Dark
];

const highlighterColors = [
  '#fef08a', // Neon Yellow
  '#86efac', // Neon Green
  '#fbcfe8', // Pink
  '#a5f3fc', // Cyan
];

const penWidthPresets = [2, 4, 8, 14];
const highlighterWidthPresets = [12, 24, 36, 48];

function resetHideTimer() {
  isVisible.value = true;
  clearTimeout(hideTimer);
  if (isPresentation.value) {
    hideTimer = setTimeout(() => {
      if (!isColorMenuOpen.value && !isPenMenuOpen.value && !isJumpInputOpen.value) {
        isVisible.value = false;
      }
    }, 2800);
  }
}

function handleMouseMove() {
  resetHideTimer();
}

function selectTool(tool: PointerTool) {
  presentation.setTool(tool);
  if (tool !== 'laser') isColorMenuOpen.value = false;
  if (tool !== 'pen' && tool !== 'highlighter') isPenMenuOpen.value = false;
}

function handlePenClick() {
  if (state.activeTool === 'pen') {
    isPenMenuOpen.value = !isPenMenuOpen.value;
  } else {
    presentation.setTool('pen');
    isPenMenuOpen.value = false;
  }
}

function handleHighlighterClick() {
  if (state.activeTool === 'highlighter') {
    isPenMenuOpen.value = !isPenMenuOpen.value;
  } else {
    presentation.setTool('highlighter');
    isPenMenuOpen.value = false;
  }
}

function openPenMenu(tool: 'pen' | 'highlighter') {
  presentation.setTool(tool);
  isPenMenuOpen.value = true;
}

function selectLaserColor(color: LaserColor) {
  state.laserColor = color;
  isColorMenuOpen.value = false;
}

function selectPenColor(c: string) {
  if (state.activeTool === 'highlighter') {
    state.highlighterColor = c;
  } else {
    state.penColor = c;
  }
  isPenMenuOpen.value = false;
}

function submitJumpPage() {
  const p = Number(jumpPageInput.value);
  if (p >= 1 && p <= state.numPages) {
    presentation.goToPage(p);
  }
  isJumpInputOpen.value = false;
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  resetHideTimer();
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  clearTimeout(hideTimer);
});
</script>

<template>
  <div
    class="toolbar-wrapper"
    :class="{
      'toolbar-hidden': !isVisible && isPresentation,
      'is-presentation': isPresentation
    }"
    @mouseenter="isVisible = true"
  >
    <div class="presenter-toolbar">
      <!-- 1. Slide Navigation Group -->
      <div class="tool-group nav-group">
        <button
          class="tool-btn"
          title="Previous Slide (Left Arrow / PageUp)"
          :disabled="state.currentPage <= 1"
          @click="presentation.prevPage"
        >
          <ChevronLeft :size="18" />
        </button>

        <div class="page-indicator" @click="isJumpInputOpen = !isJumpInputOpen">
          <template v-if="!isJumpInputOpen">
            <span class="curr-page">{{ state.currentPage }}</span>
            <span class="sep">/</span>
            <span class="total-page">{{ state.numPages }}</span>
          </template>
          <template v-else>
            <input
              v-model.number="jumpPageInput"
              type="number"
              class="jump-input"
              :min="1"
              :max="state.numPages"
              @blur="submitJumpPage"
              @keydown.enter="submitJumpPage"
              @keydown.esc="isJumpInputOpen = false"
              autoFocus
            />
          </template>
        </div>

        <button
          class="tool-btn"
          title="Next Slide (Right Arrow / Space / PageDown)"
          :disabled="state.currentPage >= state.numPages"
          @click="presentation.nextPage"
        >
          <ChevronRight :size="18" />
        </button>
      </div>

      <div class="divider" />

      <!-- 2. PowerPoint Pointer Tools Group (Spotlight removed, Laser Pointer preserved) -->
      <div class="tool-group pointer-group">
        <!-- Normal Cursor -->
        <button
          class="tool-btn"
          :class="{ active: state.activeTool === 'cursor' }"
          title="Normal Cursor"
          @click="selectTool('cursor')"
        >
          <MousePointer :size="17" />
        </button>

        <!-- Laser Pointer -->
        <div class="btn-with-dropdown">
          <button
            class="tool-btn laser-btn"
            :class="{ active: state.activeTool === 'laser' }"
            title="PPT Laser Pointer (Toggle L, Right click for color)"
            @click="selectTool('laser')"
            @contextmenu.prevent="isColorMenuOpen = !isColorMenuOpen"
          >
            <Sparkles :size="17" />
            <span
              class="laser-color-pip"
              :class="`pip-${state.laserColor}`"
            />
          </button>

          <!-- Laser Color Palette Dropdown -->
          <div v-if="isColorMenuOpen" class="color-dropdown-menu">
            <button
              class="color-chip pip-red"
              title="Red Laser"
              @click="selectLaserColor('red')"
            >
              <Check v-if="state.laserColor === 'red'" :size="12" />
            </button>
            <button
              class="color-chip pip-green"
              title="Green Laser"
              @click="selectLaserColor('green')"
            >
              <Check v-if="state.laserColor === 'green'" :size="12" />
            </button>
            <button
              class="color-chip pip-blue"
              title="Blue Laser"
              @click="selectLaserColor('blue')"
            >
              <Check v-if="state.laserColor === 'blue'" :size="12" />
            </button>
          </div>
        </div>
      </div>

      <div class="divider" />

      <!-- 3. Annotation Drawing Group (With Ctrl+Z Undo & Ctrl+R Redo) -->
      <div class="tool-group drawing-group">
        <!-- Pen -->
        <div class="btn-with-dropdown">
          <button
            class="tool-btn"
            :class="{ active: state.activeTool === 'pen' }"
            title="Pen Annotation (Toggle D, Click or Right click to adjust size and color)"
            @click="handlePenClick"
            @contextmenu.prevent="openPenMenu('pen')"
          >
            <PenTool :size="17" />
            <span
              class="pen-color-pip"
              :style="{ backgroundColor: state.penColor }"
            />
          </button>
        </div>

        <!-- Highlighter -->
        <div class="btn-with-dropdown">
          <button
            class="tool-btn"
            :class="{ active: state.activeTool === 'highlighter' }"
            title="Highlighter (Toggle H, Click or Right click to adjust size and color)"
            @click="handleHighlighterClick"
            @contextmenu.prevent="openPenMenu('highlighter')"
          >
            <Highlighter :size="17" />
            <span
              class="pen-color-pip highlighter-pip"
              :style="{ backgroundColor: state.highlighterColor }"
            />
          </button>
        </div>

        <!-- Eraser -->
        <button
          class="tool-btn"
          :class="{ active: state.activeTool === 'eraser' }"
          title="Eraser (Toggle E)"
          @click="selectTool('eraser')"
        >
          <Eraser :size="17" />
        </button>

        <!-- Undo Stroke (Ctrl+Z) -->
        <button
          class="tool-btn"
          :disabled="!canUndo"
          title="Undo Stroke (Ctrl+Z)"
          @click="presentation.undoStroke"
        >
          <Undo2 :size="16" />
        </button>

        <!-- Redo Stroke (Ctrl+R / Ctrl+Y) -->
        <button
          class="tool-btn"
          :disabled="!canRedo"
          title="Redo Stroke (Ctrl+R)"
          @click="presentation.redoStroke"
        >
          <Redo2 :size="16" />
        </button>

        <!-- Clear Page Drawing -->
        <button
          class="tool-btn"
          title="Clear all drawings on this slide"
          @click="presentation.clearCurrentPageStrokes"
        >
          <Trash2 :size="16" />
        </button>

        <!-- Pen / Highlighter Thickness & Color Settings Popover -->
        <div v-if="isPenMenuOpen" class="color-dropdown-menu pen-settings-popup" @click.stop>
          <div class="popup-title">
            <span>{{ state.activeTool === 'highlighter' ? 'Highlighter Settings' : 'Pen Settings' }}</span>
            <span class="value-badge">
              {{ state.activeTool === 'highlighter' ? state.highlighterWidth : state.penWidth }} px
            </span>
          </div>

          <!-- 1. Thickness Presets & Slider -->
          <div class="settings-section">
            <div class="section-label">Stroke Width (or press [ and ])</div>
            <div class="width-presets">
              <template v-if="state.activeTool === 'highlighter'">
                <button
                  v-for="w in highlighterWidthPresets"
                  :key="w"
                  class="preset-chip"
                  :class="{ active: state.highlighterWidth === w }"
                  :title="`Width ${w}px`"
                  @click="presentation.setHighlighterWidth(w)"
                >
                  <span
                    class="preset-preview-line"
                    :style="{
                      height: `${Math.round(w / 4)}px`,
                      backgroundColor: state.highlighterColor
                    }"
                  />
                </button>
              </template>
              <template v-else>
                <button
                  v-for="w in penWidthPresets"
                  :key="w"
                  class="preset-chip"
                  :class="{ active: state.penWidth === w }"
                  :title="`Width ${w}px`"
                  @click="presentation.setPenWidth(w)"
                >
                  <span
                    class="preset-preview-dot"
                    :style="{
                      width: `${Math.max(3, Math.min(16, w))}px`,
                      height: `${Math.max(3, Math.min(16, w))}px`,
                      backgroundColor: state.penColor
                    }"
                  />
                </button>
              </template>
            </div>

            <!-- Continuous slider -->
            <div class="slider-row">
              <input
                v-if="state.activeTool === 'highlighter'"
                v-model.number="state.highlighterWidth"
                type="range"
                min="8"
                max="60"
                step="2"
                class="width-slider"
              />
              <input
                v-else
                v-model.number="state.penWidth"
                type="range"
                min="1"
                max="24"
                step="1"
                class="width-slider"
              />
            </div>
          </div>

          <div class="settings-divider" />

          <!-- 2. Colors -->
          <div class="settings-section">
            <div class="section-label">Color Selection</div>
            <div class="palette-colors">
              <template v-if="state.activeTool === 'highlighter'">
                <button
                  v-for="c in highlighterColors"
                  :key="c"
                  class="palette-chip"
                  :style="{ backgroundColor: c }"
                  @click="selectPenColor(c)"
                >
                  <Check v-if="state.highlighterColor === c" :size="12" />
                </button>
              </template>
              <template v-else>
                <button
                  v-for="c in penColors"
                  :key="c"
                  class="palette-chip"
                  :style="{ backgroundColor: c }"
                  @click="selectPenColor(c)"
                >
                  <Check v-if="state.penColor === c" :size="12" />
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="divider" />

      <!-- 4. Zoom & Page Fit Controls (Mouse wheel zoom & Fit Page / Fit Width toggle) -->
      <div class="tool-group zoom-group">
        <!-- Reset Zoom (if zoomed) -->
        <button
          v-if="isZoomed"
          class="tool-btn zoom-active-btn"
          title="Reset zoom to default (Esc / Ctrl+0)"
          @click="presentation.resetZoom"
        >
          <ZoomOut :size="16" />
        </button>

        <!-- Fit Page -->
        <button
          class="tool-btn"
          :class="{ active: state.fitMode === 'contain' && !isZoomed }"
          title="Fit to Page"
          @click="presentation.setFitMode('contain')"
        >
          <Maximize :size="16" />
        </button>

        <!-- Fit Width -->
        <button
          class="tool-btn"
          :class="{ active: state.fitMode === 'fit-width' && !isZoomed }"
          title="Fit to Width"
          @click="presentation.setFitMode('fit-width')"
        >
          <ArrowLeftRight :size="16" />
        </button>
      </div>

      <div class="divider" />

      <!-- 5. Markdown Presenter Notes & Handout Center -->
      <div class="tool-group xelatex-group">
        <!-- Presenter Notes (Pop-up Window / Drawer) -->
        <button
          class="tool-btn"
          :class="{ active: state.showNotesDrawer }"
          :title="state.notesWindowMode === 'popup' ? 'Presenter Notes Pop-up Window (N)' : 'Presenter Notes Drawer (N)'"
          @click="presentation.toggleNotesDrawer"
        >
          <FileText :size="17" />
        </button>

        <!-- Markdown Export Modal -->
        <button
          class="tool-btn"
          title="Export Markdown Notes & Script"
          @click="state.showExportModal = true"
        >
          <Download :size="17" />
        </button>
      </div>

      <div class="divider" />

      <!-- 6. Slide View & Screen Blanking -->
      <div class="tool-group screen-group">
        <!-- Slide Grid Overview -->
        <button
          class="tool-btn"
          :class="{ active: state.showThumbnails }"
          title="Slide Sorter Overview (G)"
          @click="presentation.toggleThumbnails"
        >
          <LayoutGrid :size="17" />
        </button>

        <!-- Black Screen Toggle -->
        <button
          class="tool-btn"
          :class="{ active: state.blackScreen }"
          title="Toggle Black Screen (B)"
          @click="presentation.toggleBlackScreen"
        >
          <Moon :size="17" />
        </button>

        <!-- White Screen Toggle -->
        <button
          class="tool-btn"
          :class="{ active: state.whiteScreen }"
          title="Toggle White Screen (W)"
          @click="presentation.toggleWhiteScreen"
        >
          <Sun :size="17" />
        </button>

        <!-- Fullscreen Presentation Toggle -->
        <button
          class="tool-btn primary-btn"
          :title="isPresentation ? 'Exit Fullscreen Presentation (Esc)' : 'Enter Fullscreen Presentation (F5)'"
          @click="() => presentation.togglePresentationMode()"
        >
          <Minimize2 v-if="isPresentation" :size="17" />
          <Maximize2 v-else :size="17" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar-wrapper {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 800;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
  user-select: none;
}

.toolbar-wrapper.toolbar-hidden {
  transform: translateX(-50%) translateY(140%);
  opacity: 0;
  pointer-events: none;
}

.presenter-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 6px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
  color: #f8fafc;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

.tool-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.tool-btn.active {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
}

.tool-btn.zoom-active-btn {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid #f59e0b;
}

.tool-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.primary-btn {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.primary-btn:hover {
  background: #2563eb;
}

/* Page Indicator */
.page-indicator {
  padding: 0 8px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  border-radius: 6px;
  height: 28px;
  color: #e2e8f0;
}
.page-indicator:hover {
  background: rgba(255, 255, 255, 0.1);
}
.page-indicator .sep {
  opacity: 0.5;
}
.jump-input {
  width: 44px;
  background: #1e293b;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  color: #ffffff;
  font-size: 13px;
  text-align: center;
  padding: 2px;
  outline: none;
}

/* Laser Dropdown */
.btn-with-dropdown {
  position: relative;
}

.laser-color-pip {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.pip-red { background-color: #ef4444; }
.pip-green { background-color: #10b981; }
.pip-blue { background-color: #06b6d4; }

.pen-color-pip {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.5);
  box-shadow: 0 0 2px rgba(255, 255, 255, 0.4);
}

.pen-color-pip.highlighter-pip {
  border-radius: 2px;
}

.pen-settings-popup {
  flex-direction: column;
  width: 220px;
  padding: 12px 14px;
  border-radius: 14px;
  gap: 10px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7);
}

.popup-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
}

.value-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 11px;
  color: #94a3b8;
}

.width-presets {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  background: rgba(0, 0, 0, 0.35);
  padding: 4px 6px;
  border-radius: 8px;
}

.preset-chip {
  flex: 1;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-chip:hover {
  background: rgba(255, 255, 255, 0.1);
}

.preset-chip.active {
  background: rgba(59, 130, 246, 0.3);
  border-color: #3b82f6;
}

.preset-preview-dot {
  border-radius: 50%;
}

.preset-preview-line {
  width: 18px;
  border-radius: 2px;
}

.slider-row {
  display: flex;
  align-items: center;
  padding-top: 2px;
}

.width-slider {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  accent-color: #3b82f6;
  cursor: pointer;
}

.settings-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 1px 0;
}

.color-dropdown-menu {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 6px;
  display: flex;
  gap: 6px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}

.color-chip, .palette-chip {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  transition: transform 0.1s ease;
}
.color-chip:hover, .palette-chip:hover {
  transform: scale(1.15);
}

.pen-palette {
  border-radius: 12px;
  padding: 6px 8px;
}
.palette-colors {
  display: flex;
  gap: 6px;
}
</style>
