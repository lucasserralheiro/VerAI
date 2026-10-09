# Confere: V-CTR-03 bloqueia aditivo com TOTAL na quebra de página

**Para:** suporte do Confere (PRODAM) · **Achado em:** 08/10/2026 · **Arquivos:** `PA-SMDET-260428-782.pdf` e `v3.0`

## Sintoma
`V-CTR-03 extração incompleta: a soma dos itens (-4539.80) não bate com o total declarado (-7948.25) — diferença de 3408.45`.
O relatório não é gerado. Os itens estão certos; o que falha é o total declarado.

## Causa (reproduzida com o extrator do próprio Confere)
O aditivo tem dois blocos na página 6, **Redução** e **Aumento**. A linha `Aumento TOTAL: BRL 3.408,45`
caiu sozinha no **topo da página 7**, que não tem nenhuma linha de item. Em `PdfPlumberContractExtractor.extrair`,
a linha `TOTAL:` só é lida dentro de `montar_grade(...)`, e para a página 7 a grade é `None`, então ela é pulada.
Resultado: `total_declarado = -7948.25` (só a Redução), `soma_dos_totais = -7948.25 + 3408.45 = -4539.80`.
O texto do próprio PDF confirma o valor correto: "R$ 4.539,80 com decréscimo". A diferença (3408.45) é exatamente o total do bloco Aumento.
O fallback `_total_por_convergencia` não ajuda porque só roda quando `total_declarado is None`.

## Correção proposta
Ao passar por uma página sem grade com bloco aberto (`pendentes`), se a primeira linha de texto for `... TOTAL: BRL <valor>`,
fechar o bloco com esse total. Só age nesse caso. Testada numa cópia, sem tocar no repositório:

| Arquivo | Antes | Depois |
|---|---|---|
| PA-SMDET-260428-782 (e v3.0) | soma -4539.80 × declarado -7948.25 (bloqueia) | -4539.80 × -4539.80 (fecha) |
| Os outros 15 PDFs que já fechavam | OK | OK, sem mudança |

```diff
--- a/backend/src/infrastructure/contract/pdfplumber_extractor.py
+++ b/backend/src/infrastructure/contract/pdfplumber_extractor.py
@@ -406,6 +406,33 @@
                             self._montar_item(celulas, codigo, numero, papel_ativo[divisorias])
                         )
 
+                # PROTÓTIPO — a linha `TOTAL:` que a quebra de página deixou sozinha no
+                # topo de uma folha sem itens. Sem grade não há leitura de célula, e o
+                # total do bloco aberto nunca era somado.
+                if pendentes and not any(
+                    montar_grade(pagina, divisorias) is not None for divisorias in geometrias
+                ):
+                    primeira = next(
+                        (l.strip() for l in (pagina.extract_text() or "").splitlines() if l.strip()), ""
+                    )
+                    achado = re.match(
+                        r"^(?:\S+\s+)?TOTAL:\s*BRL\s*(-?[\d.]+,\d{2})\s*$", primeira
+                    )
+                    if achado:
+                        valor = para_decimal(achado.group(1))
+                        if valor is not None and (numero, valor) not in totais_vistos:
+                            totais_vistos.add((numero, valor))
+                            total_declarado = (total_declarado or Decimal(0)) + valor
+                            blocos.append(
+                                BlocoDeItens(
+                                    rotulo=self._rotulo([primeira]),
+                                    itens=tuple(pendentes),
+                                    total_declarado=valor,
+                                )
+                            )
+                            itens.extend(pendentes)
+                            pendentes = []
+
             # Itens sem `TOTAL:` que os feche. Vale a tabela que a peça mostra: o
             # bloco sai sem rótulo, e `V-CTR-03` já bloqueia se faltou total.
             if pendentes:
```

## Observação
`PC-SMDET-240313-34 v4.0.pdf` também não fecha, mas por outro motivo: nenhum total declarado foi achado. Investigar à parte.
