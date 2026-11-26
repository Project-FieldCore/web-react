'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import {
  AuthBadge,
  AuthCard,
  AuthField,
  AuthShell,
  BackToLoginLink,
  ErrorBanner,
  SubmitButton,
  SuccessState,
} from '@/components/auth/AuthUI';
import { IconArrowRight, IconMail, IconUser } from '@/components/auth/AuthIcons';
import type { UserRole } from '@/types';

/**
 * Tela "Solicitar acesso" — não existe autocadastro instantâneo no painel
 * web. RN-003 (menor privilégio): um ADMIN precisa revisar e aprovar o
 * pedido em /users antes de a conta existir de fato. Técnicos usam o
 * aplicativo mobile e não passam por este formulário.
 */
export default function SignupPage() {
  const requestAccess = useAppStore((s) => s.requestAccess);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Extract<UserRole, 'ADMIN' | 'SUPERVISOR'>>('SUPERVISOR');
  const [justificativa, setJustificativa] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      const result = requestAccess(nome, email, role, justificativa);
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSent(true);
    }, 250);
  }

  return (
    <AuthShell>
      <AuthCard>
        {sent ? (
          <SuccessState
            title="Solicitação enviada!"
            action={
              <Link href="/login" className="inline-flex w-full items-center justify-center gap-2 bg-navy-900 text-white rounded-xl py-3 font-bold text-sm hover:bg-navy-800 transition-colors">
                Voltar para o login
              </Link>
            }
          >
            Um administrador vai revisar seu pedido de acesso como <strong className="text-navy-800">{ROLE_LABEL[role]}</strong>.
            Você recebe suas credenciais assim que ele for aprovado.
          </SuccessState>
        ) : (
          <form onSubmit={handleSubmit}>
            <BackToLoginLink />
            <AuthBadge>Painel administrativo</AuthBadge>
            <h1 className="text-xl font-extrabold text-navy-900 mb-1">Solicitar acesso</h1>
            <p className="text-sm text-slate-500 mb-6">
              Contas do painel são criadas só depois da aprovação de um administrador.
            </p>

            <AuthField
              id="signup-nome"
              label="Nome completo"
              value={nome}
              onChange={setNome}
              placeholder="Seu nome"
              icon={<IconUser />}
              autoComplete="name"
              autoFocus
              required
            />

            <AuthField
              id="signup-email"
              label="E-mail corporativo"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="voce@fieldcore.com"
              icon={<IconMail />}
              autoComplete="email"
              required
            />

            <div className="mb-2">
              <label className="text-xs font-bold text-navy-700 uppercase tracking-wide block mb-1.5" htmlFor="signup-role">
                Perfil desejado
              </label>
              <select
                id="signup-role"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm text-navy-900 outline-none transition-all focus:border-brandgreen-500 focus:ring-4 focus:ring-brandgreen-500/10 bg-white"
              >
                <option value="SUPERVISOR">Supervisor(a)</option>
                <option value="ADMIN">Administrador(a)</option>
              </select>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Técnico de campo usa o aplicativo móvel — peça esse cadastro diretamente a um administrador.
            </p>

            <div className="mb-5">
              <label className="text-xs font-bold text-navy-700 uppercase tracking-wide block mb-1.5" htmlFor="signup-justificativa">
                Justificativa <span className="text-slate-400 normal-case font-semibold">(opcional)</span>
              </label>
              <textarea
                id="signup-justificativa"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
                placeholder="Explique brevemente por que precisa de acesso ao painel."
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-navy-900 outline-none transition-all resize-none focus:border-brandgreen-500 focus:ring-4 focus:ring-brandgreen-500/10"
              />
            </div>

            {error && <ErrorBanner>{error}</ErrorBanner>}

            <SubmitButton loading={loading} loadingLabel="Enviando..." variant="green">
              Enviar solicitação <IconArrowRight />
            </SubmitButton>

            <p className="text-center text-sm text-slate-500 mt-5">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-bold text-navy-800 hover:text-brandgreen-700">
                Entrar
              </Link>
            </p>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}

const ROLE_LABEL: Record<'ADMIN' | 'SUPERVISOR', string> = {
  ADMIN: 'Administrador(a)',
  SUPERVISOR: 'Supervisor(a)',
};
