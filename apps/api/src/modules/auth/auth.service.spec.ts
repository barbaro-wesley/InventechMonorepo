import { Test, TestingModule } from '@nestjs/testing'
import { UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'

import { AuthService } from './auth.service'
import { LoginSecurityService } from './security/login-security.service'
import { TwoFactorService } from './security/two-factor.service'
import { PrismaService } from '../../prisma/prisma.service'
import { UserRole, UserStatus } from '@prisma/client'

// ─── Mock bcrypt ──────────────────────────────────────────────────────────────
jest.mock('bcrypt', () => ({
    compare: jest.fn(),
    hash: jest.fn().mockResolvedValue('$2b$10$hashed_new_password'),
}))

// ─── Fábrica de mocks ─────────────────────────────────────────────────────────
function makePrismaMock() {
    return {
        user: {
            findUnique: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
        },
        passwordReset: {
            findUnique: jest.fn(),
            create: jest.fn().mockResolvedValue({ id: 'pr-1' }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            update: jest.fn().mockResolvedValue({}),
        },
        refreshToken: {
            create: jest.fn().mockResolvedValue({}),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({}),
        },
        company: {
            findUnique: jest.fn().mockResolvedValue({ enforce2FAForAll: false }),
        },
        loginAttempt: {
            create: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(0),
        },
        $transaction: jest.fn((ops: unknown[]) => {
            if (Array.isArray(ops)) return Promise.resolve(ops.map(() => ({})))
            return Promise.resolve({})
        }),
    }
}

function makeLoginSecurityMock() {
    return {
        checkIsBlocked: jest.fn().mockResolvedValue({ blocked: false }),
        recordAttempt: jest.fn().mockResolvedValue(undefined),
    }
}

function makeTwoFactorMock() {
    return {
        sendTwoFactorCode: jest.fn().mockResolvedValue(undefined),
    }
}

function makeJwtMock() {
    return {
        signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
        decode: jest.fn(),
    }
}

function makeConfigMock() {
    return {
        get: jest.fn((key: string, fallback?: unknown) => fallback ?? 'mock-value'),
    }
}

// ─── Usuário base para os testes ──────────────────────────────────────────────
const BASE_USER = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    name: 'Test User',
    passwordHash: '$2b$10$hashed',
    role: UserRole.TECHNICIAN,
    status: UserStatus.ACTIVE,
    companyId: 'company-uuid-1',
    clientId: null,
    customRoleId: null,
    require2FA: false,
    mustChangePassword: false,
    lastLoginAt: null,
    lastLoginIp: null,
}

const LOGIN_DTO = { email: 'user@example.com', password: 'Senha@123' }

// ─────────────────────────────────────────────────────────────────────────────
describe('AuthService', () => {
    let service: AuthService
    let prismaMock: ReturnType<typeof makePrismaMock>
    let loginSecurityMock: ReturnType<typeof makeLoginSecurityMock>
    let jwtMock: ReturnType<typeof makeJwtMock>

    beforeEach(async () => {
        jest.clearAllMocks()

        prismaMock = makePrismaMock()
        loginSecurityMock = makeLoginSecurityMock()

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService,        useValue: prismaMock },
                { provide: JwtService,           useValue: makeJwtMock() },
                { provide: ConfigService,        useValue: makeConfigMock() },
                { provide: LoginSecurityService, useValue: loginSecurityMock },
                { provide: TwoFactorService,     useValue: makeTwoFactorMock() },
            ],
        }).compile()

        service    = module.get(AuthService)
        jwtMock    = module.get(JwtService) as unknown as ReturnType<typeof makeJwtMock>
    })

    // =========================================================================
    // login() — mustChangePassword
    // =========================================================================
    describe('login() — mustChangePassword', () => {
        beforeEach(() => {
            ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
        })

        it('retorna { requiresPasswordChange: true, changeToken } quando a flag está ativa', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ ...BASE_USER, mustChangePassword: true })

            const result = await service.login(LOGIN_DTO, '127.0.0.1', 'Jest')

            expect(result).toMatchObject({ requiresPasswordChange: true })
            expect((result as any).changeToken).toBeDefined()
            expect(result).not.toHaveProperty('accessToken')
            expect(result).not.toHaveProperty('refreshToken')
        })

        it('o changeToken tem 64 chars hexadecimais (32 bytes de entropia)', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ ...BASE_USER, mustChangePassword: true })

            const result = await service.login(LOGIN_DTO, '127.0.0.1') as any

            expect(result.changeToken).toHaveLength(64)
            expect(result.changeToken).toMatch(/^[0-9a-f]+$/)
        })

        it('cria um registro PasswordReset no banco ao detectar a flag', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ ...BASE_USER, mustChangePassword: true })

            await service.login(LOGIN_DTO, '1.2.3.4', 'Jest')

            expect(prismaMock.passwordReset.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: BASE_USER.id,
                        token: expect.any(String),
                        expiresAt: expect.any(Date),
                    }),
                }),
            )
        })

        it('invalida tokens pendentes antes de criar um novo (updateMany com usedAt: null)', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ ...BASE_USER, mustChangePassword: true })

            await service.login(LOGIN_DTO, '1.2.3.4', 'Jest')

            expect(prismaMock.passwordReset.updateMany).toHaveBeenCalledWith({
                where: { userId: BASE_USER.id, usedAt: null },
                data: { usedAt: expect.any(Date) },
            })
        })

        it('registra a tentativa como bem-sucedida ao detectar mustChangePassword', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ ...BASE_USER, mustChangePassword: true })

            await service.login(LOGIN_DTO, '1.2.3.4', 'Jest')

            expect(loginSecurityMock.recordAttempt).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, userId: BASE_USER.id }),
            )
        })

        it('segue o fluxo normal (tokens emitidos) quando mustChangePassword=false', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ ...BASE_USER, mustChangePassword: false })

            const result = await service.login(LOGIN_DTO, '1.2.3.4', 'Jest')

            expect(result).toHaveProperty('accessToken')
            expect(result).toHaveProperty('refreshToken')
            expect(result).not.toHaveProperty('requiresPasswordChange')
        })

        it('NÃO chama generateFirstPasswordToken quando mustChangePassword=false', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ ...BASE_USER, mustChangePassword: false })

            await service.login(LOGIN_DTO, '1.2.3.4', 'Jest')

            expect(prismaMock.passwordReset.create).not.toHaveBeenCalled()
        })
    })

    // =========================================================================
    // setFirstPassword()
    // =========================================================================
    describe('setFirstPassword()', () => {
        const RAW_TOKEN = 'a'.repeat(64) // token válido de 64 chars hex
        const NEW_PASSWORD = 'NovaSenha@Segura123'

        const VALID_RECORD = {
            id: 'pr-uuid-1',
            token: RAW_TOKEN,
            userId: BASE_USER.id,
            usedAt: null,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min no futuro
            user: { ...BASE_USER, mustChangePassword: true },
        }

        it('retorna accessToken, refreshToken e user com token válido', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(VALID_RECORD)

            const result = await service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD, '1.2.3.4')

            expect(result).toHaveProperty('accessToken')
            expect(result).toHaveProperty('refreshToken')
            expect(result).toHaveProperty('user')
            expect(result.user).toMatchObject({ sub: BASE_USER.id, email: BASE_USER.email })
        })

        it('executa token + senha em $transaction atômica (array com 2 operações)', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(VALID_RECORD)

            await service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD, '1.2.3.4')

            expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
            const ops = prismaMock.$transaction.mock.calls[0][0]
            expect(Array.isArray(ops)).toBe(true)
            expect(ops).toHaveLength(2)
        })

        it('marca o token como usado (usedAt) dentro da transação', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(VALID_RECORD)

            await service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD, '1.2.3.4')

            expect(prismaMock.passwordReset.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'pr-uuid-1' },
                    data: expect.objectContaining({ usedAt: expect.any(Date) }),
                }),
            )
        })

        it('seta mustChangePassword=false na atualização do usuário', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(VALID_RECORD)

            await service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD, '1.2.3.4')

            expect(prismaMock.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: BASE_USER.id },
                    data: expect.objectContaining({ mustChangePassword: false }),
                }),
            )
        })

        it('faz hash da nova senha antes de armazenar', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(VALID_RECORD)

            await service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD, '1.2.3.4')

            expect(bcrypt.hash).toHaveBeenCalledWith(NEW_PASSWORD, 10)
            expect(prismaMock.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ passwordHash: '$2b$10$hashed_new_password' }),
                }),
            )
        })

        it('lança 401 quando o token não existe no banco', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(null)

            await expect(service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD)).rejects.toThrow(
                new UnauthorizedException('Token inválido ou expirado'),
            )
        })

        it('lança 401 quando o token está expirado', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue({
                ...VALID_RECORD,
                expiresAt: new Date(Date.now() - 1_000), // 1s atrás
            })

            await expect(service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD)).rejects.toThrow(
                UnauthorizedException,
            )
        })

        it('lança 401 quando o token já foi utilizado (usedAt preenchido)', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue({
                ...VALID_RECORD,
                usedAt: new Date(),
            })

            await expect(service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD)).rejects.toThrow(
                new UnauthorizedException('Token já utilizado'),
            )
        })

        it('lança 401 quando mustChangePassword=false (usuário já definiu a senha)', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue({
                ...VALID_RECORD,
                user: { ...BASE_USER, mustChangePassword: false },
            })

            await expect(service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD)).rejects.toThrow(
                new UnauthorizedException('Operação não permitida'),
            )
        })

        it('lança 400 quando a nova senha tem menos de 6 caracteres', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(VALID_RECORD)

            await expect(service.setFirstPassword(RAW_TOKEN, '12345')).rejects.toThrow(
                new BadRequestException('A nova senha deve ter no mínimo 6 caracteres'),
            )
        })

        it('NÃO emite tokens se a $transaction falhar (rollback implícito)', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(VALID_RECORD)
            prismaMock.$transaction.mockRejectedValueOnce(new Error('DB error'))

            await expect(service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD)).rejects.toThrow('DB error')
            expect(jwtMock.signAsync).not.toHaveBeenCalled()
        })

        it('registra tentativa bem-sucedida após a troca de senha', async () => {
            prismaMock.passwordReset.findUnique.mockResolvedValue(VALID_RECORD)

            await service.setFirstPassword(RAW_TOKEN, NEW_PASSWORD, '1.2.3.4', 'Jest')

            expect(loginSecurityMock.recordAttempt).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, email: BASE_USER.email }),
            )
        })
    })
})
