# SLA por Tipo de Manutenção e TPA — Implementação e Decisões

Documento de contexto para retomar o assunto em outra sessão. Registra o problema
original, o diagnóstico, o que foi implementado, e — principalmente — **as decisões
de negócio tomadas e as alternativas descartadas**, que não são dedutíveis do código.

- **Data:** 2026-07-29
- **Branch:** `develop`
- **Status:** implementado e validado; **migrations aplicadas no banco de dev local**; **nada commitado**

---

## 1. Estado atual (TL;DR)

| Item | Situação |
|---|---|
| Código | Pronto, typecheck limpo em `apps/api` e `apps/web` |
| Migrations | 3 criadas, todas **aplicadas no banco de dev local** e verificadas |
| Commit | **Nada commitado.** 15 arquivos modificados + 5 novos |
| Produção | **Não afetada.** Nenhuma das 3 migrations foi para `main` |
| TPA | Ativo no código, mas **desligado na prática** — todas as 28 células com TPA nulo |

`.claude/settings.json` aparece modificado no `git status`, mas **não faz parte deste trabalho**
(alteração de allowlist de permissões durante a sessão). Deixar de fora do commit.

---

## 2. O problema original

Relato: *"na aba de config passei o prazo de 72h e contou como 720h"*, numa OS de
**aceitação inicial**.

Diagnóstico — não era bug de cálculo. Duas causas somadas:

1. **`INITIAL_ACCEPTANCE` estava agrupada com preventiva.** O PR #47 (de 2026-07-29)
   criou `PREVENTIVE_LIKE_TYPES = [PREVENTIVE, INITIAL_ACCEPTANCE]`, então aceitação
   inicial usava `preventiveSlaDays` (30 dias) e **ignorava** o prazo por prioridade
   das corretivas. Os 72h configurados nunca foram lidos por ela.
2. **A UI exibia horas cruas.** 30 dias = 720 horas, renderizado literalmente como
   `720h` em `sla-badge.tsx` e `os-utils.ts`. Nada convertia para dias.

Agravante: a aba de configuração não indicava em lugar nenhum que aceitação inicial
caía no balde das preventivas.

---

## 3. O que foi implementado

### 3.1 Modelo: SLA por tipo × prioridade

Nova tabela `CompanyMaintenanceTypeSla` — `(companyId, maintenanceType, priority)` único.

- **Prazos sempre armazenados em HORAS.** Unidade única foi decisão deliberada: a
  ambiguidade dias/horas foi exatamente o que causou o problema original. A conversão
  para dias é só apresentação.
- Cobre os 7 tipos não-corretivos. **Corretiva continua em `CompanySlaConfig`** (por
  prioridade), que já existia.
- 7 tipos × 4 prioridades = 28 células por empresa. No banco de dev: **56 linhas** (2 empresas).

Defaults de conclusão (iguais nas 4 prioridades, para que ligar a dimensão de
prioridade não mudasse nenhum prazo vigente):

| Tipo | Padrão |
|---|---|
| `PREVENTIVE` | 720h (30d) |
| `INITIAL_ACCEPTANCE` | 72h (3d) |
| `EXTERNAL_SERVICE` | 168h (7d) |
| `TECHNOVIGILANCE` | 72h (3d) |
| `TRAINING` | 720h (30d) |
| `IMPROPER_USE` | 72h (3d) |
| `DEACTIVATION` | 168h (7d) |

`company.preventiveSlaDays` foi marcado `@deprecated` no schema — **mantido**, serve
só como origem do seed da primeira migration. Não é mais lido em runtime.

### 3.2 Resolução dos prazos

`SlaService.resolveSlaDates(companyId, maintenanceType, priority, createdAt)`:

- `CORRECTIVE` → `CompanySlaConfig` (prazo por prioridade)
- demais tipos → matriz `CompanyMaintenanceTypeSla`

A checagem (`followsPrioritySla`) é **positiva** sobre a tabela de tipos configuráveis:
qualquer tipo novo que ainda não tenha prazo próprio cai em `CompanySlaConfig` em vez
de herdar silenciosamente os 30 dias das preventivas. Foi esse herdar silencioso que
causou o problema original.

### 3.3 TPA (tempo de primeiro atendimento)

Novo campo `ServiceOrder.slaResponseBreachedAt`.

**Problema que ele resolve:** antes, o estouro de TPA existia só como `slaStatus = BREACHED`,
e o job de reclassificação **revertia para `ON_TIME`** assim que a OS era iniciada —
a violação desaparecia do histórico. Inútil para auditoria.

Agora:

- `stampResponseBreaches()` grava o momento do estouro, **só onde ainda está nulo**.
  Nunca é reescrito nem limpo.
- `refreshSlaStatuses()` passou a ler `sla_response_breached_at IS NOT NULL` em vez de
  `started_at IS NULL` → a OS **permanece `BREACHED`** depois de atendida com atraso.
- O job (a cada 30 min) chama os dois **nessa ordem** — a reclassificação depende do campo.
- Redundância no início tardio: os dois caminhos que entram em `IN_PROGRESS` (mudança
  de status e técnico assumindo do painel) também gravam o estouro, cobrindo a janela
  de 30 min em que o job ainda não rodou.

### 3.4 Apresentação

`apps/web/src/lib/sla.ts` (novo):

| Função | Uso |
|---|---|
| `formatDurationHours(h)` | `720 → "30d"`, `72 → "3d"`, `26 → "1d 2h"` |
| `formatDurationMs(ms)` | idem a partir de diferença em ms |
| `formatDurationDetailed(ms)` | granularidade adaptativa: `"29d 23h"`, `"3h 20min"`, `"45min"` |
| `naturalUnit / toUnit / toHours` | conversão dos campos de configuração |

Correções aplicadas:

- `sla-badge.tsx` e `os-utils.ts` → `720h` virou `30d`; `719h 30min restantes` virou `29d 23h restantes`
- Novo estado no badge: **`SLA Cumprido · TPA Estourado`** (âmbar). Sem ele a métrica
  separada não teria como ser lida na interface.
- `os-summary-tab.tsx`: linha dedicada de TPA (`✓ 1º atendimento: cumprido em 2h 15min`)
- Corrigido o rótulo *"Prazo prioridade (Média)"*, que aparecia em OS não-corretivas
  afirmando que o prazo vinha da prioridade quando não vinha. Era parte do que levou
  a suspeitar do backend.
- Aba de config: card virou **"SLA por Tipo de Manutenção e Prioridade"** — 7 seções
  colapsáveis (feitas à mão, não há accordion no projeto), cada uma com 4 linhas de
  prioridade, TPA + Conclusão e seletor Horas/Dias.

### 3.5 API

| Endpoint | Situação |
|---|---|
| `GET/PUT /sla-configs` | inalterado (corretivas por prioridade) |
| `GET/PUT /sla-configs/maintenance-types` | **novo** — matriz completa |
| `GET/PUT /sla-configs/preventive` | **deprecated**, mantido por compatibilidade |

O endpoint `/preventive` delega para a linha `PREVENTIVE` da matriz. O `GET` lê `MEDIUM`
(prioridade com que as preventivas são geradas); o `PUT` grava nas **quatro** prioridades,
preservando a semântica antiga de "um prazo único de preventiva".

`PUT /sla-configs/maintenance-types` rejeita `CORRECTIVE` com `BadRequestException`.

### 3.6 Analytics

Em `analytics-os.service.ts`, bloco `sla` ganhou:

- `tpaApplicable`, `tpaBreached`, `tpaComplianceRate`
- `resolutionJudged`, `resolutionComplianceRate`

O denominador do TPA conta **só OS com prazo de TPA definido** — senão os tipos sem TPA
diluiriam o percentual. Ambas as taxas retornam `null` quando não há base, em vez de
exibir "100%" a partir de zero OS avaliáveis.

---

## 4. Decisões de negócio (o mais importante deste documento)

### 4.1 SLA por tipo → matriz tipo × prioridade

**Decidido:** granularidade completa, igual às corretivas.

Descartado: um TPA único por tipo (sem dimensão de prioridade). Era mais barato — o
modelo já tinha `maxResponseHours`, faltava só expor na UI.

⚠️ **Consequência conhecida:** para `PREVENTIVE` a matriz é praticamente letra morta.
A geração automática passa `'MEDIUM'` **fixo** em `maintenance.service.ts`, então as
linhas `URGENT`/`HIGH`/`LOW` de preventiva nunca serão consultadas. Se algum dia a
prioridade do agendamento virar configurável, é lá que mora o literal.

### 4.2 Estouro de TPA: métrica separada

**Decidido:** TPA e conclusão são **indicadores independentes**.

- `slaStatus` = `COMPLETED_ON_TIME`/`COMPLETED_LATE` decidido **só pela conclusão**
- o estouro de TPA vive em `slaResponseBreachedAt`, à parte
- relatório mostra `tpaComplianceRate` e `resolutionComplianceRate` separados

Descartado: fazer o estouro de TPA reprovar o SLA da OS (veredito único). Perderia a
distinção de qual dos dois prazos falhou.

### 4.3 TPA padrão nulo — **não é esquecimento**

Todas as 28 células nascem com TPA nulo, deliberadamente.

`refreshSlaStatuses` marca `BREACHED` quando `startedAt` é nulo e o TPA venceu. Semear
um TPA classificaria **de imediato como atrasada toda OS aberta e não iniciada** —
inclusive preventivas de 30 dias recém-abertas. O TPA é **opt-in** por par
(tipo, prioridade). Campo vazio na UI = sem prazo de primeiro atendimento.

### 4.4 O que conta como "primeiro atendimento"

**Decidido:** o TPA fecha na entrada em `IN_PROGRESS` — **início efetivo do trabalho**
(`startedAt`). Mantido o comportamento que já existia.

Marcos disponíveis no modelo e por que os outros foram descartados:

| Marco | Campo | Veredito |
|---|---|---|
| Técnico vinculado | `serviceOrderTechnician.assignedAt` | ❌ Quem atribui é o gestor, sem ação do técnico. Bastaria atribuir tudo na abertura para o indicador ficar sempre perfeito. |
| Técnico aceitou | `assumedAt` | ❌ Só é gravado no fluxo de auto-atribuição (técnico pega do painel), onde **já é simultâneo** ao `startedAt`. Na atribuição feita pelo gestor fica **nulo**. |
| Primeira interação | 1º `ServiceOrderComment` | ❌ Definição composta, difícil de defender em auditoria. |
| **Trabalho iniciado** | `startedAt` | ✅ **Escolhido.** Prova real de que alguém trabalhou na OS. |

⚠️ **Consequência aceita:** deslocamento e agendamento contam dentro do TPA. Um técnico
que triou em 10 min mas só chegou ao equipamento 6h depois registra TPA de 6h.
**Ao preencher a matriz, não usar valores de helpdesk (1–4h) para OS que exigem ir até
o equipamento.**

Efeito colateral descoberto: **`assumedAt` é hoje um campo praticamente morto.** Se algum
dia o aceite do técnico virar o marco de TPA (a opção mais correta em termos de SLA),
o trabalho começa por popular esse campo no fluxo de atribuição e criar uma ação real
de "aceitar OS".

Essa decisão está documentada em comentário no próprio `sla.service.ts`.

### 4.5 OS existentes não foram recalculadas

`slaResolutionDueDate` é congelado na criação da OS. Mudar a configuração **não**
recalcula OS já abertas — decisão explícita ("estamos em teste"). Só OS novas usam as
regras novas.

---

## 5. Migrations

| Migration | O que faz |
|---|---|
| `20260729210000_add_maintenance_type_sla_configs` | Cria a tabela; seed preserva `preventive_sla_days × 24` para `PREVENTIVE` e aplica os defaults dos outros 6 tipos |
| `20260729220000_add_priority_to_maintenance_type_sla` | Adiciona `priority`; backfill das linhas existentes como `MEDIUM` e replica para as outras 3 mantendo os prazos; troca a chave única |
| `20260729230000_add_sla_response_breached_at` | Adiciona o campo em `service_orders` + índice; backfill de OS que comprovadamente estouraram o TPA |

### ⚠️ Regra do banco de dev — nunca rodar `migrate dev`

O banco de dev local tem **drift conhecido**: a migration `20260715120000_add_calibration_module`
está registrada em `_prisma_migrations` e a tabela `calibration_records` existe, mas a
pasta da migration **não existe** na `develop` nem na `main`.

Causa rastreada: vive no commit `15efa70`, da branch `claude/asset-management-features-thps8a`,
**nunca mergeada**. O banco foi migrado enquanto estava nessa branch. **Não é corrupção** —
é migration de branch aplicada num banco de dev compartilhado. Produção está limpa.

- ✅ **`npx prisma migrate deploy`** — seguro. Aplica só o que está pendente, **não** faz
  detecção de drift nem reset, e ignora o registro órfão. Foi como as 3 migrations acima
  foram aplicadas.
- ❌ **`npx prisma migrate dev` / `migrate reset`** — vê a tabela órfã como drift e pede
  reset, que **apaga todos os dados**.
- Escrever o SQL à mão em `prisma/migrations/<timestamp>_<nome>/migration.sql`, estilo
  Prisma padrão, aditivo e com `IF NOT EXISTS`.
- **Validar sem persistir:** rodar a migration num `BEGIN … ROLLBACK` via `pg` (DDL é
  transacional no Postgres) confirma sintaxe, seed e idempotência com risco zero. As 3
  migrations passaram por isso antes de serem aplicadas.
- Um índice parcial (`WHERE ... IS NOT NULL`) seria melhor para as consultas de auditoria
  de TPA, mas o Prisma não consegue expressá-lo no schema — geraria mais drift. Ficou
  índice simples de propósito.

### Fila de produção

`main` está **duas migrations atrás** da `develop` no que toca a SLA:

1. `20260729190000_add_preventive_sla_days` (do PR #47, já na `develop`)
2. as 3 deste trabalho (ainda não commitadas)

A ordem funciona por construção: a migration `210000` lê `companies.preventive_sla_days`
no seed, e a `190000` que cria a coluna tem timestamp anterior. O `deploy` aplica na
ordem certa.

---

## 6. Mapa de arquivos

### Novos (5)

```
apps/api/prisma/migrations/20260729210000_add_maintenance_type_sla_configs/migration.sql
apps/api/prisma/migrations/20260729220000_add_priority_to_maintenance_type_sla/migration.sql
apps/api/prisma/migrations/20260729230000_add_sla_response_breached_at/migration.sql
apps/api/src/modules/sla/dto/update-maintenance-type-sla.dto.ts
apps/web/src/lib/sla.ts
```

### Modificados (15)

```
apps/api/prisma/schema.prisma                                    modelo + campo + índice
apps/api/src/prisma/prisma.service.ts                            getter do novo model
apps/api/src/modules/sla/sla.service.ts                           núcleo: matriz, TPA, job
apps/api/src/modules/sla/sla.controller.ts                        endpoints por tipo
apps/api/src/modules/sla/jobs/sla-breach.job.ts                   ordem das duas etapas
apps/api/src/modules/service-orders/service-orders.service.ts     estouro no início tardio
apps/api/src/modules/analytics/services/analytics-os.service.ts   métricas separadas

apps/web/src/app/(dashboard)/configuracoes/sla-tab.tsx            UI da matriz
apps/web/src/app/(operacional)/operacional/_components/os-utils.ts            getTpaInfo + formatação
apps/web/src/app/(operacional)/operacional/_components/workspace/os-summary-tab.tsx  linha de TPA
apps/web/src/app/(operacional)/operacional/_components/os-card.tsx            passa o campo
apps/web/src/app/(operacional)/operacional/_components/os-list.tsx            passa o campo
apps/web/src/components/service-orders/sla-badge.tsx              estado TPA estourado
apps/web/src/services/sla/sla.service.ts                          client da matriz
apps/web/src/services/service-orders/service-orders.types.ts      novo campo
```

⚠️ O `PrismaService` expõe **cada model por getter explícito**. Adicionar model ao schema
sem adicionar o getter causa `Property 'x' does not exist on type 'PrismaService'`.

⚠️ `apps/web/AGENTS.md` avisa que a versão do Next (16.2.1) tem breaking changes e manda
consultar `node_modules/next/dist/docs/` antes de escrever código. As mudanças deste
trabalho ficaram em client components já existentes e utils puros — fora da superfície
que quebrou (rotas, server components, `Image`/`Link`).

---

## 7. Pendências e itens em aberto

### Deste trabalho

- [ ] **Commitar.** Nada foi commitado. Sugestão: branch a partir da `develop`, sem `.claude/settings.json`.
- [ ] **Testar na UI.** Nenhuma das telas foi aberta em navegador; a validação foi typecheck + verificação no banco.
- [ ] **TPA nos relatórios exportáveis.** `reports.service.ts` (PDF/Excel) **não** foi tocado — superfície grande, várias funções de coluna e label. A métrica está só na API de analytics.
- [ ] **TPA na UI de configuração já existe**, mas nenhuma célula está preenchida. Ligar tipo por tipo conforme calibração.
- [ ] Não existe conceito de "TPA próximo do vencimento" — `NEAR_BREACH` olha só os 20% finais da janela de conclusão.

### Problemas pré-existentes encontrados (não corrigidos)

- ⚠️ **Inconsistência entre PR #46 e PR #47** (mergeados com 50 min de diferença em 2026-07-29).
  `service-orders.service.ts:~1272` coloca o equipamento em `UNDER_MAINTENANCE` quando uma
  preventiva entra em `IN_PROGRESS`, mas a liberação em `~1334` conta só `BLOCKING_MAINTENANCE_TYPES`,
  que **exclui** preventiva. Resultado: com duas preventivas em andamento no mesmo equipamento,
  aprovar uma libera o equipamento enquanto a outra segue em atendimento.
- ⚠️ **Branch `claude/asset-management-features-thps8a` abandonada** com a migration de calibração.
  Se o módulo morreu, vale deletar a branch do remoto para ninguém mergeá-la por engano. Limpar
  o registro órfão + dropar `calibration_records` destravaria o `migrate dev`, mas é destrutivo.

---

## 8. Dados do banco de dev (2026-07-29)

Úteis para calibrar expectativas:

- **665** OS no total; **166** sem início
- **Apenas 2** OS têm `slaResponseDueDate` — as corretivas criadas desde que o SLA entrou.
  Nenhuma estourou o TPA; o backfill da migration marcou **0**.
- **56** linhas na matriz de SLA (2 empresas: `HOSPITAL CRISTO REDENTOR` e `cliente`)
- PostgreSQL **16** (`gen_random_uuid()` nativo, usado nas migrations)

Ou seja: ligar o TPA **não** reclassificou nada retroativamente.

---

## 9. Como validar

```bash
# Typecheck (ambos devem sair silenciosos)
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json

# Prisma
cd apps/api && npx prisma validate && npx prisma generate

# Migrations pendentes (NUNCA migrate dev)
cd apps/api && npx prisma migrate deploy
```
