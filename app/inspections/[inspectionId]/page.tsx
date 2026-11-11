'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { InspectionStatusBadge, PriorityTag } from '@/components/Badges';
import { InspectionInstructions } from '@/components/InspectionInstructions';
import { formatDateTime } from '@/lib/inspection-display';
import { ErrorState, InlineError } from '@/components/States';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { CancelInspectionDialog } from '@/components/inspections/CancelInspectionDialog';
import { ReassignTechnicianDialog } from '@/components/inspections/ReassignTechnicianDialog';
import { canReassign } from '@/lib/technician-rules';
import { CancelInspectionAction } from '@/components/inspections/CancelInspectionAction';
import { CancellationInfo } from '@/components/inspections/CancellationInfo';
import { InspectionMonitoring } from '@/components/inspections/InspectionMonitoring';
import { InspectionReviewChecklist } from '@/components/inspections/InspectionReviewChecklist';
import { EvidenceViewerProvider } from '@/components/inspections/EvidenceViewerContext';

/**
 * UC-16 — Revisar inspeção / UC-17 — Aprovar ou reprovar inspeção.
 * RN-079: somente supervisor autorizado inicia a revisão (aqui, implícito).
 * RN-080: reprovação exige motivo obrigatório.
 * RN-081: aprovação registra supervisor, data e comentário opcional.
 * RN-084: o supervisor não altera silenciosamente a resposta do técnico —
 * por isso as respostas abaixo são somente leitura.
 */
export default function InspectionReviewPage() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const router = useRouter();
  const [fromReviewQueue, setFromReviewQueue] = useState(false);

  const inspection = useAppStore((s) => s.inspections.find((i) => i.id === inspectionId));
  const models = useAppStore((s) => s.models);
  const clients = useAppStore((s) => s.clients);
  const locations = useAppStore((s) => s.locations);
  const equipment = useAppStore((s) => s.equipment);
  const users = useAppStore((s) => s.users);
  const startReview = useAppStore((s) => s.startReview);
  const approveInspection = useAppStore((s) => s.approveInspection);
  const rejectInspection = useAppStore((s) => s.rejectInspection);
  const returnForCorrection = useAppStore((s) => s.returnForCorrection);
  const cancelInspection = useAppStore((s) => s.cancelInspection);
  const reassignInspection = useAppStore((s) => s.reassignInspection);

  const review = useAsyncAction();
  const [comentario, setComentario] = useState('');
  const [motivo, setMotivo] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnFeedback, setReturnFeedback] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignNotice, setReassignNotice] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  useEffect(() => {
    setFromReviewQueue(new URLSearchParams(window.location.search).get('from') === 'review-queue');
  }, []);

  useEffect(() => {
    if (!reassignNotice) return;
    const timer = setTimeout(() => setReassignNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [reassignNotice]);

  useEffect(() => {
    if (!cancelNotice) return;
    const timer = setTimeout(() => setCancelNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [cancelNotice]);

  if (!inspection) return <ErrorState title="Inspeção não encontrada" message="Ela pode ter sido removida ou o link está incorreto." />;

  const model = models.find((m) => m.id === inspection.modeloId);
  const client = clients.find((c) => c.id === inspection.clienteId);
  const location = locations.find((l) => l.id === inspection.localId);
  const equip = equipment.find((e) => e.id === inspection.equipamentoId);
  const tech = users.find((u) => u.id === inspection.tecnicoId);

  // PBI-0060: decisões (aprovar/reprovar/devolver) só em EM_REVISAO — ENVIADA usa só “Iniciar revisão”.
  const canReview = inspection.status === 'EM_REVISAO';

  async function handleReassign(tecnicoId: string) {
    const result = await reassignInspection(inspection!.id, tecnicoId);
    if (result.ok) {
      const next = useAppStore.getState().users.find((u) => u.id === tecnicoId);
      setReassignNotice(`Inspeção atribuída a ${next?.nome ?? 'o novo técnico'}.`);
    }
    return result;
  }

  async function handleCancel(justificativa: string) {
    const result = await cancelInspection(inspection!.id, justificativa);
    if (result.ok) setCancelNotice('Inspeção cancelada com sucesso.');
    return result;
  }

  async function handleOpenReview() {
    return review.run(() => startReview(inspection!.id));
  }

  function handleBack() {
    router.push(fromReviewQueue ? '/inspections/review-queue' : '/inspections');
  }
  async function handleApprove() {
    await review.run(() => approveInspection(inspection!.id, comentario || undefined));
  }
  async function handleReject() {
    setRejectError(null);
    const trimmed = motivo.trim();
    if (!trimmed) {
      setRejectError('Informe o motivo da reprovação.');
      return;
    }
    if (trimmed.length > 2000) {
      setRejectError('O motivo deve ter no máximo 2000 caracteres.');
      return;
    }
    const result = await review.run(() => rejectInspection(inspection!.id, trimmed));
    if (!result.ok) {
      setRejectError(result.error);
      return;
    }
    setShowRejectForm(false);
    setMotivo('');
    setRejectError(null);
  }

  function handleCancelRejectForm() {
    setShowRejectForm(false);
    setMotivo('');
    setRejectError(null);
  }
  async function handleReturnForCorrection() {
    setReturnError(null);
    const result = await review.run(() => returnForCorrection(inspection!.id, returnFeedback));
    if (!result.ok) { setReturnError(result.error); return; }
    router.push('/inspections');
  }

  return (
    <EvidenceViewerProvider inspectionId={inspection.id}>
    <div className="max-w-3xl mx-auto">
      <button type="button" onClick={handleBack} className="text-sm font-semibold text-slate-500 mb-4">
        {fromReviewQueue ? '← Voltar à fila de revisão' : '← Voltar às inspeções'}
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">{client?.nome}</h1>
          <p className="text-sm text-slate-500">{location?.nome}{equip ? ` · ${equip.nome}` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/inspections/${inspection.id}/relatorio`} className="text-sm font-bold text-navy-700 whitespace-nowrap">
            Exportar relatório (PDF)
          </Link>
          <InspectionStatusBadge status={inspection.status} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-slate-400 text-xs uppercase font-bold block mb-1">Técnico</span>
          {tech?.nome ?? '—'}
          {canReassign(inspection.status) && (
            <button type="button" onClick={() => setShowReassign(true)} className="ml-3 text-xs font-bold text-navy-700 underline">
              Alterar técnico
            </button>
          )}
        </div>
        <div><span className="text-slate-400 text-xs uppercase font-bold block mb-1">Prioridade</span><PriorityTag priority={inspection.prioridade} /></div>
        <div><span className="text-slate-400 text-xs uppercase font-bold block mb-1">Modelo</span>{model?.title} · v{inspection.modeloVersao}</div>
        <div><span className="text-slate-400 text-xs uppercase font-bold block mb-1">Data prevista</span>{formatDateTime(inspection.dataPrevista)}</div>
        <InspectionInstructions text={inspection.orientacoes} />
      </div>

      {reassignNotice && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl px-4 py-3 mb-5">
          {reassignNotice}
        </div>
      )}

      {cancelNotice && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl px-4 py-3 mb-5">
          {cancelNotice}
        </div>
      )}

      {inspection.cancelamento && <CancellationInfo cancelamento={inspection.cancelamento} />}

      <InspectionMonitoring />

      {/* RN-029/030: cancelar exige justificativa; aprovada não cancela pelo fluxo comum. */}
      <CancelInspectionAction status={inspection.status} onCancel={() => setShowCancel(true)} />

      {inspection.status === 'ENVIADA' && (
        <div className="mb-5">
          {review.error && !showRejectForm && !showReturnForm ? (
            <div className="mb-3">
              <InlineError message={review.error} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void handleOpenReview()}
            disabled={review.pending}
            className="w-full bg-navy-800 text-white rounded-xl py-3 font-bold disabled:opacity-60"
          >
            {review.pending ? 'Iniciando revisão...' : 'Iniciar revisão formal'}
          </button>
        </div>
      )}

      {inspection.correcoes && inspection.correcoes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-5">
          <h2 className="text-xs font-bold text-orange-700 uppercase mb-3">Histórico de devoluções para correção</h2>
          <div className="space-y-3">
            {inspection.correcoes.map((c, idx) => (
              <div key={idx} className="text-sm">
                <div className="text-orange-700 font-semibold">{c.comentario}</div>
                <div className="text-xs text-orange-500 mt-0.5">
                  {c.supervisorNome} · {new Date(c.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <InspectionReviewChecklist inspectionId={inspection.id} />

      {canReview && !showRejectForm && !showReturnForm && (
        <>
          {review.error ? (
            <div className="mb-3">
              <InlineError message={review.error} />
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              disabled={review.pending}
              className="flex-1 bg-white border border-red-200 text-red-600 rounded-xl py-3 font-bold disabled:opacity-60"
            >
              Reprovar
            </button>
            <button
              type="button"
              onClick={() => setShowReturnForm(true)}
              disabled={review.pending}
              className="flex-1 bg-white border border-orange-200 text-orange-600 rounded-xl py-3 font-bold disabled:opacity-60"
            >
              Devolver para correção
            </button>
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={review.pending}
              className="flex-1 bg-brandgreen-600 text-white rounded-xl py-3 font-bold disabled:opacity-60"
            >
              {review.pending ? 'Salvando...' : 'Aprovar'}
            </button>
          </div>
          <div className="mt-3">
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Comentário de revisão (opcional)"
              rows={2}
              disabled={review.pending}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </>
      )}

      {canReview && showRejectForm && (
        <div className="bg-white border border-red-200 rounded-2xl p-5 mt-3">
          <label className="text-xs font-bold text-red-700 uppercase block mb-1">Motivo da reprovação (obrigatório — RN-080)</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, 2000))}
            rows={3}
            maxLength={2000}
            disabled={review.pending}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 disabled:opacity-60"
          />
          {rejectError ? (
            <div className="mb-3">
              <InlineError message={rejectError} />
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleCancelRejectForm}
              disabled={review.pending}
              className="flex-1 bg-white border border-slate-300 rounded-xl py-2.5 font-bold text-navy-800 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={review.pending || !motivo.trim()}
              className="flex-1 bg-red-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-60"
            >
              {review.pending ? 'Salvando...' : 'Confirmar reprovação'}
            </button>
          </div>
        </div>
      )}

      {showReturnForm && (
        <div className="bg-white border border-orange-200 rounded-2xl p-5 mt-3">
          <label className="text-xs font-bold text-orange-700 uppercase block mb-1">O que o técnico precisa corrigir? (obrigatório)</label>
          <p className="text-xs text-slate-500 mb-2">
            A inspeção volta para o técnico responder novamente — diferente da reprovação, que encerra o ciclo.
          </p>
          <textarea
            value={returnFeedback}
            onChange={(e) => setReturnFeedback(e.target.value)}
            rows={3}
            placeholder="Ex.: item 'Estrutura sem trincas' está marcado como conforme, mas a foto mostra corrosão visível."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          {returnError && <div className="text-xs text-red-600 font-semibold mb-3">{returnError}</div>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => setShowReturnForm(false)} className="flex-1 bg-white border border-slate-300 rounded-xl py-2.5 font-bold text-navy-800">Cancelar</button>
            <button onClick={handleReturnForCorrection} disabled={review.pending} className="flex-1 bg-orange-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-60">{review.pending ? 'Salvando...' : 'Confirmar devolução'}</button>
          </div>
        </div>
      )}

      {inspection.review && (
        <div className="mt-5 text-xs text-slate-400">
          {inspection.status === 'APROVADA' ? 'Aprovada' : 'Reprovada'} por {inspection.review.supervisorNome}
          {inspection.review.decidedAt ? ` em ${new Date(inspection.review.decidedAt).toLocaleString('pt-BR')}` : ''}.
          {inspection.review.motivoReprovacao ? ` Motivo: ${inspection.review.motivoReprovacao}` : ''}
        </div>
      )}

      {showReassign && (
        <ReassignTechnicianDialog
          inspectionId={inspection.id}
          currentTechnicianName={tech?.nome}
          onConfirm={handleReassign}
          onClose={() => setShowReassign(false)}
        />
      )}

      {showCancel && (
        <CancelInspectionDialog
          inspectionId={inspection.id}
          clientName={client?.nome}
          locationName={location?.nome}
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
        />
      )}
    </div>
    </EvidenceViewerProvider>
  );
}
