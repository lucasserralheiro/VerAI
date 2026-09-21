"""O texto do Manual de Utilização do Confere.

Separado de `gerar_manual.py` pelo mesmo motivo que o catálogo é separado da
reconciliação: um arquivo cuida da **forma** — capa, timbrado, estilos, tabelas
— e o outro do **conteúdo**. Revisar a redação do manual não deve exigir ler uma
linha de OOXML.

Tudo aqui é verificável no código: os rótulos são os que a tela mostra, as
mensagens são as que a aplicação emite, os identificadores de validação são os
que aparecem na resposta da API.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from gerar_manual import Manual

CRITICO = "B91C1C"
MAIOR = "B45309"
CONFORME = "006E52"
NAVY = "0E3E5E"


def CONTEUDO(m: Manual) -> None:  # noqa: N802 - nome de dado, não de função
    _sumario(m)
    _sobre(m)
    _o_que_faz(m)
    _antes_de_comecar(m)
    _a_tela(m)
    _passo_a_passo(m)
    _ler_o_resultado(m)
    _os_arquivos(m)
    _avisos_e_bloqueios(m)
    _conferencia_final(m)
    _teclado(m)
    _nao_faz(m)
    _limitacoes(m)
    _perguntas(m)
    _glossario(m)


# ── Sumário ───────────────────────────────────────────────────────────────────


def _sumario(m: Manual) -> None:
    m.h1("Sumário")
    m.tabela(
        ["", "Capítulo", "O que você encontra"],
        [
            ["1", "Sobre este manual", "A quem se destina e as convenções do texto"],
            ["2", "O que o Confere faz", "O problema, as entradas e as saídas"],
            ["3", "Antes de começar", "O que ter em mãos antes de abrir a aplicação"],
            ["4", "A tela do Confere", "As quatro áreas da interface"],
            ["5", "Passo a passo", "Gerar o relatório, do envio ao download"],
            ["6", "Ler o resultado", "Análise da medição e grid de divergências"],
            ["7", "Os arquivos gerados", "O documento em DOCX e a análise em XLSX"],
            ["8", "Avisos, bloqueios e erros", "O que cada mensagem significa e o que fazer"],
            ["9", "Conferência final", "O que verificar antes de encaminhar"],
            ["10", "Operação por teclado", "Uso sem mouse e recursos de acessibilidade"],
            ["11", "O que o Confere não faz", "Os limites deliberados do escopo"],
            ["12", "Limitações conhecidas", "O que afeta a leitura do resultado"],
            ["13", "Perguntas frequentes", "As dúvidas que mais aparecem"],
            ["14", "Glossário", "Os termos deste manual"],
        ],
        [0.06, 0.32, 0.62],
        alinhamentos=["center", "left", "left"],
    )


# ── 1 ─────────────────────────────────────────────────────────────────────────


def _sobre(m: Manual) -> None:
    m.h1("1. Sobre este manual")

    m.h2("1.1 A quem se destina")
    m.p(
        "Este manual é para quem **opera** o Confere: o analista que monta a "
        "comprovação da medição a cada competência, o fiscal que confere o "
        "resultado e quem responde pelo contrato. Ele descreve a aplicação do "
        "ponto de vista de quem a usa — o que enviar, o que a tela mostra, o que "
        "cada arquivo gerado contém e o que fazer quando o sistema avisa ou "
        "bloqueia."
    )
    m.p(
        "Não é documentação técnica. Não há aqui instalação, configuração, "
        "arquitetura nem comandos de terminal: para isso existem o `README` do "
        "projeto e as especificações em `docs/specs/`."
    )

    m.h2("1.2 Convenções do texto")
    m.tabela(
        ["Marcação", "Significa"],
        [
            ["**Negrito**", "Rótulo que aparece na tela — botão, campo, título de bloco"],
            ["`Monoespaçado`", "Nome de arquivo, código de serviço, aba de planilha ou "
             "identificador de validação"],
            ["Tarja laranja", "Ponto de atenção: erro comum, consequência que não se desfaz "
             "ou ressalva que muda a leitura do número"],
        ],
        [0.26, 0.74],
    )
    m.p(
        "Os exemplos numéricos vêm do contrato-piloto — `TC 52/SMIT/2024`, "
        "competência julho/2026. Os números do seu caso serão outros; a leitura "
        "é a mesma."
    )


# ── 2 ─────────────────────────────────────────────────────────────────────────


def _o_que_faz(m: Manual) -> None:
    m.h1("2. O que o Confere faz")

    m.h2("2.1 O problema que ele resolve")
    m.p(
        "A conferência entre o que foi **contratado** e o que foi **medido** é "
        "trabalho manual. A cada competência, para cada contrato, alguém abre a "
        "proposta comercial em PDF, abre a planilha de levantamento com 22 abas "
        "e, item por item, localiza o código nas duas fontes, soma as linhas "
        "correspondentes, escolhe a variante certa da medição e transcreve o "
        "resultado para a tabela de comprovação."
    )
    m.p(
        "Nenhuma dessas etapas é difícil. **A soma delas é que consome o dia** — "
        "e o resultado é peça de processo administrativo, lida por fiscal de "
        "contrato, controle interno e órgão de fiscalização."
    )
    m.p(
        "O Confere automatiza esse trabalho inteiro: **dois arquivos entram, dois "
        "saem**, e a tela mostra onde os números não bateram."
    )

    m.h2("2.2 O que entra e o que sai")
    m.tabela(
        ["", "Arquivo", "Formato", "O que a aplicação consome ou produz"],
        [
            [
                "Entra",
                "Contrato",
                "PDF",
                "A tabela de itens da proposta comercial vigente: código, descrição "
                "e quantidade contratada",
            ],
            [
                "Entra",
                "Levantamento",
                "XLSX",
                "Código e quantidade medida, da aba `Levantamento`; e as 19 abas de "
                "detalhe, que viram os anexos do documento",
            ],
            [
                "Sai",
                "Relatório de comprovação",
                "DOCX",
                "O entregável formal: capa institucional, tabela de comprovação e "
                "anexos de detalhamento — cerca de 41 páginas",
            ],
            [
                "Sai",
                "Análise da medição",
                "XLSX",
                "Papel de trabalho: os itens classificados por gravidade em cinco "
                "abas, para filtrar, ordenar e somar",
            ],
        ],
        [0.09, 0.19, 0.10, 0.62],
        alinhamentos=["center", "left", "center", "left"],
    )

    m.h2("2.3 O catálogo — o insumo que você não envia")
    m.p(
        "Existe um terceiro insumo, o **catálogo**, e ele já vem embutido na "
        "aplicação. O catálogo carrega o que não está nem no contrato nem na "
        "planilha: a taxonomia de seções, a ordem das linhas e as decisões de "
        "apresentação — unidade exibida, formatação de cada número, quais itens "
        "aparecem."
    )
    m.p(
        "Ele **não participa da comparação**. Quantidade contratada vem do "
        "contrato; medida vem da planilha. O catálogo governa apenas a forma. "
        "Ele existe porque a ordem do relatório não segue nem uma fonte nem a "
        "outra: são escolhas editoriais do documento modelo, conhecidas de "
        "antemão."
    )
    m.nota(
        "Por que isso importa para você",
        "O catálogo vale por contrato, não por competência. Uma vez conferido, "
        "ele serve a todos os meses seguintes daquele contrato — você segue "
        "enviando apenas dois arquivos. Um contrato com apresentação diferente "
        "da do piloto exige um catálogo próprio, e isso é tratado fora da tela "
        "do dia a dia.",
    )

    m.h2("2.4 Três garantias que mudam a forma de trabalhar")
    m.tabela(
        ["Garantia", "O que significa na prática"],
        [
            [
                "**É determinístico**",
                "A mesma entrada produz sempre o mesmo relatório. Duas execuções com "
                "os mesmos arquivos geram documentos idênticos, byte a byte — não há "
                "data de geração nem identificador aleatório no conteúdo. Você pode "
                "reprocessar sem medo de obter um resultado diferente.",
            ],
            [
                "**Não usa inteligência artificial**",
                "As duas entradas são geradas por sistema e legíveis por máquina. O "
                "trabalho é correspondência exata por código de serviço — não há "
                "OCR, interpretação semântica nem julgamento. Nada é adivinhado.",
            ],
            [
                "**Não guarda nada**",
                "O serviço recebe, processa, devolve e esquece. Não há cadastro, "
                "login, histórico entre competências nem arquivo retido no servidor. "
                "Os documentos ficam na sua máquina, e só lá.",
            ],
        ],
        [0.30, 0.70],
    )
    m.nota(
        "Nada é persistido, e isso é uma decisão",
        "A planilha de levantamento original traz a aba `Usuários` com mais de mil "
        "registros nominais de servidores públicos. O serviço não guardar arquivo "
        "algum é uma das razões pelas quais essa aba nunca fica em lugar nenhum "
        "além da sua estação de trabalho. A contrapartida: se você fechar a aba do "
        "navegador antes de baixar, é preciso enviar os arquivos de novo.",
    )


# ── 3 ─────────────────────────────────────────────────────────────────────────


def _antes_de_comecar(m: Manual) -> None:
    m.h1("3. Antes de começar")

    m.h2("3.1 O que ter em mãos")
    m.tabela(
        ["Item", "Detalhe"],
        [
            [
                "**O contrato, em PDF**",
                "A proposta comercial **vigente e completa**, com a tabela de itens e "
                "o total declarado ao fim dela. É desse arquivo que sai toda "
                "quantidade contratada.",
            ],
            [
                "**O levantamento, em XLSX**",
                "A planilha de medição da competência, com a aba `Levantamento` "
                "íntegra e as abas de detalhe que virarão anexos.",
            ],
            [
                "**O endereço da aplicação**",
                "A URL fornecida pela área responsável. Em uso local, a interface "
                "responde em `http://localhost:3000`.",
            ],
            [
                "**Um navegador atual**",
                "Chrome, Edge ou Firefox em versão recente. Não há instalação, "
                "plugin nem extensão a configurar.",
            ],
        ],
        [0.28, 0.72],
    )

    m.h2("3.2 Um contrato por vez, uma competência por vez")
    m.p(
        "Cada execução processa **um** PDF de contrato e **um** XLSX de "
        "levantamento. Consolidar o contrato original com vários aditivos está "
        "fora do escopo: envie o documento vigente, aquele que já incorpora os "
        "aditivos aplicáveis à competência."
    )

    m.nota(
        "Em uso local, use `localhost` e não `127.0.0.1`",
        "Para o navegador são origens distintas. Abrir a aplicação pelo endereço "
        "errado faz a tela simplesmente não reagir ao clique — sem mensagem de "
        "erro, sem indicação nenhuma do motivo.",
    )


# ── 4 ─────────────────────────────────────────────────────────────────────────


def _a_tela(m: Manual) -> None:
    m.h1("4. A tela do Confere")
    m.p(
        "A aplicação tem **uma única tela**, que atravessa três estados: envio, "
        "processamento e resultado. Não há menu, cadastro nem navegação — o que "
        "muda é o que a tela mostra abaixo do formulário."
    )

    m.tabela(
        ["Área", "Onde fica", "O que traz"],
        [
            [
                "**Barra de aplicação**",
                "Topo, fixa na rolagem",
                "A marca Confere e a assinatura *Confere o contratado. Confere o "
                "utilizado.* Depois da geração, aparece à direita a referência do "
                "contrato, a competência e o placar de divergências.",
            ],
            [
                "**Formulário de envio**",
                "Centro, sempre visível",
                "Os dois campos de arquivo e o botão **Gerar relatório**.",
            ],
            [
                "**Painel de resultado**",
                "Abaixo do formulário",
                "Surge após o processamento: a faixa de resultado com os dois "
                "downloads, o painel **Análise da medição** e o grid "
                "**Divergências, na ordem do relatório**.",
            ],
            [
                "**Rodapé institucional**",
                "Fim da página",
                "Identificação da PRODAM, endereço e redes. Sem função operacional.",
            ],
        ],
        [0.22, 0.20, 0.58],
    )

    m.nota(
        "A marca Confere não entra no documento",
        "O `.docx` carrega a identidade da PRODAM, que é quem assina o relatório. "
        "A marca do Confere identifica quem produziu, não o que foi produzido — e "
        "por isso vive apenas na tela.",
    )


# ── 5 ─────────────────────────────────────────────────────────────────────────


def _passo_a_passo(m: Manual) -> None:
    m.h1("5. Passo a passo — gerar o relatório")
    m.p(
        "São seis passos, do envio ao arquivo na pasta de downloads. O caminho "
        "inteiro leva menos de um minuto na maior parte dele — quase todo o tempo "
        "é a geração, no passo 4."
    )

    m.passo(1, "Enviar o contrato")
    m.p(
        "Clique no cartão **Contrato** e escolha o PDF da proposta comercial. O "
        "seletor aceita apenas `.pdf`. Ao escolher, o nome do arquivo aparece na "
        "faixa abaixo do rótulo, no lugar de *escolher arquivo…*"
    )
    m.p(
        "Não há área de arrastar e soltar. Arrastar um arquivo sobre o cartão não "
        "produz erro — simplesmente não faz nada. Use o clique."
    )

    m.passo(2, "Enviar o levantamento")
    m.p(
        "Clique no cartão **Levantamento** e escolha o XLSX da competência. O "
        "seletor aceita apenas `.xlsx`."
    )
    m.p(
        "Enquanto faltar um dos dois arquivos, o botão fica inativo e a tela "
        "explica por quê: *Os dois arquivos são necessários para gerar o "
        "relatório.*"
    )

    m.passo(3, "Clicar em Gerar relatório")
    m.p(
        "Com os dois arquivos escolhidos, o botão **Gerar relatório** fica ativo. "
        "Clique nele — ou pressione **Enter**, que tem o mesmo efeito."
    )

    m.passo(4, "Aguardar a geração")
    m.p(
        "O botão passa a exibir **Processando…** com um indicador de atividade, e "
        "abaixo dele aparece: *Extraindo o contrato, reconciliando e montando os "
        "anexos. Pode levar até um minuto.*"
    )
    m.tabela(
        ["Tempo", "O que esperar"],
        [
            ["**20 a 30 segundos**", "A duração usual, com arquivos do porte do piloto"],
            [
                "**Até um minuto**",
                "O que a tela anuncia. A maior parte do tempo é a emissão das cerca "
                "de 25 mil células dos 19 anexos",
            ],
            [
                "**Três minutos**",
                "O teto. Passado esse tempo a aplicação interrompe a espera e "
                "explica o que houve, em vez de deixar o indicador girando "
                "indefinidamente",
            ],
        ],
        [0.24, 0.76],
    )
    m.nota(
        "Não recarregue a página nem clique duas vezes",
        "Recarregar durante o processamento descarta o trabalho em curso e obriga "
        "a enviar os arquivos de novo — nada foi salvo no servidor. O botão já se "
        "protege de clique duplo enquanto processa.",
    )

    m.passo(5, "Ler o resultado")
    m.p(
        "Terminada a geração, o painel de resultado surge abaixo do formulário. "
        "O capítulo 6 detalha como lê-lo. Se houver achado bloqueante, **nada é "
        "gerado** e no lugar do painel aparece a lista de bloqueios — veja o "
        "capítulo 8."
    )

    m.passo(6, "Baixar os arquivos")
    m.p(
        "Na faixa **Relatório gerado** há dois botões. **Baixar DOCX** traz o "
        "entregável formal; **Baixar análise (XLSX)** traz o papel de trabalho. "
        "A hierarquia visual — um sólido, um contornado — diz qual é qual."
    )
    m.p(
        "Baixe os dois antes de sair da página. Nada fica guardado: fechar a aba "
        "obriga a repetir o processo desde o passo 1."
    )

    m.h2("5.1 Resumo dos seis passos")
    m.tabela(
        ["", "Ação", "Resultado esperado na tela"],
        [
            ["1", "Escolher o PDF do contrato", "O nome do arquivo aparece no cartão **Contrato**"],
            [
                "2",
                "Escolher o XLSX do levantamento",
                "O nome do arquivo aparece no cartão **Levantamento**; o botão fica ativo",
            ],
            ["3", "Clicar em **Gerar relatório**", "O botão passa a **Processando…**"],
            ["4", "Aguardar", "O indicador gira por 20 a 30 segundos"],
            [
                "5",
                "Ler o painel de resultado",
                "Faixa **Relatório gerado**, painel de análise e grid de divergências",
            ],
            ["6", "Baixar os dois arquivos", "`.docx` e `.xlsx` na pasta de downloads"],
        ],
        [0.06, 0.34, 0.60],
        alinhamentos=["center", "left", "left"],
    )


# ── 6 ─────────────────────────────────────────────────────────────────────────


def _ler_o_resultado(m: Manual) -> None:
    m.h1("6. Ler o resultado na tela")
    m.p(
        "O painel de resultado responde a duas perguntas diferentes sobre os "
        "mesmos dados. O painel **Análise da medição** responde *quão grave*; o "
        "grid **Divergências, na ordem do relatório** responde *onde no "
        "relatório*. Os dois convivem de propósito, e nessa ordem: quem confere "
        "pergunta o que é grave antes de perguntar onde está."
    )

    m.h2("6.1 A faixa de resultado")
    m.p(
        "É o primeiro bloco, com o título **Relatório gerado**. Abaixo dele, uma "
        "frase com o placar — por exemplo, *36 de 55 itens com divergência entre "
        "contratado e medido* — e, quando houver, a contagem de avisos "
        "registrados. À direita, os dois botões de download."
    )
    m.p(
        "A mesma informação sobe para a barra do topo, que fica visível durante "
        "toda a rolagem: a referência do contrato, a competência e o placar."
    )

    m.h2("6.2 Análise da medição — as quatro situações")
    m.p(
        "Acima do grid, o painel **Análise da medição** identifica o contrato, a "
        "proposta e a competência, informa o total de itens analisados e "
        "apresenta quatro blocos recolhíveis, **na ordem de gravidade**. Todo "
        "item analisado cai em exatamente um deles: as quatro situações são "
        "exclusivas e exaustivas, e a soma delas é o total."
    )

    m.tabela(
        ["Situação", "Critério", "O que significa"],
        [
            [
                "**Item crítico**",
                "medido acima do contratado",
                "Consumo sem cobertura contratual. O dinheiro já foi gasto — é o "
                "achado de maior consequência e o primeiro a tratar.",
            ],
            [
                "**Divergente de maior relevância**",
                "contratado sem medição no período",
                "Há previsão contratual e nenhuma medição no mês: serviço não "
                "entregue **ou** não demandado. Nem o contrato nem a planilha dizem "
                "qual dos dois — a distinção é da área de negócio.",
            ],
            [
                "**Divergente**",
                "medido abaixo do contratado",
                "Entrega parcial, com saldo a acompanhar.",
            ],
            [
                "**Sem divergência**",
                "medido igual ao contratado",
                "Conformidade — com a ressalva de itens de perfil e pacote, na seção "
                "6.4.",
            ],
        ],
        [0.24, 0.24, 0.52],
    )

    m.p(
        "Cada bloco traz à direita a contagem — *1 item*, *20 itens* — e **nasce "
        "recolhido**. A contagem é o achado: `0 itens` em **Item crítico** já é o "
        "resultado que quem confere mais quer ler, e não exige abrir nada. Clique "
        "no bloco para ver as linhas."
    )
    m.p(
        "Situação sem nenhum item aparece assim mesmo, com a contagem zerada e a "
        "frase *Nenhum item nesta situação.* dentro. Nenhuma das quatro é "
        "omitida: distinguir *não havia itens* de *o sistema não gerou o bloco* "
        "custaria caro numa conferência."
    )

    m.h2("6.3 Divergências, na ordem do relatório")
    m.p(
        "O grid reproduz a estrutura do documento — mesma ordem, mesmos grupos e "
        "seções, mesmos rótulos — e traz **somente os itens em que a quantidade "
        "contratada difere da medida**. É o que permite conferir cada linha "
        "contra a mesma linha do relatório."
    )
    m.tabela(
        ["Coluna", "Origem"],
        [
            ["Código · Descrição · Unidade", "Idênticas às do relatório"],
            ["Quantidade Contratada", "Do contrato, com a mesma formatação do documento"],
            ["Quantidade Medida", "Da aba `Levantamento`"],
            [
                "**Saldo**",
                "`contratada − medida`. É a coluna que o documento não tem: a "
                "subtração que o analista faria de cabeça em cada linha",
            ],
        ],
        [0.28, 0.72],
    )
    m.p(
        "Não havendo divergência nenhuma, o grid não aparece vazio: a tela diz, "
        "por escrito, que a quantidade medida é igual à contratada em todas as "
        "linhas."
    )

    m.h2("6.4 As três marcas, e por que nenhuma delas é decorativa")
    m.p(
        "Nenhuma informação do Confere depende só de cor. Cada marca carrega "
        "texto, e cada uma altera a leitura de um número."
    )

    m.tabela(
        ["Marca", "Onde aparece", "O que muda na sua leitura"],
        [
            [
                "**perfil**",
                "Ao lado da descrição, em âmbar",
                "Itens de perfil e pacote contam por unidade contratual e entram "
                "sempre como 1 contratado e 1 medido. **A diferença de perfil não "
                "aparece nas quantidades**: um item contratado no perfil D e medido "
                "no perfil C sai como se não houvesse diferença nenhuma. Igualdade "
                "aqui não é conferência bem-sucedida.",
            ],
            [
                "**Saldo negativo**",
                "Na coluna Saldo, em vermelho",
                "Medido acima do contratado. É consumo sem cobertura, e é o achado "
                "de maior consequência do grid.",
            ],
            [
                "**sem previsão contratual**",
                "Ao lado da descrição, dentro de **Item crítico**",
                "Item medido que **não consta da tabela de itens do contrato**. Ele "
                "não entra no documento formal — o modelo o omite por construção — "
                "e por isso a tela é o único lugar onde ele aparece.",
            ],
        ],
        [0.20, 0.24, 0.56],
    )

    m.nota(
        "A ressalva que impede o relatório de afirmar mais do que sabe",
        "Quando o bloco **Sem divergência** contém itens de perfil ou pacote, ele "
        "informa quantos são, em texto. No piloto são 5 de 19 — mais de um quarto "
        "da categoria. Um relatório que afirmasse conformidade sem ressalvar isso "
        "afirmaria mais do que verificou. A mesma ressalva viaja dentro do XLSX de "
        "análise, na coluna `Perfil ou pacote`.",
    )


# ── 7 ─────────────────────────────────────────────────────────────────────────


def _os_arquivos(m: Manual) -> None:
    m.h1("7. Os arquivos gerados")

    m.h2("7.1 O relatório de comprovação — DOCX")
    m.p(
        "É o entregável formal. Sai sobre o modelo institucional da PRODAM, com "
        "as fontes, o papel timbrado e o rodapé do modelo, em três blocos:"
    )
    m.tabela(
        ["Bloco", "Páginas", "Conteúdo"],
        [
            ["**Capa**", "1", "A capa do modelo institucional"],
            [
                "**Tabela de comprovação**",
                "2 e 3",
                "22 seções e 55 linhas, em paisagem: Código, Descrição, Unidade, "
                "Quantidade Contratada e Quantidade Medida",
            ],
            [
                "**Anexos de detalhamento**",
                "4 a 41",
                "19 anexos, um por aba da planilha, reproduzindo a apresentação do "
                "documento de referência: orientação de página, largura de coluna, "
                "altura de linha e figuras",
            ],
        ],
        [0.24, 0.12, 0.64],
        alinhamentos=["left", "center", "left"],
    )
    m.p(
        "Os anexos existem para que conferir uma quantidade não exija voltar à "
        "planilha de 22 abas: eles mostram **de onde cada número medido veio**."
    )
    m.p(
        "O arquivo é **editável de propósito**. Documento que instrui faturamento "
        "passa por revisão, e revisar exige poder ajustar."
    )
    m.nota(
        "A capa é conteúdo fixo",
        "Ela reproduz exatamente a capa do modelo institucional, com a referência "
        "do contrato e da proposta do piloto gravadas. **Para outro contrato, a "
        "capa sairá errada** e precisa ser corrigida à mão antes de encaminhar. É "
        "o primeiro item da conferência do capítulo 9.",
    )

    m.h2("7.2 A análise da medição — XLSX")
    m.p(
        "É papel de trabalho, não peça formal. Traz os mesmos itens da tela, "
        "organizados para filtrar, ordenar e somar. São cinco abas:"
    )
    m.tabela(
        ["Aba", "Conteúdo"],
        [
            [
                "`Resumo Executivo`",
                "Contrato, proposta e competência; a contagem de cada uma das quatro "
                "situações com o respectivo critério; e o total de itens analisados",
            ],
            ["`Itens Críticos`", "Os itens medidos acima do contratado"],
            [
                "`Divergências Maior Relevância`",
                "Os itens contratados sem medição no período",
            ],
            ["`Divergências`", "Os itens medidos abaixo do contratado"],
            ["`Sem Divergência`", "Os itens em que medido e contratado coincidem"],
        ],
        [0.30, 0.70],
    )
    m.p(
        "As quatro abas de situação saem **sempre**, inclusive vazias. As colunas "
        "são `Código`, `Descrição`, `Contratado`, `Medido` e `Saldo` — esta "
        "última ausente em `Sem Divergência`, onde seria uma coluna de zeros."
    )
    m.p(
        "As quantidades são **números de verdade**, não texto: a célula guarda o "
        "valor cheio e exibe a grafia do relatório pelo formato de exibição. Você "
        "pode somar, filtrar e ordenar a planilha sem conversão nenhuma."
    )
    m.p(
        "Duas colunas existem só nesta planilha, porque ela circula sem as "
        "legendas da tela: `Perfil ou pacote`, na aba `Sem Divergência`, e `Sem "
        "previsão contratual`, na aba `Itens Críticos`. As duas trazem texto "
        "legível — *Sim — entra como 1/1*, *Sim — não consta no contrato* — e "
        "nunca `VERDADEIRO`."
    )

    m.h2("7.3 Os nomes dos arquivos")
    m.p(
        "O navegador nomeia os dois downloads sozinho, a partir da referência do "
        "contrato e da competência:"
    )
    m.tabela(
        ["Arquivo", "Padrão do nome"],
        [
            ["Relatório de comprovação", "`confere-<contrato>-<aaaa-mm>.docx`"],
            ["Análise da medição", "`confere-analise-<contrato>-<aaaa-mm>.xlsx`"],
        ],
        [0.34, 0.66],
    )
    m.p(
        "A competência entra como `aaaa-mm` para que doze meses ordenem sozinhos "
        "na pasta, e `analise` no nome distingue os dois arquivos da mesma "
        "competência sem depender da extensão."
    )


# ── 8 ─────────────────────────────────────────────────────────────────────────


def _avisos_e_bloqueios(m: Manual) -> None:
    m.h1("8. Avisos, bloqueios e erros")

    m.h2("8.1 A diferença entre avisar e bloquear")
    m.p(
        "Antes de gerar qualquer coisa, dez verificações rodam sobre as entradas. "
        "Cada uma tem identificador próprio e um de dois efeitos:"
    )
    m.tabela(
        ["Efeito", "O que acontece"],
        [
            [
                "**BLOQUEIA**",
                "Nada é gerado. A tela mostra *Processamento bloqueado — nenhum "
                "relatório foi gerado*, com a lista de achados em vermelho. **Não há "
                "download**: nem documento, nem linha, nem relatório parcial.",
            ],
            [
                "**AVISA**",
                "O relatório é gerado normalmente, e a ressalva fica registrada e "
                "exibida em âmbar, abaixo do grid e na contagem da faixa de "
                "resultado.",
            ],
        ],
        [0.18, 0.82],
    )
    m.p(
        "O princípio por trás disso: **nenhum item pode receber quantidade zero "
        "por falha silenciosa de extração**. Um arquivo fora do padrão produz "
        "mensagem clara, nunca um documento errado."
    )

    m.h2("8.2 As validações")
    m.p(
        "Cada achado aparece na tela com o identificador à esquerda da mensagem. "
        "Use a tabela abaixo para saber o que fazer com ele."
    )
    m.tabela(
        ["ID", "O que verifica", "Efeito", "O que fazer"],
        [
            [
                "`V-CTR-01`",
                "A tabela de itens foi localizada no contrato e tem ao menos uma linha",
                "BLOQUEIA",
                "Confirme que o PDF é a proposta comercial **completa**, e não um "
                "extrato ou um resumo",
            ],
            [
                "`V-CTR-02`",
                "Todo código do catálogo foi resolvido no contrato",
                "BLOQUEIA",
                "O contrato enviado não é o vigente, ou o catálogo precisa de "
                "revisão. Acione a área responsável pelo catálogo",
            ],
            [
                "`V-CTR-03`",
                "A soma dos itens bate com o total declarado no contrato",
                "BLOQUEIA",
                "A extração ficou incompleta — costuma indicar PDF danificado ou "
                "gerado por digitalização. Obtenha o arquivo original",
            ],
            [
                "`V-MED-01`",
                "A aba `Levantamento` existe e produziu itens",
                "BLOQUEIA",
                "Verifique se a planilha é a de medição da competência e se a aba "
                "não foi renomeada ou alterada de estrutura",
            ],
            [
                "`V-CAT-01`",
                "O catálogo não tem código nem ordem duplicados",
                "BLOQUEIA",
                "Só ocorre com catálogo enviado por upload. Acione a área "
                "responsável",
            ],
            [
                "`V-MED-02`",
                "Data do levantamento e contrato de referência no cabeçalho da aba",
                "AVISA",
                "O relatório sai, mas o topo do documento e o nome do arquivo ficam "
                "sem essas informações. Confira o cabeçalho da aba `Levantamento`",
            ],
            [
                "`V-CAT-02`",
                "Códigos do contrato ausentes do catálogo",
                "AVISA",
                "O item existe no contrato e **não entrará no relatório**. Costuma "
                "indicar catálogo desatualizado após um aditivo",
            ],
            [
                "`V-CAT-03`",
                "Códigos do catálogo sem correspondência na planilha",
                "AVISA",
                "A linha sai **zerada** no relatório. Confirme se o serviço não foi "
                "mesmo medido no período",
            ],
            [
                "`V-REC-01`",
                "Quantidade contratada divergente entre o contrato e a planilha",
                "AVISA",
                "**Confira antes de encaminhar.** O relatório usa a do contrato. "
                "Este é o aviso que expõe planilha defasada em relação a aditivo",
            ],
        ],
        [0.10, 0.28, 0.11, 0.51],
        alinhamentos=["left", "left", "center", "left"],
    )

    # T-1530 / ESPEC 021 — a linha do `V-REC-02` **saiu desta tabela**, e não foi
    # apenas corrigida como o backlog previu.
    #
    # O texto anterior errava duas vezes ("item que não é de perfil", "a linha
    # sai zerada") e continuaria errando de um terceiro modo se ficasse: a
    # `R-PER-08` tirou a `V-REC-02` da lista de achados. Descrever como validação
    # o que já não é validação mandaria o leitor procurar na tela um aviso âmbar
    # que não aparece mais. O comportamento passa a ser explicado onde ele se
    # manifesta — na tabela da tela.
    m.h2("8.3 As linhas que saem como perfil ou pacote")
    m.p(
        "Quando a coluna **Quantidade Medida** da aba `Levantamento` não traz um "
        "número — e sim `PACOTE`, uma letra de perfil ou um traço —, o sistema "
        "entende que o item é de plano ou pacote e lança **1 contratado e 1 "
        "medido**. É o tratamento correto para esse tipo de serviço: pacote não "
        "se conta."
    )
    m.p(
        "Como isso é uma **dedução**, e não uma leitura, a tela mostra todas as "
        "linhas em que ela foi aplicada, numa tabela abaixo do grid, com o "
        "conteúdo exato das duas células e o número da linha na planilha."
    )
    m.nota(
        "Confira essas linhas antes de encaminhar",
        "`PACOTE` e letra de perfil estão certos. Célula **vazia**, `-` ou `N/A` "
        "não: aquela linha deveria ter quantidade e vai sair faturada como 1. "
        "Vale conferir também se a letra do perfil medido é a mesma do "
        "contratado — o relatório mostra 1 e 1 nos dois casos, e a tabela é o "
        "único lugar onde essa diferença aparece.",
    )

    m.nota(
        "O aviso `V-REC-01` merece leitura, sempre",
        "Ele compara a quantidade contratada das duas fontes e denuncia quando "
        "elas discordam. Foi ele que expôs, no piloto, um item cujo aditivo "
        "elevou a quantidade de 6 para 10 e que o relatório montado à mão manteve "
        "em 6 — uma divergência que a conferência manual não pegou em nenhuma "
        "competência.",
    )

    m.h2("8.4 Quando a mensagem é de comunicação, não de conteúdo")
    m.tabela(
        ["Mensagem na tela", "O que significa", "O que fazer"],
        [
            [
                "*A geração passou de três minutos e foi interrompida. O servidor "
                "pode estar sobrecarregado — tente novamente em instantes.*",
                "A aplicação estava trabalhando, mas passou do teto de espera",
                "Aguarde alguns instantes e repita. Se persistir, acione o suporte: "
                "pode haver mais gerações simultâneas do que o servidor comporta",
            ],
            [
                "*Não foi possível falar com o servidor. Verifique se o backend "
                "está no ar.*",
                "A requisição não chegou ao destino",
                "Confirme o endereço e a conexão de rede. Em uso local, verifique se "
                "o serviço está em execução e se você abriu a página por `localhost`",
            ],
            [
                "*Falha no processamento* seguido de um código HTTP",
                "Erro inesperado no servidor",
                "Repita uma vez. Persistindo, acione o suporte informando o código e "
                "os dois arquivos usados",
            ],
        ],
        [0.34, 0.24, 0.42],
    )


# ── 9 ─────────────────────────────────────────────────────────────────────────


def _conferencia_final(m: Manual) -> None:
    m.h1("9. Conferência antes de encaminhar")
    m.p(
        "O Confere produz o documento; a responsabilidade pelo que se encaminha "
        "segue sendo de quem assina. Esta é a lista mínima."
    )
    m.lista(
        [
            "**A capa.** Ela é conteúdo fixo do modelo. Se o contrato não for o do "
            "piloto, a referência do contrato e a da proposta na capa estarão "
            "erradas e precisam ser corrigidas no `.docx`.",
            "**Os avisos.** Leia cada um. `V-REC-01` e `V-CAT-03` alteram a leitura "
            "de linhas específicas do relatório.",
            "**O bloco Item crítico.** Consumo sem cobertura contratual é o achado "
            "que não pode seguir sem tratamento.",
            "**Os itens sem previsão contratual.** Eles não estão no documento — "
            "estão apenas na tela e na aba `Itens Críticos` do XLSX. Se houver "
            "algum, ele precisa ser levado adiante por fora do relatório.",
            "**A ressalva de perfil.** No bloco **Sem divergência**, confira "
            "quantos itens são de perfil ou pacote: neles a igualdade das "
            "quantidades não prova conformidade.",
            "**A data do levantamento e a referência do contrato** no topo da "
            "tabela de comprovação, na página 2.",
        ],
        numerada=True,
    )
    m.nota(
        "O que a ferramenta encontra e o documento não mostra",
        "O relatório reproduz o modelo, e o modelo omite por construção itens com "
        "quantidade contratada zero e a Seção A. O achado não se perde: ele muda "
        "de lugar, para a tela e para o XLSX de análise. Encaminhar apenas o "
        "`.docx` sem ler a tela deixa esse achado para trás.",
    )


# ── 10 ────────────────────────────────────────────────────────────────────────


def _teclado(m: Manual) -> None:
    m.h1("10. Operação por teclado e acessibilidade")
    m.p(
        "A camada que você opera — formulário, painel de resultado e grid — está "
        "em conformidade com a **WCAG 2.1 nível AA**. A aplicação inteira pode "
        "ser usada sem mouse."
    )
    m.tabela(
        ["Tecla", "Efeito"],
        [
            ["**Tab** / **Shift+Tab**", "Percorre campos, botões, blocos e tabelas"],
            ["**Enter** ou **Espaço**", "Aciona o campo de arquivo ou o botão em foco"],
            ["**Enter** no formulário", "Envia — o mesmo que clicar em **Gerar relatório**"],
            [
                "**Enter** sobre um bloco da análise",
                "Abre ou recolhe a situação; o estado é anunciado por leitor de tela",
            ],
            [
                "**Setas** com o foco numa tabela",
                "Rola horizontalmente. As tabelas transbordam em telas estreitas, e o "
                "contêiner que rola é alcançável por teclado",
            ],
        ],
        [0.28, 0.72],
    )
    m.p("Duas consequências valem registro para quem opera:")
    m.lista(
        [
            "**Nenhuma informação depende só de cor.** Saldo negativo e marcação de "
            "perfil carregam sempre um portador textual.",
            "**Nenhuma explicação depende do cursor.** As ressalvas são legendas "
            "visíveis, não dicas que aparecem ao passar o mouse.",
            "Ao fim do processamento o foco vai para o título do resultado, de modo "
            "que quem usa leitor de tela saiba que a espera terminou.",
        ]
    )


# ── 11 ────────────────────────────────────────────────────────────────────────


def _nao_faz(m: Manual) -> None:
    m.h1("11. O que o Confere não faz")
    m.p(
        "Cada linha abaixo é um limite deliberado, não uma pendência de "
        "implementação."
    )
    m.tabela(
        ["Fora do escopo", "Motivo"],
        [
            ["Calcular valores financeiros", "O relatório-alvo é de quantidades, não de preços"],
            [
                "Consolidar contrato original e aditivos",
                "Um único PDF vigente por execução",
            ],
            [
                "Comparar perfis — D contratado × C medido",
                "O layout de duas colunas numéricas não comporta a informação",
            ],
            ["Guardar histórico entre competências", "O serviço é sem estado, por decisão"],
            ["Autenticação, cadastro, multiusuário", "Não há dado sensível persistido"],
            [
                "Recomendar ação por item",
                "Classificar é da aplicação; decidir o que fazer é do negócio",
            ],
            [
                "Filtro, busca ou ordenação no grid",
                "As divergências cabem numa rolagem, e a categorização por gravidade "
                "torna o filtro desnecessário. Para filtrar e ordenar, use o XLSX",
            ],
        ],
        [0.36, 0.64],
    )


# ── 12 ────────────────────────────────────────────────────────────────────────


def _limitacoes(m: Manual) -> None:
    m.h1("12. Limitações conhecidas")
    m.p("As que afetam a leitura do resultado, e o que fazer diante de cada uma.")
    m.tabela(
        ["Limitação", "Como conviver com ela"],
        [
            [
                "**A capa é conteúdo fixo**",
                "Reproduz o modelo institucional, com a referência do contrato e da "
                "proposta do piloto gravadas. Para outro contrato, corrija a capa no "
                "`.docx` antes de encaminhar",
            ],
            [
                "**Itens de perfil perdem informação**",
                "Perfis e pacotes entram como 1/1, então perfil menor que o "
                "contratado — diferença comercialmente relevante — não aparece. "
                "Confira esses itens pela planilha de origem",
            ],
            [
                "**Consumo sem previsão contratual não entra no documento**",
                "Ele aparece na tela e no XLSX, dentro de **Item crítico**. Leve-o "
                "adiante por fora do relatório",
            ],
            [
                "**A quebra de página não coincide com a do modelo**",
                "As alturas de linha diferem, então a virada de página cai em item "
                "diferente. Não afeta o conteúdo",
            ],
            [
                "**Um único contrato por execução**",
                "Envie o PDF vigente, que já incorpora os aditivos aplicáveis",
            ],
            [
                "**As regras vieram de um único caso**",
                "Toda a lógica foi derivada de uma competência de um contrato. O "
                "catálogo isola boa parte da variação, mas um contrato novo pede "
                "conferência atenta na primeira execução",
            ],
        ],
        [0.34, 0.66],
    )


# ── 13 ────────────────────────────────────────────────────────────────────────


def _perguntas(m: Manual) -> None:
    m.h1("13. Perguntas frequentes")

    perguntas = [
        (
            "O relatório sai sempre igual?",
            "Sim. Duas execuções com os mesmos arquivos produzem documentos "
            "idênticos, byte a byte. Não há data de geração nem identificador "
            "aleatório no conteúdo.",
        ),
        (
            "Posso editar o documento gerado?",
            "Sim — é um `.docx`. Foi uma das razões de escolher o formato: um "
            "documento que instrui faturamento passa por revisão, e revisar exige "
            "poder ajustar.",
        ),
        (
            "O sistema usa inteligência artificial?",
            "Não. As duas entradas são geradas por sistema e legíveis por máquina, "
            "e o trabalho é correspondência exata por código de serviço. Um modelo "
            "de IA aqui traria custo, lentidão e resultado que muda entre "
            "execuções, sem resolver nada.",
        ),
        (
            "E se o layout da planilha mudar?",
            "A leitura ancora em rótulo e código, nunca em posição fixa de linha. "
            "Mudanças maiores fazem a aplicação **falhar e avisar**, não produzir "
            "número errado.",
        ),
        (
            "Como sei que o contrato foi lido por inteiro?",
            "O contrato declara um total ao fim da tabela de itens. A aplicação "
            "recalcula a soma e compara — é a validação `V-CTR-03`. Faltando uma "
            "linha, o valor muda e o processamento é interrompido.",
        ),
        (
            "Preciso enviar o catálogo?",
            "Não. Ele acompanha a aplicação e reproduz o relatório de comprovação "
            "atual. Só um contrato com apresentação diferente da do piloto exigiria "
            "outro catálogo, e isso é tratado fora da tela do dia a dia.",
        ),
        (
            "Por que a quantidade contratada da planilha é ignorada?",
            "Porque a fonte da verdade é o contrato. A planilha traz uma coluna de "
            "quantidade contratada que pode estar defasada em relação a um aditivo "
            "— quando as duas discordam, o aviso `V-REC-01` registra a diferença e "
            "o relatório usa a do contrato.",
        ),
        (
            "O que acontece se o mesmo código aparecer mais de uma vez?",
            "No contrato, as quantidades são somadas — salvo quando o catálogo "
            "traz um qualificador, e aí cada linha vira uma linha própria. Na "
            "planilha, prevalece a ocorrência **descontada de recursos de "
            "desenvolvimento**.",
        ),
        (
            "Alguém mais vê os arquivos que eu envio?",
            "Não há armazenamento. O serviço recebe, processa em memória, devolve "
            "e descarta — não há histórico, banco de dados nem arquivo retido no "
            "servidor.",
        ),
        (
            "Fechei a aba antes de baixar. E agora?",
            "Envie os arquivos novamente e repita a geração. Nada foi guardado, e "
            "o resultado será idêntico ao anterior.",
        ),
    ]

    for pergunta, resposta in perguntas:
        m.h3(pergunta)
        m.p(resposta)


# ── 14 ────────────────────────────────────────────────────────────────────────


def _glossario(m: Manual) -> None:
    m.h1("14. Glossário")
    m.tabela(
        ["Termo", "Significado neste sistema"],
        [
            ["**Competência**", "O mês a que a medição se refere — por exemplo, julho/2026"],
            [
                "**Contratada**",
                "Quantidade prevista no contrato, extraída da tabela de itens do PDF",
            ],
            [
                "**Medida**",
                "Quantidade efetivamente apurada no período, lida da aba `Levantamento`",
            ],
            ["**Saldo**", "`contratada − medida`. Negativo significa consumo acima do contratado"],
            ["**Divergência**", "Item em que a quantidade contratada difere da medida"],
            [
                "**Item crítico**",
                "Item medido acima do contratado — consumo sem cobertura contratual",
            ],
            [
                "**Sem previsão contratual**",
                "Item medido que não consta da tabela de itens do contrato",
            ],
            [
                "**Catálogo**",
                "Definição embutida da apresentação do relatório: seções, ordem e "
                "formatação. Não participa da comparação",
            ],
            [
                "**Relatório de comprovação**",
                "A tabela das páginas 2 e 3 do documento — o que instrui o faturamento",
            ],
            [
                "**Anexo de detalhamento**",
                "Uma aba da planilha impressa no documento, mostrando de onde a "
                "quantidade medida veio",
            ],
            [
                "**Perfil ou pacote**",
                "Item que conta por unidade contratual e entra sempre como 1/1, "
                "independentemente do conteúdo da planilha",
            ],
        ],
        [0.26, 0.74],
    )
