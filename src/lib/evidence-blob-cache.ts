/**
 * Cache de object URLs de evidências + limite de concorrência nos fetches.
 */

import { fetchEvidenceContent } from './inspections-api';

const MAX_CONCURRENT = 4;
let active = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  active += 1;
}

function releaseSlot(): void {
  active = Math.max(0, active - 1);
  const next = waitQueue.shift();
  if (next) next();
}

type CacheEntry = { url: string; refs: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

function cacheKey(inspectionId: string, evidenceId: string): string {
  return `${inspectionId}:${evidenceId}`;
}

export async function acquireEvidenceObjectUrl(inspectionId: string, evidenceId: string): Promise<string> {
  const key = cacheKey(inspectionId, evidenceId);
  const existing = cache.get(key);
  if (existing) {
    existing.refs += 1;
    return existing.url;
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      await acquireSlot();
      try {
        const blob = await fetchEvidenceContent(inspectionId, evidenceId);
        const url = URL.createObjectURL(blob);
        cache.set(key, { url, refs: 0 });
        return url;
      } finally {
        releaseSlot();
        inflight.delete(key);
      }
    })();
    inflight.set(key, pending);
  }

  const url = await pending;
  const entry = cache.get(key);
  if (entry) entry.refs += 1;
  return url;
}

export function releaseEvidenceObjectUrl(inspectionId: string, evidenceId: string): void {
  const key = cacheKey(inspectionId, evidenceId);
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    URL.revokeObjectURL(entry.url);
    cache.delete(key);
  }
}

/** Revoga tudo (ex.: unmount do provider). */
export function clearEvidenceObjectUrlCache(): void {
  for (const entry of cache.values()) {
    URL.revokeObjectURL(entry.url);
  }
  cache.clear();
}
