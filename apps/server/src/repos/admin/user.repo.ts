export interface AdminUserSummary {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
}

export interface AdminUserRepo {
  listUsers(params: { search?: string; limit: number }): Promise<AdminUserSummary[]>;
}
