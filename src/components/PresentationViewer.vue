<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import { usePresentation } from '../composables/usePresentation';
import { pdfService } from '../services/pdfService';
import DrawingCanvas from './DrawingCanvas.vue';
import { ZoomOut, Maximize, ArrowLeftRight } from 'lucide-vue-next';

const presentation = usePresentation();
const { state } = presentation;

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const slideWidth = ref(800);
const slideHeight = ref(450);
const isRendering = ref(false);

// Drag panning state when zoomed in
const isPanning = ref(false);
const panStart = ref({ mouseX: 0, mouseY: 0, initialPanX: 0, initialPanY: 0 });

const isZoomed = computed(() => state.zoomScale > 1.02);

let zoomDebounceTimer: any = null;

async function renderCurrentSlide() {
  if (!containerRef.value || !canvasRef.value || state.numPages <= 0) return;

  const containerW = containerRef.value.clientWidth;
  const containerH = containerRef.value.clientHeight;

  if (containerW <= 0 || containerH <= 0) return;

  isRendering.value = true;
  try {
    const result = await pdfService.renderPage(
      state.currentPage,
      canvasRef.value,
      containerW,
      containerH,
      state.fitMode,
      state.zoomScale // Pass zoomScale so PDF.js renders at true vector resolution!
    );

    if (result) {
      slideWidth.value = result.renderedWidth;
      slideHeight.value = result.renderedHeight;
    }
  } catch (err) {
    console.error('Failed to render current slide:', err);
  } finally {
    isRendering.value = false;
  }
}

// Re-render when page, fitMode, or mode changes
watch(
  [() => state.currentPage, () => state.fitMode, () => state.mode, () => state.numPages],
  () => {
    nextTick(() => {
      renderCurrentSlide();
    });
  }
);

// High-resolution vector refresh when zooming:
// Instantly provides 60/120fps smooth CSS scaling during wheel scrolling,
// then debounces 120ms to re-render crisp vector lines and glyphs with PDF.js!
watch(
  () => state.zoomScale,
  () => {
    clearTimeout(zoomDebounceTimer);
    zoomDebounceTimer = setTimeout(() => {
      renderCurrentSlide();
    }, 120);
  }
);

let resizeObserver: ResizeObserver | null = null;
let resizeTimeout: any = null;

function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    renderCurrentSlide();
  }, 100);
}

// Mouse Wheel Zoom functionality: Local magnification at cursor position
function handleWheel(e: WheelEvent) {
  // If notes drawer or thumbnails are open, let them scroll naturally
  if (state.showNotesDrawer || state.showThumbnails || state.showExportModal) {
    return;
  }

  e.preventDefault();
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;

  // Zoom sensitivity: positive deltaY means scroll down (zoom out), negative means scroll up (zoom in)
  const factor = e.deltaY < 0 ? 1.15 : 0.87;
  presentation.zoomAt(factor, e.clientX, e.clientY, rect);
}

// Mouse Drag Pan handling when zoomed in
function handleMouseDown(e: MouseEvent) {
  // Allow panning when zoomed in and using cursor / middle click / space+drag
  if (!isZoomed.value) return;

  // Middle mouse click or Right click or Left click with cursor tool
  const canPan = e.button === 1 || e.button === 2 || (e.button === 0 && state.activeTool === 'cursor');
  if (canPan) {
    isPanning.value = true;
    panStart.value = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialPanX: state.panX,
      initialPanY: state.panY,
    };
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!isPanning.value) return;
  const dx = e.clientX - panStart.value.mouseX;
  const dy = e.clientY - panStart.value.mouseY;
  state.panX = panStart.value.initialPanX + dx;
  state.panY = panStart.value.initialPanY + dy;
}

function handleMouseUp() {
  isPanning.value = false;
}

function handleSlideClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest('button') || target.closest('input')) {
    return;
  }

  // If zoomed in, don't trigger click navigation so user can examine details
  if (isZoomed.value) return;

  // In presentation mode, clicking left/right navigates slides
  if (state.mode === 'presentation' && (state.activeTool === 'cursor' || state.activeTool === 'laser')) {
    const rect = containerRef.value?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width;
    if (relX > 0.65) {
      presentation.nextPage();
    } else if (relX < 0.35) {
      presentation.prevPage();
    }
  }
}

function handleDoubleClick() {
  if (isZoomed.value) {
    presentation.resetZoom();
  }
}

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.value);
    containerRef.value.addEventListener('wheel', handleWheel, { passive: false });
  }
  window.addEventListener('mouseup', handleMouseUp);
  nextTick(() => {
    renderCurrentSlide();
  });
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (containerRef.value) {
    containerRef.value.removeEventListener('wheel', handleWheel);
  }
  window.removeEventListener('mouseup', handleMouseUp);
  clearTimeout(resizeTimeout);
  clearTimeout(zoomDebounceTimer);
});
</script>

<template>
  <div
    ref="containerRef"
    class="viewer-container"
    :class="{
      'presentation-mode': state.mode === 'presentation',
      'tool-laser': state.activeTool === 'laser',
      'tool-drawing': state.activeTool === 'pen' || state.activeTool === 'highlighter' || state.activeTool === 'eraser',
      'tool-cursor': state.activeTool === 'cursor',
      'is-zoomed': isZoomed,
      'is-panning': isPanning && state.activeTool === 'cursor'
    }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @click="handleSlideClick"
    @dblclick="handleDoubleClick"
  >
    <!-- Black Screen / White Screen Blanking Overlays -->
    <div v-if="state.blackScreen" class="blank-screen black-screen" />
    <div v-if="state.whiteScreen" class="blank-screen white-screen" />

    <!-- Zoom & Fit Quick Reset Pill (Shows when magnified) -->
    <div v-if="isZoomed" class="zoom-indicator-pill">
      <span class="zoom-text">Zoom {{ Math.round(state.zoomScale * 100) }}%</span>
      <div class="zoom-actions">
        <button
          class="zoom-reset-btn"
          title="Reset zoom to default (Esc / Ctrl+0)"
          @click.stop="presentation.resetZoom"
        >
          <ZoomOut :size="14" />
          <span>Reset</span>
        </button>
        <button
          class="zoom-fit-btn"
          :class="{ active: state.fitMode === 'contain' }"
          title="Fit to Page"
          @click.stop="presentation.setFitMode('contain')"
        >
          <Maximize :size="14" />
          <span>Fit Page</span>
        </button>
        <button
          class="zoom-fit-btn"
          :class="{ active: state.fitMode === 'fit-width' }"
          title="Fit to Width"
          @click.stop="presentation.setFitMode('fit-width')"
        >
          <ArrowLeftRight :size="14" />
          <span>Fit Width</span>
        </button>
      </div>
    </div>

    <!-- Slide Stage: Centers and scales with local zoom & pan -->
    <div
      class="slide-stage"
      :style="{
        width: `${slideWidth}px`,
        height: `${slideHeight}px`,
        transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.zoomScale})`,
        transformOrigin: 'center center',
      }"
    >
      <!-- Base PDF Canvas Layer -->
      <canvas ref="canvasRef" class="pdf-canvas" />

      <!-- Freehand Ink Drawing & Highlighter Layer -->
      <DrawingCanvas
        :width="slideWidth"
        :height="slideHeight"
      />
    </div>
  </div>
</template>

<style scoped>
.viewer-container {
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #090d16;
  position: relative;
  overflow: hidden;
  user-select: none;
}

.viewer-container.presentation-mode {
  background: #000000;
}

/* Laser tool: STRICTLY hide the system cursor so laser pointer is never obscured */
.viewer-container.tool-laser,
.viewer-container.tool-laser * {
  cursor: none !important;
}

/* Drawing tools keep crosshair cursor */
.viewer-container.tool-drawing,
.viewer-container.tool-drawing * {
  cursor: crosshair;
}

/* Grab hand ONLY appears when zoomed in and using standard cursor tool */
.viewer-container.tool-cursor.is-zoomed {
  cursor: grab;
}

.viewer-container.tool-cursor.is-panning {
  cursor: grabbing;
}

/* Floating Zoom Indicator Pill */
.zoom-indicator-pill {
  position: absolute;
  top: 18px;
  right: 24px;
  z-index: 750;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 999px;
  padding: 4px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.2s ease;
}

.zoom-text {
  font-size: 12px;
  font-weight: 600;
  color: #60a5fa;
  font-variant-numeric: tabular-nums;
}

.zoom-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zoom-reset-btn, .zoom-fit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #e2e8f0;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 999px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}

.zoom-reset-btn:hover {
  background: #2563eb;
  color: #ffffff;
}

.zoom-fit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.zoom-fit-btn.active {
  background: #3b82f6;
  color: #ffffff;
}

.slide-stage {
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
  transition: transform 0.05s linear;
}

.pdf-canvas {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
}

/* Screen Blanking */
.blank-screen {
  position: fixed;
  inset: 0;
  z-index: 840;
}
.black-screen {
  background: #000000;
}
.white-screen {
  background: #ffffff;
}
</style>
