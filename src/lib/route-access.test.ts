import { describe, expect, it } from 'vitest';
import { ADMIN_ONLY_PREFIXES, isAllowed } from './route-access';

describe('isAllowed', () => {
  it('ADMIN acessa qualquer rota', () => {
    for (const path of ['/', '/inspections', ...ADMIN_ONLY_PREFIXES]) {
      expect(isAllowed(path, 'ADMIN')).toBe(true);
    }
  });

  it('SUPERVISOR acessa as rotas operacionais', () => {
    for (const path of ['/', '/models', '/schedule', '/inspections', '/inspections/abc', '/non-conformities']) {
      expect(isAllowed(path, 'SUPERVISOR')).toBe(true);
    }
  });

  it('SUPERVISOR não acessa as áreas restritas a ADMIN, nem subrotas', () => {
    for (const prefix of ADMIN_ONLY_PREFIXES) {
      expect(isAllowed(prefix, 'SUPERVISOR')).toBe(false);
      expect(isAllowed(`${prefix}/123`, 'SUPERVISOR')).toBe(false);
    }
  });

  it('não confunde rotas que só começam com o mesmo texto', () => {
    expect(isAllowed('/users-report', 'SUPERVISOR')).toBe(true);
  });
});
