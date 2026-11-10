'use client';

import { ErrorState } from '@/components/States';
import type { MonitoringNonConformity } from '@/lib/inspections-api';
import { groupEvidencesBySection, sortEvidences } from '@/lib/evidence-gallery';
import { EvidenceThumbnail } from './EvidenceThumbnail';
import { useEvidenceViewer } from './EvidenceViewerContext';

const SEVERITY: Record<MonitoringNonConformity['severity'], string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const STATUS: Record<MonitoringNonConformity['status'], string> = {
  OPEN: 'Aberta',
  RESOLVED: 'Resolvida',
  WAIVED: 'Dispensada',
};

/** Painéis de evidências/NC — também usados em testes estáticos com dados injetados. */
export function MonitoringPanels({
  inspectionId,
  evidences,
  nonConformities,
  onOpenEvidence,
}: {
  inspectionId: string;
  evidences: import('@/lib/inspections-api').MonitoringEvidence[];
  nonConformities: MonitoringNonConformity[];
  onOpenEvidence: (id: string) => void;
}) {
  if (evidences.length === 0 && nonConformities.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma evidência ou não conformidade sincronizada.</p>;
  }

  const groups = groupEvidencesBySection(sortEvidences(evidences));

  return (
    <div className="grid grid-cols-1 gap-4">
      <section>
        <h2 className="text-xs font-bold uppercase text-slate-400 mb-2">Evidências</h2>
        {evidences.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma fotografia sincronizada.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={`${group.sectionOrder}-${group.sectionTitle}`}>
                <h3 className="text-xs font-semibold text-slate-500 mb-2">{group.sectionTitle}</h3>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {group.evidences.map((evidence) => (
                    <li key={evidence.id}>
                      <EvidenceThumbnail
                        inspectionId={inspectionId}
                        evidence={evidence}
                        onOpen={() => onOpenEvidence(evidence.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="text-xs font-bold uppercase text-slate-400 mb-2">Não conformidades</h2>
        {nonConformities.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma não conformidade sincronizada.</p>
        ) : (
          <ul className="space-y-3">
            {nonConformities.map((item) => (
              <li key={item.id} className="border border-orange-200 bg-orange-50 rounded-xl p-4 text-sm">
                <div className="font-bold text-orange-800">
                  {SEVERITY[item.severity]} · {STATUS[item.status]}
                </div>
                <p className="text-slate-700 mt-1">{item.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function InspectionMonitoring() {
  const viewer = useEvidenceViewer();

  if (!viewer) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <h2 className="text-sm font-bold text-navy-900 mb-3">Acompanhamento de campo</h2>
        <p className="text-sm text-slate-500">Carregando evidências e não conformidades...</p>
      </div>
    );
  }

  const { inspectionId, monitoring, sortedEvidences, status, errorTitle, errorMessage, canRetry, reload, openEvidence } =
    viewer;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
      <h2 className="text-sm font-bold text-navy-900 mb-3">Acompanhamento de campo</h2>
      {status === 'loading' ? (
        <p className="text-sm text-slate-500">Carregando evidências e não conformidades...</p>
      ) : null}
      {status === 'error' && errorMessage ? (
        <ErrorState
          title={errorTitle ?? 'Não foi possível carregar as evidências'}
          message={errorMessage}
          onRetry={canRetry ? reload : undefined}
        />
      ) : null}
      {status === 'ready' && monitoring ? (
        <MonitoringPanels
          inspectionId={inspectionId}
          evidences={sortedEvidences}
          nonConformities={monitoring.nonConformities}
          onOpenEvidence={openEvidence}
        />
      ) : null}
    </div>
  );
}
