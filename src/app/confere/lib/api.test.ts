/** @jest-environment node */
import { type EntradaDaGeracao, gerarRelatorio, identificarLevantamento, type ProgressoDoServidor } from "./api";

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

// 20/10/2026 — geração assíncrona: o proxy responde 202 com um bilhete e a tela
// consulta até o resultado. Era o fim do 504 "não terminou dentro do tempo".
describe("gerarRelatorio — geração assíncrona", () => {
	beforeEach(() => {
		(globalThis as { __CONFERE_INTERVALO_MS__?: number }).__CONFERE_INTERVALO_MS__ = 0;
	});
	afterEach(() => {
		delete (globalThis as { __CONFERE_INTERVALO_MS__?: number }).__CONFERE_INTERVALO_MS__;
		(URL as unknown as { createObjectURL?: unknown }).createObjectURL = undefined;
	});

	it("pede o modo assíncrono, acompanha as fases e entrega o relatório", async () => {
		(URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:x";
		const respostas = [
			Response.json({ execucao: "bilhete-1" }, { status: 202 }),
			Response.json({ situacao: "na_fila", fase: null, posicao: 1, segundos: 2 }, { status: 202 }),
			Response.json({ situacao: "processando", fase: "Lendo o aditivo 1 de 2", posicao: 0, segundos: 9 }, { status: 202 }),
			Response.json({ docx_base64: "AA==", analise_xlsx_base64: "BB==", titulo: "T" }, { status: 200 }),
		];
		const espiao = jest.spyOn(global, "fetch").mockImplementation(async () => respostas.shift()!);
		const fases: ProgressoDoServidor[] = [];

		const estado = await gerarRelatorio(ENTRADA, false, (progresso) => fases.push(progresso));

		expect((espiao.mock.calls[0][1]?.body as FormData).get("assincrono")).toBe("1");
		expect(String(espiao.mock.calls[1][0])).toBe("/api/confere/reports/bilhete-1");
		expect(fases.map((f) => f.fase ?? `fila ${f.posicao}`)).toEqual(["fila 1", "Lendo o aditivo 1 de 2"]);
		expect(estado.situacao).toBe("pronto");
	});

	it("Confere reiniciado no meio (410): pede novo envio, não espera para sempre", async () => {
		const respostas = [
			Response.json({ execucao: "b" }, { status: 202 }),
			Response.json({ detail: "não está mais no Confere" }, { status: 410 }),
		];
		jest.spyOn(global, "fetch").mockImplementation(async () => respostas.shift()!);

		await expect(gerarRelatorio(ENTRADA)).resolves.toEqual({
			situacao: "erro",
			mensagem: "não está mais no Confere",
		});
	});

	it("uma consulta que falha por rede não derruba a geração", async () => {
		(URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:x";
		let chamada = 0;
		jest.spyOn(global, "fetch").mockImplementation(async () => {
			chamada += 1;
			if (chamada === 1) return Response.json({ execucao: "b" }, { status: 202 });
			if (chamada === 2) throw new TypeError("rede");
			if (chamada === 3) return Response.json({ detail: "x", transitorio: true }, { status: 503 });
			return Response.json({ docx_base64: "AA==", analise_xlsx_base64: "BB==" }, { status: 200 });
		});

		await expect(gerarRelatorio(ENTRADA)).resolves.toEqual(expect.objectContaining({ situacao: "pronto" }));
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
