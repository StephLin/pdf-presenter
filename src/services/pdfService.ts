import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker in Vite offline bundle
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export interface PageRenderResult {
  renderedWidth: number;
  renderedHeight: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
}

class PdfService {
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
  private currentRenderTask: any = null;
  private thumbnailCache: Map<number, string> = new Map();

  async loadPdf(data: Uint8Array | ArrayBuffer): Promise<number> {
    this.thumbnailCache.clear();
    if (this.loadingTask) {
      try {
        await this.loadingTask.destroy();
      } catch (err) {
        console.warn('Error destroying existing PDF document loading task:', err);
      }
      this.loadingTask = null;
    }

    this.loadingTask = pdfjsLib.getDocument({
      data,
      cMapUrl: undefined,
      cMapPacked: true,
    });

    this.pdfDoc = await this.loadingTask.promise;
    return this.pdfDoc.numPages;
  }

  getNumPages(): number {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  async renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    viewportContainerWidth: number,
    viewportContainerHeight: number,
    fitMode: 'contain' | 'fit-width' | 'fit-height' = 'contain',
    zoomMultiplier: number = 1.0
  ): Promise<PageRenderResult | null> {
    if (!this.pdfDoc) return null;
    if (pageNumber < 1 || pageNumber > this.pdfDoc.numPages) return null;

    if (this.currentRenderTask) {
      try {
        await this.currentRenderTask.cancel();
      } catch {
        // cancellation is normal
      }
      this.currentRenderTask = null;
    }

    const page = await this.pdfDoc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });

    let scale = 1;
    const padding = 16;
    const availWidth = Math.max(100, viewportContainerWidth - padding);
    const availHeight = Math.max(100, viewportContainerHeight - padding);

    const scaleX = availWidth / unscaledViewport.width;
    const scaleY = availHeight / unscaledViewport.height;

    if (fitMode === 'contain') {
      scale = Math.min(scaleX, scaleY);
    } else if (fitMode === 'fit-width') {
      scale = scaleX;
    } else {
      scale = scaleY;
    }

    // High-DPI and Native Vector Zoom:
    // When zoomed in, render the canvas backing buffer at (scale * zoomMultiplier * dpr)
    // so that the PDF vector fonts, formulas and lines are 100% crisp at any zoom level!
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const renderScale = scale * zoomMultiplier * dpr;
    const viewport = page.getViewport({ scale: renderScale });

    const cssWidth = Math.floor(unscaledViewport.width * scale);
    const cssHeight = Math.floor(unscaledViewport.height * scale);

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const renderContext: Parameters<pdfjsLib.PDFPageProxy['render']>[0] = {
      canvas: canvas,
      canvasContext: ctx,
      viewport: viewport,
      intent: 'display',
    };

    try {
      this.currentRenderTask = page.render(renderContext);
      await this.currentRenderTask.promise;
      this.currentRenderTask = null;

      return {
        renderedWidth: cssWidth,
        renderedHeight: cssHeight,
        scale,
        pageWidth: unscaledViewport.width,
        pageHeight: unscaledViewport.height,
      };
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') {
        return null;
      }
      console.error('PDF rendering error:', err);
      throw err;
    }
  }

  async getThumbnail(pageNumber: number, maxWidth = 180): Promise<string> {
    if (this.thumbnailCache.has(pageNumber)) {
      return this.thumbnailCache.get(pageNumber)!;
    }

    if (!this.pdfDoc) return '';
    const page = await this.pdfDoc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = viewport.width;
    thumbCanvas.height = viewport.height;

    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return '';

    const renderContext: Parameters<pdfjsLib.PDFPageProxy['render']>[0] = {
      canvas: thumbCanvas,
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);
    this.thumbnailCache.set(pageNumber, dataUrl);
    return dataUrl;
  }
}

export const pdfService = new PdfService();
