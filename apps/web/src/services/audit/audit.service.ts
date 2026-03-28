import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditStats {
  today: { total: number; failed: number; success: number };
  activeBlocks: number;
  failedLast7Days: number;
  topFailedIps: Array<{ ip: string; count: number }>;
}

export interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  ipAddress: string;
  country: string | null;
  region: string | null;
  city: string | null;
  userAgent: string | null;
  failReason: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export interface AccountBlock {
  id: string;
  reason: string;
  ipAddress: string;
  blockedAt: string;
  expiresAt: string;
  unblocked: boolean;
  unblockedAt: string | null;
  unblockedBy: string | null;
  user: { id: string; name: string; email: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ListAttemptsParams {
  page?: number;
  limit?: number;
  search?: string;
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListBlocksParams {
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const auditService = {
  async getStats(): Promise<AuditStats> {
    const { data } = await api.get("/auth/audit/stats");
    return data;
  },

  async getAttempts(
    params: ListAttemptsParams = {}
  ): Promise<PaginatedResponse<LoginAttempt>> {
    const { data } = await api.get("/auth/audit/attempts", { params });
    return data;
  },

  async getBlocks(
    params: ListBlocksParams = {}
  ): Promise<PaginatedResponse<AccountBlock>> {
    const { data } = await api.get("/auth/audit/blocks", { params });
    return data;
  },

  async unblockUser(userId: string): Promise<void> {
    await api.patch(`/auth/audit/unblock/${userId}`);
  },
};
