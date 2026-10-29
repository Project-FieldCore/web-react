import { formatInstructions } from '@/lib/inspection-display';

/**
 * Orientações do supervisor para o técnico. Preserva as quebras de linha
 * digitadas no agendamento e mostra um aviso discreto quando não há nenhuma.
 */
export function InspectionInstructions({ text }: { text?: string | null }) {
  const instructions = formatInstructions(text);
  return (
    <section aria-label="Orientações" className="sm:col-span-2">
      <h2 className="text-slate-400 text-xs uppercase font-bold mb-1">Orientações</h2>
      {instructions ? (
        <p className="whitespace-pre-wrap break-words text-slate-700">{instructions}</p>
      ) : (
        <p className="text-slate-400 italic">Sem orientações.</p>
      )}
    </section>
  );
}
