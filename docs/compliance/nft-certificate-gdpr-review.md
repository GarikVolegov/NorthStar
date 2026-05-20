# NFT Certificate — GDPR/EU Compliance Review

**Data**: `userName`, `objectiveText`, `certificateHash`, `category`, `metadata`, `imageUrl`

## Findings

### 1. Personal data in certificates
`userName` (display name) and `objectiveText` (achievement description) are personal data. The `certificateHash` (SHA-256) is pseudonymous. When a user exercises **right to erasure (Art. 17)**, these must be anonymized or deleted.

**Current state**: `ON DELETE CASCADE` from `users` will delete rows, but the `gdpr-purge.ts` script does NOT explicitly reference `nft_certificates`. CASCADE should handle it, but this is fragile — if the FK is ever removed, certificates survive indefinitely.

**Fix**: Add explicit `DELETE FROM nft_certificates WHERE userId = ?` to `gdpr-purge.ts` purge loop, or at minimum set `userName = 'Utente Eliminato'`, `objectiveText = NULL` on soft-delete.

### 2. Blockchain immutability (future risk)
`txHash`, `chain`, `chainId` columns are provisioned for on-chain minting. If certificates are minted on a public **immutable ledger**, the hash + metadata becomes permanent. GDPR Art. 17 right to erasure cannot be technically fulfilled on public blockchains.

**Mitigation required**: 
- Never store `userName` or `objectiveText` on-chain — only `certificateHash`. 
- Keep human-readable data in the off-chain DB (deletable).
- Add a privacy notice: "Certificates minted on-chain cannot be deleted from the blockchain; personal data is stored only off-chain and deleted upon request."

### 3. Missing from PRIVACY_DESIGN.md
- **Section 1 (Data categories)**: Add row for NFT certificates.
- **Section 3 (Retention)**: Add retention period (e.g., "Until account deletion + 90 days").
- **Section 5.4 (Cancellation)**: Add anonymization step for certificates on soft-delete.

### 4. No server routes exist yet
The frontend calls `GET /api/nft-certificates/me`, `GET /api/nft-certificates/verify/:hash`, and `GET /api/nft-certificates/image/:hash.png` — none are implemented server-side. Before implementing:
- Apply `requireAuth` to `/me` and admin-only endpoints.
- The public verify endpoint (`/verify/:hash`) should return only hash, status, and mintedAt — NOT `userName` or `objectiveText` unless the user made the certificate public.
- Add rate limiting to verify endpoint to prevent hash enumeration.

### 5. `isPublic` defaults to `true`
By default, certificates are public. This means `userName` and `objectiveText` are exposed on the public verification page. Consider defaulting `isPublic` to `false` (opt-in to public visibility) to align with GDPR data minimization principle.

### 6. No data export in account export
`GET /api/account/export` doesn't export NFT certificates. Add them for portability compliance (Art. 20).

## Action Items

| Priority | Item | File |
|----------|------|------|
| High | Add `userName = 'Utente Eliminato'`, `objectiveText = NULL` to account soft-delete | `account.ts` |
| High | Add `DELETE FROM nft_certificates WHERE userId = ?` to GDPR purge script | `gdpr-purge.ts` |
| Medium | Change `isPublic` default from `true` to `false` | `nftCertificates.ts` |
| Medium | Add NFT certificate section to PRIVACY_DESIGN.md | `PRIVACY_DESIGN.md` |
| Medium | Exclude `userName`/`objectiveText` from public verify endpoint | Route (not yet implemented) |
| Low | Add NFT certs to account export | `account.ts` |
| Low | Add blockchain privacy notice when on-chain minting is implemented | Legal/branding |
