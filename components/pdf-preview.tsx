'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Button } from '@/components/ui/button';

export function PdfPreview({ blob }: { blob: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let task:
      | ReturnType<(typeof import('pdfjs-dist'))['getDocument']>
      | undefined;
    void (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
      ]);
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const data = await blob.arrayBuffer();
      if (cancelled) return;
      task = pdfjs.getDocument({ data });
      const document = await task.promise;
      if (!cancelled) setPdf(document);
    })().catch(() => {
      if (!cancelled) setError('未能顯示預覽，請下載 PDF 檢查。');
    });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [blob]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    setBusy(true);
    void (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(2, 1500 / base.width),
      });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      render = page.render({ canvas, viewport });
      await render.promise;
      if (!cancelled) setBusy(false);
    })().catch(() => {
      if (!cancelled) {
        setError('未能顯示此頁，請下載 PDF 檢查。');
        setBusy(false);
      }
    });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [pdf, pageNumber]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-4">
        <Button
          variant="outline"
          disabled={!pdf || pageNumber <= 1 || busy}
          onClick={() => setPageNumber((n) => n - 1)}
        >
          上一頁
        </Button>
        <span className="text-sm" aria-live="polite">
          {pdf ? `${pageNumber} / ${pdf.numPages}` : '載入中…'}
        </span>
        <Button
          variant="outline"
          disabled={!pdf || pageNumber >= pdf.numPages || busy}
          onClick={() => setPageNumber((n) => n + 1)}
        >
          下一頁
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div
        className="max-h-[60vh] overflow-auto rounded border bg-white"
        aria-busy={busy}
      >
        <canvas
          ref={canvasRef}
          className="h-auto w-full"
          role="img"
          aria-label={`PDF 第 ${pageNumber} 頁`}
        />
      </div>
    </div>
  );
}
