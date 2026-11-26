import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/Shell';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'FieldCore — Painel Administrativo',
  description: 'Inspeções em campo, resultados que conectam.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura (sem piscar o tema claro). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen text-slate-900">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
