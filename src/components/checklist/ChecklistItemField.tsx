'use client';

import { useId } from 'react';
import {
  BOOLEAN_CHOICES,
  CONFORMITY_CHOICES,
  choiceOptions,
  failureRequirements,
  fieldKind,
  showsFailureDetails,
  type PreviewAnswer,
} from '@/lib/item-field';
import type { ModelItem } from '@/types';

const INPUT_CLASS = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white';

interface Choice {
  value: string;
  label: string;
  /** Cores quando selecionada (strings completas, para o Tailwind enxergar). */
  checkedClass?: string;
}

const DEFAULT_CHECKED = 'peer-checked:bg-navy-800 peer-checked:border-navy-800 peer-checked:text-white';

const CONFORMITY_CHECKED: Record<string, string> = {
  CONFORME: 'peer-checked:bg-emerald-600 peer-checked:border-emerald-600 peer-checked:text-white',
  NAO_CONFORME: 'peer-checked:bg-red-600 peer-checked:border-red-600 peer-checked:text-white',
  NAO_APLICAVEL: 'peer-checked:bg-slate-500 peer-checked:border-slate-500 peer-checked:text-white',
};

/** Grupo de opções (radio) com aparência de botões; acessível por teclado e leitor de tela. */
function ChoiceGroup({
  name,
  labelledBy,
  choices,
  selected,
  onSelect,
}: {
  name: string;
  labelledBy: string;
  choices: Choice[];
  selected: string | undefined;
  onSelect: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2 mt-2">
      {choices.map((choice) => (
        <label key={choice.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={selected === choice.value}
            onChange={() => onSelect(choice.value)}
            className="sr-only peer"
          />
          <span
            className={`block px-3 py-1.5 rounded-lg text-xs font-bold border bg-white border-slate-300 text-slate-600 peer-focus-visible:ring-2 peer-focus-visible:ring-navy-700 ${
              choice.checkedClass ?? DEFAULT_CHECKED
            }`}
          >
            {choice.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * Campo de um item do checklist, com o controle certo para cada tipo de
 * resposta (texto curto/longo, número, data, sim/não, conforme/não conforme e
 * seleção única). É controlado de fora: quem usa decide onde guardar a resposta
 * (a prévia guarda só na tela).
 */
export function ChecklistItemField({
  item,
  answer,
  onChange,
}: {
  item: ModelItem;
  answer?: PreviewAnswer;
  onChange: (patch: PreviewAnswer) => void;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const kind = fieldKind(item.type);
  const title = item.title.trim();
  const value = answer?.value ?? '';

  return (
    <div className="border border-slate-200 rounded-xl p-3.5 bg-white" data-item-type={item.type}>
      <div id={labelId} className="text-sm font-semibold text-navy-900">
        {title || <span className="italic text-slate-400">Item sem título</span>}
        {item.required && (
          <>
            <span aria-hidden="true" className="text-red-600 ml-1">*</span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        )}
      </div>

      {kind === 'text' && (
        <input id={`${id}-input`} type="text" aria-labelledby={labelId} value={value} onChange={(e) => onChange({ value: e.target.value })} className={`${INPUT_CLASS} mt-2`} />
      )}
      {kind === 'textarea' && (
        <textarea id={`${id}-input`} aria-labelledby={labelId} rows={3} value={value} onChange={(e) => onChange({ value: e.target.value })} className={`${INPUT_CLASS} mt-2`} />
      )}
      {kind === 'number' && (
        <input id={`${id}-input`} type="number" inputMode="decimal" aria-labelledby={labelId} value={value} onChange={(e) => onChange({ value: e.target.value })} className={`${INPUT_CLASS} mt-2`} />
      )}
      {kind === 'date' && (
        <input id={`${id}-input`} type="date" aria-labelledby={labelId} value={value} onChange={(e) => onChange({ value: e.target.value })} className={`${INPUT_CLASS} mt-2`} />
      )}
      {kind === 'boolean' && (
        <ChoiceGroup name={id} labelledBy={labelId} choices={BOOLEAN_CHOICES} selected={answer?.value} onSelect={(v) => onChange({ value: v })} />
      )}
      {kind === 'conformity' && (
        <ChoiceGroup
          name={id}
          labelledBy={labelId}
          choices={CONFORMITY_CHOICES.map((c) => ({ ...c, checkedClass: CONFORMITY_CHECKED[c.value] }))}
          selected={answer?.conformity}
          onSelect={(v) => onChange({ conformity: v as NonNullable<PreviewAnswer['conformity']> })}
        />
      )}
      {kind === 'choice' &&
        (choiceOptions(item).length === 0 ? (
          <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
            Este item é de seleção única, mas ainda não tem alternativas.
          </p>
        ) : (
          <ChoiceGroup
            name={id}
            labelledBy={labelId}
            choices={choiceOptions(item).map((o) => ({ value: o, label: o }))}
            selected={answer?.value}
            onSelect={(v) => onChange({ value: v })}
          />
        ))}

      {showsFailureDetails(item, answer) && <FailureDetails id={id} item={item} answer={answer} onChange={onChange} />}
    </div>
  );
}

/** Observação e evidência de um item respondido "não conforme", com o que é obrigatório marcado. */
function FailureDetails({
  id,
  item,
  answer,
  onChange,
}: {
  id: string;
  item: ModelItem;
  answer?: PreviewAnswer;
  onChange: (patch: PreviewAnswer) => void;
}) {
  const required = failureRequirements(item);
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3" data-failure-details>
      <div>
        <label htmlFor={`${id}-obs`} className="text-xs font-bold text-navy-700 block mb-1">
          Observação{required.observation && <span className="text-red-600"> · obrigatória</span>}
        </label>
        <textarea
          id={`${id}-obs`}
          rows={2}
          value={answer?.observacao ?? ''}
          onChange={(e) => onChange({ observacao: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <div className="text-xs font-bold text-navy-700 mb-1">
          Evidência{required.evidence && <span className="text-red-600"> · obrigatória</span>}
        </div>
        <button type="button" disabled className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-400">
          Anexar evidência
        </button>
        <p className="text-[11px] text-slate-400 mt-1">O anexo de evidência não está disponível na prévia.</p>
      </div>
    </div>
  );
}
