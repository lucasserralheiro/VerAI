"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { VisualizadorPdfTrecho } from "../../propostas-comerciais/[id]/visualizador-pdf-trecho";
import type { LinhaDoGrid, LinhaZerada } from "../lib/types";
import { TrechoDaPlanilha } from "./TrechoDaPlanilha";

/** Um PDF em que o item pode estar: a proposta-base ou um aditivo. Vem do
 *  cadastro (`url`) ou do computador (`arquivo`). */
export interface FonteDoContrato {
	rotulo: string;
	url?: string;
	arquivo?: File;
}

type Abrir = (linha: LinhaDoGrid, situacao?: string) => void;

const Contexto = createContext<Abrir | undefined>(undefined);

/** `undefined` quando não há PDF para abrir (o histórico, por exemplo, não guarda
 *  os arquivos de entrada) — quem usa o hook só torna a linha clicável se vier a
 *  função. */
export function useAbrirItemNoContrato() {
	return useContext(Contexto);
}

/** Dá às tabelas de itens a ação "conferir este item contra o contrato" e guarda
 *  o modal que a executa. Fica num contexto para não passar a função por quatro
 *  componentes até a linha da tabela. */
export function ItemNoContratoProvider({
	fontes,
	planilha,
	zeradas = [],
	children,
}: {
	fontes: FonteDoContrato[];
	/** A planilha de levantamento, para mostrar o trecho do item ao lado do PDF. */
	planilha?: FonteDoContrato;
	/** Os itens que o relatório zerou (ESPEC 031): a planilha traz um medido que o relatório não usa. */
	zeradas?: LinhaZerada[];
	children: React.ReactNode;
}) {
	const [aberto, setAberto] = useState<{ linha: LinhaDoGrid; situacao?: string } | null>(null);
	const abrir = useCallback<Abrir>((linha, situacao) => setAberto({ linha, situacao }), []);

	return (
		<Contexto.Provider value={fontes.length > 0 ? abrir : undefined}>
			{children}
			<ItemNoContratoModal
				fontes={fontes}
				planilha={planilha}
				zeradas={zeradas}
				aberto={aberto}
				onFechar={() => setAberto(null)}
			/>
		</Contexto.Provider>
	);
}

/** A faixa que diz, de longe, de qual documento é cada lado: verde para a
 *  planilha de levantamento, azul-marinho para o contrato. Texto grande e cor
 *  cheia — a conferência é entre os dois, e confundir um com o outro é o erro
 *  que a tela precisa evitar. */
function FaixaDeOrigem({
	tom,
	titulo,
	arquivo,
	children,
}: {
	tom: "planilha" | "contrato";
	titulo: string;
	arquivo?: string;
	children?: React.ReactNode;
}) {
	return (
		<div
			className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-white ${tom === "planilha" ? "bg-emerald-700" : "bg-confere-brand-navy"}`}
		>
			<p className="text-base font-bold uppercase tracking-wide">{titulo}</p>
			{arquivo && (
				<p className="min-w-0 flex-1 truncate text-sm text-white/90" title={arquivo}>
					{arquivo}
				</p>
			)}
			{children}
		</div>
	);
}

/** Quando o código não está em nenhum PDF. Em vez de abrir a capa do contrato com
 *  um "não achei" no canto — que parecia um defeito da tela —, diz o que isso
 *  significa para o item e o que fazer. Código ausente do contrato é um resultado
 *  legítimo da conferência: o Confere trata o item como contratado 0. */
function CodigoNaoEncontrado({
	linha,
	rotulo,
	todos,
	onVerMesmoAssim,
	onLeitorCompleto,
}: {
	linha: LinhaDoGrid;
	rotulo?: string;
	todos: boolean;
	onVerMesmoAssim: () => void;
	onLeitorCompleto: () => void;
}) {
	const semContratado = Number(linha.contratada.replace(/\./g, "").replace(",", ".")) === 0;
	const semMedido = Number(linha.medida.replace(/\./g, "").replace(",", ".")) === 0;
	return (
		<div role="status" className="flex h-full flex-col justify-center gap-4 rounded-md border border-amber-200 bg-amber-50 p-6 text-amber-900">
			<h3 className="text-lg font-bold">
				O código <span className="font-mono">{linha.codigo}</span>{" "}
				{todos ? "não está em nenhum dos PDFs" : "não está neste PDF"}
			</h3>
			<p className="text-base">
				Procurei em todas as páginas{rotulo ? <> de <strong className="font-semibold">{rotulo.split(" · ").slice(1).join(" · ") || rotulo}</strong></> : null}
				{todos ? " e nos outros PDFs do contrato" : ""}.
			</p>
			{semContratado ? (
				<p className="text-base">
					A planilha também traz <strong>contratado 0</strong> para este item: as duas fontes concordam que ele
					não está previsto
					{semMedido ? (
						"; o medido também é 0, e o saldo fica 0."
					) : (
						<>, e o medido ({linha.medida}) aparece como saldo negativo.</>
					)}{" "}
					Confira se o item consta no contrato com outro código, se falta anexar um aditivo ou se ele não
					deveria ter sido medido.
				</p>
			) : (
				<p className="text-base">
					A planilha diz <strong>contratado {linha.contratada}</strong>, mas o PDF não mostra este código. Se o
					PDF for digitalizado (imagem), a busca por texto não funciona: abra no leitor completo e procure
					com Ctrl+F.
				</p>
			)}
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					onClick={onVerMesmoAssim}
					className="rounded-md border border-confere-brand-navy bg-white px-5 py-2.5 text-sm font-semibold text-confere-brand-navy transition hover:bg-confere-navy-50"
				>
					Ver o PDF mesmo assim
				</button>
				<button
					type="button"
					onClick={onLeitorCompleto}
					className="rounded-md border border-confere-brand-navy bg-white px-5 py-2.5 text-sm font-semibold text-confere-brand-navy transition hover:bg-confere-navy-50"
				>
					Abrir no leitor completo
				</button>
			</div>
		</div>
	);
}

const SEM_ESPACO = (texto: string) => texto.replace(/\s+/g, "");

/** O item que o relatório zerou: a planilha tem o número, o relatório não o usa. Sem este aviso,
 *  quem abre o item vê "medido 0" ao lado de uma planilha que mostra outro valor e conclui que a
 *  tela errou. Os números e os nomes dos blocos são os que o Confere devolveu, sem nada inventado. */
function ItemZerado({ zerada }: { zerada: LinhaZerada }) {
	return (
		<p
			role="note"
			className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
		>
			<strong className="font-semibold">O medido deste item foi zerado pelo relatório.</strong> Na linha{" "}
			{zerada.linha} da planilha, em &ldquo;{zerada.bloco_bruto}&rdquo;, o medido é{" "}
			<strong className="font-semibold">{zerada.medida}</strong>. O item não aparece em &ldquo;
			{zerada.bloco_descontado}&rdquo;, e por isso o relatório entrou com {zerada.saiu} (contratado / medido). O
			zero é do relatório, não da planilha.
		</p>
	);
}

const COMO_NUMERO = (texto: string) => Number(texto.replace(/\./g, "").replace(",", "."));

/** Diz, em palavras e no alto do painel da planilha, por que o item está marcado. As duas
 *  quantidades do relatório — contratado e medido — vêm da planilha (colunas D e E; ESPEC
 *  R-REL-04), e é entre elas que a marca é decidida. O contrato não entra na marca: ele serve
 *  para conferir o contratado, e a diferença entre contrato e planilha tem checagem própria
 *  ("Divergência de contratado"). Sem este texto a tela mostrava a marca sem o motivo. */
function PorQueDiverge({ linha, situacao }: { linha: LinhaDoGrid; situacao?: string }) {
	const contratado = COMO_NUMERO(linha.contratada);
	const medido = COMO_NUMERO(linha.medida);
	if (!Number.isFinite(contratado) || !Number.isFinite(medido) || contratado === medido) return null;
	const motivo =
		medido === 0 ? (
			<>
				A planilha traz contratado <strong>{linha.contratada}</strong> e medido <strong>0</strong> para este
				item: nada foi medido na competência.
			</>
		) : medido > contratado ? (
			<>
				A planilha traz medido <strong>{linha.medida}</strong> acima do contratado{" "}
				<strong>{linha.contratada}</strong>: consumo sem cobertura.
			</>
		) : (
			<>
				A planilha traz medido <strong>{linha.medida}</strong> abaixo do contratado{" "}
				<strong>{linha.contratada}</strong>: entrega parcial.
			</>
		);
	return (
		<div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
			<p>
				<strong>{situacao ?? "Diverge"}.</strong> {motivo}
			</p>
			<p className="mt-1 text-amber-800">
				As duas quantidades vêm da planilha (colunas D e E). O contrato, ao lado, serve para conferir o
				contratado: se ele diferir da planilha, aparece em &ldquo;Divergência de contratado&rdquo;, não nesta
				marca.
			</p>
		</div>
	);
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
	return (
		<div>
			<dt className="text-sm text-confere-navy-600">{rotulo}</dt>
			<dd className="text-base font-semibold tabular-nums text-confere-navy-800">{children}</dd>
		</div>
	);
}

/** A conferência de um item, lado a lado: à esquerda o que o relatório diz dele
 *  (descrição, contratado, medido na planilha, saldo); à direita o PDF do
 *  contrato aberto na página em que o código aparece, com o código destacado.
 *
 *  O visualizador é o mesmo da Proposta Comercial: desenha a página, acha o
 *  trecho e pinta. Procura primeiro na proposta-base e, não achando, passa
 *  sozinho ao aditivo seguinte; trocar de PDF à mão também vale.
 *
 *  `<dialog>` nativo com `showModal()`, como os outros diálogos do Confere. Sem
 *  rolagem dupla: o diálogo tem altura fixa e só o visualizador rola. */
function ItemNoContratoModal({
	fontes,
	planilha,
	zeradas,
	aberto,
	onFechar,
}: {
	fontes: FonteDoContrato[];
	planilha?: FonteDoContrato;
	zeradas: LinhaZerada[];
	aberto: { linha: LinhaDoGrid; situacao?: string } | null;
	onFechar: () => void;
}) {
	const dialogo = useRef<HTMLDialogElement>(null);
	const linha = aberto?.linha ?? null;
	const codigo = linha?.codigo ?? null;
	const zerada = linha ? zeradas.find((z) => SEM_ESPACO(z.codigo) === SEM_ESPACO(linha.codigo)) : undefined;
	const [urls, setUrls] = useState<string[]>([]);
	const [indice, setIndice] = useState(0);
	const [manual, setManual] = useState(false);
	const [semAchado, setSemAchado] = useState(false);
	// Procurou em todos os PDFs sozinho (e não só no que a pessoa escolheu).
	const [procurouTodos, setProcurouTodos] = useState(false);
	// A pessoa pediu para ver o PDF mesmo sem o código ter sido achado.
	const [verMesmoAssim, setVerMesmoAssim] = useState(false);
	// Os códigos da página aberta do PDF, de cima para baixo: a planilha é mostrada
	// nessa mesma ordem, para a conferência linha a linha.
	const [ordemDoPdf, setOrdemDoPdf] = useState<string[]>([]);
	// A lista é refeita a cada render da página; o efeito de abertura só deve rodar
	// quando o modal abre, e não zerar a busca no meio dela.
	const fontesRef = useRef(fontes);
	fontesRef.current = fontes;

	useEffect(() => {
		const el = dialogo.current;
		if (!el) return;
		if (linha && !el.open) el.showModal();
		else if (!linha && el.open) el.close();
	}, [linha]);

	// Arquivo do computador vira URL temporária só enquanto o modal está aberto.
	useEffect(() => {
		if (!codigo) {
			setUrls([]);
			return;
		}
		const criadas: string[] = [];
		setUrls(
			fontesRef.current.map((fonte) => {
				if (fonte.url) return fonte.url;
				const url = URL.createObjectURL(fonte.arquivo as File);
				criadas.push(url);
				return url;
			}),
		);
		setIndice(0);
		setManual(false);
		setSemAchado(false);
		setProcurouTodos(false);
		setVerMesmoAssim(false);
		setOrdemDoPdf([]);
		return () => {
			for (const url of criadas) URL.revokeObjectURL(url);
		};
	}, [codigo]);

	const urlAtual = urls[indice];

	function naoEncontrado() {
		if (!manual && indice < fontes.length - 1) {
			setIndice(indice + 1);
			return;
		}
		setSemAchado(true);
		setProcurouTodos(!manual);
	}

	function escolher(posicao: number) {
		setManual(true);
		setSemAchado(false);
		setProcurouTodos(false);
		setVerMesmoAssim(false);
		setIndice(posicao);
	}

	return (
		<dialog
			ref={dialogo}
			onClose={onFechar}
			onClick={(evento) => {
				if (evento.target === dialogo.current) onFechar();
			}}
			aria-labelledby="item-contrato-titulo"
			className="h-[94vh] w-[min(96rem,calc(100vw-1.5rem))] max-w-none flex-col rounded-lg border border-confere-line bg-white p-0 shadow-lg backdrop:bg-black/40 open:flex"
		>
			{linha && (
				<>
					<div className="flex shrink-0 items-center justify-between gap-4 border-b border-confere-line px-5 py-2">
						<h2 id="item-contrato-titulo" className="text-base font-semibold text-confere-navy-800">
							Conferir item <span className="font-mono">{linha.codigo}</span>
						</h2>
						<button
							type="button"
							onClick={onFechar}
							className="shrink-0 rounded-md border border-confere-brand-navy bg-white px-4 py-1.5 text-sm font-semibold text-confere-brand-navy transition hover:bg-confere-navy-50"
						>
							Fechar
						</button>
					</div>

					<div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[clamp(32rem,44%,42rem)_minmax(0,1fr)] lg:grid-rows-1">
						<aside className="max-h-[45vh] overflow-y-auto border-b-4 border-emerald-700 lg:max-h-none lg:border-b-0 lg:border-r-4">
							<FaixaDeOrigem tom="planilha" titulo="Planilha de levantamento" arquivo={planilha?.rotulo} />
							<div className="space-y-4 p-4">
								<PorQueDiverge linha={linha} situacao={aberto?.situacao} />
								{planilha && <TrechoDaPlanilha fonte={planilha} codigo={linha.codigo} ordem={ordemDoPdf} />}

								<section aria-labelledby="item-planilha" className="border-t border-confere-line pt-5">
									<h3 id="item-planilha" className="text-sm font-bold uppercase tracking-wide text-confere-navy-600">
										O que o relatório diz deste item
									</h3>
									<p className="mt-2 text-base text-confere-navy-800">{linha.descricao}</p>
									<p className="mt-0.5 text-sm text-confere-navy-600">Unidade: {linha.unidade}</p>
									<dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
										<Campo rotulo="Contratado (planilha)">{linha.contratada}</Campo>
										<Campo rotulo="Medido (no relatório)">{linha.medida}</Campo>
										<Campo rotulo="Saldo">
											<span className={linha.saldo.trim().startsWith("-") ? "text-confere-severidade-critico" : ""}>
												{linha.saldo}
											</span>
										</Campo>
										{aberto?.situacao && <Campo rotulo="Situação">{aberto.situacao}</Campo>}
									</dl>
									{zerada && <ItemZerado zerada={zerada} />}
									<p className="mt-4 text-sm text-confere-navy-600">
										Confira se o <strong className="font-semibold">contratado</strong> é o que o contrato, ao
										lado, traz para este item. O código aparece destacado.
									</p>
								</section>
							</div>
						</aside>

						<div className="flex min-h-0 min-w-0 flex-col">
							<FaixaDeOrigem
								tom="contrato"
								titulo={(fontes[indice]?.rotulo.split(" · ")[0] ?? "Contrato").toLocaleUpperCase("pt-BR")}
								arquivo={fontes[indice]?.rotulo.split(" · ").slice(1).join(" · ") || undefined}
							>
								{fontes.length > 1 && (
									<div role="group" aria-label="PDF em que procurar" className="flex flex-wrap items-center gap-2">
										<span className="text-sm font-semibold text-white/90">Procurar em:</span>
										{fontes.map((fonte, posicao) => (
											<button
												key={fonte.rotulo}
												type="button"
												aria-pressed={posicao === indice}
												onClick={() => escolher(posicao)}
												title={fonte.rotulo}
												className={`max-w-[14rem] truncate rounded-md border px-3 py-1 text-sm font-semibold transition ${
													posicao === indice
														? "border-white bg-white text-confere-brand-navy"
														: "border-white/60 bg-transparent text-white hover:bg-white/15"
												}`}
											>
												{fonte.rotulo.split(" · ")[0]}
											</button>
										))}
									</div>
								)}
							</FaixaDeOrigem>
							<div className="min-h-0 min-w-0 flex-1 p-2">
								{semAchado && !verMesmoAssim ? (
									<CodigoNaoEncontrado
										linha={linha}
										rotulo={fontes[indice]?.rotulo}
										todos={procurouTodos && fontes.length > 1}
										onVerMesmoAssim={() => setVerMesmoAssim(true)}
										onLeitorCompleto={() => urlAtual && window.open(urlAtual, "_blank", "noreferrer")}
									/>
								) : (
									urlAtual && (
									<VisualizadorPdfTrecho
										key={`${codigo}-${indice}`}
										url={urlAtual}
										pagina={1}
										destaque={linha.codigo}
										procurarPagina={!verMesmoAssim}
										recorte
										onNaoEncontrado={naoEncontrado}
										onCodigosDaPagina={setOrdemDoPdf}
										onAbrirLeitorCompleto={() => window.open(urlAtual, "_blank", "noreferrer")}
									/>
									)
								)}
							</div>
						</div>
					</div>
				</>
			)}
		</dialog>
	);
}
