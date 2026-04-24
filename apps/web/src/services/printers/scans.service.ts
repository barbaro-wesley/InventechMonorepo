import { api } from "@/lib/api";

export type ScanStatus = "PENDING" | "PROCESSED" | "ERROR";
export type OcrStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface ScanMetadata {
  ocrStatus: OcrStatus;
  paciente: string | null;
  cpf: string | null;
  prontuario: string | null;
  numeroAtendimento: string | null;
  extractedAt: string | null;
}

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
  metadata: ScanMetadata | null;
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

  getDownloadUrl(id: string): string {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
    return `${base}/scans/${id}/download`;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/scans/${id}`);
  },
};
