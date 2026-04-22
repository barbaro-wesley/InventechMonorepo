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

  async download(id: string, fileName: string): Promise<void> {
    const response = await api.get(`/scans/${id}/download`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/scans/${id}`);
  },
};
