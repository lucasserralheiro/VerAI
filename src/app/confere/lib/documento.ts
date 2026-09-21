/** ESPEC 025 `R-DOC-08` — o palpite pelo nome do arquivo, antes de processar.
 *
 *  **É a única regra de negócio que esta espec deixa em TypeScript**, e a
 *  exceção se justifica pelo `D-07`: o aviso existe para não pagar a viagem ao
 *  servidor, e uma regra que precise do servidor não serve para isso. O
 *  diagnóstico de verdade — o que olha dentro do PDF — continua inteiro no
 *  domínio, em `causa_provavel`.
 *
 *  O sinal é **fraco de propósito** e por isso o aviso nunca impede: um arquivo
 *  chamado `proposta_do_levantamento_2026.pdf` casa aqui e é legítimo. É a
 *  saída barata que torna o falso positivo aceitável (`T-1908`).
 */

/** Sem acento e em minúsculas, com os separadores virando espaço.
 *
 *  A normalização é o que faz `_V2.0___GRC.pdf` e `Medição` casarem com os
 *  termos abaixo sem uma expressão regular por grafia.
 *
 *  `\p{Diacritic}` e não a faixa de combinantes escrita à mão: a faixa exige
 *  caracteres combinantes literais no fonte, que somem em qualquer editor que
 *  normalize o arquivo — e o sintoma seria o aviso deixar de casar com nomes
 *  acentuados, sem nada no diff que explique. */
function normalizar(nome: string): string {
	return nome
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ");
}

/** Os termos que aparecem no nome dos relatórios de levantamento, e não no das
 *  propostas. `grc` entra como palavra inteira — é sigla, e como fragmento
 *  casaria dentro de palavras que nada têm a ver. */
const TERMOS_DE_LEVANTAMENTO = [/\blevantamento\b/, /\bgrc\b/, /\bcomprovacao\b/];

export function pareceLevantamento(nome: string): boolean {
	const normalizado = normalizar(nome);
	return TERMOS_DE_LEVANTAMENTO.some((termo) => termo.test(normalizado));
}
