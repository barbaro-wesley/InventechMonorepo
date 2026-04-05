import { api } from "@/lib/api";

export type AttachmentCategory = "image" | "document" | "spreadsheet" | "presentation" | "archive";

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
  category: AttachmentCategory;
  entity: string;
  createdAt: string;
  uploadedById: string;
}

export const storageService = {
  async listByEntity(entity: string, entityId: string): Promise<Attachment[]> {
    const { data } = await api.get(`/storage/entity/${entity}/${entityId}`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async upload(file: File, entity: string, entityId: string): Promise<Attachment> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity", entity);
    formData.append("entityId", entityId);
    const { data } = await api.post(`/storage/upload`, formData);
    return data;
  },

  async getUrl(attachmentId: string): Promise<string> {
    const { data } = await api.get(`/storage/${attachmentId}/url`);
    return data.url;
  },

  getDownloadUrl(attachmentId: string): string {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
    return `${base}/storage/${attachmentId}/download`;
  },

  async delete(attachmentId: string): Promise<void> {
    await api.delete(`/storage/${attachmentId}`);
  },
};
