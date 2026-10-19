'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { EmptyState } from '@/components/States';
import { StatCard, UserStatusBadge } from '@/components/Badges';
import { Field, Modal } from '@/components/Modal';
import type { AccessRequest, User, UserRole, UserStatus } from '@/types';

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrador(a)',
  SUPERVISOR: 'Supervisor(a)',
  TECHNICIAN: 'Técnico de campo',
  CLIENT_VIEWER: 'Cliente (visualização)',
};

const ROLE_FILTERS: { key: 'TODOS' | UserRole; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'ADMIN', label: 'Administradores' },
  { key: 'SUPERVISOR', label: 'Supervisores' },
  { key: 'TECHNICIAN', label: 'Técnicos' },
  { key: 'CLIENT_VIEWER', label: 'Clientes' },
];

/**
 * Cadastro central de usuários (05 - Perfis de Usuário e Autorização).
 * RN-002: inativação não exclui histórico — não há botão de exclusão.
 * RN-003: perfis definem o que a API autoriza; aqui só refletimos o cadastro.
 */
export default function UsersPage() {
  const users = useAppStore((s) => s.users);
  const createUser = useAppStore((s) => s.createUser);
  const updateUser = useAppStore((s) => s.updateUser);
  const setUserStatus = useAppStore((s) => s.setUserStatus);
  const accessRequests = useAppStore((s) => s.accessRequests);
  const approveAccessRequest = useAppStore((s) => s.approveAccessRequest);
  const rejectAccessRequest = useAppStore((s) => s.rejectAccessRequest);

  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]['key']>('TODOS');
  const [search, setSearch] = useState('');
  const [modalUser, setModalUser] = useState<User | 'new' | null>(null);
  const [approvingRequest, setApprovingRequest] = useState<AccessRequest | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const pendingRequests = accessRequests.filter((r) => r.status === 'PENDENTE');

  async function handleStatusChange(id: string, status: UserStatus) {
    const result = await setUserStatus(id, status);
    setStatusError(result.ok ? null : result.error);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((u) => roleFilter === 'TODOS' || u.role === roleFilter)
      .filter((u) => !term || u.nome.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [users, roleFilter, search]);

  const activeCount = users.filter((u) => u.status === 'ATIVO').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Usuários</h1>
          <p className="text-sm text-slate-500">Contas de acesso ao painel e ao aplicativo de campo (RN-001, RN-002)</p>
        </div>
        <button onClick={() => setModalUser('new')} className="bg-brandgreen-600 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap">
          + Novo usuário
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total de usuários" value={users.length} />
        <StatCard label="Ativos" value={activeCount} tone="text-emerald-600" />
        <StatCard label="Técnicos" value={users.filter((u) => u.role === 'TECHNICIAN').length} />
        <StatCard label="Painel administrativo" value={users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPERVISOR').length} tone="text-navy-700" />
      </div>

      {statusError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-4">{statusError}</div>
      )}

      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <h2 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-3">
            Solicitações de acesso pendentes ({pendingRequests.length})
          </h2>
          <div className="space-y-2.5">
            {pendingRequests.map((r) => (
              <div key={r.id} className="bg-white border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-navy-900">{r.nome} · {ROLE_LABEL[r.role]}</div>
                  <div className="text-xs font-mono text-slate-500">{r.email}</div>
                  {r.justificativa && <div className="text-xs text-slate-500 mt-1 max-w-md">{r.justificativa}</div>}
                  <div className="text-[11px] text-slate-400 mt-1">Solicitado em {new Date(r.createdAt).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => rejectAccessRequest(r.id)} className="text-xs font-semibold text-red-600">Rejeitar</button>
                  <button
                    onClick={() => setApprovingRequest(r)}
                    className="bg-brandgreen-600 text-white text-xs font-bold rounded-lg px-3 py-2"
                  >
                    Aprovar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setRoleFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
                roleFilter === f.key ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white border-slate-300 text-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 ml-auto w-full sm:w-64"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="hidden xl:table w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-100">
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">E-mail</th>
              <th className="px-5 py-3">Perfil</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-semibold text-navy-900 truncate">{u.nome}</td>
                <td className="px-5 py-3 text-slate-600 font-mono text-xs truncate">{u.email}</td>
                <td className="px-5 py-3 text-slate-600 truncate">{ROLE_LABEL[u.role]}</td>
                <td className="px-5 py-3"><UserStatusBadge status={u.status} /></td>
                <td className="px-5 py-3">
                  <UserRowActions user={u} onEdit={() => setModalUser(u)} onStatus={(s) => handleStatusChange(u.id, s)} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5}><EmptyState title="Nenhum usuário encontrado" description="Ajuste os filtros ou a busca para ver outros resultados." /></td></tr>
            )}
          </tbody>
        </table>

        <div className="xl:hidden divide-y divide-slate-100">
          {filtered.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <span className="font-semibold text-navy-900 truncate min-w-0">{u.nome}</span>
                <UserStatusBadge status={u.status} />
              </div>
              <div className="text-xs font-mono text-slate-500 mb-1">{u.email}</div>
              <div className="text-xs text-slate-500 mb-3">{ROLE_LABEL[u.role]}</div>
              <UserRowActions user={u} onEdit={() => setModalUser(u)} onStatus={(s) => handleStatusChange(u.id, s)} />
            </div>
          ))}
          {filtered.length === 0 && (
            <EmptyState title="Nenhum usuário encontrado" description="Ajuste os filtros ou a busca para ver outros resultados." />
          )}
        </div>
      </div>

      {modalUser && (
        <UserFormModal
          user={modalUser === 'new' ? null : modalUser}
          onClose={() => setModalUser(null)}
          onCreate={createUser}
          onUpdate={updateUser}
        />
      )}

      {approvingRequest && (
        <ApproveRequestModal
          request={approvingRequest}
          onClose={() => setApprovingRequest(null)}
          onApprove={approveAccessRequest}
        />
      )}
    </div>
  );
}

function ApproveRequestModal({
  request,
  onClose,
  onApprove,
}: {
  request: AccessRequest;
  onClose: () => void;
  onApprove: (requestId: string, senha: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await onApprove(request.id, senha);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal title="Aprovar solicitação de acesso" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-slate-600 mb-4">
          Criar conta de <strong className="text-navy-900">{request.nome}</strong> ({request.email}) como{' '}
          <strong className="text-navy-900">{ROLE_LABEL[request.role]}</strong>.
        </p>
        <Field label="Senha inicial" required>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            required
            autoFocus
          />
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-3">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-brandgreen-600 text-white rounded-xl py-2.5 font-bold mt-1 disabled:opacity-60">
          {loading ? 'Criando...' : 'Aprovar e criar conta'}
        </button>
      </form>
    </Modal>
  );
}

function UserRowActions({ user, onEdit, onStatus }: { user: User; onEdit: () => void; onStatus: (status: UserStatus) => void }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button onClick={onEdit} className="text-xs font-semibold text-navy-700">Editar</button>
      {user.status !== 'ATIVO' && (
        <button onClick={() => onStatus('ATIVO')} className="text-xs font-semibold text-emerald-600">Ativar</button>
      )}
      {user.status !== 'INATIVO' && (
        <button onClick={() => onStatus('INATIVO')} className="text-xs font-semibold text-slate-500">Inativar</button>
      )}
      {user.status !== 'BLOQUEADO' && (
        <button onClick={() => onStatus('BLOQUEADO')} className="text-xs font-semibold text-red-600">Bloquear</button>
      )}
    </div>
  );
}

function UserFormModal({
  user,
  onClose,
  onCreate,
  onUpdate,
}: {
  user: User | null;
  onClose: () => void;
  onCreate: (nome: string, email: string, role: UserRole, senha: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  onUpdate: (id: string, patch: Partial<Pick<User, 'nome' | 'email' | 'role'>>) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [nome, setNome] = useState(user?.nome ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'SUPERVISOR');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = user ? await onUpdate(user.id, { nome, email, role }) : await onCreate(nome, email, role, senha);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal title={user ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Nome" required>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
        </Field>
        <Field label="E-mail" required>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
        </Field>
        <Field label="Perfil" required>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="ADMIN">Administrador(a)</option>
            <option value="SUPERVISOR">Supervisor(a)</option>
            <option value="TECHNICIAN">Técnico de campo</option>
            <option value="CLIENT_VIEWER">Cliente (visualização)</option>
          </select>
        </Field>
        {!user && (
          <Field label="Senha inicial" required>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
          </Field>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-3">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-brandgreen-600 text-white rounded-xl py-2.5 font-bold mt-1 disabled:opacity-60">
          {loading ? 'Salvando...' : user ? 'Salvar alterações' : 'Criar usuário'}
        </button>
      </form>
    </Modal>
  );
}
