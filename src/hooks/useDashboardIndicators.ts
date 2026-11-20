'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchDashboardIndicators, type DashboardIndicators } from '@/lib/dashboard-api';
import { describeLoadError, type LoadErrorCopy } from '@/lib/state-copy';

export type DashboardIndicatorsState =
  | { status: 'loading' }
  | { status: 'error'; error: LoadErrorCopy; reload: () => void }
  | { status: 'ready'; data: DashboardIndicators; reload: () => void };

/** Carrega os indicadores do dashboard (`GET /dashboard/indicators`) com loading/erro/retry. */
export function useDashboardIndicators(): DashboardIndicatorsState {
  const [state, setState] = useState<DashboardIndicatorsState>({ status: 'loading' });
  const [token, setToken] = useState(0);
  const reload = useCallback(() => setToken((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void fetchDashboardIndicators()
      .then((data) => {
        if (active) setState({ status: 'ready', data, reload });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', error: describeLoadError(error, 'Não foi possível carregar os indicadores.'), reload });
      });
    return () => {
      active = false;
    };
  }, [token, reload]);

  return state;
}
