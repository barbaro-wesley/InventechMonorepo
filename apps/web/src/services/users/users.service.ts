import { api } from "@/lib/api";
import type {
    User,
    CreateUserDto,
    UpdateUserDto,
    ListUsersParams,
    PaginatedResponse,
} from "@/types/user";

export const usersService = {
    async list(params?: ListUsersParams): Promise<PaginatedResponse<User>> {
        const { data } = await api.get("/users", { params });
        return data;
    },

    async getProfile(): Promise<User> {
        const { data } = await api.get("/users/profile");
        return data;
    },

    async getById(id: string): Promise<User> {
        const { data } = await api.get(`/users/${id}`);
        return data;
    },

    async create(dto: CreateUserDto): Promise<User> {
        const { data } = await api.post("/users", dto);
        return data;
    },

    async update(id: string, dto: UpdateUserDto): Promise<User> {
        const { data } = await api.patch(`/users/${id}`, dto);
        return data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/users/${id}`);
    },

    async updateProfile(dto: UpdateUserDto): Promise<User> {
        const { data } = await api.patch("/users/profile", dto);
        return data;
    },

    async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post("/storage/avatar", form, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await api.patch("/users/profile/password", { currentPassword, newPassword });
    },
};