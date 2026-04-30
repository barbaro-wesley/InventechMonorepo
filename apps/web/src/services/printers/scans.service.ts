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

export interface ScansPage {
  data: Scan[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface UpdateScanMetadataPayload {
  paciente?: string | null;
  cpf?: string | null;
  prontuario?: string | null;
  numeroAtendimento?: string | null;
}

export interface ListScansParams {
  printerId?: string;
  status?: ScanStatus;
  search?: string;
  cursor?: string;
  limit?: number;
}

export const scansService = {
  async list(params?: ListScansParams): Promise<ScansPage> {
    const { data } = await api.get("/scans", { params });
    // Compatibilidade: API retorna { data, nextCursor, hasNextPage }
    if (data && "data" in data && Array.isArray(data.data)) return data;
    // Fallback se vier array direto
    const arr = Array.isArray(data) ? data : [];
    return { data: arr, nextCursor: null, hasNextPage: false };
  },

  getDownloadUrl(id: string): string {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
    return `${base}/scans/${id}/download`;
  },

  async updateMetadata(id: string, payload: UpdateScanMetadataPayload): Promise<Scan> {
    const { data } = await api.patch(`/scans/${id}/metadata`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/scans/${id}`);
  },
};
