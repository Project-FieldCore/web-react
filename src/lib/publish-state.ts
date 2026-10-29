import { validateModel, type ModelIssue } from './model-validation';
import { hasUnpublishedChanges } from './model-versions';
import type { InspectionModel } from '@/types';

/**
 * Tudo que o construtor precisa saber para publicar (PBI-0023.1), em lógica
 * pura: em que modo o modelo está, quais pendências existem, se há algo novo
 * para publicar e, se não pode, por quê. A tela só mostra o que sair daqui.
 */

/** `draft`: nunca publicado · `published`: versão publicada, imutável · `editing`: nova versão em edição. */
export type PublishMode = 'draft' | 'published' | 'editing';

export interface PublishState {
  mode: PublishMode;
  /** Nada pode ser alterado (RN-019). */
  locked: boolean;
  /** Dá para começar uma nova versão (só modelo publicado, fora de edição). */
  canStartNewVersion: boolean;
  errors: ModelIssue[];
  warnings: ModelIssue[];
  hasChanges: boolean;
  canPublish: boolean;
  /** Por que não dá para publicar (null quando dá). */
  reason: string | null;
  publishLabel: string;
}

export function publishState(model: InspectionModel): PublishState {
  const issues = validateModel(model);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const mode: PublishMode = model.status === 'RASCUNHO' ? 'draft' : model.editingNewVersion ? 'editing' : 'published';
  const locked = mode === 'published';
  const hasChanges = hasUnpublishedChanges(model);

  let reason: string | null = null;
  if (locked) {
    reason =
      model.status === 'ARQUIVADO'
        ? 'Este modelo está arquivado e não pode ser publicado.'
        : `A versão v${model.version} já está publicada e é imutável. Crie uma nova versão para alterá-la.`;
  } else if (errors.length > 0) {
    reason = errors.length === 1 ? 'Resolva a pendência para publicar.' : `Resolva as ${errors.length} pendências para publicar.`;
  } else if (!hasChanges) {
    reason = `Nenhuma alteração desde a versão v${model.version}. Altere o modelo para publicar uma nova versão.`;
  }

  return {
    mode,
    locked,
    canStartNewVersion: model.status === 'PUBLICADO' && !model.editingNewVersion,
    errors,
    warnings,
    hasChanges,
    canPublish: reason === null,
    reason,
    publishLabel: mode === 'draft' ? 'Publicar versão' : 'Publicar nova versão',
  };
}
