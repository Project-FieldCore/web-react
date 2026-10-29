'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { InlineError } from '@/components/States';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import {
  MAX_INSTRUCTIONS,
  isLocalOnlySchedule,
  missingScheduleFields,
  validateScheduleDate,
} from '@/lib/schedule-rules';
import type { Priority } from '@/types';

const PRIORITY_LABEL: Record<Priority, string> = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };

/**
 * UC-06 — Agendar e atribuir inspeção.
 * RN-024: precisa de versão publicada do modelo.
 * RN-025: cliente, local, técnico e data prevista são obrigatórios.
 * RN-027: somente técnico ativo pode receber nova atribuição.
 */
export default function SchedulePage() {
  const router = useRouter();
  const models = useAppStore((s) => s.models.filter((m) => m.status === 'PUBLICADO'));
  const clients = useAppStore((s) => s.clients);
  const clientsStatus = useAppStore((s) => s.clientsStatus);
  const loadClients = useAppStore((s) => s.loadClients);
  const locations = useAppStore((s) => s.locations);
  const locationsStatus = useAppStore((s) => s.locationsStatus);
  const loadLocations = useAppStore((s) => s.loadLocations);
  const equipment = useAppStore((s) => s.equipment);
  const technicians = useAppStore((s) => s.users.filter((u) => u.role === 'TECHNICIAN'));
  const scheduleInspection = useAppStore((s) => s.scheduleInspection);

  const [modeloId, setModeloId] = useState(models[0]?.id ?? '');
  const [clienteId, setClienteId] = useState('');
  const [localId, setLocalId] = useState('');
  const [equipamentoId, setEquipamentoId] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [prioridade, setPrioridade] = useState<Priority>('MEDIA');
  const [dataPrevista, setDataPrevista] = useState('');
  const [orientacoes, setOrientacoes] = useState('');
  const submit = useAsyncAction();
  const [success, setSuccess] = useState<string | null>(null);

  // Clientes vêm da API; cliente inativo fica fora de novos agendamentos.
  useEffect(() => {
    void loadClients();
    void loadLocations();
  }, [loadClients, loadLocations]);
  const activeClients = useMemo(() => clients.filter((c) => c.ativo), [clients]);
  const clientsLoading = clientsStatus === 'idle' || clientsStatus === 'loading';

  // Local inativo (inativação lógica) fica fora de novos agendamentos.
  const availableLocations = useMemo(
    () => locations.filter((l) => l.clienteId === clienteId && l.ativo),
    [locations, clienteId]
  );
  const locationsLoading = locationsStatus === 'idle' || locationsStatus === 'loading';
  const availableEquipment = useMemo(() => equipment.filter((e) => e.localId === localId), [equipment, localId]);

  const selectedModel = models.find((m) => m.id === modeloId);
  const selectedClient = clients.find((c) => c.id === clienteId);
  const selectedLocation = locations.find((l) => l.id === localId);
  const selectedEquipment = equipment.find((e) => e.id === equipamentoId);
  const selectedTech = technicians.find((t) => t.id === tecnicoId);
  const activeTechnicians = technicians.filter((t) => t.status === 'ATIVO');
  const localOnly = isLocalOnlySchedule(selectedModel);

  // RN-025: campos obrigatórios para habilitar o envio; a API também exige data futura.
  const missing = missingScheduleFields({ modeloId, clienteId, localId, tecnicoId, dataPrevista });
  const dateError = validateScheduleDate(dataPrevista);
  const isComplete = missing.length === 0 && !dateError;

  // `min` do campo de data: agora, no fuso local (formato do datetime-local). Calculado só depois de
  // montar, para o servidor e o navegador não divergirem na hidratação.
  const [minDateTime, setMinDateTime] = useState<string | undefined>(undefined);
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setMinDateTime(now.toISOString().slice(0, 16));
  }, []);

  async function handleSubmit() {
    setSuccess(null);
    const result = await submit.run(() => scheduleInspection({
      modeloId,
      clienteId,
      localId,
      equipamentoId: equipamentoId || undefined,
      tecnicoId,
      prioridade,
      dataPrevista: dataPrevista ? new Date(dataPrevista).toISOString() : '',
      orientacoes,
    }));
    if (!result.ok) return;
    setSuccess(`Inspeção ${result.id} agendada e atribuída a ${selectedTech?.nome ?? 'o técnico'}.`);
    setTimeout(() => router.push('/inspections'), 900);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Agendar inspeção</h1>
      <p className="text-sm text-slate-500 mb-6">Selecione o modelo publicado, o local e o técnico responsável (UC-06)</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 min-w-0">
          <Section step={1} title="Modelo de inspeção">
            <Field label="Modelo (apenas versões publicadas)" required>
              <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className="input">
                <option value="">Selecione...</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.title} · v{m.version}</option>
                ))}
              </select>
            </Field>
            {models.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Nenhum modelo publicado disponível. Publique uma versão em Modelos de inspeção (RN-024).
              </p>
            )}
            {selectedModel && localOnly && (
              <p role="note" className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-3">
                Este modelo ainda não está ligado a uma versão publicada na API. O agendamento fica só nesta sessão e não é
                enviado ao servidor.
              </p>
            )}
          </Section>

          <Section step={2} title="Cliente e local">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Cliente" required>
                <select
                  value={clienteId}
                  onChange={(e) => { setClienteId(e.target.value); setLocalId(''); setEquipamentoId(''); }}
                  disabled={clientsLoading}
                  className="input disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">{clientsLoading ? 'Carregando clientes...' : 'Selecione...'}</option>
                  {activeClients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {clientsStatus === 'ready' && activeClients.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">Nenhum cliente ativo. Cadastre ou ative um cliente em Clientes e locais.</p>
                )}
                {clientsStatus === 'error' && (
                  <p role="alert" className="text-xs text-red-600 font-semibold mt-1">
                    Não foi possível carregar os clientes.{' '}
                    <button type="button" onClick={() => void loadClients()} className="underline">
                      Tentar novamente
                    </button>
                  </p>
                )}
              </Field>
              <Field label="Local" required>
                <select
                  value={localId}
                  onChange={(e) => { setLocalId(e.target.value); setEquipamentoId(''); }}
                  disabled={!clienteId || locationsLoading}
                  className="input disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {!clienteId ? 'Selecione um cliente primeiro' : locationsLoading ? 'Carregando locais...' : 'Selecione...'}
                  </option>
                  {availableLocations.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
                {clienteId && locationsStatus === 'ready' && availableLocations.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">Este cliente não tem locais ativos. Cadastre um local no cliente.</p>
                )}
                {locationsStatus === 'error' && (
                  <p role="alert" className="text-xs text-red-600 font-semibold mt-1">
                    Não foi possível carregar os locais.{' '}
                    <button type="button" onClick={() => void loadLocations()} className="underline">
                      Tentar novamente
                    </button>
                  </p>
                )}
              </Field>
            </div>
            <Field label="Equipamento (opcional para inspeções de local/ambiente — RN-026)">
              <select
                value={equipamentoId}
                onChange={(e) => setEquipamentoId(e.target.value)}
                disabled={!localId}
                className="input disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Nenhum equipamento específico</option>
                {availableEquipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </select>
              {equipamentoId && !localOnly && (
                <p className="text-xs text-slate-500 mt-1">
                  O equipamento fica registrado só na tela: a API de agendamento ainda não o recebe.
                </p>
              )}
            </Field>
          </Section>

          <Section step={3} title="Responsável e agenda">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Técnico responsável" required>
                <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className="input">
                  <option value="">Selecione...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.status !== 'ATIVO'}>{t.nome}{t.status !== 'ATIVO' ? ' (inativo)' : ''}</option>
                  ))}
                </select>
                {activeTechnicians.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">Nenhum técnico ativo disponível para atribuição (RN-027).</p>
                )}
              </Field>
              <Field label="Prioridade" required>
                <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Priority)} className="input">
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Média</option>
                  <option value="BAIXA">Baixa</option>
                </select>
              </Field>
            </div>
            <Field label="Data e hora previstas" required>
              <input
                type="datetime-local"
                value={dataPrevista}
                min={minDateTime}
                onChange={(e) => setDataPrevista(e.target.value)}
                aria-invalid={dateError ? true : undefined}
                aria-describedby={dateError ? 'schedule-date-error' : undefined}
                className="input sm:max-w-xs"
              />
              {dateError && (
                <p id="schedule-date-error" role="alert" className="text-xs text-red-600 font-semibold mt-1">
                  {dateError}
                </p>
              )}
            </Field>
          </Section>

          <Section step={4} title="Observações">
            <Field label="Orientações adicionais">
              <textarea
                value={orientacoes}
                onChange={(e) => setOrientacoes(e.target.value)}
                rows={3}
                maxLength={MAX_INSTRUCTIONS}
                className="input resize-none"
                placeholder="Instruções específicas para o técnico, pontos de atenção, etc."
              />
              <p className="text-[11px] text-slate-400 text-right mt-1">
                {orientacoes.length}/{MAX_INSTRUCTIONS}
              </p>
            </Field>
          </Section>

          <div className="p-6 pt-5">
            {submit.error && <div className="mb-4"><InlineError message={submit.error} /></div>}
            {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl px-4 py-3 mb-4">{success}</div>}

            <button
              onClick={handleSubmit}
              disabled={!isComplete || submit.pending || !!success}
              className="w-full bg-brandgreen-600 text-white rounded-xl py-3 font-bold transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {submit.pending ? 'Agendando...' : 'Confirmar agendamento'}
            </button>
            {missing.length > 0 && (
              <p className="text-xs text-slate-400 text-center mt-2">
                Preencha os campos obrigatórios: {missing.join(', ')}.
              </p>
            )}
            {missing.length === 0 && dateError && (
              <p className="text-xs text-red-600 text-center mt-2">{dateError}</p>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-xs font-bold text-navy-700 uppercase mb-3">Resumo do agendamento</h2>
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Modelo" value={selectedModel ? `${selectedModel.title} · v${selectedModel.version}` : undefined} />
              <SummaryRow label="Cliente" value={selectedClient?.nome} />
              <SummaryRow label="Local" value={selectedLocation?.nome} />
              <SummaryRow label="Equipamento" value={selectedEquipment?.nome ?? (localId ? 'Nenhum específico' : undefined)} />
              <SummaryRow label="Técnico" value={selectedTech?.nome} />
              <SummaryRow label="Prioridade" value={PRIORITY_LABEL[prioridade]} />
              <SummaryRow label="Data prevista" value={dataPrevista ? new Date(dataPrevista).toLocaleString('pt-BR') : undefined} />
            </dl>
          </div>

          <div className="bg-navy-900 text-white rounded-2xl p-5">
            <h2 className="text-xs font-bold text-brandgreen-500 uppercase mb-2">Regras de negócio</h2>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <li><strong className="text-white">RN-024</strong> — Somente modelos com versão publicada podem ser usados.</li>
              <li><strong className="text-white">RN-025</strong> — Cliente, local, técnico e data prevista (no futuro) são obrigatórios.</li>
              <li><strong className="text-white">Estado inicial</strong> — A inspeção nasce Atribuída ao técnico escolhido.</li>
              <li><strong className="text-white">RN-027</strong> — Apenas técnicos ativos podem receber novas atribuições.</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:disabled {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {step}
        </span>
        <h2 className="text-sm font-bold text-navy-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-navy-700 uppercase block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-400 font-semibold shrink-0">{label}</dt>
      <dd className={`text-right font-semibold ${value ? 'text-navy-900' : 'text-slate-300 italic'}`}>{value ?? 'Pendente'}</dd>
    </div>
  );
}
