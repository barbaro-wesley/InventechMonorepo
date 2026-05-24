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
                { provide: PrismaService,        useValue: {} },
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
