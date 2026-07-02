import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { UserRole, UserStatus } from '@prisma/client'

import { UsersService } from './users.service'
import { UsersRepository } from './users.repository'
import { TwoFactorService } from '../auth/security/two-factor.service'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

// ─── Mock bcrypt ──────────────────────────────────────────────────────────────
jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('$2b$10$hashed_password'),
    compare: jest.fn().mockResolvedValue(true),
}))

// ─── Mocks ────────────────────────────────────────────────────────────────────
const SAFE_USER_FIELDS = {
    id: 'user-uuid-1',
    companyId: 'company-uuid-1',
    clientId: null,
    customRoleId: null,
    name: 'Test User',
    email: 'user@test.com',
    role: UserRole.TECHNICIAN,
    status: UserStatus.UNVERIFIED,
    avatarUrl: null,
    phone: null,
    telegramChatId: null,
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    company: { id: 'company-uuid-1', name: 'Test Co', slug: 'test-co' },
    client: null,
    customRole: null,
}

function makeRepoMock() {
    return {
        create: jest.fn().mockResolvedValue(SAFE_USER_FIELDS),
        findById: jest.fn(),
        findByEmail: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(SAFE_USER_FIELDS),
        softDelete: jest.fn().mockResolvedValue(undefined),
        emailExists: jest.fn().mockResolvedValue(false),
    }
}

function makeTwoFactorMock() {
    return {
        sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    }
}

function makeNotificationsMock() {
    return {
        notify: jest.fn().mockResolvedValue(undefined),
    }
}

const COMPANY_ADMIN: import('../../common/interfaces/authenticated-user.interface').AuthenticatedUser = {
    sub: 'admin-uuid-1',
    email: 'admin@test.com',
    role: UserRole.COMPANY_ADMIN,
    companyId: 'company-uuid-1',
    clientId: null,
    customRoleId: null,
}

// ─────────────────────────────────────────────────────────────────────────────
describe('UsersService — mustChangePassword', () => {
    let service: UsersService
    let repoMock: ReturnType<typeof makeRepoMock>

    beforeEach(async () => {
        jest.clearAllMocks()
        repoMock = makeRepoMock()

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: UsersRepository,      useValue: repoMock },
                { provide: TwoFactorService,     useValue: makeTwoFactorMock() },
                { provide: PrismaService,        useValue: { company: { findUnique: jest.fn().mockResolvedValue(null) } } },
                { provide: NotificationsService, useValue: makeNotificationsMock() },
            ],
        }).compile()

        service = module.get(UsersService)
    })

    // =========================================================================
    // create() — deve setar mustChangePassword: true
    // =========================================================================
    describe('create()', () => {
        const CREATE_DTO = {
            name: 'Novo User',
            email: 'novo@test.com',
            password: 'senha123',
            role: UserRole.TECHNICIAN,
        }

        it('cria o usuário com mustChangePassword=true', async () => {
            await service.create(CREATE_DTO as any, COMPANY_ADMIN)

            expect(repoMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ mustChangePassword: true }),
            )
        })

        it('cria o usuário com status UNVERIFIED (não pode logar antes de verificar email)', async () => {
            await service.create(CREATE_DTO as any, COMPANY_ADMIN)

            expect(repoMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ status: UserStatus.UNVERIFIED }),
            )
        })

        it('faz hash da senha antes de armazenar', async () => {
            await service.create(CREATE_DTO as any, COMPANY_ADMIN)

            expect(bcrypt.hash).toHaveBeenCalledWith(CREATE_DTO.password, 10)
            expect(repoMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ passwordHash: '$2b$10$hashed_password' }),
            )
        })

        it('NÃO armazena a senha em claro', async () => {
            await service.create(CREATE_DTO as any, COMPANY_ADMIN)

            const callArg = repoMock.create.mock.calls[0][0]
            expect(callArg).not.toHaveProperty('password')
            expect(callArg.passwordHash).not.toBe(CREATE_DTO.password)
        })
    })

    // =========================================================================
    // update() — deve setar mustChangePassword: true ao redefinir senha
    // =========================================================================
    describe('update()', () => {
        const EXISTING_USER = {
            ...SAFE_USER_FIELDS,
            role: UserRole.TECHNICIAN,
        }

        beforeEach(() => {
            repoMock.findById.mockResolvedValue(EXISTING_USER)
        })

        it('seta mustChangePassword=true quando admin envia nova senha', async () => {
            await service.update(
                'user-uuid-1',
                { password: 'NovaSenhaAdmin@123' },
                COMPANY_ADMIN,
            )

            expect(repoMock.update).toHaveBeenCalledWith(
                'user-uuid-1',
                expect.objectContaining({ mustChangePassword: true }),
            )
        })

        it('faz hash da nova senha antes de armazenar na atualização', async () => {
            await service.update(
                'user-uuid-1',
                { password: 'NovaSenhaAdmin@123' },
                COMPANY_ADMIN,
            )

            expect(bcrypt.hash).toHaveBeenCalledWith('NovaSenhaAdmin@123', 10)
            expect(repoMock.update).toHaveBeenCalledWith(
                'user-uuid-1',
                expect.objectContaining({ passwordHash: '$2b$10$hashed_password' }),
            )
        })

        it('NÃO inclui mustChangePassword quando não há nova senha no DTO', async () => {
            await service.update(
                'user-uuid-1',
                { name: 'Novo Nome' },
                COMPANY_ADMIN,
            )

            const callArg = repoMock.update.mock.calls[0][1]
            expect(callArg).not.toHaveProperty('mustChangePassword')
        })

        it('NÃO inclui mustChangePassword quando DTO.password está ausente/undefined', async () => {
            await service.update(
                'user-uuid-1',
                { status: UserStatus.ACTIVE },
                COMPANY_ADMIN,
            )

            const callArg = repoMock.update.mock.calls[0][1]
            expect(callArg).not.toHaveProperty('mustChangePassword')
        })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Senha padrão de primeiro acesso + reset de senha pelo admin
// ─────────────────────────────────────────────────────────────────────────────
describe('UsersService — senha padrão de primeiro acesso', () => {
    let service: UsersService
    let repoMock: ReturnType<typeof makeRepoMock>
    let prismaMock: {
        company: { findUnique: jest.Mock }
        refreshToken: { updateMany: jest.Mock }
    }

    const COMPANY_WITH_DEFAULT_PASSWORD = {
        settings: {
            security: { defaultFirstAccessPasswordHash: '$2b$10$default_password_hash' },
        },
    }

    beforeEach(async () => {
        jest.clearAllMocks()
        repoMock = makeRepoMock()
        prismaMock = {
            company: { findUnique: jest.fn().mockResolvedValue(null) },
            refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: UsersRepository,      useValue: repoMock },
                { provide: TwoFactorService,     useValue: makeTwoFactorMock() },
                { provide: PrismaService,        useValue: prismaMock },
                { provide: NotificationsService, useValue: makeNotificationsMock() },
            ],
        }).compile()

        service = module.get(UsersService)
    })

    describe('create() sem senha informada', () => {
        const CREATE_DTO_NO_PASSWORD = {
            name: 'Novo User',
            email: 'novo@test.com',
            role: UserRole.TECHNICIAN,
        }

        it('usa o hash da senha padrão da empresa e força mustChangePassword=true', async () => {
            prismaMock.company.findUnique.mockResolvedValue(COMPANY_WITH_DEFAULT_PASSWORD)

            await service.create(CREATE_DTO_NO_PASSWORD as any, COMPANY_ADMIN)

            expect(bcrypt.hash).not.toHaveBeenCalled()
            expect(repoMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    passwordHash: '$2b$10$default_password_hash',
                    mustChangePassword: true,
                }),
            )
        })

        it('lança BadRequestException quando a empresa não tem senha padrão configurada', async () => {
            prismaMock.company.findUnique.mockResolvedValue({ settings: null })

            await expect(
                service.create(CREATE_DTO_NO_PASSWORD as any, COMPANY_ADMIN),
            ).rejects.toThrow(BadRequestException)
            expect(repoMock.create).not.toHaveBeenCalled()
        })
    })

    describe('resetPassword()', () => {
        const TARGET_USER = {
            ...SAFE_USER_FIELDS,
            id: 'target-user-uuid',
            role: UserRole.TECHNICIAN,
        }

        beforeEach(() => {
            repoMock.findById.mockResolvedValue(TARGET_USER)
            prismaMock.company.findUnique.mockResolvedValue(COMPANY_WITH_DEFAULT_PASSWORD)
        })

        it('atualiza passwordHash para o padrão da empresa e força mustChangePassword=true', async () => {
            await service.resetPassword('target-user-uuid', COMPANY_ADMIN)

            expect(repoMock.update).toHaveBeenCalledWith('target-user-uuid', {
                passwordHash: '$2b$10$default_password_hash',
                mustChangePassword: true,
            })
        })

        it('revoga os refresh tokens ativos do usuário-alvo', async () => {
            await service.resetPassword('target-user-uuid', COMPANY_ADMIN)

            expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
                where: { userId: 'target-user-uuid', revokedAt: null },
                data: { revokedAt: expect.any(Date) },
            })
        })

        it('bloqueia o admin de resetar a própria senha por essa via', async () => {
            await expect(
                service.resetPassword(COMPANY_ADMIN.sub, COMPANY_ADMIN),
            ).rejects.toThrow(ForbiddenException)
            expect(repoMock.update).not.toHaveBeenCalled()
        })

        it('respeita a hierarquia de papéis — bloqueia reset em usuário de papel igual/superior', async () => {
            repoMock.findById.mockResolvedValue({ ...TARGET_USER, role: UserRole.COMPANY_ADMIN })

            await expect(
                service.resetPassword('target-user-uuid', COMPANY_ADMIN),
            ).rejects.toThrow(ForbiddenException)
            expect(repoMock.update).not.toHaveBeenCalled()
        })

        it('lança BadRequestException quando a empresa não tem senha padrão configurada', async () => {
            prismaMock.company.findUnique.mockResolvedValue({ settings: null })

            await expect(
                service.resetPassword('target-user-uuid', COMPANY_ADMIN),
            ).rejects.toThrow(BadRequestException)
            expect(repoMock.update).not.toHaveBeenCalled()
        })
    })
})
