# ConfereAI — ajustes de UX e a janela "Pastas do cliente" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o ConfereAI claro depois da busca do contrato pela planilha — começo guiado, textos que dizem o que falta, aditivos em uma linha, arrastar e soltar por cartão — e dar uma janela para navegar nas pastas do SharePoint do cliente e escolher proposta e aditivos.

**Architecture:** Uma rota só de leitura (`GET /api/confere/clientes/[clienteId]/pastas`) devolve os arquivos do cliente com o caminho do SharePoint sem a pasta do cliente. A janela (`JanelaDePastas`, `<dialog>` nativo) monta a navegação no navegador. Um hook (`useSoltarArquivos`) cuida de arrastar e soltar em cada cartão. `UploadForm` e `page.tsx` ganham o selo, os textos, os botões da janela e perdem os menus "Trocar"/"+ Adicionar do cadastro".

**Tech Stack:** Next.js 15, React 19, Prisma 6, Jest 30 + Testing Library.

**Desenho:** `docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md`.

## Andamento

- **25/09/2026 — Tasks 1–4 concluídas** (`141f576`, `5533938`, `6bc6df2`, `c91a1bf`); tela do ConfereAI 41 testes; `tsc` limpo; lint só com os 2 avisos antigos.
- Achado no caminho: Jest com **um arquivo só** de teste jsdom não encerra — o `MessageChannel` do Node que o `jest.setup.ts` instala segura o processo (porta do agendador do React). Rodar com mais de um arquivo ou `--forceExit`; a correção ficou como tarefa separada.
- **Pendente — Task 5, Step 3 (na tela)**, com o usuário.

## Global Constraints

- A janela só lê: nada cria, renomeia ou move pasta; nenhum caminho novo é guardado (decisão de 23/09/2026).
- `urlBlob` nunca vai para o navegador; "ver" abre `/api/arquivos/{id}?modo=inline`.
- Permissão: `exigirAcessoCliente` na rota das pastas; lista de clientes de `GET /api/clientes` (já filtra os visíveis).
- Estilo: `src/app/confere/**` com tabs, aspas duplas e ponto e vírgula; `src/lib/**` e `src/app/api/**` com 2 espaços, aspas simples, sem ponto e vírgula.
- Testes de servidor com `/** @jest-environment node */`. Rodar com `npx jest <caminho>`.
- Commits só com os arquivos da task (nunca `git add -A`); sem push; mensagem termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: As pastas do cliente (servidor)

**Files:**
- Modify: `src/lib/confere/tipos-cadastro.ts`
- Create: `src/lib/confere/pastas.ts`, `src/app/api/confere/clientes/[clienteId]/pastas/route.ts`
- Test: `src/lib/confere/pastas.test.ts`, `src/app/api/confere/clientes/[clienteId]/pastas/route.test.ts`

**Interfaces:**
- Produces: `PASTA_ENVIADOS = 'Enviados pelo VerAI'`, `PASTA_FORA = 'Fora do SharePoint'`, `ArquivoNaPasta` (`{ arquivoId, nome, extensao, categoria: string, pasta: string[] }`), `PastasDoCliente` (`{ cliente: { id, nome, sigla }, arquivos }`), `DocumentoDoCadastro.pasta?: string | null`; `pastasDoCliente(clienteId): Promise<PastasDoCliente | null>`; `GET /api/confere/clientes/[clienteId]/pastas`.

- [x] **Step 1: Testes que falham**

`src/lib/confere/pastas.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: { cliente: { findUnique: jest.fn() }, arquivoCliente: { findMany: jest.fn() } },
}))

import { prisma } from '@/lib/prisma'

import { pastasDoCliente } from './pastas'
import { PASTA_ENVIADOS, PASTA_FORA } from './tipos-cadastro'

function arquivo(id: string, nome: string, caminhos: Array<string | [string, Date]>) {
  return {
    id,
    nome,
    extensao: nome.split('.').pop(),
    categoria: 'OUTRO',
    sharepoint: caminhos.map((c) =>
      typeof c === 'string' ? { caminho: c, removidoNaOrigemEm: null } : { caminho: c[0], removidoNaOrigemEm: c[1] }
    ),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
    id: 'cl-cgm',
    nome: 'Controladoria Geral do Município',
    siglaLegado: 'CGM',
  })
})

it('cliente inexistente: null', async () => {
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
  await expect(pastasDoCliente('x')).resolves.toBeNull()
})

it('tira a pasta do cliente do caminho do SharePoint', async () => {
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    arquivo('pa', 'PA-CGM- 250912-127 v4.0.pdf', [
      'CGM/TC 16-CGM-2024 - Sustentação/3) TC 16-CGM-2024 - TA 02 - Prorrogação/PA-CGM- 250912-127 v4.0.pdf',
    ]),
    arquivo('solto', 'Ofício.pdf', ['CGM/Ofício.pdf']),
  ])
  const pastas = await pastasDoCliente('cl-cgm')
  expect(prisma.arquivoCliente.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { clienteId: 'cl-cgm', removidoEm: null } })
  )
  expect(pastas).toEqual({
    cliente: { id: 'cl-cgm', nome: 'Controladoria Geral do Município', sigla: 'CGM' },
    arquivos: [
      {
        arquivoId: 'pa',
        nome: 'PA-CGM- 250912-127 v4.0.pdf',
        extensao: 'pdf',
        categoria: 'OUTRO',
        pasta: ['TC 16-CGM-2024 - Sustentação', '3) TC 16-CGM-2024 - TA 02 - Prorrogação'],
      },
      { arquivoId: 'solto', nome: 'Ofício.pdf', extensao: 'pdf', categoria: 'OUTRO', pasta: [] },
    ],
  })
})

it('sem caminho do SharePoint: "Enviados pelo VerAI"; caminho que saiu do SharePoint: "Fora do SharePoint"', async () => {
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    arquivo('pc', 'PC.pdf', ['CGM/TC 16/1) Inicial/PC.pdf']),
    arquivo('enviado', 'Planilha.xlsx', []),
    arquivo('saiu', 'Antigo.pdf', [['CGM/TC 12/Antigo.pdf', new Date()]]),
  ])
  const pastas = await pastasDoCliente('cl-cgm')
  expect(pastas?.arquivos.map((a) => [a.arquivoId, a.pasta])).toEqual([
    ['pc', ['TC 16', '1) Inicial']],
    ['enviado', [PASTA_ENVIADOS]],
    ['saiu', [PASTA_FORA]],
  ])
})

it('publicação de outra pasta da biblioteca fica com o caminho inteiro; o mesmo arquivo em duas pastas aparece nas duas', async () => {
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    arquivo('a', 'A.pdf', ['CGM/TC 16/1) Inicial/A.pdf']),
    arquivo('b', 'B.pdf', ['CGM/TC 16/2) TA 01/B.pdf', 'CGM/TC 16/3) TA 02/B.pdf']),
    arquivo('doc', 'DOC 01-01-2026.pdf', ['1. PUBLICAÇÕES NO DOC/2026/DOC 01-01-2026.pdf']),
  ])
  const pastas = await pastasDoCliente('cl-cgm')
  expect(pastas?.arquivos.map((a) => a.pasta)).toEqual([
    ['TC 16', '1) Inicial'],
    ['TC 16', '2) TA 01'],
    ['TC 16', '3) TA 02'],
    ['1. PUBLICAÇÕES NO DOC', '2026'],
  ])
})
```

`src/app/api/confere/clientes/[clienteId]/pastas/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { usuario: { findUnique: jest.fn() } } }))
jest.mock('@/lib/confere/pastas', () => ({ pastasDoCliente: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { pastasDoCliente } from '@/lib/confere/pastas'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ clienteId: 'cl-1' }) }
const pedido = () => new NextRequest('http://localhost/api/confere/clientes/cl-1/pastas')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido(), contexto)).status).toBe(401)
})

it('403 sem acesso ao cliente', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
  expect((await GET(pedido(), contexto)).status).toBe(403)
  expect(pastasDoCliente).not.toHaveBeenCalled()
})

it('404 cliente inexistente', async () => {
  ;(pastasDoCliente as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido(), contexto)).status).toBe(404)
})

it('devolve as pastas do cliente', async () => {
  const pastas = { cliente: { id: 'cl-1', nome: 'C', sigla: 'C' }, arquivos: [] }
  ;(pastasDoCliente as jest.Mock).mockResolvedValue(pastas)
  const resposta = await GET(pedido(), contexto)
  expect(await resposta.json()).toEqual(pastas)
  expect(pastasDoCliente).toHaveBeenCalledWith('cl-1')
})
```

- [x] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/confere/pastas.test.ts "src/app/api/confere/clientes"`
Expected: FAIL — módulos não existem.

- [x] **Step 3: Tipos** — em `src/lib/confere/tipos-cadastro.ts`, dentro de `DocumentoDoCadastro`, depois de `origem`:

```ts
  /** A pasta de onde a pessoa escolheu o arquivo na janela "Pastas do cliente" — o que a tela mostra
   *  quando não há `origem` no histórico. */
  pasta?: string | null
```

e no fim do arquivo:

```ts
/** Pasta, na janela "Pastas do cliente", dos arquivos que nunca estiveram no SharePoint. */
export const PASTA_ENVIADOS = 'Enviados pelo VerAI'
/** Pasta dos arquivos que saíram do SharePoint mas continuam no VerAI porque algo os usa. */
export const PASTA_FORA = 'Fora do SharePoint'

export interface ArquivoNaPasta {
  arquivoId: string
  nome: string
  extensao: string
  categoria: string
  /** As pastas do topo até o arquivo, sem a pasta do próprio cliente. */
  pasta: string[]
}

export interface PastasDoCliente {
  cliente: { id: string; nome: string; sigla: string | null }
  arquivos: ArquivoNaPasta[]
}
```

- [x] **Step 4: `src/lib/confere/pastas.ts`**

```ts
import { prisma } from '@/lib/prisma'

import { PASTA_ENVIADOS, PASTA_FORA, type ArquivoNaPasta, type PastasDoCliente } from './tipos-cadastro'

// As pastas do cliente para a janela "Pastas do cliente" do ConfereAI
// (docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md §3.5): o caminho que a sincronização
// do SharePoint já guarda em `ArquivoSharepoint.caminho`, sem a pasta do próprio cliente. É só uma
// vista — nada aqui cria pasta nem guarda caminho (a decisão de 23/09/2026, nenhuma árvore de pastas
// paralela no VerAI, continua valendo).

function pastasDoCaminho(caminho: string): string[] {
  return caminho.split('/').filter(Boolean).slice(0, -1)
}

export async function pastasDoCliente(clienteId: string): Promise<PastasDoCliente | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, siglaLegado: true },
  })
  if (!cliente) return null
  const arquivos = await prisma.arquivoCliente.findMany({
    where: { clienteId, removidoEm: null },
    select: {
      id: true,
      nome: true,
      extensao: true,
      categoria: true,
      sharepoint: { select: { caminho: true, removidoNaOrigemEm: true } },
    },
    orderBy: { nome: 'asc' },
  })

  // A pasta do cliente é a primeira pasta que mais aparece nos caminhos ("CGM"). Publicação roteada de
  // outra pasta da biblioteca ("1. PUBLICAÇÕES NO DOC") fica com o caminho inteiro.
  const vezes = new Map<string, number>()
  for (const arquivo of arquivos) {
    for (const { caminho } of arquivo.sharepoint) {
      const primeira = caminho.split('/').filter(Boolean)[0]
      if (primeira) vezes.set(primeira, (vezes.get(primeira) ?? 0) + 1)
    }
  }
  const raiz = [...vezes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const lista: ArquivoNaPasta[] = []
  for (const arquivo of arquivos) {
    const base = { arquivoId: arquivo.id, nome: arquivo.nome, extensao: arquivo.extensao, categoria: arquivo.categoria }
    const noSharepoint = arquivo.sharepoint.filter((sp) => !sp.removidoNaOrigemEm)
    if (noSharepoint.length === 0) {
      lista.push({ ...base, pasta: [arquivo.sharepoint.length > 0 ? PASTA_FORA : PASTA_ENVIADOS] })
      continue
    }
    for (const { caminho } of noSharepoint) {
      const pastas = pastasDoCaminho(caminho)
      lista.push({ ...base, pasta: pastas[0] === raiz ? pastas.slice(1) : pastas })
    }
  }
  return { cliente: { id: cliente.id, nome: cliente.nome, sigla: cliente.siglaLegado }, arquivos: lista }
}
```

- [x] **Step 5: `src/app/api/confere/clientes/[clienteId]/pastas/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'

import { pastasDoCliente } from '@/lib/confere/pastas'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'

/** Os arquivos do cliente com as pastas do SharePoint — a janela "Pastas do cliente" do ConfereAI.
 *  Só leitura; nunca devolve `urlBlob` (o PDF abre por `/api/arquivos/[id]`). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const autenticado = await exigirAcessoCliente(request, clienteId)
  if ('erro' in autenticado) return autenticado.erro
  const pastas = await pastasDoCliente(clienteId)
  if (!pastas) return NextResponse.json({ detail: 'cliente não encontrado' }, { status: 404 })
  return NextResponse.json(pastas)
}
```

- [x] **Step 6: Rodar e ver passar**

Run: `npx jest src/lib/confere/pastas.test.ts "src/app/api/confere/clientes"`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/lib/confere/tipos-cadastro.ts src/lib/confere/pastas.ts src/lib/confere/pastas.test.ts "src/app/api/confere/clientes"
git commit -m "feat(confere): pastas do SharePoint do cliente para a janela de escolha"
```

---

### Task 2: A janela "Pastas do cliente"

**Files:**
- Modify: `src/app/confere/lib/api.ts`, `src/app/confere/lib/cadastro.ts`, `src/app/confere/lib/cadastro.test.ts`
- Create: `src/app/confere/components/JanelaDePastas.tsx`
- Test: `src/app/confere/components/JanelaDePastas.test.tsx`

**Interfaces:**
- Consumes: `ArquivoNaPasta`, `PastasDoCliente`, `DocumentoDoCadastro` (Task 1).
- Produces: `pastasDoCliente(clienteId)` e `listarClientes()` + `ClienteDaLista` em `api.ts`; `textoDoDocumento(documento)` em `cadastro.ts`; `JanelaDePastas({ aberto, clienteId?, finalidade: "contrato" | "aditivos", arquivoInicial?, onEscolher(documentos: DocumentoDoCadastro[]), onFechar })`.

- [x] **Step 1: Testes que falham**

Em `src/app/confere/lib/cadastro.test.ts`, trocar o import por `import { textoDaOrigem, textoDoContrato, textoDoDocumento } from "./cadastro";` e acrescentar:

```ts
describe("textoDoDocumento", () => {
	it("a origem do histórico quando há; senão a pasta de onde veio", () => {
		const origem = { tipo: "ADITIVO", numero: "TA 05", inicio: "2026-04-30" } as const;
		expect(textoDoDocumento({ arquivoId: "a", nome: "a.pdf", origem })).toBe("TA 05, aditivo de 30/04/2026");
		expect(textoDoDocumento({ arquivoId: "a", nome: "a.pdf", origem: null, pasta: "3) TA 02" })).toBe("pasta 3) TA 02");
		expect(textoDoDocumento({ arquivoId: "a", nome: "a.pdf", origem: null })).toBe(
			"proposta do cliente, fora do histórico do contrato",
		);
	});
});
```

`src/app/confere/components/JanelaDePastas.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";

import { JanelaDePastas } from "./JanelaDePastas";

const PASTAS = {
	cliente: { id: "cl-cgm", nome: "Controladoria Geral do Município", sigla: "CGM" },
	arquivos: [
		{ arquivoId: "pc", nome: "PC-CGM-240603-82 v3.0.pdf", extensao: "pdf", categoria: "PROPOSTA_COMERCIAL", pasta: ["TC 16-CGM-2024", "1) Contrato Inicial"] },
		{ arquivoId: "pa-01", nome: "PA-CGM-250403-035 v1.0.pdf", extensao: "pdf", categoria: "PROPOSTA_ADITIVO", pasta: ["TC 16-CGM-2024", "2) TA 01"] },
		{ arquivoId: "pa-02", nome: "PA-CGM- 250912-127 v4.0.pdf", extensao: "pdf", categoria: "PROPOSTA_ADITIVO", pasta: ["TC 16-CGM-2024", "3) TA 02"] },
		{ arquivoId: "xlsx", nome: "Planilha.xlsx", extensao: "xlsx", categoria: "PLANILHA", pasta: ["TC 16-CGM-2024", "3) TA 02"] },
		{ arquivoId: "pc-12", nome: "PC-CGM-230726-82 v3.3.pdf", extensao: "pdf", categoria: "PROPOSTA_COMERCIAL", pasta: ["TC 12-CGM-2023", "1) Contrato Inicial"] },
	],
};

beforeEach(() => {
	jest.spyOn(global, "fetch").mockImplementation(async (entrada) => {
		const url = String(entrada);
		if (url.endsWith("/api/confere/clientes/cl-cgm/pastas")) return Response.json(PASTAS);
		if (url.endsWith("/api/clientes")) {
			return Response.json([{ id: "cl-cgm", nome: "Controladoria Geral do Município", siglaLegado: "CGM" }]);
		}
		return new Response(null, { status: 404 });
	});
});

afterEach(() => jest.restoreAllMocks());

function abrir(props: Partial<Parameters<typeof JanelaDePastas>[0]> = {}) {
	const onEscolher = jest.fn();
	const onFechar = jest.fn();
	render(
		<JanelaDePastas
			aberto
			clienteId="cl-cgm"
			finalidade="contrato"
			arquivoInicial="pa-02"
			onEscolher={onEscolher}
			onFechar={onFechar}
			{...props}
		/>,
	);
	return { onEscolher, onFechar };
}

it("abre na pasta do contrato da proposta atual", async () => {
	abrir();
	expect(await screen.findByRole("button", { name: /3\) TA 02/ })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: /1\) Contrato Inicial/ })).toBeInTheDocument();
	expect(screen.queryByRole("button", { name: /TC 12-CGM-2023/ })).not.toBeInTheDocument();
});

it("entra na pasta, escolhe o PDF e usa", async () => {
	const { onEscolher, onFechar } = abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	fireEvent.click(screen.getByRole("radio", { name: /PA-CGM- 250912-127 v4\.0\.pdf/ }));
	fireEvent.click(screen.getByRole("button", { name: "Usar este arquivo" }));
	expect(onEscolher).toHaveBeenCalledWith([
		{ arquivoId: "pa-02", nome: "PA-CGM- 250912-127 v4.0.pdf", origem: null, pasta: "3) TA 02" },
	]);
	expect(onFechar).toHaveBeenCalled();
});

it("arquivo que não é PDF aparece mas não pode ser escolhido", async () => {
	abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	expect(screen.getByRole("radio", { name: /Planilha\.xlsx/ })).toBeDisabled();
});

it("o caminho é clicável e volta à raiz do cliente", async () => {
	abrir();
	await screen.findByRole("button", { name: /3\) TA 02/ });
	fireEvent.click(screen.getByRole("button", { name: "CGM" }));
	expect(screen.getByRole("button", { name: /TC 12-CGM-2023/ })).toBeInTheDocument();
});

it("busca por nome em todas as pastas", async () => {
	abrir();
	await screen.findByRole("button", { name: /3\) TA 02/ });
	fireEvent.change(screen.getByRole("searchbox", { name: "Buscar arquivo nas pastas" }), {
		target: { value: "230726" },
	});
	expect(screen.getByRole("radio", { name: /PC-CGM-230726-82 v3\.3\.pdf/ })).toBeInTheDocument();
	expect(screen.queryByRole("radio", { name: /PC-CGM-240603/ })).not.toBeInTheDocument();
});

it("aditivos: vários, na ordem dos cliques", async () => {
	const { onEscolher } = abrir({ finalidade: "aditivos" });
	fireEvent.change(await screen.findByRole("searchbox", { name: "Buscar arquivo nas pastas" }), {
		target: { value: "PA-CGM" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: /PA-CGM- 250912-127/ }));
	fireEvent.click(screen.getByRole("checkbox", { name: /PA-CGM-250403-035/ }));
	fireEvent.click(screen.getByRole("button", { name: "Adicionar 2 aditivos" }));
	expect(onEscolher.mock.calls[0][0].map((d: { arquivoId: string }) => d.arquivoId)).toEqual(["pa-02", "pa-01"]);
});

it("sem cliente: pede o cliente primeiro", async () => {
	abrir({ clienteId: undefined, arquivoInicial: undefined });
	fireEvent.click(await screen.findByRole("button", { name: /CGM · Controladoria/ }));
	expect(await screen.findByRole("button", { name: /TC 16-CGM-2024/ })).toBeInTheDocument();
});
```

- [x] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere/components/JanelaDePastas.test.tsx src/app/confere/lib/cadastro.test.ts`
Expected: FAIL — `./JanelaDePastas` não existe; `textoDoDocumento` não exportada.

- [x] **Step 3: `api.ts` e `cadastro.ts`**

Em `src/app/confere/lib/api.ts`, acrescentar `type PastasDoCliente` ao import de `@/lib/confere/tipos-cadastro` e, depois de `buscarContratos`:

```ts
/** Os arquivos do cliente com as pastas do SharePoint — a janela "Pastas do cliente". */
export async function pastasDoCliente(clienteId: string): Promise<PastasDoCliente | null> {
	try {
		const resposta = await fetch(`${API_BASE_URL}/clientes/${encodeURIComponent(clienteId)}/pastas`);
		return resposta.ok ? ((await resposta.json()) as PastasDoCliente) : null;
	} catch {
		return null;
	}
}

export interface ClienteDaLista {
	id: string;
	nome: string;
	siglaLegado: string | null;
}

/** Os clientes que a pessoa pode ver — a janela pede o cliente quando nenhum contrato foi achado. */
export async function listarClientes(): Promise<ClienteDaLista[]> {
	try {
		const resposta = await fetch("/api/clientes");
		return resposta.ok ? ((await resposta.json()) as ClienteDaLista[]) : [];
	} catch {
		return [];
	}
}
```

Em `src/app/confere/lib/cadastro.ts`, acrescentar `type DocumentoDoCadastro` ao import e:

```ts
/** De onde veio o documento: a origem no histórico do contrato ou — escolhido na janela das pastas,
 *  sem linha no histórico — a pasta. */
export function textoDoDocumento(documento: DocumentoDoCadastro): string {
	if (documento.origem) return textoDaOrigem(documento.origem);
	if (documento.pasta) return `pasta ${documento.pasta}`;
	return textoDaOrigem(null);
}
```

- [x] **Step 4: `src/app/confere/components/JanelaDePastas.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import type { ArquivoNaPasta, DocumentoDoCadastro, PastasDoCliente } from "@/lib/confere/tipos-cadastro";
import { type ClienteDaLista, listarClientes, pastasDoCliente } from "../lib/api";

interface Props {
	aberto: boolean;
	/** O cliente do contrato achado; sem ele, a janela pede o cliente primeiro. */
	clienteId?: string;
	/** Contrato: um PDF. Aditivos: vários, na ordem dos cliques. */
	finalidade: "contrato" | "aditivos";
	/** A proposta que está no campo Contrato: a janela abre na pasta do contrato dela. */
	arquivoInicial?: string;
	onEscolher: (documentos: DocumentoDoCadastro[]) => void;
	onFechar: () => void;
}

function semAcento(texto: string): string {
	return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "2)" antes de "10)". */
function porNome(a: string, b: string): number {
	return a.localeCompare(b, "pt-BR", { numeric: true });
}

function mesmaPasta(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((parte, i) => parte === b[i]);
}

function dentroDe(pasta: readonly string[], caminho: readonly string[]): boolean {
	return pasta.length > caminho.length && caminho.every((parte, i) => pasta[i] === parte);
}

function ehPdf(arquivo: ArquivoNaPasta): boolean {
	return arquivo.extensao.toLowerCase() === "pdf";
}

function paraDocumento(arquivo: ArquivoNaPasta): DocumentoDoCadastro {
	return { arquivoId: arquivo.arquivoId, nome: arquivo.nome, origem: null, pasta: arquivo.pasta.at(-1) ?? null };
}

function IconeDePasta() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
			<path
				d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
			/>
		</svg>
	);
}

/** A janela "Pastas do cliente" (docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md §3.5):
 *  as pastas do SharePoint do cliente, só para procurar e escolher — nada aqui muda arquivo ou pasta.
 *
 *  `<dialog>` nativo com `showModal()`, como o `ConfirmarLimpeza`: foco preso, `Esc` e fundo inerte
 *  sem ARIA escrita à mão. Mora em `page.tsx`, fora do `<form>` do `UploadForm`. */
export function JanelaDePastas({ aberto, clienteId, finalidade, arquivoInicial, onEscolher, onFechar }: Props) {
	const dialogo = useRef<HTMLDialogElement>(null);
	const [cliente, setCliente] = useState<string | undefined>(clienteId);
	const [clientes, setClientes] = useState<ClienteDaLista[] | null>(null);
	const [filtroDeCliente, setFiltroDeCliente] = useState("");
	const [dados, setDados] = useState<PastasDoCliente | null>(null);
	const [situacao, setSituacao] = useState<"pronta" | "carregando" | "falhou">("pronta");
	const [caminho, setCaminho] = useState<string[]>([]);
	const [busca, setBusca] = useState("");
	const [escolhidos, setEscolhidos] = useState<ArquivoNaPasta[]>([]);

	useEffect(() => {
		const el = dialogo.current;
		if (!el) return;
		if (aberto && !el.open) el.showModal();
		else if (!aberto && el.open) el.close();
	}, [aberto]);

	// Cada abertura começa limpa, no cliente do contrato achado.
	useEffect(() => {
		if (!aberto) return;
		setCliente(clienteId);
		setBusca("");
		setEscolhidos([]);
	}, [aberto, clienteId]);

	useEffect(() => {
		if (!aberto || !cliente) return;
		let valendo = true;
		setSituacao("carregando");
		setDados(null);
		void pastasDoCliente(cliente).then((resposta) => {
			if (!valendo) return;
			if (!resposta) {
				setSituacao("falhou");
				return;
			}
			setSituacao("pronta");
			setDados(resposta);
			const inicial = resposta.arquivos.find((arquivo) => arquivo.arquivoId === arquivoInicial);
			setCaminho(inicial ? inicial.pasta.slice(0, 1) : []);
		});
		return () => {
			valendo = false;
		};
	}, [aberto, cliente, arquivoInicial]);

	useEffect(() => {
		if (!aberto || cliente || clientes) return;
		void listarClientes().then(setClientes);
	}, [aberto, cliente, clientes]);

	function alternar(arquivo: ArquivoNaPasta) {
		if (finalidade === "contrato") {
			setEscolhidos([arquivo]);
			return;
		}
		setEscolhidos((atual) =>
			atual.some((a) => a.arquivoId === arquivo.arquivoId)
				? atual.filter((a) => a.arquivoId !== arquivo.arquivoId)
				: [...atual, arquivo],
		);
	}

	function confirmar() {
		if (escolhidos.length === 0) return;
		onEscolher(escolhidos.map(paraDocumento));
		onFechar();
	}

	const arquivos = dados?.arquivos ?? [];
	const termo = semAcento(busca.trim());
	const achados = termo
		? arquivos.filter((a) => semAcento(a.nome).includes(termo)).sort((a, b) => porNome(a.nome, b.nome))
		: [];
	const subpastas = [
		...new Set(arquivos.filter((a) => dentroDe(a.pasta, caminho)).map((a) => a.pasta[caminho.length])),
	].sort(porNome);
	const aqui = arquivos.filter((a) => mesmaPasta(a.pasta, caminho)).sort((a, b) => porNome(a.nome, b.nome));
	const nomeDoCliente = dados ? (dados.cliente.sigla ?? dados.cliente.nome) : "";
	const termoDeCliente = semAcento(filtroDeCliente.trim());
	const rotuloDoBotao =
		finalidade === "contrato"
			? "Usar este arquivo"
			: escolhidos.length === 1
				? "Adicionar 1 aditivo"
				: escolhidos.length > 1
					? `Adicionar ${escolhidos.length} aditivos`
					: "Adicionar aditivos";

	function linha(arquivo: ArquivoNaPasta, mostrarPasta: boolean) {
		const pdf = ehPdf(arquivo);
		const ordem = escolhidos.findIndex((a) => a.arquivoId === arquivo.arquivoId) + 1;
		return (
			<li
				key={`${arquivo.arquivoId}-${arquivo.pasta.join("/")}`}
				className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
			>
				<label
					className={`flex min-w-0 flex-1 items-center gap-2 ${
						pdf ? "cursor-pointer text-confere-navy-600" : "text-confere-navy-300"
					}`}
				>
					<input
						type={finalidade === "contrato" ? "radio" : "checkbox"}
						name="arquivo-da-pasta"
						checked={ordem > 0}
						disabled={!pdf}
						onChange={() => alternar(arquivo)}
					/>
					<span className="truncate">{arquivo.nome}</span>
					{finalidade === "aditivos" && ordem > 0 && (
						<span className="shrink-0 rounded bg-confere-teal-500 px-1.5 text-[11px] font-semibold text-white">
							{ordem}º
						</span>
					)}
					{!pdf && <span className="shrink-0">· só PDF</span>}
					{mostrarPasta && (
						<span className="truncate text-confere-navy-300">· {arquivo.pasta.join(" › ") || nomeDoCliente}</span>
					)}
				</label>
				<a
					href={`/api/arquivos/${arquivo.arquivoId}?modo=inline`}
					target="_blank"
					rel="noreferrer"
					className="shrink-0 font-semibold text-confere-teal-600 underline"
				>
					ver
				</a>
			</li>
		);
	}

	return (
		<dialog
			ref={dialogo}
			onClose={onFechar}
			aria-labelledby="pastas-titulo"
			className="w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-confere-line bg-white p-6 shadow-lg"
		>
			{/* Conteúdo só com a janela aberta: fechada, ela não deixa na página os nomes de
			    arquivo — que a tela também mostra nos campos. */}
			{aberto && (
			<>
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 id="pastas-titulo" className="text-lg font-semibold text-confere-navy-600">
						Pastas do cliente{nomeDoCliente ? ` · ${nomeDoCliente}` : ""}
					</h2>
					<p className="mt-1 text-xs text-confere-navy-300">
						{finalidade === "contrato"
							? "Escolha a proposta (PDF) para o campo Contrato."
							: "Escolha um ou mais aditivos (PDF), na ordem de aplicação."}
					</p>
				</div>
				{cliente && (
					<button
						type="button"
						onClick={() => {
							setCliente(undefined);
							setDados(null);
							setEscolhidos([]);
						}}
						className="shrink-0 text-xs font-semibold text-confere-teal-600 underline"
					>
						Outro cliente
					</button>
				)}
			</div>

			{!cliente ? (
				<div className="mt-4 text-sm">
					<input
						type="search"
						value={filtroDeCliente}
						onChange={(evento) => setFiltroDeCliente(evento.target.value)}
						placeholder="Buscar cliente por nome ou sigla"
						aria-label="Buscar cliente"
						className="h-9 w-full rounded border border-confere-line px-2 text-confere-navy-600"
					/>
					<ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
						{(clientes ?? [])
							.filter((c) => !termoDeCliente || semAcento(`${c.siglaLegado ?? ""} ${c.nome}`).includes(termoDeCliente))
							.map((c) => (
								<li key={c.id}>
									<button
										type="button"
										onClick={() => setCliente(c.id)}
										className="w-full rounded border border-confere-line px-3 py-1.5 text-left text-xs text-confere-navy-600 transition hover:border-confere-teal-400"
									>
										{c.siglaLegado ? `${c.siglaLegado} · ` : ""}
										{c.nome}
									</button>
								</li>
							))}
					</ul>
				</div>
			) : situacao === "carregando" ? (
				<p className="mt-4 text-sm text-confere-navy-600">Carregando as pastas…</p>
			) : situacao === "falhou" ? (
				<p className="mt-4 text-sm text-amber-900">Não foi possível abrir as pastas deste cliente.</p>
			) : (
				<div className="mt-4 text-sm">
					<input
						type="search"
						value={busca}
						onChange={(evento) => setBusca(evento.target.value)}
						placeholder="Buscar por nome em todas as pastas"
						aria-label="Buscar arquivo nas pastas"
						className="h-9 w-full rounded border border-confere-line px-2 text-confere-navy-600"
					/>
					{termo ? (
						<ul className="mt-3 max-h-80 divide-y divide-confere-line overflow-y-auto rounded border border-confere-line">
							{achados.map((arquivo) => linha(arquivo, true))}
							{achados.length === 0 && <li className="px-3 py-2 text-xs text-confere-navy-300">Nenhum arquivo com esse nome.</li>}
						</ul>
					) : (
						<>
							<nav aria-label="Caminho" className="mt-3 flex flex-wrap items-center gap-1 text-xs">
								<button
									type="button"
									onClick={() => setCaminho([])}
									className="font-semibold text-confere-teal-600 underline"
								>
									{nomeDoCliente}
								</button>
								{caminho.map((parte, i) => (
									<span key={`${i}-${parte}`} className="flex items-center gap-1">
										<span aria-hidden="true">›</span>
										{i === caminho.length - 1 ? (
											<span className="font-semibold text-confere-navy-600">{parte}</span>
										) : (
											<button
												type="button"
												onClick={() => setCaminho(caminho.slice(0, i + 1))}
												className="text-confere-teal-600 underline"
											>
												{parte}
											</button>
										)}
									</span>
								))}
							</nav>
							<ul className="mt-2 max-h-80 divide-y divide-confere-line overflow-y-auto rounded border border-confere-line">
								{subpastas.map((nome) => (
									<li key={`pasta-${nome}`}>
										<button
											type="button"
											onClick={() => setCaminho([...caminho, nome])}
											className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-confere-navy-600 hover:bg-confere-navy-50"
										>
											<span className="flex min-w-0 items-center gap-2">
												<IconeDePasta />
												<span className="truncate">{nome}</span>
											</span>
											<span aria-hidden="true">›</span>
										</button>
									</li>
								))}
								{aqui.map((arquivo) => linha(arquivo, false))}
								{subpastas.length === 0 && aqui.length === 0 && (
									<li className="px-3 py-2 text-xs text-confere-navy-300">Pasta vazia.</li>
								)}
							</ul>
						</>
					)}
				</div>
			)}

			<div className="mt-6 flex flex-wrap justify-end gap-3">
				<button
					type="button"
					onClick={onFechar}
					className="rounded-md border border-confere-line bg-white px-5 py-2.5 text-sm font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50"
				>
					Cancelar
				</button>
				<button
					type="button"
					onClick={confirmar}
					aria-disabled={escolhidos.length === 0}
					className={`rounded-md px-5 py-2.5 text-sm font-semibold transition ${
						escolhidos.length === 0
							? "cursor-not-allowed bg-confere-navy-100 text-confere-navy-600"
							: "bg-confere-teal-500 text-white hover:bg-confere-teal-600"
					}`}
				>
					{rotuloDoBotao}
				</button>
			</div>
			</>
			)}
		</dialog>
	);
}
```

- [x] **Step 5: Rodar e ver passar**

Run: `npx jest src/app/confere/components/JanelaDePastas.test.tsx src/app/confere/lib/cadastro.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/app/confere/lib/api.ts src/app/confere/lib/cadastro.ts src/app/confere/lib/cadastro.test.ts src/app/confere/components/JanelaDePastas.tsx src/app/confere/components/JanelaDePastas.test.tsx
git commit -m "feat(confere): janela Pastas do cliente — navegar e escolher proposta e aditivos"
```

---

### Task 3: Arrastar e soltar num cartão

**Files:**
- Create: `src/app/confere/components/useSoltarArquivos.ts`
- Test: `src/app/confere/components/useSoltarArquivos.test.tsx`

**Interfaces:**
- Produces: `useSoltarArquivos({ extensao, multiplos, desabilitado, onSoltar(arquivos: File[]), mensagemDeTipoErrado(arquivo: File): string })` → `{ arrastando: boolean; erro: string | null; limparErro(): void; alvo: { onDragEnter, onDragOver, onDragLeave, onDrop } }`.

- [x] **Step 1: Teste que falha** — `src/app/confere/components/useSoltarArquivos.test.tsx`

```tsx
import { fireEvent, render, screen } from "@testing-library/react";

import { useSoltarArquivos } from "./useSoltarArquivos";

function Alvo({
	onSoltar,
	multiplos = false,
	desabilitado = false,
}: { onSoltar: (arquivos: File[]) => void; multiplos?: boolean; desabilitado?: boolean }) {
	const soltar = useSoltarArquivos({
		extensao: ".xlsx",
		multiplos,
		desabilitado,
		onSoltar,
		mensagemDeTipoErrado: (arquivo) => `${arquivo.name} não é planilha`,
	});
	return (
		<div data-testid="alvo" {...soltar.alvo}>
			<span>cartão</span>
			{soltar.arrastando && <span>solte aqui</span>}
			{soltar.erro && <p>{soltar.erro}</p>}
		</div>
	);
}

const transferencia = (...arquivos: File[]) => ({ dataTransfer: { files: arquivos, types: ["Files"] } });
const planilha = new File(["x"], "levantamento.xlsx");
const pdf = new File(["x"], "proposta.pdf");

it("destaca enquanto o arquivo está em cima, inclusive passando por um filho", () => {
	render(<Alvo onSoltar={jest.fn()} />);
	const alvo = screen.getByTestId("alvo");
	fireEvent.dragEnter(alvo, transferencia(planilha));
	fireEvent.dragEnter(screen.getByText("cartão"), transferencia(planilha));
	fireEvent.dragLeave(alvo, transferencia(planilha));
	expect(screen.getByText("solte aqui")).toBeInTheDocument();
	fireEvent.dragLeave(screen.getByText("cartão"), transferencia(planilha));
	expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();
});

it("solta o tipo certo", () => {
	const onSoltar = jest.fn();
	render(<Alvo onSoltar={onSoltar} />);
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(planilha));
	expect(onSoltar).toHaveBeenCalledWith([planilha]);
});

it("tipo errado: avisa e não solta", () => {
	const onSoltar = jest.fn();
	render(<Alvo onSoltar={onSoltar} />);
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(pdf));
	expect(onSoltar).not.toHaveBeenCalled();
	expect(screen.getByText("proposta.pdf não é planilha")).toBeInTheDocument();
});

it("vários: solta os certos e avisa do resto; sem 'multiplos', só o primeiro", () => {
	const onSoltar = jest.fn();
	const { unmount } = render(<Alvo onSoltar={onSoltar} multiplos />);
	const outra = new File(["x"], "b.xlsx");
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(planilha, pdf, outra));
	expect(onSoltar).toHaveBeenCalledWith([planilha, outra]);
	expect(screen.getByText("proposta.pdf não é planilha")).toBeInTheDocument();
	unmount();

	const umSo = jest.fn();
	render(<Alvo onSoltar={umSo} />);
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(planilha, outra));
	expect(umSo).toHaveBeenCalledWith([planilha]);
});

it("desabilitado (gerando): não destaca nem solta", () => {
	const onSoltar = jest.fn();
	render(<Alvo onSoltar={onSoltar} desabilitado />);
	fireEvent.dragEnter(screen.getByTestId("alvo"), transferencia(planilha));
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(planilha));
	expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();
	expect(onSoltar).not.toHaveBeenCalled();
});

it("arrastar texto (não arquivo) não destaca", () => {
	render(<Alvo onSoltar={jest.fn()} />);
	fireEvent.dragEnter(screen.getByTestId("alvo"), { dataTransfer: { files: [], types: ["text/plain"] } });
	expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();
});
```

- [x] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere/components/useSoltarArquivos.test.tsx`
Expected: FAIL — `./useSoltarArquivos` não existe.

- [x] **Step 3: `src/app/confere/components/useSoltarArquivos.ts`**

```ts
"use client";

import { type DragEvent, useRef, useState } from "react";

interface Opcoes {
	/** ".pdf" ou ".xlsx" — o tipo é conferido pela extensão do nome, como o `accept` do campo. */
	extensao: string;
	multiplos: boolean;
	/** Durante a geração nada é aceito, como os campos, que ficam desabilitados. */
	desabilitado: boolean;
	onSoltar: (arquivos: File[]) => void;
	/** O aviso do cartão quando chega arquivo de outro tipo. */
	mensagemDeTipoErrado: (arquivo: File) => string;
}

/** Arrastar e soltar num cartão do formulário
 *  (docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md §3.4).
 *
 *  A profundidade conta os `dragenter`/`dragleave` dos filhos: passar o arquivo por cima do título
 *  do cartão dispara um `dragleave` no cartão, e sem a conta o destaque piscaria. */
export function useSoltarArquivos({ extensao, multiplos, desabilitado, onSoltar, mensagemDeTipoErrado }: Opcoes) {
	const [arrastando, setArrastando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const profundidade = useRef(0);

	function temArquivos(evento: DragEvent) {
		return Array.from(evento.dataTransfer?.types ?? []).includes("Files");
	}

	function doTipo(arquivo: File) {
		return arquivo.name.toLowerCase().endsWith(extensao);
	}

	return {
		arrastando,
		erro,
		limparErro: () => setErro(null),
		alvo: {
			onDragEnter(evento: DragEvent) {
				if (desabilitado || !temArquivos(evento)) return;
				evento.preventDefault();
				profundidade.current += 1;
				setArrastando(true);
			},
			onDragOver(evento: DragEvent) {
				if (desabilitado || !temArquivos(evento)) return;
				evento.preventDefault();
				if (evento.dataTransfer) evento.dataTransfer.dropEffect = "copy";
			},
			onDragLeave() {
				profundidade.current = Math.max(0, profundidade.current - 1);
				if (profundidade.current === 0) setArrastando(false);
			},
			onDrop(evento: DragEvent) {
				evento.preventDefault();
				profundidade.current = 0;
				setArrastando(false);
				if (desabilitado) return;
				const arquivos = Array.from(evento.dataTransfer?.files ?? []);
				const certos = arquivos.filter(doTipo);
				const errado = arquivos.find((arquivo) => !doTipo(arquivo));
				setErro(errado ? mensagemDeTipoErrado(errado) : null);
				if (certos.length > 0) onSoltar(multiplos ? certos : certos.slice(0, 1));
			},
		},
	};
}
```

- [x] **Step 4: Rodar e ver passar**

Run: `npx jest src/app/confere/components/useSoltarArquivos.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/confere/components/useSoltarArquivos.ts src/app/confere/components/useSoltarArquivos.test.tsx
git commit -m "feat(confere): arrastar e soltar por cartão, conferindo o tipo"
```

---

### Task 4: A tela — selo, textos, aditivos, janela e soltar

**Files:**
- Modify: `src/app/confere/components/UploadForm.tsx`, `src/app/confere/page.tsx`, `src/app/confere/page.test.tsx`
- Delete: `src/app/confere/components/MenuDeDocumentos.tsx`

**Interfaces:**
- Consumes: `JanelaDePastas` (Task 2), `useSoltarArquivos` (Task 3), `textoDoDocumento` (Task 2).
- Produces: `UploadForm` sem `alternativas`/`onTrocarContrato`/`onAdicionarAditivo`, com `buscandoContrato`, `onProcurarContrato`, `onProcurarAditivos`, `dica`.

- [x] **Step 1: Testes que falham** — em `src/app/confere/page.test.tsx`:

Acrescentar, junto das constantes:

```tsx
const PASTAS_PGM = {
	cliente: { id: "cl-pgm", nome: "Procuradoria Geral do Município", sigla: "PGM" },
	arquivos: [
		{ arquivoId: "pc", nome: "PC-PGM-240715-100 v7.0.pdf", extensao: "pdf", categoria: "PROPOSTA_COMERCIAL", pasta: ["TC 015-PGM-2024", "1) Contrato Inicial"] },
		{ arquivoId: "pa-04", nome: "PA-PGM-251015-159 v5.0.pdf", extensao: "pdf", categoria: "PROPOSTA_ADITIVO", pasta: ["TC 015-PGM-2024", "5) TA 04 - Prorrogação"] },
		{ arquivoId: "pa-05", nome: "PA-PGM-260304-715.pdf", extensao: "pdf", categoria: "PROPOSTA_ADITIVO", pasta: ["TC 015-PGM-2024", "6) TA 05"] },
	],
};
```

No `mockImplementation` do `beforeEach`, antes do `return Response.json({ detail: "falha simulada" } …)`:

```tsx
		if (url.endsWith("/api/confere/clientes/cl-pgm/pastas")) return Response.json(PASTAS_PGM);
```

Junto de `escolher`:

```tsx
function soltar(alvo: HTMLElement, ...arquivos: File[]) {
	const dataTransfer = { files: arquivos, types: ["Files"] };
	fireEvent.dragEnter(alvo, { dataTransfer });
	fireEvent.drop(alvo, { dataTransfer });
}
```

Trocar o teste "Trocar põe outra proposta do contrato no campo Contrato" por:

```tsx
it("Procurar nas pastas põe outra proposta do contrato no campo Contrato", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Procurar nas pastas do cliente" }));
	fireEvent.click(await screen.findByRole("button", { name: /1\) Contrato Inicial/ }));
	fireEvent.click(screen.getByRole("radio", { name: /PC-PGM-240715-100 v7\.0\.pdf/ }));
	fireEvent.click(screen.getByRole("button", { name: "Usar este arquivo" }));

	expect(screen.getByText("PC-PGM-240715-100 v7.0.pdf")).toBeInTheDocument();
	// É uma das propostas do histórico: leva a origem de sempre, não a pasta.
	expect(screen.getByText(/Do cadastro · contrato inicial, desde 01\/12\/2024/)).toBeInTheDocument();
});
```

e acrescentar:

```tsx
it("começo guiado: selo no levantamento e o que falta embaixo do botão", async () => {
	render(<ConferePage />);
	expect(screen.getByText("comece aqui")).toBeInTheDocument();
	expect(screen.getByText("vem do levantamento — ou escolha um arquivo")).toBeInTheDocument();
	expect(screen.getByText("Escolha o levantamento para começar.")).toBeInTheDocument();

	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");
	expect(screen.queryByText("comece aqui")).not.toBeInTheDocument();
	expect(screen.queryByText("Escolha o levantamento para começar.")).not.toBeInTheDocument();
});

it("aditivos vazios numa linha só", () => {
	render(<ConferePage />);
	expect(screen.getByText("Nenhum aditivo")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "+ Procurar nas pastas" })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "+ Enviar do computador" })).toBeInTheDocument();
});

it("soltar a planilha no cartão do levantamento busca o contrato", async () => {
	render(<ConferePage />);
	soltar(screen.getByText("Planilha de medição da competência, em XLSX"), new File(["x"], "PGM.xlsx"));
	expect(await screen.findByText("PA-PGM-251015-159 v5.0.pdf")).toBeInTheDocument();
});

it("PDF solto no levantamento avisa e não busca nada", () => {
	render(<ConferePage />);
	soltar(screen.getByText("Planilha de medição da competência, em XLSX"), new File(["%PDF"], "proposta.pdf"));
	expect(screen.getByText("O levantamento é a planilha .xlsx — proposta.pdf não é.")).toBeInTheDocument();
	expect(espiao.mock.calls.some(([url]) => String(url).endsWith("/levantamento"))).toBe(false);
});

it("PDFs soltos nos aditivos entram na lista, na ordem", () => {
	render(<ConferePage />);
	soltar(
		screen.getByText("Opcional. Um ou mais PDFs, aplicados na ordem da lista"),
		new File(["%PDF"], "a.pdf"),
		new File(["%PDF"], "b.pdf"),
	);
	expect(screen.getByText(/^1\. a\.pdf/)).toBeInTheDocument();
	expect(screen.getByText(/^2\. b\.pdf/)).toBeInTheDocument();
});
```

- [x] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere/page.test.tsx`
Expected: FAIL nos testes novos (selo, dica, aditivos, soltar, janela).

- [x] **Step 3: `UploadForm.tsx`**

1. Imports — trocar o bloco de imports por:

```tsx
import { useState } from "react";

import { textoDoDocumento } from "../lib/cadastro";
import { pareceLevantamento } from "../lib/documento";
import {
	type Achado,
	CAMPO_ADITIVOS,
	CAMPOS,
	type NomeDoCampo,
	nomeDaPeca,
	type Peca,
} from "../lib/types";
import { useSoltarArquivos } from "./useSoltarArquivos";
```

2. `Props` — remover `alternativas`, `onTrocarContrato` e `onAdicionarAditivo` (e os comentários deles) e acrescentar, depois de `faixa`:

```tsx
	/** A planilha está sendo lida e o contrato buscado no cadastro. */
	buscandoContrato: boolean;
	/** Abre a janela "Pastas do cliente" para o campo Contrato. */
	onProcurarContrato: () => void;
	/** Abre a janela "Pastas do cliente" para os aditivos. */
	onProcurarAditivos: () => void;
	/** O que falta para gerar, embaixo do botão; `null` quando nada falta. */
	dica: string | null;
```

3. Desestruturação — tirar `alternativas`, `onTrocarContrato`, `onAdicionarAditivo`; pôr `buscandoContrato`, `onProcurarContrato`, `onProcurarAditivos`, `dica`.

4. Trocar o cálculo de `naLista`/`paraAdicionar` (e o comentário "+ Adicionar do cadastro…") por:

```tsx
	// Arrastar e soltar por cartão (desenho de 25/09/2026 §3.4): cada um aceita o
	// seu tipo, e o soltar faz o mesmo que escolher pelo seletor.
	const soltarContrato = useSoltarArquivos({
		extensao: ".pdf",
		multiplos: false,
		desabilitado: processando,
		onSoltar: ([arquivo]) => onSelecionar("contrato", arquivo),
		mensagemDeTipoErrado: (arquivo) => `O contrato é a proposta em PDF — ${arquivo.name} não é PDF.`,
	});
	const soltarLevantamento = useSoltarArquivos({
		extensao: ".xlsx",
		multiplos: false,
		desabilitado: processando,
		onSoltar: ([arquivo]) => onSelecionar("levantamento", arquivo),
		mensagemDeTipoErrado: (arquivo) => `O levantamento é a planilha .xlsx — ${arquivo.name} não é.`,
	});
	const soltarAditivos = useSoltarArquivos({
		extensao: ".pdf",
		multiplos: true,
		desabilitado: processando,
		onSoltar: onSelecionarAditivos,
		mensagemDeTipoErrado: (arquivo) => `Aditivos são PDFs — ${arquivo.name} ficou de fora.`,
	});
	const soltarNoCampo = { contrato: soltarContrato, levantamento: soltarLevantamento };
	const convite = { contrato: "Solte o PDF aqui", levantamento: "Solte a planilha aqui" };
```

5. O `CAMPOS.map` inteiro vira:

```tsx
				{CAMPOS.map((campo, indice) => {
					const escolhido =
						campo.nome === "contrato" ? (contrato ? nomeDaPeca(contrato) : undefined) : levantamento?.name;
					const soltar = soltarNoCampo[campo.nome];
					const buscando = campo.nome === "contrato" && !contrato && buscandoContrato;
					// O que o campo vazio diz (desenho de 25/09/2026 §3.1): o Contrato vem
					// do levantamento; o Levantamento é por onde começa.
					const vazio =
						campo.nome === "contrato"
							? buscando
								? "buscando no cadastro…"
								: "vem do levantamento — ou escolha um arquivo"
							: "escolher arquivo… ou arraste para cá";
					return (
						// Borda sólida no repouso: tracejado é a convenção de área de
						// arraste, e só aparece quando arrastar faz alguma coisa — com um
						// arquivo por cima do cartão (`R-ACE-17`, revista em 25/09/2026:
						// soltar passou a funcionar).
						//
						// `has-[:focus-visible]` e não `focus-within`: clicar o rótulo
						// foca o input, e o `focus-within` faria o anel aparecer para
						// quem usa mouse e não precisa dele.
						//
						// O cartão é o `<div>`, e o `<label>` fica dentro dele: o que é do
						// cadastro (Ver PDF, Procurar nas pastas) tem botões e mora **fora**
						// do rótulo — dentro, clicar num deles abriria o seletor junto,
						// pela mesma razão do aviso da `R-DOC-08`.
						<div
							// A chave composta é o que remonta o campo na limpeza
							// (`R-LMP-04`). Só o nome não bastaria: o React reaproveitaria
							// o mesmo elemento e o `input.value` sobreviveria — a tela
							// diria vazio com o formulário ainda carregando o arquivo. O
							// Contrato tem também a sua chave: o cadastro volta a ocupá-lo
							// sem remontar o levantamento.
							key={`${chave}-${campo.nome}-${campo.nome === "contrato" ? chaveContrato : 0}`}
							{...soltar.alvo}
							className="relative flex flex-col gap-2 rounded-md border border-confere-teal-100 bg-confere-teal-50/40 p-4 transition hover:border-confere-teal-400 has-[:focus-visible]:border-confere-teal-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-confere-teal-500 has-[:focus-visible]:ring-offset-2"
						>
							<label className="flex cursor-pointer flex-col gap-2">
								<span className="flex items-center gap-2 text-sm font-semibold text-confere-navy-600">
									{campo.rotulo}
									{/* Por onde começar. Fica fora do nome acessível do campo,
									    que é o `aria-label` do input. */}
									{campo.nome === "levantamento" && !levantamento && (
										<span className="rounded bg-confere-teal-500 px-2 py-0.5 text-[11px] font-semibold text-white">
											comece aqui
										</span>
									)}
								</span>
								<span id={`${campo.nome}-descricao`} className="text-xs text-confere-navy-300">
									{campo.descricao}
								</span>
								<input
									type="file"
									// `R-LMP-09` — destino do foco quando a limpeza é confirmada.
									// A ref é reatribuída pela remontagem: aponta sempre para o
									// elemento **novo**, que é o que impede o foco de cair no
									// `<body>`.
									ref={indice === 0 ? refPrimeiroCampo : undefined}
									accept={campo.aceita}
									// Os inputs seguem com `disabled` durante o processamento, e
									// isso não fere `R-ACE-06`: a regra proíbe desabilitar
									// controle **que está com foco**, e o foco está no botão.
									disabled={processando}
									className="sr-only"
									// Nome explícito. Sem ele o nome acessível é todo o texto do
									// rótulo — título, descrição e o arquivo escolhido,
									// concatenados e mudando a cada seleção (`R-ACE-11`).
									aria-label={campo.rotulo}
									aria-describedby={`${campo.nome}-descricao ${campo.nome}-estado`}
									onChange={(evento) => {
										soltar.limparErro();
										onSelecionar(campo.nome, evento.target.files?.[0]);
									}}
								/>
								<span
									id={`${campo.nome}-estado`}
									className={`mt-1 flex items-center gap-2 rounded border px-2 py-1 text-xs ${
										escolhido
											? "border-confere-teal-400 bg-white text-confere-teal-600"
											: "border-confere-line bg-white text-confere-navy-300"
									}`}
								>
									{buscando && <Giro />}
									<span className="truncate">{escolhido ?? vazio}</span>
								</span>
							</label>
							{campo.nome === "contrato" && (
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
									{contratoDoCadastro && (
										<>
											<span className="text-confere-teal-600">
												Do cadastro · {textoDoDocumento(contratoDoCadastro)}
											</span>
											<a
												href={`/api/arquivos/${contratoDoCadastro.arquivoId}?modo=inline`}
												target="_blank"
												rel="noreferrer"
												className="font-semibold text-confere-teal-600 underline"
											>
												Ver PDF
											</a>
										</>
									)}
									<button
										type="button"
										onClick={onProcurarContrato}
										disabled={processando}
										className="font-semibold text-confere-teal-600 underline"
									>
										Procurar nas pastas do cliente
									</button>
								</div>
							)}
							{soltar.erro && (
								<p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
									{soltar.erro}
								</p>
							)}
							{soltar.arrastando && (
								<div
									aria-hidden="true"
									className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-confere-teal-500 bg-confere-teal-50/95 text-sm font-semibold text-confere-teal-600"
								>
									{convite[campo.nome]}
								</div>
							)}
						</div>
					);
				})}
```

6. O cartão de aditivos: no `<div key={…aditivos…}>` acrescentar `{...soltarAditivos.alvo}` e `relative` no começo do `className`; no `<input>` o `onChange` vira `(evento) => { soltarAditivos.limparErro(); onSelecionarAditivos(Array.from(evento.target.files ?? [])); }`; **tirar** do `<label>` o `<span id="aditivos-estado">` do estado vazio; no item da lista, `textoDaOrigem(peca.documento.origem)` vira `textoDoDocumento(peca.documento)`; e a linha de ações (antes do `</div>` do cartão) vira:

```tsx
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
					{aditivos.length === 0 && (
						<span id={`${CAMPO_ADITIVOS.nome}-estado`} className="text-confere-navy-300">
							{semAditivos}
						</span>
					)}
					<button
						type="button"
						onClick={onProcurarAditivos}
						disabled={processando}
						className="font-semibold text-confere-teal-600 underline"
					>
						+ Procurar nas pastas
					</button>
					<button
						type="button"
						onClick={() => refAditivos.current?.click()}
						disabled={processando}
						className="font-semibold text-confere-teal-600 underline"
					>
						+ Enviar do computador
					</button>
				</div>
				{soltarAditivos.erro && (
					<p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
						{soltarAditivos.erro}
					</p>
				)}
				{soltarAditivos.arrastando && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-confere-teal-500 bg-confere-teal-50/95 text-sm font-semibold text-confere-teal-600"
					>
						Solte os PDFs aqui
					</div>
				)}
```

7. Botão de gerar: `aria-describedby={dica ? "upload-pendente" : undefined}`.

8. A frase fixa do fim vira:

```tsx
			{dica && (
				<p id="upload-pendente" className="mt-3 text-xs text-confere-navy-300">
					{dica}
				</p>
			)}
```

- [x] **Step 4: `page.tsx`**

1. Import: `import { JanelaDePastas } from "./components/JanelaDePastas";`
2. Estado, junto dos outros:

```tsx
	// A janela "Pastas do cliente" e para qual campo ela escolhe.
	const [janela, setJanela] = useState<{ aberto: boolean; finalidade: "contrato" | "aditivos" }>({
		aberto: false,
		finalidade: "contrato",
	});
```

3. Trava de soltar fora dos cartões, junto dos outros `useEffect`:

```tsx
	// Arquivo solto fora dos cartões não pode abrir no navegador — a pessoa
	// perderia tudo o que já preencheu. Os cartões tratam o que cai neles;
	// aqui só o resto (desenho de 25/09/2026 §3.4).
	useEffect(() => {
		function segurar(evento: DragEvent) {
			if (Array.from(evento.dataTransfer?.types ?? []).includes("Files")) evento.preventDefault();
		}
		window.addEventListener("dragover", segurar);
		window.addEventListener("drop", segurar);
		return () => {
			window.removeEventListener("dragover", segurar);
			window.removeEventListener("drop", segurar);
		};
	}, []);
```

4. Trocar a função `adicionarAditivo` por:

```tsx
	/** O que a pessoa escolheu na janela "Pastas do cliente". Quando o arquivo é
	 *  uma das propostas do histórico do contrato, leva a origem de sempre ("TA
	 *  02, renovação desde…"); senão, a pasta de onde veio. */
	function aoEscolherDasPastas(escolhidos: DocumentoDoCadastro[]) {
		const comOrigem = escolhidos.map(
			(documento) =>
				documentos?.alternativas.find((alternativa) => alternativa.arquivoId === documento.arquivoId) ??
				documento,
		);
		if (janela.finalidade === "contrato") {
			if (comOrigem[0]) trocarContrato(comOrigem[0]);
			return;
		}
		entradaMudou();
		setAditivos((atual) => [
			...atual,
			...comOrigem.map((documento): Peca => ({ tipo: "cadastro", documento })),
		]);
	}
```

5. Antes do `return`, depois de `podeLimpar`:

```tsx
	// O que falta para gerar (desenho de 25/09/2026 §3.2) — some quando nada falta.
	const dica = !arquivos.levantamento
		? contrato
			? "Falta o levantamento."
			: "Escolha o levantamento para começar."
		: !contrato
			? identificacao.situacao === "lendo"
				? "Buscando o contrato no cadastro…"
				: "Falta o contrato: procure nas pastas do cliente ou envie do computador."
			: null;
```

6. Subtítulo:

```tsx
				<p className="mt-2 mb-8 text-sm text-confere-navy-600">
					Escolha o levantamento — o contrato e os aditivos vêm do cadastro do cliente — e gere o
					relatório de comprovação.
				</p>
```

7. `UploadForm`: tirar `alternativas`, `onTrocarContrato`, `onAdicionarAditivo`; `semAditivos` vira `documentos ? "Nenhum aditivo depois da proposta-base" : "Nenhum aditivo"`; acrescentar:

```tsx
					buscandoContrato={identificacao.situacao === "lendo"}
					onProcurarContrato={() => setJanela({ aberto: true, finalidade: "contrato" })}
					onProcurarAditivos={() => setJanela({ aberto: true, finalidade: "aditivos" })}
					dica={dica}
```

8. Depois do `<ConfirmarLimpeza … />`:

```tsx
			{/* Fora do `<form>` do `UploadForm`, como os outros diálogos. */}
			<JanelaDePastas
				aberto={janela.aberto}
				clienteId={documentos?.contrato.clienteId}
				finalidade={janela.finalidade}
				arquivoInicial={contratoDoCadastro?.arquivoId ?? documentos?.base?.arquivoId}
				onEscolher={aoEscolherDasPastas}
				onFechar={() => setJanela((atual) => ({ ...atual, aberto: false }))}
			/>
```

9. Apagar `src/app/confere/components/MenuDeDocumentos.tsx` (sem uso).

- [x] **Step 5: Rodar e ver passar**

Run: `npx jest src/app/confere`
Expected: PASS (página, janela, soltar, faixa, lib).

- [x] **Step 6: Tipos e lint**

Run: `npx tsc --noEmit` e `npx eslint src/app/confere src/lib/confere src/app/api/confere`
Expected: sem erros (os 2 avisos antigos de `_docx`/`_xlsx` continuam).

- [x] **Step 7: Commit**

```bash
git add src/app/confere/components/UploadForm.tsx src/app/confere/page.tsx src/app/confere/page.test.tsx
git rm src/app/confere/components/MenuDeDocumentos.tsx
git commit -m "feat(confere): começo guiado, textos do que falta, aditivos em uma linha, janela das pastas e soltar"
```

---

### Task 5: Verificação e documentação

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md`, este plano

- [x] **Step 1: Suíte inteira**

Run: `npx jest`
Expected: tudo passando (209+ suítes; as puladas continuam puladas).

- [x] **Step 2: Documentação**
  - `CLAUDE.md`, seção "Integração do Confere", no item "Área solta no menu…": acrescentar que a janela "Pastas do cliente" (`GET /api/confere/clientes/[clienteId]/pastas`, `src/lib/confere/pastas.ts`) navega nas pastas do SharePoint para escolher proposta e aditivos, só lendo `ArquivoSharepoint.caminho`, e que os cartões aceitam arrastar e soltar; apontar o design `2026-09-25-confere-ux-pastas-design.md`.
  - Design: status "implementado".
  - Este plano: marcar os passos.

- [ ] **Step 3: No navegador** — `localhost:3000/confere` (o servidor de desenvolvimento recarrega sozinho; não há migração): selo "comece aqui"; soltar o levantamento do CGM no cartão; "Procurar nas pastas do cliente" abre em "TC 16-CGM-2024 - …" e escolher a PC do "1) … Contrato Inicial" troca o Contrato.

- [x] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md docs/superpowers/plans/2026-09-25-confere-ux-pastas.md
git commit -m "docs(confere): ajustes de UX e janela das pastas — implementado"
```
