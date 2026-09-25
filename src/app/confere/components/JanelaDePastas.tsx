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
	return {
		arquivoId: arquivo.arquivoId,
		nome: arquivo.nome,
		origem: null,
		pasta: arquivo.pasta.at(-1) ?? null,
	};
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

/** A janela "Pastas do cliente" (docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md
 *  §3.5): as pastas do SharePoint do cliente, só para procurar e escolher — nada aqui muda arquivo
 *  ou pasta.
 *
 *  `<dialog>` nativo com `showModal()`, como o `ConfirmarLimpeza`: foco preso, `Esc` e fundo
 *  inerte sem ARIA escrita à mão. Mora em `page.tsx`, fora do `<form>` do `UploadForm`. */
export function JanelaDePastas({
	aberto,
	clienteId,
	finalidade,
	arquivoInicial,
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
		? arquivos
				.filter((a) => semAcento(a.nome).includes(termo))
				.sort((a, b) => porNome(a.nome, b.nome))
		: [];
	const subpastas = [
		...new Set(
			arquivos.filter((a) => dentroDe(a.pasta, caminho)).map((a) => a.pasta[caminho.length]),
		),
	].sort(porNome);
	const aqui = arquivos
		.filter((a) => mesmaPasta(a.pasta, caminho))
		.sort((a, b) => porNome(a.nome, b.nome));
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
						<span className="truncate text-confere-navy-300">
							· {arquivo.pasta.join(" › ") || nomeDoCliente}
						</span>
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
						<p className="mt-4 text-sm text-confere-navy-600">Carregando as pastas…</p>
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
								<ul className="mt-3 max-h-80 divide-y divide-confere-line overflow-y-auto rounded border border-confere-line">
									{achados.map((arquivo) => linha(arquivo, true))}
									{achados.length === 0 && (
										<li className="px-3 py-2 text-xs text-confere-navy-300">
											Nenhum arquivo com esse nome.
										</li>
									)}
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
