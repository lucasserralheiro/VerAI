/**
 * T-1028 · T-1004 · T-1005 — ESPEC 016, o inventário dos mecanismos de anúncio.
 *
 * ## Vai acrescentar um anúncio? Leia isto primeiro  (`R-TA-07`)
 *
 * Toda espec que criar um mecanismo de anúncio novo — `aria-live`, `role="alert"`,
 * `role="status"` — **acrescenta uma entrada aqui**, e ganha de graça:
 *
 *   1. o teste de mecanismo (`anuncio.spec.ts`) passa a cobri-lo;
 *   2. a T-416 passa a exigir que a região preexista, se for de espécie `mutada`;
 *   3. a varredura DOM → inventário deixa de reprovar por ele.
 *
 * **Sem a entrada, a suíte reprova** — de propósito, e com a mensagem apontando
 * para cá. É onde esta regra mora: numa falha de teste, não numa spec que alguém
 * precisaria lembrar de ter lido.
 *
 * ---
 *
 * ## Este arquivo NÃO foi escrito a partir do DOM
 *
 * É a regra 2 do TASKS 016 §1.1, e é o risco central da entrega. Preencher
 * olhando o DevTools produz um arquivo que **parece** certo e faz `R-TA-10`
 * passar por construção: "todo mecanismo do DOM tem entrada" e "toda entrada tem
 * mecanismo" viram tautologias, e o teste inteiro deixa de afirmar qualquer
 * coisa. O sintoma seria a ausência de sintoma — nada fica vermelho.
 *
 * Cada entrada aponta a **regra que a exige**. Entrada sem regra é entrada que
 * veio do DOM, e não deve existir aqui.
 *
 * As cinco saem de quatro regras:
 *
 *   R-ACE-13  transição para `pronto`, `bloqueado` e `erro` é anunciada, e a
 *             região viva é montada desde o primeiro render
 *   R-ACE-14  `erro` e `bloqueado` usam `role="alert"`; `pronto` usa `aria-live`
 *   R-ACE-16  durante o processamento a tela informa que está trabalhando
 *   R-LMP-10  a volta ao estado inicial é anunciada, em região própria (`D-06`)
 *
 * ## O que o campo `especie` decide
 *
 * PLANO 016 §6.1: `R-TA-02` mandava testar que toda região viva é **mutada, não
 * inserida** — e para `role="alert"` isso é o oposto do correto. Alert é região
 * assertiva e atômica cujo padrão de uso **é** aparecer. Aplicar identidade de nó
 * ali deixaria a suíte vermelha contra código certo.
 *
 * ## Por que não há campo `automatizavel`
 *
 * `R-TA-06` previu um booleano por entrada. Na implementação ele seria `false`
 * em **todas**: a *fala* nunca é verificável por máquina (`D-04` — não há leitor
 * de tela sem alguém ouvindo). Campo constante não informa nada.
 *
 * O que substitui é mais forte: **toda entrada é um passo da escuta**, e o teste
 * de correspondência (T-1007) confronta as duas listas. Foi assim que se
 * descobriu que o roteiro da ESPEC 016 §8.3 **não tinha passo para `bloqueado`**.
 */

/** Os estados montáveis por `estados.ts`, mais o transitório. */
export type EstadoDeAnuncio =
	| "processando"
	| "pronto"
	| "erro"
	| "bloqueado"
	| "inicial-apos-limpeza"
	| "aviso-de-levantamento"
	| "aviso-de-identidade";

export interface Anuncio {
	/** Identificador estável. Aparece nas mensagens de falha, e é por ele que a
	 *  escuta e o teste falam da mesma coisa. */
	id: string;
	/**
	 * `aplicacao` — exigido por uma regra deste projeto.
	 * `framework`  — **injetado pelo Next.js**, sem regra nossa. Declarado mesmo
	 *                assim: é região viva de verdade, um leitor de tela a usa, e
	 *                omiti-la faria a varredura DOM → inventário reprovar por um
	 *                mecanismo legítimo. Ver o cabeçalho deste arquivo.
	 */
	origem: "aplicacao" | "framework";
	/** A regra que **exige** este anúncio. Sem ela, a entrada veio do DOM. */
	regra: string;
	/** Qual transição o dispara. */
	estado: EstadoDeAnuncio;
	/** Como encontrar o mecanismo. */
	seletor: string;
	/**
	 * `mutada`   — a região preexiste e o **conteúdo** muda. Identidade de nó
	 *              vale: nó novo é inserção, e inserção não anuncia (`D-03`).
	 * `inserida` — a região **aparece**. Identidade de nó não vale; o que se
	 *              afirma é presença, papel e mensagem (PLANO 016 §6.1).
	 */
	especie: "mutada" | "inserida";
	/** O que se espera **ouvir**. Só a escuta verifica isto (`R-TA-05`). */
	fala: string;
}

/** Os mecanismos da aplicação vivem **dentro do `<main id="conteudo">`**.
 *
 *  O escopo não é estilo: é o que separa o que este projeto declara do que o
 *  framework injeta. Sem ele, `[role="alert"]` casa também com o anunciador de
 *  rota do Next, que fica fora do `<main>` — e a primeira execução deste teste
 *  reprovou por modo estrito exatamente aí. */
const APP = "#conteudo";

export const INVENTARIO: readonly Anuncio[] = [
	{
		id: "processando",
		origem: "aplicacao",
		regra: "R-ACE-16",
		estado: "processando",
		seletor: `${APP} [aria-live="polite"]`,
		especie: "mutada",
		fala: "Processando o relatório. Pode levar até um minuto.",
	},
	{
		// T-2361 / ESPEC 038 `R-AVI-01` — **a fala mudou, o mecanismo não.**
		//
		// O bloco de avisos passou do fim da tela para logo abaixo da faixa, e com
		// isso entrou nesta mesma região viva: o que se ouve depois de *Relatório
		// gerado* passa a incluir o título do bloco e a frase que diz que o
		// relatório saiu assim mesmo. Não há entrada nova porque não há mecanismo
		// novo — nenhum `aria-live`, `alert` ou `status` foi criado (`R-AVI-07`).
		//
		// Nada de automático reprova por `fala` desatualizada: ela é verificada por
		// escuta (`R-TA-05`). É por isso que ela envelhece em silêncio, e por isso
		// que atualizá-la é tarefa própria.
		id: "conclusao",
		origem: "aplicacao",
		regra: "R-ACE-13 + R-ACE-14",
		estado: "pronto",
		seletor: `${APP} [aria-live="polite"]`,
		especie: "mutada",
		fala: "Relatório gerado, o placar de divergências e — havendo avisos — a contagem deles com a frase de que nenhum impede o uso.",
	},
	{
		id: "erro",
		origem: "aplicacao",
		regra: "R-ACE-13 + R-ACE-14",
		estado: "erro",
		seletor: `${APP} [role="alert"]`,
		especie: "inserida",
		fala: "A mensagem do erro, interrompendo o que estiver sendo lido.",
	},
	{
		id: "bloqueado",
		origem: "aplicacao",
		regra: "R-ACE-13 + R-ACE-14",
		estado: "bloqueado",
		seletor: `${APP} [role="alert"]`,
		especie: "inserida",
		fala: "Não foi possível gerar o relatório, e o que fazer para corrigir.",
	},
	{
		id: "limpeza",
		origem: "aplicacao",
		regra: "R-LMP-10",
		estado: "inicial-apos-limpeza",
		seletor: `${APP} [role="status"]`,
		especie: "mutada",
		fala: "Formulário limpo. Envie novos arquivos para gerar outro relatório.",
	},
	{
		// ESPEC 025 `R-DOC-08` — `status` e não `alert`: não é erro, é ressalva
		// sobre uma escolha ainda reversível, e interromper a leitura em curso
		// seria desproporcional.
		//
		// O seletor é por `id`, e não por `[role="status"]`, porque a região da
		// `R-LMP-10` também é `status` e fica montada desde o primeiro render.
		id: "aviso-de-levantamento",
		origem: "aplicacao",
		regra: "R-DOC-08",
		estado: "aviso-de-levantamento",
		seletor: `${APP} #contrato-aviso`,
		especie: "inserida",
		fala: "Este arquivo parece ser um levantamento. O campo Contrato espera a proposta comercial em PDF.",
	},
	{
		// T-2102 / ESPEC 029 `R-IDT-10` — o portão que pergunta se os dois
		// arquivos são do mesmo contrato.
		//
		// `status` e não `alert`, pela razão da entrada acima: não é erro, é
		// ressalva sobre uma escolha ainda reversível — e aqui com mais motivo
		// ainda, porque a caixa oferece **as duas saídas**.
		//
		// `id` próprio pelo mesmo motivo de `#contrato-aviso`: as duas caixas do
		// formulário e a região da `R-LMP-10` são todas `role="status"`, e o
		// seletor por papel resolveria três elementos onde a varredura espera um.
		id: "aviso-de-identidade",
		origem: "aplicacao",
		regra: "R-IDT-10",
		estado: "aviso-de-identidade",
		seletor: `${APP} #identidade-aviso`,
		especie: "inserida",
		fala: "Estes dois arquivos parecem ser de contratos diferentes, e o que fazer a respeito.",
	},
	{
		// **Achado da primeira execução, 2026-08-12.** A ESPEC 016 §2.2 contou
		// cinco mecanismos lendo `frontend/src/`. São seis: o Next.js injeta o
		// próprio anunciador de rota em toda página, e ele é `role="alert"` com
		// `aria-live="assertive"` — a espécie mais intrusiva que existe.
		//
		// Fica declarado porque é região viva de verdade e um leitor de tela a usa.
		// Esta aplicação **não tem navegação de cliente**: é uma rota só, e o
		// anunciador deve permanecer **sempre vazio**. Se algum dia soar, é achado.
		id: "anunciador-de-rota-do-next",
		origem: "framework",
		regra: "nenhuma — injetado pelo Next.js",
		estado: "processando",
		seletor: "#__next-route-announcer__",
		especie: "mutada",
		fala: "(silêncio — esta aplicação tem uma rota só)",
	},
];

/** Só o que este projeto declara. É o alvo das regras `R-ACE-*` e `R-LMP-*`. */
export const DA_APLICACAO = INVENTARIO.filter((a) => a.origem === "aplicacao");

/** As entradas da **aplicação** cuja região preexiste — as únicas em que
 *  identidade de nó afirma o que se quer afirmar.
 *
 *  Derivadas de `DA_APLICACAO`, e não do inventário inteiro: o anunciador do Next
 *  também é `mutada`, mas nesta aplicação ele nunca muda — exigir dele conteúdo
 *  após a transição reprovaria o comportamento correto. */
export const MUTADAS = DA_APLICACAO.filter((a) => a.especie === "mutada");

/** As que aparecem. Para elas, aparecer **é** o comportamento correto. */
export const INSERIDAS = DA_APLICACAO.filter((a) => a.especie === "inserida");

/** O anunciador do framework, para a asserção que lhe cabe: existir e **calar**. */
export const DO_FRAMEWORK = INVENTARIO.filter((a) => a.origem === "framework");

/** Seletores de região viva de topo, sem repetição.
 *
 *  `R-TA-11` — é daqui que sai a contagem da T-416, no lugar da constante `1`
 *  que descrevia a tela de 2026-08-07 e virou requisito sem nunca ter sido
 *  decidido como tal (ESPEC 016 §2.5). */
export const SELETORES_DE_REGIAO = Array.from(new Set(INVENTARIO.map((a) => a.seletor)));