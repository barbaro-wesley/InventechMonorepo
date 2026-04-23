import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common'
import * as Minio from 'minio'
import { ConfigService } from '@nestjs/config'
import { OnModuleInit } from '@nestjs/common'
import { ManualType } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { PrismaService } from '../../../prisma/prisma.service'
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface'
import { CreateManualDto, UpdateManualDto } from './dto/manual.dto'

const MANUAL_BUCKET = 'equipment-manuals'
const ALLOWED_PDF_MIME = 'application/pdf'
const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50MB

@Injectable()
export class ManualsService implements OnModuleInit {
    private client: Minio.Client

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {}

    onModuleInit() {
        this.client = new Minio.Client({
            endPoint: this.configService.get<string>('minio.endpoint', 'localhost'),
            port: this.configService.get<number>('minio.port', 9000),
            useSSL: this.configService.get<boolean>('minio.useSSL', false),
            accessKey: this.configService.get<string>('minio.accessKey', ''),
            secretKey: this.configService.get<string>('minio.secretKey', ''),
        })
    }

    async findAll(equipmentId: string, companyId: string) {
        await this.assertEquipmentExists(equipmentId, companyId)

        return this.prisma.equipmentManual.findMany({
            where: { equipmentId, companyId },
            orderBy: [{ ativo: 'desc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                titulo: true,
                descricao: true,
                tipo: true,
                conteudoTexto: true,
                url: true,
                fileName: true,
                mimeType: true,
                sizeBytes: true,
                ativo: true,
                createdAt: true,
                updatedAt: true,
                createdBy: { select: { id: true, name: true } },
            },
        })
    }

    async findOne(equipmentId: string, manualId: string, companyId: string) {
        const manual = await this.prisma.equipmentManual.findFirst({
            where: { id: manualId, equipmentId, companyId },
            select: {
                id: true,
                titulo: true,
                descricao: true,
                tipo: true,
                conteudoTexto: true,
                url: true,
                fileName: true,
                mimeType: true,
                sizeBytes: true,
                ativo: true,
                createdAt: true,
                updatedAt: true,
                createdBy: { select: { id: true, name: true } },
            },
        })

        if (!manual) throw new NotFoundException('Manual não encontrado')

        return manual
    }

    async create(
        equipmentId: string,
        dto: CreateManualDto,
        companyId: string,
        currentUser: AuthenticatedUser,
        file?: Express.Multer.File,
    ) {
        await this.assertEquipmentExists(equipmentId, companyId)
        this.validatePayload(dto, file)

        let fileFields: {
            fileName?: string
            storedName?: string
            bucket?: string
            key?: string
            mimeType?: string
            sizeBytes?: number
        } = {}

        if (dto.tipo === ManualType.PDF && file) {
            const key = `${companyId}/${equipmentId}/${uuidv4()}.pdf`
            await this.client.putObject(MANUAL_BUCKET, key, file.buffer, file.size, {
                'Content-Type': ALLOWED_PDF_MIME,
                'x-amz-meta-original-name': encodeURIComponent(file.originalname),
                'x-amz-meta-uploaded-by': currentUser.sub,
            })
            fileFields = {
                fileName: file.originalname,
                storedName: key.split('/').pop()!,
                bucket: MANUAL_BUCKET,
                key,
                mimeType: ALLOWED_PDF_MIME,
                sizeBytes: file.size,
            }
        }

        return this.prisma.equipmentManual.create({
            data: {
                companyId,
                equipmentId,
                createdById: currentUser.sub,
                titulo: dto.titulo,
                descricao: dto.descricao,
                tipo: dto.tipo,
                conteudoTexto: dto.tipo === ManualType.TEXTO ? dto.conteudoTexto : null,
                url: dto.tipo === ManualType.LINK ? dto.url : null,
                ativo: dto.ativo ?? true,
                ...fileFields,
            },
            select: {
                id: true,
                titulo: true,
                descricao: true,
                tipo: true,
                conteudoTexto: true,
                url: true,
                fileName: true,
                mimeType: true,
                sizeBytes: true,
                ativo: true,
                createdAt: true,
                createdBy: { select: { id: true, name: true } },
            },
        })
    }

    async update(
        equipmentId: string,
        manualId: string,
        dto: UpdateManualDto,
        companyId: string,
    ) {
        const manual = await this.prisma.equipmentManual.findFirst({
            where: { id: manualId, equipmentId, companyId },
            select: { id: true },
        })
        if (!manual) throw new NotFoundException('Manual não encontrado')

        return this.prisma.equipmentManual.update({
            where: { id: manualId },
            data: {
                titulo: dto.titulo,
                descricao: dto.descricao,
                conteudoTexto: dto.conteudoTexto,
                url: dto.url,
                ativo: dto.ativo,
            },
            select: {
                id: true,
                titulo: true,
                descricao: true,
                tipo: true,
                conteudoTexto: true,
                url: true,
                fileName: true,
                mimeType: true,
                sizeBytes: true,
                ativo: true,
                updatedAt: true,
                createdBy: { select: { id: true, name: true } },
            },
        })
    }

    async remove(
        equipmentId: string,
        manualId: string,
        companyId: string,
        currentUser: AuthenticatedUser,
    ) {
        const manual = await this.prisma.equipmentManual.findFirst({
            where: { id: manualId, equipmentId, companyId },
            select: { id: true, bucket: true, key: true, createdById: true },
        })
        if (!manual) throw new NotFoundException('Manual não encontrado')

        const canDelete =
            manual.createdById === currentUser.sub ||
            ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_MANAGER'].includes(currentUser.role)

        if (!canDelete) {
            throw new ForbiddenException('Você não tem permissão para excluir este manual')
        }

        if (manual.bucket && manual.key) {
            try {
                await this.client.removeObject(manual.bucket, manual.key)
            } catch {
                // Arquivo pode já ter sido removido do MinIO
            }
        }

        await this.prisma.equipmentManual.delete({ where: { id: manualId } })

        return { message: 'Manual removido com sucesso' }
    }

    async downloadPdf(equipmentId: string, manualId: string, companyId: string) {
        const manual = await this.prisma.equipmentManual.findFirst({
            where: { id: manualId, equipmentId, companyId, tipo: ManualType.PDF },
            select: { bucket: true, key: true, fileName: true },
        })

        if (!manual || !manual.bucket || !manual.key) {
            throw new NotFoundException('Manual PDF não encontrado')
        }

        const stream = await this.client.getObject(manual.bucket, manual.key)

        return { stream, fileName: manual.fileName! }
    }

    private async assertEquipmentExists(equipmentId: string, companyId: string) {
        const equipment = await this.prisma.equipment.findFirst({
            where: { id: equipmentId, companyId, deletedAt: null },
            select: { id: true },
        })
        if (!equipment) throw new NotFoundException('Equipamento não encontrado')
    }

    private validatePayload(dto: CreateManualDto, file?: Express.Multer.File) {
        if (dto.tipo === ManualType.PDF) {
            if (!file) throw new BadRequestException('Arquivo PDF é obrigatório para manuais do tipo PDF')
            if (file.mimetype !== ALLOWED_PDF_MIME) throw new BadRequestException('Somente arquivos PDF são aceitos')
            if (file.size > MAX_PDF_SIZE) throw new BadRequestException('Arquivo PDF excede o limite de 50MB')
        }

        if (dto.tipo === ManualType.TEXTO && !dto.conteudoTexto?.trim()) {
            throw new BadRequestException('conteudoTexto é obrigatório para manuais do tipo TEXTO')
        }

        if (dto.tipo === ManualType.LINK && !dto.url?.trim()) {
            throw new BadRequestException('url é obrigatória para manuais do tipo LINK')
        }
    }
}
