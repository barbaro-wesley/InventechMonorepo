import { api } from "@/lib/api";

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  remoteDirectory: string;
}

export interface PrinterCostCenter {
  id: string;
  name: string;
  code: string | null;
}

export interface Printer {
  id: string;
  name: string;
  ipAddress: string;
  brand: string | null;
  model: string | null;
  notes: string | null;
  isActive: boolean;
  costCenterId: string | null;
  costCenter: PrinterCostCenter | null;
  sftpConfig: SftpConfig | null;
  _count: { scans: number };
  createdAt: string;
}

export interface ListPrintersParams {
  isActive?: boolean;
  costCenterId?: string;
}

export interface CreatePrinterDto {
  name: string;
  ipAddress: string;
  brand?: string;
  model?: string;
  notes?: string;
  costCenterId?: string;
}

export interface UpdatePrinterDto {
  name?: string;
  ipAddress?: string;
  brand?: string;
  model?: string;
  notes?: string;
  costCenterId?: string;
  isActive?: boolean;
}

export const printersService = {
  async list(params?: ListPrintersParams): Promise<Printer[]> {
    const { data } = await api.get("/printers", { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async get(id: string): Promise<Printer> {
    const { data } = await api.get(`/printers/${id}`);
    return data;
  },

  async create(dto: CreatePrinterDto): Promise<Printer> {
    const { data } = await api.post("/printers", dto);
    return data;
  },

  async update(id: string, dto: UpdatePrinterDto): Promise<Printer> {
    const { data } = await api.patch(`/printers/${id}`, dto);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/printers/${id}`);
  },
};
