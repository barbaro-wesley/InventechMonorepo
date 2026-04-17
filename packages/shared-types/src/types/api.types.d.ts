export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}
export interface ApiResponse<T> {
    success: boolean;
    statusCode: number;
    data: T | null;
    message?: string;
    pagination?: PaginationMeta;
    timestamp: string;
}
//# sourceMappingURL=api.types.d.ts.map