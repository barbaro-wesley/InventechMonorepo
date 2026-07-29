export { MaintenanceType, RecurrenceType } from '@inventech/shared-types';

/**
 * Tipos de manutenção que NÃO colocam o equipamento em "em manutenção"
 * automaticamente ao abrir a OS.
 *
 * O status "em manutenção" é reservado para equipamentos de fato parados ou
 * sob intervenção (ex.: corretiva). Abrir uma OS preventiva ou de aceitação
 * inicial não deve alterar o status do equipamento.
 *
 * Tipado como string[] para ser compatível tanto com o enum do @prisma/client
 * quanto com a union de @inventech/shared-types (ambos usam os mesmos valores).
 */
export const NON_BLOCKING_MAINTENANCE_TYPES = [
  'PREVENTIVE',
  'INITIAL_ACCEPTANCE',
] as const satisfies readonly string[];

/**
 * Indica se a abertura de uma OS deste tipo de manutenção deve colocar o
 * equipamento em "em manutenção" (equipamento parado / sob intervenção).
 */
export function maintenanceTypeBlocksEquipment(
  type: string | null | undefined,
): boolean {
  if (!type) return false;
  return !(NON_BLOCKING_MAINTENANCE_TYPES as readonly string[]).includes(type);
}
