/** @jest-environment node */
import { gerarRelatorio } from "./api";

// Os dois campos que `CAMPOS` exige.
const ARQUIVOS = {
	contrato: new File(["%PDF"], "contrato.pdf"),
	levantamento: new File(["xlsx"], "levantamento.xlsx"),
};

afterEach(() => {
	jest.restoreAllMocks();
	jest.useRealTimers();
});

describe("gerarRelatorio — o que a tela diz quando dá errado", () => {
	// Quebra que pega: o print de 24/09/2026. A Vercel corta a função por tempo e
	// devolve 504 com corpo em texto; sem olhar o status, a tela dizia só
	// "Falha no processamento (HTTP 504).", que não conta o que houve nem o que
	// fazer.
	it("504 da plataforma (corpo sem JSON): diz que foi tempo, não só o código", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(
				"An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT",
				{ status: 504 },
			),
		);

		const estado = await gerarRelatorio(ARQUIVOS);

		expect(estado).toEqual({
			situacao: "erro",
			mensagem: expect.stringMatching(/tempo/i),
		});
	});

	it("413 da plataforma: diz que os arquivos passaram do limite de tamanho", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response("Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE", {
				status: 413,
			}),
		);

		const estado = await gerarRelatorio(ARQUIVOS);

		expect(estado).toEqual({
			situacao: "erro",
			mensagem: expect.stringMatching(/4,5 MB/),
		});
	});

	// Quebra que pega: a mensagem por status passando por cima da que o proxy
	// montou. Quando o próprio VerAI desiste do Confere, o 504 chega com
	// `detail`, e é ele quem sabe explicar o que fazer.
	it('erro com "detail" (montado pelo proxy) mostra o detail, mesmo em 504', async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			Response.json(
				{ detail: "O Confere não terminou dentro do tempo máximo." },
				{ status: 504 },
			),
		);

		const estado = await gerarRelatorio(ARQUIVOS);

		expect(estado).toEqual({
			situacao: "erro",
			mensagem: "O Confere não terminou dentro do tempo máximo.",
		});
	});
});

describe("gerarRelatorio — teto de espera do navegador", () => {
	/** Dublê fiel ao fetch: só termina quando o sinal aborta, e rejeita com o
	 *  motivo dele. Devolve um leitor do sinal que a chamada recebeu. */
	function fetchQueNuncaResponde(): () => AbortSignal | undefined {
		let sinal: AbortSignal | undefined;
		jest.spyOn(global, "fetch").mockImplementation((_url, init) => {
			sinal = init?.signal ?? undefined;
			return new Promise<Response>((_resolve, reject) => {
				sinal?.addEventListener("abort", () => reject(sinal?.reason));
			});
		});
		return () => sinal;
	}

	// Quebra que pega: o navegador desistindo antes do servidor. O teto herdado
	// do frontend original (180 s) abandonava gerações que o proxy ainda estava
	// autorizado a esperar — até 300 s, o `maxDuration` da rota — e a pessoa
	// perdia um relatório que chegaria, ou a mensagem que o proxy montaria.
	it("não desiste antes do teto da função no servidor (300 s)", () => {
		jest.useFakeTimers();
		const sinal = fetchQueNuncaResponde();

		void gerarRelatorio(ARQUIVOS);
		jest.advanceTimersByTime(300_000);

		expect(sinal()?.aborted).toBe(false);
	});

	// Quebra que pega: tirar o teto de vez. Conexão pendurada deixaria o modal
	// de progresso girando para sempre.
	it("conexão pendurada: desiste depois do teto e explica, em vez de girar para sempre", async () => {
		jest.useFakeTimers();
		fetchQueNuncaResponde();

		const promessa = gerarRelatorio(ARQUIVOS);
		jest.advanceTimersByTime(600_000);

		await expect(promessa).resolves.toEqual({
			situacao: "erro",
			mensagem: expect.stringMatching(/interrompida/),
		});
	});
});
