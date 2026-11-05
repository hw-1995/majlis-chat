import type { Embedder } from './types';

/**
 * A multilingual embedding model running in the visitor's browser.
 *
 * Transformers.js runs ONNX models with WebAssembly, so semantic search needs
 * no server and no API key — which keeps the demo deployable as static files.
 * The cost is a one-off download (~120 MB for the quantised model, then cached
 * by the browser), so it is opt-in rather than on by default.
 *
 * The library is loaded from a CDN at runtime instead of being bundled: it is
 * large, most visitors never turn semantic search on, and bundling it would
 * slow every first visit to pay for a feature few use. Both the library and
 * the model have a second source, because the default hosts are not reliably
 * reachable everywhere (huggingface.co from mainland China, for one).
 */

export const MODEL_ID = 'Xenova/multilingual-e5-small';

const LIBRARY_URLS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm',
  'https://esm.sh/@huggingface/transformers@3.8.1',
];
const MODEL_HOSTS = ['https://huggingface.co/', 'https://hf-mirror.com/'];

export interface LoadProgress {
  /** 0–100 across all model files, when the host reports sizes. */
  percent: number;
}

interface TransformersModule {
  env: { remoteHost: string; allowLocalModels: boolean };
  pipeline: (
    task: 'feature-extraction',
    model: string,
    options: { dtype: string; progress_callback?: (event: ProgressEvent) => void },
  ) => Promise<FeatureExtractor>;
}

type FeatureExtractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

interface ProgressEvent {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

async function importLibrary(): Promise<TransformersModule> {
  let lastError: unknown;
  for (const url of LIBRARY_URLS) {
    try {
      return (await import(/* @vite-ignore */ url)) as TransformersModule;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not load the embedding library');
}

export async function loadBrowserEmbedder(onProgress?: (p: LoadProgress) => void): Promise<Embedder> {
  const lib = await importLibrary();
  lib.env.allowLocalModels = false;

  // Track bytes per file so the bar reflects the whole download, not just
  // whichever file reported last.
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (event: ProgressEvent): void => {
    if (event.status !== 'progress' || !event.file || !event.total) return;
    files.set(event.file, { loaded: event.loaded ?? 0, total: event.total });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    onProgress?.({ percent: total > 0 ? Math.round((loaded / total) * 100) : 0 });
  };

  let extractor: FeatureExtractor | null = null;
  let lastError: unknown;
  for (const host of MODEL_HOSTS) {
    try {
      lib.env.remoteHost = host;
      extractor = await lib.pipeline('feature-extraction', MODEL_ID, { dtype: 'q8', progress_callback });
      break;
    } catch (error) {
      lastError = error;
      files.clear();
    }
  }
  if (!extractor) throw lastError instanceof Error ? lastError : new Error('Could not load the model');

  const run = extractor;
  return {
    id: MODEL_ID,
    async embed(texts, kind) {
      const prefixed = texts.map((t) => `${kind}: ${t}`);
      const output = await run(prefixed, { pooling: 'mean', normalize: true });
      return output.tolist().map((row) => Float32Array.from(row));
    },
  };
}
