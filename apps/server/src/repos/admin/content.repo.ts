export interface AdminContentSummary {
  id: number;
  title: string;
  status: string;
  updatedAt: Date | string;
}

export interface AdminContentRepo {
  listContent(params: { status?: string; limit: number }): Promise<AdminContentSummary[]>;
}
