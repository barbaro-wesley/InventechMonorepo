import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { CompleteChecklistDto, FillChecklistDto } from './dto/checklist.dto'

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(serviceOrderId: string, cu: AuthenticatedUser) {
    await this.assertOsAccess(serviceOrderId, cu)

    const checklist = await this.prisma.serviceOrderChecklist.findUnique({
      where: { serviceOrderId },
      select: {
        id: true,
        fields: true,
        completedAt: true,
        completedBy: { select: { id: true, name: true } },
        template: { select: { id: true, title: true } },
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!checklist) throw new NotFoundException('Checklist não encontrado para esta OS')
    return checklist
  }

  async fill(
    serviceOrderId: string,
    dto: FillChecklistDto,
    cu: AuthenticatedUser,
  ) {
    await this.assertOsAccess(serviceOrderId, cu)

    const checklist = await this.prisma.serviceOrderChecklist.findUnique({
      where: { serviceOrderId },
      select: { id: true, completedAt: true },
    })

    if (!checklist) throw new NotFoundException('Checklist não encontrado para esta OS')
    if (checklist.completedAt)
      throw new ForbiddenException('Checklist já foi concluído e não pode ser editado')

    return this.prisma.serviceOrderChecklist.update({
      where: { serviceOrderId },
      data: { fields: dto.fields as object[] },
      select: {
        id: true,
        fields: true,
        completedAt: true,
        updatedAt: true,
      },
    })
  }

  async complete(
    serviceOrderId: string,
    dto: CompleteChecklistDto,
    cu: AuthenticatedUser,
  ) {
    await this.assertOsAccess(serviceOrderId, cu)

    const checklist = await this.prisma.serviceOrderChecklist.findUnique({
      where: { serviceOrderId },
      select: { id: true, completedAt: true },
    })

    if (!checklist) throw new NotFoundException('Checklist não encontrado para esta OS')
    if (checklist.completedAt)
      throw new ForbiddenException('Checklist já foi concluído')

    return this.prisma.serviceOrderChecklist.update({
      where: { serviceOrderId },
      data: {
        ...(dto.fields && { fields: dto.fields as object[] }),
        completedAt: new Date(),
        completedById: cu.sub,
      },
      select: {
        id: true,
        fields: true,
        completedAt: true,
        completedBy: { select: { id: true, name: true } },
        updatedAt: true,
      },
    })
  }

  async reopen(serviceOrderId: string, cu: AuthenticatedUser) {
    await this.assertOsAccess(serviceOrderId, cu)

    const checklist = await this.prisma.serviceOrderChecklist.findUnique({
      where: { serviceOrderId },
      select: { id: true, completedAt: true },
    })

    if (!checklist) throw new NotFoundException('Checklist não encontrado para esta OS')
    if (!checklist.completedAt)
      throw new ForbiddenException('Checklist ainda não foi concluído')

    return this.prisma.serviceOrderChecklist.update({
      where: { serviceOrderId },
      data: { completedAt: null, completedById: null },
      select: { id: true, completedAt: true, updatedAt: true },
    })
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertOsAccess(serviceOrderId: string, cu: AuthenticatedUser) {
    const os = await this.prisma.serviceOrder.findFirst({
      where: {
        id: serviceOrderId,
        companyId: cu.companyId!,
        deletedAt: null,
        ...(cu.clientId && { clientId: cu.clientId }),
      },
      select: { id: true },
    })
    if (!os) throw new NotFoundException('Ordem de serviço não encontrada')
  }
}
