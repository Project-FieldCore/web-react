'use client';

import { useEffect, useState } from 'react';
import {
  fetchInspectionMonitoring,
  type InspectionMonitoring as Monitoring,
  type MonitoringEvidence,
  type MonitoringNonConformity,
} from '@/lib/inspections-api';

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

export function MonitoringPanels({ monitoring }: { monitoring: Monitoring }) {
  if (monitoring.evidences.length === 0 && monitoring.nonConformities.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma evidência ou não conformidade sincronizada.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      <section>
        <h2 className="text-xs font-bold uppercase text-slate-400 mb-2">Evidências</h2>
        {monitoring.evidences.length === 0 ? <p className="text-sm text-slate-500">Nenhuma fotografia sincronizada.</p> : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {monitoring.evidences.map((evidence) => <EvidenceCard key={evidence.id} evidence={evidence} />)}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-xs font-bold uppercase text-slate-400 mb-2">Não conformidades</h2>
        {monitoring.nonConformities.length === 0 ? <p className="text-sm text-slate-500">Nenhuma não conformidade sincronizada.</p> : (
          <ul className="space-y-3">
            {monitoring.nonConformities.map((item) => (
              <li key={item.id} className="border border-orange-200 bg-orange-50 rounded-xl p-4 text-sm">
                <div className="font-bold text-orange-800">{SEVERITY[item.severity]} · {STATUS[item.status]}</div>
                <p className="text-slate-700 mt-1">{item.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: MonitoringEvidence }) {
  const kilobytes = Math.max(1, Math.round(evidence.sizeBytes / 1024));
  return (
    <li className="border border-slate-200 rounded-xl p-4 text-sm">
      <div className="font-semibold text-navy-900">{evidence.fileName}</div>
      <div className="text-slate-500 mt-1">{evidence.contentType} · {kilobytes} KB</div>
    </li>
  );
}

export function InspectionMonitoring({ inspectionId }: { inspectionId: string }) {
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setMonitoring(null);
    setError(null);
    void fetchInspectionMonitoring(inspectionId)
      .then((value) => { if (active) setMonitoring(value); })
      .catch(() => { if (active) setError('Não foi possível carregar as evidências e não conformidades.'); });
    return () => { active = false; };
  }, [inspectionId]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
      <h2 className="text-sm font-bold text-navy-900 mb-3">Acompanhamento de campo</h2>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!error && !monitoring ? <p className="text-sm text-slate-500">Carregando evidências e não conformidades...</p> : null}
      {monitoring ? <MonitoringPanels monitoring={monitoring} /> : null}
    </div>
  );
}
