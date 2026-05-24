/**
 * E2E — Fluxo de troca obrigatória de senha no primeiro login
 *
 * Pré-requisito: banco PostgreSQL acessível (docker compose up postgres).
 * Usa um módulo mínimo (sem Redis/MinIO) para isolar o fluxo de auth.
 *
 * Executar: npm run test:e2e -- --testPathPattern auth.e2e
 */

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { APP_GUARD, APP_FILTER, Reflector } from '@nestjs/core'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import * as bcrypt from 'bcrypt'
import { UserRole, UserStatus } from '@prisma/client'

import { AuthService } from '../src/modules/auth/auth.service'
import { AuthController } from '../src/modules/auth/auth.controller'
import { LoginSecurityService } from '../src/modules/auth/security/login-security.service'
import { TwoFactorService } from '../src/modules/auth/security/two-factor.service'
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy'
import { JwtRefreshStrategy } from '../src/modules/auth/strategies/jwt-refresh.strategy'
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard'
import { PrismaModule } from '../src/prisma/prisma.module'
import { PrismaService } from '../src/prisma/prisma.service'
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter'
import { appConfig, databaseConfig } from '../src/config'

// NotificationsService — mock sem-operação para não precisar de Redis/MinIO
const mockNotificationsService = {
    queueAuthEmail: jest.fn().mockResolvedValue(undefined),
    notify:         jest.fn().mockResolvedValue(undefined),
}

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/set-first-password (e2e)', () => {
    let app: INestApplication
    let prisma: PrismaService

    const TEST_EMAIL    = `e2e-first-pwd-${Date.now()}@inventech.test`
    const TEMP_PASSWORD = 'SenhaTemporaria@123'
    const NEW_PASSWORD  = 'NovaSenha@Segura456'

    // ── Bootstrap do app de teste ─────────────────────────────────────────────
    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env',
                    load: [appConfig, databaseConfig],
                }),
                PrismaModule,
                PassportModule.register({ defaultStrategy: 'jwt' }),
                JwtModule.register({}),
            ],
            controllers: [AuthController],
            providers: [
                AuthService,
                LoginSecurityService,
                TwoFactorService,
                JwtStrategy,
                JwtRefreshStrategy,
                // Mock para evitar dependência de Redis/SMTP
                { provide: 'NotificationsService', useValue: mockNotificationsService },
                // Substitui a dependência injetada em TwoFactorService
                {
                    provide: TwoFactorService,
                    useFactory: (prismaService: PrismaService) => {
                        const svc = new TwoFactorService(prismaService, mockNotificationsService as any)
                        return svc
                    },
                    inject: [PrismaService],
                },
                { provide: APP_GUARD,  useFactory: (r: Reflector) => new JwtAuthGuard(r), inject: [Reflector] },
                { provide: APP_FILTER, useClass: GlobalExceptionFilter },
            ],
        }).compile()

        app = moduleFixture.createNestApplication()
        app.use(cookieParser())
        app.setGlobalPrefix('api/v1')
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }))
        await app.init()

        prisma = moduleFixture.get(PrismaService)
    })

    afterAll(async () => {
        // Limpa dados de teste para não poluir o banco de dev
        await prisma.passwordReset.deleteMany({ where: { user: { email: TEST_EMAIL } } })
        await prisma.loginAttempt.deleteMany({ where: { email: TEST_EMAIL } })
        await prisma.refreshToken.deleteMany({ where: { user: { email: TEST_EMAIL } } })
        await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
        await app.close()
    })

    // ── Helper: cria usuário de teste diretamente no banco ───────────────────
    async function seedUser(overrides: Partial<{ mustChangePassword: boolean; status: UserStatus }> = {}) {
        const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10)
        return prisma.user.create({
            data: {
                email: TEST_EMAIL,
                name: 'E2E First Password User',
                passwordHash,
                role: UserRole.TECHNICIAN, // Sem 2FA obrigatório
                status: UserStatus.ACTIVE,  // ACTIVE para conseguir logar
                mustChangePassword: true,
                ...overrides,
            },
        })
    }

    async function deleteUser() {
        await prisma.passwordReset.deleteMany({ where: { user: { email: TEST_EMAIL } } })
        await prisma.loginAttempt.deleteMany({ where: { email: TEST_EMAIL } })
        await prisma.refreshToken.deleteMany({ where: { user: { email: TEST_EMAIL } } })
        await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
    }

    // =========================================================================
    // Cenário 1 — fluxo completo
    // =========================================================================
    describe('fluxo completo: login → set-first-password → acesso normal', () => {
        let changeToken: string

        beforeAll(async () => {
            await seedUser()
        })

        afterAll(async () => {
            await deleteUser()
        })

        it('POST /auth/login retorna requiresPasswordChange=true e um changeToken', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ email: TEST_EMAIL, password: TEMP_PASSWORD })
                .expect(200)

            expect(res.body.data ?? res.body).toMatchObject({ requiresPasswordChange: true })
            const body = res.body.data ?? res.body
            expect(body.changeToken).toBeDefined()
            expect(body.changeToken).toHaveLength(64)
            changeToken = body.changeToken

            // Não deve setar cookies de sessão ainda
            const cookies = res.headers['set-cookie'] as unknown as string[] | undefined
            const hasAccessCookie = cookies?.some((c: string) => c.startsWith('access_token='))
            expect(hasAccessCookie).toBeFalsy()
        })

        it('POST /auth/set-first-password com token válido seta cookies e retorna o usuário', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/set-first-password')
                .send({ changeToken, newPassword: NEW_PASSWORD })
                .expect(200)

            // Deve retornar dados do usuário
            const body = res.body.data ?? res.body
            expect(body.user).toBeDefined()
            expect(body.user.email).toBe(TEST_EMAIL)

            // Deve setar cookies HTTP-Only de sessão
            const cookies = res.headers['set-cookie'] as unknown as string[]
            expect(Array.isArray(cookies)).toBe(true)
            expect(cookies.some((c: string) => c.startsWith('access_token='))).toBe(true)
            expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true)
        })

        it('mustChangePassword=false após a troca — segundo login flui normalmente', async () => {
            const updatedUser = await prisma.user.findUnique({
                where: { email: TEST_EMAIL },
                select: { mustChangePassword: true },
            })
            expect(updatedUser?.mustChangePassword).toBe(false)
        })
    })

    // =========================================================================
    // Cenário 2 — token expirado
    // =========================================================================
    describe('token expirado retorna 401', () => {
        let expiredToken: string

        beforeAll(async () => {
            await seedUser()
            // Insere um PasswordReset já expirado manualmente
            const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL }, select: { id: true } })
            const raw = 'b'.repeat(64)
            await prisma.passwordReset.create({
                data: {
                    userId: user!.id,
                    token: raw,
                    expiresAt: new Date(Date.now() - 1_000), // expirado há 1s
                },
            })
            expiredToken = raw
        })

        afterAll(async () => {
            await deleteUser()
        })

        it('retorna 401 com mensagem de token expirado', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/set-first-password')
                .send({ changeToken: expiredToken, newPassword: NEW_PASSWORD })
                .expect(401)

            const body = res.body.data ?? res.body
            expect(body.message ?? body.error ?? JSON.stringify(body)).toMatch(/expirado/i)
        })
    })

    // =========================================================================
    // Cenário 3 — token já utilizado
    // =========================================================================
    describe('token já usado retorna 401', () => {
        let usedToken: string

        beforeAll(async () => {
            await seedUser()
            const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL }, select: { id: true } })
            const raw = 'c'.repeat(64)
            await prisma.passwordReset.create({
                data: {
                    userId: user!.id,
                    token: raw,
                    expiresAt: new Date(Date.now() + 10 * 60_000),
                    usedAt: new Date(), // já usado
                },
            })
            usedToken = raw
        })

        afterAll(async () => {
            await deleteUser()
        })

        it('retorna 401 com mensagem de token já utilizado', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/set-first-password')
                .send({ changeToken: usedToken, newPassword: NEW_PASSWORD })
                .expect(401)

            const body = res.body.data ?? res.body
            expect(body.message ?? body.error ?? JSON.stringify(body)).toMatch(/utilizado/i)
        })
    })

    // =========================================================================
    // Cenário 4 — segundo login invalida o token do primeiro
    // =========================================================================
    describe('segundo login invalida o token do login anterior', () => {
        let firstToken: string

        beforeAll(async () => {
            await seedUser()
        })

        afterAll(async () => {
            await deleteUser()
        })

        it('primeiro login gera um changeToken', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ email: TEST_EMAIL, password: TEMP_PASSWORD })
                .expect(200)

            const body = res.body.data ?? res.body
            firstToken = body.changeToken
            expect(firstToken).toBeDefined()
        })

        it('segundo login invalida o primeiro token e gera um novo', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ email: TEST_EMAIL, password: TEMP_PASSWORD })
                .expect(200)

            const body = res.body.data ?? res.body
            const secondToken = body.changeToken
            expect(secondToken).not.toBe(firstToken)

            // O primeiro token deve ter sido marcado como usado no banco
            const oldRecord = await prisma.passwordReset.findUnique({
                where: { token: firstToken },
                select: { usedAt: true },
            })
            expect(oldRecord?.usedAt).not.toBeNull()
        })

        it('usar o token antigo agora retorna 401', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/set-first-password')
                .send({ changeToken: firstToken, newPassword: NEW_PASSWORD })
                .expect(401)
        })
    })

    // =========================================================================
    // Cenário 5 — validação do DTO
    // =========================================================================
    describe('validação do DTO', () => {
        it('retorna 400 quando newPassword tem menos de 6 caracteres', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/set-first-password')
                .send({ changeToken: 'qualquer', newPassword: '12345' })
                .expect(400)
        })

        it('retorna 400 quando changeToken está ausente', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/set-first-password')
                .send({ newPassword: NEW_PASSWORD })
                .expect(400)
        })

        it('retorna 400 quando newPassword está ausente', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/set-first-password')
                .send({ changeToken: 'qualquer' })
                .expect(400)
        })
    })
})
