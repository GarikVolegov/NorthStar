import { ItemGroup, Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, Button } from "@northstar/web";

export const List = () => (
  <ItemGroup className="w-[400px] gap-2">
    <Item variant="outline">
      <ItemMedia variant="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /></svg>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Connect a data source</ItemTitle>
        <ItemDescription>Sync transactions automatically.</ItemDescription>
      </ItemContent>
      <ItemActions><Button size="sm" variant="outline">Connect</Button></ItemActions>
    </Item>
    <Item variant="muted">
      <ItemMedia variant="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Verify your email</ItemTitle>
        <ItemDescription>Completed just now.</ItemDescription>
      </ItemContent>
    </Item>
  </ItemGroup>
);
