# Naming Convention

NorthStar keeps public URLs stable, but internal code should be predictable.

## Server

- Route filenames use English kebab-case, for example `affiliation-program.ts`.
- TypeScript variables, functions, and service names use English camelCase.
- Public URL paths may stay Italian when already exposed or SEO-sensitive, for example `/profilo`, `/amici`, `/affiliazione`.
- Changing a public URL requires an explicit redirect and SEO migration plan.

## Frontend

- URL strings live in shared route constants where practical.
- Page/component filenames should use the established local convention for that area, but new internal symbols use English names.
- User-facing copy can remain Italian.

## Migration Rule

When renaming an internal file, keep the route path and API contract unchanged, update imports in the same commit, and verify `pnpm run check`.
