/**
 * useWendyPageContext — imposta il contesto della pagina corrente per Wendy.
 *
 * Esteso per supportare il formato WendyPageContext del router (entityType, entityId, ecc.)
 * Compatibile con il WendyProvider esistente tramite il campo `data`.
 */
import { useEffect, useRef } from 'react';
import { useWendy, type PageContext } from '../contexts/WendyProvider';

export interface WendyPageContextInput {
  page:        string;
  title?:      string | undefined;
  entityType?: "sector" | "profession" | "article" | "news" | undefined;
  entityId?:   number | undefined;
  entityName?: string | undefined;
  journeyType?: string | undefined;
  capabilities?: string[] | undefined;
  fields?:       string[] | undefined;
  actions?:      string[] | undefined;
  sector?: string | undefined;
  roleTitle?: string | undefined;
  currentTryADayScene?: string | null | undefined;
  adaptivePhase?: string | undefined;
  adaptiveNextAction?: {
    label: string;
    href: string;
    sectionId?: string | undefined;
  } | undefined;
  clarityScore?: number | undefined;
  savedSectorsCount?: number | undefined;
  readinessBand?: string | undefined;
}

function listKey(values: string[] | undefined): string {
  return values ? `list:${values.join("\u001f")}` : "none";
}

function actionKey(action: WendyPageContextInput["adaptiveNextAction"]): string {
  return action ? `action:${[action.label, action.href, action.sectionId ?? ""].join("\u001f")}` : "none";
}

function useStableList(values: string[] | undefined): string[] | undefined {
  const key = listKey(values);
  const ref = useRef<{ key: string; value: string[] | undefined }>({
    key,
    value: values,
  });

  if (ref.current.key !== key) {
    ref.current = { key, value: values };
  }

  return ref.current.value;
}

function useStableAdaptiveNextAction(
  action: WendyPageContextInput["adaptiveNextAction"],
): WendyPageContextInput["adaptiveNextAction"] {
  const key = actionKey(action);
  const ref = useRef<{
    key: string;
    value: WendyPageContextInput["adaptiveNextAction"];
  }>({
    key,
    value: action,
  });

  if (ref.current.key !== key) {
    ref.current = { key, value: action };
  }

  return ref.current.value;
}

/**
 * Imposta il contesto Wendy per la pagina corrente.
 * Si resetta a "default" quando il componente viene smontato.
 *
 * @example
 * // In una pagina settore:
 * useWendyPageContext({
 *   page: "settore",
 *   title: "Tecnologia & Software",
 *   entityType: "sector",
 *   entityId: 3,
 *   entityName: "Tecnologia & Software",
 * });
 */
export function useWendyPageContext(ctx: WendyPageContextInput): void {
  const { setPageContext } = useWendy();
  const capabilities = useStableList(ctx.capabilities);
  const fields = useStableList(ctx.fields);
  const actions = useStableList(ctx.actions);
  const adaptiveNextAction = useStableAdaptiveNextAction(ctx.adaptiveNextAction);

  useEffect(() => {
    const pageCtx: PageContext = {
      page:  ctx.page,
      title: ctx.title,
      data: {
        entityType:  ctx.entityType,
        entityId:    ctx.entityId,
        entityName:  ctx.entityName,
        journeyType: ctx.journeyType,
        capabilities,
        fields,
        actions,
        sector:       ctx.sector,
        roleTitle:    ctx.roleTitle,
        currentTryADayScene: ctx.currentTryADayScene,
        adaptivePhase: ctx.adaptivePhase,
        adaptiveNextAction,
        clarityScore: ctx.clarityScore,
        savedSectorsCount: ctx.savedSectorsCount,
        readinessBand: ctx.readinessBand,
      },
    };
    setPageContext(pageCtx);
    return () => setPageContext({ page: 'default' });
  }, [
    ctx.page,
    ctx.title,
    ctx.entityType,
    ctx.entityId,
    ctx.entityName,
    ctx.journeyType,
    capabilities,
    fields,
    actions,
    ctx.sector,
    ctx.roleTitle,
    ctx.currentTryADayScene,
    ctx.adaptivePhase,
    adaptiveNextAction,
    ctx.clarityScore,
    ctx.savedSectorsCount,
    ctx.readinessBand,
    setPageContext,
  ]);
}
