export const PATHS = {
  HOME: "/",
  PROFILE: "/profilo",
  FRIENDS: "/amici",
  GRAPH: "/grafo",
  ARCHIVE: "/archivio",
  ADMIN_REVIEW: "/admin-review",
  ADMIN_METRICS: "/admin-metriche",
  AFFILIATION: "/affiliazione",
  LOGIN: "/login",
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
  RESULTS: "/results",
  TEST: "/test",
  SECTOR: "/settore/:id",
} as const;

export type AppPath = (typeof PATHS)[keyof typeof PATHS];
