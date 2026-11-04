import { activeTechnicians } from '@/lib/technician-rules';
import type { User } from '@/types';

export type TechniciansLoadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

/**
 * Seletor de técnico (RN-027): lista só técnicos ativos, em ordem alfabética, e
 * explica cada estado — carregando, erro (com nova tentativa), sem técnicos
 * ativos e lista indisponível para o perfil. Apresentação pura: quem usa
 * decide de onde vêm os dados (veja `TechnicianField`).
 */
export function TechnicianSelect({
  id,
  value,
  users,
  status,
  error,
  disabled,
  onChange,
  onRetry,
}: {
  id: string;
  value: string;
  users: User[];
  status: TechniciansLoadStatus;
  error?: string | null;
  disabled?: boolean;
  onChange: (technicianId: string) => void;
  onRetry?: () => void;
}) {
  const technicians = activeTechnicians(users);
  const loading = status === 'idle' || status === 'loading';
  const hasOptions = technicians.length > 0;
  const noteId = `${id}-note`;
  const showEmpty = status === 'ready' && !hasOptions;
  const showUnavailable = status === 'unavailable' && !hasOptions;
  const showError = status === 'error';
  const hasNote = showEmpty || showUnavailable || showError || (status === 'unavailable' && hasOptions);

  return (
    <div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading || (!hasOptions && !value)}
        aria-describedby={hasNote ? noteId : undefined}
        aria-busy={loading || undefined}
        className="input disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">{loading ? 'Carregando técnicos...' : hasOptions ? 'Selecione...' : 'Nenhum técnico disponível'}</option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>

      {showEmpty && (
        <p id={noteId} className="text-xs text-amber-700 mt-1">
          Nenhum técnico ativo disponível para atribuição (RN-027).
        </p>
      )}
      {(showUnavailable || (status === 'unavailable' && hasOptions)) && (
        <p id={noteId} role="note" className="text-xs text-slate-600 mt-1">
          {error ?? 'A lista de técnicos não está disponível para o seu perfil.'}
        </p>
      )}
      {showError && (
        <p id={noteId} role="alert" className="text-xs text-red-600 font-semibold mt-1">
          {error ?? 'Não foi possível carregar os técnicos.'}
          {onRetry && (
            <>
              {' '}
              <button type="button" onClick={onRetry} className="underline">
                Tentar novamente
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
