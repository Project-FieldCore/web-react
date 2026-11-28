'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandPanel } from './BrandPanel';
import { IconAlertCircle, IconArrowLeft, IconCheckCircle, IconEye, IconEyeOff, IconLock, IconSpinner } from './AuthIcons';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Casco compartilhado por login, solicitar acesso e recuperar senha:
 * painel de marca à esquerda + coluna centralizada à direita, com o logo
 * compacto (em chip escuro) substituindo o painel de marca no mobile.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <BrandPanel />
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 sm:px-6 bg-[#F2F6F8]">
        <div className="absolute right-4 top-4 w-52 sm:right-6 sm:top-6">
          <ThemeToggle variant="surface" />
        </div>
        <div className="lg:hidden bg-navy-900 rounded-2xl px-5 py-3 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-compact.png" alt="FieldCore" className="h-8 w-auto" />
        </div>
        <div className="w-full max-w-sm animate-fade-in-up">{children}</div>
      </div>
    </div>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_8px_30px_rgb(15,36,68,0.06)] p-7 sm:p-8">
      {children}
    </div>
  );
}

export function AuthBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brandgreen-700 bg-brandgreen-500/10 px-2.5 py-1 rounded-full mb-4">
      <span className="w-1.5 h-1.5 rounded-full bg-brandgreen-500" />
      {children}
    </span>
  );
}

export function BackToLoginLink() {
  return (
    // O <Link> é "inline-flex" (flexbox só para alinhar a seta com o texto) — sem
    // este wrapper em bloco, ele flutua na mesma linha do badge ao lado (AuthBadge),
    // em vez de empurrá-lo para a linha de baixo.
    <div className="mb-5">
      <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-navy-700 transition-colors">
        <IconArrowLeft /> Voltar para o login
      </Link>
    </div>
  );
}

export function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  required,
  autoFocus,
  autoComplete,
  last,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon: React.ReactNode;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  /** último campo do formulário — reduz a margem inferior para colar no botão/erro seguinte */
  last?: boolean;
}) {
  return (
    <div className={last ? 'mb-5' : 'mb-4'}>
      <label className="text-xs font-bold text-navy-700 uppercase tracking-wide block mb-1.5" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-300 rounded-xl pl-10 pr-3.5 py-3 text-sm text-navy-900 outline-none transition-all focus:border-brandgreen-500 focus:ring-4 focus:ring-brandgreen-500/10"
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  autoFocus,
  last,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  last?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={last ? 'mb-5' : 'mb-4'}>
      {/* label vazio = a página já renderiza o rótulo (ex.: ao lado de um link "Esqueci minha senha") */}
      {label && (
        <label className="text-xs font-bold text-navy-700 uppercase tracking-wide block mb-1.5" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <IconLock />
        </span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-300 rounded-xl pl-10 pr-10 py-3 text-sm text-navy-900 outline-none transition-all focus:border-brandgreen-500 focus:ring-4 focus:ring-brandgreen-500/10"
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy-700 transition-colors p-0.5"
        >
          {show ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
    </div>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl px-3.5 py-3 mb-5">
      <span className="shrink-0 mt-0.5">
        <IconAlertCircle />
      </span>
      {children}
    </div>
  );
}

export function SubmitButton({
  loading,
  loadingLabel,
  children,
  variant = 'dark',
}: {
  loading?: boolean;
  loadingLabel: string;
  children: React.ReactNode;
  variant?: 'dark' | 'green';
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 ${
        variant === 'dark' ? 'bg-navy-900 text-white hover:bg-navy-800' : 'bg-brandgreen-600 text-white hover:bg-brandgreen-700'
      }`}
    >
      {loading ? (
        <>
          <IconSpinner /> {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Estado de sucesso — mesmo layout usado ao final de "solicitar acesso" e "recuperar senha". */
export function SuccessState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="text-center py-2">
      <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-brandgreen-500/10 text-brandgreen-600 flex items-center justify-center">
        <IconCheckCircle />
      </div>
      <h1 className="text-lg font-extrabold text-navy-900 mb-2">{title}</h1>
      <p className="text-sm text-slate-500 leading-relaxed mb-6">{children}</p>
      {action}
    </div>
  );
}
