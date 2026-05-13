import { useEffect } from 'react';
import { useWendy, type PageContext } from '../contexts/WendyProvider';

export function useWendyPageContext(ctx: PageContext): void {
  const { setPageContext } = useWendy();

  useEffect(() => {
    setPageContext(ctx);
    return () => setPageContext({ page: 'default' });
  }, [ctx.page, ctx.title, setPageContext]);
}
