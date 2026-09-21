"use client";

import { useEffect, useRef, useState } from "react";

/**
 * O que a tela mostra durante os ~25s de geração.
 *
 * **Por que etapas e não uma barra sozinha.** A geração é síncrona: o Confere
 * não emite progresso, e o navegador só sabe de duas coisas — que enviou e que
 * ainda não voltou. Inventar uma porcentagem sobre isso seria o indicador de
 * progresso falso que a ESPEC 007 recusou no slot de contexto da barra.
 *
 * O que **é** verdade e pode ser mostrado: a ordem das etapas, que é fixa e
 * conhecida (extrai o contrato, aplica os aditivos, lê o levantamento, valida,
 * monta os anexos, renderiza), o custo relativo de cada uma — os anexos são
 * ~20s dos ~25s, 25 mil células — e o tempo decorrido, que é medido aqui.
 *
 * As três regras que separam isto de uma barra mentirosa:
 *
 *  1. **A barra satura em 92% e espera.** Ela nunca chega a 100 antes da
 *     resposta. Progresso que completa e fica parado em "100%" é a forma mais
 *     comum de a barra desmentir a si mesma.
 *  2. **A última etapa não se conclui sozinha.** Passado o tempo estimado, a
 *     lista para de avançar em vez de fingir uma etapa nova.
 *  3. **Passado o esperado, a tela para de estimar — e não acusa o servidor.**
 *     A primeira redação dizia "está levando mais que o normal", e isso lê
 *     como defeito: quem confere medição não tem como saber que a demora é
 *     proporcional ao tamanho do contrato, e a frase transformava um contrato
 *     grande em suspeita de travamento. O texto passa a descrever o trabalho
 *     que de fato continua acontecendo, sem repetir uma estimativa que já se
 *     provou curta e sem prometer uma nova.
 *
 * **Por que modal.** Inline, o painel dividia a tela com um formulário que não
 * aceita mais nada (os campos ficam `disabled` durante o processamento) — e
 * numa janela de 768px ele caía abaixo da dobra, deixando quem rolou sem saber
 * o que estava acontecendo. `showModal()` resolve os três de uma vez: põe o
 * painel na camada de topo, escurece e torna inerte o fundo que não aceita
 * interação mesmo, e garante que o progresso está sempre visível.
 *
 * **Sem fechar, e é honesto.** Não há botão de fechar e o `Esc` é recusado: a
 * geração não é cancelável (ESPEC 012 §10 — a thread do servidor termina o
 * trabalho de qualquer forma), então um controle de fechar prometeria um
 * cancelamento que não existe. O diálogo sai sozinho quando a resposta chega,
 * e o `ResultadoPanel` leva o foco para o título do resultado.
 */

interface Etapa {
	/** Rótulo no gerúndio: descreve o que o servidor está fazendo agora. */
	rotulo: string;
	/** Peso em segundos, calibrado no piloto (~23s medidos em produção). */
	segundos: number;
}

/** A hibernação do plano free do Render custa ~1min, e ela vem **antes** de
 *  qualquer trabalho. Só entra na lista quando o pré-aquecimento disse que o
 *  serviço estava dormindo — é informação medida, não suposição. */
const ETAPA_DESPERTAR: Etapa = { rotulo: "Acordando o serviço", segundos: 55 };

function etapas(temAditivos: boolean, dormindo: boolean): Etapa[] {
	return [
		...(dormindo ? [ETAPA_DESPERTAR] : []),
		{ rotulo: "Extraindo a tabela de itens do contrato", segundos: 3 },
		// Só quando há aditivo: etapa que não acontece não entra na lista.
		...(temAditivos
			? [{ rotulo: "Aplicando os aditivos sobre a proposta", segundos: 2 }]
			: []),
		{ rotulo: "Lendo a planilha de levantamento", segundos: 2 },
		{ rotulo: "Comparando o contratado com o medido", segundos: 2 },
		// O grosso do tempo. Dizer isso aqui é o que torna a espera
		// compreensível: 20 dos 25 segundos moram nesta linha.
		{ rotulo: "Montando os anexos de detalhamento", segundos: 18 },
		{ rotulo: "Gerando o DOCX e a planilha de análise", segundos: 4 },
	];
}

/** A barra para aqui e espera a resposta (regra 1). */
const TETO_DA_BARRA = 0.92;

function Concluida({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			aria-hidden="true"
			className={className}
		>
			<path d="M4.5 10.5 8 14l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function Pulso({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={`block size-2 rounded-full bg-current motion-safe:animate-pulse ${className ?? ""}`}
		/>
	);
}

export function ProgressoDaGeracao({
	aberto,
	temAditivos,
	servicoDormindo,
}: {
	aberto: boolean;
	temAditivos: boolean;
	servicoDormindo: boolean;
}) {
	const dialogo = useRef<HTMLDialogElement>(null);
	const titulo = useRef<HTMLParagraphElement>(null);
	const [decorrido, setDecorrido] = useState(0);
	// Congelado na abertura, de propósito: a resposta do pré-aquecimento pode
	// chegar **depois** de o envio começar, e deixar a prop viva faria a etapa
	// do despertar aparecer no meio da espera, empurrando a lista para trás.
	// Lista que regride desmente o que a pessoa acabou de ver.
	const [dormindo, setDormindo] = useState(servicoDormindo);

	useEffect(() => {
		const el = dialogo.current;
		if (!el) return;

		if (aberto && !el.open) {
			// `showModal()` e não o atributo `open`: só ele põe o diálogo na camada
			// de topo, prende o foco e torna o fundo inerte — e é o que faz o
			// `::backdrop` do `globals.css` escurecer a página atrás.
			el.showModal();
			// O foco vai para a linha que diz o que está acontecendo. Sem isto ele
			// ficaria no próprio diálogo e o leitor de tela anunciaria só "diálogo".
			titulo.current?.focus();
		} else if (!aberto && el.open) {
			el.close();
		}
	}, [aberto]);

	// Cronômetro e etapa congelada zeram a cada **abertura**, não a cada
	// montagem: o componente mora em `page.tsx` e sobrevive entre uma geração e
	// a seguinte. Sem isto, o segundo envio começaria marcando o tempo do
	// primeiro.
	useEffect(() => {
		if (!aberto) return;
		setDecorrido(0);
		setDormindo(servicoDormindo);
		const inicio = Date.now();
		// 500ms: o cronômetro é em segundos e a lista muda a cada poucos
		// segundos. Um intervalo mais curto só gastaria render.
		const relogio = setInterval(() => setDecorrido((Date.now() - inicio) / 1000), 500);
		return () => clearInterval(relogio);
		// `servicoDormindo` de propósito fora das dependências: ele é lido no
		// instante da abertura e congelado ali.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [aberto]);

	const lista = etapas(temAditivos, dormindo);
	const total = lista.reduce((soma, etapa) => soma + etapa.segundos, 0);

	// Índice da etapa em curso pelo tempo decorrido. Satura na última (regra 2):
	// a lista para de avançar em vez de inventar uma etapa nova.
	let acumulado = 0;
	let indiceAtual = lista.length - 1;
	for (const [indice, etapa] of lista.entries()) {
		acumulado += etapa.segundos;
		if (decorrido < acumulado) {
			indiceAtual = indice;
			break;
		}
	}

	const passouDoEsperado = decorrido > total;
	const fracao = Math.min(decorrido / total, 1) * TETO_DA_BARRA;
	const minutos = Math.floor(decorrido / 60);
	const segundos = Math.floor(decorrido % 60);
	const cronometro =
		minutos > 0
			? `${minutos}min ${String(segundos).padStart(2, "0")}s`
			: `${segundos}s`;

	return (
		<dialog
			ref={dialogo}
			// `Esc` é recusado: fechar não cancelaria a geração, só esconderia o
			// progresso dela. `preventDefault` no `cancel` é o único jeito de
			// impedir o fechamento nativo do `<dialog>`.
			onCancel={(evento) => evento.preventDefault()}
			aria-labelledby="progresso-titulo"
			className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-confere-line bg-white p-6 shadow-lg"
		>
			<div className="flex items-baseline justify-between gap-3">
				{/* `role="status"` e não `aria-live` avulso: o papel implica a região
				    viva. O texto muda poucas vezes, então o anúncio é útil e não
				    vira tagarelice. */}
				<p
					id="progresso-titulo"
					ref={titulo}
					tabIndex={-1}
					role="status"
					className="text-base font-semibold text-confere-navy-600 outline-none"
				>
					{passouDoEsperado
						? "Conferindo item a item para não deixar nada passar"
						: lista[indiceAtual].rotulo}
				</p>
				{/* `tabular-nums` para o cronômetro não dançar a cada segundo. */}
				<span className="shrink-0 text-xs tabular-nums text-confere-navy-300">
					{cronometro}
				</span>
			</div>

			{/* A barra é decorativa para o leitor de tela: o texto acima já diz o
			    estado, e um `progressbar` com valor estimado anunciaria número
			    inventado. */}
			<div
				aria-hidden="true"
				className="mt-4 h-1.5 overflow-hidden rounded-full bg-confere-navy-100"
			>
				<div
					className="h-full rounded-full bg-confere-teal-500 transition-[width] duration-500 ease-linear"
					style={{ width: `${Math.round(fracao * 100)}%` }}
				/>
			</div>

			<ol className="mt-4 space-y-2">
				{lista.map((etapa, indice) => {
					const feita = indice < indiceAtual;
					const atual = indice === indiceAtual;
					return (
						<li
							key={etapa.rotulo}
							className={`flex items-center gap-2 text-xs ${
								feita
									? "text-confere-navy-300"
									: atual
										? "font-medium text-confere-navy-600"
										: "text-confere-navy-100"
							}`}
						>
							<span className="flex size-3.5 shrink-0 items-center justify-center">
								{feita ? (
									<Concluida className="size-3.5 text-confere-teal-500" />
								) : atual ? (
									<Pulso className="text-confere-teal-500" />
								) : (
									<span aria-hidden="true" className="block size-1.5 rounded-full bg-current" />
								)}
							</span>
							<span>{etapa.rotulo}</span>
						</li>
					);
				})}
			</ol>

			<p className="mt-4 border-t border-confere-line pt-3 text-xs text-confere-navy-300">
				{passouDoEsperado
					? "Contratos com muitos itens levam mais tempo. O resultado aparece aqui assim que ficar pronto — não feche nem recarregue a página."
					: "Não feche nem recarregue a página: a geração não é cancelável e o resultado só chega nesta aba."}
			</p>
		</dialog>
	);
}
