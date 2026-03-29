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

export interface PresignedUrlResult {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
  expiresIn: number;
  expiresAt: string;
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

  async getPresignedUrl(attachmentId: string): Promise<PresignedUrlResult> {
    const { data } = await api.get(`/storage/${attachmentId}/url`);
    return data;
  },

  async delete(attachmentId: string): Promise<void> {
    await api.delete(`/storage/${attachmentId}`);
  },
};
