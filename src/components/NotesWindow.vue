<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { renderLatexAndMarkdown } from '../utils/markdown';
import { APP_VERSION, formatAppVersion } from '../utils/version';
import AppIcon from './AppIcon.vue';
import {
  LIVE_SYNC_STORAGE_KEY,
  loadLivePresentationSync,
  saveLivePresentationSync,
  type LivePresentationSyncData,
} from '../utils/storage';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Eye,
  Edit3,
  Columns2,
  Moon,
  Sun,
  Plus,
  Minus,
  X,
} from 'lucide-vue-next';

const channelName = 'pdf-presenter-notes-sync';
let channel: BroadcastChannel | null = null;
let unlistenTauriSync: (() => void) | null = null;

const isConnected = ref(false);
const currentPage = ref(1);
const totalPages = ref(1);
const docTitle = ref('Presenter Notes');
const currentPdfName = ref('');
const noteContent = ref('');
const allNotes = ref<Record<number, string>>({});
const blackScreen = ref(false);
const whiteScreen = ref(false);

// View Mode: 'split' | 'preview' | 'edit'
const viewMode = ref<'split' | 'preview' | 'edit'>('split');

// Font size scale (multiplier for preview text)
const fontScale = ref<number>(1.15);

// Presentation Timer
const timerSeconds = ref(0);
const isTimerRunning = ref(false);
let timerInterval: ReturnType<typeof setInterval> | null = null;

const textareaRef = ref<HTMLTextAreaElement | null>(null);

function applySyncPayload(data: Partial<LivePresentationSyncData> | null | undefined) {
  if (!data || typeof data !== 'object') return;

  isConnected.value = true;

  if (typeof data.title === 'string' && data.title) {
    docTitle.value = data.title;
  }
  if (typeof data.currentPdfName === 'string') {
    currentPdfName.value = data.currentPdfName;
  }
  if (typeof data.numPages === 'number' && data.numPages >= 1) {
    totalPages.value = data.numPages;
  }
  if (data.allNotes && typeof data.allNotes === 'object') {
    allNotes.value = { ...allNotes.value, ...data.allNotes };
  }

  const incomingPage = typeof data.page === 'number' && data.page >= 1 ? data.page : currentPage.value;
  const pageChanged = incomingPage !== currentPage.value;
  currentPage.value = incomingPage;

  const incomingNotes =
    typeof data.notes === 'string'
      ? data.notes
      : allNotes.value[incomingPage] ?? '';

  allNotes.value[incomingPage] = incomingNotes;

  const isTypingInTextarea =
    typeof document !== 'undefined' && document.activeElement === textareaRef.value;

  if (pageChanged || !isTypingInTextarea || noteContent.value !== incomingNotes) {
    if (!isTypingInTextarea || pageChanged) {
      noteContent.value = incomingNotes;
    }
  }

  if (typeof data.blackScreen === 'boolean') {
    blackScreen.value = data.blackScreen;
  }
  if (typeof data.whiteScreen === 'boolean') {
    whiteScreen.value = data.whiteScreen;
  }
}

// Synchronously hydrate from localStorage before first render frame
const initialSync = loadLivePresentationSync();
if (initialSync) {
  applySyncPayload(initialSync);
}

const formattedTimer = computed(() => {
  const hrs = Math.floor(timerSeconds.value / 3600);
  const mins = Math.floor((timerSeconds.value % 3600) / 60);
  const secs = timerSeconds.value % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

function toggleTimer() {
  if (isTimerRunning.value) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    isTimerRunning.value = false;
  } else {
    isTimerRunning.value = true;
    timerInterval = setInterval(() => {
      timerSeconds.value++;
    }, 1000);
  }
}

function resetTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  isTimerRunning.value = false;
  timerSeconds.value = 0;
}

// Rendered Markdown + LaTeX
const renderedHtml = computed(() => {
  if (!noteContent.value.trim()) {
    return '<div class="empty-notice"><p>No presenter notes for this slide yet</p><p class="sub">Enter Markdown or LaTeX math formulas (such as $E=mc^2$) in the editor on the left</p></div>';
  }
  return renderLatexAndMarkdown(noteContent.value);
});

function sendCommand(payload: Record<string, any>) {
  if (channel) {
    try {
      channel.postMessage(payload);
    } catch (err) {
      console.warn('BroadcastChannel send error:', err);
    }
  }
  if (isTauri()) {
    import('@tauri-apps/api/event')
      .then(({ emit }) => emit('presenter-notes-command', payload))
      .catch(() => {});
  }
}

function initSyncListeners() {
  // 1. Hydrate latest snapshot from localStorage
  const latest = loadLivePresentationSync();
  if (latest) {
    applySyncPayload(latest);
  }

  // 2. BroadcastChannel listener
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(channelName);
    channel.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'sync') {
        applySyncPayload(data);
      }
    };
  }

  // 3. Tauri Event Bus listener
  if (isTauri() && !unlistenTauriSync) {
    import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        unlistenTauriSync = await listen<LivePresentationSyncData>('presenter-notes-sync', (event) => {
          applySyncPayload(event.payload);
        });
      })
      .catch(() => {});
  }

  // Request live sync from main window
  sendCommand({ type: 'request_sync' });
}

function handleStorageEvent(e: StorageEvent) {
  if (e.key === LIVE_SYNC_STORAGE_KEY && e.newValue) {
    try {
      const parsed = JSON.parse(e.newValue) as LivePresentationSyncData;
      applySyncPayload(parsed);
    } catch {
      // Ignore malformed JSON
    }
  }
}

function sendUpdateNotes() {
  allNotes.value[currentPage.value] = noteContent.value;

  // Persist immediately to localStorage sync snapshot
  saveLivePresentationSync({
    title: docTitle.value,
    currentPdfName: currentPdfName.value,
    page: currentPage.value,
    numPages: totalPages.value,
    notes: noteContent.value,
    allNotes: { ...allNotes.value },
    blackScreen: blackScreen.value,
    whiteScreen: whiteScreen.value,
    updatedAt: Date.now(),
  });

  sendCommand({
    type: 'update_notes',
    page: currentPage.value,
    notes: noteContent.value,
  });
}

function prevSlide() {
  if (currentPage.value > 1) {
    const target = currentPage.value - 1;
    currentPage.value = target;
    noteContent.value = allNotes.value[target] ?? '';
    sendCommand({ type: 'prev_page' });
  }
}

function nextSlide() {
  if (currentPage.value < totalPages.value) {
    const target = currentPage.value + 1;
    currentPage.value = target;
    noteContent.value = allNotes.value[target] ?? '';
    sendCommand({ type: 'next_page' });
  }
}

function jumpToPage(e: Event) {
  const target = e.target as HTMLSelectElement;
  const p = Number(target.value);
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p;
    noteContent.value = allNotes.value[p] ?? '';
    sendCommand({ type: 'go_to_page', page: p });
  }
}

function toggleBlackScreen() {
  blackScreen.value = !blackScreen.value;
  if (blackScreen.value) whiteScreen.value = false;
  sendCommand({ type: 'toggle_black_screen' });
}

function toggleWhiteScreen() {
  whiteScreen.value = !whiteScreen.value;
  if (whiteScreen.value) blackScreen.value = false;
  sendCommand({ type: 'toggle_white_screen' });
}

async function closeNotesWindow() {
  if (isTauri()) {
    try {
      await invoke('close_notes_window');
      return;
    } catch {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
        return;
      } catch (err) {
        console.error('Failed to close Tauri window:', err);
      }
    }
  }
  window.close();
}

function insertMarkdown(prefix: string, suffix = '') {
  if (!textareaRef.value) return;
  const ta = textareaRef.value;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.substring(start, end);
  const replacement = prefix + sel + suffix;
  ta.setRangeText(replacement, start, end, 'select');
  noteContent.value = ta.value;
  sendUpdateNotes();
  ta.focus();
}

function handleKeyDown(e: KeyboardEvent) {
  const activeEl = document.activeElement;
  const isEditing =
    activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT');

  if (isEditing) {
    if (e.key === 'Escape') {
      (activeEl as HTMLElement).blur();
    }
    return;
  }

  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    nextSlide();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    prevSlide();
  } else if (e.key === 'b' || e.key === 'B') {
    e.preventDefault();
    toggleBlackScreen();
  } else if (e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    toggleWhiteScreen();
  }
}

function adjustFont(delta: number) {
  const next = fontScale.value + delta;
  if (next >= 0.8 && next <= 2.2) {
    fontScale.value = Math.round(next * 10) / 10;
  }
}

onMounted(() => {
  initSyncListeners();
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('storage', handleStorageEvent);

  const syncRetry = setInterval(() => {
    const stored = loadLivePresentationSync();
    if (stored) {
      applySyncPayload(stored);
    }
    if (isConnected.value) {
      clearInterval(syncRetry);
    } else {
      sendCommand({ type: 'request_sync' });
    }
  }, 300);

  setTimeout(() => clearInterval(syncRetry), 3000);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('storage', handleStorageEvent);
  if (channel) {
    channel.close();
    channel = null;
  }
  if (unlistenTauriSync) {
    unlistenTauriSync();
    unlistenTauriSync = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
});
</script>

<template>
  <div class="presenter-notes-app">
    <!-- Top Header Bar -->
    <header class="notes-header">
      <div class="header-left">
        <AppIcon :size="26" class="notes-brand-icon" />
        <div class="app-badge">
          <span class="status-dot" :class="{ connected: isConnected }"></span>
          <span>Dual-Screen Presenter Notes</span>
          <span class="notes-version-tag">{{ formatAppVersion(APP_VERSION) }}</span>
        </div>
        <div class="title-label" :title="docTitle">
          {{ docTitle }}
        </div>
      </div>

      <!-- Navigation & Page Jump -->
      <div class="header-center">
        <div class="nav-controls">
          <button
            class="nav-btn"
            :disabled="currentPage <= 1"
            title="Previous Slide (Left / PageUp)"
            @click="prevSlide"
          >
            <ChevronLeft :size="18" />
            <span>Previous</span>
          </button>

          <div class="page-selector">
            <select :value="currentPage" @change="jumpToPage">
              <option v-for="p in totalPages" :key="p" :value="p">
                Slide {{ p }} / {{ totalPages }}
              </option>
            </select>
          </div>

          <button
            class="nav-btn"
            :disabled="currentPage >= totalPages"
            title="Next Slide (Right / PageDown / Space)"
            @click="nextSlide"
          >
            <span>Next</span>
            <ChevronRight :size="18" />
          </button>
        </div>

        <!-- Blank Screen Sync Toggles -->
        <div class="screen-toggles">
          <button
            class="toggle-btn"
            :class="{ active: blackScreen }"
            title="Toggle Black Screen (B)"
            @click="toggleBlackScreen"
          >
            <Moon :size="15" />
            <span>Black</span>
          </button>
          <button
            class="toggle-btn"
            :class="{ active: whiteScreen }"
            title="Toggle White Screen (W)"
            @click="toggleWhiteScreen"
          >
            <Sun :size="15" />
            <span>White</span>
          </button>
        </div>
      </div>

      <!-- Right Actions: Timer, View Modes, Font Controls, Close -->
      <div class="header-right">
        <!-- Presentation Timer -->
        <div class="timer-box" :class="{ running: isTimerRunning }">
          <Clock :size="14" class="timer-icon" />
          <span class="timer-text">{{ formattedTimer }}</span>
          <button
            class="timer-btn"
            :title="isTimerRunning ? 'Pause Timer' : 'Start Timer'"
            @click="toggleTimer"
          >
            <Pause v-if="isTimerRunning" :size="13" />
            <Play v-else :size="13" />
          </button>
          <button
            class="timer-btn"
            title="Reset Timer"
            @click="resetTimer"
          >
            <RotateCcw :size="13" />
          </button>
        </div>

        <!-- Font Size Scale -->
        <div v-if="viewMode !== 'edit'" class="font-controls">
          <button class="font-btn" title="Decrease Font Size" @click="adjustFont(-0.1)">
            <Minus :size="13" />
          </button>
          <span class="font-scale-label">{{ Math.round(fontScale * 100) }}%</span>
          <button class="font-btn" title="Increase Font Size" @click="adjustFont(0.1)">
            <Plus :size="13" />
          </button>
        </div>

        <!-- View Mode Switcher -->
        <div class="view-mode-group">
          <button
            class="mode-btn"
            :class="{ active: viewMode === 'split' }"
            title="Split View (Edit + Preview)"
            @click="viewMode = 'split'"
          >
            <Columns2 :size="15" />
          </button>
          <button
            class="mode-btn"
            :class="{ active: viewMode === 'preview' }"
            title="Presentation Mode (Preview Only)"
            @click="viewMode = 'preview'"
          >
            <Eye :size="15" />
          </button>
          <button
            class="mode-btn"
            :class="{ active: viewMode === 'edit' }"
            title="Editor Mode (Text Only)"
            @click="viewMode = 'edit'"
          >
            <Edit3 :size="15" />
          </button>
        </div>

        <!-- Close Popout Window Button -->
        <button
          class="close-win-btn"
          title="Close Presenter Notes Window"
          @click="closeNotesWindow"
        >
          <X :size="16" />
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="notes-body" :class="`mode-${viewMode}`">
      <!-- Left Pane: Editor -->
      <div v-show="viewMode !== 'preview'" class="pane edit-pane">
        <div class="pane-toolbar">
          <div class="toolbar-label">Presenter Notes (Markdown / LaTeX)</div>
          <div class="quick-helpers">
            <button class="tool-tag" @click="insertMarkdown('# ', '')">H1</button>
            <button class="tool-tag" @click="insertMarkdown('## ', '')">H2</button>
            <button class="tool-tag" @click="insertMarkdown('**', '**')">Bold</button>
            <button class="tool-tag" @click="insertMarkdown('- ', '')">List</button>
            <button class="tool-tag" @click="insertMarkdown('$', '$')">Inline Math</button>
            <button class="tool-tag" @click="insertMarkdown('$$\n', '\n$$')">Block Math</button>
          </div>
        </div>
        <textarea
          ref="textareaRef"
          v-model="noteContent"
          class="notes-textarea"
          placeholder="Enter presenter cues, key points, or math formulas for this slide..."
          @input="sendUpdateNotes"
        ></textarea>
        <div class="pane-footer">
          <span>Live synchronized with main presentation</span>
          <span class="hint">Press Esc to blur input and use arrow keys to navigate slides</span>
        </div>
      </div>

      <!-- Right Pane: Rendered Preview -->
      <div
        v-show="viewMode !== 'edit'"
        class="pane preview-pane"
        :style="{ fontSize: `${fontScale}rem` }"
      >
        <div class="preview-header">
          <span class="badge">Live Preview</span>
          <span class="hint">Formatted for clear reading during presentation</span>
        </div>
        <div class="rendered-content" v-html="renderedHtml"></div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.presenter-notes-app {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #090d16;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft JhengHei", "Noto Sans TC", sans-serif;
  overflow: hidden;
  user-select: text;
  box-sizing: border-box;
}

/* Header */
.notes-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #111827;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  gap: 12px;
  flex-shrink: 0;
  min-width: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.notes-brand-icon {
  width: 26px;
  height: 26px;
  object-fit: contain;
  flex-shrink: 0;
}

.app-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(37, 99, 235, 0.2);
  border: 1px solid rgba(37, 99, 235, 0.4);
  color: #60a5fa;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.notes-version-tag {
  background: rgba(255, 255, 255, 0.12);
  color: #bfdbfe;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
  box-shadow: 0 0 6px #f59e0b;
}

.status-dot.connected {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.title-label {
  font-size: 13px;
  color: #94a3b8;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Center Controls */
.header-center {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1f2937;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #374151;
  color: #f3f4f6;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover:not(:disabled) {
  background: #4b5563;
  color: #ffffff;
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-selector select {
  background: #111827;
  color: #e5e7eb;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}

.screen-toggles {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #1f2937;
  color: #9ca3af;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn:hover {
  background: #374151;
  color: #f3f4f6;
}

.toggle-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #3b82f6;
}

/* Header Right */
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.timer-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1f2937;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 4px 10px;
}

.timer-box.running {
  border-color: rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.08);
}

.timer-icon {
  color: #94a3b8;
}

.timer-box.running .timer-icon {
  color: #10b981;
}

.timer-text {
  font-family: monospace;
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.5px;
}

.timer-btn {
  background: #374151;
  color: #f3f4f6;
  border: none;
  border-radius: 4px;
  padding: 3px 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.timer-btn:hover {
  background: #4b5563;
}

.font-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #1f2937;
  border-radius: 6px;
  padding: 3px 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.font-btn {
  background: #374151;
  color: #f3f4f6;
  border: none;
  border-radius: 4px;
  padding: 2px 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.font-btn:hover {
  background: #4b5563;
}

.font-scale-label {
  font-size: 11px;
  color: #94a3b8;
  min-width: 32px;
  text-align: center;
}

.view-mode-group {
  display: flex;
  background: #1f2937;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.mode-btn {
  background: transparent;
  color: #94a3b8;
  border: none;
  border-radius: 4px;
  padding: 5px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}

.mode-btn:hover {
  color: #f3f4f6;
}

.mode-btn.active {
  background: #2563eb;
  color: #ffffff;
}

.close-win-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-win-btn:hover {
  background: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
}

/* Content Area */
.notes-body {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mode-preview .preview-pane {
  flex: 1;
}

.mode-edit .edit-pane {
  flex: 1;
}

/* Edit Pane */
.edit-pane {
  background: #0f172a;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.pane-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
  background: #162032;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.toolbar-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.quick-helpers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tool-tag {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.tool-tag:hover {
  background: #334155;
  color: #ffffff;
}

.notes-textarea {
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  color: #f1f5f9;
  border: none;
  padding: 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 14px;
  line-height: 1.7;
  resize: none;
  outline: none;
}

.pane-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 16px;
  background: #111827;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}

.hint {
  color: #475569;
}

/* Preview Pane */
.preview-pane {
  background: #070c14;
  overflow-y: auto;
  padding: 20px 28px;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.preview-header .badge {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.rendered-content {
  line-height: 1.75;
  color: #e2e8f0;
  word-break: break-word;
}

.rendered-content :deep(h1) {
  font-size: 1.7em;
  color: #60a5fa;
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.rendered-content :deep(h2) {
  font-size: 1.4em;
  color: #38bdf8;
  margin: 16px 0 10px 0;
}

.rendered-content :deep(h3) {
  font-size: 1.15em;
  color: #93c5fd;
  margin: 12px 0 8px 0;
}

.rendered-content :deep(p) {
  margin: 8px 0;
}

.rendered-content :deep(.note-list) {
  margin: 8px 0;
  padding-left: 24px;
}

.rendered-content :deep(li) {
  margin: 6px 0;
}

.rendered-content :deep(strong) {
  color: #fbbf24;
  font-weight: 700;
}

.rendered-content :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
  color: #f43f5e;
}

.rendered-content :deep(blockquote) {
  border-left: 3px solid #3b82f6;
  margin: 10px 0;
  padding: 4px 12px;
  background: rgba(59, 130, 246, 0.08);
  color: #94a3b8;
  font-style: italic;
}

.rendered-content :deep(.katex-display-wrapper) {
  margin: 16px 0;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow-x: auto;
}

.rendered-content :deep(.katex) {
  font-size: 1.1em;
}

.empty-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  color: #64748b;
  text-align: center;
}

.empty-notice .sub {
  font-size: 0.85em;
  color: #475569;
  margin-top: 6px;
}
</style>
