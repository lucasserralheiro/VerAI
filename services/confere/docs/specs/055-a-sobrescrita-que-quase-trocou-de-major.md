# ESPEC 055 — A sobrescrita que quase trocou de major

| | |
|---|---|
| **Status** | **Implementada localmente** — 2026-09-14. `pnpm audit`: **7 → 0** achados. `pnpm lint` e `pnpm build` limpos. Ainda não commitada nem publicada |
| **Versão** | 1.0 — 2026-09-14 |
| **Depende de** | ESPEC 048 §2.3, que identificou estes mesmos 7 achados (`postcss` ×4, `sharp`, `nanoid`, `js-yaml`) e os deferiu de propósito via `D-03`/`I-01` |
| **Revisa** | ESPEC 048 `D-03` ("Não mexe em `postcss`/`sharp`/`nanoid`/`js-yaml` nesta entrega") e `I-01` ("Vale abrir uma decisão separada para sobrescrever `postcss` via `pnpm.overrides`?") — esta espec responde sim a `I-01` e fecha o restante de `D-03` |
| **Não toca** | A versão de `next`/`eslint-config-next` (fixada pela ESPEC 048, não muda aqui), migração de major de qualquer pacote, `I-03` da ESPEC 048 (gate de auditoria de `pnpm-lock.yaml` no pre-commit, segue em aberto), a pendência de autenticação/rede da hospedagem |
| **Referência normativa** | `pnpm audit` rodado em `frontend/` nesta revisão; GHSA-6g55-p6wh-862q e GHSA-fxqj-rqcc-2cmp (`postcss`), GHSA-rgj7-g3m4-5g8c (`sharp`), GHSA-2v37-7h3g-55p8 (`nanoid`), release notes do `js-yaml@4.3.2`; ESPEC 048 §2.3, §6 `D-03`, §10 `I-01`; `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/Dockerfile` |
| **Origem** | Varredura automática do Dependabot em `prodam-gda/confere`: 7 alertas altos (`postcss` ×4, `sharp`, `nanoid`, `js-yaml`) — o mesmo total que a ESPEC 048 já apurara e deferira |

---

## 1. Problema

**Os 7 achados altos que a ESPEC 048 deferiu de propósito (`D-03`/`I-01`) continuam abertos, e nenhuma correção upstream chegou nesse meio-tempo.**

`next@15.5.25` — hoje a versão mais recente da série 15.5.x (confirmado via `npm view next versions`) — continua fixando `postcss@8.4.31` **exato** dentro do seu próprio `package.json`. Não há, e não há sinal de que vá haver tão cedo, um patch da série 15.5 que resolva isso rio acima: as issues abertas na comunidade Vercel sobre o mesmo pino ([#93234](https://github.com/vercel/next.js/issues/93234), [#93604](https://github.com/vercel/next.js/issues/93604)) seguem sem correção. Esperar não é mais uma opção neutra — é decidir, na prática, deixar os 7 achados abertos indefinidamente.

## 2. O que foi levantado no código

### 2.1 `postcss` — 4 alertas

`next@15.5.25` carrega `postcss@8.4.31` como dependência interna exata. `frontend/package.json` já tem `postcss: ^8` direto, resolvendo hoje para `8.5.25` — mas isso não muda a cópia que o `next` usa internamente; são duas resoluções independentes na mesma árvore (`pnpm-lock.yaml`).

Duas advisories relevantes, ambas fechadas apenas em versões posteriores a `8.4.31`:

| Advisory | CVE | Descrição | Corrigido em |
|---|---|---|---|
| GHSA-qx2v-qp2m-jg93 | CVE-2026-41305 | XSS por `</style>` não escapado na saída do `stringify` | ≥8.5.10 |
| GHSA-6g55-p6wh-862q | CVE-2026-45623 | Leitura arbitrária de arquivo via `sourceMappingURL` controlado pelo atacante em comentário CSS | ≥8.5.12 |
| GHSA-fxqj-rqcc-2cmp | — | Correção incompleta da anterior: sem a opção `from`, o guard de `sourceMappingURL` era pulado | ≥8.5.23 |

O piso real de segurança é **8.5.23**, não 8.5.10 — a primeira advisory corrigida ainda deixava passar as outras duas (§2.5 registra como isso quase passou despercebido nesta própria revisão).

### 2.2 `nanoid` — 1 alerta

Dependência transitiva do próprio `postcss` (tanto a cópia `8.4.31` do `next` quanto a `8.5.25` direta dependem de `nanoid@3.3.17`). GHSA-2v37-7h3g-55p8 (CVE-2026-67213): loop infinito em `customAlphabet`/`customRandom` quando o tamanho é zero. Corrigido em `3.3.18` (linha `3.x`, ainda com suporte CJS).

### 2.3 `sharp` — 1 alerta

`sharp` é `devDependency` **direta** do projeto (`frontend/package.json`), presa em `^0.35.3` → resolvida em `0.35.3`. O próprio `next@15.5.25` já carrega `sharp@0.35.4` internamente (dependência opcional, para a API de otimização de imagem). GHSA-rgj7-g3m4-5g8c: vulnerabilidades altas no `libheif` embutido, corrigidas em `0.35.4`.

### 2.4 `js-yaml` — 1 alerta

Transitiva de `@eslint/eslintrc@2.1.4` (via `eslint@8.57.1`). A versão `4.3.1` já corrige o CVE de DoS por `!!omap` (GHSA-5p4m-2wfm-xmqj) e o de prototype pollution (CVE-2025-64718) — mas o release `4.3.2` (2026-08-26) fecha um contorno adicional do mesmo DoS de merge-key (limita o tamanho da sequência de merge a 100 e passa a contar *mappings* vazios no `maxTotalMergeKeys`).

### 2.5 O quase-incidente: `>=` sem teto de major

A primeira tentativa desta correção usou `pnpm.overrides` com piso aberto (`"nanoid": ">=3.3.18"`, `"js-yaml": ">=4.3.2"`). O `pnpm install` resolveu isso para `nanoid@6.0.1` e `js-yaml@5.4.2` — majors que nenhum dos dois consumidores foi testado contra:

- `nanoid@4.0.0` em diante é **ESM-only**; `postcss` é CJS e faz `require('nanoid')` — quebraria em tempo de execução do build, não em tempo de instalação.
- `@eslint/eslintrc@2.1.4` declara `js-yaml: ^4.1.0`; a `5.x` é major nova, sem garantia de compatibilidade de API.

`pnpm install` e `pnpm audit` rodaram limpos com essas versões — o problema só apareceria ao rodar `pnpm build` ou `pnpm lint` de fato. Descoberto por inspeção do `pnpm-lock.yaml` antes de validar, revertido para overrides com teto de major (`^3.3.18`, `^4.3.2`) antes de qualquer commit. Registrado como `D-05`/`R-DEP-06` para não se repetir.

## 3. Objetivo

Fechar os 7 achados altos de `pnpm audit` (`postcss` ×4, `sharp`, `nanoid`, `js-yaml`) sem trocar o major de nenhum pacote e sem esperar por um fix upstream do `next`, via bump direto (`sharp`) e `pnpm.overrides` com teto de major (`postcss`, `nanoid`, `js-yaml`).

**Não é objetivo:** esperar o `next` publicar uma versão própria com `postcss` corrigido (`I-01` da ESPEC 048 ficaria em aberto por tempo indeterminado — esta espec resolve isso agora); resolver `I-03` da ESPEC 048 (gate de auditoria no pre-commit); migrar qualquer pacote de major.

## 4. Escopo

### 4.1 Dentro do escopo

- `frontend/package.json`: `sharp` de `^0.35.3` para `^0.35.4`; adição de `pnpm.overrides` para `postcss`, `nanoid`, `js-yaml`;
- `frontend/pnpm-lock.yaml`: regenerado por `pnpm install`;
- validação local: `pnpm install`, `pnpm lint`, `pnpm build`, `pnpm audit`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Gate de auditoria automática de `frontend/pnpm-lock.yaml` no pre-commit | `I-03` da ESPEC 048, decisão de processo separada, não faz parte de fechar estes 7 achados |
| Suíte E2E completa | Nenhum dos 4 pacotes executa no container de produção (§6 `D-07`) — diferente da ESPEC 048, que trocava o próprio `next` |
| Migração de major de `postcss`, `nanoid`, `js-yaml` ou `sharp` | Não necessária — todas as correções existem dentro do major já usado |

## 5. Regras

| ID | Regra |
|---|---|
| `R-DEP-06` | `pnpm.overrides` nunca usa piso aberto (`>=X`) sem teto de major (`<Y`) ou `^`/`~` — todo override expressa um teto que impede o resolvedor de escolher um major que os consumidores transitivos não declaram suportar (§2.5) |
| `R-DEP-07` | `frontend/pnpm-lock.yaml` é regenerado por `pnpm install` e commitado junto, na mesma convenção da ESPEC 048 `R-DEP-02` |
| `R-DEP-08` | `pnpm audit` após a mudança não lista nenhum dos 7 achados atuais (`postcss`, `sharp`, `nanoid`, `js-yaml`) |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-04` | **Fecha `I-01` da ESPEC 048 agora, não espera o `next` publicar correção própria** | Já não há sinal de fix upstream (§1); overrides com teto de major (`D-05`) reduzem o risco que motivou adiar em `048` |
| `D-05` | **Overrides usam range com teto de major, nunca `>=` aberto** | Tentativa inicial com `>=` deixou o `pnpm` escolher `nanoid@6` (ESM-only, quebra o `require()` do `postcss`) e `js-yaml@5` (fora do range que o `eslintrc` testa) — §2.5 |
| `D-06` | **`sharp` corrigido por bump direto no `package.json`, não por override** | É `devDependency` direta do projeto, não transitiva; sobe para a mesma versão (`0.35.4`) que o próprio `next` já carrega internamente, sem introduzir uma segunda fonte de verdade |
| `D-07` | **Não exige nova rodada da suíte E2E** | `frontend/Dockerfile` (estágio `runner`) copia só `.next/standalone`, `.next/static` e `public/` — sem `node_modules`. `postcss`/`nanoid` rodam só em build (processamento de CSS), `js-yaml` só em lint (ESLint), e `sharp` é `devDependency` usada apenas para gerar `icon.png` em build. Nenhum dos quatro roda no container de produção — diferente da ESPEC 048, que trocava o próprio `next`, pacote de runtime |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| [`frontend/package.json`](../../frontend/package.json) | `"sharp": "^0.35.3"` → `"^0.35.4"` (linha 28); novo bloco `"pnpm": { "overrides": { "postcss": ">=8.5.23 <9", "nanoid": "^3.3.18", "js-yaml": "^4.3.2" } }` |
| [`frontend/pnpm-lock.yaml`](../../frontend/pnpm-lock.yaml) | Regenerado por `pnpm install`: `postcss@8.5.25` (única cópia, inclusive dentro de `next`), `nanoid@3.3.19`, `sharp@0.35.4`, `js-yaml@4.3.2` |

## 8. Testes e critério de aceite

| Verificação | Resultado |
|---|---|
| `pnpm install` | Sem intervenção manual, sem novo script de build pendente de aprovação |
| `pnpm lint` | Limpo — `No ESLint warnings or errors` |
| `pnpm build` | Completa, gera as 5 páginas estáticas (inclusive `icon.png`, exercitando o `sharp` novo) |
| `pnpm audit` | `No known vulnerabilities found` (era 7) |

**Critério de aceite:** as quatro verificações acima passam e nenhuma delas depende de mudança em `next`, `react` ou no `Dockerfile`.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Override forçar uma versão de `postcss`/`nanoid` que o `next@15.5.25` não testou internamente | `pnpm build` limpo, gerando build de produção completo; teto de major (`<9`) limita o raio da mudança a patches/minors dentro da mesma major já usada pelo `next` |
| Uma futura atualização de `next` trazer sua própria versão de `postcss` incompatível com o teto do override | `pnpm install` falharia a resolução de forma visível (conflito de range), não silenciosa — seria pego no próprio CI/build, não em produção |
| `sharp@0.35.4` mudar o binário nativo do `libvips`/`libheif` embutido | Já é a mesma versão que o `next` carrega internamente há duas specs; sem binário novo introduzido na árvore |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-05` | Vale estender `I-03` da ESPEC 048 (gate de `pnpm audit` no pre-commit ou CI) agora que há duas specs seguidas motivadas por varredura manual/Dependabot, não por processo automático do projeto? | Não — decisão de processo separada |
| `I-06` | Quando o `next` publicar uma versão própria com `postcss` corrigido, vale remover o override (redundante) ou mantê-lo como cinto-e-suspensório? | Não bloqueia — decisão para quando a situação mudar |

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Bump de `sharp` e `pnpm.overrides` em `package.json`, `pnpm install` | PP |
| B | Validação local — lint, build, `pnpm audit` | PP |

**Esforço real: menos de 1 hora**, incluindo a correção do piso de `postcss` (8.5.10 → 8.5.23) e a reversão do quase-incidente de major em `nanoid`/`js-yaml` (§2.5).

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-14 | Redação inicial, a partir da varredura do Dependabot em `prodam-gda/confere` e da análise que reidentificou os 7 achados já apontados pela ESPEC 048 §2.3. Implementado: `sharp` → `^0.35.4`; `pnpm.overrides` para `postcss`, `nanoid`, `js-yaml`. Primeira tentativa com piso aberto (`>=`) resolveu `nanoid@6`/`js-yaml@5` — majors incompatíveis, revertida antes de qualquer commit (§2.5, `D-05`). Piso de `postcss` corrigido de `>=8.5.10` para `>=8.5.23` ao encontrar a advisory de correção incompleta (`GHSA-fxqj-rqcc-2cmp`, §2.1). `pnpm lint`, `pnpm build` e `pnpm audit` (7 → 0) limpos. Ainda não commitado |
