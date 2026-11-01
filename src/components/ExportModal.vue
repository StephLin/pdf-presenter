<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePresentation } from '../composables/usePresentation';
import { invoke } from '@tauri-apps/api/core';
import { renderLatexAndMarkdown } from '../utils/markdown';
import {
  X,
  FileCode,
  Download,
  Copy,
  Check,
  Eye,
  Code,
} from 'lucide-vue-next';

const presentation = usePresentation();
const { state, getMarkdownSource } = presentation;

const activeTab = ref<'preview' | 'raw'>('preview');
const isCopied = ref(false);

const markdownSource = computed(() => getMarkdownSource());

async function copySource() {
  await navigator.clipboard.writeText(markdownSource.value);
  isCopied.value = true;
  setTimeout(() => {
    isCopied.value = false;
  }, 2000);
}

async function saveMarkdownFile() {
  const defaultName = `${state.currentPdfName.replace(/\.pdf$/i, '') || 'notes'}_notes.md`;
  try {
    const savePath = await invoke<string | null>('save_file_dialog', {
      defaultName,
      extension: 'md',
    });
    if (savePath) {
      await invoke('write_text_file', {
        path: savePath,
        content: markdownSource.value,
      });
      alert('Markdown notes successfully saved to: ' + savePath);
    }
  } catch (err) {
    downloadBlob(markdownSource.value, defaultName, 'text/markdown;charset=utf-8');
  }
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div
    v-if="state.showExportModal"
    class="modal-backdrop"
    @click.self="state.showExportModal = false"
  >
    <div class="modal-box">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          <FileCode class="header-icon" :size="20" />
          <div class="header-titles">
            <h3>Export Markdown Notes & Script</h3>
            <span class="sub">Universal pure Markdown format (supports LaTeX math formulas), fully offline with zero external dependencies</span>
          </div>
        </div>

        <button
          class="close-btn"
          @click="state.showExportModal = false"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="modal-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'preview' }"
          @click="activeTab = 'preview'"
        >
          <Eye :size="14" /> Notes Preview
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'raw' }"
          @click="activeTab = 'raw'"
        >
          <Code :size="14" /> Markdown Source
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="modal-content">
        <!-- Rendered Preview Tab -->
        <div v-if="activeTab === 'preview'" class="tab-pane preview-pane">
          <div
            class="rendered-markdown-view markdown-body"
            v-html="renderLatexAndMarkdown(markdownSource)"
          />
        </div>

        <!-- Raw Markdown Tab -->
        <div v-else class="tab-pane raw-pane">
          <pre class="code-view"><code>{{ markdownSource }}</code></pre>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <div class="footer-left">
          <button class="footer-btn secondary" @click="copySource">
            <Check v-if="isCopied" :size="16" />
            <Copy v-else :size="16" />
            <span>{{ isCopied ? 'Copied!' : 'Copy Markdown' }}</span>
          </button>
        </div>

        <div class="footer-right">
          <button
            class="footer-btn primary"
            @click="saveMarkdownFile"
          >
            <Download :size="16" />
            <span>Save as .md File</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  z-index: 950;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-box {
  width: 780px;
  max-width: 95vw;
  height: 80vh;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #1e293b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: #3b82f6;
}

.header-titles h3 {
  margin: 0;
  font-size: 16px;
  color: #f8fafc;
  font-weight: 600;
}

.header-titles .sub {
  font-size: 12px;
  color: #94a3b8;
}

.close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}
.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.modal-tabs {
  display: flex;
  padding: 0 24px;
  background: #1e293b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 8px;
}

.tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: #f1f5f9;
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.modal-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  background: #090e17;
}

.tab-pane {
  flex: 1;
  display: flex;
  overflow-y: auto;
  padding: 24px;
}

.preview-pane {
  background: #0d131f;
}

.rendered-markdown-view {
  color: #e2e8f0;
  font-size: 14px;
  line-height: 1.7;
  width: 100%;
}

.raw-pane {
  background: #090e17;
}

.code-view {
  margin: 0;
  color: #cbd5e1;
  font-family: 'Consolas', 'Fira Code', 'Menlo', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  width: 100%;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: #1e293b;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-btn {
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  transition: all 0.15s ease;
}

.footer-btn.primary {
  background: #3b82f6;
  color: white;
}
.footer-btn.primary:hover {
  background: #2563eb;
}

.footer-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}
.footer-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.18);
}
</style>
