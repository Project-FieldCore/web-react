'use client';

import { useEffect, useState } from 'react';
import type { MonitoringEvidence } from '@/lib/inspections-api';
import { evidenceItemTitle, isSupportedEvidenceImage } from '@/lib/evidence-gallery';
import { acquireEvidenceObjectUrl, releaseEvidenceObjectUrl } from '@/lib/evidence-blob-cache';

type ThumbStatus = 'loading' | 'ready' | 'error' | 'unsupported';

export function EvidenceThumbnail({
  inspectionId,
  evidence,
  size = 'gallery',
  onOpen,
}: {
  inspectionId: string;
  evidence: MonitoringEvidence;
  size?: 'gallery' | 'mini';
  onOpen: () => void;
}) {
  const [status, setStatus] = useState<ThumbStatus>(() =>
    isSupportedEvidenceImage(evidence.contentType) ? 'loading' : 'unsupported'
  );
  const [url, setUrl] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const title = evidenceItemTitle(evidence);
  const frameClass =
    size === 'mini'
      ? 'h-14 w-14 rounded-lg'
      : 'aspect-square w-full rounded-xl';

  useEffect(() => {
    if (!isSupportedEvidenceImage(evidence.contentType)) {
      setStatus('unsupported');
      setUrl(null);
      return;
    }
    let active = true;
    setStatus('loading');
    setUrl(null);
    void acquireEvidenceObjectUrl(inspectionId, evidence.id)
      .then((objectUrl) => {
        if (!active) {
          releaseEvidenceObjectUrl(inspectionId, evidence.id);
          return;
        }
        setUrl(objectUrl);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });
    return () => {
      active = false;
      releaseEvidenceObjectUrl(inspectionId, evidence.id);
    };
  }, [inspectionId, evidence.id, evidence.contentType, retryToken]);

  function handleActivate() {
    if (status === 'error') {
      setRetryToken((n) => n + 1);
      return;
    }
    onOpen();
  }

  return (
    <button
      type="button"
      onClick={handleActivate}
      aria-label={`Ampliar evidência de ${title}`}
      className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-2 rounded-xl"
    >
      <div className={`${frameClass} border border-slate-200 bg-slate-100 overflow-hidden relative`}>
        {status === 'loading' && (
          <span
            className="absolute inset-0 animate-pulse bg-slate-200"
            aria-hidden="true"
          />
        )}
        {status === 'ready' && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : null}
        {status === 'error' && (
          <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] font-semibold text-red-600">
            Falha ao carregar
          </span>
        )}
        {status === 'unsupported' && (
          <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] font-semibold text-slate-500">
            Formato não suportado
          </span>
        )}
      </div>
      {size === 'gallery' ? (
        <div className="mt-2 min-w-0">
          <div className="text-sm font-semibold text-navy-900 line-clamp-2">{title}</div>
          <div className="text-xs text-slate-500 truncate">{evidence.fileName}</div>
        </div>
      ) : null}
    </button>
  );
}
