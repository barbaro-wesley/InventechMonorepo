import { api } from "@/lib/api";
import type {
    AlertRule,
    CreateAlertRuleDto,
    UpdateAlertRuleDto,
    ListAlertRulesParams,
    EventVariableMeta,
} from "@inventech/shared-types";
import type { EventType } from "@inventech/shared-types";
import type { PaginatedResponse } from "@inventech/shared-types";

export const alertRulesService = {
    async list(params?: ListAlertRulesParams): Promise<PaginatedResponse<AlertRule>> {
        const { data } = await api.get("/alert-rules", { params });
        return data;
    },

    async getById(id: string): Promise<AlertRule> {
        const { data } = await api.get(`/alert-rules/${id}`);
        return data;
    },

    async create(dto: CreateAlertRuleDto): Promise<AlertRule> {
        const { data } = await api.post("/alert-rules", dto);
        return data;
    },

    async update(id: string, dto: UpdateAlertRuleDto): Promise<AlertRule> {
        const { data } = await api.patch(`/alert-rules/${id}`, dto);
        return data;
    },

    async remove(id: string): Promise<void> {
        await api.delete(`/alert-rules/${id}`);
    },

    async toggle(id: string): Promise<AlertRule> {
        const { data } = await api.patch(`/alert-rules/${id}/toggle`);
        return data;
    },

    async previewEmail(
        id: string,
        sampleData?: Record<string, string>,
    ): Promise<{ subject: string; html: string }> {
        const { data } = await api.post(`/alert-rules/${id}/preview-email`, { sampleData });
        return data;
    },

    async getVariableRegistry(): Promise<Record<string, EventVariableMeta>> {
        const { data } = await api.get("/alert-rules/meta/variables");
        return data;
    },
};
