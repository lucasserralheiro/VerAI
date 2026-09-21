import { expect, test } from "@playwright/test";

import { bloqueadoComVariosCodigosAusentes } from "./estados";

/**
 * T-2046 — ESPEC 027 `R-LEV-08`, `D-05`. Vários achados de `V-CTR-05` viram
 * um cartão só na tela, e não um por código.
 *
 * A correção da resposta — 60 achados virando 1 — é medida no `pytest`, com
 * os arquivos reais (`test_planilha_nao_lida.py`). O que esta suíte mede é a
 * tela diante de uma resposta com múltiplos achados da mesma validação.
 */

test("três V-CTR-05 viram um cartão, com os três códigos visíveis", async ({ page }) => {
	await bloqueadoComVariosCodigosAusentes(page);

	// Um cartão só: o texto agregado aparece exatamente uma vez.
	await expect(
		page.getByText("3 códigos do contrato não aparecem no levantamento."),
	).toBeVisible();

	// E não o texto de achado individual, que a versão anterior mostrava três vezes.
	await expect(page.getByText(/^código 10\.050\.00001\.00 está no contrato/)).toHaveCount(0);

	// Os três códigos, visíveis dentro do cartão agregado.
	for (const codigo of ["10.050.00001.00", "10.050.00002.00", "11.027.00003.00"]) {
		await expect(page.getByText(codigo, { exact: false })).toBeVisible();
	}
});
