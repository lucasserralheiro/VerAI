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
							{/* A altura da janela carregada (busca + caminho + lista): ela não
							    muda de tamanho quando as pastas chegam. */}
							<ul aria-hidden="true" className="h-[29.125rem] space-y-2 overflow-hidden pt-12">
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
										{/* Uma linha só, com os trechos longos cortados (o nome inteiro
										    no `title`): quebrar em duas linhas mudava a altura da janela
										    a cada pasta. */}
										<nav
											aria-label="Caminho"
											className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap"
										>
											<button
												type="button"
												onClick={() => setCaminho([])}
												className="shrink-0 font-semibold text-confere-teal-600 underline"
											>
												{nomeDoCliente}
											</button>
											{caminho.map((parte, i) => (
												<span
													key={`${i}-${parte}`}
													className={`flex min-w-0 items-center gap-1 ${i === caminho.length - 1 ? "" : "max-w-[14rem] shrink-0"}`}
												>
													<span aria-hidden="true">›</span>
													{i === caminho.length - 1 ? (
														<span title={parte} className="truncate font-semibold text-confere-navy-600">
															{parte}
														</span>
													) : (
														<button
															type="button"
															title={parte}
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
