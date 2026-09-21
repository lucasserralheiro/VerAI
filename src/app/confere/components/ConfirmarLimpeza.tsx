"use client";

import { useEffect, useRef } from "react";

interface Props {
	aberto: boolean;
	/** `R-LMP-06` / `D-04` — a perda não é a mesma nos dois casos. Um aviso que
	 *  exagera no caso leve ensina a confirmar sem ler; e aí a pessoa confirma sem
	 *  ler no caso grave, que é o único que importa. */
	haRelatorio: boolean;
	onConfirmar: () => void;
	onCancelar: () => void;
}

/**
 * ESPEC 015 — a confirmação da limpeza.
 *
 * `<dialog>` nativo com `showModal()`, e não `window.confirm()` (`D-07`): o
 * segundo bloqueia a thread principal, não é estilizável, é **suprimível pelo
 * navegador** — e uma vez suprimido o fluxo quebra em silêncio — e fica fora do
 * DOM, logo fora do `axe` e da comparação de captura que a ESPEC 008 §9.2 fixou
 * como protocolo.
 *
 * O modal nativo traz de graça o que `R-LMP-07` pede: retenção de foco, `Esc` e
 * inércia do fundo. Nenhuma linha de ARIA escrita à mão — se fosse preciso
 * `role="dialog"` ou `aria-modal`, o elemento não estaria sendo usado como tal.
 */
export function ConfirmarLimpeza({ aberto, haRelatorio, onConfirmar, onCancelar }: Props) {
	const dialogo = useRef<HTMLDialogElement>(null);
	const cancelar = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const el = dialogo.current;
		if (!el) return;

		if (aberto && !el.open) {
			// `returnValue` sobrevive entre aberturas. Sem zerar, um `Esc` depois de
			// uma confirmação anterior chegaria ao `aoFechar` ainda valendo
			// `"limpar"` — e limparia sem confirmação, que é o que `R-LMP-05` proíbe.
			el.returnValue = "";
			// `showModal()` e não o atributo `open`: só ele põe o diálogo na camada
			// de topo, prende o foco, liga o `Esc` e torna o fundo inerte. Com `open`
			// a marcação parece a mesma e nada disso acontece.
			el.showModal();
			// `R-LMP-08` — o foco pousa no controle **não destrutivo**. Confirmação
			// de descarte não pré-seleciona o descarte. O `showModal()` focaria o
			// primeiro focável, que já é este; a chamada explícita é o que torna a
			// regra independente da ordem do DOM, e por isso testável.
			cancelar.current?.focus();
		} else if (!aberto && el.open) {
			el.close();
		}
	}, [aberto]);

	/** `R-LMP-05` — o padrão é **não limpar**, exceto quando.
	 *
	 *  `Esc`, o botão de cancelar e qualquer fechamento do navegador chegam aqui
	 *  com `returnValue` diferente de `"limpar"`. Tratar só o clique deixaria o
	 *  `Esc` cair no caminho de sucesso, e o modo de falha seria o pior possível:
	 *  limpar sem ter confirmado. */
	function aoFechar() {
		if (dialogo.current?.returnValue === "limpar") onConfirmar();
		else onCancelar();
	}

	return (
		<dialog
			ref={dialogo}
			onClose={aoFechar}
			aria-labelledby="confirmar-limpeza-titulo"
			className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-confere-line bg-white p-6 shadow-lg"
		>
			<h2 id="confirmar-limpeza-titulo" className="text-lg font-semibold text-confere-navy-600">
				Limpar e recomeçar?
			</h2>

			{/* A redação evita a sequência "relatório gerado" **de propósito**.
			    `estados.ts` e `smoke.spec.ts` esperam o resultado com
			    `getByText("Relatório gerado")`, e `getByText` com string casa por
			    **substring, sem diferenciar maiúsculas**: a primeira redação deste
			    parágrafo fazia o localizador resolver dois elementos e derrubava as
			    duas suítes em modo estrito. Ver TASKS 015 §12. */}
			<p className="mt-3 text-sm text-confere-navy-600">
				{haRelatorio
					? "O relatório será descartado e não há como recuperá-lo: para tê-lo de volta será preciso enviar os arquivos e gerar de novo. Se ainda não baixou o DOCX e a análise, baixe antes de limpar."
					: "Os arquivos escolhidos serão removidos e o formulário volta ao início."}
			</p>

			{/* `method="dialog"`: cada botão fecha o diálogo e grava o próprio `value`
			    em `returnValue`. É o mecanismo que faz `aoFechar` distinguir os
			    caminhos sem um estado a mais para manter em sincronia — e é o que
			    torna `R-LMP-05` verdadeira por construção, em vez de por três
			    manipuladores que alguém pode esquecer de escrever.

			    O diálogo mora em `page.tsx`, fora do `<form>` do `UploadForm`: este
			    `<form>` não fica aninhado em nenhum outro. */}
			<form method="dialog" className="mt-6 flex flex-wrap justify-end gap-3">
				<button
					ref={cancelar}
					value="cancelar"
					className="rounded-md border border-confere-line bg-white px-5 py-2.5 text-sm font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50"
				>
					Cancelar
				</button>
				{/* `confere-severidade-critico` é o vermelho já medido do projeto — 6,44:1
				    contra branco (tailwind.config.ts). O hover usa o passo mais
				    escuro da paleta padrão, que a escala semântica não tem. */}
				<button
					value="limpar"
					className="rounded-md bg-confere-severidade-critico px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
				>
					Limpar tudo
				</button>
			</form>
		</dialog>
	);
}