import { defineConfig, devices } from "@playwright/test";

/** T-66 — Teste de fumaça do frontend.
 *
 *  Escopo deliberadamente mínimo: dois casos. O objetivo é pegar regressão de
 *  integração entre a tela e a API, que os testes de backend não enxergam.
 *  Cobrir a interface não é objetivo.
 *
 *  O backend precisa estar no ar em http://127.0.0.1:8000. O frontend sobe
 *  sozinho por `webServer`.
 */
export default defineConfig({
	testDir: "./e2e",
	// O padrão é `test-results/`, e o Playwright **apaga o diretório inteiro** a
	// cada execução. As capturas de referência da T-401/T-411 moram ao lado, em
	// `test-results/a11y-baseline/`, e foram perdidas uma vez por causa disso.
	// Confinar a saída do arnês a uma subpasta preserva a vizinhança.
	outputDir: "./test-results/playwright",
	timeout: 120_000,
	fullyParallel: false,
	workers: 1,
	reporter: [["list"]],
	use: {
		baseURL: "http://localhost:3000",
		trace: "off",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		// `next start` não funciona com `output: standalone` — a saída de produção
		// roda por `node .next/standalone/server.js`, que exige copiar os estáticos
		// à mão. Para teste, o servidor de desenvolvimento é o caminho previsível.
		command: "pnpm dev --port 3000",
		url: "http://localhost:3000",
		reuseExistingServer: true,
		timeout: 120_000,
	},
});
