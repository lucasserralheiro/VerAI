# ESPEC 056 — O rodapé que ganhou link no logo e nos ícones sociais

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-14. Os três `<a>` em `Rodape.tsx`; `rodape.spec.ts` novo (4 casos) verde; suíte e2e completa **131 passed, 0 failed** (127 herdados + 4 novos); `pnpm lint`/`pnpm build` limpos |
| **Versão** | 1.2 — 2026-09-14 — implementada (§12) |
| **Depende de** | [ESPEC 006](006-rodape-institucional.md) `R-ROD-01` a `R-ROD-11` — o rodapé institucional, implementado. Esta espec usa o mesmo componente sem alterar composição, cores ou responsividade |
| **Revisa** | ESPEC 006, D-06: a frase "o único elemento da interface que não faz nada: sem navegação, sem link, sem ação" deixa de valer para a marca e para os dois ícones sociais. ESPEC 006 §10, ponto 1 (deveria `/prodamsp` virar link?) fica **resolvido**: os ícones viram link, o texto `/prodamsp` continua texto — decisão deliberada, não mais pendência por falta de URL (`D-08`) |
| **Ativos** | Nenhum novo — reusa `frontend/public/prodam-branca.svg`, já presente |
| **Origem** | Pedido direto do usuário em conversa: primeiro o logo → portal institucional; depois, na mesma conversa, os ícones de Instagram e LinkedIn → perfis oficiais, com URLs fornecidas |

---

## 1. Problema

Três elementos do rodapé (`Rodape.tsx`) são hoje puramente visuais, sem nenhum comportamento
interativo — decisão explícita da ESPEC 006 (D-06), tomada quando o rodapé não tinha nenhuma razão
para ter ação:

1. O logo da PRODAM (`prodam-branca.svg`) deve abrir o portal institucional
   (`https://portal.prodam.sp.gov.br/`).
2. O ícone do Instagram deve abrir `https://www.instagram.com/prodamsp/`.
3. O ícone do LinkedIn deve abrir `https://br.linkedin.com/company/prodamsp`.

Todos em nova aba, ao clicar.

## 2. O que foi levantado no código

- A marca é renderizada em `frontend/src/app/components/Rodape.tsx:39-45`, como `<Image
  src="/prodam-branca.svg" alt="Prodam govtech sp" .../>`, sem elemento interativo ao redor.
- Os ícones sociais são componentes SVG inline, `Instagram` (linhas 13-21) e `LinkedIn`
  (linhas 23-29), definidos no próprio arquivo e usados lado a lado com o texto do handle:

  ```tsx
  <p className="mt-2.5 flex items-center gap-2 sm:justify-end">
      <Instagram className="h-[1.1rem] w-[1.1rem] text-prodam-orange" />
      <LinkedIn className="h-[1.05rem] w-[1.05rem] text-prodam-orange" />
      <span className="font-medium">/prodamsp</span>
  </p>
  ```

  Cada SVG tem `aria-hidden="true"` (ESPEC 006, D-05) e herda cor via `currentColor` — hoje nenhum
  dos dois está dentro de um elemento focável ou clicável.
- `Rodape.tsx` **não é** `"use client"` — é Server Component. Links `<a>` externos simples não
  exigem diretiva de cliente nem `onClick`; a navegação é nativa do navegador.
- A aplicação já tem uma regra de foco visível **global**, em `globals.css` (ESPEC 008, `R-ACE-04`):
  `:where(a, button, summary, [tabindex]:not([tabindex="-1"])):focus-visible` recebe contorno
  `outline: 2px solid theme("colors.teal.500")`. Qualquer `<a>` novo herda esse contorno sem CSS
  adicional.
- Não há nenhum `target="_blank"` em uso hoje no `frontend/src` — este pedido introduz os três
  primeiros links externos da aplicação; não há convenção local de `rel` a seguir, então se aplica a
  prática padrão de segurança (`rel="noopener noreferrer"`, ver `D-02`).
- Nenhuma suíte e2e cobre o rodapé hoje (`frontend/e2e/` não tem nenhum arquivo que mencione
  `Rodape`, `footer`, `prodam`, `Instagram` ou `LinkedIn`).

## 3. Objetivo

- Ao clicar (ou ativar por teclado) o logo da PRODAM, o navegador abre
  `https://portal.prodam.sp.gov.br/` em nova aba.
- Ao clicar (ou ativar por teclado) o ícone do Instagram, o navegador abre
  `https://www.instagram.com/prodamsp/` em nova aba.
- Ao clicar (ou ativar por teclado) o ícone do LinkedIn, o navegador abre
  `https://br.linkedin.com/company/prodamsp` em nova aba.

**Não é objetivo:** tornar o **texto** `/prodamsp` um link — ver `D-08`, decisão deliberada, não
pendência; alterar o logo "Confere" do cabeçalho (`Barra.tsx`) — é outra marca, não mencionada no
pedido; mudar composição, cores, tamanho ou comportamento responsivo do rodapé (`R-ROD-01` a
`R-ROD-08`, `R-ROD-11`, inalterados).

## 4. Escopo

### 4.1 Dentro do escopo

- `Rodape.tsx`: o `<Image>` da marca PRODAM passa a ficar dentro de um `<a>` para
  `https://portal.prodam.sp.gov.br/`.
- `Rodape.tsx`: o ícone `<Instagram>` passa a ficar dentro de um `<a>` para
  `https://www.instagram.com/prodamsp/`.
- `Rodape.tsx`: o ícone `<LinkedIn>` passa a ficar dentro de um `<a>` para
  `https://br.linkedin.com/company/prodamsp`.
- Os três links abrem em nova aba, com o mesmo padrão de segurança e de nome acessível.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Texto `/prodamsp` virar link | `D-08` — um único texto não pode apontar para dois destinos diferentes (Instagram e LinkedIn); os ícones, que já são dois elementos distintos, cobrem essa necessidade |
| Logo "Confere" do cabeçalho (`Barra.tsx`) | Marca diferente; o pedido se refere aos elementos do rodapé |
| Qualquer mudança de composição, cor, tamanho ou responsividade do rodapé | `R-ROD-01` a `R-ROD-08`, `R-ROD-11` já resolvidos pela ESPEC 006 e não fazem parte deste pedido |

## 5. Regras

| ID | Regra |
|---|---|
| `R-ROD-12` | A marca PRODAM do rodapé é um link para `https://portal.prodam.sp.gov.br/` |
| `R-ROD-13` | O ícone do Instagram é um link para `https://www.instagram.com/prodamsp/` |
| `R-ROD-14` | O ícone do LinkedIn é um link para `https://br.linkedin.com/company/prodamsp` |
| `R-ROD-15` | Os três links (`R-ROD-12` a `R-ROD-14`) abrem em **nova aba** (`target="_blank"`) com `rel="noopener noreferrer"` |
| `R-ROD-16` | Cada um dos três links tem nome acessível próprio que informa o destino e que abre em nova aba — nenhum depende só do `alt` da imagem ou herda o `aria-hidden` do SVG que envolve |
| `R-ROD-17` | **Invariante de não regressão:** o texto `/prodamsp` continua texto plano, sem `href` (`R-ROD-09` mantida); endereço, divisor, cores e demais elementos do rodapé sem mudança |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | `<a>` HTML puro em volta de cada elemento (`Image`, `Instagram`, `LinkedIn`), não `next/link` | `next/link` é para navegação interna (client-side); os três destinos são domínios externos — a convenção do Next.js é `<a>` simples nesse caso |
| `D-02` | `rel="noopener noreferrer"` obrigatório junto de `target="_blank"`, nos três links | Sem `rel="noopener"`, a aba nova ganha acesso a `window.opener`, permitindo que a página de destino redirecione a aba original (*reverse tabnabbing*). Primeiros links externos do projeto — vale fixar a prática aqui como padrão para os próximos |
| `D-03` | Nome acessível explícito (`aria-label`) em cada `<a>`, em vez de depender do `alt` da imagem ou do conteúdo do SVG | O `alt` do logo descreve a imagem, não a ação; os SVGs dos ícones são `aria-hidden` (D-05 da ESPEC 006) e não têm texto nenhum. Sem `aria-label` no `<a>`, um leitor de tela anunciaria "link" sem dizer para onde — WCAG 2.4.4 |
| `D-04` | Nenhum CSS novo para o indicador de foco | `R-ACE-04` (ESPEC 008) já cobre qualquer `<a>` globalmente; escrever uma regra local duplicaria o que já existe |
| `D-05` | Afordância visual sutil no hover/focus (ex.: leve redução de opacidade na transição), igual nos três | O rodapé foi desenhado para não competir visualmente (ESPEC 006 §4.1); os elementos virando link merecem algum sinal de que são clicáveis, sem introduzir sublinhado ou elemento estranho à composição institucional |
| `D-06` | Escopo restrito a cada ícone/imagem isoladamente, não ao bloco inteiro (ex.: não engloba o texto "Prodam — Empresa de Tecnologia..." nem o `/prodamsp`) | O pedido é específico a cada elemento visual; ampliar a área clicável a texto vizinho seria decisão própria, não pedida |
| `D-07` | Instagram e LinkedIn ganham **dois `<a>` separados**, um por ícone, cada um com sua própria URL | Cada ícone tem um destino diferente — um único link envolvendo os dois SVGs só poderia apontar para uma URL, perdendo a distinção que o pedido fez entre as duas redes |
| `D-08` | O texto `/prodamsp` **não** vira link, nem parcialmente | Ele é um rótulo único, compartilhado visualmente pelas duas redes (Instagram e LinkedIn). Linkar esse texto exigiria escolher arbitrariamente uma das duas URLs, ou duplicar o texto em dois `<a>` — nenhuma das opções foi pedida, e os ícones já cobrem a necessidade de abrir cada rede. Resolve em definitivo o ponto em aberto #1 da ESPEC 006, sem reabri-lo |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `frontend/src/app/components/Rodape.tsx` | `<Image src="/prodam-branca.svg" .../>` passa a ficar dentro de `<a href="https://portal.prodam.sp.gov.br/" target="_blank" rel="noopener noreferrer" aria-label="Prodam — abrir o portal institucional em nova aba">`. `<Instagram .../>` passa a ficar dentro de `<a href="https://www.instagram.com/prodamsp/" target="_blank" rel="noopener noreferrer" aria-label="Instagram da Prodam — abre em nova aba">`. `<LinkedIn .../>` passa a ficar dentro de `<a href="https://br.linkedin.com/company/prodamsp" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn da Prodam — abre em nova aba">` |
| `frontend/e2e/rodape.spec.ts` (novo) | Casos novos: os três links têm `href`, `target="_blank"` e `rel` com `noopener`/`noreferrer` corretos; cada um recebe foco por `Tab` com contorno visível computado; nome acessível de cada um não é vazio e é distinto entre si; o texto `/prodamsp` **não** tem `href` |
| `docs/specs/006-rodape-institucional.md` | Nota de revisão em D-06 e no §10 (ponto 1), apontando para esta espec — sem reabrir o resto do documento |
| `domain/` · `application/` · `infrastructure/` · `api/` | Nenhuma |

## 8. Testes e critério de aceite

| Verificação | Como |
|---|---|
| `R-ROD-12` | `href` do `<a>` do logo é exatamente `https://portal.prodam.sp.gov.br/` |
| `R-ROD-13` | `href` do `<a>` do Instagram é exatamente `https://www.instagram.com/prodamsp/` |
| `R-ROD-14` | `href` do `<a>` do LinkedIn é exatamente `https://br.linkedin.com/company/prodamsp` |
| `R-ROD-15` | Os três `<a>` têm `target="_blank"` e `rel` contendo `noopener` e `noreferrer` |
| `R-ROD-16` | Nome acessível de cada link (via `getByRole("link", { name: /.../ })`) identifica o destino/rede e o comportamento de nova aba; os três nomes são diferentes entre si |
| `R-ROD-17` | O `<span>` de `/prodamsp` continua sem `href`; suíte e2e completa sem falha nova fora de `rodape.spec.ts` |
| Teclado | A partir do link social mais próximo, `Tab` alcança cada um dos três links em sequência; `document.activeElement` corresponde ao `<a>` esperado, com `outline` computado > 0 (mesma checagem de `a11y-teclado.spec.ts`) |
| Manual | Clique em cada elemento abre a URL correspondente em nova aba, mantendo a aba original na aplicação |

**Critério de aceite:** clicar (mouse ou teclado) no logo, no ícone do Instagram ou no ícone do
LinkedIn abre o destino correspondente em nova aba, sem afetar a aba original; `/prodamsp` continua
texto; nenhum outro elemento do rodapé muda; suíte e2e completa sem regressão.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Reverse tabnabbing via `window.opener`, nos três links | `rel="noopener noreferrer"` (`D-02`) |
| Usuário achar que está saindo da aplicação sem aviso | `aria-label` de cada link anuncia "nova aba" antes do clique (`D-03`); comportamento familiar de qualquer link institucional/social |
| Área clicável dos ícones (`h-[1.1rem]`/`h-[1.05rem]`, ~17-18 px) pequena para toque impreciso | Mesmo tamanho visual de hoje — nenhuma mudança de layout foi pedida; risco aceito, mitigável no futuro com `padding` no `<a>` se vier reclamação real |
| Confundir com o logo "Confere" do cabeçalho e linkar o elemento errado | Escopo restrito e nomeado explicitamente a `Rodape.tsx` (`§4.2`) — qualquer `git diff` em `Barra.tsx` é sinal de vazamento |
| URL do LinkedIn no formato regional (`br.linkedin.com`) divergir do formato canônico (`www.linkedin.com`) no futuro | Usada exatamente a URL fornecida pelo usuário nesta conversa; se a PRODAM padronizar outro formato, é mudança de uma linha |

## 10. Pontos em aberto

Nenhum. As três URLs foram fornecidas diretamente pelo usuário; o ponto em aberto #1 da ESPEC 006
fica resolvido por `D-08`. Não há decisão pendente que bloqueie a implementação.

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `Rodape.tsx` (três links) + teste e2e novo | PP |

**Estimativa: menos de uma hora.**

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-14 | Redação inicial — logo do rodapé vira link para o portal institucional |
| 1.1 | 2026-09-14 | Escopo ampliado: ícones de Instagram e LinkedIn também viram link (URLs confirmadas pelo usuário), com o mesmo padrão de segurança e acessibilidade do logo. `R-ROD-13` a `R-ROD-17` renumeradas/acrescentadas; `D-07` e `D-08` acrescentadas. Decidido, deliberadamente, que o texto `/prodamsp` não vira link — resolve o ponto em aberto #1 da ESPEC 006 |
| 1.2 | 2026-09-14 | Implementada — PLANO 056/TASKS 056. `Rodape.tsx`: os três `<a>` (`D-01`–`D-08`); `frontend/e2e/rodape.spec.ts` novo, 4 casos verdes; suíte e2e completa 131 passed (127 + 4), 0 failed; `pnpm lint`/`pnpm build` limpos; ESPEC 006 recebeu nota de revisão em D-06 e §10 ponto 1 |
