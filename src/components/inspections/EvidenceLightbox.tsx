'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { MonitoringEvidence } from '@/lib/inspections-api';
import { ApiError } from '@/lib/http';
import {
  evidenceItemTitle,
  evidenceSectionTitle,
  isSupportedEvidenceImage,
} from '@/lib/evidence-gallery';
import { acquireEvidenceObjectUrl, releaseEvidenceObjectUrl } from '@/lib/evidence-blob-cache';
import { formatDateTime } from '@/lib/inspection-display';

export function EvidenceLightbox({
  inspectionId,
  evidences,
  activeId,
  onClose,
  onChangeActive,
}: {
  inspectionId: string;
  evidences: MonitoringEvidence[];
  activeId: string;
  onClose: () => void;
  onChangeActive: (id: string) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const index = Math.max(0, evidences.findIndex((e) => e.id === activeId));
  const evidence = evidences[index] ?? evidences[0];
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading');
  const [errorMessage, setErrorMessage] = useState('Não foi possível carregar a imagem.');
  const [retryToken, setRetryToken] = useState(0);
  const [scale, setScale] = useState(1);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canPrev = index > 0;
  const canNext = index < evidences.length - 1;

  const goPrev = useCallback(() => {
    if (!canPrev) return;
    onChangeActive(evidences[index - 1].id);
  }, [canPrev, evidences, index, onChangeActive]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    onChangeActive(evidences[index + 1].id);
  }, [canNext, evidences, index, onChangeActive]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [activeId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    setScale(1);
    if (!evidence) return;
    if (!isSupportedEvidenceImage(evidence.contentType)) {
      setStatus('unsupported');
      setUrl(null);
      return;
    }
    let active = true;
    setStatus('loading');
    setUrl(null);
    setErrorMessage('Não foi possível carregar a imagem.');
    void acquireEvidenceObjectUrl(inspectionId, evidence.id)
      .then((objectUrl) => {
        if (!active) {
          releaseEvidenceObjectUrl(inspectionId, evidence.id);
          return;
        }
        setUrl(objectUrl);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) {
          setErrorMessage('Evidência não encontrada.');
        } else if (error instanceof ApiError && error.status === 403) {
          setErrorMessage('Seu perfil não pode ver as evidências.');
        } else {
          setErrorMessage('Não foi possível carregar a imagem.');
        }
        setStatus('error');
      });
    return () => {
      active = false;
      releaseEvidenceObjectUrl(inspectionId, evidence.id);
    };
  }, [inspectionId, evidence, retryToken]);

  if (!evidence) return null;

  const title = evidenceItemTitle(evidence);
  const section = evidenceSectionTitle(evidence);
  const kilobytes = Math.max(1, Math.round(evidence.sizeBytes / 1024));

  return (
    <div
      className={`fixed inset-0 z-50 bg-navy-900/80 flex flex-col ${reducedMotion ? '' : 'animate-[fadeIn_200ms_ease-out]'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Evidência"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <h2 id={titleId} className="font-extrabold text-white truncate">
            {title}
          </h2>
          <p className="text-sm text-slate-200 truncate">
            {section} · {evidence.fileName} · {kilobytes} KB · {formatDateTime(evidence.createdAt)}
          </p>
          {evidences.length >= 2 ? (
            <p className="text-xs text-slate-300 mt-1">
              {index + 1} de {evidences.length}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, s + 1))}
            className="text-xs font-bold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
            aria-label="Aumentar"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(1, s - 1))}
            className="text-xs font-bold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
            aria-label="Reduzir"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setScale(1)}
            className="text-xs font-bold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
          >
            Ajustar
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="text-sm font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
          >
            Fechar
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center gap-3 px-4 pb-6 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {evidences.length >= 2 ? (
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Anterior"
            className="shrink-0 text-white text-2xl font-bold px-3 py-2 rounded-xl bg-white/10 disabled:opacity-30"
          >
            ‹
          </button>
        ) : null}

        <div className="relative flex-1 max-w-[90vw] max-h-[90vh] flex items-center justify-center overflow-auto">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 text-slate-200 text-sm">
              <span className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
              Carregando imagem...
            </div>
          )}
          {status === 'unsupported' && (
            <p className="text-sm text-slate-200 text-center">
              Formato não suportado para visualização.
              <br />
              {evidence.fileName}
            </p>
          )}
          {status === 'error' && (
            <div className="text-center text-slate-200">
              <p className="text-sm font-semibold">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setRetryToken((n) => n + 1)}
                className="mt-3 text-sm font-bold underline"
              >
                Tentar novamente
              </button>
            </div>
          )}
          {status === 'ready' && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              className="object-contain max-h-[90vh] max-w-[90vw]"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                transition: reducedMotion ? undefined : 'transform 150ms ease-out',
              }}
            />
          ) : null}
        </div>

        {evidences.length >= 2 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            aria-label="Próxima"
            className="shrink-0 text-white text-2xl font-bold px-3 py-2 rounded-xl bg-white/10 disabled:opacity-30"
          >
            ›
          </button>
        ) : null}
      </div>
    </div>
  );
}
