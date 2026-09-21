"""T-2020 a T-2022 — ESPEC 026 `R-DES-01`: os artefatos não mudam um byte.

**Âncora, e âncora é do código de antes.** Estas constantes foram medidas em
2026-08-19 contra `f5c9f3d`, com `backend/src/` **intocado** — antes de qualquer
linha da ESPEC 026 existir. Extraídas depois, ancorariam o resultado da
alteração: passariam sempre e não afirmariam nada.

Se um destes testes ficar vermelho, a resposta padrão **não** é reancorar. A
`R-DES-01` diz que o documento não muda; reancorar é admitir que mudou, e exige
explicação na §9 do TASKS 026.

**Reancoradas em 2026-08-19 pela ESPEC 028, depois de um dia vermelhas.** Duas
mudanças de documento conviveram na árvore: a correção da ESPEC 024 v1.1 (o `*`
inicial na nota de `R-NOT-02`, que nascera sem o marcador que o título promete) e
a ESPEC 028 `R-ZER-01`, que omite do bloco final a linha sem quantidade
contratada nem medida. A troca esperou a segunda ficar pronta — reancorar contra
uma implementação em andamento grava um número que muda no dia seguinte
(TASKS 026 §9.10).

**Os dois deltas foram provados em separado**, cada um desfazendo apenas a sua
mudança: sem o `*` e sem a omissão, os pacotes voltavam a `30b67025…` e
`4e82a751…` byte a byte; com o `*` e sem a omissão, a `84c4aadc…` e `b334b4cd…`.
Em nenhum dos dois passos outra entrada do pacote se moveu — e é isso, não o
hash final, que autoriza trocar o número.

Nada disso arranha a `R-DES-01`: ela afirma que *o refatoramento do renderizador*
não move o documento, e mudança deliberada de texto, decidida noutra espec, não é
refatoramento.

**Reancorado só o PGM, em 2026-08-31, pela ESPEC 036.** As três abas que o PGM não
contratou deixaram de produzir uma página cada (`R-VAZ-01`), e `word/document.xml`
foi a **única** entrada a se mover. O piloto tem zero anexos vazios e por isso não
podia mudar — **é ele a régua desta espec**: nenhuma validação pega um anexo
legítimo omitido em silêncio, e o hash do piloto é o único oráculo dessa falha.
O delta do PGM foi provado por desligamento, no procedimento da ESPEC 028: com as
duas linhas revertidas o pacote voltou ao valor anterior, entrada por entrada.

**Reancorado só o PGM outra vez, em 2026-08-31, pela ESPEC 037.** Cinco anexos
marcavam uma linha de dados com ``w:tblHeader`` e o Word a repetia no topo de
cada página; a linha do cabeçalho passou a ser localizada pelos rótulos
declarados em ``anexos.json``, e não por um número medido numa planilha só.
``word/document.xml`` foi de novo a única entrada a se mover, e a forma do
documento não mudou — 18 seções, 34 tabelas e 18 fileiras marcadas antes e
depois. O piloto ficou parado pela razão que o torna régua: as âncoras foram
medidas nele.

**Duas reancoragens do mesmo hash no mesmo dia, sem commit entre elas.** A da
036 e a da 037. Os dois parágrafos ficam: cada um prova o seu delta, e apagar o
primeiro apagaria a prova de que aquele foi de três seções e este de nenhuma.

**Reancorados os dois, piloto e PGM, em 2026-09-09, pela ESPEC 049.** Célula de
anexo sem texto — a linha de respiro entre faixas de título — deixou de herdar
o `w:pPrDefault`/`w:rPrDefault` do modelo (8pt de espaço depois do parágrafo,
fonte 12pt) e passou a receber a mesma normalização que uma célula com texto já
recebia (`R-CEL-01`). `word/document.xml` foi de novo a **única** entrada a se
mover, nos dois pacotes. O delta foi provado por desligamento: restaurada
localmente a condicional `if celula.texto:` de `_celula_do_anexo`, os dois
pacotes voltam a `e56dcb58…` (piloto) e `df71db05…` (PGM) byte a byte, entrada
por entrada — nenhuma outra se moveu em nenhum dos dois sentidos.

**Reancorados os dois, piloto e PGM, em 2026-09-10, pela ESPEC 051.**
`Servidores` e `ServidoresSemDesenv` têm uma segunda tabela, de forma
diferente, empilhada na mesma aba — o leitor só reconhecia a primeira, e a
fileira de cabeçalho que o Word repete a cada página saía com 4 de 15 colunas
em branco (`R-SEG-03`). Passaram a existir três tabelas por anexo em vez de
duas — resumo e detalhe, cada uma com seu próprio cabeçalho —, e `Servidores`/
`ServidoresSemDesenv` ganharam uma tabela a mais cada, nos dois pacotes:
piloto 38 → 40, PGM 32 → 34. `word/document.xml` foi de novo a **única**
entrada a se mover, nos dois pacotes — e desta vez **os dois**, porque o
defeito já estava nos dois, não só no arquivo real que originou a submissão.
O delta foi provado por desligamento: revertido `cabecalhos_adicionais` para
vazio em `anexos.json`, os dois pacotes voltam a `0b87c759…` (piloto) e
`4e3197ff…` (PGM) byte a byte, entrada por entrada — nenhuma outra se moveu em
nenhum dos dois sentidos.

**Reancorados os dois, piloto e PGM, em 2026-09-10, pela ESPEC 052.** Célula de
anexo saía sempre alinhada à esquerda, não importa o que a aba declarasse —
`_celula_do_anexo` nunca recebia o alinhamento da célula. Passou a herdar o
valor explícito da aba (`left`/`center`/`right`) ou, sem ele, o comportamento
"Geral" do Excel decidido pelo tipo do valor (número e data à direita, texto à
esquerda). `word/document.xml` foi de novo a única entrada a se mover, nos dois
pacotes — a aba `NAS`, uma das 19 configuradas, tem célula `right` e `center`
reais, e entra nos dois. O delta foi provado por desligamento: revertida
localmente a passagem de `alinhamento=celula.alinhamento` em
`_celula_do_anexo`, os dois pacotes voltam a `8561819f…` (piloto) e `7d00e15d…`
(PGM) byte a byte, entrada por entrada — nenhuma outra se moveu em nenhum dos
dois sentidos.

**Reancorados os dois, piloto e PGM, em 2026-09-10, pela ESPEC 053.** Um
parágrafo sem execução visível — célula de anexo vazia, ou o separador entre
segmentos de tabela (ESPEC 004/051) — herdava a altura de linha do documento
(12pt) em vez do corpo do próprio anexo: `ooxml.escrever` montava o `w:rPr` da
**execução**, mas nunca o `w:pPr/w:rPr` da **marca do parágrafo**, que é o que
o Word consulta para calcular a altura quando não há glifo para medir. Os dois
passaram a receber a marca, no mesmo corpo da execução. `word/document.xml`
foi de novo a única entrada a se mover, nos dois pacotes — medido antes da
correção (T-2783 do TASKS 053): nenhuma célula da tabela de comprovação
(páginas 2-3) está vazia hoje nos dois pacotes, então o alcance ficou restrito
às páginas de anexo, como previsto. O delta foi provado por desligamento:
revertidas localmente as duas marcas (em `ooxml.escrever` e no separador de
`_faixa_de_tabelas`), os dois pacotes voltam a `a5f730bf…` (piloto) e
`e205b9ec…` (PGM) byte a byte, entrada por entrada — nenhuma outra se moveu em
nenhum dos dois sentidos.

**Reancorado só o piloto, em 2026-09-10, pela ESPEC 054.** A aba `WIFI` tem dois
cabeçalhos de coluna — um do resumo (`Unidade | Quantidade Medida`), outro da
tabela `TIPO de TC` —, e só o primeiro estava declarado em `anexos.json`. A
tabela larga (21 linhas no piloto) estourava página e repetia o cabeçalho
errado, o do resumo. `WIFI` passou a declarar a âncora adicional `["Seq",
"TIPO de TC", "Cod.Produto"]` (ESPEC 051 `R-SEG-01`), e a tabela larga passa a
repetir o próprio cabeçalho. `word/document.xml` foi a única entrada a se
mover — só no **piloto**: a aba `WIFI` do PGM tem layout de colunas diferente
(`Seq | Recurso | Cliente | ...`, sem `TIPO de TC`) e só 8 linhas de dado — a
âncora nova não resolve lá (`R-CAB-04`), e a tabela nem estoura página, então
o PGM não tem o defeito e não muda. O delta foi provado por desligamento:
revertida localmente a âncora adicional em `anexos.json`, o piloto volta a
`5a0c4fd5…` byte a byte, entrada por entrada — nenhuma outra se moveu, e o PGM
não se move em nenhum dos dois sentidos.

**Por que por entrada do pacote, e não um `sha256` do arquivo.** Por dois
motivos diferentes nos dois artefatos, e a `T-2002` mediu os dois:

* no `.docx`, é pela **mensagem de falha** — o pacote é estável byte a byte
  entre processos, `docProps/core.xml` inclusive, então um `sha256` só
  funcionaria; mas *"o arquivo difere"* faz a próxima pessoa começar do zero, e
  ela começaria com 3,8 MB de zip. `word/document.xml` divergente aponta para o
  defeito;
* no `.xlsx`, é **obrigatório**: o `openpyxl` monta o pacote do zero e grava
  `dcterms:modified` com a hora corrente. Duas renderizações consecutivas do
  mesmo objeto diferem no arquivo inteiro, e são idênticas em todas as outras
  entradas.

**Custo: zero renderização nova.** Os quatro artefatos vêm de fixtures de sessão
que a suíte já paga — `docx_do_piloto`, `documento_do_pgm` (movida para o
`conftest` pela `T-2001` exatamente para isto) e os dois `.xlsx`, derivados dos
mesmos `Report`.

O `.xlsx` da análise **não é tocado por esta espec**, e é por isso que ele está
aqui: é o teste que falha se a alteração vazar para onde não devia.
"""

from __future__ import annotations

from pathlib import Path

from pacote import partes

# ── O `.docx` ─────────────────────────────────────────────────────────────────

PACOTE_DO_PILOTO: dict[str, str] = {
    "[Content_Types].xml": "e7db71cf6d4a18f632494c80d8e59eb86c14201bbf108a985baf66253d392509",
    "_rels/.rels": "f0a85cb52efc11ff5994d54df1c1446780e8ed591ea01d3322ecaa00033f5746",
    "customXml/_rels/item1.xml.rels":
        "1ca6c9a64edcebe24ee703a54403611b322d96da33371779e742d2d3f7ed7a6c",
    "customXml/_rels/item2.xml.rels":
        "435eae789df4fbec2fa6bcb6c79d825d4ca93036d43a819aa05e3d5e5f5586be",
    "customXml/_rels/item3.xml.rels":
        "71ab67aa89fdda4d23a4d4ce376af7ff14ce3a4098e3a9a4d71f1f7c0a183ad8",
    "customXml/item1.xml": "5efcaf9ad70d9c29f406ee438f8f428b021a881d2c5afff0e53b00b1f67ae51e",
    "customXml/item2.xml": "0d347421419b951147397579c45c592c381d393de98375ae5ebacd6f45ad8e39",
    "customXml/item3.xml": "c6fe62f0a22f3f3eec08f1786b20695d2265d559866481e059e491bf6fef20b2",
    "customXml/itemProps1.xml": "53f51dea24c475ee608884dd97cc249d7c6e3aae1733d83aff466b6325488258",
    "customXml/itemProps2.xml": "08ea1cf92cb8c4ce81afe66e6b401b1d51772bcb07e3ac3bb07021255096f5df",
    "customXml/itemProps3.xml": "5dc518dfc5ff53e9a86f0566e17924159a477fe70c397539c69e6d7474cf43da",
    "docMetadata/LabelInfo.xml": "b6f128d2a91268afe5c4b4836f57cd38e1e53ccba18e92216bcaf03878edac24",
    "docProps/app.xml": "daacb52d703b968cba1e4710398b71dd47af3e1eee0c33dca7638af7320ddb81",
    "docProps/custom.xml": "04497ded702e30c474c19c14b0814978ca31c153839055118a14fb5a6b14c43d",
    "word/_rels/document.xml.rels":
        "c9805af7d34fce42cb3c7382b3ba935a9f4729615caa0b068a0a44764eb5dc61",
    "word/_rels/fontTable.xml.rels":
        "c6f37c0808175a92c23af34f1722bfb6bfb93c6b398e4ba50c8394e621137453",
    "word/_rels/footer1.xml.rels":
        "569493eafa803d6fe04269b6441054a5352499b5648fc25e50520894ffd1dc41",
    "word/_rels/header1.xml.rels":
        "ebcd4fe3721967888a2ab86936d48f274f6ed0b80575a6f8e20bc5e7bcb55069",
    # Reancorada pela ESPEC 028 — 2026-08-19; ver o cabeçalho deste arquivo.
    # Era `30b67025…` (sem o `*`, sem a 028) e `84c4aadc…` (com o `*`, sem a 028).
    # Única entrada do pacote que se move nas duas mudanças.
    "word/document.xml": "53e23d39011a6ea7efe8a41f39b86e0e06e0a28e38018e1eaf1d0afd1196d855",
    "word/endnotes.xml": "cac57b424a2081ae557dd8b7e2d80ded86478c85c1dbf3487963bd3a79be29d1",
    "word/fontTable.xml": "c1ce9842227644570984cbe4e63d0f62c5469dcd753491130a0dac5fa9073fad",
    "word/fonts/font1.odttf": "b69bcd027f894269cd29064d042ef2903df4bffc77c66613f96188086a9b2129",
    "word/fonts/font2.odttf": "a7cfa7ea4d315d0f351ab9de7ca23987da4b9011f5e8c00a0faa7c5e43aad557",
    "word/fonts/font3.odttf": "b51d6f7646d5c2e89d8f18417ba08dad5142dd97b7389eb28ee4d1bb9dc0fca4",
    "word/fonts/font4.odttf": "d87f9e5835e6fd3b6b3b90ae217d85c940df66fd74599758de66e95d375c5dab",
    "word/fonts/font5.odttf": "e700507c6262100f2e92c8712185dc5e20554da3637a6ce8a56ecbbe135cabb0",
    "word/fonts/font6.odttf": "010a0412abc9689f36a0ff10481b7906ac71caf72b27af7f7f205aebfd82cc56",
    "word/fonts/font7.odttf": "dc03429cdb6ead7bee40b6ec9102d1ca8b70872780ab5fb1e1d1907912fc49f0",
    "word/footer1.xml": "9ca72fc073087ed0137367d51af746e39997549e22fec35a1a109c2dc4cab7b4",
    "word/footnotes.xml": "081acd94c24a3fa2b6b46da837debb70e829230b6a32e32433a1bb3386715cdb",
    "word/header1.xml": "7ae923f049ea0df313e8a3c5e2f41b0a837b0ffa37d945dae329982d67d1f875",
    "word/media/image1.png": "795ec2380d78429263b9405bc2d0a61458e38b3c9eee2f05bd5ed777180908fa",
    "word/media/image2.png": "c486d64d55eb0a8194c4210d183d5220fb0d01a9a63a90c6e942918cfb18daf3",
    "word/media/image3.png": "adffc010264daf524da4d69022cf906d13f18274a24c4d18edcafb2c5c7e2fcd",
    "word/media/image4.png": "518cf62f88b3d25fcb6b432e72c4b3c70a82dfe8f156b769be666e7ad05df5d0",
    "word/media/image5.png": "37c0859c18c92e525387ff69509732e2d7d158881883fd904543dee1df5a4213",
    "word/settings.xml": "ed34b10289febe12498e451b706306e7588d338349897825a618b07e260f264c",
    "word/styles.xml": "b8e6350dba1b977f62ea8e01667f1df89a4ae9a73cf83eddf6519f673db6acc1",
    "word/theme/theme1.xml": "934c6296997f1914b39bfd2e4626b1ebd661948d525ff925424c2f9b3af70a7d",
    "word/webSettings.xml": "4a225c07c64feb7f5e4ef8b4444bfe94c0f81e35cb00632fef988cf909172f82",
}

PACOTE_DO_PGM: dict[str, str] = {
    "[Content_Types].xml": "e7db71cf6d4a18f632494c80d8e59eb86c14201bbf108a985baf66253d392509",
    "_rels/.rels": "f0a85cb52efc11ff5994d54df1c1446780e8ed591ea01d3322ecaa00033f5746",
    "customXml/_rels/item1.xml.rels":
        "1ca6c9a64edcebe24ee703a54403611b322d96da33371779e742d2d3f7ed7a6c",
    "customXml/_rels/item2.xml.rels":
        "435eae789df4fbec2fa6bcb6c79d825d4ca93036d43a819aa05e3d5e5f5586be",
    "customXml/_rels/item3.xml.rels":
        "71ab67aa89fdda4d23a4d4ce376af7ff14ce3a4098e3a9a4d71f1f7c0a183ad8",
    "customXml/item1.xml": "5efcaf9ad70d9c29f406ee438f8f428b021a881d2c5afff0e53b00b1f67ae51e",
    "customXml/item2.xml": "0d347421419b951147397579c45c592c381d393de98375ae5ebacd6f45ad8e39",
    "customXml/item3.xml": "c6fe62f0a22f3f3eec08f1786b20695d2265d559866481e059e491bf6fef20b2",
    "customXml/itemProps1.xml": "53f51dea24c475ee608884dd97cc249d7c6e3aae1733d83aff466b6325488258",
    "customXml/itemProps2.xml": "08ea1cf92cb8c4ce81afe66e6b401b1d51772bcb07e3ac3bb07021255096f5df",
    "customXml/itemProps3.xml": "5dc518dfc5ff53e9a86f0566e17924159a477fe70c397539c69e6d7474cf43da",
    "docMetadata/LabelInfo.xml": "b6f128d2a91268afe5c4b4836f57cd38e1e53ccba18e92216bcaf03878edac24",
    "docProps/app.xml": "daacb52d703b968cba1e4710398b71dd47af3e1eee0c33dca7638af7320ddb81",
    "docProps/custom.xml": "04497ded702e30c474c19c14b0814978ca31c153839055118a14fb5a6b14c43d",
    "word/_rels/document.xml.rels":
        "c9805af7d34fce42cb3c7382b3ba935a9f4729615caa0b068a0a44764eb5dc61",
    "word/_rels/fontTable.xml.rels":
        "c6f37c0808175a92c23af34f1722bfb6bfb93c6b398e4ba50c8394e621137453",
    "word/_rels/footer1.xml.rels":
        "569493eafa803d6fe04269b6441054a5352499b5648fc25e50520894ffd1dc41",
    "word/_rels/header1.xml.rels":
        "ebcd4fe3721967888a2ab86936d48f274f6ed0b80575a6f8e20bc5e7bcb55069",
    # Reancorada pela ESPEC 036 — 2026-08-31; ver o cabeçalho deste arquivo.
    # Era `67b31124…` (com as três páginas de anexo vazio) e, antes disso,
    # `4e82a751…` e `b334b4cd…`, os dois estados da ESPEC 028.
    #
    # **O delta foi provado por desligamento, não deduzido do vermelho.** Com
    # `Anexo.vazio` de volta a `not self.linhas` e sem a omissão em `_anexos`, o
    # pacote voltou a `67b31124…` **entrada por entrada**; religadas as duas, o
    # valor abaixo voltou. E foi só ele: `docProps/app.xml`, candidato natural,
    # não se moveu.
    #
    # O que mudou no documento: 21 → 18 seções e 3 → 0 parágrafos de "A planilha
    # não trouxe conteúdo para este anexo" — `Colocation`, `Comunicação Dados` e
    # `CertificadosDigitais`, que o PGM não contratou. **34 tabelas antes e 34
    # depois**: as páginas omitidas não continham tabela nenhuma, e é essa
    # igualdade, não a contagem de seções, que prova que nada de conteúdo saiu
    # junto. O piloto não se move nesta espec — ele não tem anexo vazio.
    #
    # Reancorada de novo pela ESPEC 037 — 2026-08-31, no mesmo dia e sem commit
    # entre as duas. Era `6b85e981…`, o valor da 036 acima.
    #
    # **Também provado por desligamento, e mais barato: uma linha.** Com
    # `AnexoReader._anexo` voltando a `config.linha_cabecalho - 1`, o pacote
    # voltou a `6b85e981…` **entrada por entrada**; religada a resolução por
    # âncora, o valor abaixo voltou. `docProps/app.xml` de novo parado — 39
    # entradas idênticas, uma diferente.
    #
    # O que mudou no documento: **nada de forma** — 18 seções, 34 tabelas e 18
    # fileiras com `w:tblHeader`, os três iguais antes e depois. O que mudou foi
    # **a identidade de cinco daquelas fileiras**: `Servidores`,
    # `ServidoresSemDesenv`, `SDWAN`, `SOA` e `Office365` marcavam uma linha de
    # dados como cabeçalho — `D84V50I | 1 | 2 | 80…`, `PERFIL POWER BI PRO |
    # 10 | 5…` —, e o Word a repetia no topo de cada página do anexo. Passaram a
    # marcar o cabeçalho de colunas.
    #
    # O piloto não se move nesta espec: as 19 âncoras foram medidas nele, e
    # resolvem exatamente na `linha_cabecalho` que já estava em `anexos.json`
    # (`R-CAB-06`). Um movimento lá seria índice certo que deixou de estar.
    "word/document.xml": "6dd36e33ddfbd3cea754066c6d1007ca6917981b880a6a0104e48d5e351adb0c",
    "word/endnotes.xml": "cac57b424a2081ae557dd8b7e2d80ded86478c85c1dbf3487963bd3a79be29d1",
    "word/fontTable.xml": "c1ce9842227644570984cbe4e63d0f62c5469dcd753491130a0dac5fa9073fad",
    "word/fonts/font1.odttf": "b69bcd027f894269cd29064d042ef2903df4bffc77c66613f96188086a9b2129",
    "word/fonts/font2.odttf": "a7cfa7ea4d315d0f351ab9de7ca23987da4b9011f5e8c00a0faa7c5e43aad557",
    "word/fonts/font3.odttf": "b51d6f7646d5c2e89d8f18417ba08dad5142dd97b7389eb28ee4d1bb9dc0fca4",
    "word/fonts/font4.odttf": "d87f9e5835e6fd3b6b3b90ae217d85c940df66fd74599758de66e95d375c5dab",
    "word/fonts/font5.odttf": "e700507c6262100f2e92c8712185dc5e20554da3637a6ce8a56ecbbe135cabb0",
    "word/fonts/font6.odttf": "010a0412abc9689f36a0ff10481b7906ac71caf72b27af7f7f205aebfd82cc56",
    "word/fonts/font7.odttf": "dc03429cdb6ead7bee40b6ec9102d1ca8b70872780ab5fb1e1d1907912fc49f0",
    "word/footer1.xml": "9ca72fc073087ed0137367d51af746e39997549e22fec35a1a109c2dc4cab7b4",
    "word/footnotes.xml": "081acd94c24a3fa2b6b46da837debb70e829230b6a32e32433a1bb3386715cdb",
    "word/header1.xml": "7ae923f049ea0df313e8a3c5e2f41b0a837b0ffa37d945dae329982d67d1f875",
    "word/media/image1.png": "795ec2380d78429263b9405bc2d0a61458e38b3c9eee2f05bd5ed777180908fa",
    "word/media/image2.png": "c486d64d55eb0a8194c4210d183d5220fb0d01a9a63a90c6e942918cfb18daf3",
    "word/media/image3.png": "adffc010264daf524da4d69022cf906d13f18274a24c4d18edcafb2c5c7e2fcd",
    "word/media/image4.png": "6e01ffea83a4308579b2cccac6234b95fde9631fdda837605dc55f73012283ca",
    "word/media/image5.png": "9c6871596035ccdc37e2d9c16542517d8858a4023241a40286c04b16eca04672",
    "word/settings.xml": "ed34b10289febe12498e451b706306e7588d338349897825a618b07e260f264c",
    "word/styles.xml": "b8e6350dba1b977f62ea8e01667f1df89a4ae9a73cf83eddf6519f673db6acc1",
    "word/theme/theme1.xml": "934c6296997f1914b39bfd2e4626b1ebd661948d525ff925424c2f9b3af70a7d",
    "word/webSettings.xml": "4a225c07c64feb7f5e4ef8b4444bfe94c0f81e35cb00632fef988cf909172f82",
}

# ── O `.xlsx` da análise ──────────────────────────────────────────────────────

ANALISE_DO_PILOTO: dict[str, str] = {
    "[Content_Types].xml": "e675a1370995d883feb96ebe8cde4423d3ece41ee9b7d1810d3257e8fbd933e6",
    "_rels/.rels": "c545941ba36c15fcdce4ae4568c663f3ced1a2226ad5082d3fd66b178bfac11a",
    "docProps/app.xml": "209fca6b00afe72a5029754b94be5953d8f16d96f67130325566b9366ad4ccc5",
    "xl/_rels/workbook.xml.rels":
        "fbd041d5f3aad81b8ce6d70e5b522b8cf7260dd7f2a9bd6cded7b6165a698655",
    "xl/styles.xml": "440d6b29c7ae7c6327942c611f4905711dd8f0a3670236bb86e3a167fb5b608f",
    "xl/theme/theme1.xml": "d15e8ebf78ef7b9720839d7ae8fdc81a7df5bc24706d8e137df61a5683c358d9",
    "xl/workbook.xml": "041d3848955d17a815f7030e5a22720f18a47761c74ae6ec11c728cf5b2216dd",
    "xl/worksheets/sheet1.xml": "5c96b9acd411af608eb064ba8d1268867a189ac76942a2e8cd92a9f5e8eda720",
    "xl/worksheets/sheet2.xml": "5cc1ff9a3eb0480180b637062339c0a5a48c562929f08a5d3c5b3ef038ca5ce2",
    "xl/worksheets/sheet3.xml": "5b303a7c289be6cd8d0176f1d79b624a920dbaea5a2625ae19282549e4dee4d9",
    "xl/worksheets/sheet4.xml": "be2b5bd9db52b21e513749d1e795419d7ebb243ecf9f1dd6c2edb31e3d290b33",
    "xl/worksheets/sheet5.xml": "2af424d141b8e6b342b94cb3c4fcb0a29df950d3686600123bbf24f9d3726226",
}

ANALISE_DO_PGM: dict[str, str] = {
    "[Content_Types].xml": "e675a1370995d883feb96ebe8cde4423d3ece41ee9b7d1810d3257e8fbd933e6",
    "_rels/.rels": "c545941ba36c15fcdce4ae4568c663f3ced1a2226ad5082d3fd66b178bfac11a",
    "docProps/app.xml": "209fca6b00afe72a5029754b94be5953d8f16d96f67130325566b9366ad4ccc5",
    "xl/_rels/workbook.xml.rels":
        "fbd041d5f3aad81b8ce6d70e5b522b8cf7260dd7f2a9bd6cded7b6165a698655",
    "xl/styles.xml": "440d6b29c7ae7c6327942c611f4905711dd8f0a3670236bb86e3a167fb5b608f",
    "xl/theme/theme1.xml": "d15e8ebf78ef7b9720839d7ae8fdc81a7df5bc24706d8e137df61a5683c358d9",
    "xl/workbook.xml": "041d3848955d17a815f7030e5a22720f18a47761c74ae6ec11c728cf5b2216dd",
    "xl/worksheets/sheet1.xml": "2122de90872e7cd6ec4d19e4c4e7e2a799fcda1f42dc8a16c639f347d3e345cb",
    "xl/worksheets/sheet2.xml": "5e7e7362fa61e8e63a00d13a75a0c57a05e21b741b7ae4c2a4beefbbcc757b8c",
    "xl/worksheets/sheet3.xml": "d651697a6d7015718566df76029ba6d35737359d6428cd3f7330c3ac7c530316",
    "xl/worksheets/sheet4.xml": "235e454a3b9912df832e1ebe9609857cd89e93bee284dd86905aeb2f734d1185",
    "xl/worksheets/sheet5.xml": "2f4c7fe35899ccf83360863841e97d05fb2f3cdc4a7cde80d96c7f242abbe572",
}


# ── T-2020 · o piloto ─────────────────────────────────────────────────────────


def test_o_docx_do_piloto_e_byte_a_byte_o_de_sempre(docx_do_piloto: Path) -> None:
    """19 anexos, 15.955 células escritas, 871 mesclagens.

    Compara o dicionário **inteiro**, e não entrada a entrada num laço: o
    `assert` de dicionário do pytest já mostra a divergente, e um laço com
    `continue` esconderia uma parte que apareça ou suma.
    """
    assert partes(docx_do_piloto) == PACOTE_DO_PILOTO


# ── T-2021 · o PGM, com aditivo ───────────────────────────────────────────────


def test_o_docx_do_pgm_e_byte_a_byte_o_de_sempre(documento_do_pgm: Path) -> None:
    """**A âncora que importa mais**: 3.157 mesclagens, contra 871 do piloto.

    A E3 pode passar no piloto e quebrar aqui — foi o par do PGM que revelou que
    o custo da mesclagem era quadrático, e é ele que exercita a aba `Office365`,
    com uma mesclagem por linha de dados.
    """
    assert partes(documento_do_pgm) == PACOTE_DO_PGM


# ── T-2022 · o segundo artefato, que a espec nem pretende encostar ────────────


def test_o_xlsx_do_piloto_e_byte_a_byte_o_de_sempre(xlsx_da_analise_do_piloto: Path) -> None:
    assert partes(xlsx_da_analise_do_piloto) == ANALISE_DO_PILOTO


def test_o_xlsx_do_pgm_e_byte_a_byte_o_de_sempre(xlsx_da_analise_do_pgm: Path) -> None:
    assert partes(xlsx_da_analise_do_pgm) == ANALISE_DO_PGM
