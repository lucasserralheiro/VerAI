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
