"use client";

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
import { Giro } from "./Giro";
import { useSoltarArquivos } from "./useSoltarArquivos";

interface Props {
	/** O levantamento escolhido — o campo que só aceita arquivo do computador e
	 *  dispara a busca do contrato no cadastro. */
	levantamento?: File;
	/** O campo Contrato: arquivo do computador ou proposta do cadastro. */
	contrato?: Peca;
	onSelecionar: (campo: NomeDoCampo, arquivo: File | undefined) => void;
	/** ESPEC 019 `R-ADT-10` — os aditivos da proposta, opcionais e em qualquer
	 *  número, em ordem de aplicação. Fora do Contrato porque não entram na regra
	 *  que habilita o botão (`D-10`). Misturam cadastro e computador. */
	aditivos: readonly Peca[];
	/** A seleção do computador **acrescenta** no fim da lista — a lista é da
	 *  tela, não do `<input>`. */
	onSelecionarAditivos: (escolhidos: readonly File[]) => void;
	onRemoverAditivo: (posicao: number) => void;
	/** O texto do campo de aditivos vazio. */
	semAditivos: string;
	/** A faixa de identificação do contrato — entre os dois cartões e o de
	 *  aditivos. */
	faixa?: React.ReactNode;
	/** A planilha está sendo lida e o contrato buscado no cadastro. */
	buscandoContrato: boolean;
	/** Abre a janela "Pastas do cliente" para o campo Contrato (desenho de
	 *  25/09/2026, tarde, §3.5). */
	onProcurarContrato: () => void;
	/** Abre a janela "Pastas do cliente" para os aditivos. */
	onProcurarAditivos: () => void;
	/** O que falta para gerar, embaixo do botão; `null` quando nada falta. */
	dica: string | null;
	onEnviar: () => void;
	processando: boolean;
	/** ESPEC 015 `R-LMP-04` — muda a cada limpeza e remonta os dois campos, que é
	 *  o que zera `input.value`. Zerar só o estado do React deixaria a tela
	 *  dizendo `escolher arquivo…` com o elemento ainda carregando o arquivo. */
	chave: number;
	/** Remonta só o campo Contrato — zera o `<input>` quando o cadastro volta a
	 *  ocupá-lo, sem mexer no levantamento nem roubar o foco. */
	chaveContrato: number;
	/** Remonta só o campo de aditivos — zera o `<input>` a cada seleção
	 *  acrescentada, para que escolher o mesmo arquivo de novo volte a disparar. */
	chaveAditivos: number;
	/** `R-LMP-02` — decidido em `page.tsx`, que é quem tem o estado da tela. */
	podeLimpar: boolean;
	onLimpar: () => void;
	refLimpar: React.RefObject<HTMLButtonElement | null>;
	refPrimeiroCampo: React.RefObject<HTMLInputElement | null>;
	/** ESPEC 023 `R-FON-07` — destino do foco da ação do aviso de divergência.
	 *  Mesmo mecanismo de `R-ACE-15`: o foco vai para onde a pessoa precisa
	 *  agir, e a decisão continua com ela. Não reenvia (`D-05`). */
	refAditivos: React.RefObject<HTMLInputElement | null>;
	/** T-2100 / ESPEC 029 `R-IDT-10` — o achado do portão, quando há um.
	 *
	 *  Vem pronto do backend, com as quatro partes: as **mesmas** validações do
	 *  fluxo completo respondem à conferência prévia, e é o que garante que a
	 *  pergunta e o achado do relatório digam a mesma frase. */
	perguntaDeIdentidade?: Achado;
	onGerarAssimMesmo: () => void;
	onDescartarPergunta: () => void;
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
	buscandoContrato,
	onProcurarContrato,
	onProcurarAditivos,
	dica,
	onEnviar,
	processando,
	chave,
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
	// Arrastar e soltar por cartão (desenho de 25/09/2026, tarde, §3.4): cada um
	// aceita o seu tipo, e soltar faz o mesmo que escolher pelo seletor.
	const soltarContrato = useSoltarArquivos({
		extensao: ".pdf",
		multiplos: false,
		desabilitado: processando,
		onSoltar: ([arquivo]) => onSelecionar("contrato", arquivo),
		mensagemDeTipoErrado: (arquivo) =>
			`O contrato é a proposta em PDF — ${arquivo.name} não é PDF.`,
	});
	const soltarLevantamento = useSoltarArquivos({
		extensao: ".xlsx",
		multiplos: false,
		desabilitado: processando,
		onSoltar: ([arquivo]) => onSelecionar("levantamento", arquivo),
		mensagemDeTipoErrado: (arquivo) =>
			`O levantamento é a planilha .xlsx — ${arquivo.name} não é.`,
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

	// ESPEC 025 `R-DOC-08` — o arquivo dispensado, pelo nome. Guardar o **nome**
	// e não um booleano é o que faz o aviso voltar quando a pessoa troca por
	// outro levantamento: um `false` sobreviveria à troca e calaria o segundo
	// engano. Só vale para o arquivo enviado do computador.
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

	// `<form>` e não `<section>`: dá semântica de formulário ao leitor de tela e
	// faz o Enter enviar, que antes não fazia nada.
	return (
		<form onSubmit={submeter} className="rounded-lg border border-confere-line bg-white p-6 shadow-sm">
			<div className="grid gap-4 md:grid-cols-2">
				{CAMPOS.map((campo, indice) => {
					const escolhido =
						campo.nome === "contrato" ? (contrato ? nomeDaPeca(contrato) : undefined) : levantamento?.name;
					const soltar = soltarNoCampo[campo.nome];
					const buscando = campo.nome === "contrato" && !contrato && buscandoContrato;
					// O que o campo vazio diz (desenho de 25/09/2026, tarde, §3.1): o
					// Contrato vem do levantamento; o Levantamento é por onde começa.
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
						// O cartão é o `<div>`, e o `<label>` fica dentro dele: o que
						// é do cadastro (Ver PDF, Procurar nas pastas) tem botões e mora
						// **fora** do rótulo — dentro, clicar num deles abriria o seletor
						// junto, pela mesma razão do aviso da `R-DOC-08`.
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
			</div>

			{faixa}

			{/* ESPEC 025 `R-DOC-08` — o aviso que chega **antes** dos 16,6 s.

			    Fora do `grid md:grid-cols-2` de propósito: dentro dele o aviso ocuparia
			    a célula do levantamento e empurraria o campo para baixo. E fora do
			    `<label>` porque tem botões — dentro dele, clicar em *Trocar arquivo*
			    dispararia também o rótulo, abrindo o seletor duas vezes.

			    `role="status"` e não `alert`: não é erro, é ressalva sobre uma escolha
			    ainda reversível, e interromper a leitura em curso seria desproporcional
			    (`R-ACE-13`). */}
			{avisarLevantamento && (
				<div
					// `id` próprio, e não o seletor `[role="status"]`: a região da
					// `R-LMP-10` em `page.tsx` também é `status` e fica montada desde o
					// primeiro render — o inventário resolveria dois elementos onde
					// espera um.
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
							// `type="button"` pela razão da `R-LMP-03`: dentro de um
							// `<form>` o padrão do HTML é `submit`, e sem ele *Trocar
							// arquivo* geraria o relatório com o arquivo errado.
							type="button"
							onClick={() => refPrimeiroCampo.current?.click()}
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

			{/* T-2100 / ESPEC 029 `R-IDT-10` — o portão que **pergunta**.

			    A mesma caixa da `R-DOC-08` logo acima, e de propósito: o que muda é
			    a fonte do juízo, não a forma. Lá o palpite é o nome do arquivo,
			    decidido no navegador; aqui é o conteúdo dos dois documentos, e a
			    resposta veio do servidor em menos de um segundo.

			    `role="status"` e não `alert`, pela razão da `R-ACE-13`: não é erro,
			    é ressalva sobre uma escolha ainda reversível. `id` próprio porque o
			    inventário de anúncios resolve por `id` — dois `status` sem
			    distinção quebrariam a varredura. */}
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
					{/* A `acao` do achado **não** é renderizada aqui, e é a única
					    parte das quatro que fica de fora: ela diz em palavras o que
					    os dois botões abaixo fazem, e repetir seria a terceira
					    mensagem para a mesma causa.

					    O `detalhe` fica, recolhido, pelo motivo da ESPEC 025
					    `R-DOC-05`: quem confere não tropeça nele, e quem dá suporte
					    o encontra — inclusive quando a pessoa resolve tudo aqui e
					    o painel de bloqueio nunca chega a existir. */}
					{perguntaDeIdentidade.detalhe && (
						<details className="mt-3">
							<summary className="cursor-pointer text-xs opacity-80">
								Detalhes técnicos (para o suporte) ·{" "}
								{perguntaDeIdentidade.validacao}
							</summary>
							<p className="mt-1 select-all font-mono text-xs opacity-90">
								{perguntaDeIdentidade.detalhe}
							</p>
						</details>
					)}
					<div className="mt-3 flex flex-wrap gap-2.5">
						<button
							// `type="button"` pela razão da `R-LMP-03`: dentro de um
							// `<form>` o padrão do HTML é `submit`, e sem ele *Trocar
							// arquivo* geraria o relatório com o par divergente — que é
							// exatamente o que esta caixa existe para impedir.
							type="button"
							onClick={() => {
								onDescartarPergunta();
								refPrimeiroCampo.current?.click();
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

			{/* ESPEC 019 `R-ADT-10` — o terceiro campo.

			    **Depois dos dois no DOM**, e antes do botão: a ordem de tabulação da
			    ESPEC 008 §6 mantém contrato ① e levantamento ② onde estavam, e o
			    campo novo entra como ③, antes de *Gerar relatório*.

			    Ocupa a largura inteira, fora do `grid md:grid-cols-2`, porque o par
			    de cima é o que é obrigatório: a assimetria visual **é** a informação
			    de que este não é (`D-10`).

			    Desde 25/09/2026 a lista é da tela, não do `<input>`: mistura propostas
			    do cadastro e arquivos do computador, e cada item sai com o seu botão.
			    O cartão é o `<div>`; o `<label>` fica só com título, descrição e o
			    campo vazio, pela mesma razão dos dois cartões de cima. */}
			<div
				key={`${chave}-${CAMPO_ADITIVOS.nome}-${chaveAditivos}`}
				{...soltarAditivos.alvo}
				className="relative mt-4 flex flex-col gap-2 rounded-md border border-confere-line bg-white p-4 transition hover:border-confere-teal-400 has-[:focus-visible]:border-confere-teal-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-confere-teal-500 has-[:focus-visible]:ring-offset-2"
			>
				<label className="flex cursor-pointer flex-col gap-2">
					<span className="text-sm font-semibold text-confere-navy-600">
						{CAMPO_ADITIVOS.rotulo}
					</span>
					<span id={`${CAMPO_ADITIVOS.nome}-descricao`} className="text-xs text-confere-navy-300">
						{CAMPO_ADITIVOS.descricao}
					</span>
					<input
						type="file"
						multiple
						ref={refAditivos}
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
				</label>
				{/* Os nomes, e não a contagem: a ordem de envio é a ordem de
				    aplicação (`R-ADT-07`), e quem confere precisa vê-la — e de onde
				    veio cada um. */}
				{aditivos.length > 0 && (
					<ol id={`${CAMPO_ADITIVOS.nome}-estado`} className="space-y-1">
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
				)}
				{/* Vazio, uma linha só: o estado e as duas maneiras de acrescentar
				    (desenho de 25/09/2026, tarde, §3.3). */}
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
			</div>

			{/* As classes de estado são expressão condicional, não variante
			    `disabled:`. A variante depende do atributo real, que deixou de
			    existir aqui — se ficasse, a cor voltaria ao padrão sem erro e sem
			    teste vermelho. */}
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

			{/* ESPEC 015 `R-LMP-12` — secundário, e **depois do primário no DOM**: é o
			    que mantém intacta a ordem de tabulação da ESPEC 008 §6. *Limpar* entra
			    como Tab ⑤, depois de *Gerar relatório*, nunca antes.

			    Sem invólucro `flex` de propósito. Envolver os dois botões num
			    contêiner novo mudaria a caixa do primário **quando o secundário não
			    existe** — e as capturas `inicial` e `processando` têm de sair
			    idênticas (TASKS 015 §2.3). Assim, sem o segundo botão, esta marcação é
			    a de antes. */}
			{podeLimpar && (
				<button
					// `type="button"` não é redundância: dentro de um `<form>` o padrão
					// do HTML é `submit`, e sem ele **clicar em Limpar geraria
					// relatório** (`R-LMP-03`). Defeito de uma palavra, invisível em
					// revisão e imediato em uso.
					type="button"
					ref={refLimpar}
					onClick={onLimpar}
					className="ml-3 mt-6 inline-flex items-center rounded-md border border-confere-line bg-white px-5 py-2.5 text-sm font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50"
				>
					Limpar
				</button>
			)}

			{/* O que a tela mostra durante a geração mora no `ProgressoDaGeracao`,
			    que é um `<dialog>` modal em `page.tsx` — aqui embaixo não sobra
			    nada. A frase única que ficava neste lugar ("Extraindo o contrato,
			    reconciliando e montando os anexos. Pode levar até um minuto.")
			    dizia tudo de uma vez e não mudava nunca: aos 5 s e aos 50 s a tela
			    estava idêntica, e é isso que faz espera longa parecer
			    travamento. */}

			{/* O que falta, dito pelo nome (desenho de 25/09/2026, tarde, §3.2) — a
			    frase fixa "Os dois arquivos são necessários" deixou de valer quando o
			    contrato passou a vir sozinho do cadastro. */}
			{dica && (
				<p id="upload-pendente" className="mt-3 text-xs text-confere-navy-300">
					{dica}
				</p>
			)}
		</form>
	);
}
