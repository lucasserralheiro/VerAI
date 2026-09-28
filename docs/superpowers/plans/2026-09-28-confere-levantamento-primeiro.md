# ConfereAI — levantamento primeiro, modal da busca e janela de pastas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tela do ConfereAI começa só com o levantamento; a busca do contrato pela planilha acontece num modal (fecha quando acha, pergunta quando não acha); os documentos viram linhas de conferência; a janela "Pastas do cliente" ganha Voltar, linha clicável, duplo clique, "em uso" e rodapé.

**Architecture:** Só apresentação — a rota `/api/confere/levantamento` e a regra de escolha da proposta/aditivos não mudam. `page.tsx` passa a ter uma fase derivada (`inicio`/`manual`/`conferir`) e o estado do modal. Dois componentes novos (`EntradaDoLevantamento`, `BuscaDoContratoModal`) e um utilitário (`Giro`); `UploadForm`, `FaixaDoContrato` e `JanelaDePastas` são reescritos por dentro.

**Tech Stack:** Next.js 15, React 19, Tailwind 4 (tokens `confere-*`), Jest 30 + Testing Library.

**Desenho:** `docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md`.

## Andamento

- **28/09/2026 — Tasks 1–5 concluídas**: `f0f0cc8` (modal), `904f5e2` (janela de pastas),
  `607d3a2` (linhas de conferência), `e47880e` (fases da tela), `3352351` (ajustes vistos na tela).
  Tela do ConfereAI com 75 testes (7 suítes); `tsc` e `eslint src/app/confere` limpos.
- **Na tela** (dev, com `arquivos-teste-confere/conjunto-B-piloto-sem-aditivo/3-levantamento.xlsx`):
  início só com o levantamento; modal "Buscando os documentos do contrato" abriu e fechou sozinho
  achando o TC 52/SMIT/2024 (proposta do TA 02); janela de pastas com esqueleto, contagem, "em uso"
  na pasta do TA 02, Voltar, seleção pelo nome com rodapé e duplo clique; 375 px sem rolagem
  horizontal; Limpar volta ao início com o foco em "Escolher planilha"; console sem erro.
- Ajustes da tela (`3352351`): caminho das pastas numa linha (trechos longos cortados, nome no
  `title`); esqueleto com a altura da janela carregada; linhas em duas colunas abaixo de 1280 px.
- **Não visto na tela** (coberto só por teste): as perguntas do modal (não achado, empate, sem
  número, ilegível, falha) — não havia planilha à mão que caísse nelas.
- `CLAUDE.md` editado (item "Tela em fases") e **não commitado**: o arquivo tem mudanças pendentes de
  outra sessão.

## Global Constraints

- Sem migração, sem rota nova, sem mudança em `src/lib/confere/**` nem em `src/app/api/**`.
- Paleta só `confere-*` (e `amber-*` para avisos, como já é); nada da paleta institucional `navy`/`orange`.
- Estilo de `src/app/confere/**`: tabs, aspas duplas, ponto e vírgula; comentários em português explicando o porquê.
- Modais: `<dialog>` nativo + `showModal()`, montados em `page.tsx`, fora do `<form>` do `UploadForm`.
- Botão que pode ficar inválido com foco usa `aria-disabled` + guarda no handler (`R-ACE-06`), não `disabled`.
- Todo `<button>` dentro de `<form>` tem `type="button"`, exceto *Gerar relatório* (`R-LMP-03`).
- Testes: `npx jest src/app/confere` (rodar a pasta inteira: com um arquivo só de jsdom o Jest não encerra — ver plano de 25/09).
- Commits só com os arquivos da task (nunca `git add -A`; o repositório tem mudanças do usuário em outros arquivos, inclusive `CLAUDE.md`); sem push; mensagem termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Linha de base antes de começar: `npx jest src/app/confere` → 6 suítes, 41 testes passando.

---

### Task 1: `Giro` à parte e o modal da busca do contrato

**Files:**
- Create: `src/app/confere/components/Giro.tsx`
- Create: `src/app/confere/components/BuscaDoContratoModal.tsx`
- Modify: `src/app/confere/components/UploadForm.tsx` (tirar o `Giro` local, importar o novo)
- Test: `src/app/confere/components/BuscaDoContratoModal.test.tsx`

**Interfaces:**
- Consumes: `BuscaDeContrato`, `ListaDeContratos` (`./BuscaDeContrato`), `Identificacao` (`../lib/types`), `ResumoDoContrato` (`@/lib/confere/tipos-cadastro`).
- Produces:
  - `Giro({ className?: string })` — SVG girando, `aria-hidden`.
  - `TEMPO_MINIMO_DA_BUSCA = 600` (ms).
  - `BuscaDoContratoModal(props)` com `props: { aberto: boolean; motivo: "planilha" | "trocar"; nomeDaPlanilha?: string; identificacao: Identificacao; carregandoContrato: boolean; onEscolherContrato(contratoId: string): void; onCancelar(): void; onEnviarDoComputador(): void; onTrocarPlanilha(arquivo: File): void }`.
  - Comportamento que a Task 4 usa: o modal **fecha sozinho** (quando `aberto` vira `false`) só depois de `TEMPO_MINIMO_DA_BUSCA` desde que começou a buscar; ações da pessoa (Cancelar sem `carregandoContrato`, Enviar do computador, `Esc`) fecham **na hora** e depois chamam o callback. Cancelar com `carregandoContrato` chama `onCancelar` e **não** fecha.

- [ ] **Step 1: Escrever o teste que falha**

`src/app/confere/components/BuscaDoContratoModal.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";

import type { Identificacao } from "../lib/types";
import { BuscaDoContratoModal, TEMPO_MINIMO_DA_BUSCA } from "./BuscaDoContratoModal";

const leitura = { referencia: "TC 99/SMIT/2026", competencia: { ano: 2026, mes: 7 } };
const sugestao = {
	id: "ct-52",
	clienteId: "cl",
	clienteNome: "SMIT",
	clienteSigla: "SMIT",
	numeroTermo: "TC 52/SMIT/2024",
	descricao: "Sustentação",
	vigenciaFim: null,
	ativo: true,
};

type Props = Parameters<typeof BuscaDoContratoModal>[0];

function props(mais: Partial<Props> = {}): Props {
	return {
		aberto: true,
		motivo: "planilha",
		nomeDaPlanilha: "SMIT_Levantamento.xlsx",
		identificacao: { situacao: "lendo" },
		carregandoContrato: false,
		onEscolherContrato: jest.fn(),
		onCancelar: jest.fn(),
		onEnviarDoComputador: jest.fn(),
		onTrocarPlanilha: jest.fn(),
		...mais,
	};
}

function dialogo(): HTMLDialogElement {
	return document.querySelector("dialog") as HTMLDialogElement;
}

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

it("buscando: diz o que está fazendo e de qual planilha", () => {
	render(<BuscaDoContratoModal {...props()} />);
	expect(screen.getByRole("dialog", { name: "Buscando os documentos do contrato" })).toBeInTheDocument();
	expect(screen.getByText("SMIT_Levantamento.xlsx")).toBeInTheDocument();
	expect(screen.getByRole("status")).toHaveTextContent(
		"Lendo a planilha e procurando o contrato, a proposta e os aditivos da competência…",
	);
});

it("fechado, não deixa texto na página", () => {
	render(<BuscaDoContratoModal {...props({ aberto: false })} />);
	expect(screen.queryByText(/Buscando/)).not.toBeInTheDocument();
});

it("resposta rápida: fica aberto até o tempo mínimo — o fundo não pisca", () => {
	jest.useFakeTimers();
	const { rerender } = render(<BuscaDoContratoModal {...props()} />);
	rerender(<BuscaDoContratoModal {...props({ aberto: false })} />);
	expect(dialogo().open).toBe(true);
	expect(screen.getByRole("status")).toHaveTextContent(/Lendo a planilha/);
	act(() => jest.advanceTimersByTime(TEMPO_MINIMO_DA_BUSCA));
	expect(dialogo().open).toBe(false);
});

it("passado o tempo mínimo, fecha na hora", () => {
	jest.useFakeTimers();
	const { rerender } = render(<BuscaDoContratoModal {...props()} />);
	act(() => jest.advanceTimersByTime(TEMPO_MINIMO_DA_BUSCA + 100));
	rerender(<BuscaDoContratoModal {...props({ aberto: false })} />);
	expect(dialogo().open).toBe(false);
});

it("Cancelar fecha na hora e avisa", () => {
	const p = props();
	render(<BuscaDoContratoModal {...p} />);
	fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
	expect(p.onCancelar).toHaveBeenCalledTimes(1);
	expect(dialogo().open).toBe(false);
});

it("Cancelar enquanto chegam os documentos do contrato escolhido: avisa e o modal fica", () => {
	const p = props({ carregandoContrato: true });
	render(<BuscaDoContratoModal {...p} />);
	expect(screen.getByRole("status")).toHaveTextContent("Buscando a proposta e os aditivos do contrato…");
	fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
	expect(p.onCancelar).toHaveBeenCalledTimes(1);
	expect(dialogo().open).toBe(true);
});

it.each<[string, Identificacao, string]>([
	["não encontrado", { situacao: "nao-encontrado", leitura, sugestoes: [sugestao] }, "O contrato TC 99/SMIT/2026 não está no cadastro"],
	["empate", { situacao: "ambiguo", leitura, candidatos: [sugestao] }, "Mais de um contrato com o número TC 99/SMIT/2026"],
	["sem número", { situacao: "sem-referencia", leitura }, "Não achamos o número do contrato neste levantamento"],
	["ilegível", { situacao: "ilegivel", mensagem: "A planilha não abriu" }, "A planilha não abriu"],
	["falha", { situacao: "falhou" }, "Não foi possível buscar o contrato agora"],
])("pergunta (%s): título, enviar do computador e trocar planilha", (_caso, identificacao, titulo) => {
	render(<BuscaDoContratoModal {...props({ identificacao })} />);
	expect(screen.getByRole("dialog", { name: titulo })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Enviar o contrato do computador" })).toBeInTheDocument();
	expect(screen.getByLabelText("Trocar planilha")).toBeInTheDocument();
});

it("empate não tem busca livre; não encontrado tem", () => {
	const { rerender } = render(
		<BuscaDoContratoModal {...props({ identificacao: { situacao: "ambiguo", leitura, candidatos: [sugestao] } })} />,
	);
	expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
	rerender(
		<BuscaDoContratoModal {...props({ identificacao: { situacao: "nao-encontrado", leitura, sugestoes: [] } })} />,
	);
	expect(screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" })).toBeInTheDocument();
});

it("escolher a sugestão chama o contrato", () => {
	const p = props({ identificacao: { situacao: "nao-encontrado", leitura, sugestoes: [sugestao] } });
	render(<BuscaDoContratoModal {...p} />);
	fireEvent.click(screen.getByRole("button", { name: /TC 52\/SMIT\/2024/ }));
	expect(p.onEscolherContrato).toHaveBeenCalledWith("ct-52");
});

it("Enviar o contrato do computador fecha na hora e avisa", () => {
	const p = props({ identificacao: { situacao: "sem-referencia", leitura } });
	render(<BuscaDoContratoModal {...p} />);
	fireEvent.click(screen.getByRole("button", { name: "Enviar o contrato do computador" }));
	expect(p.onEnviarDoComputador).toHaveBeenCalledTimes(1);
	expect(dialogo().open).toBe(false);
});

it("Esc na pergunta faz o mesmo que Enviar do computador: a planilha fica", () => {
	const p = props({ identificacao: { situacao: "sem-referencia", leitura } });
	render(<BuscaDoContratoModal {...p} />);
	fireEvent(dialogo(), new Event("cancel", { cancelable: true }));
	expect(p.onEnviarDoComputador).toHaveBeenCalledTimes(1);
	expect(p.onCancelar).not.toHaveBeenCalled();
	expect(dialogo().open).toBe(false);
});

it("Esc enquanto busca é Cancelar", () => {
	const p = props();
	render(<BuscaDoContratoModal {...p} />);
	fireEvent(dialogo(), new Event("cancel", { cancelable: true }));
	expect(p.onCancelar).toHaveBeenCalledTimes(1);
});

it("Trocar planilha entrega o arquivo novo", () => {
	const p = props({ identificacao: { situacao: "falhou" } });
	render(<BuscaDoContratoModal {...p} />);
	const arquivo = new File(["x"], "outra.xlsx");
	fireEvent.change(screen.getByLabelText("Trocar planilha"), { target: { files: [arquivo] } });
	expect(p.onTrocarPlanilha).toHaveBeenCalledWith(arquivo);
});

it("trocar contrato: só a busca, e Cancelar só fecha", () => {
	const p = props({ motivo: "trocar", identificacao: { situacao: "ociosa" } });
	render(<BuscaDoContratoModal {...p} />);
	expect(screen.getByRole("dialog", { name: "Escolha outro contrato" })).toBeInTheDocument();
	expect(screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
	expect(p.onCancelar).toHaveBeenCalledTimes(1);
	expect(dialogo().open).toBe(false);
});

it("Enter na busca busca — e cancela o padrão", () => {
	const espiao = jest.spyOn(global, "fetch").mockResolvedValue(Response.json([]));
	render(<BuscaDoContratoModal {...props({ identificacao: { situacao: "sem-referencia", leitura } })} />);
	const busca = screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" });
	fireEvent.change(busca, { target: { value: "cgm" } });
	// `fireEvent` devolve `false` quando o handler chamou `preventDefault()`.
	expect(fireEvent.keyDown(busca, { key: "Enter" })).toBe(false);
	expect(String(espiao.mock.calls[0][0])).toContain("/api/confere/contratos?busca=cgm");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere`
Expected: FAIL em `BuscaDoContratoModal.test.tsx` com "Cannot find module './BuscaDoContratoModal'"; as outras 6 suítes continuam passando.

- [ ] **Step 3: Criar `Giro.tsx`**

`src/app/confere/components/Giro.tsx`:

```tsx
/** Indicador de atividade. `motion-reduce:animate-none` porque ele gira por até
 *  um minuto: a WCAG 2.2.2 é nível A e trata de movimento automático acima de
 *  5 s. Indicador de carregamento costuma ser aceito como essencial, mas a
 *  classe custa nada e encerra a dúvida — quem pediu menos movimento recebe o
 *  texto sem o giro. */
export function Giro({ className = "h-4 w-4" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className={`${className} shrink-0 animate-spin motion-reduce:animate-none`}
		>
			<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
			<path
				d="M21 12a9 9 0 0 0-9-9"
				fill="none"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
			/>
		</svg>
	);
}
```

Em `UploadForm.tsx`: apagar a função `Giro` local (e o comentário dela, linhas 77–107) e acrescentar `import { Giro } from "./Giro";` junto dos outros imports de `./`. O uso `{processando && <Giro />}` continua igual.

- [ ] **Step 4: Criar `BuscaDoContratoModal.tsx`**

`src/app/confere/components/BuscaDoContratoModal.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import type { ResumoDoContrato } from "@/lib/confere/tipos-cadastro";
import type { Identificacao } from "../lib/types";
import { BuscaDeContrato, ListaDeContratos } from "./BuscaDeContrato";
import { Giro } from "./Giro";

/** O modal não fecha sozinho antes disto: resposta rápida não pisca o fundo escuro. */
export const TEMPO_MINIMO_DA_BUSCA = 600;

interface Props {
	aberto: boolean;
	/** `planilha`: a busca que a planilha dispara — pergunta quando não acha.
	 *  `trocar`: "trocar contrato", com o contrato já achado — só a busca. */
	motivo: "planilha" | "trocar";
	nomeDaPlanilha?: string;
	identificacao: Identificacao;
	/** Os documentos do contrato escolhido à mão estão chegando. */
	carregandoContrato: boolean;
	onEscolherContrato: (contratoId: string) => void;
	/** Cancelar (e `Esc`) enquanto busca, e no `trocar`. */
	onCancelar: () => void;
	/** Da pergunta: fecha e vai para o preenchimento à mão, com a planilha. */
	onEnviarDoComputador: () => void;
	onTrocarPlanilha: (arquivo: File) => void;
}

type Conteudo =
	| { tipo: "buscando"; texto: string }
	| {
			tipo: "pergunta";
			titulo: string;
			texto: string;
			contratos: readonly ResumoDoContrato[];
			comBusca: boolean;
	  }
	| { tipo: "trocar" };

const LENDO_A_PLANILHA: Conteudo = {
	tipo: "buscando",
	texto: "Lendo a planilha e procurando o contrato, a proposta e os aditivos da competência…",
};

const BOTAO_SECUNDARIO =
	"rounded-md border border-confere-line bg-white px-5 py-2.5 text-sm font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50";
const BOTAO_PRIMARIO =
	"rounded-md bg-confere-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-confere-teal-600";

/** O que o modal mostra. As perguntas são as caixas âmbar que a `FaixaDoContrato`
 *  mostrava no formulário, com os mesmos textos (desenho de 28/09/2026 §3.2). */
function conteudoDe(
	motivo: Props["motivo"],
	identificacao: Identificacao,
	carregandoContrato: boolean,
): Conteudo {
	if (carregandoContrato) {
		return { tipo: "buscando", texto: "Buscando a proposta e os aditivos do contrato…" };
	}
	if (motivo === "trocar") return { tipo: "trocar" };
	switch (identificacao.situacao) {
		case "ambiguo":
			return {
				tipo: "pergunta",
				titulo: `Mais de um contrato com o número ${identificacao.leitura.referencia}`,
				texto: "Escolha qual:",
				contratos: identificacao.candidatos,
				comBusca: false,
			};
		case "nao-encontrado":
			return {
				tipo: "pergunta",
				titulo: `O contrato ${identificacao.leitura.referencia} não está no cadastro`,
				texto: "Escolha um dos contratos sugeridos, busque outro, ou envie a proposta do computador.",
				contratos: identificacao.sugestoes,
				comBusca: true,
			};
		case "sem-referencia":
			return {
				tipo: "pergunta",
				titulo: "Não achamos o número do contrato neste levantamento",
				texto: "Busque o contrato ou envie a proposta do computador.",
				contratos: [],
				comBusca: true,
			};
		case "ilegivel":
			return {
				tipo: "pergunta",
				titulo: identificacao.mensagem,
				texto: "Escolha o contrato ou envie os arquivos do computador.",
				contratos: [],
				comBusca: true,
			};
		case "falhou":
			return {
				tipo: "pergunta",
				titulo: "Não foi possível buscar o contrato agora",
				texto: "Escolha o contrato ou envie os arquivos do computador.",
				contratos: [],
				comBusca: true,
			};
		default:
			// Lendo — e também ocioso ou achado, que só aparecem de passagem.
			return LENDO_A_PLANILHA;
	}
}

/**
 * A busca do contrato pela planilha, em modal
 * (docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md §3.2).
 *
 * **Uma frase, sem etapas marcadas**: a busca é um pedido único ao servidor, e
 * marcar ✓ numa etapa que a tela não vê seria o indicador falso que o
 * `ProgressoDaGeracao` recusa.
 *
 * **Quem fecha.** A tela fecha (`aberto` vira `false`) quando acha o contrato —
 * e aí o modal espera o `TEMPO_MINIMO_DA_BUSCA`, contado de quando começou a
 * buscar, para a resposta rápida não piscar o fundo. O que a pessoa faz aqui
 * dentro (Cancelar, Enviar do computador, `Esc`) fecha na hora.
 *
 * `<dialog>` + `showModal()`, como os outros diálogos: mora em `page.tsx`, fora
 * do `<form>` — e por isso o Enter da busca de contrato já não submete nada.
 */
export function BuscaDoContratoModal({
	aberto,
	motivo,
	nomeDaPlanilha,
	identificacao,
	carregandoContrato,
	onEscolherContrato,
	onCancelar,
	onEnviarDoComputador,
	onTrocarPlanilha,
}: Props) {
	const dialogo = useRef<HTMLDialogElement>(null);
	const titulo = useRef<HTMLHeadingElement>(null);
	// O `<dialog>` aberto de fato: segue `aberto` com o atraso do tempo mínimo.
	// O conteúdo só existe com ele aberto — fechado, não deixa texto na página.
	const [visivel, setVisivel] = useState(false);
	const inicioDaEspera = useRef(0);
	// Fechando pelo tempo mínimo, a tela atrás já mudou: o modal segue mostrando
	// o que mostrava, em vez de piscar outro conteúdo no último instante.
	const ultimo = useRef<Conteudo>(LENDO_A_PLANILHA);

	const conteudo = aberto ? conteudoDe(motivo, identificacao, carregandoContrato) : ultimo.current;
	const buscando = conteudo.tipo === "buscando";

	useEffect(() => {
		if (aberto) ultimo.current = conteudo;
	});

	useEffect(() => {
		if (buscando) inicioDaEspera.current = Date.now();
	}, [buscando]);

	useEffect(() => {
		const el = dialogo.current;
		if (!el) return;
		if (aberto && !el.open) {
			el.showModal();
			setVisivel(true);
			return;
		}
		if (!aberto && el.open) {
			const fechar = () => {
				el.close();
				setVisivel(false);
			};
			const falta = TEMPO_MINIMO_DA_BUSCA - (Date.now() - inicioDaEspera.current);
			if (falta <= 0) {
				fechar();
				return;
			}
			const relogio = setTimeout(fechar, falta);
			return () => clearTimeout(relogio);
		}
	}, [aberto]);

	// O foco vai para o título, que diz o que está acontecendo. É o mesmo
	// elemento nas três situações, então o foco sobrevive à troca de conteúdo.
	useEffect(() => {
		if (visivel) titulo.current?.focus();
	}, [visivel]);

	function fecharJa(depois: () => void) {
		dialogo.current?.close();
		setVisivel(false);
		depois();
	}

	function cancelar() {
		// Desistir do contrato escolhido volta à pergunta: o modal fica.
		if (carregandoContrato) onCancelar();
		else fecharJa(onCancelar);
	}

	const textoDoTitulo =
		conteudo.tipo === "buscando"
			? "Buscando os documentos do contrato"
			: conteudo.tipo === "trocar"
				? "Escolha outro contrato"
				: conteudo.titulo;

	return (
		<dialog
			ref={dialogo}
			// `Esc` é decidido aqui, não pelo navegador: na pergunta ele vale
			// "Enviar do computador" (a planilha fica); buscando, vale Cancelar.
			onCancel={(evento) => {
				evento.preventDefault();
				if (conteudo.tipo === "pergunta") fecharJa(onEnviarDoComputador);
				else cancelar();
			}}
			aria-labelledby="busca-contrato-titulo"
			className="w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-confere-line bg-white p-6 shadow-lg"
		>
			{visivel && (
				<>
					<h2
						id="busca-contrato-titulo"
						ref={titulo}
						tabIndex={-1}
						className="text-lg font-semibold text-confere-navy-600 outline-none"
					>
						{textoDoTitulo}
					</h2>
					{nomeDaPlanilha && conteudo.tipo !== "trocar" && (
						<p className="mt-1 truncate text-xs text-confere-navy-300">{nomeDaPlanilha}</p>
					)}

					{conteudo.tipo === "buscando" && (
						<>
							<p role="status" className="mt-4 flex items-start gap-2 text-sm text-confere-navy-600">
								<Giro className="mt-0.5 h-4 w-4 text-confere-teal-500" />
								<span>{conteudo.texto}</span>
							</p>
							<div className="mt-6 flex justify-end">
								<button type="button" onClick={cancelar} className={BOTAO_SECUNDARIO}>
									Cancelar
								</button>
							</div>
						</>
					)}

					{conteudo.tipo === "pergunta" && (
						<>
							<p role="status" className="mt-2 text-sm text-confere-navy-600">
								{conteudo.texto}
							</p>
							{conteudo.contratos.length > 0 && (
								<ListaDeContratos contratos={conteudo.contratos} onEscolher={onEscolherContrato} />
							)}
							{conteudo.comBusca && (
								<div className="mt-3">
									<BuscaDeContrato onEscolher={onEscolherContrato} />
								</div>
							)}
							<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-confere-line pt-4">
								{/* O `<input>` dentro do rótulo: o rótulo é o alvo do clique e o
								    nome acessível do campo, e o Tab chega no próprio input. */}
								<label className="cursor-pointer rounded text-xs font-semibold text-confere-teal-600 underline has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-confere-teal-500">
									Trocar planilha
									<input
										type="file"
										accept=".xlsx"
										className="sr-only"
										onChange={(evento) => {
											const arquivo = evento.target.files?.[0];
											if (arquivo) onTrocarPlanilha(arquivo);
										}}
									/>
								</label>
								<button
									type="button"
									onClick={() => fecharJa(onEnviarDoComputador)}
									className={BOTAO_PRIMARIO}
								>
									Enviar o contrato do computador
								</button>
							</div>
						</>
					)}

					{conteudo.tipo === "trocar" && (
						<>
							<p className="mt-2 text-sm text-confere-navy-600">
								Busque pelo número do contrato, órgão ou cliente.
							</p>
							<div className="mt-3">
								<BuscaDeContrato onEscolher={onEscolherContrato} />
							</div>
							<div className="mt-6 flex justify-end">
								<button type="button" onClick={() => fecharJa(onCancelar)} className={BOTAO_SECUNDARIO}>
									Cancelar
								</button>
							</div>
						</>
					)}
				</>
			)}
		</dialog>
	);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest src/app/confere`
Expected: 7 suítes passando (41 + 19 = 60 testes). O `Esc` é testado disparando o evento `cancel` no `<dialog>` (o jsdom não liga a tecla ao evento); o React 19 escuta `cancel` direto no elemento, pelo `onCancel`.

- [ ] **Step 6: Tipos e lint**

Run: `npx tsc --noEmit -p . && npx eslint src/app/confere`
Expected: sem erro novo (o lint tem 2 avisos antigos fora daqui).

- [ ] **Step 7: Commit**

```bash
git add src/app/confere/components/Giro.tsx src/app/confere/components/BuscaDoContratoModal.tsx src/app/confere/components/BuscaDoContratoModal.test.tsx src/app/confere/components/UploadForm.tsx
git commit -m "feat(confere): modal da busca do contrato (buscando, pergunta, trocar contrato)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Janela "Pastas do cliente" — Voltar, linha clicável, duplo clique, "em uso"

**Files:**
- Modify: `src/app/confere/components/JanelaDePastas.tsx` (reescrita)
- Test: `src/app/confere/components/JanelaDePastas.test.tsx`

**Interfaces:**
- Consumes: `pastasDoCliente`, `listarClientes`, `ClienteDaLista` (`../lib/api`); tipos de `@/lib/confere/tipos-cadastro`.
- Produces: `JanelaDePastas` com as props de antes **mais** `emUso?: readonly string[]` (arquivoIds marcados "em uso", no arquivo e nas pastas acima dele) e `jaNaLista?: readonly string[]` (nos Aditivos: aparecem marcados e desabilitados). Nomes que os testes da tela usam e continuam: botão da pasta com o nome da pasta no nome acessível, `radio`/`checkbox` com o nome do arquivo, botões "Usar este arquivo" / "Adicionar N aditivo(s)", "Outro cliente", busca `searchbox` "Buscar arquivo nas pastas".

- [ ] **Step 1: Escrever os testes que falham**

Em `src/app/confere/components/JanelaDePastas.test.tsx`:

1. Trocar o import da primeira linha por `import { fireEvent, render, screen, within } from "@testing-library/react";`.
2. Em `PASTAS.arquivos`, acrescentar depois do `xlsx` (os testes que já existem continuam valendo):

```tsx
		{
			arquivoId: "ata",
			nome: "Ata.docx",
			extensao: "docx",
			categoria: "OUTRO",
			pasta: ["TC 16-CGM-2024", "3) TA 02"],
		},
```

3. Trocar o `beforeEach` para guardar o espião:

```tsx
let espiao: jest.SpyInstance;

beforeEach(() => {
	espiao = jest.spyOn(global, "fetch").mockImplementation(async (entrada) => {
		const url = String(entrada);
		if (url.endsWith("/api/confere/clientes/cl-cgm/pastas")) return Response.json(PASTAS);
		if (url.endsWith("/api/clientes")) {
			return Response.json([{ id: "cl-cgm", nome: "Controladoria Geral do Município", siglaLegado: "CGM" }]);
		}
		return new Response(null, { status: 404 });
	});
});
```

4. Acrescentar no fim do arquivo:

```tsx
it("Voltar sobe uma pasta e, na raiz, fica indisponível", async () => {
	abrir();
	await screen.findByRole("button", { name: /3\) TA 02/ });
	const voltar = screen.getByRole("button", { name: "Voltar" });
	fireEvent.click(voltar);
	expect(screen.getByRole("button", { name: /TC 12-CGM-2023/ })).toBeInTheDocument();
	expect(voltar).toHaveAttribute("aria-disabled", "true");
	fireEvent.click(voltar);
	expect(screen.getByRole("button", { name: /TC 12-CGM-2023/ })).toBeInTheDocument();
});

it("Outro cliente e depois Voltar para CGM: o mesmo cliente, na mesma pasta, sem buscar de novo", async () => {
	abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	fireEvent.click(screen.getByRole("button", { name: "Outro cliente" }));
	fireEvent.click(await screen.findByRole("button", { name: "Voltar para CGM" }));
	expect(await screen.findByRole("radio", { name: /PA-CGM- 250912-127/ })).toBeInTheDocument();
	const buscasDasPastas = espiao.mock.calls.filter(([url]) => String(url).endsWith("/pastas"));
	expect(buscasDasPastas).toHaveLength(1);
});

it("clicar em qualquer parte da linha seleciona, e o rodapé diz o quê", async () => {
	abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	expect(screen.getByText("Nenhum arquivo selecionado")).toBeInTheDocument();
	fireEvent.click(screen.getByText("PA-CGM- 250912-127 v4.0.pdf"));
	expect(screen.getByRole("radio", { name: /PA-CGM- 250912-127/ })).toBeChecked();
	expect(screen.getByText("Selecionado: PA-CGM- 250912-127 v4.0.pdf")).toBeInTheDocument();
});

it("duplo clique no PDF usa na hora", async () => {
	const { onEscolher, onFechar } = abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	fireEvent.doubleClick(screen.getByText("PA-CGM- 250912-127 v4.0.pdf"));
	expect(onEscolher.mock.calls[0][0].map((d: { arquivoId: string }) => d.arquivoId)).toEqual(["pa-02"]);
	expect(onFechar).toHaveBeenCalled();
});

it("duplo clique nos aditivos leva junto os já marcados, na ordem", async () => {
	const { onEscolher } = abrir({ finalidade: "aditivos" });
	fireEvent.change(await screen.findByRole("searchbox", { name: "Buscar arquivo nas pastas" }), {
		target: { value: "PA-CGM" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: /PA-CGM-250403-035/ }));
	fireEvent.doubleClick(screen.getByText("PA-CGM- 250912-127 v4.0.pdf"));
	expect(onEscolher.mock.calls[0][0].map((d: { arquivoId: string }) => d.arquivoId)).toEqual(["pa-01", "pa-02"]);
});

it("em uso: no arquivo e na pasta que o contém", async () => {
	abrir({ emUso: ["pa-02"] });
	const pasta = await screen.findByRole("button", { name: /3\) TA 02/ });
	expect(within(pasta).getByText("em uso")).toBeInTheDocument();
	expect(
		within(screen.getByRole("button", { name: /1\) Contrato Inicial/ })).queryByText("em uso"),
	).not.toBeInTheDocument();
	fireEvent.click(pasta);
	expect(screen.getByRole("radio", { name: /PA-CGM- 250912-127.*em uso/ })).toBeInTheDocument();
});

it("aditivo que já está na lista aparece marcado e não pode ser escolhido de novo", async () => {
	abrir({ finalidade: "aditivos", jaNaLista: ["pa-01"] });
	fireEvent.click(await screen.findByRole("button", { name: /2\) TA 01/ }));
	const caixa = screen.getByRole("checkbox", { name: /PA-CGM-250403-035/ });
	expect(caixa).toBeDisabled();
	expect(caixa).toBeChecked();
	expect(screen.getByText("já na lista")).toBeInTheDocument();
});

it("cada pasta diz quantos arquivos tem, contando as de dentro", async () => {
	abrir();
	expect(await screen.findByRole("button", { name: /3\) TA 02.*3 arquivos/ })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: /1\) Contrato Inicial.*1 arquivo/ })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "CGM" }));
	expect(screen.getByRole("button", { name: /TC 16-CGM-2024.*5 arquivos/ })).toBeInTheDocument();
});

it("PDFs antes dos outros arquivos", async () => {
	abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	// `textContent` do rótulo inclui o texto do ícone ("PDF"/"···"); por isso
	// `toContain`, não `^`.
	const nomes = screen.getAllByRole("radio").map((radio) => radio.closest("label")?.textContent ?? "");
	expect(nomes[0]).toContain("PA-CGM- 250912-127");
	expect(nomes.slice(1).every((nome) => /só PDF/.test(nome))).toBe(true);
});

it("a busca mostra a pasta de cada arquivo, numa segunda linha", async () => {
	abrir();
	fireEvent.change(await screen.findByRole("searchbox", { name: "Buscar arquivo nas pastas" }), {
		target: { value: "230726" },
	});
	expect(screen.getByText("CGM › TC 12-CGM-2023 › 1) Contrato Inicial")).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere`
Expected: FAIL nos testes novos de `JanelaDePastas.test.tsx` (não há "Voltar", "em uso", contagem, rodapé); os antigos passam.

- [ ] **Step 3: Reescrever `JanelaDePastas.tsx`**

`src/app/confere/components/JanelaDePastas.tsx` inteiro:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import type {
	ArquivoNaPasta,
	DocumentoDoCadastro,
	PastasDoCliente,
} from "@/lib/confere/tipos-cadastro";
import { type ClienteDaLista, listarClientes, pastasDoCliente } from "../lib/api";

interface Props {
	aberto: boolean;
	/** O cliente do contrato achado; sem ele, a janela pede o cliente primeiro. */
	clienteId?: string;
	/** Contrato: um PDF. Aditivos: vários, na ordem dos cliques. */
	finalidade: "contrato" | "aditivos";
	/** A proposta que está no campo Contrato: a janela abre na pasta do contrato dela. */
	arquivoInicial?: string;
	/** O que já está na tela (a proposta do Contrato e os aditivos do cadastro):
	 *  marcado "em uso" no arquivo e nas pastas acima dele. */
	emUso?: readonly string[];
	/** Aditivos que já estão na lista: aparecem marcados e não podem ser
	 *  escolhidos de novo. */
	jaNaLista?: readonly string[];
	onEscolher: (documentos: DocumentoDoCadastro[]) => void;
	onFechar: () => void;
}

const NENHUM: readonly string[] = [];

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

/** Estritamente abaixo de `caminho`. */
function dentroDe(pasta: readonly string[], caminho: readonly string[]): boolean {
	return pasta.length > caminho.length && caminho.every((parte, i) => pasta[i] === parte);
}

/** Em `caminho` ou em qualquer pasta abaixo dele. */
function naPastaOuAbaixo(pasta: readonly string[], caminho: readonly string[]): boolean {
	return pasta.length >= caminho.length && caminho.every((parte, i) => pasta[i] === parte);
}

function ehPdf(arquivo: ArquivoNaPasta): boolean {
	return arquivo.extensao.toLowerCase() === "pdf";
}

/** PDFs primeiro — é o que se escolhe aqui —, depois o resto; cada grupo em
 *  ordem natural. */
function pdfPrimeiro(a: ArquivoNaPasta, b: ArquivoNaPasta): number {
	return Number(!ehPdf(a)) - Number(!ehPdf(b)) || porNome(a.nome, b.nome);
}

function quantos(n: number): string {
	return n === 1 ? "1 arquivo" : `${n} arquivos`;
}

function paraDocumento(arquivo: ArquivoNaPasta): DocumentoDoCadastro {
	return {
		arquivoId: arquivo.arquivoId,
		nome: arquivo.nome,
		origem: null,
		pasta: arquivo.pasta.at(-1) ?? null,
	};
}

function IconeDePasta() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-confere-teal-500">
			<path
				d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
			/>
		</svg>
	);
}

function IconeDeArquivo({ pdf }: { pdf: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={`inline-flex h-5 w-7 shrink-0 items-center justify-center rounded text-[9px] font-bold ${
				pdf ? "bg-confere-navy-50 text-confere-navy-600" : "bg-confere-navy-50 text-confere-navy-300"
			}`}
		>
			{pdf ? "PDF" : "···"}
		</span>
	);
}

function Selo({ children }: { children: React.ReactNode }) {
	return (
		<span className="shrink-0 rounded bg-confere-teal-50 px-1.5 text-[11px] font-semibold text-confere-teal-600">
			{children}
		</span>
	);
}

/** A janela "Pastas do cliente" (docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md
 *  §3.5, revista em docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md §4):
 *  as pastas do SharePoint do cliente, só para procurar e escolher — nada aqui muda arquivo ou
 *  pasta.
 *
 *  `<dialog>` nativo com `showModal()`, como o `ConfirmarLimpeza`: foco preso, `Esc` e fundo
 *  inerte sem ARIA escrita à mão. Mora em `page.tsx`, fora do `<form>` do `UploadForm`. */
export function JanelaDePastas({
	aberto,
	clienteId,
	finalidade,
	arquivoInicial,
	emUso = NENHUM,
	jaNaLista = NENHUM,
	onEscolher,
	onFechar,
}: Props) {
	const dialogo = useRef<HTMLDialogElement>(null);
	const [cliente, setCliente] = useState<string | undefined>(clienteId);
	const [clientes, setClientes] = useState<ClienteDaLista[] | null>(null);
	const [filtroDeCliente, setFiltroDeCliente] = useState("");
	const [dados, setDados] = useState<PastasDoCliente | null>(null);
	const [situacao, setSituacao] = useState<"pronta" | "carregando" | "falhou">("pronta");
	const [caminho, setCaminho] = useState<string[]>([]);
	const [busca, setBusca] = useState("");
	const [escolhidos, setEscolhidos] = useState<ArquivoNaPasta[]>([]);
	// De onde a pessoa saiu em "Outro cliente": "Voltar para <sigla>" devolve ao
	// mesmo cliente, na mesma pasta.
	const [anterior, setAnterior] = useState<{ cliente: string; nome: string; caminho: string[] } | null>(
		null,
	);
	// As pastas já lidas nesta abertura: voltar ao cliente anterior não busca de
	// novo — e não perde a pasta onde a pessoa estava.
	const lidas = useRef(new Map<string, PastasDoCliente>());

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
		setAnterior(null);
		lidas.current.clear();
	}, [aberto, clienteId]);

	useEffect(() => {
		if (!aberto || !cliente) return;
		const guardadas = lidas.current.get(cliente);
		if (guardadas) {
			setDados(guardadas);
			setSituacao("pronta");
			return;
		}
		let valendo = true;
		setSituacao("carregando");
		setDados(null);
		void pastasDoCliente(cliente).then((resposta) => {
			if (!valendo) return;
			if (!resposta) {
				setSituacao("falhou");
				return;
			}
			lidas.current.set(cliente, resposta);
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

	const arquivos = dados?.arquivos ?? [];
	const termo = semAcento(busca.trim());
	const achados = termo
		? arquivos.filter((a) => semAcento(a.nome).includes(termo)).sort(pdfPrimeiro)
		: [];
	const subpastas = [
		...new Set(
			arquivos.filter((a) => dentroDe(a.pasta, caminho)).map((a) => a.pasta[caminho.length]),
		),
	].sort(porNome);
	const aqui = arquivos.filter((a) => mesmaPasta(a.pasta, caminho)).sort(pdfPrimeiro);
	const usados = arquivos.filter((a) => emUso.includes(a.arquivoId));
	const nomeDoCliente = dados ? (dados.cliente.sigla ?? dados.cliente.nome) : "";
	const termoDeCliente = semAcento(filtroDeCliente.trim());
	const naRaiz = caminho.length === 0;
	const rotuloDoBotao =
		finalidade === "contrato"
			? "Usar este arquivo"
			: escolhidos.length === 1
				? "Adicionar 1 aditivo"
				: escolhidos.length > 1
					? `Adicionar ${escolhidos.length} aditivos`
					: "Adicionar aditivos";
	const resumo =
		escolhidos.length === 0
			? "Nenhum arquivo selecionado"
			: finalidade === "contrato"
				? `Selecionado: ${escolhidos[0].nome}`
				: `${escolhidos.length === 1 ? "1 aditivo" : `${escolhidos.length} aditivos`}: ${escolhidos
						.map((a, i) => `${i + 1}º ${a.nome}`)
						.join(", ")}`;

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

	function confirmar(lista: ArquivoNaPasta[] = escolhidos) {
		if (lista.length === 0) return;
		onEscolher(lista.map(paraDocumento));
		onFechar();
	}

	/** Duplo clique: usa o arquivo na hora — nos aditivos, junto com os já
	 *  marcados, na ordem. */
	function usarJa(arquivo: ArquivoNaPasta) {
		if (finalidade === "contrato") {
			confirmar([arquivo]);
			return;
		}
		confirmar(
			escolhidos.some((a) => a.arquivoId === arquivo.arquivoId) ? escolhidos : [...escolhidos, arquivo],
		);
	}

	function subir() {
		// `aria-disabled` e não `disabled` (`R-ACE-06`): quem aperta Voltar até a
		// raiz está com o foco no botão, e desabilitá-lo jogaria o foco no `<body>`.
		if (!naRaiz) setCaminho(caminho.slice(0, -1));
	}

	function outroCliente() {
		if (cliente) setAnterior({ cliente, nome: nomeDoCliente, caminho });
		setCliente(undefined);
		setDados(null);
		setEscolhidos([]);
		setBusca("");
	}

	function voltarAoAnterior() {
		if (!anterior) return;
		setCaminho(anterior.caminho);
		setCliente(anterior.cliente);
		setAnterior(null);
	}

	function linha(arquivo: ArquivoNaPasta, mostrarPasta: boolean) {
		const pdf = ehPdf(arquivo);
		const naLista = finalidade === "aditivos" && jaNaLista.includes(arquivo.arquivoId);
		const escolhivel = pdf && !naLista;
		const ordem = escolhidos.findIndex((a) => a.arquivoId === arquivo.arquivoId) + 1;
		return (
			<li
				key={`${arquivo.arquivoId}-${arquivo.pasta.join("/")}`}
				className={`flex items-center gap-2 pr-3 text-xs transition ${
					ordem > 0 ? "bg-confere-teal-50" : escolhivel ? "hover:bg-confere-navy-50" : ""
				}`}
			>
				{/* A linha toda é o rótulo: clicar em qualquer parte marca. O "ver"
				    fica fora dele — link dentro de rótulo marcaria junto. */}
				<label
					onDoubleClick={escolhivel ? () => usarJa(arquivo) : undefined}
					className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 ${
						escolhivel ? "cursor-pointer text-confere-navy-600" : "text-confere-navy-300"
					}`}
				>
					<input
						type={finalidade === "contrato" ? "radio" : "checkbox"}
						name="arquivo-da-pasta"
						checked={ordem > 0 || naLista}
						disabled={!escolhivel}
						onChange={() => alternar(arquivo)}
					/>
					<IconeDeArquivo pdf={pdf} />
					<span className="min-w-0 flex-1">
						<span className="flex items-center gap-2">
							<span className="truncate">{arquivo.nome}</span>
							{naLista ? (
								<Selo>já na lista</Selo>
							) : (
								emUso.includes(arquivo.arquivoId) && <Selo>em uso</Selo>
							)}
							{finalidade === "aditivos" && ordem > 0 && (
								<span className="shrink-0 rounded bg-confere-teal-500 px-1.5 text-[11px] font-semibold text-white">
									{ordem}º
								</span>
							)}
							{!pdf && <span className="shrink-0">· só PDF</span>}
						</span>
						{mostrarPasta && (
							<span className="block truncate text-[11px] text-confere-navy-300">
								{[nomeDoCliente, ...arquivo.pasta].join(" › ")}
							</span>
						)}
					</span>
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
			className="w-[min(48rem,calc(100vw-2rem))] rounded-lg border border-confere-line bg-white p-6 shadow-lg"
		>
			{/* Conteúdo só com a janela aberta: fechada, ela não deixa na página os
			    nomes de arquivo — que a tela também mostra nos campos. */}
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
								onClick={outroCliente}
								className="shrink-0 text-xs font-semibold text-confere-teal-600 underline"
							>
								Outro cliente
							</button>
						)}
					</div>

					{!cliente ? (
						<div className="mt-4 text-sm">
							{anterior && (
								<button
									type="button"
									onClick={voltarAoAnterior}
									className="mb-3 inline-flex items-center gap-1 rounded-md border border-confere-line px-2.5 py-1 text-xs font-semibold text-confere-navy-600 hover:bg-confere-navy-50"
								>
									<span aria-hidden="true">←</span> Voltar para {anterior.nome}
								</button>
							)}
							<input
								type="search"
								value={filtroDeCliente}
								onChange={(evento) => setFiltroDeCliente(evento.target.value)}
								placeholder="Buscar cliente por nome ou sigla"
								aria-label="Buscar cliente"
								className="h-9 w-full rounded border border-confere-line px-2 text-confere-navy-600"
							/>
							<ul className="mt-2 h-96 space-y-1 overflow-y-auto">
								{(clientes ?? [])
									.filter(
										(c) =>
											!termoDeCliente ||
											semAcento(`${c.siglaLegado ?? ""} ${c.nome}`).includes(termoDeCliente),
									)
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
						<div className="mt-4">
							<p role="status" className="sr-only">
								Carregando as pastas…
							</p>
							<ul aria-hidden="true" className="h-[27.5rem] space-y-2 overflow-hidden pt-12">
								{[0, 1, 2, 3, 4, 5].map((i) => (
									<li key={i} className="h-8 rounded bg-confere-navy-50 motion-safe:animate-pulse" />
								))}
							</ul>
						</div>
					) : situacao === "falhou" ? (
						<p className="mt-4 text-sm text-amber-900">
							Não foi possível abrir as pastas deste cliente.
						</p>
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
								<ul className="mt-3 h-96 divide-y divide-confere-line overflow-y-auto rounded border border-confere-line">
									{achados.map((arquivo) => linha(arquivo, true))}
									{achados.length === 0 && (
										<li className="px-3 py-2 text-xs text-confere-navy-300">
											Nenhum arquivo com esse nome.
										</li>
									)}
								</ul>
							) : (
								<>
									<div className="mt-3 flex items-center gap-2 text-xs">
										<button
											type="button"
											onClick={subir}
											aria-disabled={naRaiz}
											className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-confere-line px-2.5 py-1 font-semibold ${
												naRaiz
													? "cursor-not-allowed text-confere-navy-100"
													: "text-confere-navy-600 hover:bg-confere-navy-50"
											}`}
										>
											<span aria-hidden="true">←</span> Voltar
										</button>
										<nav aria-label="Caminho" className="flex min-w-0 flex-wrap items-center gap-1">
											<button
												type="button"
												onClick={() => setCaminho([])}
												className="font-semibold text-confere-teal-600 underline"
											>
												{nomeDoCliente}
											</button>
											{caminho.map((parte, i) => (
												<span key={`${i}-${parte}`} className="flex min-w-0 items-center gap-1">
													<span aria-hidden="true">›</span>
													{i === caminho.length - 1 ? (
														<span className="truncate font-semibold text-confere-navy-600">{parte}</span>
													) : (
														<button
															type="button"
															onClick={() => setCaminho(caminho.slice(0, i + 1))}
															className="truncate text-confere-teal-600 underline"
														>
															{parte}
														</button>
													)}
												</span>
											))}
										</nav>
									</div>
									<ul className="mt-2 h-96 divide-y divide-confere-line overflow-y-auto rounded border border-confere-line">
										{subpastas.map((nome) => {
											const dentro = [...caminho, nome];
											const total = arquivos.filter((a) => naPastaOuAbaixo(a.pasta, dentro)).length;
											const comUso = usados.some((a) => naPastaOuAbaixo(a.pasta, dentro));
											return (
												<li key={`pasta-${nome}`}>
													<button
														type="button"
														onClick={() => setCaminho(dentro)}
														className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-confere-navy-600 hover:bg-confere-navy-50"
													>
														<IconeDePasta />
														<span className="min-w-0 flex-1 truncate">{nome}</span>
														{comUso && <Selo>em uso</Selo>}
														<span className="shrink-0 text-confere-navy-300">{quantos(total)}</span>
														<span aria-hidden="true">›</span>
													</button>
												</li>
											);
										})}
										{aqui.map((arquivo) => linha(arquivo, false))}
										{subpastas.length === 0 && aqui.length === 0 && (
											<li className="px-3 py-2 text-xs text-confere-navy-300">Pasta vazia.</li>
										)}
									</ul>
								</>
							)}
						</div>
					)}

					<div className="mt-6 flex flex-wrap items-center justify-end gap-3">
						<p className="min-w-0 flex-1 truncate text-xs text-confere-navy-300">{resumo}</p>
						<button
							type="button"
							onClick={onFechar}
							className="rounded-md border border-confere-line bg-white px-5 py-2.5 text-sm font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50"
						>
							Cancelar
						</button>
						<button
							type="button"
							onClick={() => confirmar()}
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

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/app/confere`
Expected: todas passando (os 7 testes antigos da janela + 10 novos). Atenção ao teste "cada pasta diz quantos arquivos": `TC 16-CGM-2024` na raiz tem 5 arquivos (pc, pa-01, pa-02, xlsx, ata).

- [ ] **Step 5: Tipos e lint**

Run: `npx tsc --noEmit -p . && npx eslint src/app/confere`
Expected: sem erro novo.

- [ ] **Step 6: Commit**

```bash
git add src/app/confere/components/JanelaDePastas.tsx src/app/confere/components/JanelaDePastas.test.tsx
git commit -m "feat(confere): janela de pastas com Voltar, linha clicavel, duplo clique e em uso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Os documentos em linhas de conferência

O formulário continua com a mesma lógica; muda a forma: faixa do contrato no topo, depois "Documentos" com três linhas (Levantamento, Contrato, Aditivos), cada uma com ícone, rótulo e descrição, o arquivo e de onde veio, e as ações à direita. Nesta task a tela ainda mostra tudo desde o início (as fases vêm na Task 4).

**Files:**
- Modify: `src/app/confere/components/UploadForm.tsx` (reescrita)
- Modify: `src/app/confere/components/FaixaDoContrato.tsx` (só margens: `mt-4` → `mb-4`)
- Modify: `src/app/confere/page.tsx` (tirar a prop `buscandoContrato`; passar `chaveLevantamento`)
- Test: `src/app/confere/page.test.tsx`

**Interfaces:**
- Consumes: `Giro` (Task 1).
- Produces: `UploadForm` com as props de antes **menos** `buscandoContrato` e **mais** `chaveLevantamento: number`. `refPrimeiroCampo` passa a ser o `<input>` do **Levantamento** (primeira linha). Inputs de arquivo continuam com `aria-label` "Levantamento", "Contrato", "Aditivos da proposta" (os testes escolhem arquivo por eles); a lista tem nome acessível "Documentos". Botões: "Escolher planilha"/"Trocar planilha", "Ver PDF", "Procurar nas pastas do cliente", "Enviar do computador", "+ Procurar nas pastas", "+ Enviar do computador", "Remover <nome>".

- [ ] **Step 1: Escrever os testes que falham**

Em `src/app/confere/page.test.tsx`:

1. No teste "começo guiado: selo no levantamento e o que falta embaixo do botão", trocar a linha

```tsx
	expect(screen.getByText("vem do levantamento — ou escolha um arquivo")).toBeInTheDocument();
```

por

```tsx
	expect(
		screen.getByText("Nenhum contrato — procure nas pastas do cliente ou envie do computador."),
	).toBeInTheDocument();
```

2. Acrescentar no fim:

```tsx
it("os documentos em linhas: o levantamento primeiro, cada um com o arquivo e de onde veio", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	const linhas = Array.from(screen.getByRole("list", { name: "Documentos" }).children);
	expect(linhas.map((linha) => linha.querySelector("p")?.textContent)).toEqual([
		"Levantamento",
		"Contrato",
		"Aditivos da proposta",
	]);
	expect(linhas[0]).toHaveTextContent("PGM_Levantamento.xlsx");
	expect(linhas[0]).toHaveTextContent("Do computador");
	expect(linhas[1]).toHaveTextContent("Do cadastro · TA 04, renovação desde 01/12/2025");
});

it("Enviar do computador, no Contrato, abre o seletor do campo Contrato", () => {
	const clique = jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Enviar do computador" }));
	expect(clique.mock.contexts[0]).toBe(screen.getByLabelText("Contrato"));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/confere`
Expected: FAIL em `page.test.tsx` — os dois testes novos (não há lista "Documentos" nem botão "Enviar do computador") e o "começo guiado" (texto novo do Contrato vazio).

- [ ] **Step 3: Reescrever `UploadForm.tsx`**

`src/app/confere/components/UploadForm.tsx` inteiro:

```tsx
"use client";

import { useRef, useState } from "react";

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
import { Giro } from "./Giro";
import { useSoltarArquivos } from "./useSoltarArquivos";

const [CAMPO_CONTRATO, CAMPO_LEVANTAMENTO] = CAMPOS;

const LINK = "font-semibold text-confere-teal-600 underline disabled:cursor-not-allowed disabled:opacity-60";

interface Props {
	/** O levantamento escolhido — o arquivo que dispara a busca do contrato no
	 *  cadastro. */
	levantamento?: File;
	/** O campo Contrato: arquivo do computador ou proposta do cadastro. */
	contrato?: Peca;
	onSelecionar: (campo: NomeDoCampo, arquivo: File | undefined) => void;
	/** ESPEC 019 `R-ADT-10` — os aditivos da proposta, opcionais e em qualquer
	 *  número, em ordem de aplicação. Misturam cadastro e computador. */
	aditivos: readonly Peca[];
	/** A seleção do computador **acrescenta** no fim da lista. */
	onSelecionarAditivos: (escolhidos: readonly File[]) => void;
	onRemoverAditivo: (posicao: number) => void;
	/** O texto da linha de aditivos vazia. */
	semAditivos: string;
	/** O resumo do contrato — em cima das linhas dos documentos. */
	faixa?: React.ReactNode;
	/** Abre a janela "Pastas do cliente" para o Contrato. */
	onProcurarContrato: () => void;
	/** Abre a janela "Pastas do cliente" para os aditivos. */
	onProcurarAditivos: () => void;
	/** O que falta para gerar, embaixo do botão; `null` quando nada falta. */
	dica: string | null;
	onEnviar: () => void;
	processando: boolean;
	/** ESPEC 015 `R-LMP-04` — muda a cada limpeza e remonta os `<input
	 *  type="file">`, que é o que zera `input.value`. Zerar só o estado do React
	 *  deixaria a tela dizendo vazio com o elemento ainda carregando o arquivo. */
	chave: number;
	/** Remonta só o input do Levantamento (a busca cancelada tira a planilha). */
	chaveLevantamento: number;
	/** Remonta só o input do Contrato — quando o cadastro volta a ocupá-lo. */
	chaveContrato: number;
	/** Remonta só o input dos aditivos, a cada seleção acrescentada: escolher o
	 *  mesmo arquivo de novo volta a disparar. */
	chaveAditivos: number;
	/** `R-LMP-02` — decidido em `page.tsx`, que é quem tem o estado da tela. */
	podeLimpar: boolean;
	onLimpar: () => void;
	refLimpar: React.RefObject<HTMLButtonElement | null>;
	/** O input do Levantamento — a primeira linha. */
	refPrimeiroCampo: React.RefObject<HTMLInputElement | null>;
	/** ESPEC 023 `R-FON-07` — destino do foco da ação do aviso de divergência. */
	refAditivos: React.RefObject<HTMLInputElement | null>;
	/** T-2100 / ESPEC 029 `R-IDT-10` — o achado do portão, quando há um. */
	perguntaDeIdentidade?: Achado;
	onGerarAssimMesmo: () => void;
	onDescartarPergunta: () => void;
}

function IconeDoTipo({ tipo }: { tipo: "xlsx" | "pdf" }) {
	return (
		<span
			aria-hidden="true"
			className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase ${
				tipo === "xlsx"
					? "bg-confere-teal-50 text-confere-teal-600"
					: "bg-confere-navy-50 text-confere-navy-600"
			}`}
		>
			{tipo}
		</span>
	);
}

interface LinhaProps {
	/** Prefixo dos `id` (`-descricao`, `-estado`) que o input cita. */
	nome: string;
	rotulo: string;
	descricao: string;
	tipo: "xlsx" | "pdf";
	selo?: React.ReactNode;
	soltar: ReturnType<typeof useSoltarArquivos>;
	/** O que aparece por cima com um arquivo sendo arrastado. */
	convite: string;
	/** O `<input type="file">`, escondido: os botões da linha o acionam. */
	campo: React.ReactNode;
	/** O arquivo e de onde veio — ou o que diz a linha vazia. */
	conteudo: React.ReactNode;
	acoes: React.ReactNode;
}

/** Uma linha da lista de conferência (desenho de 28/09/2026 §3.3). Borda sólida
 *  no repouso; o tracejado só aparece com um arquivo por cima, que é quando
 *  arrastar faz alguma coisa (`R-ACE-17`). O anel de foco é da linha, por
 *  `has-[:focus-visible]`: o foco mora nos botões dela. */
function LinhaDoDocumento({
	nome,
	rotulo,
	descricao,
	tipo,
	selo,
	soltar,
	convite,
	campo,
	conteudo,
	acoes,
}: LinhaProps) {
	return (
		<li
			{...soltar.alvo}
			className="relative grid gap-x-6 gap-y-2 px-4 py-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-confere-teal-500 md:grid-cols-[16rem_minmax(0,1fr)_auto] md:items-center"
		>
			<div className="flex items-start gap-3">
				<IconeDoTipo tipo={tipo} />
				<div>
					<p className="flex items-center gap-2 text-sm font-semibold text-confere-navy-600">
						{rotulo}
						{selo}
					</p>
					<span id={`${nome}-descricao`} className="block text-xs text-confere-navy-300">
						{descricao}
					</span>
				</div>
			</div>
			<div id={`${nome}-estado`} className="min-w-0">
				{conteudo}
			</div>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:justify-end">{acoes}</div>
			{campo}
			{soltar.erro && (
				<p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900 md:col-span-3">
					{soltar.erro}
				</p>
			)}
			{soltar.arrastando && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-confere-teal-500 bg-confere-teal-50/95 text-sm font-semibold text-confere-teal-600"
				>
					{convite}
				</div>
			)}
		</li>
	);
}

export function UploadForm({
	levantamento,
	contrato,
	onSelecionar,
	aditivos,
	onSelecionarAditivos,
	onRemoverAditivo,
	semAditivos,
	faixa,
	onProcurarContrato,
	onProcurarAditivos,
	dica,
	onEnviar,
	processando,
	chave,
	chaveLevantamento,
	chaveContrato,
	chaveAditivos,
	podeLimpar,
	onLimpar,
	refLimpar,
	refPrimeiroCampo,
	refAditivos,
	perguntaDeIdentidade,
	onGerarAssimMesmo,
	onDescartarPergunta,
}: Props) {
	const completo = contrato !== undefined && levantamento !== undefined;
	const bloqueado = !completo || processando;
	const contratoDoComputador = contrato?.tipo === "arquivo" ? contrato.arquivo : undefined;
	const contratoDoCadastro = contrato?.tipo === "cadastro" ? contrato.documento : undefined;
	// O input do Contrato — "Enviar do computador" e o "Trocar arquivo" dos dois
	// avisos abrem o seletor dele.
	const campoDoContrato = useRef<HTMLInputElement>(null);

	// Arrastar e soltar por linha: cada uma aceita o seu tipo, e soltar faz o
	// mesmo que escolher pelo seletor.
	const soltarLevantamento = useSoltarArquivos({
		extensao: ".xlsx",
		multiplos: false,
		desabilitado: processando,
		onSoltar: ([arquivo]) => onSelecionar("levantamento", arquivo),
		mensagemDeTipoErrado: (arquivo) => `O levantamento é a planilha .xlsx — ${arquivo.name} não é.`,
	});
	const soltarContrato = useSoltarArquivos({
		extensao: ".pdf",
		multiplos: false,
		desabilitado: processando,
		onSoltar: ([arquivo]) => onSelecionar("contrato", arquivo),
		mensagemDeTipoErrado: (arquivo) => `O contrato é a proposta em PDF — ${arquivo.name} não é PDF.`,
	});
	const soltarAditivos = useSoltarArquivos({
		extensao: ".pdf",
		multiplos: true,
		desabilitado: processando,
		onSoltar: onSelecionarAditivos,
		mensagemDeTipoErrado: (arquivo) => `Aditivos são PDFs — ${arquivo.name} ficou de fora.`,
	});

	// ESPEC 025 `R-DOC-08` — o arquivo dispensado, pelo nome. Guardar o **nome**
	// e não um booleano é o que faz o aviso voltar quando a pessoa troca por
	// outro levantamento. Só vale para o arquivo enviado do computador.
	const [nomeDispensado, setNomeDispensado] = useState<string | null>(null);
	const avisarLevantamento =
		contratoDoComputador !== undefined &&
		pareceLevantamento(contratoDoComputador.name) &&
		contratoDoComputador.name !== nomeDispensado;

	// `aria-disabled` mantém o botão clicável de verdade: a inibição sai do
	// navegador e passa a ser deste código. Guarda única, cobrindo clique e
	// Enter (`R-ACE-06`, `R-ACE-07`).
	function submeter(evento: React.FormEvent) {
		evento.preventDefault();
		if (bloqueado) return;
		onEnviar();
	}

	// Os `<input type="file">` ficam fora da ordem do Tab (`tabIndex={-1}`): o
	// foco mora nos botões visíveis que os acionam, e o input no Tab seria uma
	// parada invisível a mais para a mesma ação. O `aria-label` continua — é o
	// nome do campo para leitor de tela e para os testes.
	//
	// A ordem das linhas é a do fluxo (desenho de 28/09/2026 §3.3): Levantamento
	// → Contrato → Aditivos → Gerar relatório → Limpar.
	return (
		<form onSubmit={submeter} className="rounded-lg border border-confere-line bg-white p-6 shadow-sm">
			{faixa}

			<h2 id="documentos-titulo" className="text-sm font-semibold text-confere-navy-600">
				Documentos
			</h2>
			<ul
				aria-labelledby="documentos-titulo"
				className="mt-2 divide-y divide-confere-line rounded-md border border-confere-line"
			>
				<LinhaDoDocumento
					nome={CAMPO_LEVANTAMENTO.nome}
					rotulo={CAMPO_LEVANTAMENTO.rotulo}
					descricao={CAMPO_LEVANTAMENTO.descricao}
					tipo="xlsx"
					selo={
						!levantamento && (
							<span className="rounded bg-confere-teal-500 px-2 py-0.5 text-[11px] font-semibold text-white">
								comece aqui
							</span>
						)
					}
					soltar={soltarLevantamento}
					convite="Solte a planilha aqui"
					campo={
						<input
							key={`${chave}-${chaveLevantamento}`}
							type="file"
							ref={refPrimeiroCampo}
							tabIndex={-1}
							accept={CAMPO_LEVANTAMENTO.aceita}
							disabled={processando}
							className="sr-only"
							aria-label={CAMPO_LEVANTAMENTO.rotulo}
							aria-describedby={`${CAMPO_LEVANTAMENTO.nome}-descricao ${CAMPO_LEVANTAMENTO.nome}-estado`}
							onChange={(evento) => {
								soltarLevantamento.limparErro();
								const arquivo = evento.target.files?.[0];
								// Seletor fechado sem escolher: a planilha que estava fica.
								if (arquivo) onSelecionar("levantamento", arquivo);
							}}
						/>
					}
					conteudo={
						levantamento ? (
							<>
								<p className="truncate text-sm text-confere-teal-600">{levantamento.name}</p>
								<p className="text-xs text-confere-navy-300">Do computador</p>
							</>
						) : (
							<p className="text-sm text-confere-navy-300">escolher arquivo… ou arraste para cá</p>
						)
					}
					acoes={
						<button
							type="button"
							onClick={() => refPrimeiroCampo.current?.click()}
							disabled={processando}
							className={LINK}
						>
							{levantamento ? "Trocar planilha" : "Escolher planilha"}
						</button>
					}
				/>

				<LinhaDoDocumento
					nome={CAMPO_CONTRATO.nome}
					rotulo={CAMPO_CONTRATO.rotulo}
					descricao={CAMPO_CONTRATO.descricao}
					tipo="pdf"
					soltar={soltarContrato}
					convite="Solte o PDF aqui"
					campo={
						<input
							key={`${chave}-${chaveContrato}`}
							type="file"
							ref={campoDoContrato}
							tabIndex={-1}
							accept={CAMPO_CONTRATO.aceita}
							disabled={processando}
							className="sr-only"
							aria-label={CAMPO_CONTRATO.rotulo}
							aria-describedby={`${CAMPO_CONTRATO.nome}-descricao ${CAMPO_CONTRATO.nome}-estado`}
							onChange={(evento) => {
								soltarContrato.limparErro();
								onSelecionar("contrato", evento.target.files?.[0]);
							}}
						/>
					}
					conteudo={
						contrato ? (
							<>
								<p className="truncate text-sm text-confere-teal-600">{nomeDaPeca(contrato)}</p>
								<p className="truncate text-xs text-confere-navy-300">
									{contratoDoCadastro
										? `Do cadastro · ${textoDoDocumento(contratoDoCadastro)}`
										: "Do computador"}
								</p>
							</>
						) : (
							<p className="text-sm text-confere-navy-300">
								Nenhum contrato — procure nas pastas do cliente ou envie do computador.
							</p>
						)
					}
					acoes={
						<>
							{contratoDoCadastro && (
								<a
									href={`/api/arquivos/${contratoDoCadastro.arquivoId}?modo=inline`}
									target="_blank"
									rel="noreferrer"
									className={LINK}
								>
									Ver PDF
								</a>
							)}
							<button type="button" onClick={onProcurarContrato} disabled={processando} className={LINK}>
								Procurar nas pastas do cliente
							</button>
							<button
								type="button"
								onClick={() => campoDoContrato.current?.click()}
								disabled={processando}
								className={LINK}
							>
								Enviar do computador
							</button>
						</>
					}
				/>

				{/* ESPEC 019 `R-ADT-10` — opcional (`D-10`): não entra na regra que
				    habilita o botão. A lista é da tela, não do `<input>`: mistura
				    propostas do cadastro e arquivos do computador, cada item com o seu
				    botão de remover, na ordem de aplicação (`R-ADT-07`). */}
				<LinhaDoDocumento
					nome={CAMPO_ADITIVOS.nome}
					rotulo={CAMPO_ADITIVOS.rotulo}
					descricao={CAMPO_ADITIVOS.descricao}
					tipo="pdf"
					soltar={soltarAditivos}
					convite="Solte os PDFs aqui"
					campo={
						<input
							key={`${chave}-${chaveAditivos}`}
							type="file"
							multiple
							ref={refAditivos}
							tabIndex={-1}
							accept={CAMPO_ADITIVOS.aceita}
							disabled={processando}
							className="sr-only"
							aria-label={CAMPO_ADITIVOS.rotulo}
							aria-describedby={`${CAMPO_ADITIVOS.nome}-descricao ${CAMPO_ADITIVOS.nome}-estado`}
							onChange={(evento) => {
								soltarAditivos.limparErro();
								onSelecionarAditivos(Array.from(evento.target.files ?? []));
							}}
						/>
					}
					conteudo={
						aditivos.length > 0 ? (
							<ol className="space-y-1">
								{aditivos.map((peca, posicao) => (
									<li
										key={`${posicao}-${nomeDaPeca(peca)}`}
										className="flex items-center justify-between gap-2 rounded border border-confere-teal-400 bg-white px-2 py-1 text-xs text-confere-teal-600"
									>
										<span className="truncate">
											{posicao + 1}. {nomeDaPeca(peca)}
											<span className="text-confere-navy-300">
												{" · "}
												{peca.tipo === "cadastro"
													? `do cadastro · ${textoDoDocumento(peca.documento)}`
													: "do computador"}
											</span>
										</span>
										<button
											type="button"
											onClick={() => onRemoverAditivo(posicao)}
											disabled={processando}
											aria-label={`Remover ${nomeDaPeca(peca)}`}
											className="shrink-0 rounded px-1.5 font-semibold text-confere-navy-600 hover:bg-confere-navy-50"
										>
											×
										</button>
									</li>
								))}
							</ol>
						) : (
							<p className="text-sm text-confere-navy-300">{semAditivos}</p>
						)
					}
					acoes={
						<>
							<button type="button" onClick={onProcurarAditivos} disabled={processando} className={LINK}>
								+ Procurar nas pastas
							</button>
							<button
								type="button"
								onClick={() => refAditivos.current?.click()}
								disabled={processando}
								className={LINK}
							>
								+ Enviar do computador
							</button>
						</>
					}
				/>
			</ul>

			{/* ESPEC 025 `R-DOC-08` — o aviso que chega **antes** dos 16,6 s.
			    `role="status"` e não `alert`: não é erro, é ressalva sobre uma
			    escolha ainda reversível (`R-ACE-13`). `id` próprio porque a região
			    da `R-LMP-10` em `page.tsx` também é `status`. */}
			{avisarLevantamento && (
				<div
					id="contrato-aviso"
					role="status"
					className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
				>
					<p>
						<strong>Este arquivo parece ser um levantamento.</strong> O campo
						Contrato espera a proposta comercial em PDF — o documento com a tabela
						de itens, com códigos de serviço e preços.
					</p>
					<div className="mt-3 flex flex-wrap gap-2.5">
						<button
							// `type="button"` pela razão da `R-LMP-03`: dentro de um `<form>`
							// o padrão do HTML é `submit`, e sem ele *Trocar arquivo*
							// geraria o relatório com o arquivo errado.
							type="button"
							onClick={() => campoDoContrato.current?.click()}
							className="rounded-md border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
						>
							Trocar arquivo
						</button>
						<button
							type="button"
							onClick={() => setNomeDispensado(contratoDoComputador?.name ?? null)}
							className="rounded-md px-4 py-2 text-xs font-semibold text-amber-900 underline transition hover:bg-amber-100"
						>
							Usar assim mesmo
						</button>
					</div>
				</div>
			)}

			{/* T-2100 / ESPEC 029 `R-IDT-10` — o portão que **pergunta**. A mesma
			    caixa da `R-DOC-08`: o que muda é a fonte do juízo, não a forma. A
			    `acao` do achado não é renderizada — diz em palavras o que os dois
			    botões fazem. O `detalhe` fica, recolhido, para o suporte. */}
			{perguntaDeIdentidade && (
				<div
					id="identidade-aviso"
					role="status"
					className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
				>
					<p>
						<strong>{perguntaDeIdentidade.titulo}</strong>
					</p>
					<p className="mt-2">{perguntaDeIdentidade.causa}</p>
					{perguntaDeIdentidade.detalhe && (
						<details className="mt-3">
							<summary className="cursor-pointer text-xs opacity-80">
								Detalhes técnicos (para o suporte) · {perguntaDeIdentidade.validacao}
							</summary>
							<p className="mt-1 select-all font-mono text-xs opacity-90">
								{perguntaDeIdentidade.detalhe}
							</p>
						</details>
					)}
					<div className="mt-3 flex flex-wrap gap-2.5">
						<button
							type="button"
							onClick={() => {
								onDescartarPergunta();
								campoDoContrato.current?.click();
							}}
							className="rounded-md border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
						>
							Trocar arquivo
						</button>
						<button
							type="button"
							onClick={onGerarAssimMesmo}
							className="rounded-md px-4 py-2 text-xs font-semibold text-amber-900 underline transition hover:bg-amber-100"
						>
							Gerar assim mesmo
						</button>
					</div>
				</div>
			)}

			{/* As classes de estado são expressão condicional, não variante
			    `disabled:` — a variante depende do atributo real, que não existe
			    aqui (`aria-disabled`). */}
			<button
				type="submit"
				aria-disabled={bloqueado}
				aria-busy={processando}
				aria-describedby={dica ? "upload-pendente" : undefined}
				className={`mt-6 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition ${
					bloqueado
						? "cursor-not-allowed bg-confere-navy-100 text-confere-navy-600"
						: "bg-confere-teal-500 text-white hover:bg-confere-teal-600"
				}`}
			>
				{processando && <Giro />}
				{processando ? "Processando…" : "Gerar relatório"}
			</button>

			{/* ESPEC 015 `R-LMP-12` — secundário, e depois do primário no DOM. */}
			{podeLimpar && (
				<button
					// Sem `type="button"`, clicar em Limpar geraria relatório (`R-LMP-03`).
					type="button"
					ref={refLimpar}
					onClick={onLimpar}
					className="ml-3 mt-6 inline-flex items-center rounded-md border border-confere-line bg-white px-5 py-2.5 text-sm font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50"
				>
					Limpar
				</button>
			)}

			{/* O progresso da geração mora no `ProgressoDaGeracao`, um `<dialog>`
			    em `page.tsx`. Aqui embaixo fica só o que falta, dito pelo nome. */}
			{dica && (
				<p id="upload-pendente" className="mt-3 text-xs text-confere-navy-300">
					{dica}
				</p>
			)}
		</form>
	);
}
```

- [ ] **Step 4: Ajustar `FaixaDoContrato.tsx` (margens)**

A faixa agora fica **em cima** das linhas: trocar `mt-4` por `mb-4` nas quatro ocorrências — `CAIXA_AMBAR` (`"mb-4 rounded-md border …"`), o `<p>` do caso `lendo` e o `<div>` do caso achado. Nada mais muda nesta task.

- [ ] **Step 5: Ajustar `page.tsx`**

1. Acrescentar o estado, junto de `chaveContrato`/`chaveAditivos`:

```tsx
	const [chaveLevantamento, setChaveLevantamento] = useState(0);
```

(o `setChaveLevantamento` é usado na Task 4; por ora, para o lint não reclamar de variável sem uso, escrever `const [chaveLevantamento] = useState(0);` e trocar pela forma completa na Task 4.)

2. No `<UploadForm …>`: apagar a linha `buscandoContrato={identificacao.situacao === "lendo"}` e acrescentar `chaveLevantamento={chaveLevantamento}` depois de `chave={chave}`.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx jest src/app/confere`
Expected: todas passando.

- [ ] **Step 7: Tipos e lint**

Run: `npx tsc --noEmit -p . && npx eslint src/app/confere`
Expected: sem erro novo.

- [ ] **Step 8: Commit**

```bash
git add src/app/confere/components/UploadForm.tsx src/app/confere/components/FaixaDoContrato.tsx src/app/confere/page.tsx src/app/confere/page.test.tsx
git commit -m "feat(confere): documentos em linhas de conferencia, levantamento primeiro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: A tela em fases — só o levantamento no início, busca no modal

**Files:**
- Create: `src/app/confere/components/EntradaDoLevantamento.tsx`
- Modify: `src/app/confere/components/FaixaDoContrato.tsx` (só o caso achado + a linha "não identificou")
- Modify: `src/app/confere/components/UploadForm.tsx` (sem `refPrimeiroCampo`: ref interna do Levantamento)
- Modify: `src/app/confere/page.tsx` (fases, modal, cancelar, enviar do computador, janela com `emUso`/`jaNaLista`)
- Test: `src/app/confere/page.test.tsx` (reescrito), `src/app/confere/components/FaixaDoContrato.test.tsx` (reescrito)

**Interfaces:**
- Consumes: `BuscaDoContratoModal`, `TEMPO_MINIMO_DA_BUSCA` (Task 1); `JanelaDePastas` com `emUso`/`jaNaLista` (Task 2); `UploadForm` com `chaveLevantamento` (Task 3).
- Produces:
  - `EntradaDoLevantamento({ onEscolher(arquivo: File): void; onPreencherAMao(): void; refBotao: RefObject<HTMLButtonElement | null> })` — input com `aria-label="Levantamento"`, botão "Escolher planilha", link "Preencher à mão"; descrição "Planilha de medição da competência, em XLSX" (alvo de soltar nos testes).
  - `FaixaDoContrato({ identificacao, documentos?, contratoDoComputador, onBuscarContrato(): void, onUsarDoCadastro(): void })` — `onEscolherContrato` sai.
  - `UploadForm` sem a prop `refPrimeiroCampo`.

- [ ] **Step 1: Reescrever os testes da faixa (falham)**

`src/app/confere/components/FaixaDoContrato.test.tsx` inteiro:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";

import type { DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
import { FaixaDoContrato } from "./FaixaDoContrato";

const leitura = { referencia: "TC 99/SMIT/2026", competencia: { ano: 2026, mes: 7 } };
const DOCUMENTOS: DocumentosDoContrato = {
	contrato: {
		id: "ct-52",
		clienteId: "cl",
		clienteNome: "SMIT",
		clienteSigla: "SMIT",
		numeroTermo: "TC 52/SMIT/2024",
		descricao: "Sustentação",
		vigenciaFim: null,
		ativo: true,
	},
	competencia: { ano: 2026, mes: 7, lidaDaPlanilha: true },
	base: { arquivoId: "pa", nome: "PA-SMIT.pdf", origem: null },
	aditivos: [],
	alternativas: [],
	decisoes: [],
	avisos: [],
};

function renderizar(props: Partial<Parameters<typeof FaixaDoContrato>[0]> = {}) {
	const onBuscarContrato = jest.fn();
	const { container } = render(
		<FaixaDoContrato
			identificacao={{ situacao: "ociosa" }}
			contratoDoComputador={false}
			onBuscarContrato={onBuscarContrato}
			onUsarDoCadastro={jest.fn()}
			{...props}
		/>,
	);
	return { onBuscarContrato, container };
}

it("nada antes da planilha, nem enquanto lê — quem mostra a busca é o modal", () => {
	expect(renderizar().container).toBeEmptyDOMElement();
	expect(renderizar({ identificacao: { situacao: "lendo" } }).container).toBeEmptyDOMElement();
});

it("contrato achado: o resumo, e trocar contrato abre a busca", () => {
	const { onBuscarContrato } = renderizar({
		identificacao: { situacao: "encontrado", leitura, documentos: DOCUMENTOS },
		documentos: DOCUMENTOS,
	});
	expect(screen.getByText("Contrato TC 52/SMIT/2024")).toBeInTheDocument();
	expect(screen.getByText(/competência julho\/2026/)).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "trocar contrato" }));
	expect(onBuscarContrato).toHaveBeenCalledTimes(1);
	// A busca não abre mais dentro da faixa.
	expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});

it("sem contrato achado: uma linha só, que reabre a busca", () => {
	const { onBuscarContrato } = renderizar({
		identificacao: { situacao: "nao-encontrado", leitura, sugestoes: [] },
	});
	expect(screen.getByText("O levantamento não identificou o contrato.")).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Buscar no cadastro" }));
	expect(onBuscarContrato).toHaveBeenCalledTimes(1);
});
```

(`nomeDaCompetencia` escreve `julho/2026` — `src/lib/confere/tipos-cadastro.ts:108`.)

- [ ] **Step 2: Reescrever os testes da tela (falham)**

`src/app/confere/page.test.tsx` inteiro:

```tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import ConferePage from "./page";

const PA_04 = {
	arquivoId: "pa-04",
	nome: "PA-PGM-251015-159 v5.0.pdf",
	origem: { tipo: "PRORROGACAO", numero: "TA 04", inicio: "2025-12-01" },
};
const PA_05 = {
	arquivoId: "pa-05",
	nome: "PA-PGM-260304-715.pdf",
	origem: { tipo: "ADITIVO", numero: "TA 05", inicio: "2026-04-30" },
};
const PC = {
	arquivoId: "pc",
	nome: "PC-PGM-240715-100 v7.0.pdf",
	origem: { tipo: "CONTRATO", numero: "TC 015/PGM/2024", inicio: "2024-12-01" },
};
const CONTRATO = {
	id: "ct-pgm",
	clienteId: "cl-pgm",
	clienteNome: "Procuradoria Geral do Município",
	clienteSigla: "PGM",
	numeroTermo: "TC 015/PGM/2024",
	descricao: null,
	vigenciaFim: "2025-11-30",
	ativo: true,
};
const DOCUMENTOS = {
	contrato: CONTRATO,
	competencia: { ano: 2026, mes: 7, lidaDaPlanilha: true },
	base: PA_04,
	aditivos: [PA_05],
	alternativas: [PC, PA_04, PA_05],
	decisoes: [
		{ rotulo: "Contrato inicial", papel: "fora", motivo: "já está dentro da renovação TA 04" },
		{ rotulo: "TA 04", papel: "base", motivo: null },
		{ rotulo: "TA 05", papel: "aditivo", motivo: null },
	],
	avisos: [
		{
			codigo: "fora-da-vigencia",
			texto: "Julho/2026 está depois do fim de vigência cadastrado (30/11/2025). Confira.",
		},
	],
};
const LEITURA = { referencia: "TC 015/PGM/2024", competencia: { ano: 2026, mes: 7 } };
const ENCONTRADO = { situacao: "encontrado", leitura: LEITURA, documentos: DOCUMENTOS };

const PASTAS_PGM = {
	cliente: { id: "cl-pgm", nome: "Procuradoria Geral do Município", sigla: "PGM" },
	arquivos: [
		{
			arquivoId: "pc",
			nome: "PC-PGM-240715-100 v7.0.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_COMERCIAL",
			pasta: ["TC 015-PGM-2024", "1) Contrato Inicial"],
		},
		{
			arquivoId: "pa-04",
			nome: "PA-PGM-251015-159 v5.0.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_ADITIVO",
			pasta: ["TC 015-PGM-2024", "5) TA 04 - Prorrogação"],
		},
		{
			arquivoId: "pa-05",
			nome: "PA-PGM-260304-715.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_ADITIVO",
			pasta: ["TC 015-PGM-2024", "6) TA 05"],
		},
	],
};

let espiao: jest.SpyInstance;
/** A resposta de `/levantamento` — cada teste pode trocar. */
let respostaDoLevantamento: () => Response | Promise<Response>;

beforeEach(() => {
	respostaDoLevantamento = () => Response.json(ENCONTRADO);
	espiao = jest.spyOn(global, "fetch").mockImplementation(async (entrada) => {
		const url = String(entrada);
		if (url.endsWith("/health")) return Response.json({ dormindo: false });
		if (url.endsWith("/levantamento")) return respostaDoLevantamento();
		if (url.includes("/api/confere/contratos/ct-pgm/documentos")) return Response.json(DOCUMENTOS);
		if (url.endsWith("/api/confere/clientes/cl-pgm/pastas")) return Response.json(PASTAS_PGM);
		return Response.json({ detail: "falha simulada" }, { status: 502 });
	});
});

afterEach(() => jest.restoreAllMocks());

function escolher(rotulo: string, ...arquivos: File[]) {
	fireEvent.change(screen.getByLabelText(rotulo), { target: { files: arquivos } });
}

function soltar(alvo: HTMLElement, ...arquivos: File[]) {
	const dataTransfer = { files: arquivos, types: ["Files"] };
	fireEvent.dragEnter(alvo, { dataTransfer });
	fireEvent.drop(alvo, { dataTransfer });
}

/** Uma resposta que só chega quando o teste mandar. */
function adiada() {
	let responder: (resposta: Response) => void = () => {};
	const promessa = new Promise<Response>((resolver) => {
		responder = resolver;
	});
	return { promessa, responder: (corpo: unknown) => responder(Response.json(corpo)) };
}

function corpoDaGeracao(): FormData {
	const chamada = espiao.mock.calls.find(([url]) => String(url).endsWith("/reports"));
	return chamada?.[1]?.body as FormData;
}

const PLANILHA = () => new File(["x"], "PGM_Levantamento.xlsx");

it("o início mostra só o levantamento", () => {
	render(<ConferePage />);
	expect(
		screen.getByRole("heading", { name: "Arraste a planilha de levantamento aqui" }),
	).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Escolher planilha" })).toBeInTheDocument();
	expect(screen.queryByLabelText("Contrato")).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Gerar relatório" })).not.toBeInTheDocument();
});

it("escolher a planilha abre o modal enquanto busca; achou, a tela mostra os documentos", async () => {
	const resposta = adiada();
	respostaDoLevantamento = () => resposta.promessa;
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());

	expect(
		await screen.findByRole("dialog", { name: "Buscando os documentos do contrato" }),
	).toBeInTheDocument();
	expect(screen.getByText(/Lendo a planilha e procurando o contrato/)).toBeInTheDocument();

	await act(async () => resposta.responder(ENCONTRADO));

	expect(await screen.findByText("PA-PGM-251015-159 v5.0.pdf")).toBeInTheDocument();
	expect(screen.getByText(/Do cadastro · TA 04, renovação desde 01\/12\/2025/)).toBeInTheDocument();
	expect(screen.getByText(/^1\. PA-PGM-260304-715\.pdf/)).toBeInTheDocument();
	expect(screen.getByText(/Contrato TC 015\/PGM\/2024/)).toBeInTheDocument();
	expect(screen.getByText(/fim de vigência cadastrado/)).toBeInTheDocument();
	await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("não achou: o modal pergunta, e a sugestão preenche", async () => {
	respostaDoLevantamento = () =>
		Response.json({ situacao: "nao-encontrado", leitura: LEITURA, sugestoes: [CONTRATO] });
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());

	expect(
		await screen.findByRole("dialog", { name: "O contrato TC 015/PGM/2024 não está no cadastro" }),
	).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: /TC 015\/PGM\/2024 · PGM/ }));

	expect(await screen.findByText("PA-PGM-251015-159 v5.0.pdf")).toBeInTheDocument();
	expect(
		espiao.mock.calls.some(([url]) =>
			String(url).includes("/contratos/ct-pgm/documentos?competencia=2026-07"),
		),
	).toBe(true);
});

it("Cancelar a busca volta ao início e ignora a resposta que chegar depois", async () => {
	const resposta = adiada();
	respostaDoLevantamento = () => resposta.promessa;
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());

	fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Escolher planilha" })).toBeInTheDocument();

	await act(async () => resposta.responder(ENCONTRADO));
	expect(screen.queryByText("PA-PGM-251015-159 v5.0.pdf")).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Escolher planilha" })).toBeInTheDocument();
});

it("sem número na planilha: Enviar o contrato do computador leva ao preenchimento à mão, com a planilha", async () => {
	respostaDoLevantamento = () =>
		Response.json({ situacao: "sem-referencia", leitura: { referencia: null, competencia: null } });
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());

	fireEvent.click(await screen.findByRole("button", { name: "Enviar o contrato do computador" }));
	expect(screen.getByLabelText("Contrato")).toBeInTheDocument();
	expect(screen.getByText("PGM_Levantamento.xlsx")).toBeInTheDocument();
	expect(screen.getByText("O levantamento não identificou o contrato.")).toBeInTheDocument();

	fireEvent.click(screen.getByRole("button", { name: "Buscar no cadastro" }));
	expect(
		await screen.findByRole("dialog", { name: "Não achamos o número do contrato neste levantamento" }),
	).toBeInTheDocument();
});

it("Preencher à mão mostra os três documentos e o que falta", () => {
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	expect(screen.getByLabelText("Levantamento")).toBeInTheDocument();
	expect(screen.getByLabelText("Contrato")).toBeInTheDocument();
	expect(screen.getByLabelText("Aditivos da proposta")).toBeInTheDocument();
	expect(screen.getByText("comece aqui")).toBeInTheDocument();
	expect(screen.getByText("Escolha o levantamento para começar.")).toBeInTheDocument();
});

it("proposta enviada do computador não é trocada pela do cadastro", async () => {
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	escolher("Contrato", new File(["%PDF"], "minha-proposta.pdf"));
	escolher("Levantamento", PLANILHA());

	expect(await screen.findByRole("button", { name: /Usar a proposta do cadastro/ })).toBeInTheDocument();
	expect(screen.getByText("minha-proposta.pdf")).toBeInTheDocument();
});

it("gera mandando as propostas do cadastro por referência", async () => {
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

	await waitFor(() => expect(corpoDaGeracao()).toBeDefined());
	expect(corpoDaGeracao().get("contrato_arquivo_id")).toBe("pa-04");
	expect(corpoDaGeracao().getAll("aditivos")).toEqual(["cadastro:pa-05"]);
	expect(corpoDaGeracao().get("contrato_id")).toBe("ct-pgm");
});

it("remover o aditivo tira ele do envio", async () => {
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Remover PA-PGM-260304-715.pdf" }));
	fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

	await waitFor(() => expect(corpoDaGeracao()).toBeDefined());
	expect(corpoDaGeracao().getAll("aditivos")).toEqual([]);
});

it("Procurar nas pastas põe outra proposta do contrato no campo Contrato", async () => {
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Procurar nas pastas do cliente" }));
	// A proposta em uso aparece marcada na pasta do termo.
	expect(await screen.findByRole("button", { name: /5\) TA 04 - Prorrogação.*em uso/ })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: /1\) Contrato Inicial/ }));
	fireEvent.click(screen.getByRole("radio", { name: /PC-PGM-240715-100 v7\.0\.pdf/ }));
	fireEvent.click(screen.getByRole("button", { name: "Usar este arquivo" }));

	expect(screen.getByText("PC-PGM-240715-100 v7.0.pdf")).toBeInTheDocument();
	// É uma das propostas do histórico: leva a origem de sempre, não a pasta.
	expect(screen.getByText(/Do cadastro · contrato inicial, desde 01\/12\/2024/)).toBeInTheDocument();
});

it("os documentos em linhas: o levantamento primeiro, cada um com o arquivo e de onde veio", async () => {
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	const linhas = Array.from(screen.getByRole("list", { name: "Documentos" }).children);
	expect(linhas.map((linha) => linha.querySelector("p")?.textContent)).toEqual([
		"Levantamento",
		"Contrato",
		"Aditivos da proposta",
	]);
	expect(linhas[0]).toHaveTextContent("PGM_Levantamento.xlsx");
	expect(linhas[0]).toHaveTextContent("Do computador");
	expect(linhas[1]).toHaveTextContent("Do cadastro · TA 04, renovação desde 01/12/2025");
});

it("Enviar do computador, no Contrato, abre o seletor do campo Contrato", () => {
	const clique = jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	fireEvent.click(screen.getByRole("button", { name: "Enviar do computador" }));
	expect(clique.mock.contexts[0]).toBe(screen.getByLabelText("Contrato"));
});

it("aditivos vazios numa linha só", () => {
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	expect(screen.getByText("Nenhum aditivo")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "+ Procurar nas pastas" })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "+ Enviar do computador" })).toBeInTheDocument();
});

it("soltar a planilha no início busca o contrato", async () => {
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
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	soltar(
		screen.getByText("Opcional. Um ou mais PDFs, aplicados na ordem da lista"),
		new File(["%PDF"], "a.pdf"),
		new File(["%PDF"], "b.pdf"),
	);
	expect(screen.getByText(/^1\. a\.pdf/)).toBeInTheDocument();
	expect(screen.getByText(/^2\. b\.pdf/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/app/confere`
Expected: FAIL em `page.test.tsx` (não há início só com o levantamento, nem modal) e em `FaixaDoContrato.test.tsx` (`onBuscarContrato` não existe; a faixa ainda mostra a busca).

- [ ] **Step 4: Criar `EntradaDoLevantamento.tsx`**

`src/app/confere/components/EntradaDoLevantamento.tsx`:

```tsx
"use client";

import { useRef } from "react";

import { useSoltarArquivos } from "./useSoltarArquivos";

interface Props {
	onEscolher: (arquivo: File) => void;
	onPreencherAMao: () => void;
	/** O botão "Escolher planilha" — destino do foco depois de Limpar (`R-LMP-09`). */
	refBotao: React.RefObject<HTMLButtonElement | null>;
}

function IconeDePlanilha() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto h-10 w-10 text-confere-teal-500">
			<path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
			<path d="M14 3v4h4M9 11h6M9 14h6M9 17h6M12 11v6" fill="none" stroke="currentColor" strokeWidth="1.6" />
		</svg>
	);
}

/** O começo da tela (docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md
 *  §3.1): só o levantamento — o contrato e os aditivos vêm do cadastro pela planilha.
 *
 *  Borda tracejada **no repouso**, ao contrário das linhas do formulário: aqui o cartão inteiro
 *  aceita a planilha solta, então o tracejado diz a verdade (`R-ACE-17`). */
export function EntradaDoLevantamento({ onEscolher, onPreencherAMao, refBotao }: Props) {
	const campo = useRef<HTMLInputElement>(null);
	const soltar = useSoltarArquivos({
		extensao: ".xlsx",
		multiplos: false,
		desabilitado: false,
		onSoltar: ([arquivo]) => onEscolher(arquivo),
		mensagemDeTipoErrado: (arquivo) => `O levantamento é a planilha .xlsx — ${arquivo.name} não é.`,
	});

	return (
		<>
			<section
				{...soltar.alvo}
				aria-labelledby="entrada-titulo"
				className={`relative rounded-lg border-2 border-dashed px-6 py-14 text-center shadow-sm transition ${
					soltar.arrastando
						? "border-confere-teal-500 bg-confere-teal-50"
						: "border-confere-teal-400 bg-white hover:border-confere-teal-500"
				}`}
			>
				<IconeDePlanilha />
				<h2 id="entrada-titulo" className="mt-4 text-lg font-semibold text-confere-navy-600">
					Arraste a planilha de levantamento aqui
				</h2>
				<p id="entrada-descricao" className="mt-1 text-sm text-confere-navy-300">
					Planilha de medição da competência, em XLSX
				</p>
				{/* Fora do Tab: o foco mora no botão que o aciona. */}
				<input
					ref={campo}
					type="file"
					accept=".xlsx"
					tabIndex={-1}
					className="sr-only"
					aria-label="Levantamento"
					aria-describedby="entrada-descricao"
					onChange={(evento) => {
						soltar.limparErro();
						const arquivo = evento.target.files?.[0];
						if (arquivo) onEscolher(arquivo);
					}}
				/>
				<button
					ref={refBotao}
					type="button"
					onClick={() => campo.current?.click()}
					className="mt-6 rounded-md bg-confere-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-confere-teal-600"
				>
					Escolher planilha
				</button>
				{soltar.erro && (
					<p className="mx-auto mt-4 max-w-md rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
						{soltar.erro}
					</p>
				)}
				{soltar.arrastando && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-confere-teal-50/95 text-base font-semibold text-confere-teal-600"
					>
						Solte a planilha aqui
					</div>
				)}
			</section>
			<p className="mt-4 text-sm text-confere-navy-600">
				Prefere enviar o contrato do computador?{" "}
				<button
					type="button"
					onClick={onPreencherAMao}
					className="font-semibold text-confere-teal-600 underline"
				>
					Preencher à mão
				</button>
			</p>
		</>
	);
}
```

- [ ] **Step 5: Reescrever `FaixaDoContrato.tsx`**

`src/app/confere/components/FaixaDoContrato.tsx` inteiro:

```tsx
"use client";

import { nomeDaCompetencia, type DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
import type { Identificacao } from "../lib/types";

interface Props {
	identificacao: Identificacao;
	/** O contrato em uso — achado pela planilha ou escolhido na busca. */
	documentos?: DocumentosDoContrato;
	/** O campo Contrato está com arquivo do computador: a proposta do cadastro
	 *  vira oferta, nunca troca sozinha. */
	contratoDoComputador: boolean;
	/** "trocar contrato" e "Buscar no cadastro": abrem o modal da busca. */
	onBuscarContrato: () => void;
	onUsarDoCadastro: () => void;
}

/** A planilha foi lida e o contrato não saiu dela — a pergunta foi feita no
 *  modal, e a pessoa seguiu à mão. */
const SEM_CONTRATO: ReadonlySet<Identificacao["situacao"]> = new Set([
	"ambiguo",
	"nao-encontrado",
	"sem-referencia",
	"ilegivel",
	"falhou",
]);

/** O resumo em cima dos documentos: de qual contrato a planilha é, o que foi
 *  escolhido e por quê. Buscar e escolher contrato moram no modal
 *  (`BuscaDoContratoModal`, desenho de 28/09/2026 §3.2) — aqui só o resultado.
 *
 *  `role="status"` com `id` próprio: o inventário de anúncios da tela resolve
 *  por `id`, e dois `status` sem distinção quebrariam a varredura. */
export function FaixaDoContrato({
	identificacao,
	documentos,
	contratoDoComputador,
	onBuscarContrato,
	onUsarDoCadastro,
}: Props) {
	if (documentos) {
		const { contrato, competencia } = documentos;
		return (
			<div
				id="contrato-identificado"
				role="status"
				className="mb-4 rounded-md border border-confere-teal-100 bg-confere-teal-50/40 p-4 text-sm text-confere-navy-600"
			>
				<p>
					<strong>Contrato {contrato.numeroTermo ?? "sem número"}</strong> · {contrato.clienteNome} ·
					competência {nomeDaCompetencia(competencia)} ·{" "}
					<a
						href={`/clientes/${contrato.clienteId}/contratos/${contrato.id}`}
						target="_blank"
						rel="noreferrer"
						className="font-semibold text-confere-teal-600 underline"
					>
						abrir contrato
					</a>{" "}
					·{" "}
					<button
						type="button"
						onClick={onBuscarContrato}
						className="font-semibold text-confere-teal-600 underline"
					>
						trocar contrato
					</button>
				</p>
				{!competencia.lidaDaPlanilha && (
					<p className="mt-1 text-xs">
						Competência não lida na planilha — usamos o mês atual para escolher os aditivos.
					</p>
				)}
				{contratoDoComputador && documentos.base && (
					<p className="mt-2 text-xs">
						O campo Contrato está com o arquivo enviado do computador.{" "}
						<button
							type="button"
							onClick={onUsarDoCadastro}
							className="font-semibold text-confere-teal-600 underline"
						>
							Usar a proposta do cadastro ({documentos.base.nome})
						</button>
					</p>
				)}
				{documentos.avisos.length > 0 && (
					<ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
						{documentos.avisos.map((aviso) => (
							<li key={aviso.texto}>{aviso.texto}</li>
						))}
					</ul>
				)}
				{documentos.decisoes.length > 0 && (
					<details className="mt-3 text-xs">
						<summary className="cursor-pointer">Como os documentos foram escolhidos</summary>
						<ul className="mt-2 space-y-0.5">
							{documentos.decisoes.map((decisao, indice) => (
								<li key={`${decisao.rotulo}-${indice}`}>
									<strong>{decisao.rotulo}</strong>:{" "}
									{decisao.papel === "base"
										? "proposta-base (campo Contrato)"
										: decisao.papel === "aditivo"
											? "aplicado como aditivo"
											: decisao.motivo}
								</li>
							))}
						</ul>
					</details>
				)}
			</div>
		);
	}

	if (SEM_CONTRATO.has(identificacao.situacao)) {
		return (
			<p
				id="contrato-identificado"
				role="status"
				className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
			>
				<strong>O levantamento não identificou o contrato.</strong>{" "}
				<button type="button" onClick={onBuscarContrato} className="font-semibold underline">
					Buscar no cadastro
				</button>
			</p>
		);
	}

	return null;
}
```

- [ ] **Step 6: `UploadForm.tsx` sem `refPrimeiroCampo`**

1. Em `Props`, apagar `refPrimeiroCampo` (e o comentário dele); na desestruturação, apagar `refPrimeiroCampo,`.
2. Depois de `const campoDoContrato = useRef<HTMLInputElement>(null);` acrescentar:

```tsx
	const campoDoLevantamento = useRef<HTMLInputElement>(null);
```

3. Na linha do Levantamento: `ref={refPrimeiroCampo}` → `ref={campoDoLevantamento}`, e no botão `refPrimeiroCampo.current?.click()` → `campoDoLevantamento.current?.click()`.

- [ ] **Step 7: `page.tsx` em fases**

Em `src/app/confere/page.tsx`:

1. Imports: acrescentar `import { BuscaDoContratoModal } from "./components/BuscaDoContratoModal";` e `import { EntradaDoLevantamento } from "./components/EntradaDoLevantamento";` (em ordem alfabética com os outros de `./components/`).

2. Antes de `export default function ConferePage()`:

```tsx
/** A busca do contrato em modal (desenho de 28/09/2026 §3.2): a da planilha,
 *  que pergunta quando não acha, ou a do "trocar contrato". */
type Busca = { aberto: boolean; motivo: "planilha" | "trocar" };
const BUSCA_FECHADA: Busca = { aberto: false, motivo: "planilha" };
```

3. Estados novos, depois de `const [chaveAditivos, …]`:

```tsx
	// Trocar `const [chaveLevantamento] = useState(0);` (Task 3) por:
	const [chaveLevantamento, setChaveLevantamento] = useState(0);
	// "Preencher à mão": o formulário inteiro sem a planilha ter achado o
	// contrato (desenho de 28/09/2026 §3).
	const [manual, setManual] = useState(false);
	const [busca, setBusca] = useState<Busca>(BUSCA_FECHADA);
	const [carregandoContrato, setCarregandoContrato] = useState(false);
```

4. `const primeiroCampo = useRef<HTMLInputElement>(null);` → `const primeiroCampo = useRef<HTMLButtonElement>(null);` e trocar o comentário do efeito `R-LMP-09` para dizer que o destino agora é o *Escolher planilha* do início (depois de Limpar a tela sempre volta ao início).

5. Em `confirmarLimpeza`, antes de `setChave((n) => n + 1);`:

```tsx
		setManual(false);
		setBusca(BUSCA_FECHADA);
		setCarregandoContrato(false);
```

6. Em `selecionar`, trocar a última linha `if (campo === "levantamento") void identificar(arquivo);` por:

```tsx
		if (campo === "levantamento") {
			if (arquivo) setBusca({ aberto: true, motivo: "planilha" });
			void identificar(arquivo);
		}
```

7. Em `identificar`, trocar

```tsx
		setIdentificacao(resposta);
		if (resposta.situacao === "encontrado") aplicarDocumentos(resposta.documentos);
		else limparDoCadastro();
```

por

```tsx
		setIdentificacao(resposta);
		if (resposta.situacao === "encontrado") {
			aplicarDocumentos(resposta.documentos);
			// Achou: o modal fecha sozinho (depois do tempo mínimo) e a tela mostra
			// os documentos. Não achou: o modal continua e pergunta.
			setBusca(BUSCA_FECHADA);
		} else limparDoCadastro();
```

8. Trocar `escolherContrato` inteira por:

```tsx
	/** Contrato escolhido à mão — empate, sugestão, busca ou "trocar contrato" —,
	 *  na competência que a planilha disse. O modal mostra a espera. */
	async function escolherContrato(contratoId: string) {
		// O mesmo contador da planilha: Cancelar descarta esta resposta também.
		const pedido = ++pedidoDeIdentificacao.current;
		const competencia = "leitura" in identificacao ? identificacao.leitura.competencia : null;
		setCarregandoContrato(true);
		const novos = await documentosDoContrato(contratoId, competencia);
		if (pedido !== pedidoDeIdentificacao.current) return;
		setCarregandoContrato(false);
		if (!novos) {
			setIdentificacao({ situacao: "falhou" });
			setBusca({ aberto: true, motivo: "planilha" });
			return;
		}
		entradaMudou();
		aplicarDocumentos(novos);
		setBusca(BUSCA_FECHADA);
	}

	/** Cancelar e `Esc` no modal da busca (desenho de 28/09/2026 §3.2). */
	function cancelarBusca() {
		// A resposta que chegar depois é de uma busca que a pessoa desistiu.
		pedidoDeIdentificacao.current += 1;
		if (carregandoContrato) {
			// Desistiu do contrato escolhido: o modal volta à pergunta (ou à busca).
			setCarregandoContrato(false);
			return;
		}
		setBusca(BUSCA_FECHADA);
		if (busca.motivo === "trocar") return;
		// Desistiu da planilha: ela sai, e com ela o que o cadastro tinha posto. O
		// que veio do computador fica — e segura a tela no preenchimento à mão.
		setArquivos((atual) => ({ ...atual, levantamento: undefined }));
		setChaveLevantamento((n) => n + 1);
		setIdentificacao({ situacao: "ociosa" });
		limparDoCadastro();
	}

	/** Da pergunta do modal: segue à mão, com a planilha. */
	function enviarDoComputador() {
		setBusca(BUSCA_FECHADA);
		setManual(true);
	}

	/** "trocar contrato" (com contrato) ou "Buscar no cadastro" (sem): reabre o modal. */
	function buscarContrato() {
		setBusca({ aberto: true, motivo: documentos ? "trocar" : "planilha" });
	}
```

9. Depois do cálculo de `dica`, acrescentar:

```tsx
	// A fase da tela (desenho de 28/09/2026 §3): o início é só o levantamento;
	// com o contrato achado, conferir; o que veio do computador, ou "Preencher à
	// mão", segura o formulário inteiro.
	const temDoComputador =
		arquivos.contrato !== undefined || aditivos.some((peca) => peca.tipo === "arquivo");
	const fase: "inicio" | "manual" | "conferir" = documentos
		? "conferir"
		: manual || temDoComputador
			? "manual"
			: "inicio";
```

10. No JSX, trocar o bloco `<UploadForm … />` por:

```tsx
				{fase === "inicio" ? (
					<EntradaDoLevantamento
						key={`${chave}-${chaveLevantamento}`}
						onEscolher={(arquivo) => selecionar("levantamento", arquivo)}
						onPreencherAMao={() => setManual(true)}
						refBotao={primeiroCampo}
					/>
				) : (
					<UploadForm
						levantamento={arquivos.levantamento}
						contrato={contrato}
						onSelecionar={selecionar}
						aditivos={aditivos}
						onSelecionarAditivos={selecionarAditivos}
						onRemoverAditivo={removerAditivo}
						semAditivos={documentos ? "Nenhum aditivo depois da proposta-base" : "Nenhum aditivo"}
						onProcurarContrato={() => setJanela({ aberto: true, finalidade: "contrato" })}
						onProcurarAditivos={() => setJanela({ aberto: true, finalidade: "aditivos" })}
						dica={dica}
						faixa={
							<FaixaDoContrato
								identificacao={identificacao}
								documentos={documentos}
								contratoDoComputador={arquivos.contrato !== undefined}
								onBuscarContrato={buscarContrato}
								onUsarDoCadastro={usarDoCadastro}
							/>
						}
						onEnviar={() => void enviar()}
						processando={estado.situacao === "processando"}
						chave={chave}
						chaveLevantamento={chaveLevantamento}
						chaveContrato={chaveContrato}
						chaveAditivos={chaveAditivos}
						podeLimpar={podeLimpar}
						onLimpar={() => setConfirmando(true)}
						refLimpar={limpar}
						refAditivos={campoDeAditivos}
						perguntaDeIdentidade={pergunta}
						onGerarAssimMesmo={() => void enviar(true)}
						onDescartarPergunta={() => setPergunta(undefined)}
					/>
				)}
```

11. No `<JanelaDePastas …>`, acrescentar depois de `arquivoInicial=…`:

```tsx
				emUso={[
					...(contratoDoCadastro && !arquivos.contrato ? [contratoDoCadastro.arquivoId] : []),
					...aditivos.flatMap((peca) => (peca.tipo === "cadastro" ? [peca.documento.arquivoId] : [])),
				]}
				jaNaLista={aditivos.flatMap((peca) =>
					peca.tipo === "cadastro" ? [peca.documento.arquivoId] : [],
				)}
```

12. Depois do `<JanelaDePastas … />`, acrescentar:

```tsx
			{/* A busca do contrato, fora do `<form>` como os outros diálogos. */}
			<BuscaDoContratoModal
				aberto={busca.aberto}
				motivo={busca.motivo}
				nomeDaPlanilha={arquivos.levantamento?.name}
				identificacao={identificacao}
				carregandoContrato={carregandoContrato}
				onEscolherContrato={(contratoId) => void escolherContrato(contratoId)}
				onCancelar={cancelarBusca}
				onEnviarDoComputador={enviarDoComputador}
				onTrocarPlanilha={(arquivo) => selecionar("levantamento", arquivo)}
			/>
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx jest src/app/confere`
Expected: todas passando (7 suítes). Se "Cancelar a busca…" achar dois botões "Cancelar", é o `ConfirmarLimpeza` — ele fica fechado e o jsdom esconde `<dialog>` fechado; confira que `findByRole` (e não `findByText`) está sendo usado.

- [ ] **Step 9: Tipos e lint**

Run: `npx tsc --noEmit -p . && npx eslint src/app/confere`
Expected: sem erro novo.

- [ ] **Step 10: Commit**

```bash
git add src/app/confere/components/EntradaDoLevantamento.tsx src/app/confere/components/FaixaDoContrato.tsx src/app/confere/components/FaixaDoContrato.test.tsx src/app/confere/components/UploadForm.tsx src/app/confere/page.tsx src/app/confere/page.test.tsx
git commit -m "feat(confere): so o levantamento no inicio e a busca do contrato em modal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Na tela, e os documentos

**Files:**
- Modify: `docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md` (status)
- Modify: `docs/superpowers/plans/2026-09-28-confere-levantamento-primeiro.md` (Andamento)
- Modify: `CLAUDE.md` (seção "Integração do Confere") — **sem commitar**: o arquivo tem mudanças pendentes do usuário.

- [ ] **Step 1: Ver na tela**

Subir o dev (`preview_start` com `verai-dev`), entrar em `/confere` e conferir, com screenshot:
1. Início: só o cartão tracejado, "Escolher planilha" e "Preencher à mão".
2. Escolher um levantamento real (ex.: o CGM de `arquivos-teste-conversao`/pasta do usuário, se disponível): o modal aparece, some, e a tela mostra resumo + três linhas.
3. "Procurar nas pastas do cliente": janela maior, Voltar, "em uso" na pasta do termo, rodapé.
4. Largura de celular (375 px): as linhas empilham, sem rolagem horizontal.
5. Limpar → confirma → volta ao início com o foco em "Escolher planilha".

Se precisar de login e não houver credencial de teste no projeto, parar e pedir ao usuário para entrar no navegador do app.

- [ ] **Step 2: Documentos**

- No design: `**Status**: Aprovado com o usuário em 28/09/2026 e implementado no mesmo dia — plano docs/superpowers/plans/2026-09-28-confere-levantamento-primeiro.md, commits <primeiro>…<último>. Sem migração, sem mudança de API.`
- No plano: preencher "Andamento" com os commits, a contagem de testes e o que se viu na tela.
- No `CLAUDE.md`, seção "Integração do Confere", depois do item "Área solta no menu…", acrescentar:

```markdown
- **Tela em fases** (28/09/2026): o início é só o levantamento (`EntradaDoLevantamento`); a busca do
  contrato abre um modal (`BuscaDoContratoModal`) que fecha sozinho quando acha (tempo mínimo de
  600 ms) e pergunta quando não acha (sugestões, busca, enviar do computador, trocar planilha); os
  documentos viram linhas de conferência; a janela de pastas tem Voltar, "em uso" e duplo clique. A
  regra da busca não mudou. Design `docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md`.
```

- [ ] **Step 3: Commit (sem o `CLAUDE.md`)**

```bash
git add docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md docs/superpowers/plans/2026-09-28-confere-levantamento-primeiro.md
git commit -m "docs(confere): levantamento primeiro implementado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Avisar o usuário que o `CLAUDE.md` ficou editado e não commitado, junto com as mudanças que já estavam pendentes nele.
