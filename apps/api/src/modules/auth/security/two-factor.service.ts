import {
    Injectable,
    Logger,
    BadRequestException,
    UnauthorizedException,
    Inject,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import type Redis from 'ioredis'
import { PrismaService } from '../../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../../common/providers/redis.provider'
import { NotificationsService } from '../../notifications/notifications.service'
import { buildTwoFactorCodeEmail } from './templates/two-factor-code.template'
import { buildEmailVerificationEmail } from './templates/email-verification.template'
import { buildPasswordResetEmail } from './templates/password-reset.template'

const CODE_TTL_SEC = 10 * 60             // 10 minutos — código 2FA no Redis
const TOKEN_EXPIRY_HOURS = 24            // Token de email/reset expira em 24h
const RESET_TOKEN_EXPIRY_HOURS = 1       // Token de reset de senha expira em 1h

export type TwoFactorType = 'LOGIN' | 'EMAIL_CHANGE' | 'PASSWORD_RESET' | 'SENSITIVE_ACTION'

const twoFaKey = (userId: string, type: TwoFactorType) => `2fa:${userId}:${type}`

@Injectable()
export class TwoFactorService {
    private readonly logger = new Logger(TwoFactorService.name)

    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) { }

    // ─────────────────────────────────────────
    // Gera código numérico de 6 dígitos e
    // armazena o hash no Redis (TTL 10 min).
    // Substituir no Redis já invalida o código anterior.
    // ─────────────────────────────────────────
    async sendTwoFactorCode(
        userId: string,
        type: TwoFactorType,
        ipAddress?: string,
    ): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
        })
        if (!user) throw new BadRequestException('Usuário não encontrado')

        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const codeHash = await bcrypt.hash(code, 10)

        // SET com EX sobrescreve automaticamente o código anterior do mesmo tipo
        await this.redis.set(twoFaKey(userId, type), codeHash, 'EX', CODE_TTL_SEC)

        const subjects: Record<TwoFactorType, string> = {
            LOGIN: '🔐 Seu código de verificação',
            EMAIL_CHANGE: '📧 Confirme a troca de email',
            PASSWORD_RESET: '🔑 Código para redefinir sua senha',
            SENSITIVE_ACTION: '⚠️ Confirmação de ação sensível',
        }

        await this.notificationsService.queueAuthEmail({
            to: user.email,
            ...buildTwoFactorCodeEmail({ userName: user.name, subject: subjects[type], code, ipAddress }),
        })

        this.logger.log(`Código 2FA enviado: userId=${userId} | tipo=${type}`)
    }

    // ─────────────────────────────────────────
    // Valida o código informado pelo usuário
    // ─────────────────────────────────────────
    async verifyCode(
        userId: string,
        code: string,
        type: TwoFactorType,
    ): Promise<boolean> {
        const key = twoFaKey(userId, type)
        const codeHash = await this.redis.get(key)

        if (!codeHash) {
            throw new UnauthorizedException('Código expirado ou inválido. Solicite um novo.')
        }

        const isValid = await bcrypt.compare(code, codeHash)

        if (!isValid) {
            throw new UnauthorizedException('Código incorreto.')
        }

        // Remove imediatamente após uso — impede replay
        await this.redis.del(key)
        return true
    }

    // ─────────────────────────────────────────
    // Envia email de verificação no cadastro
    // ─────────────────────────────────────────
    async sendEmailVerification(userId: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
        })
        if (!user) return

        await this.prisma.emailVerification.updateMany({
            where: { userId, verifiedAt: null },
            data: { verifiedAt: new Date() },
        })

        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

        await this.prisma.emailVerification.create({
            data: { userId, token, expiresAt },
        })

        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001'
        const verificationUrl = `${frontendUrl}/verificar-email?token=${token}`

        await this.notificationsService.queueAuthEmail({
            to: user.email,
            ...buildEmailVerificationEmail({ userName: user.name, verificationUrl }),
        })
    }

    // ─────────────────────────────────────────
    // Verifica token de email
    // ─────────────────────────────────────────
    async verifyEmailToken(token: string): Promise<{ userId: string }> {
        const record = await this.prisma.emailVerification.findUnique({
            where: { token },
            select: { id: true, userId: true, expiresAt: true, verifiedAt: true },
        })

        if (!record) throw new BadRequestException('Token inválido')
        if (record.verifiedAt) throw new BadRequestException('Email já verificado')
        if (record.expiresAt < new Date()) throw new BadRequestException('Token expirado. Solicite um novo.')

        await this.prisma.$transaction([
            this.prisma.emailVerification.update({
                where: { id: record.id },
                data: { verifiedAt: new Date() },
            }),
            this.prisma.user.update({
                where: { id: record.userId },
                data: { status: 'ACTIVE' },
            }),
        ])

        this.logger.log(`Email verificado: userId=${record.userId}`)
        return { userId: record.userId }
    }

    // ─────────────────────────────────────────
    // Envia link de reset de senha
    // ─────────────────────────────────────────
    async sendPasswordReset(email: string, ipAddress?: string): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true },
        })

        if (!user) {
            this.logger.debug(`Reset solicitado para email inexistente: ${email}`)
            return
        }

        await this.prisma.passwordReset.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
        })

        const token = crypto.randomBytes(32).toString('hex')
        const tokenHash = await bcrypt.hash(token, 10)
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

        await this.prisma.passwordReset.create({
            data: { userId: user.id, token: tokenHash, ipAddress, expiresAt },
        })

        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001'
        const resetUrl = `${frontendUrl}/reset-password?token=${token}`

        await this.notificationsService.queueAuthEmail({
            to: email,
            ...buildPasswordResetEmail({ userName: user.name, resetUrl, ipAddress }),
        })

        this.logger.log(`Reset de senha enviado: userId=${user.id}`)
    }

    // ─────────────────────────────────────────
    // Redefine a senha com o token
    // ─────────────────────────────────────────
    async resetPassword(token: string, newPassword: string): Promise<void> {
        const records = await this.prisma.passwordReset.findMany({
            where: { usedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, userId: true, token: true },
        })

        let validRecord: typeof records[0] | null = null

        for (const record of records) {
            const matches = await bcrypt.compare(token, record.token)
            if (matches) { validRecord = record; break }
        }

        if (!validRecord) {
            throw new BadRequestException('Token inválido ou expirado. Solicite um novo link.')
        }

        const passwordHash = await bcrypt.hash(newPassword, 10)

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: validRecord.userId },
                data: { passwordHash },
            }),
            this.prisma.passwordReset.update({
                where: { id: validRecord.id },
                data: { usedAt: new Date() },
            }),
            this.prisma.refreshToken.updateMany({
                where: { userId: validRecord.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ])

        this.logger.log(`Senha redefinida: userId=${validRecord.userId}`)
    }
}
