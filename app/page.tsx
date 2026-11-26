'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { InspectionStatusBadge, PriorityTag } from '@/components/Badges';
import { formatDateTime } from '@/lib/inspection-display';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useDashboardIndicators, type DashboardIndicatorsState } from '@/hooks/useDashboardIndicators';
import { listInspections } from '@/lib/inspections-api';
import type { Criticidade, Inspection, InspectionStatus } from '@/types';

/** Ordem do fluxo de negócio (Seção 7 da doc) — usada para desenhar o funil na ordem certa. */
const STATUS_ORDER: InspectionStatus[] = [
  'RASCUNHO',
  'ATRIBUIDA',
  'EM_ANDAMENTO',
  'ENVIADA',
  'EM_REVISAO',
  'DEVOLVIDA',
  'APROVADA',
  'REPROVADA',
  'CANCELADA',
];
const STATUS_LABEL: Record<InspectionStatus, string> = {
  RASCUNHO: 'Rascunho',
  ATRIBUIDA: 'Atribuída',
  EM_ANDAMENTO: 'Em andamento',
  ENVIADA: 'Aguardando revisão',
  EM_REVISAO: 'Em revisão',
  DEVOLVIDA: 'Devolvida para correção',
  APROVADA: 'Aprovada',
  REPROVADA: 'Reprovada',
  CANCELADA: 'Cancelada',
};
// Mesma família de cores dos badges de status (Badges.tsx) — o funil não inventa uma paleta nova.
const STATUS_BAR: Record<InspectionStatus, string> = {
  RASCUNHO: 'bg-slate-300',
  ATRIBUIDA: 'bg-blue-500',
  EM_ANDAMENTO: 'bg-amber-500',
  ENVIADA: 'bg-slate-500',
  EM_REVISAO: 'bg-blue-500',
  DEVOLVIDA: 'bg-orange-500',
  APROVADA: 'bg-emerald-500',
  REPROVADA: 'bg-red-500',
  CANCELADA: 'bg-slate-300',
};

const CRITICIDADE_ORDER: Criticidade[] = ['CRITICA', 'ALTA', 'MEDIA', 'BAIXA'];
const CRITICIDADE_LABEL: Record<Criticidade, string> = { CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };
const CRITICIDADE_BAR: Record<Criticidade, string> = {
  CRITICA: 'bg-red-600',
  ALTA: 'bg-red-400',
  MEDIA: 'bg-amber-500',
  BAIXA: 'bg-slate-400',
};

function initials(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const clients = useAppStore((s) => s.clients);
  const users = useAppStore((s) => s.users);
  const loadClients = useAppStore((s) => s.loadClients);
  const loadUsers = useAppStore((s) => s.loadUsers);
  const [inspections, setInspections] = useState<Inspection[]>([]);

  useEffect(() => {
    void loadClients();
    void loadUsers();
    void listInspections({ page: 0, size: 100, sort: { field: 'scheduledFor', dir: 'desc' }, q: '', filters: {} })
      .then((result) => setInspections(result.items))
      .catch(() => setInspections([]));
  }, [loadClients, loadUsers]);

  // Indicadores por estado e criticidade vêm da API (GET /dashboard/indicators), não do estado local.
  const indicators = useDashboardIndicators();
  const ind = indicators.status === 'ready' ? indicators.data : null;
  const countOf = (status: InspectionStatus) => ind?.inspectionsByStatus[status] ?? 0;
  const aguardandoRevisao = countOf('ENVIADA') + countOf('EM_REVISAO');
  const emAndamento = countOf('EM_ANDAMENTO');
  const aprovadas = countOf('APROVADA');
  const reprovadas = countOf('REPROVADA');
  const totalInspections = ind?.totalInspections || 1;

  const clientName = (id: string) => clients.find((c) => c.id === id)?.nome ?? '—';
  const techName = (id: string) => users.find((t) => t.id === id)?.nome ?? '—';

  const recentes = [...inspections].sort((a, b) => (a.dataPrevista < b.dataPrevista ? 1 : -1)).slice(0, 6);

  // Só os estados que a API informa ("Devolvida" não existe nela e não é exibida como 0).
  const funil = STATUS_ORDER.filter((status) => ind && status in ind.inspectionsByStatus).map((status) => ({
    status,
    count: countOf(status),
  }));
  const maxFunil = Math.max(1, ...funil.map((f) => f.count));

  const ncByCriticidade = CRITICIDADE_ORDER.map((c) => ({ criticidade: c, count: ind?.openNonConformitiesBySeverity[c] ?? 0 }));
  const totalOpenNC = ind?.totalOpenNonConformities ?? 0;
  const totalNC = totalOpenNC || 1;

  return (
    <div>
      {/* Hero — mesma linguagem visual do login (gradiente navy + grade de pontos), agora no dashboard */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-700 text-white px-6 py-7 sm:px-8 sm:py-8 mb-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full bg-brandgreen-500/20 blur-3xl" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <p className="text-brandgreen-400 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            <h1 className="text-2xl sm:text-[1.75rem] font-extrabold leading-tight">
              {greeting()}{currentUser ? `, ${currentUser.nome.split(' ')[0]}` : ''}.
            </h1>
            <p className="text-slate-300 text-sm mt-1.5 max-w-lg">
              {!ind
                ? 'Carregando indicadores...'
                : aguardandoRevisao > 0
                ? `${aguardandoRevisao} ${aguardandoRevisao === 1 ? 'inspeção' : 'inspeções'} aguardando sua revisão e ${emAndamento} em andamento em campo.`
                : `Nenhuma inspeção aguardando revisão agora — ${emAndamento} em andamento em campo.`}
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <Link href="/inspections/review-queue" className="bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap transition-colors">
              Revisar pendências
            </Link>
            <Link href="/models" className="bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap transition-colors">
              + Novo modelo
            </Link>
            <Link href="/schedule" className="bg-brandgreen-600 hover:bg-brandgreen-700 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap transition-colors">
              + Agendar inspeção
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs — valor + participação real no total de inspeções (sem métricas inventadas) */}
      <div className="mb-6">
        <IndicatorsBoundary state={indicators}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile href="/inspections/review-queue" label="Aguardando revisão" value={aguardandoRevisao} total={totalInspections} tone="blue" icon={<IconInbox />} />
            <KpiTile label="Em andamento" value={emAndamento} total={totalInspections} tone="amber" icon={<IconClock />} />
            <KpiTile label="Aprovadas" value={aprovadas} total={totalInspections} tone="emerald" icon={<IconCheck />} />
            <KpiTile label="Reprovadas" value={reprovadas} total={totalInspections} tone="red" icon={<IconX />} />
          </div>
        </IndicatorsBoundary>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="min-w-0 space-y-6">
          {/* Funil de inspeções — todas as etapas do fluxo de negócio, na ordem (Seção 7) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <IconFunnel />
              <h2 className="font-bold text-navy-900">Funil de inspeções</h2>
            </div>
            <IndicatorsBoundary state={indicators}>
              {ind && ind.totalInspections === 0 ? (
                <EmptyState title="Nenhuma inspeção registrada" description="Agende uma inspeção para ver o funil." />
              ) : (
                <div className="space-y-2.5">
                  {funil.map((f) => (
                    <div key={f.status} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                      {/* sm:contents "dissolve" este div no flex do pai — label, barra e contador viram uma
                          única linha a partir do sm; abaixo disso, o rótulo (que pode ser longo, ex.
                          "Aguardando revisão") fica em cima, com o contador ao lado, sem truncar. */}
                      <div className="flex items-center justify-between sm:contents">
                        <span className="sm:w-[120px] sm:shrink-0 text-xs font-semibold text-slate-500">{STATUS_LABEL[f.status]}</span>
                        <span className="sm:hidden text-xs font-bold text-navy-900">{f.count}</span>
                      </div>
                      {/* w-full (não flex-1) no mobile: dentro de um flex-col com altura automática,
                          flex-1 (flex-basis:0 + grow) não tem espaço "extra" pra crescer e a barra
                          colapsa para 0px de altura. sm:flex-1 assume só quando o layout já é flex-row. */}
                      <div className="w-full sm:flex-1 h-3 sm:h-3.5 rounded-full bg-slate-100 overflow-hidden">
                        {f.count > 0 && (
                          <div
                            className={`h-full rounded-full ${STATUS_BAR[f.status]} transition-all duration-500`}
                            style={{ width: `${Math.max((f.count / maxFunil) * 100, 6)}%` }}
                          />
                        )}
                      </div>
                      <span className="hidden sm:block w-5 shrink-0 text-right text-xs font-bold text-navy-900">{f.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </IndicatorsBoundary>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-bold text-navy-900">Inspeções recentes</h2>
              <Link href="/inspections" className="text-sm font-semibold text-navy-700">Ver todas →</Link>
            </div>
            {/* A tabela só cabe sem truncar nome de cliente/e-mail a partir de ~960px de conteúdo —
                com a sidebar fixa, isso só acontece a partir de xl (1280px); abaixo disso os
                cartões abaixo dão a cada campo a linha inteira, sem cortar texto. */}
            <table className="hidden xl:table w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[24%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-100">
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Técnico</th>
                  <th className="px-5 py-3">Prioridade</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Previsão</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-navy-900 truncate">
                      <Link href={`/inspections/${i.id}`}>{clientName(i.clienteId)}</Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600 truncate">
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <Avatar nome={techName(i.tecnicoId)} size={22} />
                        <span className="truncate">{techName(i.tecnicoId)}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3"><PriorityTag priority={i.prioridade} /></td>
                    <td className="px-5 py-3"><InspectionStatusBadge status={i.status} /></td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                      {formatDateTime(i.dataPrevista)}
                    </td>
                  </tr>
                ))}
                {recentes.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">Nenhuma inspeção agendada ainda.</td></tr>
                )}
              </tbody>
            </table>

            {/* Mobile/tablet/laptop estreito: lista de cards com as mesmas informações, empilhadas e sem cortar conteúdo */}
            <div className="xl:hidden divide-y divide-slate-100">
              {recentes.map((i) => (
                <Link key={i.id} href={`/inspections/${i.id}`} className="block p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-semibold text-navy-900 truncate min-w-0">{clientName(i.clienteId)}</span>
                    <InspectionStatusBadge status={i.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm text-slate-600 mb-2">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <Avatar nome={techName(i.tecnicoId)} size={20} />
                      <span className="truncate">{techName(i.tecnicoId)}</span>
                    </span>
                    <PriorityTag priority={i.prioridade} />
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    {formatDateTime(i.dataPrevista)}
                  </div>
                </Link>
              ))}
              {recentes.length === 0 && (
                <div className="px-5 py-10 text-center text-slate-400 text-sm">Nenhuma inspeção agendada ainda.</div>
              )}
            </div>
          </div>

        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-xs font-bold text-navy-700 uppercase mb-3.5">Não conformidades abertas por criticidade</h2>
            <IndicatorsBoundary state={indicators}>
            {totalOpenNC === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma não conformidade aberta.</p>
            ) : (
              <>
                <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5 mb-3.5">
                  {ncByCriticidade.filter((c) => c.count > 0).map((c) => (
                    <div
                      key={c.criticidade}
                      className={`h-full first:rounded-l-full last:rounded-r-full ${CRITICIDADE_BAR[c.criticidade]}`}
                      style={{ width: `${(c.count / totalNC) * 100}%` }}
                      title={`${CRITICIDADE_LABEL[c.criticidade]}: ${c.count}`}
                    />
                  ))}
                </div>
                <ul className="space-y-2">
                  {ncByCriticidade.map((c) => (
                    <li key={c.criticidade} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${CRITICIDADE_BAR[c.criticidade]}`} />
                        <span className="font-semibold text-navy-900">{CRITICIDADE_LABEL[c.criticidade]}</span>
                      </span>
                      <span className="text-xs font-bold text-slate-500">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            </IndicatorsBoundary>
          </div>

        </div>
      </div>
    </div>
  );
}

function Avatar({ nome, size = 24, muted }: { nome: string; size?: number; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 font-bold text-white ${muted ? 'bg-slate-300' : 'bg-gradient-to-br from-navy-700 to-navy-800'}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(nome)}
    </span>
  );
}

const TONE_CLASSES = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
} as const;

/** Loading / erro (com retry) / conteúdo dos indicadores da API. */
function IndicatorsBoundary({ state, children }: { state: DashboardIndicatorsState; children: React.ReactNode }) {
  if (state.status === 'loading') return <LoadingState label="Carregando indicadores..." />;
  if (state.status === 'error') {
    return <ErrorState title={state.error.title} message={state.error.message} onRetry={state.error.retry ? state.reload : undefined} />;
  }
  return <>{children}</>;
}

function KpiTile({
  label,
  value,
  total,
  tone,
  icon,
  href,
}: {
  label: string;
  value: number;
  total: number;
  tone: keyof typeof TONE_CLASSES;
  icon: React.ReactNode;
  href?: string;
}) {
  const t = TONE_CLASSES[tone];
  const pct = Math.round((value / total) * 100);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.bg} ${t.text}`}>{icon}</span>
        <span className="text-3xl font-extrabold text-navy-900 leading-none">{value}</span>
      </div>
      <div className="text-sm text-slate-500 font-semibold mb-2.5">{label}</div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${t.bar} transition-all duration-500`} style={{ width: value > 0 ? `${Math.max(pct, 4)}%` : '0%' }} />
      </div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="bg-white border border-slate-200 rounded-2xl p-5 block hover:bg-slate-50 transition-colors">
        {body}
      </Link>
    );
  }
  return <div className="bg-white border border-slate-200 rounded-2xl p-5">{body}</div>;
}

const IconInbox = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2 3h6l2-3h4M5 12l1.5-6.5A2 2 0 018.45 4h7.1a2 2 0 011.95 1.5L19 12v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6z" />
  </svg>
);

const IconClock = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

const IconX = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9.5l5 5m0-5l-5 5" />
  </svg>
);

const IconFunnel = () => (
  <svg className="w-[18px] h-[18px] text-navy-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6 8v5l-4 2v-7L4 5z" />
  </svg>
);

const IconActivity = () => (
  <svg className="w-[18px] h-[18px] text-navy-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2 8 6-16 2 8h4" />
  </svg>
);
