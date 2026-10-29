'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { CriticidadeTag, InspectionStatusBadge, PriorityTag } from '@/components/Badges';
import { formatDateTime, formatInstructions } from '@/lib/inspection-display';
import { ErrorState } from '@/components/States';
import type { Answer } from '@/types';

const CONFORMITY_LABEL = { CONFORME: 'Conforme', NAO_CONFORME: 'Não conforme', NAO_APLICAVEL: 'Não aplicável' } as const;

function answerLabel(answer: Answer | undefined) {
  if (!answer) return 'Sem resposta';
  if (answer.conformity) return CONFORMITY_LABEL[answer.conformity];
  return answer.value?.trim() || 'Sem resposta';
}

/**
 * #138 — Relatório da inspeção, pronto para impressão. "Exportar PDF" abre o
 * diálogo de impressão do navegador (Salvar como PDF): sem dependência extra e
 * com texto selecionável. A Sidebar some via `print:hidden` (ver Shell.tsx) e o
 * título do documento vira o nome sugerido do arquivo.
 */
export default function InspectionReportPage() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const router = useRouter();

  const inspection = useAppStore((s) => s.inspections.find((i) => i.id === inspectionId));
  const model = useAppStore((s) => s.models.find((m) => m.id === inspection?.modeloId));
  const client = useAppStore((s) => s.clients.find((c) => c.id === inspection?.clienteId));
  const location = useAppStore((s) => s.locations.find((l) => l.id === inspection?.localId));
  const equipment = useAppStore((s) => s.equipment.find((e) => e.id === inspection?.equipamentoId));
  const tech = useAppStore((s) => s.users.find((u) => u.id === inspection?.tecnicoId));

  useEffect(() => {
    if (!inspection) return;
    const previous = document.title;
    document.title = `Relatorio-${inspection.id}`;
    return () => {
      document.title = previous;
    };
  }, [inspection]);

  if (!inspection) return <ErrorState title="Inspeção não encontrada" message="Ela pode ter sido removida ou o link está incorreto." />;

  const ncs = Object.values(inspection.nonConformities);
  const generatedAt = new Date().toLocaleString('pt-BR');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6 print:hidden">
        <button onClick={() => router.push(`/inspections/${inspection.id}`)} className="text-sm font-semibold text-slate-500">
          ← Voltar à inspeção
        </button>
        <button onClick={() => window.print()} className="bg-brandgreen-600 text-white font-bold text-sm rounded-xl px-4 py-2.5">
          Exportar PDF
        </button>
      </div>

      <article className="bg-white border border-slate-200 rounded-2xl p-8 print:border-0 print:rounded-none print:p-0 text-sm text-slate-700">
        <header className="border-b border-slate-200 pb-4 mb-5">
          <div className="text-xs font-bold text-navy-700 uppercase tracking-wide">FieldCore · Relatório de inspeção</div>
          <h1 className="text-2xl font-extrabold text-navy-900 mt-1">{inspection.id}</h1>
          <div className="mt-2 flex items-center gap-2">
            <InspectionStatusBadge status={inspection.status} />
            <PriorityTag priority={inspection.prioridade} />
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <Field label="Cliente" value={client?.nome} />
          <Field label="Local" value={location?.nome} />
          <Field label="Equipamento" value={equipment?.nome ?? 'Não vinculado'} />
          <Field label="Técnico" value={tech?.nome} />
          <Field label="Modelo" value={model ? `${model.title} · v${inspection.modeloVersao}` : undefined} />
          <Field label="Data prevista" value={formatDateTime(inspection.dataPrevista)} />
          {inspection.geolocalizacao && (
            <Field
              label="Localização capturada"
              value={`${inspection.geolocalizacao.lat.toFixed(5)}, ${inspection.geolocalizacao.lng.toFixed(5)}`}
            />
          )}
          {inspection.qrConfirmadoEm && (
            <Field label="QR Code confirmado em" value={new Date(inspection.qrConfirmadoEm).toLocaleString('pt-BR')} />
          )}
        </dl>

        {formatInstructions(inspection.orientacoes) && (
          <section className="mb-6 print:break-inside-avoid">
            <h2 className="text-xs font-extrabold text-navy-700 uppercase mb-1">Orientações</h2>
            <p className="whitespace-pre-wrap break-words">{formatInstructions(inspection.orientacoes)}</p>
          </section>
        )}

        <section className="mb-6">
          <h2 className="text-xs font-extrabold text-navy-700 uppercase mb-3">Checklist</h2>
          {model?.sections.map((section) => (
            <div key={section.id} className="mb-4">
              <h3 className="font-bold text-navy-900 mb-2">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map((item) => {
                  const answer = inspection.answers[item.id];
                  return (
                    <li key={item.id} className="border border-slate-100 rounded-lg p-3 print:break-inside-avoid">
                      <div className="font-semibold text-navy-900">{item.title}</div>
                      <div className="mt-0.5">{answerLabel(answer)}</div>
                      {answer?.observacao && <div className="text-xs text-slate-500 mt-1">{answer.observacao}</div>}
                      {answer?.photos && answer.photos.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {answer.photos.map((src, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={idx} src={src} alt={`Evidência ${idx + 1} de ${item.title}`} className="h-24 rounded border border-slate-200" />
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!model && <p className="text-slate-400">Modelo não encontrado para esta inspeção.</p>}
        </section>

        {ncs.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-extrabold text-navy-700 uppercase mb-3">Não conformidades ({ncs.length})</h2>
            <ul className="space-y-2">
              {ncs.map((nc) => (
                <li key={nc.id} className="border border-red-200 bg-red-50 rounded-lg p-3 print:break-inside-avoid">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-red-800">{nc.titulo || 'Sem título'}</span>
                    <CriticidadeTag criticidade={nc.criticidade} />
                  </div>
                  <p className="text-xs text-red-700 mt-1">{nc.descricao}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {nc.status === 'RESOLVIDA' ? 'Resolvida' : 'Aberta'} · {nc.evidenceCount} evidência(s)
                  </p>
                  {nc.photos && nc.photos.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {nc.photos.map((src, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={idx} src={src} alt={`Evidência ${idx + 1} da não conformidade`} className="h-24 rounded border border-red-200" />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {inspection.correcoes && inspection.correcoes.length > 0 && (
          <section className="mb-6 print:break-inside-avoid">
            <h2 className="text-xs font-extrabold text-navy-700 uppercase mb-2">Devoluções para correção</h2>
            <ul className="space-y-1">
              {inspection.correcoes.map((c, idx) => (
                <li key={idx}>
                  {c.comentario} <span className="text-xs text-slate-400">— {c.supervisorNome}, {new Date(c.createdAt).toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {inspection.review && (
          <section className="mb-6 print:break-inside-avoid">
            <h2 className="text-xs font-extrabold text-navy-700 uppercase mb-2">Revisão</h2>
            <p>
              {inspection.status === 'APROVADA' ? 'Aprovada' : 'Reprovada'} por {inspection.review.supervisorNome}
              {inspection.review.decidedAt ? ` em ${new Date(inspection.review.decidedAt).toLocaleString('pt-BR')}` : ''}.
            </p>
            {inspection.review.comentario && <p className="mt-1">{inspection.review.comentario}</p>}
            {inspection.review.motivoReprovacao && <p className="mt-1">Motivo: {inspection.review.motivoReprovacao}</p>}
          </section>
        )}

        <footer className="border-t border-slate-200 pt-3 text-xs text-slate-400">Gerado em {generatedAt}</footer>
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold text-slate-400 uppercase">{label}</dt>
      <dd className="font-semibold text-navy-900">{value ?? '—'}</dd>
    </div>
  );
}
