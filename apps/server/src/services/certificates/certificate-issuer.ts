import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

export interface CertificateMetadata {
  version: 1;
  objectiveId: number;
  category: string;
  issuedReason: "objective_completed";
  completedAt: string;
}

export interface IssuedCertificate {
  id: number;
  userId: number;
  objectiveId: number;
  objectiveText: string;
  userName: string;
  category: string;
  certificateHash: string;
  metadata: CertificateMetadata;
  imageUrl: string;
  txHash: string | null;
  chain: string;
  chainId: number | null;
  status: "issued";
  mintedAt: Date;
  isPublic: boolean;
}

export interface IssueMilestoneCertificateInput {
  userId: number;
  userName: string;
  objectiveId: number;
  objectiveText: string;
  category: string;
  completedAt: Date;
}

export interface CertificateStore {
  listByUser(userId: number): Promise<IssuedCertificate[]>;
  findByUserAndObjective(userId: number, objectiveId: number): Promise<IssuedCertificate | null>;
  findPublicByHash(certificateHash: string): Promise<IssuedCertificate | null>;
  insert(certificate: Omit<IssuedCertificate, "id" | "mintedAt">): Promise<IssuedCertificate>;
  setPublic(certificateHash: string, isPublic: boolean): Promise<void>;
}

export interface CertificateIssuer {
  issueMilestoneCertificate(input: IssueMilestoneCertificateInput): Promise<IssuedCertificate>;
}

const LEDGER_CHAIN = "NorthStar Ledger";
const CERTIFICATE_VERSION = 1;

export function createCertificateIssuer({
  store = dbCertificateStore,
}: {
  store?: CertificateStore;
} = {}): CertificateIssuer {
  return {
    async issueMilestoneCertificate(input) {
      const existing = await store.findByUserAndObjective(input.userId, input.objectiveId);
      if (existing) return existing;

      const metadata: CertificateMetadata = {
        version: CERTIFICATE_VERSION,
        objectiveId: input.objectiveId,
        category: input.category,
        issuedReason: "objective_completed",
        completedAt: input.completedAt.toISOString(),
      };
      const certificateHash = createCertificateHash({ ...input, metadata });

      try {
        return await store.insert({
          userId: input.userId,
          objectiveId: input.objectiveId,
          objectiveText: input.objectiveText,
          userName: input.userName,
          category: input.category,
          certificateHash,
          metadata,
          imageUrl: `/api/nft-certificates/image/${certificateHash}.svg`,
          txHash: null,
          chain: LEDGER_CHAIN,
          chainId: null,
          status: "issued",
          isPublic: true,
        });
      } catch (err) {
        if (isUniqueConflict(err)) {
          const afterConflict = await store.findByUserAndObjective(input.userId, input.objectiveId);
          if (afterConflict) return afterConflict;
        }
        throw err;
      }
    },
  };
}

function createCertificateHash(input: IssueMilestoneCertificateInput & { metadata: CertificateMetadata }): string {
  const snapshot = {
    version: input.metadata.version,
    userId: input.userId,
    userName: input.userName,
    objectiveId: input.objectiveId,
    objectiveText: input.objectiveText,
    category: input.category,
    completedAt: input.metadata.completedAt,
    issuedReason: input.metadata.issuedReason,
  };
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function isUniqueConflict(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      ("code" in err || "cause" in err) &&
      ((err as { code?: unknown }).code === "23505" ||
        (err as { cause?: { code?: unknown } }).cause?.code === "23505"),
  );
}

export const dbCertificateStore: CertificateStore = {
  async listByUser(userId) {
    const { db, nftCertificatesTable } = await import("@workspace/db");
    const rows = await db
      .select()
      .from(nftCertificatesTable)
      .where(eq(nftCertificatesTable.userId, userId))
      .orderBy(desc(nftCertificatesTable.mintedAt));
    return rows.map(normalizeCertificate);
  },

  async findByUserAndObjective(userId, objectiveId) {
    const { db, nftCertificatesTable } = await import("@workspace/db");
    const [row] = await db
      .select()
      .from(nftCertificatesTable)
      .where(and(eq(nftCertificatesTable.userId, userId), eq(nftCertificatesTable.objectiveId, objectiveId)))
      .limit(1);
    return row ? normalizeCertificate(row) : null;
  },

  async findPublicByHash(certificateHash) {
    const { db, nftCertificatesTable } = await import("@workspace/db");
    const [row] = await db
      .select()
      .from(nftCertificatesTable)
      .where(and(eq(nftCertificatesTable.certificateHash, certificateHash), eq(nftCertificatesTable.isPublic, true)))
      .limit(1);
    return row ? normalizeCertificate(row) : null;
  },

  async insert(certificate) {
    const { db, nftCertificatesTable } = await import("@workspace/db");
    const [row] = await db
      .insert(nftCertificatesTable)
      .values(certificate)
      .returning();
    if (!row) throw new Error("Certificate insert returned no row");
    return normalizeCertificate(row);
  },

  async setPublic(certificateHash, isPublic) {
    const { db, nftCertificatesTable } = await import("@workspace/db");
    await db
      .update(nftCertificatesTable)
      .set({ isPublic })
      .where(eq(nftCertificatesTable.certificateHash, certificateHash));
  },
};

export function createMemoryCertificateStore(): CertificateStore {
  let nextId = 1;
  const rows = new Map<string, IssuedCertificate>();

  return {
    async listByUser(userId) {
      return [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.mintedAt.getTime() - a.mintedAt.getTime());
    },
    async findByUserAndObjective(userId, objectiveId) {
      return [...rows.values()].find((row) => row.userId === userId && row.objectiveId === objectiveId) ?? null;
    },
    async findPublicByHash(certificateHash) {
      const row = rows.get(certificateHash);
      return row?.isPublic ? row : null;
    },
    async insert(certificate) {
      const row: IssuedCertificate = {
        ...certificate,
        id: nextId++,
        mintedAt: new Date(),
      };
      rows.set(row.certificateHash, row);
      return row;
    },
    async setPublic(certificateHash, isPublic) {
      const row = rows.get(certificateHash);
      if (row) rows.set(certificateHash, { ...row, isPublic });
    },
  };
}

function normalizeCertificate(row: {
  id: number;
  userId: number;
  objectiveId: number;
  objectiveText: string;
  userName: string;
  category: string;
  certificateHash: string;
  metadata: unknown;
  imageUrl: string | null;
  txHash: string | null;
  chain: string | null;
  chainId: number | null;
  status: string;
  mintedAt: Date;
  isPublic: boolean;
}): IssuedCertificate {
  const metadata = normalizeMetadata(row.metadata, row.objectiveId, row.category, row.mintedAt);
  return {
    ...row,
    metadata,
    imageUrl: row.imageUrl ?? `/api/nft-certificates/image/${row.certificateHash}.svg`,
    chain: row.chain ?? LEDGER_CHAIN,
    status: "issued",
  };
}

function normalizeMetadata(
  metadata: unknown,
  objectiveId: number,
  category: string,
  mintedAt: Date,
): CertificateMetadata {
  const value = metadata && typeof metadata === "object" ? (metadata as Partial<CertificateMetadata>) : {};
  return {
    version: 1,
    objectiveId,
    category,
    issuedReason: "objective_completed",
    completedAt: typeof value.completedAt === "string" ? value.completedAt : mintedAt.toISOString(),
  };
}
