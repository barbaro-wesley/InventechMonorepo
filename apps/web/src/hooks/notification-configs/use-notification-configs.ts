import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
    notificationConfigsService,
    type EventType,
    type UpsertNotificationConfigDto,
} from "@/services/notification-configs/notification-configs.service";

export const notificationConfigKeys = {
    all: ["notification-configs"] as const,
    list: () => ["notification-configs", "list"] as const,
};

export function useNotificationConfigs() {
    return useQuery({
        queryKey: notificationConfigKeys.list(),
        queryFn: () => notificationConfigsService.list(),
        staleTime: 1000 * 60 * 5,
    });
}

export function useUpsertNotificationConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ eventType, dto }: { eventType: EventType; dto: UpsertNotificationConfigDto }) =>
            notificationConfigsService.upsert(eventType, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationConfigKeys.all });
            toast.success("Configuração salva com sucesso!");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}

export function useToggleNotificationConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (eventType: EventType) => notificationConfigsService.toggle(eventType),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationConfigKeys.all });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });
}
