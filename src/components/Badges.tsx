import type { Criticidade, InspectionStatus, ModelStatus, NonConformityStatus, Priority, UserStatus } from '@/types';

const STATUS_MAP: Record<InspectionStatus, { label: string; className: string }> = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-slate-100 text-slate-600' },
  ATRIBUIDA: { label: 'Atribuída', className: 'bg-blue-100 text-blue-800' },
  EM_ANDAMENTO: { label: 'Em andamento', className: 'bg-amber-100 text-amber-700' },
  ENVIADA: { label: 'Aguardando revisão', className: 'bg-slate-200 text-slate-700' },
  EM_REVISAO: { label: 'Em revisão', className: 'bg-blue-100 text-blue-800' },
  DEVOLVIDA: { label: 'Devolvida para correção', className: 'bg-orange-100 text-orange-700' },
  APROVADA: { label: 'Aprovada', className: 'bg-emerald-100 text-emerald-700' },
  REPROVADA: { label: 'Reprovada', className: 'bg-red-100 text-red-700' },
  CANCELADA: { label: 'Cancelada', className: 'bg-slate-100 text-slate-500' },
};

export function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  const s = STATUS_MAP[status];
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

const MODEL_STATUS_MAP: Record<ModelStatus, { label: string; className: string }> = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-slate-100 text-slate-600' },
  PUBLICADO: { label: 'Publicado', className: 'bg-emerald-100 text-emerald-700' },
  ARQUIVADO: { label: 'Arquivado', className: 'bg-amber-100 text-amber-700' },
};

export function ModelStatusBadge({ status }: { status: ModelStatus }) {
  const s = MODEL_STATUS_MAP[status];
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

const PRIORITY_MAP: Record<Priority, { label: string; dot: string }> = {
  ALTA: { label: 'Alta', dot: 'bg-red-500' },
  MEDIA: { label: 'Média', dot: 'bg-amber-500' },
  BAIXA: { label: 'Baixa', dot: 'bg-slate-400' },
};

export function PriorityTag({ priority }: { priority: Priority }) {
  const p = PRIORITY_MAP[priority];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full shrink-0 ${p.dot}`} />
      {p.label}
    </span>
  );
}

const USER_STATUS_MAP: Record<UserStatus, { label: string; className: string }> = {
  ATIVO: { label: 'Ativo', className: 'bg-emerald-100 text-emerald-700' },
  INATIVO: { label: 'Inativo', className: 'bg-slate-100 text-slate-500' },
  BLOQUEADO: { label: 'Bloqueado', className: 'bg-red-100 text-red-700' },
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const s = USER_STATUS_MAP[status];
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

/** Estado de ativação de cadastros (clientes, locais, equipamentos) — RN-013: inativação, nunca exclusão. */
export function ActiveBadge({ ativo }: { ativo: boolean }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

const NC_STATUS_MAP: Record<NonConformityStatus, { label: string; className: string }> = {
  ABERTA: { label: 'Aberta', className: 'bg-red-100 text-red-700' },
  RESOLVIDA: { label: 'Resolvida', className: 'bg-emerald-100 text-emerald-700' },
};

export function NonConformityStatusBadge({ status }: { status: NonConformityStatus }) {
  const s = NC_STATUS_MAP[status];
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

const CRITICIDADE_MAP: Record<Criticidade, { label: string; dot: string }> = {
  CRITICA: { label: 'Crítica', dot: 'bg-red-600' },
  ALTA: { label: 'Alta', dot: 'bg-red-400' },
  MEDIA: { label: 'Média', dot: 'bg-amber-500' },
  BAIXA: { label: 'Baixa', dot: 'bg-slate-400' },
};

export function CriticidadeTag({ criticidade }: { criticidade: Criticidade }) {
  const c = CRITICIDADE_MAP[criticidade];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className={`text-3xl font-extrabold ${tone ?? 'text-navy-900'}`}>{value}</div>
        {icon && <div className={`shrink-0 ${tone ?? 'text-navy-900'} opacity-70`}>{icon}</div>}
      </div>
      <div className="text-sm text-slate-500 font-semibold mt-1">{label}</div>
    </div>
  );
}
