# NorthStar UI — conventions for building with this library

This is **NorthStar**, a React + Tailwind v4 component library (shadcn/ui "new-york",
Radix-based) on the **Deep Navy Premium** theme. The signature accent is a muted **gold**
(`--primary`). Build screens by composing the exported components and styling your own
layout with the Tailwind utilities below — **do not hand-write component CSS or invent
class names**; the design language lives in the theme tokens.

## Styling idiom — semantic theme tokens (use these, not raw colors)

Every color comes from a CSS-variable token consumed through a Tailwind utility. Use the
semantic utility, never `bg-[#hex]` or `text-gray-500`. Each token has matching
`bg-*`, `text-*`, and `border-*` utilities; foreground tokens are the readable color
*on* their pair:

| Surface / role | Utilities |
|---|---|
| Page / base | `bg-background` `text-foreground` |
| Card, panel | `bg-card` `text-card-foreground` `border-border` |
| Primary action (gold) | `bg-primary` `text-primary-foreground` |
| Secondary | `bg-secondary` `text-secondary-foreground` |
| Muted / subtle | `bg-muted` `text-muted-foreground` |
| Accent / hover | `bg-accent` `text-accent-foreground` |
| Destructive | `bg-destructive` `text-destructive-foreground` |
| Inputs / focus | `border-input` `ring-ring` |
| Charts | `--chart-1` … `--chart-5` (use as `hsl(var(--chart-1))`) |

Radius: `rounded-md` / `rounded-lg` track the theme `--radius`. Fonts: `font-sans` (Inter),
`font-serif` (Playfair Display, for accent headings), `font-mono`. All standard Tailwind v4
spacing/flex/grid/typography utilities are available for your own layout glue.

## Wrapping & setup

Most components render standalone — no provider needed. Three need a context wrapper:

- **Tooltip** → wrap in `TooltipProvider` (once, near the root).
- **Toast** → render inside `ToastProvider` with a `ToastViewport`.
- **Sidebar** → wrap in `SidebarProvider`.

Theme tokens are global (shipped in `styles.css`); there is **no ThemeProvider to mount** for
colors to work. `ThemeToggle` flips light/dark via `next-themes` if you wire it.

## Variants (don't guess — these are the real ones)

- `Button` / `Cta`: `variant` = `default | secondary | outline | ghost | destructive | link`;
  `size` = `default | sm | lg | icon`.
- `Badge`: `variant` = `default | secondary | destructive | outline`.
- `Alert`: `variant` = `default | destructive`.
- Compound parts follow the shadcn pattern (`Card`+`CardHeader`/`CardTitle`/`CardContent`/
  `CardFooter`, `Dialog`+`DialogContent`/`DialogHeader`/…, etc.).

## Where the truth lives

- `styles.css` (and its `@import` of `_ds_bundle.css`) — every token + utility class.
- Per component: `components/<group>/<Name>/<Name>.d.ts` (the prop contract) and
  `<Name>.prompt.md` (usage + examples). Read these before composing a component.

## Idiomatic snippet

```tsx
<Card className="w-80">
  <CardHeader>
    <CardTitle>Monthly performance</CardTitle>
    <CardDescription>Your portfolio over the last 30 days.</CardDescription>
  </CardHeader>
  <CardContent className="flex items-baseline gap-2">
    <span className="text-3xl font-semibold tracking-tight">+12.4%</span>
    <Badge variant="secondary">Outperforming</Badge>
  </CardContent>
  <CardFooter className="justify-end">
    <Button>View report</Button>
  </CardFooter>
</Card>
```
