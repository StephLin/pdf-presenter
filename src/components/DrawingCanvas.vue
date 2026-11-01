<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { usePresentation } from '../composables/usePresentation';
import type { DrawingStroke, Point } from '../types/presentation';

const props = defineProps<{
  width: number;
  height: number;
}>();

const presentation = usePresentation();
const { state, currentPageAnnotations } = presentation;

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref(false);
const currentStroke = ref<DrawingStroke | null>(null);

const isDrawingActive = computed(() => {
  return state.activeTool === 'pen' || state.activeTool === 'highlighter' || state.activeTool === 'eraser';
});

// Redraw canvas whenever width, height, current page, zoom level, or strokes change
watch([() => props.width, () => props.height, () => state.currentPage, () => state.zoomScale, () => currentPageAnnotations.value.strokes], () => {
  redrawCanvas();
}, { deep: true });

function getRelativePoint(e: MouseEvent): Point | null {
  if (!canvasRef.value) return null;
  const rect = canvasRef.value.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  return { x, y };
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0 || !isDrawingActive.value) return;
  const pt = getRelativePoint(e);
  if (!pt) return;

  if (state.activeTool === 'eraser') {
    eraseAt(pt);
    isDrawing.value = true;
    return;
  }

  isDrawing.value = true;
  const isHighlighter = state.activeTool === 'highlighter';

  currentStroke.value = {
    id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    tool: isHighlighter ? 'highlighter' : 'pen',
    color: isHighlighter ? state.highlighterColor : state.penColor,
    width: isHighlighter ? state.highlighterWidth : state.penWidth,
    opacity: isHighlighter ? 0.38 : 1.0,
    points: [pt],
  };

  drawRealtimeStroke();
}

function handleMouseMove(e: MouseEvent) {
  if (!isDrawing.value || !isDrawingActive.value) return;
  const pt = getRelativePoint(e);
  if (!pt) return;

  if (state.activeTool === 'eraser') {
    eraseAt(pt);
    return;
  }

  if (currentStroke.value) {
    currentStroke.value.points.push(pt);
    drawRealtimeStroke();
  }
}

function handleMouseUp() {
  if (!isDrawing.value) return;
  isDrawing.value = false;

  if (currentStroke.value && currentStroke.value.points.length > 0) {
    presentation.addStroke(currentStroke.value);
    currentStroke.value = null;
    redrawCanvas();
  }
}

function eraseAt(pt: Point) {
  const strokes = currentPageAnnotations.value.strokes;
  const thresholdDist = 0.03; // ~3% of slide dimension

  const remaining = strokes.filter(stroke => {
    return !stroke.points.some(p => {
      const dx = p.x - pt.x;
      const dy = p.y - pt.y;
      return Math.sqrt(dx * dx + dy * dy) < thresholdDist;
    });
  });

  if (remaining.length !== strokes.length) {
    currentPageAnnotations.value.strokes = remaining;
    redrawCanvas();
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke, w: number, h: number) {
  if (stroke.points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.globalAlpha = stroke.opacity;

  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }

  const pts = stroke.points;
  if (pts.length === 1) {
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.arc(pts[0].x * w, pts[0].y * h, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0].x * w, pts[0].y * h);

    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x * w + pts[i + 1].x * w) / 2;
      const yc = (pts[i].y * h + pts[i + 1].y * h) / 2;
      ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, xc, yc);
    }

    const last = pts[pts.length - 1];
    ctx.lineTo(last.x * w, last.y * h);
    ctx.stroke();
  }

  ctx.restore();
}

function redrawCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const w = props.width;
  const h = props.height;
  if (w <= 0 || h <= 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const zoom = state.zoomScale || 1.0;
  canvas.width = Math.round(w * zoom * dpr);
  canvas.height = Math.round(h * zoom * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(zoom * dpr, zoom * dpr);
  ctx.clearRect(0, 0, w, h);

  const strokes = currentPageAnnotations.value?.strokes || [];
  for (const stroke of strokes) {
    drawStroke(ctx, stroke, w, h);
  }

  if (currentStroke.value) {
    drawStroke(ctx, currentStroke.value, w, h);
  }
}

function drawRealtimeStroke() {
  redrawCanvas();
}

onMounted(() => {
  redrawCanvas();
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="drawing-canvas"
    :class="{
      'pen-active': state.activeTool === 'pen',
      'highlighter-active': state.activeTool === 'highlighter',
      'eraser-active': state.activeTool === 'eraser',
      'pass-through': !isDrawingActive
    }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  />
</template>

<style scoped>
.drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 50;
  touch-action: none;
}

.drawing-canvas.pass-through {
  pointer-events: none;
}

.drawing-canvas.pen-active {
  cursor: crosshair;
  pointer-events: auto;
}

.drawing-canvas.highlighter-active {
  cursor: crosshair;
  pointer-events: auto;
}

.drawing-canvas.eraser-active {
  cursor: cell;
  pointer-events: auto;
}
</style>
