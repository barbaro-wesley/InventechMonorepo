import { api } from "@/lib/api";
import type {
    Company,
    CompanyWithLicense,
    CompanyLicenseRow,
    CreateCompanyDto,
    CreateCompanyResponse,
    UpdateCompanyDto,
    UpdateReportSettingsDto,
    ListCompaniesParams,
    License,
} from "@/types/company";
import type { PaginatedResponse } from "@/types/user";

export const companiesService = {
    async list(params?: ListCompaniesParams): Promise<PaginatedResponse<Company>> {
        const { data } = await api.get("/companies", { params });
        // Interceptor preserves the full envelope for paginated responses
        return {
            data: data.data,
            pagination: data.pagination,
        };
    },

    async getById(id: string): Promise<CompanyWithLicense> {
        const { data } = await api.get(`/companies/${id}`);
        return data;
    },

    async create(dto: CreateCompanyDto): Promise<CreateCompanyResponse> {
        const { data } = await api.post("/companies", dto);
        return data;
    },

    async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
        const { data } = await api.patch(`/companies/${id}`, dto);
        return data;
    },

    // Licenças — só SUPER_ADMIN
    async getLicense(companyId: string): Promise<License> {
        const { data } = await api.get(`/companies/${companyId}/license`);
        return data;
    },

    async getAllLicenses(params?: {
        expiringInDays?: number;
        status?: string;
    }): Promise<CompanyLicenseRow[]> {
        const { data } = await api.get("/companies/licenses/all", { params });
        return data;
    },

    async suspend(companyId: string, reason: string): Promise<void> {
        await api.patch(`/companies/${companyId}/suspend`, { reason });
    },

    async activate(companyId: string): Promise<void> {
        await api.patch(`/companies/${companyId}/activate`);
    },

    async updateLicense(
        companyId: string,
        dto: { expiresAt?: string; notes?: string }
    ): Promise<void> {
        await api.patch(`/companies/${companyId}/license`, dto);
    },

    async updateTrial(
        companyId: string,
        dto: { trialEndsAt: string }
    ): Promise<void> {
        await api.patch(`/companies/${companyId}/trial`, dto);
    },

    async uploadLogo(
        companyId: string,
        file: File
    ): Promise<{ logoUrl: string }> {
        const form = new FormData();
        form.append("logo", file);
        const { data } = await api.post(`/companies/${companyId}/logo`, form, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    },

    async updateReportSettings(
        companyId: string,
        dto: UpdateReportSettingsDto
    ): Promise<void> {
        await api.patch(`/companies/${companyId}/report-settings`, dto);
    },
};