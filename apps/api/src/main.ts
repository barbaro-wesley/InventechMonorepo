import { NestFactory, Reflector } from '@nestjs/core'
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { IoAdapter } from '@nestjs/platform-socket.io'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'

// ── Variáveis obrigatórias em qualquer ambiente ─────────────────────────────
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'REDIS_HOST',
  'REDIS_PASSWORD',
  'MINIO_ENDPOINT',
  'MINIO_ROOT_USER',
  'MINIO_ROOT_PASSWORD',
]

// Variáveis obrigatórias somente em produção
const REQUIRED_PROD_ENV_VARS = [
  'ALLOWED_ORIGINS',
  'MAIL_HOST',
  'MAIL_USER',
  'MAIL_PASSWORD',
]

function validateEnv(logger: Logger): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])

  if (process.env.NODE_ENV === 'production') {
    missing.push(...REQUIRED_PROD_ENV_VARS.filter((key) => !process.env[key]))
  }

  if (missing.length > 0) {
    logger.error(`Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`)
    logger.error('Consulte .env.example para a lista completa de variáveis necessárias.')
    process.exit(1)
  }

  // Bloqueia secrets placeholder em produção
  if (process.env.NODE_ENV === 'production') {
    const placeholders = ['troque_por', 'sua_senha', 'seu_token', 'seu_email']
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'MINIO_ROOT_PASSWORD', 'REDIS_PASSWORD']) {
      const value = process.env[key] ?? ''
      if (placeholders.some((p) => value.includes(p))) {
        logger.error(`Variável ${key} contém um valor placeholder. Defina um segredo real antes de ir para produção.`)
        process.exit(1)
      }
    }
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  // ── Validação de ambiente antes de qualquer coisa ───────────────
  validateEnv(logger)

  const isProd = process.env.NODE_ENV === 'production'

  const app = await NestFactory.create(AppModule, {
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  })

  // ── Helmet ─────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: isProd ? 'same-origin' : 'cross-origin' },
    // CSP habilitado em produção; desabilitado em dev para o Swagger funcionar
    contentSecurityPolicy: isProd ? undefined : false,
  }))

  // ── Cookie parser ───────────────────────────────────────────────
  app.use(cookieParser())

  // ── Prefixo global ──────────────────────────────────────────────
  app.setGlobalPrefix('api/v1')

  // ── CORS ────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',').map((o) => o.trim())

  app.enableCors({
    origin: (origin, callback) => {
      // Requisições sem Origin (curl, health checks, server-to-server) são permitidas
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS bloqueado para origin: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  })

  // ── WebSocket ───────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app))

  // ── Validação global ────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // ── Interceptors globais ────────────────────────────────────────
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  )

  // ── Swagger / OpenAPI (apenas em desenvolvimento) ───────────────
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('Sistema de Gestão de Manutenção')
      .setDescription(
        `API REST do SaaS de gestão de manutenção e equipamentos.\n\n` +
        `## Autenticação\n` +
        `A API usa **JWT via HTTP-Only Cookies**. Faça login em \`POST /auth/login\` ` +
        `e os cookies serão configurados automaticamente.\n\n` +
        `Para testar endpoints protegidos no Swagger, use o botão **Authorize** ` +
        `e informe o Bearer token retornado no login.\n\n` +
        `## Multi-tenant\n` +
        `Todos os dados são isolados por empresa (companyId) e cliente (clientId). ` +
        `O token JWT carrega essas informações automaticamente.`,
      )
      .setVersion('1.0')
      .setContact('Aria Engenharia', '', 'contato@ariaengenharia.com')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Informe o access_token retornado no POST /auth/login',
        },
        'JWT',
      )
      .addCookieAuth('access_token', {
        type: 'apiKey',
        in: 'cookie',
        description: 'Cookie HTTP-Only setado automaticamente no login',
      })
      .addTag('Auth', 'Login, logout, refresh, 2FA, reset de senha')
      .addTag('Users', 'Gestão de usuários e permissões')
      .addTag('Companies', 'Gestão de empresas (SUPER_ADMIN)')
      .addTag('Clients', 'Clientes finais da empresa')
      .addTag('Equipment', 'Equipamentos e ativos')
      .addTag('Locations', 'Localizações e setores')
      .addTag('Cost Centers', 'Centros de custo')
      .addTag('Equipment Types', 'Tipos e subtipos de equipamento')
      .addTag('Movements', 'Movimentação de equipamentos')
      .addTag('Maintenance Groups', 'Grupos de manutenção e vínculos com técnicos')
      .addTag('Service Orders', 'Ordens de serviço e painel')
      .addTag('Maintenance', 'Manutenções e agendamentos de preventiva')
      .addTag('Storage', 'Upload e download de arquivos (MinIO)')
      .addTag('Notifications', 'Notificações do usuário')
      .build()

    const document = SwaggerModule.createDocument(app, config)

    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'API Manutenção — Docs',
      customfavIcon: '',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        syntaxHighlight: { theme: 'monokai' },
        tryItOutEnabled: true,
        docExpansion: 'none',
        tagsSorter: 'alpha',
      },
    })

    logger.log(`📚 Swagger:     http://localhost:${process.env.APP_PORT ?? 3000}/api/docs`)
  }

  // ── Shutdown hooks + handler SIGTERM ────────────────────────────
  app.enableShutdownHooks()

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM recebido — encerrando servidor graciosamente...')
    await app.close()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    logger.log('SIGINT recebido — encerrando servidor graciosamente...')
    await app.close()
    process.exit(0)
  })

  const port = parseInt(process.env.APP_PORT ?? '3000', 10)
  await app.listen(port, '0.0.0.0')

  logger.log(`🚀 API:        http://localhost:${port}/api/v1`)
  logger.log(`🌍 Ambiente:   ${process.env.NODE_ENV ?? 'development'}`)
  logger.log(`🔌 WebSocket:  ws://localhost:${port}/notifications`)
}

bootstrap()
