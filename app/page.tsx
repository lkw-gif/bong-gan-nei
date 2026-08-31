'use client';

import { useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  Download,
  FileArchive,
  FileImage,
  FileText,
  Info,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';

type ToolMode = 'compress' | 'convert';
type PresetKey = 'clear' | 'balanced' | 'smallest';
type FileStatus = 'ready' | 'processing' | 'done' | 'error';

type QueueItem = {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  output?: Blob;
  outputName?: string;
  outputSize?: number;
  error?: string;
  note?: string;
};

const presets = {
  clear: {
    name: '清晰優先',
    description: '適合相片、履歷及需保留細節的 PDF',
    imageQuality: 0.88,
    pdfQuality: 0.86,
    pdfScale: 1.55,
  },
  balanced: {
    name: '平衡',
    description: '容量和畫質之間最實用的選擇',
    imageQuality: 0.74,
    pdfQuality: 0.72,
    pdfScale: 1.25,
  },
  smallest: {
    name: '最細容量',
    description: '適合 WhatsApp、電郵附件及快速分享',
    imageQuality: 0.54,
    pdfQuality: 0.55,
    pdfScale: 0.95,
  },
} satisfies Record<
  PresetKey,
  {
    name: string;
    description: string;
    imageQuality: number;
    pdfQuality: number;
    pdfScale: number;
  }
>;

const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function nameWithoutExtension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function isJpegFile(file: File) {
  const extension = extensionOf(file.name);
  return (
    file.type === 'image/jpeg' || extension === 'jpg' || extension === 'jpeg'
  );
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || extensionOf(file.name) === 'pdf';
}

function makeId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('未能輸出圖片'))),
      type,
      quality,
    );
  });
}

async function compressImage(
  file: File,
  preset: (typeof presets)[PresetKey],
  maxLongEdge: number,
) {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale =
    maxLongEdge > 0 && longest > maxLongEdge ? maxLongEdge / longest : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', {
    alpha: file.type !== 'image/jpeg',
  });

  if (!context) {
    bitmap.close();
    throw new Error('你的瀏覽器未能處理這張圖片');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const inputExtension = extensionOf(file.name);
  const outputType = file.type === 'image/png' ? 'image/webp' : file.type;
  const safeType = outputType === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const outputExtension =
    safeType === 'image/webp'
      ? 'webp'
      : inputExtension === 'jpeg'
        ? 'jpeg'
        : 'jpg';
  const compressed = await canvasToBlob(canvas, safeType, preset.imageQuality);
  canvas.width = 1;
  canvas.height = 1;

  if (compressed.size >= file.size && scale === 1) {
    return {
      blob: file,
      name: `${nameWithoutExtension(file.name)}-已最佳化.${inputExtension || outputExtension}`,
      note: '原檔已經較細，已保留原有資料避免容量變大。',
    };
  }

  return {
    blob: compressed,
    name: `${nameWithoutExtension(file.name)}-壓縮.${outputExtension}`,
    note:
      file.type === 'image/png'
        ? '已轉為 WebP，在保留透明背景的同時縮小容量。'
        : undefined,
  };
}

async function compressPdf(
  file: File,
  preset: (typeof presets)[PresetKey],
  onProgress: (progress: number) => void,
) {
  const [pdfjs, workerModule, jspdf] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    import('jspdf'),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  const source = await file.arrayBuffer();
  const documentTask = pdfjs.getDocument({ data: source });
  const pdf = await documentTask.promise;
  let output: InstanceType<typeof jspdf.jsPDF> | undefined;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: preset.pdfScale });
    const width = Math.max(1, Math.round(viewport.width));
    const height = Math.max(1, Math.round(viewport.height));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) throw new Error('你的瀏覽器未能處理這份 PDF');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const orientation = width > height ? 'landscape' : 'portrait';
    if (!output) {
      output = new jspdf.jsPDF({
        unit: 'px',
        format: [width, height],
        orientation,
        compress: true,
        hotfixes: ['px_scaling'],
      });
    } else {
      output.addPage([width, height], orientation);
    }

    const pageImage = canvas.toDataURL('image/jpeg', preset.pdfQuality);
    output.addImage(pageImage, 'JPEG', 0, 0, width, height, undefined, 'FAST');
    canvas.width = 1;
    canvas.height = 1;
    page.cleanup();
    onProgress(Math.round((pageNumber / pdf.numPages) * 100));
  }

  await pdf.destroy();
  if (!output) throw new Error('這份 PDF 沒有可處理的頁面');
  const compressed = output.output('blob');

  if (compressed.size >= file.size) {
    return {
      blob: file,
      name: `${nameWithoutExtension(file.name)}-已最佳化.pdf`,
      note: '原 PDF 已經較細，已保留原檔避免容量變大。',
    };
  }

  return {
    blob: compressed,
    name: `${nameWithoutExtension(file.name)}-壓縮.pdf`,
    note: '頁面已重新渲染；文字搜尋、表格選取及連結可能不再保留。',
  };
}

function FileTypeIcon({ file }: { file: File }) {
  if (isPdfFile(file)) return <FileText aria-hidden="true" />;
  return <FileImage aria-hidden="true" />;
}

export default function Home() {
  const [mode, setMode] = useState<ToolMode>('compress');
  const [preset, setPreset] = useState<PresetKey>('balanced');
  const [maxLongEdge, setMaxLongEdge] = useState('1920');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readyCount = queue.filter((item) => item.status === 'ready').length;
  const doneItems = queue.filter(
    (item): item is QueueItem & { output: Blob; outputName: string } =>
      item.status === 'done' && Boolean(item.output && item.outputName),
  );

  function changeMode(nextMode: ToolMode) {
    setMode(nextMode);
    setQueue([]);
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    const accepted = incoming.filter((file) => {
      if (mode === 'convert') return isJpegFile(file);
      return isPdfFile(file) || supportedImageTypes.has(file.type);
    });

    setQueue((current) => {
      const signatures = new Set(
        current.map(
          (item) =>
            `${item.file.name}-${item.file.size}-${item.file.lastModified}`,
        ),
      );
      const fresh = accepted
        .filter(
          (file) =>
            !signatures.has(`${file.name}-${file.size}-${file.lastModified}`),
        )
        .map((file) => ({
          id: makeId(file),
          file,
          status: 'ready' as const,
          progress: 0,
        }));
      return [...current, ...fresh];
    });
  }

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function processItem(item: QueueItem) {
    updateItem(item.id, {
      status: 'processing',
      progress: 8,
      error: undefined,
    });

    try {
      if (mode === 'convert') {
        const currentExtension = extensionOf(item.file.name);
        const outputExtension = currentExtension === 'jpeg' ? 'jpg' : 'jpeg';
        updateItem(item.id, {
          status: 'done',
          progress: 100,
          output: item.file,
          outputName: `${nameWithoutExtension(item.file.name)}.${outputExtension}`,
          outputSize: item.file.size,
          note: 'JPEG 和 JPG 是同一種格式，只更改副檔名，不會重新壓縮或降低畫質。',
        });
        return;
      }

      const selectedPreset = presets[preset];
      const result = isPdfFile(item.file)
        ? await compressPdf(item.file, selectedPreset, (progress) =>
            updateItem(item.id, { progress }),
          )
        : await compressImage(item.file, selectedPreset, Number(maxLongEdge));

      updateItem(item.id, {
        status: 'done',
        progress: 100,
        output: result.blob,
        outputName: result.name,
        outputSize: result.blob.size,
        note: result.note,
      });
    } catch (error) {
      updateItem(item.id, {
        status: 'error',
        progress: 0,
        error:
          error instanceof Error ? error.message : '處理失敗，請再試一次。',
      });
    }
  }

  async function processAll() {
    const pending = queue.filter(
      (item) => item.status === 'ready' || item.status === 'error',
    );
    for (const item of pending) await processItem(item);
  }

  function download(item: QueueItem & { output: Blob; outputName: string }) {
    const url = URL.createObjectURL(item.output);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = item.outputName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadAll() {
    doneItems.forEach((item, index) => {
      window.setTimeout(() => download(item), index * 180);
    });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-[color:var(--line)] bg-[color:var(--paper)]/95">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a
            href="#top"
            className="flex items-center gap-3"
            aria-label="壓細啲首頁"
          >
            <span className="logo-mark">
              <ArrowDownToLine className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[17px] font-bold leading-none tracking-tight">
                壓細啲
              </span>
              <span className="mt-1 block text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                File compressor
              </span>
            </span>
          </a>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <LockKeyhole
              className="size-4 text-[color:var(--brand)]"
              aria-hidden="true"
            />
            檔案只在你的瀏覽器處理
          </div>
          <Badge className="border-[color:var(--brand)]/20 bg-[color:var(--mint)] text-[color:var(--brand-deep)] sm:hidden">
            私隱優先
          </Badge>
        </div>
      </header>

      <section
        id="top"
        className="mx-auto max-w-7xl px-5 pb-14 pt-9 sm:px-8 sm:pt-12"
      >
        <div className="mb-8 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="bg-[color:var(--lime)] text-[color:var(--brand-deep)]">
                <Sparkles data-icon="inline-start" /> 免費・免上傳
              </Badge>
              <span className="text-xs font-medium text-muted-foreground">
                PDF · JPEG · JPG · PNG · WebP
              </span>
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-[58px] lg:leading-[1.02]">
              檔案細一截，
              <span className="text-[color:var(--brand)]">傳送快好多。</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              壓縮相片和 PDF，或者在 .jpeg 與 .jpg
              之間無損互換。全部在你的裝置內完成，檔案不會離開瀏覽器。
            </p>
          </div>
          <div className="hidden gap-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-6 py-4 lg:flex">
            <div>
              <p className="text-2xl font-bold tracking-tight">100%</p>
              <p className="text-xs text-muted-foreground">本機處理</p>
            </div>
            <div className="w-px bg-[color:var(--line)]" />
            <div>
              <p className="text-2xl font-bold tracking-tight">0</p>
              <p className="text-xs text-muted-foreground">檔案上傳</p>
            </div>
          </div>
        </div>

        <div className="tool-shell">
          <div className="border-b border-[color:var(--line)] px-4 pt-4 sm:px-6">
            <div className="mode-switch" role="tablist" aria-label="選擇工具">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'compress'}
                className={mode === 'compress' ? 'active' : ''}
                onClick={() => changeMode('compress')}
              >
                <FileArchive aria-hidden="true" /> 壓縮檔案
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'convert'}
                className={mode === 'convert' ? 'active' : ''}
                onClick={() => changeMode('convert')}
              >
                <RefreshCw aria-hidden="true" /> JPEG ↔ JPG
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="border-b border-[color:var(--line)] bg-[color:var(--panel)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="mb-6">
                <p className="eyebrow">01 / 設定</p>
                <h2 className="mt-2 text-xl font-bold tracking-tight">
                  {mode === 'compress' ? '選擇壓縮程度' : '無損更改副檔名'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {mode === 'compress'
                    ? '先選取畫質與容量的平衡，完成後可逐個下載。'
                    : 'JPEG 與 JPG 格式完全相同，所以不用重新編碼。'}
                </p>
              </div>

              {mode === 'compress' ? (
                <>
                  <div
                    className="space-y-2"
                    role="radiogroup"
                    aria-label="壓縮程度"
                  >
                    {(Object.keys(presets) as PresetKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={preset === key}
                        className={`preset-option ${preset === key ? 'selected' : ''}`}
                        onClick={() => setPreset(key)}
                      >
                        <span className="preset-dot">
                          {preset === key && <Check />}
                        </span>
                        <span className="min-w-0 text-left">
                          <span className="block font-semibold">
                            {presets[key].name}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            {presets[key].description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 border-t border-[color:var(--line)] pt-5">
                    <label
                      htmlFor="max-edge"
                      className="mb-2 block text-sm font-semibold"
                    >
                      圖片最長邊
                    </label>
                    <NativeSelect className="w-full">
                      <select
                        id="max-edge"
                        value={maxLongEdge}
                        onChange={(event) => setMaxLongEdge(event.target.value)}
                      >
                        <NativeSelectOption value="0">
                          保留原尺寸
                        </NativeSelectOption>
                        <NativeSelectOption value="2560">
                          最多 2560 px
                        </NativeSelectOption>
                        <NativeSelectOption value="1920">
                          最多 1920 px（建議）
                        </NativeSelectOption>
                        <NativeSelectOption value="1280">
                          最多 1280 px
                        </NativeSelectOption>
                      </select>
                    </NativeSelect>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      只影響圖片；PDF 會按所選壓縮程度處理。
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[color:var(--brand)]/15 bg-[color:var(--mint)]/45 p-4">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[color:var(--brand)] text-white">
                    <RefreshCw className="size-5" aria-hidden="true" />
                  </div>
                  <p className="font-semibold">.jpeg → .jpg</p>
                  <p className="my-1 text-center text-xs font-bold text-[color:var(--brand)]">
                    或
                  </p>
                  <p className="font-semibold">.jpg → .jpeg</p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    只會改檔名結尾，檔案內容、畫質和容量都不變。
                  </p>
                </div>
              )}

              <div className="mt-6 flex items-start gap-3 rounded-xl bg-[color:var(--paper)] p-3.5 text-xs leading-5 text-muted-foreground ring-1 ring-[color:var(--line)]">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-[color:var(--brand)]"
                  aria-hidden="true"
                />
                不用登入，不會儲存檔案。關閉頁面後，所有處理結果即會消失。
              </div>
            </aside>

            <div className="p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">02 / 加入檔案</p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight">
                    {mode === 'compress'
                      ? '拖放檔案到這裡'
                      : '加入 JPEG 或 JPG'}
                  </h2>
                </div>
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQueue([])}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" /> 清除全部
                  </button>
                )}
              </div>

              <div
                className={`drop-zone ${dragging ? 'dragging' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget === event.target) setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  addFiles(event.dataTransfer.files);
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="sr-only"
                  multiple
                  accept={
                    mode === 'compress'
                      ? '.pdf,.jpeg,.jpg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp'
                      : '.jpeg,.jpg,image/jpeg'
                  }
                  onChange={(event) => {
                    if (event.target.files) addFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
                <div className="upload-icon">
                  <UploadCloud aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-bold">
                  {dragging ? '放手加入檔案' : '將檔案拖到這裡'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">或者</p>
                <Button
                  size="lg"
                  className="mt-4 h-11 rounded-xl bg-[color:var(--brand)] px-5 text-white hover:bg-[color:var(--brand-deep)]"
                  onClick={() => inputRef.current?.click()}
                >
                  選擇檔案 <ChevronRight data-icon="inline-end" />
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">
                  {mode === 'compress'
                    ? '支援 PDF、JPEG、JPG、PNG、WebP・可一次加入多個檔案'
                    : '支援 .jpeg 及 .jpg・不會改動畫質或內容'}
                </p>
              </div>

              {queue.length > 0 && (
                <div className="mt-6" aria-live="polite">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold">
                      待處理檔案{' '}
                      <span className="font-normal text-muted-foreground">
                        ({queue.length})
                      </span>
                    </p>
                    {doneItems.length > 1 && (
                      <Button variant="outline" size="sm" onClick={downloadAll}>
                        <Download data-icon="inline-start" /> 下載全部
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {queue.map((item) => {
                      const saving = item.outputSize
                        ? Math.max(
                            0,
                            Math.round(
                              (1 - item.outputSize / item.file.size) * 100,
                            ),
                          )
                        : 0;
                      return (
                        <div key={item.id} className="file-row">
                          <div className="file-icon">
                            <FileTypeIcon file={item.file} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold">
                                {item.file.name}
                              </p>
                              {item.status === 'done' &&
                                mode === 'compress' &&
                                saving > 0 && (
                                  <Badge className="shrink-0 bg-[color:var(--mint)] text-[color:var(--brand-deep)]">
                                    細咗 {saving}%
                                  </Badge>
                                )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                              <span>{formatBytes(item.file.size)}</span>
                              {item.outputSize !== undefined && (
                                <>
                                  <span>→</span>
                                  <span className="font-semibold text-foreground">
                                    {formatBytes(item.outputSize)}
                                  </span>
                                </>
                              )}
                              {item.error && (
                                <span className="text-destructive">
                                  {item.error}
                                </span>
                              )}
                            </div>
                            {item.status === 'processing' && (
                              <Progress
                                value={item.progress}
                                className="mt-2 max-w-sm"
                              />
                            )}
                            {item.note && (
                              <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                                {item.note}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {item.status === 'processing' && (
                              <LoaderCircle
                                className="size-4 animate-spin text-[color:var(--brand)]"
                                aria-label="處理中"
                              />
                            )}
                            {item.status === 'done' &&
                              item.output &&
                              item.outputName && (
                                <Button
                                  size="sm"
                                  className="bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-deep)]"
                                  onClick={() =>
                                    download(
                                      item as QueueItem & {
                                        output: Blob;
                                        outputName: string;
                                      },
                                    )
                                  }
                                >
                                  <Download data-icon="inline-start" />{' '}
                                  <span className="hidden sm:inline">下載</span>
                                </Button>
                              )}
                            {item.status !== 'processing' && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`移除 ${item.file.name}`}
                                onClick={() =>
                                  setQueue((current) =>
                                    current.filter(
                                      (entry) => entry.id !== item.id,
                                    ),
                                  )
                                }
                              >
                                <X />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {readyCount > 0 && (
                    <Button
                      size="lg"
                      onClick={processAll}
                      className="mt-5 h-12 w-full rounded-xl bg-[color:var(--brand)] text-base font-bold text-white shadow-[0_8px_24px_rgba(7,91,80,0.18)] hover:bg-[color:var(--brand-deep)]"
                    >
                      {mode === 'compress'
                        ? `開始壓縮 ${readyCount} 個檔案`
                        : `轉換 ${readyCount} 個檔案`}{' '}
                      <ArrowDownToLine data-icon="inline-end" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>關於 PDF：</strong>
            壓縮時會把每頁重新渲染成圖片，因此文字搜尋、複製、表格選取及可點擊連結可能不再保留。重要文件請保留原檔。
          </p>
        </div>
      </section>

      <footer className="border-t border-[color:var(--line)] bg-[color:var(--paper)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>壓細啲・簡單、私隱、即用。</p>
          <p>處理效果會因檔案內容及原本壓縮程度而異。</p>
        </div>
      </footer>
    </main>
  );
}
