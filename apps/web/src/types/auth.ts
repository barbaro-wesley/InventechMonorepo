// Re-exportado de @inventech/shared-types — edite lá, não aqui
export type {
  UserRole,
  UserRole as Role,
  AuthUser,
  LoginResponse,
  AuthMeResponse,
} from '@inventech/shared-types';

export {
  ROLE_HIERARCHY,
  ROLE_LABELS,
  hasRole,
} from '@inventech/shared-types';

import { ROLE_LABELS } from '@inventech/shared-types';

/** Retorna o nome do papel personalizado se existir, senão o label do papel de sistema */
export function displayRole(user: {
  role: string;
  customRole?: { name: string } | null;
}): string {
  return user.customRole?.name ?? ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role;
}
