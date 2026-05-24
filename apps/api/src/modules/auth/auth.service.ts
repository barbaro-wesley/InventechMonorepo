import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { UserStatus, UserRole, RefreshToken } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { createHash, timingSafeEqual, randomBytes } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'
import { LoginSecurityService } from './security/login-security.service'
import { TwoFactorService } from './security/two-factor.service'
import { DEFAULT_PERMISSIONS } from '../permissions/permissions.defaults'

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name)

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private loginSecurityService: LoginSecurityService,
        private twoFactorService: TwoFactorService,
    ) { }

    // ─────────────────────────────────────────
    // Login com auditoria e bloqueio
    // ─────────────────────────────────────────
    async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
        // 1. Verifica bloqueio antes de qualquer coisa
        const blockCheck = await this.loginSecurityService.checkIsBlocked(
            dto.email, ipAddress ?? '',
        )

        if (blockCheck.blocked) {
            // Registra tentativa bloqueada
            await this.loginSecurityService.recordAttempt({
                email: dto.email,
                success: false,
                ipAddress: ipAddress ?? '',
                userAgent,
                failReason: 'ACCOUNT_BLOCKED',
            })
            throw new UnauthorizedException(blockCheck.reason)
        }

        // 2. Busca usuário
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        })

        if (!user) {
            await this.loginSecurityService.recordAttempt({
                email: dto.email,
                success: false,
                ipAddress: ipAddress ?? '',
                userAgent,
                failReason: 'USER_NOT_FOUND',
            })
            throw new UnauthorizedException('Credenciais inválidas')
        }

        // 3. Verifica status
        if (user.status === UserStatus.INACTIVE || user.status === UserStatus.SUSPENDED) {
            await this.loginSecurityService.recordAttempt({
                email: dto.email,
                userId: user.id,
                success: false,
                ipAddress: ipAddress ?? '',
                userAgent,
                failReason: `ACCOUNT_${user.status}`,
            })
            throw new UnauthorizedException('Usuário inativo ou suspenso')
        }

        if (user.status === 'UNVERIFIED' as any) {
            throw new UnauthorizedException(
                'Email não verificado. Verifique sua caixa de entrada.',
            )
        }

        // 4. Valida senha
        const passwordValid = await bcrypt.compare(dto.password, user.passwordHash)

        if (!passwordValid) {
            await this.loginSecurityService.recordAttempt({
                email: dto.email,
                userId: user.id,
                success: false,
                ipAddress: ipAddress ?? '',
                userAgent,
                failReason: 'WRONG_PASSWORD',
            })
            throw new UnauthorizedException('Credenciais inválidas')
        }

        // 4.5 — Verifica se é o primeiro login (troca obrigatória de senha)
        if (user.mustChangePassword) {
            await this.loginSecurityService.recordAttempt({
                email: dto.email,
                userId: user.id,
                success: true,
                ipAddress: ipAddress ?? '',
                userAgent,
            })
            const changeToken = await this.generateFirstPasswordToken(user.id, ipAddress)
            this.logger.log(`Primeiro login detectado: ${user.email} | IP: ${ipAddress}`)
            return { requiresPasswordChange: true, changeToken }
        }

        // 5. Verifica se 2FA é obrigatório
        const companyEnforces2FA = user.companyId
            ? await this.prisma.company
                .findUnique({ where: { id: user.companyId }, select: { enforce2FAForAll: true } })
                .then(c => c?.enforce2FAForAll ?? false)
            : false

        const needs2FA =
            user.role === UserRole.SUPER_ADMIN ||
            user.require2FA ||
            companyEnforces2FA

        if (needs2FA) {
            await this.twoFactorService.sendTwoFactorCode(user.id, 'LOGIN', ipAddress)
            await this.loginSecurityService.recordAttempt({
                email: dto.email,
                userId: user.id,
                success: true,
                ipAddress: ipAddress ?? '',
                userAgent,
            })
            this.logger.log(`Login 2FA iniciado: ${user.email} | IP: ${ipAddress}`)
            return { requires2FA: true, user: { id: user.id } }
        }

        // 6. Gera tokens
        const payload: AuthenticatedUser = {
            sub: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            clientId: user.clientId,
            customRoleId: user.customRoleId ?? null,
        }

        const { accessToken, refreshToken } = await this.generateTokens(payload)
        await this.saveRefreshToken(user.id, refreshToken, ipAddress, userAgent)

        // 7. Atualiza último login + registra sucesso
        await Promise.all([
            this.prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
            }),
            this.loginSecurityService.recordAttempt({
                email: dto.email,
                userId: user.id,
                success: true,
                ipAddress: ipAddress ?? '',
                userAgent,
            }),
        ])

        this.logger.log(`Login: ${user.email} | IP: ${ipAddress}`)
        return { accessToken, refreshToken, user: payload }
    }

    // ─────────────────────────────────────────
    // Refresh com rotação de token
    // ─────────────────────────────────────────
    async refresh(
        userId: string,
        rawRefreshToken: string,
        ipAddress?: string,
        userAgent?: string,
    ) {
        const storedTokens = await this.prisma.refreshToken.findMany({
            where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        })

        if (!storedTokens.length) {
            throw new UnauthorizedException('Sessão expirada. Faça login novamente')
        }

        const incomingHash = createHash('sha256').update(rawRefreshToken).digest('hex')

        let validTokenRecord: RefreshToken | null = null
        for (const record of storedTokens) {
            // Suporte a tokens antigos (bcrypt) e novos (sha256)
            let matches = false
            if (record.tokenHash.startsWith('$2b$')) {
                matches = await bcrypt.compare(rawRefreshToken, record.tokenHash)
            } else {
                matches = timingSafeEqual(Buffer.from(incomingHash), Buffer.from(record.tokenHash))
            }
            if (matches) { validTokenRecord = record; break }
        }

        if (!validTokenRecord) {
            await this.revokeAllUserTokens(userId)
            this.logger.warn(`Possível reutilização de refresh token: userId=${userId}`)
            throw new UnauthorizedException('Sessão inválida. Faça login novamente')
        }

        await this.prisma.refreshToken.update({
            where: { id: validTokenRecord.id },
            data: { revokedAt: new Date() },
        })

        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        if (!user || user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException('Usuário inativo')
        }

        const payload: AuthenticatedUser = {
            sub: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            clientId: user.clientId,
            customRoleId: user.customRoleId ?? null,
        }

        const { accessToken, refreshToken } = await this.generateTokens(payload)
        await this.saveRefreshToken(user.id, refreshToken, ipAddress, userAgent)

        return { accessToken, refreshToken }
    }

    // ─────────────────────────────────────────
    // Finaliza login 2FA — emite tokens após verificação
    // ─────────────────────────────────────────
    async completeLogin(userId: string, ipAddress?: string, userAgent?: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        if (!user || user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException('Usuário inativo')
        }

        const payload: AuthenticatedUser = {
            sub: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            clientId: user.clientId,
            customRoleId: user.customRoleId ?? null,
        }

        const { accessToken, refreshToken } = await this.generateTokens(payload)
        await this.saveRefreshToken(user.id, refreshToken, ipAddress, userAgent)

        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
        })

        this.logger.log(`Login 2FA completo: ${user.email} | IP: ${ipAddress}`)
        return { accessToken, refreshToken, user: payload }
    }

    // ─────────────────────────────────────────
    // Me — perfil completo do usuário logado
    // ─────────────────────────────────────────
    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                avatarUrl: true,
                phone: true,
                telegramChatId: true,
                companyId: true,
                clientId: true,
                customRoleId: true,
                company: { select: { id: true, name: true, slug: true, logoUrl: true } },
                client: { select: { id: true, name: true, logoUrl: true } },
                customRole: {
                    select: {
                        id: true,
                        name: true,
                        permissions: { select: { resource: true, action: true } },
                    },
                },
            },
        })

        if (!user) throw new UnauthorizedException('Usuário não encontrado')

        const { customRole, ...baseUser } = user

        if (customRole) {
            const { permissions: rawPerms, ...customRoleData } = customRole
            const permissions = rawPerms.map((p) => `${p.resource}:${p.action}`)
            return { ...baseUser, customRole: customRoleData, permissions }
        }

        // Busca overrides da empresa e globais em paralelo para construir
        // as permissões efetivas (mesmo cascade do PermissionGuard).
        const [companyOverrides, globalOverrides] = await Promise.all([
            baseUser.companyId
                ? this.prisma.resourcePermission.findMany({
                      where: { companyId: baseUser.companyId },
                      select: { resource: true, action: true, allowedRoles: true },
                  })
                : Promise.resolve([]),
            this.prisma.resourcePermission.findMany({
                where: { companyId: null },
                select: { resource: true, action: true, allowedRoles: true },
            }),
        ])

        const toMap = (rows: { resource: string; action: string; allowedRoles: unknown }[]) =>
            new Map<string, string[]>(
                rows.map((o) => [`${o.resource}:${o.action}`, o.allowedRoles as string[]]),
            )

        const companyMap = toMap(companyOverrides)
        const globalMap = toMap(globalOverrides)

        const permissions = Object.entries(DEFAULT_PERMISSIONS)
            .filter(([key, defaultRoles]) => {
                const roles: string[] = companyMap.get(key) ?? globalMap.get(key) ?? (defaultRoles as string[])
                return roles.includes(baseUser.role)
            })
            .map(([key]) => key)

        return { ...baseUser, permissions }
    }

    // ─────────────────────────────────────────
    // Logout
    // ─────────────────────────────────────────

    /**
     * Extrai o userId de um refresh token sem verificar a assinatura.
     * Usado no logout para revogar o token mesmo quando o access_token expirou.
     * Retorna null se o token for inválido ou não tiver o campo `sub`.
     */
    decodeRefreshTokenUserId(rawToken: string): string | null {
        try {
            const payload = this.jwtService.decode(rawToken) as { sub?: string } | null
            return payload?.sub ?? null
        } catch {
            return null
        }
    }

    async logout(userId: string, rawRefreshToken: string) {
        const storedTokens = await this.prisma.refreshToken.findMany({
            where: { userId, revokedAt: null },
        })

        for (const record of storedTokens) {
            const matches = await bcrypt.compare(rawRefreshToken, record.tokenHash)
            if (matches) {
                await this.prisma.refreshToken.update({
                    where: { id: record.id },
                    data: { revokedAt: new Date() },
                })
                break
            }
        }
    }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────
    private async generateTokens(payload: AuthenticatedUser) {
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('app.jwtAccessSecret'),
                expiresIn: this.configService.get('app.jwtAccessExpiresIn', '15m'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('app.jwtRefreshSecret'),
                expiresIn: this.configService.get('app.jwtRefreshExpiresIn', '7d'),
            }),
        ])
        return { accessToken, refreshToken }
    }

    private async saveRefreshToken(
        userId: string,
        rawToken: string,
        ipAddress?: string,
        userAgent?: string,
    ) {
        const tokenHash = createHash('sha256').update(rawToken).digest('hex')
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

        await this.prisma.refreshToken.create({
            data: { userId, tokenHash, ipAddress, userAgent, expiresAt },
        })
    }

    private async revokeAllUserTokens(userId: string) {
        await this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        })
    }

    // ─────────────────────────────────────────
    // Gera token temporário para troca de senha no 1º login
    // ─────────────────────────────────────────
    private async generateFirstPasswordToken(userId: string, ipAddress?: string): Promise<string> {
        // Invalida todos os tokens pendentes do usuário antes de criar um novo
        await this.prisma.passwordReset.updateMany({
            where: { userId, usedAt: null },
            data: { usedAt: new Date() },
        })

        // 256 bits de entropia — suficientemente seguro
        const rawToken = randomBytes(32).toString('hex')

        await this.prisma.passwordReset.create({
            data: {
                userId,
                token: rawToken,
                ipAddress,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
            },
        })

        return rawToken
    }

    // ─────────────────────────────────────────
    // Define a senha no primeiro acesso (via token temporário)
    // ─────────────────────────────────────────
    async setFirstPassword(
        rawToken: string,
        newPassword: string,
        ipAddress?: string,
        userAgent?: string,
    ) {
        // 1. Busca token no banco
        const record = await this.prisma.passwordReset.findUnique({
            where: { token: rawToken },
            include: { user: true },
        })

        if (!record) {
            throw new UnauthorizedException('Token inválido ou expirado')
        }

        // 2. Valida expiração
        if (record.expiresAt < new Date()) {
            throw new UnauthorizedException('Token expirado. Faça login novamente para obter um novo link.')
        }

        // 3. Valida uso único
        if (record.usedAt) {
            throw new UnauthorizedException('Token já utilizado')
        }

        // 4. Confirma que o usuário realmente precisa trocar a senha
        if (!record.user.mustChangePassword) {
            throw new UnauthorizedException('Operação não permitida')
        }

        // 5. Valida comprimento mínimo da nova senha
        if (newPassword.length < 6) {
            throw new BadRequestException('A nova senha deve ter no mínimo 6 caracteres')
        }

        const passwordHash = await bcrypt.hash(newPassword, 10)

        // 6. Transação atômica: token marcado como usado + senha atualizada + flag desativada
        await this.prisma.$transaction([
            this.prisma.passwordReset.update({
                where: { id: record.id },
                data: { usedAt: new Date() },
            }),
            this.prisma.user.update({
                where: { id: record.userId },
                data: {
                    passwordHash,
                    mustChangePassword: false,
                    lastLoginAt: new Date(),
                    lastLoginIp: ipAddress,
                },
            }),
        ])

        // 7. Emite tokens normais — usuário está autenticado a partir daqui
        const user = record.user
        const payload: AuthenticatedUser = {
            sub: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            clientId: user.clientId,
            customRoleId: user.customRoleId ?? null,
        }

        const { accessToken, refreshToken } = await this.generateTokens(payload)
        await this.saveRefreshToken(user.id, refreshToken, ipAddress, userAgent)

        await this.loginSecurityService.recordAttempt({
            email: user.email,
            userId: user.id,
            success: true,
            ipAddress: ipAddress ?? '',
            userAgent,
        })

        this.logger.log(`Senha inicial definida: ${user.email} | IP: ${ipAddress}`)
        return { accessToken, refreshToken, user: payload }
    }
}