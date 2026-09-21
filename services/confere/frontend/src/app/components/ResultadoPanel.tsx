"use client";

import { useEffect, useRef } from "react";

import { AnaliseMedicaoPanel } from "@/app/components/AnaliseMedicaoPanel";
import { DivergenciaDeFonte } from "@/app/components/DivergenciaDeFonte";
import { DivergenciaGrid } from "@/app/components/DivergenciaGrid";
import { LinhasDerivadas } from "@/app/components/LinhasDerivadas";
import type { Achado, Estado, RespostaRelatorio } from "@/lib/types";

/** `R-ACE-19` — o nome fixo fazia doze competências virarem `(1)`…`(11)` na
 *  pasta de Downloads. `dd/mm/aaaa` vira `aaaa-mm`, que ordena sozinho.
 *
 *  A referência do contrato é higienizada porque vai para nome de arquivo. */
function nomeDoArquivo(relatorio: RespostaRelatorio, tipo: "docx" | "xlsx"): string {
	const referencia = relatorio.contrato_referencia
		.replace(/[^\w-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const periodo = relatorio.data_levantamento?.split("/").slice(1).reverse().join("-");
	// Os dois documentos da mesma competência caem na mesma pasta de Downloads.
	// `analise` no nome é o que os distingue sem depender da extensão.
	const prefixo = tipo === "docx" ? "confere" : "confere-analise";
	return `${[prefixo, referencia, periodo].filter(Boolean).join("-")}.${tipo}`;
}

/** ESPEC 025 `D-05` — **um cartão por peça, não por validação.**
 *
 *  A unidade da tela deixou de ser a validação. Três achados para uma causa —
 *  `V-ADT-01`, `V-CTR-01` e `V-CAP-01` sobre o mesmo PDF — treinavam o olho a
 *  pular o bloco, e nenhum deles dizia qual arquivo trocar.
 *
 *  Achado sem as partes novas cai no caminho de sempre (`T-1932`): onze
 *  validações ainda mandam só `mensagem`, e sumir com elas seria uma regressão
 *  que nenhum teste de backend pegaria.
 */
function CartaoDeAchado({ achado, tom }: { achado: Achado; tom: "bloqueio" | "aviso" }) {
	const estilos =
		tom === "bloqueio"
			? "border-red-200 bg-red-50 text-red-900"
			: "border-amber-200 bg-amber-50 text-amber-900";

	if (!achado.titulo) {
		return (
			<li className={`rounded-md border p-4 text-sm ${estilos}`}>
				<span className="font-mono text-xs font-semibold">{achado.validacao}</span>{" "}
				{achado.mensagem}
			</li>
		);
	}

	return (
		<li className={`rounded-md border p-4 text-sm ${estilos}`}>
			<p className="font-semibold">{achado.titulo}</p>
			{achado.causa && <p className="mt-2">{achado.causa}</p>}
			{achado.acao && <p className="mt-2 font-medium">➜ {achado.acao}</p>}
			{achado.detalhe && (
				// O colchete de diagnóstico que ficava no meio da frase. Não se
				// perde: muda de altura. `<details>` fechado é o que deixa a
				// informação disponível ao suporte sem custar a leitura de quem
				// confere (`R-GRD-07`, com outro destino).
				<details className="mt-3">
					<summary className="cursor-pointer text-xs opacity-80">
						Detalhes técnicos (para o suporte) · {achado.validacao}
					</summary>
					<p className="mt-1 select-all font-mono text-xs opacity-90">
						{achado.detalhe}
					</p>
				</details>
			)}
		</li>
	);
}

/** ESPEC 027 `R-LEV-08` — vários achados de `V-CTR-05`, num cartão só.
 *
 *  O modelo continua sendo **um achado por código**: é o `codigo` que o grid
 *  consome (`R-LEV-08`), e agregar aqui não o toca. Singular não passa por
 *  aqui — com um só, o `ListaDeAchados` deixa o `CartaoDeAchado` de sempre
 *  cuidar dele, que já lê `mensagem`.
 */
function CartaoAgregado({ achados, tom }: { achados: Achado[]; tom: "bloqueio" | "aviso" }) {
	const estilos =
		tom === "bloqueio"
			? "border-red-200 bg-red-50 text-red-900"
			: "border-amber-200 bg-amber-50 text-amber-900";

	const codigos = achados.map((achado) => achado.codigo).filter((c): c is string => c !== null);

	return (
		<li className={`rounded-md border p-4 text-sm ${estilos}`}>
			<p className="font-semibold">
				{achados.length} códigos do contrato não aparecem no levantamento.
			</p>
			<p className="mt-2">
				Eles não entrarão no relatório — a comprovação cobre o que a aba Levantamento traz.
			</p>
			<p className="mt-2 select-all font-mono text-xs">{codigos.join(" · ")}</p>
			<p className="mt-2 font-medium">
				➜ Se algum destes deveria ter sido medido, confira a competência da planilha.
			</p>
		</li>
	);
}

/** ESPEC 027 `D-05` — agrupa por `validacao`, preservando a posição da
 *  primeira ocorrência de cada uma. Não é ordenação: `V-CTR-05` aparece onde
 *  o primeiro achado dela apareceria, e as demais validações não se movem
 *  entre si. */
function agruparPorValidacao(achados: Achado[]): Achado[][] {
	const ordem: string[] = [];
	const grupos = new Map<string, Achado[]>();
	for (const achado of achados) {
		const lista = grupos.get(achado.validacao);
		if (lista) {
			lista.push(achado);
		} else {
			ordem.push(achado.validacao);
			grupos.set(achado.validacao, [achado]);
		}
	}
	return ordem.map((validacao) => grupos.get(validacao) as Achado[]);
}

function ListaDeAchados({ achados, tom }: { achados: Achado[]; tom: "bloqueio" | "aviso" }) {
	if (achados.length === 0) return null;

	return (
		<ul className="space-y-3">
			{agruparPorValidacao(achados).flatMap((grupo) => {
				// A agregação é só para `V-CTR-05`: generalizá-la aplicaria o texto
				// de "códigos do contrato" a achados de outra origem (`R-LEV-08`).
				if (grupo.length > 1 && grupo[0].validacao === "V-CTR-05") {
					return [<CartaoAgregado key={grupo[0].validacao} achados={grupo} tom={tom} />];
				}
				return grupo.map((achado, indice) => (
					<CartaoDeAchado
						key={`${achado.validacao}-${achado.codigo}-${indice}`}
						achado={achado}
						tom={tom}
					/>
				));
			})}
		</ul>
	);
}

/** Separa visualmente o que bloqueia do que apenas avisa.
 *
 *  Havendo bloqueio não há download: gerar um relatório com número
 *  possivelmente errado seria pior que não gerar — ele instrui faturamento.
 */
interface Props {
	estado: Estado;
	/** ESPEC 023 `R-FON-07` — decidido em `page.tsx`, que tem a referência ao
	 *  campo do formulário. */
	onAnexarAditivo: () => void;
}

export function ResultadoPanel({ estado, onAnexarAditivo }: Props) {
	const titulo = useRef<HTMLHeadingElement>(null);

	// `R-ACE-15` — sem isto o foco fica no botão, ou se perde quando ele é
	// desabilitado, e quem não vê a tela não tem como saber que a espera acabou.
	// O alvo é título, não controle: nada é acionado, e o foco pousa no topo do
	// que acabou de surgir.
	useEffect(() => {
		if (estado.situacao === "pronto" || estado.situacao === "bloqueado") {
			titulo.current?.focus();
		}
	}, [estado.situacao]);

	// `R-ACE-13` — a região viva é montada **sempre**, desde o primeiro render,
	// mesmo vazia.
	//
	// Envolver o conteúdo por dentro do `return null` produziria marcação correta
	// e comportamento nulo: leitores anunciam a **mutação** de uma região já
	// presente na árvore, não a inserção de uma região nova. O sintoma seria
	// silêncio, e nada automatizado o detecta — daí o teste da T-416 verificar a
	// montagem no estado inicial, e não o atributo (ESPEC 008 D-03).
	return (
		<div aria-live="polite" aria-atomic="false">
			<Conteudo estado={estado} titulo={titulo} onAnexarAditivo={onAnexarAditivo} />
		</div>
	);
}

function Conteudo({
	estado,
	titulo,
	onAnexarAditivo,
}: {
	estado: Estado;
	titulo: React.RefObject<HTMLHeadingElement>;
	onAnexarAditivo: () => void;
}) {
	if (estado.situacao === "inicial") return null;

	if (estado.situacao === "processando") {
		// O aviso visível fica no formulário, junto do botão (`R-ACE-16`). Aqui só
		// o que o leitor de tela precisa ouvir para não confundir espera com
		// travamento — a geração pode passar de um minuto.
		return <p className="sr-only">Processando o relatório. Pode levar até um minuto.</p>;
	}

	if (estado.situacao === "erro") {
		return (
			<section
				role="alert"
				className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
			>
				{estado.mensagem}
			</section>
		);
	}

	if (estado.situacao === "bloqueado") {
		return (
			<section role="alert" className="mt-6 space-y-4">
				{/* `text-lg` como o título do grid: o cabeçalho da situação mais grave
				    era o menor da tela (`R-ACE-12`). */}
				{/* ESPEC 025 §9.1 — *processamento* é vocabulário do sistema, e
				    *nenhum relatório foi gerado* repetia no título o que a tela
				    inteira já dizia. O subtítulo passa a contar quantos pontos há e
				    a mandar reenviar, que é o passo seguinte. */}
				<h2
					ref={titulo}
					tabIndex={-1}
					className="text-lg font-semibold text-navy-600 outline-none"
				>
					Não foi possível gerar o relatório
				</h2>
				<p className="text-sm text-navy-600">
					{estado.bloqueantes.length === 1
						? "Corrija o ponto abaixo e envie novamente."
						: `Corrija os ${estado.bloqueantes.length} pontos abaixo e envie novamente.`}
				</p>
				<ListaDeAchados achados={estado.bloqueantes} tom="bloqueio" />
				<ListaDeAchados achados={estado.avisos} tom="aviso" />
			</section>
		);
	}

	const { relatorio } = estado;

	return (
		<section className="mt-6">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-teal-100 bg-teal-50 p-5">
				<div>
					<h2
						ref={titulo}
						tabIndex={-1}
						className="text-sm font-semibold text-teal-700 outline-none"
					>
						Relatório gerado
					</h2>
					<p className="mt-1 text-sm text-navy-600">
						<strong>{relatorio.total_divergencias}</strong> de {relatorio.total_linhas} itens
						com divergência entre contratado e medido
					</p>
				</div>
				<div className="flex flex-wrap gap-2.5">
					<a
						href={estado.urlDocx}
						download={nomeDoArquivo(relatorio, "docx")}
						className="rounded-md bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600"
					>
						Baixar DOCX
					</a>
					{/* O `.docx` continua sendo o entregável formal; a análise é papel de
					    trabalho. A hierarquia visual diz isso — primário e secundário. */}
					<a
						href={estado.urlAnalise}
						download={nomeDoArquivo(relatorio, "xlsx")}
						className="rounded-md border border-teal-300 bg-white px-5 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
					>
						Baixar análise (XLSX)
					</a>
				</div>
			</div>

			{/* ESPEC 038 `R-AVI-01` — **gravidade antes de seções**, que é a ordem que
			    a `R-PAN-01` sempre pediu.

			    O bloco âmbar ficava no fim da tela desde a ESPEC 002, quando era a
			    única coisa abaixo do grid. Deixou de ser: a `D-07` da 021 e a `D-08`
			    da 023 acomodaram as ressalvas ali, e o aviso passou a ser lido depois
			    de três tabelas — quarenta linhas abaixo do botão que baixa o
			    documento que ele ressalva.

			    Aviso não é ressalva: é achado de validação, o mesmo que o estado
			    `bloqueado` já põe em primeiro lugar, dez linhas acima neste arquivo.
			    A `V-MED-03` que originou a espec diz que uma linha do relatório pode
			    ter vindo da ocorrência errada da planilha — e chegava depois de a
			    pessoa já ter conferido o relatório inteiro.

			    **Sem `role="alert"`** (`R-AVI-07`): o painel já está dentro da região
			    `aria-live="polite"` da `R-ACE-13`, e o papel de alerta aqui produziria
			    anúncio duplo, um deles cortando o que estivesse sendo lido. */}
			{relatorio.avisos.length > 0 && (
				<section className="mt-6" aria-labelledby="titulo-avisos">
					<h2 id="titulo-avisos" className="text-lg font-semibold text-navy-600">
						{relatorio.avisos.length === 1
							? "1 aviso"
							: `${relatorio.avisos.length} avisos`}
					</h2>
					{/* `R-AVI-05` — a frase diz o que o bloco **não** é antes de dizer o
					    que é. Âmbar no topo, encostado num botão de download, é a
					    gramática da tela de bloqueio deste mesmo produto: sem esta
					    linha, a entrega trocaria um aviso que ninguém lê por um aviso
					    que trava (`D-06`). */}
					<p className="mb-3 mt-1 text-sm text-navy-600">
						O relatório foi gerado. Nenhum destes pontos o impede, mas convém
						conferi-los antes de faturar.
					</p>
					<ListaDeAchados achados={relatorio.avisos} tom="aviso" />
				</section>
			)}

			{/* ESPEC 009 `R-PAN-01` — a leitura por gravidade vem **antes** da leitura
			    por seção: quem confere pergunta "o que é grave?" antes de "onde está?". */}
			<AnaliseMedicaoPanel analise={relatorio.analise} />

			<DivergenciaGrid
				divergencias={relatorio.divergencias}
				demaisItens={relatorio.demais_itens}
				totalDivergencias={relatorio.total_divergencias}
				temItensDePerfil={relatorio.analise.situacoes.some((s) => s.perfis_ou_pacotes > 0)}
			/>

			{/* ESPEC 021 `D-07` — depois do grid. A ordem de leitura da tela é
			    gravidade, depois seções, depois ressalvas: estas linhas são, por
			    construção, *sem divergência*, e ressalva vem depois do que ela
			    ressalva.

			    **A âncora mudou, a decisão não** (ESPEC 038 `D-05`). A `D-07` dizia
			    *"acima do bloco amarelo"* porque o bloco âmbar era o último elemento
			    da tela — marco geográfico, não decisão sobre ele. O bloco subiu para
			    junto da faixa (`R-AVI-01`) e estas linhas não se moveram: continuam
			    sendo a primeira das duas ressalvas finais. */}
			<LinhasDerivadas linhas={relatorio.linhas_derivadas} />

			{/* ESPEC 031 `R-APU-08` — logo abaixo das derivadas, e é o lugar certo:
			    as duas mostram um número que o sistema inferiu ao lado do que a
			    planilha trazia, e quem confere as lê no mesmo movimento, com a
			    planilha aberta. */}

			{/* ESPEC 023 `D-08` — depois do grid e das derivadas, e é a **última**
			    seção da tela. A ordem de leitura da ESPEC 009 `R-PAN-01` é gravidade,
			    depois seções, depois ressalvas — e esta é ressalva sobre a fonte do
			    número contratado.

			    **A âncora mudou, a decisão não** (ESPEC 038 `D-05`). A `D-08` dizia
			    *"ocupa o lugar do bloco âmbar"*; o bloco âmbar subiu para junto da
			    faixa, esta seção ficou onde estava, e a ordem que a `D-08` quis
			    continua inteira. */}
			<DivergenciaDeFonte
				divergencias={relatorio.divergencias_de_fonte}
				onAnexarAditivo={onAnexarAditivo}
			/>

		</section>
	);
}
