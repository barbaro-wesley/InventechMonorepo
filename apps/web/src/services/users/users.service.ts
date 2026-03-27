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
};