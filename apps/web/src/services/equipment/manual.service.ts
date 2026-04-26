import { api } from "@/lib/api";

export type ManualType = "PDF" | "TEXTO" | "LINK";

export interface EquipmentManual {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: ManualType;
  conteudoTexto: string | null;
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
}

export interface CreateManualPayload {
  titulo: string;
  descricao?: string;
  tipo: ManualType;
  conteudoTexto?: string;
  url?: string;
  ativo?: boolean;
}

export interface UpdateManualPayload {
  titulo?: string;
  descricao?: string;
  conteudoTexto?: string;
  url?: string;
  ativo?: boolean;
}

export const manualService = {
  async list(equipmentId: string): Promise<EquipmentManual[]> {
    const { data } = await api.get(`/equipment/${equipmentId}/manuals`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async create(
    equipmentId: string,
    payload: CreateManualPayload,
    file?: File,
  ): Promise<EquipmentManual> {
    const formData = new FormData();
    formData.append("titulo", payload.titulo);
    formData.append("tipo", payload.tipo);
    if (payload.descricao) formData.append("descricao", payload.descricao);
    if (payload.conteudoTexto) formData.append("conteudoTexto", payload.conteudoTexto);
    if (payload.url) formData.append("url", payload.url);
    formData.append("ativo", String(payload.ativo ?? true));
    if (file) formData.append("file", file);
    const { data } = await api.post(`/equipment/${equipmentId}/manuals`, formData);
    return data;
  },

  async update(
    equipmentId: string,
    manualId: string,
    payload: UpdateManualPayload,
  ): Promise<EquipmentManual> {
    const { data } = await api.patch(
      `/equipment/${equipmentId}/manuals/${manualId}`,
      payload,
    );
    return data;
  },

  async remove(equipmentId: string, manualId: string): Promise<void> {
    await api.delete(`/equipment/${equipmentId}/manuals/${manualId}`);
  },

  getDownloadUrl(equipmentId: string, manualId: string): string {
    const base = api.defaults.baseURL ?? 'http://localhost:3000/api/v1';
    return `${base}/equipment/${equipmentId}/manuals/${manualId}/download`;
  },
};
