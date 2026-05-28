---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[Wendy]], [[Dashboard]], [[../../10_Domain/Regulatory-GDPR]]
tags: [L3, product, auth, profile]
updated: 2026-05-28
---

# Auth & Profile

## Ruolo
Identità utente, sessione, settings, dati profilo. È la fonte di `req.userId` per ogni handler — perno per personalizzazione (Wendy, Dashboard, AAaS) e per audit/compliance.

## File chiave
- `apps/web/src/contexts/AuthContext.tsx`
- `apps/web/src/components/profile/ProfileSettings.tsx`
- `apps/web/src/components/profile/profile-sections.tsx`
- `apps/server/src/routes/profile.ts`
- `packages/db/src/schema/users.ts`

## Vincoli (vedi [[../../10_Domain/Regulatory-GDPR]])
- Ogni tabella user-owned ha FK → `usersTable` con `onDelete: "cascade"`
- No PII in localStorage (`gate-ui-component` check `no-sensitive-localstorage`)
- Auth guard su pagine private (`gate-ui-page` check `auth-guard`)
