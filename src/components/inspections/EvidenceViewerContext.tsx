'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchInspectionMonitoring,
  type InspectionMonitoring as Monitoring,
  type MonitoringEvidence,
} from '@/lib/inspections-api';
import { ApiError } from '@/lib/http';
import { sortEvidences } from '@/lib/evidence-gallery';
import { clearEvidenceObjectUrlCache } from '@/lib/evidence-blob-cache';
import { EvidenceLightbox } from './EvidenceLightbox';

type MonitoringStatus = 'loading' | 'ready' | 'error';

interface EvidenceViewerValue {
  inspectionId: string;
  monitoring: Monitoring | null;
  sortedEvidences: MonitoringEvidence[];
  status: MonitoringStatus;
  errorTitle: string | null;
  errorMessage: string | null;
  canRetry: boolean;
  reload: () => void;
  openEvidence: (evidenceId: string) => void;
}

const EvidenceViewerContext = createContext<EvidenceViewerValue | null>(null);

export function useEvidenceViewer(): EvidenceViewerValue | null {
  return useContext(EvidenceViewerContext);
}

function monitoringErrorCopy(error: unknown): { title: string; message: string; retry: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return {
        title: 'Acesso não autorizado',
        message: 'Seu perfil não pode ver as evidências.',
        retry: false,
      };
    }
    if (error.status === 404) {
      return {
        title: 'Inspeção não encontrada',
        message: 'Ela pode ter sido removida ou o link está incorreto.',
        retry: false,
      };
    }
    return {
      title: 'Não foi possível carregar as evidências',
      message: error.message,
      retry: true,
    };
  }
  return {
    title: 'Não foi possível carregar as evidências',
    message: 'Não foi possível carregar as evidências e não conformidades.',
    retry: true,
  };
}

export function EvidenceViewerProvider({
  inspectionId,
  children,
}: {
  inspectionId: string;
  children: React.ReactNode;
}) {
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [status, setStatus] = useState<MonitoringStatus>('loading');
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setErrorMessage(null);
    setErrorTitle(null);
    setMonitoring(null);
    void fetchInspectionMonitoring(inspectionId)
      .then((value) => {
        if (!active) return;
        setMonitoring(value);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        const copy = monitoringErrorCopy(error);
        setErrorTitle(copy.title);
        setErrorMessage(copy.message);
        setCanRetry(copy.retry);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [inspectionId, reloadToken]);

  useEffect(() => () => clearEvidenceObjectUrlCache(), [inspectionId]);

  const sortedEvidences = useMemo(
    () => sortEvidences(monitoring?.evidences ?? []),
    [monitoring]
  );

  const openEvidence = useCallback((evidenceId: string) => {
    setActiveId(evidenceId);
  }, []);

  const value = useMemo<EvidenceViewerValue>(
    () => ({
      inspectionId,
      monitoring,
      sortedEvidences,
      status,
      errorTitle,
      errorMessage,
      canRetry,
      reload,
      openEvidence,
    }),
    [
      inspectionId,
      monitoring,
      sortedEvidences,
      status,
      errorTitle,
      errorMessage,
      canRetry,
      reload,
      openEvidence,
    ]
  );

  return (
    <EvidenceViewerContext.Provider value={value}>
      {children}
      {activeId ? (
        <EvidenceLightbox
          inspectionId={inspectionId}
          evidences={sortedEvidences}
          activeId={activeId}
          onClose={() => setActiveId(null)}
          onChangeActive={setActiveId}
        />
      ) : null}
    </EvidenceViewerContext.Provider>
  );
}
