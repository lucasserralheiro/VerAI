"use client";

import { useState } from "react";

import { pareceLevantamento } from "../lib/documento";
import { type Achado, CAMPO_ADITIVOS, CAMPOS, type NomeDoCampo } from "../lib/types";

interface Props {
	arquivos: Partial<Record<NomeDoCampo, File>>;
	onSelecionar: (campo: NomeDoCampo, arquivo: File | undefined) => void;
	/** ESPEC 019 `R-ADT-10` — os aditivos da proposta, opcionais e em qualquer
	 *  número. Fora de `arquivos` porque não entram na regra que habilita o
	 *  botão (`D-10`). */
	aditivos: readonly File[];
	onSelecionarAditivos: (escolhidos: readonly File[]) => void;
	onEnviar: () => void;
	processando: boolean;
	/** ESPEC 015 `R-LMP-04` — muda a cada limpeza e remonta os dois campos, que é
	 *  o que zera `input.value`. Zerar só o estado do React deixaria a tela
	 *  dizendo `escolher arquivo…` com o elemento ainda carregando o arquivo. */
	chave: number;
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

/** Indicador de atividade. `motion-reduce:animate-none` porque ele gira por até
 *  um minuto: a WCAG 2.2.2 é nível A e trata de movimento automático acima de
 *  5 s. Indicador de carregamento costuma ser aceito como essencial, mas a
 *  classe custa nada e encerra a dúvida — quem pediu menos movimento recebe o
 *  texto sem o giro. */
function Giro() {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className="h-4 w-4 animate-spin motion-reduce:animate-none"
		>
			<circle
				cx="12"
				cy="12"
				r="9"
				fill="none"
				stroke="currentColor"
				strokeWidth="3"
				opacity="0.25"
			/>
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

export function UploadForm({
	arquivos,
	onSelecionar,
	aditivos,
	onSelecionarAditivos,
	onEnviar,
	processando,
	chave,
	podeLimpar,
	onLimpar,
	refLimpar,
	refPrimeiroCampo,
	refAditivos,
	perguntaDeIdentidade,
	onGerarAssimMesmo,
	onDescartarPergunta,
}: Props) {
	const completo = CAMPOS.every((campo) => arquivos[campo.nome]);
	const bloqueado = !completo || processando;

	// ESPEC 025 `R-DOC-08` — o arquivo dispensado, pelo nome. Guardar o **nome**
	// e não um booleano é o que faz o aviso voltar quando a pessoa troca por
	// outro levantamento: um `false` sobreviveria à troca e calaria o segundo
	// engano.
	const [nomeDispensado, setNomeDispensado] = useState<string | null>(null);
	const contrato = arquivos.contrato;
	const avisarLevantamento =
		contrato !== undefined &&
		pareceLevantamento(contrato.name) &&
		contrato.name !== nomeDispensado;

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
					const escolhido = arquivos[campo.nome];
					return (
						// Borda sólida e não tracejada: tracejado é a convenção de área
						// de arraste, e arrastar aqui não faz nada — quem tenta não
						// recebe erro, recebe inércia (`R-ACE-17`).
						//
						// `has-[:focus-visible]` e não `focus-within`: clicar o rótulo
						// foca o input, e o `focus-within` faria o anel aparecer para
						// quem usa mouse e não precisa dele.
						<label
							// A chave composta é o que remonta o campo na limpeza
							// (`R-LMP-04`). Só o nome não bastaria: o React reaproveitaria
							// o mesmo elemento e o `input.value` sobreviveria — a tela
							// diria vazio com o formulário ainda carregando o arquivo.
							key={`${chave}-${campo.nome}`}
							className="flex cursor-pointer flex-col gap-2 rounded-md border border-confere-teal-100 bg-confere-teal-50/40 p-4 transition hover:border-confere-teal-400 has-[:focus-visible]:border-confere-teal-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-confere-teal-500 has-[:focus-visible]:ring-offset-2"
						>
							<span className="text-sm font-semibold text-confere-navy-600">
								{campo.rotulo}
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
								onChange={(evento) =>
									onSelecionar(campo.nome, evento.target.files?.[0])
								}
							/>
							<span
								id={`${campo.nome}-estado`}
								className={`mt-1 truncate rounded border px-2 py-1 text-xs ${
									escolhido
										? "border-confere-teal-400 bg-white text-confere-teal-600"
										: "border-confere-line bg-white text-confere-navy-300"
								}`}
							>
								{escolhido ? escolhido.name : "escolher arquivo…"}
							</span>
						</label>
					);
				})}
			</div>

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
							onClick={() => setNomeDispensado(contrato?.name ?? null)}
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
			    de que este não é (`D-10`). */}
			<label
				key={`${chave}-${CAMPO_ADITIVOS.nome}`}
				className="mt-4 flex cursor-pointer flex-col gap-2 rounded-md border border-confere-line bg-white p-4 transition hover:border-confere-teal-400 has-[:focus-visible]:border-confere-teal-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-confere-teal-500 has-[:focus-visible]:ring-offset-2"
			>
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
					onChange={(evento) =>
						onSelecionarAditivos(Array.from(evento.target.files ?? []))
					}
				/>
				<span
					id={`${CAMPO_ADITIVOS.nome}-estado`}
					className={`mt-1 rounded border px-2 py-1 text-xs ${
						aditivos.length
							? "border-confere-teal-400 bg-white text-confere-teal-600"
							: "border-confere-line bg-white text-confere-navy-300"
					}`}
				>
					{/* Os nomes, e não a contagem: a ordem de envio é a ordem de
					    aplicação (`R-ADT-07`), e quem confere precisa vê-la. */}
					{aditivos.length
						? aditivos.map((aditivo) => aditivo.name).join(" · ")
						: "nenhum aditivo — opcional"}
				</span>
			</label>

			{/* As classes de estado são expressão condicional, não variante
			    `disabled:`. A variante depende do atributo real, que deixou de
			    existir aqui — se ficasse, a cor voltaria ao padrão sem erro e sem
			    teste vermelho. */}
			<button
				type="submit"
				aria-disabled={bloqueado}
				aria-busy={processando}
				aria-describedby={!completo ? "upload-pendente" : undefined}
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

			{!completo && (
				<p id="upload-pendente" className="mt-3 text-xs text-confere-navy-300">
					Os dois arquivos são necessários para gerar o relatório.
				</p>
			)}
		</form>
	);
}
