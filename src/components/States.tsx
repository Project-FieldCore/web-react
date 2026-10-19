/**
 * Estados padronizados de carregamento, vazio e erro (#137). Todas as telas
 * usam estes componentes em vez de markup ad hoc, para manter o mesmo visual
 * e o mesmo comportamento de acessibilidade (role/aria) em todo o painel.
 */

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="px-5 py-10 flex flex-col items-center gap-3 text-slate-400 text-sm">
      <span className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-navy-700 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="mt-3 text-sm font-bold text-navy-700">
          {action.label}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Algo deu errado',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="px-5 py-10 text-center">
      <p className="text-sm font-bold text-red-700">{title}</p>
      <p className="text-xs text-red-600 mt-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-sm font-bold text-navy-700">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Erro de uma ação (salvar, enviar...) exibido junto ao formulário/botão. */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">
      {message}
    </div>
  );
}
