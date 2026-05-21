export interface AdminSystemMetric {
  name: string;
  value: number;
}

export interface AdminSystemRepo {
  listMetrics(): Promise<AdminSystemMetric[]>;
  listErrors(limit: number): Promise<Array<{ id: string; message: string }>>;
}
