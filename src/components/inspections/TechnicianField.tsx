'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { TechnicianSelect } from './TechnicianSelect';

/** Seletor de técnico ligado ao store: carrega os técnicos ativos ao montar. */
export function TechnicianField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (technicianId: string) => void;
  disabled?: boolean;
}) {
  const users = useAppStore((s) => s.users);
  const status = useAppStore((s) => s.techniciansStatus);
  const error = useAppStore((s) => s.techniciansError);
  const loadTechnicians = useAppStore((s) => s.loadTechnicians);

  useEffect(() => {
    void loadTechnicians();
  }, [loadTechnicians]);

  return (
    <TechnicianSelect
      id={id}
      value={value}
      users={users}
      status={status}
      error={error}
      disabled={disabled}
      onChange={onChange}
      onRetry={() => void loadTechnicians()}
    />
  );
}
