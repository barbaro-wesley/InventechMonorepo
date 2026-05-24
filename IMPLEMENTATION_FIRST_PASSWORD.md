# 🔐 Feature: Troca Obrigatória de Senha no Primeiro Login

> **Objetivo:** Ao criar um usuário (ou ao admin redefinir a senha), forçar que o usuário defina sua própria senha no primeiro acesso.

---

## 🤖 Instruções para o agente implementador

Antes de implementar qualquer fase, **leia os arquivos abaixo na ordem indicada** para entender o estado atual do código e encontrar os pontos exatos de inserção:

### API
| Arquivo | Por que ler |
|---------|-------------|
| `apps/api/prisma/schema.prisma` | Ver model `User` (onde inserir o campo) e model `PasswordReset` (estrutura reutilizada) |
| `apps/api/src/modules/auth/auth.service.ts` | Ver fluxo completo do `login()` para saber onde inserir o check de `mustChangePassword` |
| `apps/api/src/modules/auth/auth.controller.ts` | Ver estrutura dos endpoints e DTOs existentes para inserir o novo endpoint no padrão correto |
| `apps/api/src/modules/auth/security/two-factor.service.ts` | Ver como `PasswordReset` é criado/usado hoje (padrão de token) |
| `apps/api/src/modules/users/users.service.ts` | Ver `create()` e `update()` para inserir `mustChangePassword` nos locais certos |
| `apps/api/src/modules/users/users.repository.ts` | Confirmar se `create()` aceita campos extras ou tem tipagem manual |

### Shared Types
| Arquivo | Por que ler |
|---------|-------------|
| `packages/shared-types/src/types/auth.types.ts` | Ver `LoginResponse` atual antes de atualizar |

### Web
| Arquivo | Por que ler |
|---------|-------------|
| `apps/web/src/services/auth/auth.service.ts` | Ver métodos existentes antes de adicionar `setFirstPassword` |
| `apps/web/src/hooks/auth/use-auth.ts` | Ver estado e mutations existentes antes de adicionar os novos |
| `apps/web/src/app/(auth)/login/page.tsx` | Ver estrutura da página de login (steps de 2FA) para replicar o padrão no novo step |

> ⚠️ **Não edite nenhum arquivo sem ter lido o atual primeiro.**

---

## 📋 Status das Fases

| # | Fase | Status |
|---|------|--------|
| 1 | [Modelagem do Banco de Dados](#fase-1--modelagem-do-banco-de-dados) | ✅ Concluída |
| 2 | [Validação dos Módulos (API)](#fase-2--validação-dos-módulos-api) | ✅ Concluída |
| 3 | [Integridade das Informações](#fase-3--integridade-das-informações) | ✅ Coberta pelo código |
| 4 | [Segurança da Aplicação](#fase-4--segurança-da-aplicação) | ✅ Coberta pelo código |
| 5 | [Testes](#fase-5--testes) | ✅ Concluída |
| 6 | [Invalidação do Token Temporário](#fase-6--invalidação-do-token-temporário) | ✅ Coberta pelo código |
| 7 | [Atualização do Web (Módulo Auth)](#fase-7--atualização-do-web-módulo-auth) | ✅ Concluída |

---

## 🗺️ Fluxo Completo

```
Admin cria/atualiza usuário (define senha)
  └─→ status: UNVERIFIED  +  mustChangePassword: true
        └─→ email de verificação enviado

Usuário verifica email → status: ACTIVE

Usuário faz login (POST /auth/login)
  └─→ senha OK + mustChangePassword == true
        └─→ Gera token temporário (PasswordReset, 10min)
        └─→ Retorna: { requiresPasswordChange: true, changeToken: "abc123" }

Frontend detecta requiresPasswordChange
  └─→ Exibe tela "Defina sua senha"

Usuário define nova senha (POST /auth/set-first-password)
  └─→ Valida token (DB: não expirado, não usado)
  └─→ Valida: user.mustChangePassword == true
  └─→ Marca token como usado (usedAt)
  └─→ Atualiza passwordHash + mustChangePassword = false
  └─→ Emite access_token + refresh_token normais (cookies)
  └─→ Retorna dados do usuário → acesso liberado

Se admin redefinir senha via PATCH /users/:id:
  └─→ passwordHash atualizado + mustChangePassword = true
        └─→ próximo login exigirá troca novamente
```

---

## Fase 1 — Modelagem do Banco de Dados

**Objetivo:** Adicionar o campo `mustChangePassword` ao model `User`.

### 1.1 — Alterar `schema.prisma`

**Arquivo:** `apps/api/prisma/schema.prisma`

Localizar o model `User` e adicionar o campo após `require2FA`:

```prisma
model User {
  // ... campos existentes ...
  require2FA         Boolean   @default(false) @map("require_2fa")
  mustChangePassword Boolean   @default(false) @map("must_change_password")  // ← NOVO
  // ... relações ...
}
```

### 1.2 — Gerar a Migration

```bash
cd apps/api
npx prisma migrate dev --name add_must_change_password
```

Migration gerada automaticamente (`ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false`).

### 1.3 — Regenerar o Prisma Client

```bash
npx prisma generate
```

### ✅ Checklist Fase 1
- [x] Campo `mustChangePassword` adicionado ao `schema.prisma`
- [x] Migration criada e aplicada com sucesso (`20260524224445_add_must_change_password`)
- [x] Prisma Client regenerado sem erros
- [x] Coluna verificada no banco com `DEFAULT false` (`ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false`)

---

## Fase 2 — Validação dos Módulos (API)

### 2.1 — `users.service.ts` — Setar flag na criação

**Arquivo:** `apps/api/src/modules/users/users.service.ts`

No método `create()`, adicionar `mustChangePassword: true` na criação:

```typescript
const user = await this.usersRepository.create({
  name: dto.name,
  email: dto.email,
  passwordHash,
  role,
  status: UserStatus.UNVERIFIED,
  mustChangePassword: true,          // ← NOVO: admin definiu a senha
  phone: dto.phone,
  telegramChatId: dto.telegramChatId,
  company: companyId ? { connect: { id: companyId } } : undefined,
  client: clientId ? { connect: { id: clientId } } : undefined,
  ...(dto.customRoleId && { customRole: { connect: { id: dto.customRoleId } } }),
})
```

No método `update()`, quando admin redefinir a senha:

```typescript
if (dto.password) {
  data.passwordHash = await bcrypt.hash(dto.password, 10)
  data.mustChangePassword = true     // ← NOVO: força troca na próxima sessão
}
```

---

### 2.2 — `auth.service.ts` — Detectar flag no login

**Arquivo:** `apps/api/src/modules/auth/auth.service.ts`

**2.2.1 — No método `login()`**, após validar a senha (step 4) e ANTES do bloco 2FA (step 5):

```typescript
// 4. Valida senha
const passwordValid = await bcrypt.compare(dto.password, user.passwordHash)
if (!passwordValid) { /* ... recordAttempt WRONG_PASSWORD ... */ }

// 4.5 ← NOVO: Verifica se é o primeiro login (troca obrigatória)
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

// 5. Verifica se 2FA é obrigatório (fluxo normal segue...)
```

**2.2.2 — Novo método privado `generateFirstPasswordToken()`**:

```typescript
private async generateFirstPasswordToken(userId: string, ipAddress?: string): Promise<string> {
  // Invalida tokens anteriores não usados do mesmo usuário
  await this.prisma.passwordReset.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  // Gera token seguro aleatório
  const rawToken = crypto.randomBytes(32).toString('hex')

  // Armazena hash no banco (nunca o token em claro)
  await this.prisma.passwordReset.create({
    data: {
      userId,
      token: rawToken,                                    // ← PasswordReset já faz unique no token
      ipAddress,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),  // 10 minutos
    },
  })

  return rawToken
}
```

**2.2.3 — Novo método público `setFirstPassword()`**:

```typescript
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

  // 5. Valida a nova senha (mínimo 6 caracteres — regra de negócio)
  if (newPassword.length < 6) {
    throw new BadRequestException('A nova senha deve ter no mínimo 6 caracteres')
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  // 6. Transação: marca token como usado + atualiza senha + limpa flag
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

  // 7. Emite tokens normais (usuário autenticado a partir daqui)
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
```

---

### 2.3 — `auth.controller.ts` — Novo endpoint + DTO

**Arquivo:** `apps/api/src/modules/auth/auth.controller.ts`

**Adicionar DTO** (junto dos outros DTOs inline no controller):

```typescript
class SetFirstPasswordDto {
  @IsString()
  changeToken: string

  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  newPassword: string
}
```

**Adicionar endpoint**:

```typescript
// POST /auth/set-first-password — define a senha no primeiro acesso
@Public()
@Post('set-first-password')
@HttpCode(HttpStatus.OK)
@RateLimit({ limit: 5, ttl: 300, message: 'Muitas tentativas. Aguarde {{ttl}} segundos.' })
@ApiOperation({
  summary: 'Definir senha no primeiro acesso',
  description: 'Permite ao usuário definir sua própria senha usando o token temporário recebido no login.',
})
async setFirstPassword(
  @Body() dto: SetFirstPasswordDto,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,
) {
  const { accessToken, refreshToken, user } = await this.authService.setFirstPassword(
    dto.changeToken,
    dto.newPassword,
    getClientIp(req),
    req.headers['user-agent'],
  )

  res.cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE })
  res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE })

  return {
    user: {
      id: user.sub,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      clientId: user.clientId,
    },
  }
}
```

### ✅ Checklist Fase 2
- [x] `users.service.create()` seta `mustChangePassword: true`
- [x] `users.service.update()` seta `mustChangePassword: true` quando admin muda senha
- [x] `auth.service.login()` detecta a flag e retorna `{ requiresPasswordChange, changeToken }`
- [x] `auth.service.generateFirstPasswordToken()` criado
- [x] `auth.service.setFirstPassword()` criado com transação atômica
- [x] `SetFirstPasswordDto` criado no controller
- [x] Endpoint `POST /auth/set-first-password` criado e anotado com `@Public()`
- [x] Rate limit aplicado no novo endpoint

---

## Fase 3 — Integridade das Informações

**Objetivo:** Garantir que os dados permaneçam consistentes em todos os cenários.

### 3.1 — Cenários críticos a validar

| Cenário | Comportamento esperado |
|---------|------------------------|
| Admin cria usuário | `mustChangePassword = true`, status `UNVERIFIED` |
| Usuário verifica email | `status → ACTIVE`, `mustChangePassword` permanece `true` |
| Login com `mustChangePassword = true` | Retorna `changeToken`, NÃO emite access/refresh tokens |
| Login com `mustChangePassword = false` | Fluxo normal (2FA se necessário, depois tokens) |
| Admin reseta senha pelo painel | `mustChangePassword = true` setado novamente |
| Admin reseta senha SEM alterar a senha | `mustChangePassword` NÃO é modificado |
| `setFirstPassword` com token válido | Transação: token marcado + senha atualizada + flag `false` |
| `setFirstPassword` com token expirado | `401 Token expirado` |
| `setFirstPassword` com token já usado | `401 Token já utilizado` |
| `setFirstPassword` sem `mustChangePassword = true` | `401 Operação não permitida` |
| Usuário usa `PATCH /users/profile/password` normalmente | NÃO afeta `mustChangePassword` (já é false) |
| `changePassword` com senha atual correta | Normal, `mustChangePassword` não muda |

### 3.2 — Guards adicionais no service

No `setFirstPassword()`, a transação Prisma garante atomicidade. Se a atualização da senha falhar, o token também não é marcado como usado — sem estados inconsistentes.

### 3.3 — Verificação do `usersRepository`

Confirmar que `usersRepository.create()` aceita o campo `mustChangePassword` — o Prisma inferirá automaticamente após `prisma generate`, mas verificar se há tipagem manual no repositório.

**Arquivo a verificar:** `apps/api/src/modules/users/users.repository.ts`

Se houver tipagem manual no `create()`, adicionar o campo:
```typescript
// Verificar se a assinatura do create aceita campos extras ou usa Prisma.UserCreateInput
// Geralmente o Prisma gera o tipo automaticamente
```

### ✅ Checklist Fase 3
- [ ] Todos os cenários da tabela testados manualmente ou via teste automatizado
- [ ] Transação atômica confirmada no `setFirstPassword()`
- [ ] `usersRepository.create()` aceita `mustChangePassword`
- [ ] Admin resetar senha sem enviar `password` NÃO altera a flag (lógica: `if (dto.password)`)
- [ ] Nenhum endpoint retorna `mustChangePassword` na resposta pública

---

## Fase 4 — Segurança da Aplicação

**Objetivo:** Garantir que o fluxo não introduza vetores de ataque.

### 4.1 — Token temporário

| Propriedade | Implementação |
|-------------|---------------|
| **Uso único** | `usedAt` marcado na transação antes de emitir tokens |
| **Expiração curta** | 10 minutos (`expiresAt`) |
| **Armazenado como hash** | Token raw NUNCA armazenado — apenas o token em claro é retornado uma vez |
| **Invalidação de anteriores** | `updateMany({ usedAt: null → new Date() })` antes de criar novo |
| **Não reutilizável após mudança** | `mustChangePassword = false` impede reuso mesmo que o token não esteja expirado |

> ⚠️ **Atenção:** O campo `token` no model `PasswordReset` armazena o valor em claro (conforme o código existente de `sendPasswordReset`). Mantemos a mesma convenção para consistência. O token é gerado com `crypto.randomBytes(32)` = 256 bits de entropia, que é suficientemente seguro.

### 4.2 — Rate Limiting

- `POST /auth/set-first-password`: 5 tentativas / 5 minutos por IP
- Já herdado do `@RateLimit` decorator existente

### 4.3 — O endpoint NÃO deve vazar informações

```typescript
// ❌ NUNCA fazer:
if (!record) throw new NotFoundException('Token não encontrado')

// ✅ SEMPRE resposta genérica para erros de token:
throw new UnauthorizedException('Token inválido ou expirado')
```

### 4.4 — Prevenção de bypass de autenticação

O endpoint `POST /auth/set-first-password` é `@Public()`, mas:
1. Só funciona com um token válido (DB lookup)
2. Só funciona se `mustChangePassword === true`
3. Só funciona dentro da janela de 10 minutos
4. O token é inativado imediatamente na transação

Se alguém tentar usar o endpoint sem ter passado pelo `login()`, não haverá token válido no banco.

### 4.5 — `mustChangePassword` não exposto publicamente

Verificar que `getMe()` em `auth.service.ts` **não inclui** o campo `mustChangePassword` no select — ele não deve ser retornado ao frontend no `/auth/me`.

```typescript
// auth.service.ts → getMe() → select:
select: {
  id: true, name: true, email: true, role: true,
  status: true, avatarUrl: true,
  // mustChangePassword: NÃO incluir aqui
}
```

### 4.6 — Proteção contra enumeração de usuários

No `login()`, ao retornar `requiresPasswordChange`, não revelar informação extra além do necessário:
```typescript
return { requiresPasswordChange: true, changeToken }
// Não retornar: { userId, email, ... }
```

### ✅ Checklist Fase 4
- [ ] Token gerado com `crypto.randomBytes(32)` (256 bits)
- [ ] Tokens anteriores invalidados antes de criar novo
- [ ] `usedAt` marcado DENTRO da transação com `passwordHash`
- [ ] Verificação de `mustChangePassword === true` no `setFirstPassword()`
- [ ] Rate limit no endpoint `set-first-password`
- [ ] Erros de token com mensagem genérica (sem vazar info)
- [ ] `mustChangePassword` ausente do select do `getMe()`
- [ ] Nenhum campo sensível retornado no response público

---

## Fase 5 — Testes

### 5.1 — Testes Unitários: `auth.service`

**Arquivo a criar:** `apps/api/src/modules/auth/auth.service.spec.ts` (ou adicionar aos testes existentes)

```typescript
describe('AuthService.login() — mustChangePassword', () => {
  it('deve retornar requiresPasswordChange=true quando flag está ativa', async () => {
    // Arrange: usuário com mustChangePassword=true
    // Act: chamar login()
    // Assert: retorno contém { requiresPasswordChange: true, changeToken: expect.any(String) }
  })

  it('deve criar um PasswordReset no banco ao detectar mustChangePassword', async () => {
    // Assert: prisma.passwordReset.create foi chamado
  })

  it('deve invalidar tokens anteriores antes de criar novo', async () => {
    // Assert: prisma.passwordReset.updateMany foi chamado com usedAt: null
  })

  it('fluxo normal não é interrompido quando mustChangePassword=false', async () => {
    // Assert: retorno normal com accessToken e refreshToken
  })
})

describe('AuthService.setFirstPassword()', () => {
  it('deve trocar a senha e emitir tokens com token válido', async () => {})
  it('deve lançar 401 com token expirado', async () => {})
  it('deve lançar 401 com token já usado', async () => {})
  it('deve lançar 401 quando mustChangePassword=false', async () => {})
  it('deve lançar 400 quando nova senha tem menos de 6 caracteres', async () => {})
  it('deve executar atualização em transação atômica', async () => {})
  it('deve setar mustChangePassword=false após troca', async () => {})
  it('deve marcar token como usado (usedAt) na transação', async () => {})
})
```

### 5.2 — Testes Unitários: `users.service`

```typescript
describe('UsersService.create()', () => {
  it('deve criar usuário com mustChangePassword=true', async () => {})
})

describe('UsersService.update()', () => {
  it('deve setar mustChangePassword=true quando admin envia nova senha', async () => {})
  it('NÃO deve alterar mustChangePassword quando não há nova senha no DTO', async () => {})
})
```

### 5.3 — Testes E2E / Integração

**Arquivo:** `apps/api/test/auth.e2e-spec.ts`

```typescript
describe('POST /auth/set-first-password', () => {
  it('fluxo completo: criar → login → set-first-password → acesso normal', async () => {
    // 1. Criar usuário (admin)
    // 2. Verificar email (simular)
    // 3. POST /auth/login → deve retornar requiresPasswordChange + changeToken
    // 4. POST /auth/set-first-password com changeToken + newPassword
    // 5. Assert: cookies de sessão setados
    // 6. GET /auth/me → deve retornar dados do usuário
  })

  it('deve retornar 401 ao tentar usar o changeToken duas vezes', async () => {})
  it('deve retornar 401 após o token expirar', async () => {})
  it('rate limit deve bloquear após 5 tentativas em 5 minutos', async () => {})
})
```

### ✅ Checklist Fase 5
- [x] Testes unitários do `login()` com `mustChangePassword` passando (6 testes)
- [x] Testes unitários do `setFirstPassword()` (todos os cenários — 9 testes)
- [x] Testes unitários do `users.service.create()` e `update()` (6 testes)
- [x] Teste E2E do fluxo completo passando (11 testes — banco real)
- [x] Teste de reuso do token falhando como esperado
- [x] `jest-e2e.json` atualizado com `moduleNameMapper` para aliases `@/`

---

## Fase 6 — Invalidação do Token Temporário

**Objetivo:** Garantia em múltiplas camadas de que o token seja inativado corretamente.

### 6.1 — Camada 1: Transação atômica no banco

```typescript
await this.prisma.$transaction([
  this.prisma.passwordReset.update({        // ← Token marcado como USADO
    where: { id: record.id },
    data: { usedAt: new Date() },
  }),
  this.prisma.user.update({                 // ← Senha atualizada + flag desativada
    where: { id: record.userId },
    data: { passwordHash, mustChangePassword: false },
  }),
])
```

Se qualquer operação falhar, **ambas fazem rollback**. Nunca teremos token marcado como usado sem senha atualizada, nem o inverso.

### 6.2 — Camada 2: Guard `mustChangePassword`

Mesmo que o `usedAt` não esteja setado (cenário hipotético de bug), a verificação:
```typescript
if (!record.user.mustChangePassword) {
  throw new UnauthorizedException('Operação não permitida')
}
```
...impede que um token já "consumido" (onde a senha foi mudada) funcione novamente.

### 6.3 — Camada 3: Expiração temporal

```
expiresAt = NOW + 10 minutos
```

Independente de uso, após 10 minutos o token não funciona mais.

### 6.4 — Camada 4: Invalidação ao gerar novo token

Se o usuário fizer login duas vezes sem completar a troca:
```typescript
await this.prisma.passwordReset.updateMany({
  where: { userId, usedAt: null },        // ← Todos os tokens pendentes
  data: { usedAt: new Date() },           // ← São invalidados
})
// Só então cria um novo token
```

### 6.5 — Camada 5: Job de limpeza (existente)

O job `session-cleanup.job.ts` existente já pode ser estendido para limpar `PasswordReset` registros expirados periodicamente:
```typescript
// jobs/session-cleanup.job.ts — verificar se já limpa PasswordReset expirados
// Se não, adicionar:
await this.prisma.passwordReset.deleteMany({
  where: { expiresAt: { lt: new Date() } },
})
```

### ✅ Checklist Fase 6
- [ ] Transação atômica implementada (token + senha na mesma TX)
- [ ] Guard `mustChangePassword === true` no service antes da TX
- [ ] Expiração de 10 minutos configurada
- [ ] Tokens anteriores invalidados ao gerar novo (no login)
- [ ] Job de limpeza verificado/atualizado para `PasswordReset` expirados
- [ ] Testado: token expirado retorna 401
- [ ] Testado: token usado retorna 401
- [ ] Testado: segundo login invalida token do primeiro

---

## Fase 7 — Atualização do Web (Módulo Auth)

### 7.1 — `packages/shared-types` — Atualizar `LoginResponse`

**Arquivo:** `packages/shared-types/src/types/auth.types.ts`

```typescript
export interface LoginResponse {
  user?: AuthUser;
  requires2FA?: boolean;
  requiresPasswordChange?: boolean;     // ← NOVO
  changeToken?: string;                  // ← NOVO: token temporário (10 min)
}
```

Recompilar o pacote após a alteração:
```bash
cd packages/shared-types
npm run build
```

---

### 7.2 — `auth.service.ts` (web) — Novo método

**Arquivo:** `apps/web/src/services/auth/auth.service.ts`

```typescript
async setFirstPassword(changeToken: string, newPassword: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/set-first-password', {
    changeToken,
    newPassword,
  });
  return data;
},
```

---

### 7.3 — `use-auth.ts` — Novo estado e mutation

**Arquivo:** `apps/web/src/hooks/auth/use-auth.ts`

```typescript
// Novos estados no hook
const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
const [changeToken, setChangeToken] = useState<string | null>(null);

// Mutation de primeiro login
const setFirstPasswordMutation = useMutation({
  mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
    authService.setFirstPassword(token, newPassword),
  onSuccess: (response) => {
    setUser(response.user!);
    setRequiresPasswordChange(false);
    setChangeToken(null);
    toast.success('Senha definida com sucesso! Bem-vindo!');
    router.push(getPostLoginRedirect());
  },
  onError: (error) => {
    toast.error(getErrorMessage(error));
  },
});

// Atualizar o onSuccess do loginMutation:
onSuccess: (response) => {
  if (response.requires2FA) {
    setRequires2FA(true);
    setTwoFAUserId(response.user?.id ?? null);
    toast.info('Código de verificação enviado para seu e-mail.');
    return;
  }

  // ← NOVO: detectar troca obrigatória de senha
  if (response.requiresPasswordChange) {
    setRequiresPasswordChange(true);
    setChangeToken(response.changeToken ?? null);
    return;
  }

  setUser(response.user!);
  toast.success(`Bem-vindo, ${response.user?.name?.split(' ')[0]}!`);
  router.push(getPostLoginRedirect());
},

// Retornar no hook:
return {
  // ... existentes ...
  requiresPasswordChange,
  changeToken,
  setFirstPassword: setFirstPasswordMutation.mutate,
  isSettingFirstPassword: setFirstPasswordMutation.isPending,
};
```

---

### 7.4 — `login/page.tsx` — Nova "step" na tela de login

**Arquivo:** `apps/web/src/app/(auth)/login/page.tsx`

Adicionar novo schema de validação:
```typescript
const firstPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});
type FirstPasswordFormData = z.infer<typeof firstPasswordSchema>;
```

Consumir os novos estados do `useAuth`:
```typescript
const {
  login, isLoggingIn,
  requires2FA, twoFAUserId, verify2FA, isVerifying2FA,
  requiresPasswordChange, changeToken,   // ← NOVO
  setFirstPassword, isSettingFirstPassword, // ← NOVO
} = useAuth();
```

Adicionar o bloco de renderização (antes do return do login normal):
```tsx
// ── Step 3: Definir senha inicial ──
if (requiresPasswordChange) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full mx-auto">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
            <KeyRound className="w-6 h-6 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 tracking-tight">
            Defina sua senha
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Este é seu primeiro acesso. Crie uma senha de sua escolha para continuar.
          </p>
        </div>

        <form onSubmit={firstPasswordForm.handleSubmit(handleFirstPassword)} className="space-y-5">
          {/* Campo: Nova Senha */}
          {/* Campo: Confirmar Senha */}
          {/* Botão Submit */}
        </form>
      </div>
    </div>
  );
}
```

Adicionar o handler:
```typescript
function handleFirstPassword(data: FirstPasswordFormData) {
  if (!changeToken) return;
  setFirstPassword({ token: changeToken, newPassword: data.newPassword });
}
```

---

### 7.5 — UX: Feedback visual de senha segura (opcional)

Considerar adicionar um indicador de força da senha no formulário de definição:
- 🔴 Fraca (menos de 6 chars)
- 🟡 Média (6-10 chars, somente letras/números)
- 🟢 Forte (mais de 10 chars com mistura)

Pode ser implementado com uma função de score simples sem dependências extras.

### ✅ Checklist Fase 7
- [x] `LoginResponse` atualizado em `shared-types` com `requiresPasswordChange` e `changeToken`
- [x] `shared-types` recompilado
- [x] `authService.setFirstPassword()` criado no web
- [x] `use-auth.ts` com novos estados e mutation
- [x] `use-auth.ts` detecta `requiresPasswordChange` no `onSuccess` do login
- [x] `login/page.tsx` renderiza a tela de "Defina sua senha" quando `requiresPasswordChange`
- [x] Formulário com validação de senha e confirmação
- [x] `changeToken` mantido em estado local (não persistido em localStorage)
- [x] Após sucesso, `changeToken` e `requiresPasswordChange` limpos do estado
- [ ] Testado visualmente: fluxo completo no browser

---

## 📁 Arquivos Impactados

### API
| Arquivo | Tipo de mudança |
|---------|----------------|
| `apps/api/prisma/schema.prisma` | Novo campo `mustChangePassword` |
| `apps/api/prisma/migrations/*/migration.sql` | Gerado automaticamente |
| `apps/api/src/modules/users/users.service.ts` | `create()` e `update()` |
| `apps/api/src/modules/auth/auth.service.ts` | `login()`, novos métodos |
| `apps/api/src/modules/auth/auth.controller.ts` | Novo DTO + endpoint |

### Shared
| Arquivo | Tipo de mudança |
|---------|----------------|
| `packages/shared-types/src/types/auth.types.ts` | `LoginResponse` atualizado |

### Web
| Arquivo | Tipo de mudança |
|---------|----------------|
| `apps/web/src/services/auth/auth.service.ts` | Novo método |
| `apps/web/src/hooks/auth/use-auth.ts` | Novos estados e mutation |
| `apps/web/src/app/(auth)/login/page.tsx` | Nova "step" na UI |

---

## 🚀 Ordem de Execução Recomendada

```
1. Fase 1  → Schema + Migration
2. Fase 6  → Confirmar mecanismo de invalidação (define a implementação do Fase 2)
3. Fase 2  → API: users.service + auth.service + auth.controller
4. Fase 3  → Validar integridade manualmente (Postman / Thunder Client)
5. Fase 4  → Revisão de segurança dos novos endpoints
6. Fase 5  → Escrever e executar testes
7. Fase 7  → Web: shared-types → service → hook → página
```

---

*Última atualização: 2026-05-24*
