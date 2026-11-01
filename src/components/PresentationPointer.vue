<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePresentation } from '../composables/usePresentation';

defineProps<{
  containerWidth: number;
  containerHeight: number;
}>();

const { state } = usePresentation();

const mouseX = ref(-100);
const mouseY = ref(-100);
const isMouseDown = ref(false);
const ripples = ref<{ id: number; x: number; y: number }[]>([]);
let rippleIdSeq = 0;

const isLaserActive = computed(() => state.activeTool === 'laser');

const laserColorHex = computed(() => {
  switch (state.laserColor) {
    case 'green': return '#10b981';
    case 'blue': return '#06b6d4';
    case 'red':
    default:
      return '#ef4444';
  }
});

const laserHaloHex = computed(() => {
  switch (state.laserColor) {
    case 'green': return 'rgba(16, 185, 129, 0.4)';
    case 'blue': return 'rgba(6, 182, 212, 0.4)';
    case 'red':
    default:
      return 'rgba(239, 68, 68, 0.4)';
  }
});

function handleMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  isMouseDown.value = true;

  if (isLaserActive.value) {
    const id = ++rippleIdSeq;
    ripples.value.push({ id, x: e.clientX, y: e.clientY });
    setTimeout(() => {
      ripples.value = ripples.value.filter(r => r.id !== id);
    }, 600);
  }
}

function handleMouseUp() {
  isMouseDown.value = false;
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mousedown', handleMouseDown);
  window.removeEventListener('mouseup', handleMouseUp);
});
</script>

<template>
  <div
    class="pointer-overlay"
    :class="{
      'hide-cursor': isLaserActive,
      'active': isLaserActive
    }"
  >
    <!-- Laser Pointer Effect -->
    <div
      v-if="isLaserActive && mouseX >= 0"
      class="laser-dot"
      :style="{
        left: `${mouseX}px`,
        top: `${mouseY}px`,
        backgroundColor: laserColorHex,
        boxShadow: `0 0 12px 3px ${laserColorHex}, 0 0 24px 8px ${laserHaloHex}, 0 0 40px 14px ${laserHaloHex}`,
        width: `${state.laserSize}px`,
        height: `${state.laserSize}px`,
        transform: `translate(-50%, -50%) scale(${isMouseDown ? 1.4 : 1.0})`,
      }"
    >
      <!-- Intense glowing center core -->
      <div class="laser-core" />
    </div>

    <!-- Laser Pulse Shockwaves on Click -->
    <div
      v-for="ripple in ripples"
      :key="ripple.id"
      class="laser-ripple"
      :style="{
        left: `${ripple.x}px`,
        top: `${ripple.y}px`,
        borderColor: laserColorHex,
        boxShadow: `0 0 16px ${laserColorHex}`,
      }"
    />
  </div>
</template>

<style scoped>
.pointer-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 900;
  overflow: hidden;
}

.pointer-overlay.hide-cursor {
  cursor: none;
}

/* Laser Dot */
.laser-dot {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  transition: transform 0.08s cubic-bezier(0.1, 1, 0.1, 1);
  will-change: left, top, transform;
  display: flex;
  align-items: center;
  justify-content: center;
}

.laser-core {
  width: 35%;
  height: 35%;
  background-color: #ffffff;
  border-radius: 50%;
  opacity: 0.95;
}

/* Shockwave Ripple */
.laser-ripple {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid;
  transform: translate(-50%, -50%);
  animation: ripple-expand 0.6s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
  pointer-events: none;
}

@keyframes ripple-expand {
  0% {
    width: 14px;
    height: 14px;
    opacity: 1;
    border-width: 3px;
  }
  100% {
    width: 120px;
    height: 120px;
    opacity: 0;
    border-width: 1px;
  }
}
</style>
