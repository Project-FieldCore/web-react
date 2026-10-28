'use client';

import { PAGE_SIZE_OPTIONS, type PageMeta, type Sort } from '@/lib/paged-list';

/** Campo de busca textual (o debounce fica no usePagedList). */
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 w-full sm:w-64"
    />
  );
}

/** Filtro explícito de lista (ex.: perfil, status). */
export function FilterSelect<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as V)}
      aria-label={label}
      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export interface SortOption {
  label: string;
  sort: Sort;
}

/** Ordenação por seletor (para listas em cartões, sem cabeçalho de tabela). */
export function SortSelect({
  value,
  options,
  onChange,
}: {
  value: Sort;
  options: SortOption[];
  onChange: (sort: Sort) => void;
}) {
  const index = options.findIndex((o) => o.sort.field === value.field && o.sort.dir === value.dir);
  return (
    <select
      value={index}
      onChange={(e) => onChange(options[Number(e.target.value)].sort)}
      aria-label="Ordenar por"
      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white"
    >
      {options.map((o, i) => (
        <option key={`${o.sort.field}-${o.sort.dir}`} value={i}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Cabeçalho de tabela clicável: ordena pelo campo e mostra a direção atual. */
export function SortableTh({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: Sort;
  onSort: (field: string) => void;
}) {
  const active = sort.field === field;
  return (
    <th className="px-5 py-3" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 uppercase font-inherit">
        {label}
        <span aria-hidden="true" className={active ? 'text-navy-700' : 'text-slate-300'}>
          {active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

/** "Mostrando 21–40 de 135", página anterior/próxima e itens por página. */
export function Pagination({
  meta,
  onPage,
  onSize,
  sizeOptions = PAGE_SIZE_OPTIONS,
}: {
  meta: PageMeta | null;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  sizeOptions?: number[];
}) {
  if (!meta || meta.totalElements === 0) return null;
  const from = meta.page * meta.size + 1;
  const to = Math.min((meta.page + 1) * meta.size, meta.totalElements);
  const hasPrevious = meta.page > 0;
  const hasNext = meta.page + 1 < meta.totalPages;
  const options = sizeOptions.includes(meta.size) ? sizeOptions : [...sizeOptions, meta.size].sort((a, b) => a - b);
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 flex-wrap px-1 py-3 text-xs text-slate-500">
      <span>
        Mostrando {from}–{to} de {meta.totalElements}
      </span>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5">
          Por página
          <select
            value={meta.size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-600 bg-white"
          >
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(meta.page - 1)}
            disabled={!hasPrevious}
            className="px-2.5 py-1 rounded-lg border border-slate-300 font-semibold text-slate-600 disabled:opacity-40"
          >
            Anterior
          </button>
          <span aria-current="page">
            Página {meta.page + 1} de {Math.max(meta.totalPages, 1)}
          </span>
          <button
            type="button"
            onClick={() => onPage(meta.page + 1)}
            disabled={!hasNext}
            className="px-2.5 py-1 rounded-lg border border-slate-300 font-semibold text-slate-600 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </nav>
  );
}
