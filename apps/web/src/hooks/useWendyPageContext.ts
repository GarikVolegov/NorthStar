/**
 * useWendyPageContext — imposta il contesto della pagina corrente per Wendy.
 *
 * Esteso per supportare il formato WendyPageContext del router (entityType, entityId, ecc.)
 * Compatibile con il WendyProvider esistente tramite il campo `data`.
 */
import { useEffect } from 'react';
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

  useEffect(() => {
    const pageCtx: PageContext = {
      page:  ctx.page,
      title: ctx.title,
      data: {
        entityType:  ctx.entityType,
        entityId:    ctx.entityId,
        entityName:  ctx.entityName,
        journeyType: ctx.journeyType,
        capabilities: ctx.capabilities,
        fields:       ctx.fields,
        actions:      ctx.actions,
        sector:       ctx.sector,
        roleTitle:    ctx.roleTitle,
        currentTryADayScene: ctx.currentTryADayScene,
      },
    };
    setPageContext(pageCtx);
    return () => setPageContext({ page: 'default' });
  }, [ctx.page, ctx.entityId, ctx.entityName, ctx.journeyType, ctx.currentTryADayScene, setPageContext]);
}
