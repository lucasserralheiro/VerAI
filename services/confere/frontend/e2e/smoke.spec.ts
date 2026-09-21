import path from "node:path";

import { expect, test } from "@playwright/test";

/** T-66 — Teste de fumaça: dois casos, caminho feliz e caminho bloqueado. */

const FIXTURES = path.resolve(__dirname, "../../backend/tests/fixtures");
const CONTRATO = path.join(FIXTURES, "contrato.pdf");
const LEVANTAMENTO = path.join(FIXTURES, "levantamento.xlsx");

/** O catálogo é embutido na aplicação: a tela pede só os dois arquivos. */
async function enviar(
	page: import("@playwright/test").Page,
	levantamento: string = LEVANTAMENTO,
) {
	await page.goto("/");
	await page.locator('input[type="file"]').nth(0).setInputFiles(CONTRATO);
	await page.locator('input[type="file"]').nth(1).setInputFiles(levantamento);
	await page.getByRole("button", { name: "Gerar relatório" }).click();
}

test("dois arquivos entram e o DOCX é baixado", async ({ page }) => {
	await enviar(page);

	await expect(page.getByText("Relatório gerado")).toBeVisible({ timeout: 90_000 });

	// ESPEC 002 — o grid mostra só o que diverge, agrupado como no relatório.
	//
	// T-2124 / ESPEC 030 — **só a frase ficou.** O `ResultadoPanel` escreve
	// `{n} de {m} itens com divergência entre contratado e medido` desde que foi
	// escrito; os **dois** números é que se moveram, e pelo mesmo dono: a
	// ESPEC 018 `R-REL-01` fez o universo do relatório ser a aba `Levantamento`.
	//
	// Fonte dos dois — âncoras do backend, nunca a leitura da tela (`R-SUI-05`):
	//
	//     test_api_e2e.py:  total_linhas == 58        (era 55)
	//     test_api_e2e.py:  total_divergencias == 37  (era 36)
	//
	// A primeira tentativa desta tarefa trocou só o 55 e reprovou de novo — é o
	// que acontece quando se lê a mensagem de falha em vez da fonte.
	// **Reancorado pela ESPEC 031** — 2026-08-20. O `14.049.00054.00` media 2 por
	// artefato de leitura: vinha do bloco bruto de `E1.1`, e a apuração que
	// desconta desenvolvimento não o lista. Com `0 = 0` ele deixou de divergir e
	// deixou de ser crítico.
	//
	//     test_api_e2e.py:  total_divergencias == 36  (era 37)
	//     test_anchor_analise.py:  CRITICO == 0, SEM_DIVERGENCIA == 22
	//
	await expect(page.getByText(/36.*de 58 itens com divergência/)).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Divergências, na ordem do relatório" }),
	).toBeVisible();
	await expect(page.getByRole("columnheader", { name: "Saldo" }).first()).toBeVisible();
	await expect(page.getByRole("row")).not.toHaveCount(0);

	// ESPEC 009 — o item medido sem cobertura contratual continua na tela; mudou
	// de lugar. Saiu do bloco no topo do grid (`R-PAN-07`) e passou para dentro de
	// *Item crítico*, no painel de análise, com a marca que o nomeia. A asserção
	// segue o item, não o rótulo do bloco antigo.
	await expect(page.getByRole("heading", { name: "Análise da medição" })).toBeVisible();

	// Os quatro blocos nascem **fechados** (ESPEC 009 §17.5), então a marca está
	// no DOM e não visível. Expandir faz parte da asserção — e de quebra exercita
	// o `<details>` que `D-03` escolheu justamente por ser operável sem uma linha
	// de ARIA. Asserir presença no DOM em vez de visibilidade passaria com o bloco
	// inalcançável, que é o defeito que importaria.
	// ESPEC 031 — o bloco de *Item crítico* passou a sair **vazio** no piloto, e o
	// que ele mostra ao ser expandido é o resultado que quem confere mais quer
	// ler. A asserção segue o comportamento, não o item que sumiu: expandir
	// continua exercitando o `<details>` que `D-03` escolheu por ser operável sem
	// uma linha de ARIA, e o conteúdo agora é a `R-PAN-04` por par real.
	await page.getByRole("heading", { name: "Item crítico" }).click();
	await expect(page.getByText("Nenhum item nesta situação.").first()).toBeVisible();

	// O quadro-resumo saiu da tela (ESPEC 009 §17.4) por repetir palavra por
	// palavra o cabeçalho dos quatro blocos; o **total** ficou, na linha de
	// identificação. É o invariante de `R-ANA-05` visível para quem lê, e a
	// asserção segue o número, não a moldura que o continha.
	await expect(page.getByText(/\d+ itens analisados/)).toBeVisible();

	const download = page.waitForEvent("download");
	await page.getByRole("link", { name: "Baixar DOCX" }).click();
	const arquivo = await download;

	// ESPEC 008 `R-ACE-19` — o nome passou a identificar contrato e competência.
	expect(arquivo.suggestedFilename()).toMatch(/^confere-.+\.docx$/);
});

/** T-2129 / ESPEC 030 `D-07` — **as faixas de seção não voltam, e não são defeito.**
 *
 *  A asserção que vivia aqui — `B - SERVIÇOS DE REDES E CONECTIVIDADES` — saiu, e
 *  o motivo está na regra que a criou. A `R-DIV-03` (ESPEC 002) pedia duas coisas
 *  na mesma frase: *"as linhas mantêm o agrupamento por seção **e a ordem do
 *  relatório**"*. Não era coincidência — o agrupamento **era** a ordem: as seções
 *  `A`, `B`, `C` são da planilha, e o relatório seguia a planilha.
 *
 *  A ESPEC 018 `R-REL-03` trocou a ordem para a da tabela de itens do contrato, e
 *  o contrato não tem seções. Reordenando por ele, itens de seções diferentes se
 *  intercalam: **não há faixa possível numa lista que não está mais na ordem
 *  delas**.
 *
 *  O `.docx` concorda — zero faixas de seção nas âncoras do documento. A tela está
 *  consistente com o entregável, que é o que importa.
 *
 *  Se um dia o agrupamento fizer falta, é entrega nova: exigiria decidir o que
 *  ganha, a ordem do contrato ou as seções da planilha. É escolha de produto, não
 *  conserto.
 */

test("entrada inválida mostra o erro e não oferece download", async ({ page }) => {
	// O contrato é um PDF válido, mas não é uma planilha de medição.
	await enviar(page, CONTRATO);

	await expect(page.getByText(/válido|bloqueado|Levantamento/i).first()).toBeVisible({
		timeout: 90_000,
	});
	await expect(page.getByRole("link", { name: "Baixar DOCX" })).toHaveCount(0);
});
