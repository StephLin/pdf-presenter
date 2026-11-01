export type PresentationMode = 'normal' | 'presentation';

export type PointerTool = 
  | 'cursor'      // Normal cursor
  | 'laser'       // Laser pointer (glowing dot + pulse on click)
  | 'pen'         // Freehand ink drawing
  | 'highlighter' // Semi-transparent marker
  | 'eraser';     // Stroke eraser

export type LaserColor = 'red' | 'green' | 'blue';

export interface Point {
  x: number; // 0..1 relative to slide dimensions
  y: number; // 0..1 relative to slide dimensions
}

export interface DrawingStroke {
  id: string;
  tool: 'pen' | 'highlighter';
  color: string;
  width: number;
  opacity: number;
  points: Point[];
}

export interface PageAnnotations {
  pageNumber: number;
  strokes: DrawingStroke[];
  presenterNotes: string; // Markdown notes for this slide (presenter view)
}

export interface PresentationState {
  currentPdfName: string;
  currentPdfPath: string | null;
  numPages: number;
  currentPage: number;
  mode: PresentationMode;
  activeTool: PointerTool;
  laserColor: LaserColor;
  laserSize: number;
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  highlighterWidth: number;
  blackScreen: boolean;
  whiteScreen: boolean;
  showThumbnails: boolean;
  showNotesDrawer: boolean;
  notesWindowMode: 'popup' | 'drawer';
  showExportModal: boolean;
  fitMode: 'contain' | 'fit-width' | 'fit-height';
  zoomScale: number;
  panX: number;
  panY: number;
}
