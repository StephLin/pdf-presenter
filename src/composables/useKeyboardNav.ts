import { onMounted, onUnmounted } from 'vue';
import { usePresentation } from './usePresentation';

export function useKeyboardNav() {
  const presentation = usePresentation();
  const { state } = presentation;

  function handleKeyDown(e: KeyboardEvent) {
    // If the user is typing in an input, textarea or contenteditable, do not trigger presentation shortcuts
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    // Modal or active popups
    if (state.showExportModal) {
      if (e.key === 'Escape') {
        state.showExportModal = false;
      }
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // Handle Ctrl+Z (Undo) and Ctrl+R / Ctrl+Y (Redo)
    if (isCtrlOrCmd) {
      const keyLower = e.key.toLowerCase();
      if (keyLower === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          presentation.redoStroke();
        } else {
          presentation.undoStroke();
        }
        return;
      }
      if (keyLower === 'r' || keyLower === 'y') {
        e.preventDefault(); // Prevent browser refresh on Ctrl+R!
        presentation.redoStroke();
        return;
      }
      if (keyLower === '0') {
        e.preventDefault();
        presentation.resetZoom();
        return;
      }
    }

    switch (e.key) {
      // Presentation Mode toggle
      case 'F5':
        e.preventDefault();
        presentation.togglePresentationMode();
        break;

      case 'Escape':
        if (state.showThumbnails) {
          state.showThumbnails = false;
        } else if (state.showNotesDrawer) {
          state.showNotesDrawer = false;
        } else if (state.zoomScale > 1.05) {
          presentation.resetZoom();
        } else if (state.blackScreen || state.whiteScreen) {
          state.blackScreen = false;
          state.whiteScreen = false;
        } else if (state.mode === 'presentation') {
          presentation.togglePresentationMode(false);
        }
        break;

      // Next page navigation
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        presentation.nextPage();
        break;

      // Previous page navigation
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
        e.preventDefault();
        presentation.prevPage();
        break;

      // Home & End
      case 'Home':
        e.preventDefault();
        presentation.goToPage(1);
        break;
      case 'End':
        e.preventDefault();
        presentation.goToPage(state.numPages);
        break;

      // Screen Blanking (PowerPoint standard)
      case 'b':
      case 'B':
        e.preventDefault();
        presentation.toggleBlackScreen();
        break;

      case 'w':
      case 'W':
        e.preventDefault();
        presentation.toggleWhiteScreen();
        break;

      // Pointer & Drawing Tools
      case 'l':
      case 'L':
        e.preventDefault();
        presentation.setTool(state.activeTool === 'laser' ? 'cursor' : 'laser');
        break;

      case 'd':
      case 'D':
        e.preventDefault();
        presentation.setTool(state.activeTool === 'pen' ? 'cursor' : 'pen');
        break;

      case 'h':
      case 'H':
        e.preventDefault();
        presentation.setTool(state.activeTool === 'highlighter' ? 'cursor' : 'highlighter');
        break;

      case 'e':
      case 'E':
        e.preventDefault();
        presentation.setTool(state.activeTool === 'eraser' ? 'cursor' : 'eraser');
        break;

      // Stroke thickness adjustment shortcuts ([ to shrink, ] to enlarge)
      case '[':
        if (state.activeTool === 'pen') {
          e.preventDefault();
          presentation.setPenWidth(state.penWidth - 1);
        } else if (state.activeTool === 'highlighter') {
          e.preventDefault();
          presentation.setHighlighterWidth(state.highlighterWidth - 2);
        }
        break;

      case ']':
        if (state.activeTool === 'pen') {
          e.preventDefault();
          presentation.setPenWidth(state.penWidth + 1);
        } else if (state.activeTool === 'highlighter') {
          e.preventDefault();
          presentation.setHighlighterWidth(state.highlighterWidth + 2);
        }
        break;

      // Grid / Thumbnails Overview
      case 'g':
      case 'G':
        e.preventDefault();
        presentation.toggleThumbnails();
        break;

      // Notes Drawer
      case 'n':
      case 'N':
        e.preventDefault();
        presentation.toggleNotesDrawer();
        break;
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}
