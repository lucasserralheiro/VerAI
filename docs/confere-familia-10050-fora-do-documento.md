# Confere: itens da família 10.050 somem do relatório sem aviso

Nota para o suporte do Confere (PRODAM). O VerAI não altera o Confere; isto é só o registro do que foi observado na
conferência de 08/10/2026, para a PRODAM decidir.

## O que acontece

`services/confere/backend/src/application/use_cases/generate_measurement_report.py` (cópia de referência do que está no ar):

```python
FAMILIAS_FORA_DO_DOCUMENTO = frozenset({"10.050"})
...
for codigo in medicao.codigos_em_ordem:
    if _fora_do_documento(codigo):
        continue            # antes de _montar_linha
```

Todo código que começa com `10.050.` é pulado antes de a linha ser montada. O comentário da constante diz o contrário do
que a tela mostra: *"Fora do documento, dentro da comparação: continuam validadas, e contam para o grid e para a
análise."*

## O que foi visto

- Planilha do levantamento de 21/08/2026 (`TC 09 ...`), aba `Levantamento`, linha 8: `10.050.00001.00`, ESPECIALISTA /
  ANALISTA DE SISTEMA, contratada 88, medida 0.
- O mesmo código consta no PDF da proposta, na página 6.
- No resultado do VerAI esse item não aparece em nenhuma lista (divergências, demais itens, itens sem divergência), e a
  resposta não traz aviso nenhum de que ele foi deixado de fora.

Quem confere planilha contra relatório conta uma linha a menos sem saber por quê.

## O que pedir à PRODAM

1. Confirmar se `10.050` deve mesmo ficar fora também do grid e da análise (o código faz isso) ou só do documento (o
   comentário diz isso).
2. Seja qual for a resposta, devolver um aviso na resposta da API (por exemplo em `avisos`) dizendo quantos itens
   foram deixados de fora e quais códigos, para a tela poder mostrar.

## No VerAI

Nada foi mudado por causa disto: a regra é do Confere. Se a PRODAM devolver o aviso, a tela só o exibe. Enquanto isso, a
tela de resultado não tem como saber que um código foi omitido.
