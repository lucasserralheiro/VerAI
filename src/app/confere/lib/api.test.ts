/** @jest-environment node */
import { type EntradaDaGeracao, gerarRelatorio, identificarLevantamento } from "./api";

// Contrato e levantamento do computador — o caminho de sempre.
const ENTRADA: EntradaDaGeracao = {
	levantamento: new File(["xlsx"], "levantamento.xlsx"),
	contrato: { tipo: "arquivo", arquivo: new File(["%PDF"], "contrato.pdf") },
	aditivos: [],
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

		const estado = await gerarRelatorio(ENTRADA);

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

		const estado = await gerarRelatorio(ENTRADA);

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

		const estado = await gerarRelatorio(ENTRADA);

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

		void gerarRelatorio(ENTRADA);
		jest.advanceTimersByTime(300_000);

		expect(sinal()?.aborted).toBe(false);
	});

	// Quebra que pega: tirar o teto de vez. Conexão pendurada deixaria o modal
	// de progresso girando para sempre.
	it("conexão pendurada: desiste depois do teto e explica, em vez de girar para sempre", async () => {
		jest.useFakeTimers();
		fetchQueNuncaResponde();

		const promessa = gerarRelatorio(ENTRADA);
		jest.advanceTimersByTime(600_000);

		await expect(promessa).resolves.toEqual({
			situacao: "erro",
			mensagem: expect.stringMatching(/interrompida/),
		});
	});
});

describe("gerarRelatorio — propostas do cadastro", () => {
	it("manda os ids do cadastro na ordem da lista, com o contrato escolhido", async () => {
		const espiao = jest
			.spyOn(global, "fetch")
			.mockResolvedValue(Response.json({ detail: "x" }, { status: 502 }));
		const documento = (arquivoId: string) => ({ arquivoId, nome: `${arquivoId}.pdf`, origem: null });

		await gerarRelatorio({
			levantamento: new File(["xlsx"], "l.xlsx"),
			contrato: { tipo: "cadastro", documento: documento("pa-04") },
			aditivos: [
				{ tipo: "cadastro", documento: documento("pa-05") },
				{ tipo: "arquivo", arquivo: new File(["%PDF"], "manual.pdf") },
			],
			contratoId: "ct-pgm",
		});

		const corpo = espiao.mock.calls[0][1]?.body as FormData;
		expect(corpo.get("contrato")).toBeNull();
		expect(corpo.get("contrato_arquivo_id")).toBe("pa-04");
		const aditivos = corpo.getAll("aditivos");
		expect(aditivos[0]).toBe("cadastro:pa-05");
		expect((aditivos[1] as File).name).toBe("manual.pdf");
		expect(corpo.get("contrato_id")).toBe("ct-pgm");
	});
});

describe("identificarLevantamento", () => {
	it("falha da busca vira null — a tela segue pelo envio manual", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(new Response("x", { status: 500 }));
		await expect(identificarLevantamento(new File(["x"], "l.xlsx"))).resolves.toBeNull();
		jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("rede"));
		await expect(identificarLevantamento(new File(["x"], "l.xlsx"))).resolves.toBeNull();
	});
});
