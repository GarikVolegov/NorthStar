/**
 * network-router.ts — /api/friends
 *
 * GET    /api/friends              — lista amici (status=accepted)
 * GET    /api/friends/requests     — richieste ricevute in attesa
 * GET    /api/friends/suggestions  — utenti suggeriti con matchScore (0-100)
 * GET    /api/friends/search       — ricerca utenti per nome (?q=&sector=)
 * POST   /api/friends/request/:id  — invia richiesta di amicizia
 * PUT    /api/friends/:id/accept   — accetta una richiesta ricevuta
 * DELETE /api/friends/:id          — rimuovi amico o rifiuta richiesta
 *
 * Algoritmo matchScore (0-100, clamped):
 *   1. Stesso settore           → +50 pt
 *   2. Stesso journeyType       → +30 pt
 *   3. |deltaXP| <= 2000        → +20 * (1 - |deltaXP| / 2000) pt (lineare)
 *   4. Prossimità location      → +15 pt (stesso country-group)
 *                                → +7  pt (stessa macro-region)
 *                                → +0  pt (regioni diverse)
 *
 * Il segnale location (4) è inferito da usersTable.timezone (IANA tz string)
 * senza nessuna migration aggiuntiva.
 *
 * Tutti gli endpoint richiedono autenticazione (requireAuth montato in index.ts).
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  friendshipsTable,
  usersTable,
  testSessionsTable,
  sectorsTable,
} from "@workspace/db";
import { eq, or, and, notInArray, ilike } from "drizzle-orm";

export const networkRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

type PublicUser = {
  id: number;
  name: string;
  avatarUrl: string | null;
  sectorName: string | null;
  journeyType: string | null;
  totalXp: number | null;
  matchScore?: number;
};

async function getPublicUser(userId: number): Promise<PublicUser | null> {
  const row = await db
    .select({
      id:          usersTable.id,
      name:        usersTable.name,
      avatarUrl:   usersTable.avatarUrl,
      journeyType: usersTable.journeyType,
      totalXp:     usersTable.totalXp,
      sectorName:  sectorsTable.name,
    })
    .from(usersTable)
    .leftJoin(testSessionsTable, eq(usersTable.testSessionId, testSessionsTable.id))
    .leftJoin(sectorsTable, eq(testSessionsTable.confirmedSectorId, sectorsTable.id))
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0] ?? null);
  return row;
}

/**
 * Restituisce tutti gli ID già correlati all'utente (se stesso + connessioni
 * accepted/pending/blocked in entrambe le direzioni).
 * Usato per escludere utenti da suggestions e search.
 */
async function getExcludedIds(me: number): Promise<Set<number>> {
  const rows = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        eq(friendshipsTable.requesterId, me),
        eq(friendshipsTable.receiverId, me),
      ),
    );
  const ids = new Set<number>([me]);
  for (const f of rows) {
    ids.add(f.requesterId);
    ids.add(f.receiverId);
  }
  return ids;
}

// ── Location inference da IANA timezone ───────────────────────────────────────
//
// Mappa una stringa IANA timezone (es. "Europe/Rome") in una coppia
// { macroRegion, countryGroup } usata per calcolare la prossimità geografica.
//
// Granularità a 3 livelli:
//   macroRegion  — continente o sotto-area ("Europe/South", "America/East")
//   countryGroup — gruppo di paesi affini ("Eurozone/South", "LatAm/South")
//
// Se la timezone è null/unknown restituisce null → segnale vale 0.

type LocationInfo = {
  macroRegion: string;
  countryGroup: string;
};

function timezoneToRegion(tz: string | null): LocationInfo | null {
  if (!tz) return null;

  // Europe
  if (/^Europe\/(Rome|Vatican|Malta|San_Marino|Zurich|Vienna|Berlin|Brussels|Luxembourg|Amsterdam|Paris|Monaco|Andorra|Madrid|Lisbon|Gibraltar)$/i.test(tz)) {
    return { macroRegion: "Europe/West", countryGroup: "Eurozone/South" };
  }
  if (/^Europe\/(London|Dublin|Guernsey|Jersey|Isle_of_Man|Lisbon)$/i.test(tz)) {
    return { macroRegion: "Europe/West", countryGroup: "British_Isles" };
  }
  if (/^Europe\/(Warsaw|Prague|Budapest|Bratislava|Ljubljana|Zagreb|Sarajevo|Belgrade|Skopje|Podgorica|Tirane|Bucharest|Sofia|Athens|Nicosia|Helsinki|Tallinn|Riga|Vilnius|Kaliningrad|Minsk|Kiev|Chisinau|Mariehamn)$/i.test(tz)) {
    return { macroRegion: "Europe/East", countryGroup: "EastEurope" };
  }
  if (/^Europe\/(Stockholm|Oslo|Copenhagen|Helsinki|Reykjavik)$/i.test(tz)) {
    return { macroRegion: "Europe/North", countryGroup: "Scandinavia" };
  }
  if (/^Europe\//.test(tz)) {
    return { macroRegion: "Europe/Other", countryGroup: "Europe/Other" };
  }

  // Americas
  if (/^America\/(New_York|Toronto|Detroit|Indiana|Kentucky|Montreal|Ottawa|Halifax|Moncton|Glace_Bay|Goose_Bay)$/.test(tz)) {
    return { macroRegion: "America/East", countryGroup: "NorthAm/East" };
  }
  if (/^America\/(Chicago|Winnipeg|Indiana|Knox|Tell_City|Menominee|Rainy_River|Rankin_Inlet|Resolute|Swift_Current|Regina)$/.test(tz)) {
    return { macroRegion: "America/Central", countryGroup: "NorthAm/Central" };
  }
  if (/^America\/(Denver|Phoenix|Edmonton|Calgary|Yellowknife|Boise|Cambridge_Bay|Inuvik|Creston)$/.test(tz)) {
    return { macroRegion: "America/Mountain", countryGroup: "NorthAm/Mountain" };
  }
  if (/^America\/(Los_Angeles|Vancouver|Tijuana|Dawson|Whitehorse)$/.test(tz)) {
    return { macroRegion: "America/West", countryGroup: "NorthAm/West" };
  }
  if (/^America\/(Sao_Paulo|Fortaleza|Recife|Maceio|Belem|Bahia|Cuiaba|Porto_Velho|Manaus|Boa_Vista|Santarem|Noronha|Araguaina)$/.test(tz)) {
    return { macroRegion: "America/SouthEast", countryGroup: "LatAm/Brazil" };
  }
  if (/^America\/(Argentina|Chile|Bolivia|Paraguay|Uruguay|Asuncion|Santiago|Lima|Bogota|Caracas|Guayaquil|La_Paz|Montevideo|Cayenne|Paramaribo|Guyana|Port_of_Spain|Barbados|Trinidad|Puerto_Rico|Jamaica|Havana|Panama|Costa_Rica|Managua|Tegucigalpa|Guatemala|El_Salvador|Belize|Mexico_City|Cancun|Hermosillo|Mazatlan|Chihuahua|Merida|Monterrey|Ojinaga|Bahia_Banderas|Matamoros|Mazatlan)/.test(tz)) {
    return { macroRegion: "America/SouthWest", countryGroup: "LatAm/Other" };
  }
  if (/^America\//.test(tz)) {
    return { macroRegion: "America/Other", countryGroup: "America/Other" };
  }

  // Asia
  if (/^Asia\/(Tokyo|Seoul|Shanghai|Hong_Kong|Taipei|Macau|Singapore|Kuala_Lumpur|Jakarta|Manila|Bangkok|Ho_Chi_Minh|Saigon|Phnom_Penh|Vientiane|Yangon|Rangoon|Brunei|Makassar|Pontianak|Jayapura)$/.test(tz)) {
    return { macroRegion: "Asia/East", countryGroup: "SEAsia" };
  }
  if (/^Asia\/(Kolkata|Calcutta|Colombo|Dhaka|Kathmandu|Karachi|Lahore|Kabul|Tashkent|Almaty|Bishkek|Dushanbe|Ashgabat|Yekaterinburg|Omsk|Novosibirsk|Krasnoyarsk|Irkutsk|Yakutsk|Vladivostok|Sakhalin|Magadan|Srednekolymsk|Kamchatka|Anadyr)/.test(tz)) {
    return { macroRegion: "Asia/South", countryGroup: "SouthAsia" };
  }
  if (/^Asia\/(Dubai|Riyadh|Kuwait|Baghdad|Tehran|Baku|Yerevan|Tbilisi|Beirut|Jerusalem|Gaza|Hebron|Amman|Damascus|Nicosia|Istanbul|Muscat|Aden|Qatar|Bahrain)$/.test(tz)) {
    return { macroRegion: "Asia/West", countryGroup: "MENA" };
  }
  if (/^Asia\//.test(tz)) {
    return { macroRegion: "Asia/Other", countryGroup: "Asia/Other" };
  }

  // Africa
  if (/^Africa\//.test(tz)) {
    return { macroRegion: "Africa", countryGroup: "Africa" };
  }

  // Oceania
  if (/^(Australia|Pacific)\//.test(tz)) {
    return { macroRegion: "Oceania", countryGroup: "Oceania" };
  }

  return null;
}

/**
 * Calcola un punteggio di prossimità geografica (0, 7, o 15).
 *   countryGroup uguale → 15 pt  (stessa area geografica, es. entrambi Eurozone/South)
 *   macroRegion uguale  → 7 pt   (stesso macro-continente, es. entrambi Europe/West)
 *   altrimenti          → 0 pt
 */
function locationScore(tzA: string | null, tzB: string | null): number {
  const a = timezoneToRegion(tzA);
  const b = timezoneToRegion(tzB);
  if (!a || !b) return 0;
  if (a.countryGroup === b.countryGroup) return 15;
  if (a.macroRegion === b.macroRegion) return 7;
  return 0;
}

// ── Algoritmo matchScore ──────────────────────────────────────────────────────
//
// Segnali (totale grezzo max 115, clamped a 100):
//   1. sameSector    → 50 pt  — stesso mondo lavorativo
//   2. sameJourney   → 30 pt  — stesso tipo di percorso (es. "in_crescita")
//   3. xpProximity   → 0-20pt — XP simile (|delta| <= 2000, lineare)
//   4. location      → 0/7/15pt — prossimità geografica via timezone inference
//
// Note:
//   - Segnale mancante (null) vale 0, non penalizza.
//   - Il punteggio finale è sempre in [0, 100].

type MatchInput = {
  sectorId: number | null;
  journeyType: string | null;
  totalXp: number | null;
  timezone: string | null;
};

function computeMatchScore(me: MatchInput, other: MatchInput): number {
  let score = 0;

  // Segnale 1: stesso settore (50 pt)
  if (me.sectorId !== null && other.sectorId !== null && me.sectorId === other.sectorId) {
    score += 50;
  }

  // Segnale 2: stesso journeyType (30 pt)
  if (
    me.journeyType !== null &&
    other.journeyType !== null &&
    me.journeyType === other.journeyType
  ) {
    score += 30;
  }

  // Segnale 3: vicinanza XP (0-20 pt)
  if (me.totalXp !== null && other.totalXp !== null) {
    const delta = Math.abs(me.totalXp - other.totalXp);
    if (delta <= 2000) {
      score += Math.round(20 * (1 - delta / 2000));
    }
  }

  // Segnale 4: prossimità geografica via timezone (0, 7, o 15 pt)
  score += locationScore(me.timezone, other.timezone);

  return Math.min(100, Math.max(0, score));
}

// ── GET /api/friends — lista connessioni accettate ──────────────────────────

networkRouter.get("/", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const rows = await db
      .select()
      .from(friendshipsTable)
      .where(
        and(
          or(
            eq(friendshipsTable.requesterId, me),
            eq(friendshipsTable.receiverId, me),
          ),
          eq(friendshipsTable.status, "accepted"),
        ),
      );

    const friends = await Promise.all(
      rows.map(async (f) => {
        const otherId = f.requesterId === me ? f.receiverId : f.requesterId;
        const user = await getPublicUser(otherId);
        return { friendshipId: f.id, since: f.updatedAt, user };
      }),
    );

    res.json({ friends: friends.filter((f) => f.user !== null) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /api/friends/requests — richieste in arrivo ────────────────────────

networkRouter.get("/requests", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const rows = await db
      .select()
      .from(friendshipsTable)
      .where(
        and(
          eq(friendshipsTable.receiverId, me),
          eq(friendshipsTable.status, "pending"),
        ),
      );

    const requests = await Promise.all(
      rows.map(async (f) => {
        const user = await getPublicUser(f.requesterId);
        return { friendshipId: f.id, sentAt: f.createdAt, user };
      }),
    );

    res.json({ requests: requests.filter((r) => r.user !== null) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /api/friends/suggestions — utenti suggeriti con matchScore ────────────

networkRouter.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const excludeIds = await getExcludedIds(me);

    // Profilo dell'utente corrente per il calcolo del match
    const meRow = await db
      .select({
        testSessionId: usersTable.testSessionId,
        journeyType:   usersTable.journeyType,
        totalXp:       usersTable.totalXp,
        timezone:      usersTable.timezone,
      })
      .from(usersTable)
      .where(eq(usersTable.id, me))
      .limit(1)
      .then((r) => r[0]);

    let mySectorId: number | null = null;
    if (meRow?.testSessionId) {
      const session = await db
        .select({ confirmedSectorId: testSessionsTable.confirmedSectorId })
        .from(testSessionsTable)
        .where(eq(testSessionsTable.id, meRow.testSessionId))
        .limit(1)
        .then((r) => r[0]);
      mySectorId = session?.confirmedSectorId ?? null;
    }

    const myProfile: MatchInput = {
      sectorId:    mySectorId,
      journeyType: meRow?.journeyType ?? null,
      totalXp:     meRow?.totalXp ?? null,
      timezone:    meRow?.timezone ?? null,
    };

    const candidates = await db
      .select({
        id:          usersTable.id,
        name:        usersTable.name,
        avatarUrl:   usersTable.avatarUrl,
        journeyType: usersTable.journeyType,
        totalXp:     usersTable.totalXp,
        timezone:    usersTable.timezone,
        sectorName:  sectorsTable.name,
        sectorId:    testSessionsTable.confirmedSectorId,
      })
      .from(usersTable)
      .leftJoin(testSessionsTable, eq(usersTable.testSessionId, testSessionsTable.id))
      .leftJoin(sectorsTable, eq(testSessionsTable.confirmedSectorId, sectorsTable.id))
      .where(
        and(
          eq(usersTable.isPublic, true),
          notInArray(usersTable.id, [...excludeIds]),
        ),
      )
      .limit(50);

    const scored = candidates
      .map((c) => ({
        id:          c.id,
        name:        c.name,
        avatarUrl:   c.avatarUrl,
        journeyType: c.journeyType,
        totalXp:     c.totalXp,
        sectorName:  c.sectorName,
        matchScore:  computeMatchScore(myProfile, {
          sectorId:    c.sectorId ?? null,
          journeyType: c.journeyType ?? null,
          totalXp:     c.totalXp ?? null,
          timezone:    c.timezone ?? null,
        }),
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json({ suggestions: scored.slice(0, 12) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /api/friends/search — ricerca utenti con matchScore ─────────────────
//
// Query params:
//   q       — stringa di ricerca sul nome (min 2 caratteri, max 80)
//   sector  — (opzionale) ID settore per filtrare
//   limit   — (opzionale) max risultati, default 15, max 30

networkRouter.get("/search", async (req: Request, res: Response) => {
  try {
    const me = uid(req);

    const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (rawQ.length < 2) {
      res.status(400).json({ error: "Il termine di ricerca deve avere almeno 2 caratteri" });
      return;
    }
    if (rawQ.length > 80) {
      res.status(400).json({ error: "Termine di ricerca troppo lungo" });
      return;
    }

    const sectorFilter =
      typeof req.query.sector === "string" && req.query.sector !== ""
        ? parseInt(req.query.sector, 10)
        : null;

    const limit = Math.min(
      parseInt(typeof req.query.limit === "string" ? req.query.limit : "15", 10) || 15,
      30,
    );

    // Profilo dell'utente corrente per il calcolo del match
    const meRow = await db
      .select({
        testSessionId: usersTable.testSessionId,
        journeyType:   usersTable.journeyType,
        totalXp:       usersTable.totalXp,
        timezone:      usersTable.timezone,
      })
      .from(usersTable)
      .where(eq(usersTable.id, me))
      .limit(1)
      .then((r) => r[0]);

    let mySectorId: number | null = null;
    if (meRow?.testSessionId) {
      const session = await db
        .select({ confirmedSectorId: testSessionsTable.confirmedSectorId })
        .from(testSessionsTable)
        .where(eq(testSessionsTable.id, meRow.testSessionId))
        .limit(1)
        .then((r) => r[0]);
      mySectorId = session?.confirmedSectorId ?? null;
    }

    const myProfile: MatchInput = {
      sectorId:    mySectorId,
      journeyType: meRow?.journeyType ?? null,
      totalXp:     meRow?.totalXp ?? null,
      timezone:    meRow?.timezone ?? null,
    };

    const excludeIds = await getExcludedIds(me);
    const namePattern = `%${rawQ}%`;

    const baseConditions = and(
      eq(usersTable.isPublic, true),
      notInArray(usersTable.id, [...excludeIds]),
      ilike(usersTable.name, namePattern),
      ...(sectorFilter !== null
        ? [eq(testSessionsTable.confirmedSectorId, sectorFilter)]
        : []),
    );

    const rows = await db
      .select({
        id:          usersTable.id,
        name:        usersTable.name,
        avatarUrl:   usersTable.avatarUrl,
        journeyType: usersTable.journeyType,
        totalXp:     usersTable.totalXp,
        timezone:    usersTable.timezone,
        sectorName:  sectorsTable.name,
        sectorId:    testSessionsTable.confirmedSectorId,
      })
      .from(usersTable)
      .leftJoin(testSessionsTable, eq(usersTable.testSessionId, testSessionsTable.id))
      .leftJoin(sectorsTable, eq(testSessionsTable.confirmedSectorId, sectorsTable.id))
      .where(baseConditions)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const results = rows.slice(0, limit);

    const q = rawQ.toLowerCase();
    const scored = results
      .map((r) => ({
        ...r,
        matchScore: computeMatchScore(myProfile, {
          sectorId:    r.sectorId ?? null,
          journeyType: r.journeyType ?? null,
          totalXp:     r.totalXp ?? null,
          timezone:    r.timezone ?? null,
        }),
      }))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aPrio = aName === q ? 2 : aName.startsWith(q) ? 1 : 0;
        const bPrio = bName === q ? 2 : bName.startsWith(q) ? 1 : 0;
        if (aPrio !== bPrio) return bPrio - aPrio;
        return b.matchScore - a.matchScore;
      });

    res.json({
      results: scored,
      total:   scored.length,
      hasMore,
      query:   rawQ,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── POST /api/friends/request/:targetId — invia richiesta ───────────────────

networkRouter.post("/request/:targetId", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const targetId = parseInt(req.params.targetId, 10);

    if (isNaN(targetId) || targetId === me) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    const existing = await db
      .select()
      .from(friendshipsTable)
      .where(
        or(
          and(eq(friendshipsTable.requesterId, me), eq(friendshipsTable.receiverId, targetId)),
          and(eq(friendshipsTable.requesterId, targetId), eq(friendshipsTable.receiverId, me)),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      res.status(409).json({ error: "Relazione già esistente", status: existing.status });
      return;
    }

    const [friendship] = await db
      .insert(friendshipsTable)
      .values({ requesterId: me, receiverId: targetId, status: "pending" })
      .returning();

    res.status(201).json({ friendship });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── PUT /api/friends/:id/accept — accetta richiesta ─────────────────────────

networkRouter.put("/:id/accept", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const friendshipId = parseInt(req.params.id, 10);

    const row = await db
      .select()
      .from(friendshipsTable)
      .where(eq(friendshipsTable.id, friendshipId))
      .limit(1)
      .then((r) => r[0]);

    if (!row) { res.status(404).json({ error: "Richiesta non trovata" }); return; }
    if (row.receiverId !== me) { res.status(403).json({ error: "Non autorizzato" }); return; }
    if (row.status !== "pending") { res.status(409).json({ error: "Stato non valido" }); return; }

    const [updated] = await db
      .update(friendshipsTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(friendshipsTable.id, friendshipId))
      .returning();

    res.json({ friendship: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── DELETE /api/friends/:id — rimuovi / rifiuta ───────────────────────────

networkRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const friendshipId = parseInt(req.params.id, 10);

    const row = await db
      .select()
      .from(friendshipsTable)
      .where(eq(friendshipsTable.id, friendshipId))
      .limit(1)
      .then((r) => r[0]);

    if (!row) { res.status(404).json({ error: "Connessione non trovata" }); return; }
    if (row.requesterId !== me && row.receiverId !== me) {
      res.status(403).json({ error: "Non autorizzato" }); return;
    }

    await db.delete(friendshipsTable).where(eq(friendshipsTable.id, friendshipId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});
