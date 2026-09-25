import type {
	Estado,
	NomeDoCampo,
	RespostaBloqueada,
	RespostaDaConferencia,
	RespostaRelatorio,
} from "./types";

/** Tipo MIME do DOCX. Sem ele o navegador entrega o arquivo como binário
 *  genérico e o Word não o abre com dois cliques. */
const TIPO_DOCX =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Tipo MIME do XLSX (ESPEC 009). Pela mesma razão do DOCX: sem ele o navegador
 *  entrega binário genérico e o Excel não abre com dois cliques. */
const TIPO_XLSX =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Converte um documento em base64 numa URL de download.
 *
 *  O backend os embute na resposta porque a aplicação é sem estado — não há onde
 *  guardá-los entre duas chamadas (ESPEC 002 §6).
 */
function urlDoDocumento(base64: string, tipo: string): string {
	const binario = atob(base64);
	const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
	return URL.createObjectURL(new Blob([bytes], { type: tipo }));
}

/** Rota própria do VerAI (`src/app/api/confere/reports/route.ts`), que
 *  encaminha pro Confere de verdade injetando `X-Confere-Secret` no
 *  servidor — igual ao app original, mas sem o navegador falar direto com o
 *  Confere nem conhecer o segredo (ver src/lib/confere/cliente.ts). */
export const API_BASE_URL = "/api/confere";

/** Teto de espera da geração, em milissegundos — ESPEC 012 `D-05`.
 *
 *  No Confere original eram 180 s: 8× os 22,8 s medidos no piloto, e **abaixo**
 *  do limite do ingress do Container Apps, para o estouro chegar à tela como
 *  timeout nosso, e não como conexão cortada pela plataforma.
 *
 *  No VerAI a relação se inverte. Quem espera o Confere é o proxy
 *  (`src/app/api/confere/reports/route.ts`), que tem o próprio teto
 *  (`maxDuration` de 300 s) e desiste do Confere antes dele, respondendo 504
 *  **com mensagem**. O navegador precisa esperar **mais** que o proxy para essa
 *  resposta chegar: com 180 s ele abandonava gerações ainda dentro do prazo —
 *  medido em 24/09/2026 no Render free, 134 s num contrato com aditivo, mais
 *  ~23 s quando o serviço hiberna. Este teto sobra só para a conexão pendurada.
 *
 *  Sem isto, uma conexão pendurada deixa a tela esperando **para sempre**: o
 *  indicador de atividade continua girando e promete algo que não vem.
 */
const TIMEOUT_MS = 310_000;

/** O teto efetivo, com a costura que torna o estouro testável.
 *
 *  Com o teto fixo, o caminho do estouro seria **intestável**: o limite por teste
 *  do Playwright é 120 s. A primeira tentativa foi encurtar o teto por variável
 *  de ambiente no `playwright.config.ts` — e ela **abortava toda geração real da
 *  suíte aos 3 s**, porque valia para todos os casos, não só para o do estouro.
 *
 *  A injeção em tempo de execução é o que faltava: só a página do teste do
 *  estouro a define, por `addInitScript`, e nenhum outro caso é afetado. Em
 *  produção a variável nunca existe e vale o padrão.
 */
function tempoLimite(): number {
	const injetado = (globalThis as { __CONFERE_TIMEOUT_MS__?: number })
		.__CONFERE_TIMEOUT_MS__;
	return typeof injetado === "number" && injetado > 0 ? injetado : TIMEOUT_MS;
}

/** Teto do portão de entrada, em milissegundos — ESPEC 029 `R-IDT-12`.
 *
 *  Três segundos sobre uma resposta medida em **0,9 s**. O que este número
 *  protege não é o caso normal: é o dia em que o portão ficar pendurado. Passado
 *  o teto, o envio segue como se ele não existisse.
 */
const TIMEOUT_DA_CONFERENCIA_MS = 3_000;

/** ESPEC 029 `R-IDT-10` — os arquivos são do mesmo contrato?
 *
 *  **Falha aberto** (`R-IDT-12`): erro de rede, resposta inválida ou demora
 *  acima do teto devolvem `null`, e quem chama segue para a geração. Falhar
 *  fechado poria a emissão do relatório na dependência de um caminho que existe
 *  só para economizar trinta segundos — e a validação de dentro do fluxo
 *  continua barrando o par divergente de qualquer jeito, como 422 com
 *  `confirmaveis`.
 */
export async function conferirIdentidade(
	arquivos: Record<NomeDoCampo, File>,
	aditivos: readonly File[] = [],
): Promise<RespostaDaConferencia | null> {
	const corpo = new FormData();
	for (const [campo, arquivo] of Object.entries(arquivos)) {
		corpo.append(campo, arquivo);
	}
	for (const aditivo of aditivos) {
		corpo.append("aditivos", aditivo);
	}

	const controlador = new AbortController();
	const cronometro = setTimeout(
		() => controlador.abort(),
		TIMEOUT_DA_CONFERENCIA_MS,
	);

	try {
		const resposta = await fetch(`${API_BASE_URL}/reports/conferencia-previa`, {
			method: "POST",
			body: corpo,
			signal: controlador.signal,
		});
		if (!resposta.ok) return null;
		const dados: RespostaDaConferencia = await resposta.json();
		// Resposta sem o formato esperado é tratada como ausência de resposta: a
		// tela não pergunta o que não entendeu.
		return typeof dados?.combinam === "boolean" ? dados : null;
	} catch {
		return null;
	} finally {
		clearTimeout(cronometro);
	}
}

/** Envia os três arquivos e devolve o estado resultante.
 *
 *  Bloqueio de validação não é erro de rede: chega como 422 com a lista de
 *  achados, e o usuário precisa vê-la — não uma mensagem genérica de falha.
 */
export async function gerarRelatorio(
	arquivos: Record<NomeDoCampo, File>,
	aditivos: readonly File[] = [],
	identidadeConfirmada = false,
): Promise<Estado> {
	const corpo = new FormData();
	for (const [campo, arquivo] of Object.entries(arquivos)) {
		corpo.append(campo, arquivo);
	}
	// ESPEC 029 `R-IDT-10` — a resposta ao portão. Só vai quando **é** `true`:
	// mandar `false` seria dizer ao backend que a pergunta foi feita e recusada,
	// e ela pode nem ter sido feita (`R-IDT-12`).
	if (identidadeConfirmada) {
		corpo.append("identidade_confirmada", "true");
	}
	// ESPEC 019 `R-ADT-10` — o mesmo nome repetido é como `multipart` expressa
	// lista, e é o que o FastAPI recebe em `list[UploadFile]`. A ordem de
	// `append` é a ordem de aplicação (`R-ADT-07`).
	for (const aditivo of aditivos) {
		corpo.append("aditivos", aditivo);
	}

	// `AbortController` e não `AbortSignal.timeout()`: o segundo tem suporte mais
	// recente, e este é o caminho que decide se a tela trava para sempre.
	const controlador = new AbortController();
	const cronometro = setTimeout(() => controlador.abort(), tempoLimite());

	let resposta: Response;
	try {
		resposta = await fetch(`${API_BASE_URL}/reports`, {
			method: "POST",
			body: corpo,
			signal: controlador.signal,
		});
	} catch (erro) {
		// Demora e queda produzem a mesma exceção no `fetch`, e culpam coisas
		// diferentes. Mandar conferir se o backend está no ar quando ele está no
		// ar **trabalhando** manda a pessoa para o lugar errado.
		if (erro instanceof DOMException && erro.name === "AbortError") {
			return {
				situacao: "erro",
				mensagem:
					"A geração passou de cinco minutos e foi interrompida. O servidor pode estar sobrecarregado — tente novamente em instantes.",
			};
		}
		return {
			situacao: "erro",
			mensagem:
				"Não foi possível falar com o servidor. Verifique se o backend está no ar.",
		};
	} finally {
		// No `finally` para valer também no caminho feliz: sem isto o cronômetro
		// sobrevive à resposta e dispara um `abort` sobre requisição já concluída.
		clearTimeout(cronometro);
	}

	if (resposta.ok) {
		const relatorio: RespostaRelatorio = await resposta.json();
		return {
			situacao: "pronto",
			relatorio,
			urlDocx: urlDoDocumento(relatorio.docx_base64, TIPO_DOCX),
			urlAnalise: urlDoDocumento(relatorio.analise_xlsx_base64, TIPO_XLSX),
		};
	}

	const dados = await resposta.json().catch(() => null);

	if (dados && Array.isArray(dados.bloqueantes)) {
		const bloqueada = dados as RespostaBloqueada;
		return {
			situacao: "bloqueado",
			bloqueantes: bloqueada.bloqueantes,
			avisos: bloqueada.avisos,
			// ESPEC 029 `R-IDT-10` — separados, porque quem os recebe faz com eles
			// outra coisa: oferece a saída. Este caminho só é alcançado quando o
			// portão não foi consultado — chamada direta à API, ou falha aberta
			// (`R-IDT-12`) —, e é justamente aí que a pessoa ficaria com uma
			// mensagem dizendo *"ou gere assim mesmo"* e nenhum botão que o faça.
			confirmaveis: bloqueada.confirmaveis ?? [],
		};
	}

	return {
		situacao: "erro",
		mensagem: dados?.detail ?? mensagemDaPlataforma(resposta.status),
	};
}

/** Erro **sem** `detail` não veio do proxy nem do Confere — os dois sempre
 *  respondem com um. Veio da plataforma que hospeda o VerAI, com corpo em
 *  texto, e o status é tudo o que há para explicar o que houve. */
function mensagemDaPlataforma(status: number): string {
	if (status === 504) {
		return "O servidor interrompeu a geração por tempo (HTTP 504). O Confere pode continuar processando este envio por alguns minutos — espere um pouco antes de tentar de novo.";
	}
	if (status === 413) {
		return "Os arquivos, somados, passam de 4,5 MB, o limite por envio da hospedagem do VerAI (HTTP 413). Reduza o tamanho dos PDFs e tente de novo.";
	}
	return `Falha no processamento (HTTP ${status}).`;
}

/** ESPEC — pré-aquecimento do serviço.
 *
 *  O Confere hiberna no plano free do Render, e o despertar custa ~1min
 *  **antes** dos ~25s de geração. Chamado quando a pessoa escolhe o primeiro
 *  arquivo, esse minuto passa a correr enquanto ela escolhe o segundo — não é
 *  percepção de rapidez, é tempo a menos de espera de verdade.
 *
 *  **Nunca lança e nunca bloqueia nada**: o valor devolvido só decide qual
 *  frase a tela mostra enquanto processa. Falha vira `dormindo: true`, que é a
 *  leitura conservadora — prometer 25 segundos e entregar 85 é pior do que
 *  avisar que pode demorar.
 */
export async function aquecerServico(): Promise<{ dormindo: boolean }> {
	try {
		const resposta = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
		if (!resposta.ok) return { dormindo: true };
		const dados: { dormindo?: boolean } = await resposta.json();
		return { dormindo: dados?.dormindo === true };
	} catch {
		return { dormindo: true };
	}
}
