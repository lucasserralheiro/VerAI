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
