<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { usePresentation } from '../composables/usePresentation';
import { pdfService } from '../services/pdfService';
import { X, FileText, PenTool } from 'lucide-vue-next';

const presentation = usePresentation();
const { state, annotations } = presentation;

const thumbnails = ref<Record<number, string>>({});
const isLoadingThumbs = ref(false);

async function loadAllThumbnails() {
  if (state.numPages <= 0) return;
  isLoadingThumbs.value = true;
  for (let page = 1; page <= state.numPages; page++) {
    if (!thumbnails.value[page]) {
      const url = await pdfService.getThumbnail(page, 200);
      thumbnails.value[page] = url;
    }
  }
  isLoadingThumbs.value = false;
}

watch(() => state.showThumbnails, (open) => {
  if (open) {
    loadAllThumbnails();
  }
});

watch(() => state.numPages, () => {
  thumbnails.value = {};
  if (state.showThumbnails) {
    loadAllThumbnails();
  }
});

onMounted(() => {
  if (state.showThumbnails) {
    loadAllThumbnails();
  }
});

function selectSlide(page: number) {
  presentation.goToPage(page);
  state.showThumbnails = false;
}
</script>

<template>
  <div
    v-if="state.showThumbnails"
    class="drawer-backdrop"
    @click.self="state.showThumbnails = false"
  >
    <div class="drawer-container">
      <div class="drawer-header">
        <div class="title-area">
          <h3>Slide Overview</h3>
          <span class="count-badge">{{ state.numPages }} Slides</span>
        </div>
        <button
          class="close-btn"
          title="Close Overview (Esc / G)"
          @click="state.showThumbnails = false"
        >
          <X :size="20" />
        </button>
      </div>

      <div class="drawer-body">
        <div class="thumbnails-grid">
          <div
            v-for="page in state.numPages"
            :key="page"
            class="thumbnail-card"
            :class="{ 'is-active': state.currentPage === page }"
            @click="selectSlide(page)"
          >
            <div class="thumb-preview">
              <img
                v-if="thumbnails[page]"
                :src="thumbnails[page]"
                :alt="`Slide ${page}`"
                class="thumb-img"
              />
              <div v-else class="thumb-loading">
                <span>Loading...</span>
              </div>

              <!-- Indicators: strokes, notes, presenter text -->
              <div class="indicators">
                <span
                  v-if="annotations[page]?.presenterNotes"
                  class="badge badge-notes"
                  title="Contains presenter notes"
                >
                  <FileText :size="10" />
                </span>
                <span
                  v-if="annotations[page]?.strokes?.length"
                  class="badge badge-pen"
                  title="Contains drawing annotations"
                >
                  <PenTool :size="10" />
                </span>
              </div>
            </div>

            <div class="card-footer">
              <span class="page-num">{{ page }}</span>
              <span v-if="state.currentPage === page" class="current-label">Current</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 850;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drawer-container {
  width: 100%;
  max-width: 1200px;
  max-height: 80vh;
  background: #0f172a;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-area h3 {
  margin: 0;
  font-size: 17px;
  color: #f8fafc;
  font-weight: 600;
}

.count-badge {
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  color: #94a3b8;
}

.close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.drawer-body {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(80vh - 70px);
}

.thumbnails-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 18px;
}

.thumbnail-card {
  background: #1e293b;
  border-radius: 10px;
  border: 2px solid transparent;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.thumbnail-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
  border-color: #475569;
}

.thumbnail-card.is-active {
  border-color: #3b82f6;
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.4);
}

.thumb-preview {
  aspect-ratio: 16 / 9;
  background: #090d16;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumb-loading {
  font-size: 11px;
  color: #64748b;
}

.indicators {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
}

.badge {
  padding: 3px 5px;
  border-radius: 4px;
  color: white;
  display: flex;
  align-items: center;
}

.badge-notes { background: #3b82f6; }
.badge-latex { background: #f59e0b; }
.badge-pen { background: #ef4444; }

.card-footer {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #cbd5e1;
}

.page-num {
  font-weight: 600;
}

.current-label {
  font-size: 11px;
  color: #60a5fa;
  font-weight: 600;
}
</style>
