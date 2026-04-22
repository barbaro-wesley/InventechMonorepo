import { api } from "@/lib/api";

export type ScanStatus = "PENDING" | "PROCESSED" | "ERROR";

export interface Scan {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: ScanStatus;
  errorMsg: string | null;
  scannedAt: string;
  printerId: string;
  printer: {
    id: string;
    name: string;
    costCenter: { name: string } | null;
  };
}

export interface ListScansParams {
  printerId?: string;
  status?: ScanStatus;
  from?: string;
  to?: string;
}

export const scansService = {
  async list(params?: ListScansParams): Promise<Scan[]> {
    const { data } = await api.get("/scans", { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async getDownloadUrl(id: string): Promise<string> {
    const { data } = await api.get(`/scans/${id}/download`);
    return typeof data === "string" ? data : data?.url ?? data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/scans/${id}`);
  },
};
