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
  title?:      string;
  entityType?: "sector" | "profession" | "article" | "news";
  entityId?:   number;
  entityName?: string;
  journeyType?: string;
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
      },
    };
    setPageContext(pageCtx);
    return () => setPageContext({ page: 'default' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.page, ctx.entityId, ctx.journeyType, setPageContext]);
}
