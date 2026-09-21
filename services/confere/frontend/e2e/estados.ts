import { readFileSync } from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";

import type { Achado, DivergenciaDeFonte } from "../src/lib/types";

/** Os estados da tela, montados uma vez e usados pelas specs de acessibilidade.
 *
 *  `scripts/capturar-baseline.mjs` repete estas montagens de propósito: é script
 *  de Node puro, fora do runtime de TypeScript do Playwright. Se divergirem, a
 *  captura e as varreduras deixam de falar do mesmo estado.
 */

const FIXTURES = path.resolve(__dirname, "../../backend/tests/fixtures");
export const CONTRATO = path.join(FIXTURES, "contrato.pdf");
export const LEVANTAMENTO = path.join(FIXTURES, "levantamento.xlsx");

/** T-2103 / ESPEC 029 — o portão de identidade, respondido *combinam* por padrão.
 *
 *  **`**\/reports` não casa com `**\/reports/conferencia-previa`**: aquele padrão
 *  exige que a URL *termine* em `/reports`, e as treze interceptações desta suíte
 *  deixariam o portão escapar para a rede. Sem backend no ar ele falharia aberto
 *  (`R-IDT-12`) e a suíte passaria assim mesmo — o que é pior que falhar: o teste
 *  dependeria de o backend estar **fora** do ar para exercitar o caminho certo.
 *
 *  Interceptar aqui torna o comportamento determinístico e o silêncio explícito.
 */
export async function semPortaoDeIdentidade(page: Page) {
	await page.route("**/reports/conferencia-previa", (rota) =>
		rota.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				combinam: true,
				contrato: null,
				levantamento: null,
				achados: [],
			}),
		}),
	);
}

export async function escolherArquivos(page: Page, levantamento = LEVANTAMENTO) {
	await semPortaoDeIdentidade(page);
	await page.locator('input[type="file"]').nth(0).setInputFiles(CONTRATO);
	await page.locator('input[type="file"]').nth(1).setInputFiles(levantamento);
}

async function gerar(page: Page, levantamento = LEVANTAMENTO) {
	await escolherArquivos(page, levantamento);
	await page.getByRole("button", { name: /Gerar relat/ }).click();
}

/** ESPEC 025 `R-DOC-08` — o aviso que chega **antes** de qualquer requisição.
 *
 *  O arquivo é o `contrato.pdf` de sempre, entregue com **outro nome**: o aviso
 *  julga pelo nome, e um buffer nomeado evita uma fixture nova só para isso. */
export async function avisoDeLevantamento(page: Page) {
	await page.goto("/");
	await page.locator('input[type="file"]').first().waitFor();
	await page.locator('input[type="file"]').nth(0).setInputFiles({
		name: "SMIT_SUSTENTACAO_Levantamento_05969_V2.0___GRC.pdf",
		mimeType: "application/pdf",
		buffer: readFileSync(CONTRATO),
	});
	await page.getByText(/parece ser um levantamento/i).waitFor({ timeout: 15_000 });
}

/** T-2105 / ESPEC 029 `R-IDT-10` — o portão perguntando.
 *
 *  A resposta é fabricada: o que esta suíte exercita é **a tela**, e o achado já
 *  tem cobertura de backend com os arquivos reais (`T-2078`, `T-2097`).
 */
export const ACHADO_DE_IDENTIDADE = {
	validacao: "V-IDT-01",
	severidade: "PERGUNTA",
	mensagem:
		"Estes dois arquivos parecem ser de contratos diferentes. O contrato enviado é o 52/SMIT/2024 e o levantamento declara 015/PGM/2024.",
	codigo: null,
	titulo: "Estes dois arquivos parecem ser de contratos diferentes.",
	causa:
		"O contrato enviado é o 52/SMIT/2024 (proposta PA-SMIT-260319-739), e o levantamento declara 015/PGM/2024. Se seguir assim mesmo, o relatório sairá com o órgão do contrato na capa e o número do levantamento no cabeçalho.",
	acao: "Envie o levantamento do contrato 52/SMIT/2024, ou o contrato correspondente ao levantamento de PGM.",
	detalhe: "V-IDT-01 · contrato: 52/SMIT/2024 (página 1)",
};

export async function avisoDeIdentidade(page: Page) {
	await page.goto("/");
	await page.locator('input[type="file"]').first().waitFor();
	await page.route("**/reports/conferencia-previa", (rota) =>
		rota.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				combinam: false,
				contrato: "52/SMIT/2024",
				levantamento: "TC 015/PGM/2024",
				achados: [ACHADO_DE_IDENTIDADE],
			}),
		}),
	);
	await page.locator('input[type="file"]').nth(0).setInputFiles(CONTRATO);
	await page.locator('input[type="file"]').nth(1).setInputFiles(LEVANTAMENTO);
	await page.getByRole("button", { name: /Gerar relat/ }).click();
	await page
		.getByText(/parecem ser de contratos diferentes/i)
		.waitFor({ timeout: 15_000 });
}

export async function inicial(page: Page) {
	await page.goto("/");
	await page.locator('input[type="file"]').first().waitFor();
}

export async function pronto(page: Page) {
	await page.goto("/");
	await gerar(page);
	await page.getByText("Relatório gerado").waitFor({ timeout: 120_000 });
}

/** O contrato é PDF válido e não é planilha: a recusa vem da assinatura do
 *  arquivo, antes de qualquer validação de conteúdo. Produz `erro`. */
export async function erro(page: Page) {
	await page.goto("/");
	await gerar(page, CONTRATO);
	await page.getByText(/não é um arquivo XLSX válido/i).waitFor({ timeout: 120_000 });
}

/** T-1902 / ESPEC 025 — **o dublê permanece por escolha, não por falta de
 *  fixture.**
 *
 *  Até a ESPEC 025 nenhuma combinação das fixtures produzia achado bloqueante, e
 *  era isso que obrigava ao 422 sintético. Deixou de ser verdade: `modelo.pdf`
 *  no campo do contrato bloqueia, e a `T-1900` mede os achados que ele gera.
 *
 *  O dublê fica porque aquele par custa ~17 s de extração por chamada, e o que
 *  esta suíte mede é **a tela diante de uma resposta** — a correção da resposta
 *  é medida no `pytest`, com os arquivos reais, onde já está. */
export async function bloqueado(page: Page) {
	await page.route("**/reports", (rota) =>
		rota.fulfill({
			status: 422,
			contentType: "application/json",
			body: JSON.stringify({
				detalhe: "Processamento bloqueado",
				bloqueantes: [
					{
						validacao: "V-CTR-03",
						severidade: "BLOQUEIA",
						mensagem: "O total do levantamento não confere com a soma dos itens medidos.",
						codigo: "4.1.2",
					},
				],
				avisos: [
					{
						validacao: "V-MED-07",
						severidade: "AVISA",
						mensagem: "Item medido sem unidade declarada na planilha.",
						codigo: "2.3.1",
					},
				],
			}),
		}),
	);

	await page.goto("/");
	await gerar(page);
	await page.getByText(/Não foi possível gerar o relatório/i).waitFor({ timeout: 30_000 });
}

/** T-2046 / ESPEC 027 `R-LEV-08`, `D-05` — vários `V-CTR-05` viram um cartão.
 *
 *  Mesmo dublê do `bloqueado`: a correção da resposta é medida no `pytest`,
 *  com os arquivos reais; o que esta suíte mede é a tela diante da resposta.
 *  Precisa de um bloqueante para abrir a região `role="alert"` — `V-CTR-05` é
 *  aviso, não bloqueio.
 */
export async function bloqueadoComVariosCodigosAusentes(page: Page) {
	await page.route("**/reports", (rota) =>
		rota.fulfill({
			status: 422,
			contentType: "application/json",
			body: JSON.stringify({
				detalhe: "Processamento bloqueado",
				bloqueantes: [
					{
						validacao: "V-CTR-03",
						severidade: "BLOQUEIA",
						mensagem: "O total do levantamento não confere com a soma dos itens medidos.",
						codigo: "4.1.2",
					},
				],
				avisos: [
					{
						validacao: "V-CTR-05",
						severidade: "AVISA",
						mensagem: "código 10.050.00001.00 está no contrato mas não aparece no levantamento — não entrará no relatório",
						codigo: "10.050.00001.00",
					},
					{
						validacao: "V-CTR-05",
						severidade: "AVISA",
						mensagem: "código 10.050.00002.00 está no contrato mas não aparece no levantamento — não entrará no relatório",
						codigo: "10.050.00002.00",
					},
					{
						validacao: "V-CTR-05",
						severidade: "AVISA",
						mensagem: "código 11.027.00003.00 está no contrato mas não aparece no levantamento — não entrará no relatório",
						codigo: "11.027.00003.00",
					},
				],
			}),
		}),
	);

	await page.goto("/");
	await gerar(page);
	await page.getByText(/Não foi possível gerar o relatório/i).waitFor({ timeout: 30_000 });
}

/** T-556 — uma situação da análise **sem itens**.
 *
 *  Com o universo de `D-01` as quatro situações do piloto têm itens — 1, 20, 16
 *  e 19 —, então nenhum estado montado a partir dos arquivos reais percorre este
 *  caminho. E são três regras que só existem para ele: `R-PAN-04` na tela,
 *  `R-XLS-01` no arquivo e `R-API-01` na resposta.
 *
 *  O dublê é a resposta **real** com as linhas de uma situação removidas: assim o
 *  que se testa é o caminho de renderização, e não um objeto inventado que
 *  poderia divergir do contrato da API sem que nada acusasse.
 *
 *  Por que gerar de verdade primeiro, e só então interceptar: `route.fetch()`
 *  reenvia o corpo da requisição, e o corpo aqui é **multipart com dois arquivos
 *  binários**. Ele volta corrompido — a resposta é `400 'contrato' não é um
 *  arquivo PDF válido`, pela verificação de assinatura da T-54. Capturar a
 *  resposta boa e reemitir a versão modificada evita o problema e, de quebra,
 *  não paga uma segunda geração de ~35 s.
 */
export async function situacaoVazia(page: Page) {
	await page.goto("/");

	const [resposta] = await Promise.all([
		page.waitForResponse(
			(r) => r.url().endsWith("/reports") && r.status() === 200,
			{ timeout: 120_000 },
		),
		gerar(page),
	]);

	const corpo = await resposta.json();
	for (const situacao of corpo.analise.situacoes) {
		if (situacao.classificacao === "CRITICO") {
			corpo.analise.total_itens -= situacao.quantidade;
			situacao.linhas = [];
			situacao.quantidade = 0;
		}
	}

	await page.route("**/reports", (rota) =>
		rota.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(corpo),
		}),
	);

	await page.getByRole("button", { name: /Gerar relat/ }).click();
	// O rótulo "Relatório gerado" já está na tela desde a primeira geração: o que
	// distingue o segundo estado é o bloco crítico ter esvaziado. A frase por
	// extenso mora **dentro** do bloco, que nasce fechado — o que fica visível é a
	// contagem no cabeçalho.
	//
	// `exact` porque, sem ele, `0 itens` casa dentro de `20 itens` e o modo
	// estrito do Playwright resolve dois elementos.
	await page.getByText("0 itens", { exact: true }).waitFor({ timeout: 30_000 });
}

/** ESPEC 015 `R-LMP-13` — o modal de confirmação, aberto.
 *
 *  Precisa de estado próprio por um motivo mecânico: `<dialog>` fechado computa
 *  `display: none`, e a varredura de contraste pula o invisível pela função
 *  `invisivel()`. Sem montar este estado, **o texto do diálogo não é medido em
 *  lugar nenhum** — e um modal fora do inventário é a forma mais comum de
 *  conformidade presumida.
 *
 *  Monta a variante **sem relatório**: é a mesma marcação, com as mesmas classes,
 *  e poupa os ~25 s de uma geração real. O que muda entre as duas é a frase, não
 *  a cor nem a caixa. */
export async function confirmacaoDeLimpeza(page: Page) {
	await page.goto("/");
	await escolherArquivos(page);
	await page.getByRole("button", { name: "Limpar", exact: true }).click();
	await page.getByRole("button", { name: "Limpar tudo" }).waitFor();
}

/** T-1701 / ESPEC 023 — a tela com divergência de contratado, **estado A**.
 *
 *  **O par piloto produz zero `V-REC-01`** — o que produz cinco é o do PGM, e
 *  gerá-lo por HTTP leva ~140 s, acima do teto de 120 s por teste do Playwright
 *  (`test_api_e2e::test_t1350_o_par_do_pgm_com_aditivo_entra_por_http` mede).
 *  Sem este dublê, todo instrumento de tela desta espec nasce vacuamente verde:
 *  a sigla que ele procura nunca esteve lá.
 *
 *  Gera de verdade e injeta, como `situacaoVazia`, e pelo mesmo motivo: o que se
 *  exercita é o caminho de renderização sobre o contrato **real** da API. Um
 *  corpo inventado divergiria do schema sem que nada acusasse.
 *
 *  Os valores são transcritos de `backend/tests/test_quantitativo_consolidado.py`
 *  — `CONTRATADO_CONSOLIDADO` e `DELTAS_DO_ADITIVO`, que por sua vez saem do PDF
 *  do aditivo. Se aquelas constantes mudarem, estas mudam junto.
 */
const DIVERGENCIAS_DO_PGM: DivergenciaDeFonte[] = [
	{
		codigo: "14.048.00027.00",
		descricao: "ARMAZENAMENTO EM DISCO",
		unidade: "GB/MÊS",
		no_contrato: "200,00",
		no_aditivo: null,
		na_proposta: null,
		na_planilha: "1.300,00",
		diferenca: "+1.100,00",
		variacao_pct: 550.0,
		tem_aditivo_aplicado: false,
		severidade: "MAIOR_RELEVANCIA",
	},
	{
		codigo: "14.031.00020.00",
		descricao: "LICENÇA DE SOFTWARE",
		unidade: "LICENÇA ATIVA/ MÊS",
		no_contrato: "5,00",
		no_aditivo: null,
		na_proposta: null,
		na_planilha: "10,00",
		diferenca: "+5,00",
		variacao_pct: 100.0,
		tem_aditivo_aplicado: false,
		severidade: "MAIOR_RELEVANCIA",
	},
	{
		codigo: "12.030.00001.00",
		descricao: "LINK DE COMUNICAÇÃO",
		unidade: "Mbps/MÊS",
		no_contrato: "150,00",
		no_aditivo: null,
		na_proposta: null,
		na_planilha: "70,00",
		diferenca: "−80,00",
		variacao_pct: -53.33,
		tem_aditivo_aplicado: false,
		severidade: "MAIOR_RELEVANCIA",
	},
	{
		codigo: "14.024.00006.00",
		descricao: "CÓPIA DE SEGURANÇA",
		unidade: "GB/MÊS",
		no_contrato: "6.100,00",
		no_aditivo: null,
		na_proposta: null,
		na_planilha: "9.000,89",
		diferenca: "+2.900,89",
		variacao_pct: 47.55,
		tem_aditivo_aplicado: false,
		severidade: "MAIOR_RELEVANCIA",
	},
	{
		codigo: "10.050.00001.00",
		descricao: "HORA TÉCNICA DE SUSTENTAÇÃO",
		unidade: "HORA/HOMEM",
		no_contrato: "42.260,00",
		no_aditivo: null,
		na_proposta: null,
		na_planilha: "42.814,01",
		diferenca: "+554,01",
		variacao_pct: 1.31,
		tem_aditivo_aplicado: false,
		severidade: "MAIOR_RELEVANCIA",
	},
];

/** T-1702 — o **estado B**: aditivo anexado e um item que ainda não fecha.
 *
 *  **Nenhuma fixture do repositório produz este estado.** A ESPEC 022 §2.4 o
 *  construiu adulterando `contratada_texto` na medição em memória, e é a única
 *  forma de tê-lo. Aqui ele é o dublê correspondente.
 */
const DIVERGENCIA_COM_ADITIVO: DivergenciaDeFonte[] = [
	{
		codigo: "14.048.00027.00",
		descricao: "ARMAZENAMENTO EM DISCO",
		unidade: "GB/MÊS",
		no_contrato: "1.300,00",
		no_aditivo: "1.100,00",
		na_proposta: "200,00",
		na_planilha: "1.400,00",
		diferenca: "+100,00",
		variacao_pct: 7.69,
		tem_aditivo_aplicado: true,
		severidade: "CRITICO",
	},
];

/* T-1728 — o `comoAvisos` saiu daqui.
 *
 * Entre o E0 e o E3 o dublê injetava os cinco em `avisos`, no formato da frase,
 * porque era assim que o backend os entregava: é o que fez a T-1703 encontrar as
 * frases e a T-1705 reprovar contra o código intocado.
 *
 * A T-1725 tirou a `V-REC-01` de `avisos` (`R-FON-09`), e manter a injeção aqui
 * faria o dublê **reintroduzir na tela** exatamente a cadeia que a T-1705
 * procura — um teste que reprova por causa do próprio andaime. */

/** T-2351 / ESPEC 038 — a montagem que os dublês de `pronto` partilham: deixa o
 *  backend responder **uma vez**, muta o corpo e o serve de volta.
 *
 *  Extraída quando o `prontoComAvisos` entrou. A alternativa era uma segunda
 *  cópia da espera de rede abaixo — e é justamente a sutileza do `endsWith` que
 *  não pode existir em duas versões: ela já custou onze testes vermelhos uma vez
 *  (T-2103), e o segundo lugar de errar seria descoberto do mesmo jeito.
 */
async function comRelatorioMutado(
	page: Page,
	mutar: (corpo: Record<string, unknown>) => void,
) {
	await page.goto("/");

	// **`endsWith`, e não `includes`** (T-2103 / ESPEC 029).
	//
	// `POST /reports/conferencia-previa` também termina em `/reports`? Não — e é
	// esse o ponto: ele **contém** `/reports` e responde **antes** da geração.
	// Com `includes`, esta espera capturava o corpo do portão —
	// `{combinam, contrato, levantamento, achados}` — e o dublê o devolvia no
	// lugar do relatório. A tela nunca virava `pronto`, e onze testes reprovavam
	// esperando por *Relatório gerado*.
	const [resposta] = await Promise.all([
		page.waitForResponse((r) => r.url().endsWith("/reports") && r.status() === 200, {
			timeout: 120_000,
		}),
		gerar(page),
	]);

	const corpo = (await resposta.json()) as Record<string, unknown>;
	mutar(corpo);

	await page.route("**/reports", (rota) =>
		rota.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(corpo),
		}),
	);

	await page.getByRole("button", { name: /Gerar relat/ }).click();
	await page.getByText(/Relatório gerado/).waitFor({ timeout: 30_000 });
}

async function comDivergencias(page: Page, divergencias: DivergenciaDeFonte[]) {
	await comRelatorioMutado(page, (corpo) => {
		corpo.divergencias_de_fonte = divergencias;
		// `R-FON-09` — a `V-REC-01` não sai mais em `avisos`. O dublê espelha isso.
		corpo.avisos = [];
	});
}

/** T-2351 / ESPEC 038 — os dois avisos do estado `prontoComAvisos`.
 *
 *  **De formatos diferentes, porque o bloco pode conter os dois:** oito das treze
 *  validações que emitem `AVISA` ainda mandam só `mensagem` (`I-01`), e cinco
 *  mandam as quatro partes da `R-DOC-05`.
 *
 *  Os textos são os das validações reais — `measurement_validations.py:213` e
 *  `annex_validations.py:48` —, e não invenção: o cartão renderiza o que o
 *  backend manda, e um texto inventado mediria a tela contra um caso que não
 *  existe.
 */
const AVISOS: Achado[] = [
	{
		validacao: "V-MED-03",
		severidade: "AVISA",
		mensagem:
			"código 14.031.00023.00 aparece 2 vezes no levantamento sem bloco de " +
			"desconto identificado — foi usada a última ocorrência (linha 120, medida 793)",
		codigo: "14.031.00023.00",
	},
	{
		validacao: "V-ANX-01",
		severidade: "AVISA",
		// `mensagem` é a junção das três primeiras partes, como o
		// `registrar_em_partes` a monta no backend.
		mensagem:
			"Nenhuma aba de detalhamento foi reconhecida na planilha. As 19 abas de " +
			"anexo esperadas não foram encontradas, ou vieram sem conteúdo. A tabela " +
			"de comprovação foi lida normalmente. Confira se a planilha é a do " +
			"levantamento completo. O documento sai sem os anexos de detalhamento.",
		codigo: null,
		titulo: "Nenhuma aba de detalhamento foi reconhecida na planilha.",
		causa:
			"As 19 abas de anexo esperadas não foram encontradas, ou vieram sem " +
			"conteúdo. A tabela de comprovação foi lida normalmente.",
		acao:
			"Confira se a planilha é a do levantamento completo. O documento sai sem " +
			"os anexos de detalhamento.",
		detalhe: "Abas configuradas: Servidores, ServidoresSemDesenv, SDWAN.",
	},
];

/** T-2351 / ESPEC 038 — o estado `pronto` **com avisos**.
 *
 *  **Nenhuma fixture o produz.** O piloto não emite aviso nenhum no caminho
 *  `pronto` — medido na T-2348, com a tela no ar —, e os dois dublês de
 *  `comDivergencias` zeram a lista de propósito. O bloco âmbar da tela de
 *  resultado nunca esteve sob teste nem sob varredura `axe`: é o que a ESPEC 038
 *  §2.2 mediu, e a razão de a posição dele ter atravessado seis especs sem
 *  ninguém tropeçar.
 */
export async function prontoComAvisos(page: Page) {
	await comRelatorioMutado(page, (corpo) => {
		corpo.avisos = AVISOS;
	});
}

export async function divergenciaDeFonte(page: Page) {
	await comDivergencias(page, DIVERGENCIAS_DO_PGM);
}

export async function divergenciaComAditivo(page: Page) {
	await comDivergencias(page, DIVERGENCIA_COM_ADITIVO);
}

/** Os cinco estados que têm layout próprio. `processando` fica de fora das
 *  varreduras: é transitório e exige segurar a resposta, o que só a captura faz. */
export const ESTADOS = {
	inicial,
	pronto,
	erro,
	bloqueado,
	confirmacaoDeLimpeza,
	// T-1733 / ESPEC 023 — os dois estados novos entram nas varreduras `axe`
	// pelo mesmo caminho parametrizado que a tabela da ESPEC 021 usou.
	divergenciaDeFonte,
	divergenciaComAditivo,
	// T-2359 / ESPEC 038 — o `pronto` **com avisos**, que nenhuma varredura cobria:
	// o piloto não emite aviso nesse caminho e os dois dublês acima zeram a lista.
	// Três testes de graça — `axe` nas duas larguras e o contraste —, ao preço de
	// três gerações reais.
	prontoComAvisos,
	// T-2105 / ESPEC 029 — o portão de identidade entra nas varreduras `axe`
	// pelo mesmo caminho parametrizado dos anteriores.
	avisoDeIdentidade,
};
