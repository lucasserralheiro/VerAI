"""Agregado do contrato — resultado da extração da tabela de itens."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from decimal import Decimal

from domain.entities.contract_item import ContractItem
from domain.value_objects.block_label import RotuloDeBloco
from domain.value_objects.identidade_contratual import IdentidadeContratual


@dataclass(frozen=True)
class BlocoDeItens:
    """T-1311 / ``R-ADT-01`` — um bloco da tabela de itens, com o seu rótulo.

    Um bloco termina na linha ``TOTAL:``, e é ela que lhe dá o rótulo. Uma
    proposta traz **um** bloco — o piloto sem rótulo, a proposta do PGM rotulada
    ``Aumento`` —, e o aditivo do PGM traz três: ``Aumento``, ``Redução`` e
    ``Inclusão``.

    O ``total_declarado`` fica junto porque é ele que define a fronteira: guardá-lo
    à parte deixaria o bloco sem o dado que o delimita.
    """

    rotulo: RotuloDeBloco | None
    itens: tuple[ContractItem, ...]
    total_declarado: Decimal | None = None

    @property
    def codigos(self) -> set[str]:
        return {item.codigo.valor for item in self.itens}

    @property
    def altera_o_conjunto(self) -> bool:
        """``R-ADT-03`` — só ``Inclusão`` e ``Exclusão`` mudam quais códigos há.

        Bloco sem rótulo devolve ``False``: num aditivo ele não tem efeito, e
        numa proposta a decisão nem passa por aqui — ``R-ADT-02`` toma todos.
        """
        return self.rotulo is not None and self.rotulo.altera_o_conjunto


@dataclass(frozen=True)
class DiagnosticoDaGrade:
    """T-1120 / ``R-GRD-07`` — o que a extração observou no documento.

    Existe para que ``V-CTR-01`` deixe de dizer apenas *"tabela não
    localizada"*. Com estes quatro números, quem dá suporte distingue PDF
    digitalizado de layout novo sem abrir o arquivo — e é a informação que
    faltava quando o ``PA-PGM`` bloqueou com 57 mensagens e nenhuma explicação.
    """

    paginas: int
    paginas_com_borda: int
    maior_numero_de_divisorias: int
    paginas_com_texto: int
    gabarito: tuple[float, ...] | None = None

    # ── T-1915 / ESPEC 025 `R-DOC-01` — o que já era calculado e se perdia ────
    #
    # Os três campos abaixo **não custam leitura nova de PDF**: `candidatos` já
    # existe em `analisar_geometria`, e `_PROPOSTA` já é buscada na página 1 pelo
    # extrator. Varrer o documento atrás de códigos custaria 16,7 s no
    # `modelo.pdf` — quase dobrando um caminho de falha que já leva 16,6 —, e a
    # ESPEC 025 §2.6 mede e descarta essa alternativa.
    #
    # **Por último e com padrão**, pela mesma razão do campo `diagnostico` do
    # `Contract`: dezenas de construções parciais nos testes quebrariam com campo
    # obrigatório.

    #: Quantas geometrias de sete colunas o documento tem.
    geometrias_candidatas: int = 0
    #: Códigos de serviço encontrados **em cada** uma delas, na ordem da escolha
    #: de `R-GRD-02`. No `modelo.pdf` são `(0, 0, 0)`: as três tabelas de sete
    #: colunas dele listam matrículas, não itens contratados.
    codigos_nas_candidatas: tuple[int, ...] = ()
    #: `R-DOC-02` — a página 1 identifica uma proposta, **ou** alguma candidata
    #: contém código de serviço. Basta um dos dois.
    #:
    #: O padrão é `True`, e é a única leitura conservadora possível: a ausência
    #: do sinal é ausência de evidência, não evidência do contrário. Um padrão
    #: `False` faria `V-DOC-01` disparar sobre todo diagnóstico construído à mão
    #: e **apagaria o caminho `V-ADT-01`** da suíte, sem nada acusar.
    parece_proposta: bool = True
    #: `R-DOC-03` degrau 4 — as propostas que a página 1 cita, quando cita. É o
    #: que permite a mensagem nomear o arquivo que deveria ter sido enviado.
    referencias: tuple[str, ...] = ()
    #: ESPEC 032 `R-CON-05` — páginas cuja cauda satisfez o crivo e **não achou
    #: linha anterior** a que se anexar. Anomalia: não ocorre em nenhum dos três
    #: documentos, e é o que `V-CTR-06` acusa.
    #:
    #: **Por último e com padrão**, como todos os campos acrescentados a este
    #: diagnóstico: ele é construído à mão em dezenas de testes.
    caudas_orfas: tuple[tuple[int, str], ...] = ()
    #: T-2261 / ESPEC 035 `R-GRD-10` — páginas em que a grade viu palavra no vão
    #: da tabela e **não** a atribuiu a linha nenhuma, e quantas por página.
    #:
    #: `ler_celulas` descarta em silêncio o que cai fora de
    #: `[horizontais[0], horizontais[-1]]`, e era o único dos dois caminhos de
    #: perda sem nenhum rastro (ESPEC 035 §2.2). Foi a falta deste número que fez
    #: o diagnóstico do `PA-FTM-251001-143` depender de aritmética sobre o valor
    #: declarado: o sintoma disponível era *"faltam R$ 51.676,20"*, e a página só
    #: apareceu por subtração.
    #:
    #: **Não é sinônimo de perda.** Prosa acima da tabela entra aqui e está
    #: certa — são 177 palavras na página 25 do piloto. Quem separa é o crivo de
    #: quem resgata: `cauda_da_pagina` para a cauda de descrição, `R-GRD-11` para
    #: a linha de item. O que já foi resgatado não é contado.
    #:
    #: **Por último e com padrão**, como todos os campos acrescentados a este
    #: diagnóstico: ele é construído à mão em três módulos de teste.
    palavras_descartadas: tuple[tuple[int, int], ...] = ()
    #: T-2681 / ESPEC 045 `R-COL-07` — cada troca do papel de preço, quantidade
    #: e período, com a página em que ocorreu e a ordem lida (ex.: `"quantidade,
    #: período, preço unitário"`). A ordem canônica não entra aqui — só a
    #: divergência, que é o que `V-CTR-08` avisa.
    #:
    #: **Por último e com padrão**, como todos os campos acrescentados a este
    #: diagnóstico: ele é construído à mão em dezenas de testes.
    ordem_de_colunas_alternativa: tuple[tuple[int, str], ...] = ()

    def resumir(self) -> str:
        return (
            f"{self.paginas} páginas, {self.paginas_com_borda} com borda desenhada, "
            f"{self.paginas_com_texto} com texto, no máximo "
            f"{self.maior_numero_de_divisorias} divisórias verticais numa página"
        )


@dataclass
class Contract:
    proposta: str
    total_declarado: Decimal | None = None
    itens: list[ContractItem] = field(default_factory=list)
    # Por último e com padrão: `Contract` é construído com argumentos parciais
    # em vários testes, e um campo obrigatório aqui quebraria todos eles.
    diagnostico: DiagnosticoDaGrade | None = None
    # T-1311 / `R-ADT-01` — a mesma tabela, vista por blocos.
    #
    # `itens` **continua sendo o campo**, e não uma derivação de `blocos`: ele é
    # o que trinta e tantos pontos do código leem, e o que os testes constroem
    # direto. Trocá-lo por propriedade obrigaria a reescrever construções que a
    # ESPEC 019 §9.1 se proibiu de tocar.
    #
    # A redundância é real, e por isso `__post_init__` a confere: quem preenche
    # `blocos` tem de preencher `itens` com a concatenação deles. É invariante de
    # uma linha contra deriva silenciosa entre duas visões da mesma coisa.
    blocos: tuple[BlocoDeItens, ...] = ()
    # `R-ADT-11` — as peças que compõem este quantitativo, na ordem de submissão.
    # Numa peça isolada é ela mesma; num consolidado, a proposta e os aditivos.
    # É o que o rodapé nomeia.
    propostas: tuple[str, ...] = ()
    # ESPEC 020 `R-CAP-04` — o nome do órgão, para a capa. Derivado na extração,
    # porque é dado da primeira página do PDF e é lá que ela já é lida (`D-07`).
    cliente: str = ""
    # T-2085 / ESPEC 029 `R-IDT-01` — de que contrato esta peça é.
    #
    # **Por último e com padrão**, pela mesma razão de `diagnostico` e `cliente`:
    # dezenas de construções parciais na suíte quebrariam com campo obrigatório.
    #
    # `None` é ausência de declaração, e `R-IDT-06` a transforma em silêncio —
    # nunca em acusação. `modelo.pdf` e `amostra_sem_tabela.pdf` chegam assim.
    identidade: IdentidadeContratual | None = None
    # `R-IDT-05` — o processo administrativo, segundo eixo da `V-IDT-03`.
    processo: str = ""

    def __post_init__(self) -> None:
        if not self.propostas and self.proposta:
            self.propostas = (self.proposta,)

        if not self.blocos:
            return
        concatenados = [item for bloco in self.blocos for item in bloco.itens]
        if concatenados != self.itens:
            raise ValueError(
                f"blocos e itens divergem: {len(concatenados)} itens nos "
                f"{len(self.blocos)} blocos contra {len(self.itens)} em `itens`"
            )

    # ── Consolidação com os aditivos ──────────────────────────────────────────

    def aplicar(self, aditivos: Sequence[Contract]) -> Contract:
        """T-1320 / `R-ADT-02` a `R-ADT-07` — a proposta mais os seus aditivos.

        **Os quatro rótulos são aplicados** (T-1610 / ESPEC 022 `R-QTD-01`).
        `Inclusão` e `Exclusão` mudam quais códigos existem; `Aumento` e
        `Redução` entram como itens adicionais do mesmo código, e
        `quantidade_para` os soma pelo caminho que já existia para as várias
        linhas de um código na proposta (`D-01`).

        A ESPEC 019 `R-ADT-06` mandava descartar os dois de quantitativo, e a
        justificativa era boa para o que se sabia então: o relatório não usa
        quantitativo do contrato desde a ESPEC 018 `D-05`, e dele saem apenas
        ordem, descrição e unidade. **Isso continua valendo** — o consumidor que
        apareceu depois é a `V-REC-01`, que comparava o contratado da proposta,
        sem os deltas, contra o da aba, e por isso precisava de uma lista de
        supressão para não acusar cinco divergências falsas no PGM.

        Medido duas vezes, e é o que autoriza a mudança:

        * aplicando só `Inclusão` e `Exclusão`, o documento do PGM sai com as
          mesmas 58 linhas — 47 ordenadas e 11 no bloco final;
        * aplicando os quatro, o `.docx` e o `.xlsx` saem **idênticos parte a
          parte**, e o `Report` que os alimenta também (ESPEC 022 §2.3). O que
          muda é só o lado esquerdo da comparação da `V-REC-01`.

        Os aditivos são aplicados **em sequência** (`R-ADT-07`): um código incluído
        por um pode ser excluído por outro posterior, e o contrário também vale.

        O consolidado sai **sem `total_declarado` e sem `blocos`**, e é deliberado
        (`D-07`): ele mistura um escopo com deltas, e a soma dos totais das suas
        linhas não corresponde a número de documento nenhum. O checksum vale por
        peça, onde sempre foi verdadeiro — `V-CTR-03` não roda aqui.
        """
        itens = list(self.itens)

        for aditivo in aditivos:
            for bloco in aditivo.blocos:
                if bloco.rotulo is RotuloDeBloco.INCLUSAO:
                    # `R-ADT-04` — ao fim da ordem, com a descrição do aditivo.
                    itens.extend(bloco.itens)
                elif bloco.rotulo is RotuloDeBloco.EXCLUSAO:
                    # `R-ADT-05` — sai toda linha daquele código, e não a primeira:
                    # a proposta desdobra o mesmo código em várias linhas.
                    fora = bloco.codigos
                    itens = [i for i in itens if i.codigo.valor not in fora]
                elif bloco.rotulo in (RotuloDeBloco.AUMENTO, RotuloDeBloco.REDUCAO):
                    # `R-QTD-02` / `D-02` — **o sinal vem do documento.** A
                    # `Redução` do PGM é extraída `-80,00`, com o total do bloco
                    # em `-897.734,40`: os dois rótulos recebem tratamento
                    # idêntico, e nada é negado aqui. Derivar o sinal do rótulo
                    # criaria uma segunda fonte de verdade para a mesma
                    # informação, a divergir no dia em que uma redução vier
                    # positiva.
                    #
                    # `R-QTD-03` / `D-03` — **só para código já presente.** Um
                    # `Aumento` de código ausente é o que `V-ADT-04` acusa, e a
                    # sua linha tem de continuar caindo no bloco final;
                    # aplicá-lo aqui lhe daria posição no contrato e moveria a
                    # linha para o corpo ordenado do `.docx` em silêncio. É o
                    # único caminho pelo qual esta regra alcançaria o
                    # entregável.
                    #
                    # `presentes` é recalculado **dentro** do laço, e não uma vez
                    # antes: `R-QTD-04` exige que um código já excluído por uma
                    # peça anterior não receba delta de uma posterior.
                    presentes = {i.codigo.valor for i in itens}
                    itens.extend(i for i in bloco.itens if i.codigo.valor in presentes)

        return Contract(
            proposta=self.proposta,
            # T-1420 — **sem esta linha o cliente some no caminho com aditivo**, que
            # é o do PGM, que é o motivo de a ESPEC 020 existir. `aplicar` monta um
            # `Contract` novo a partir de uma lista fixa de campos, e o que não
            # entrar nela desaparece em silêncio.
            cliente=self.cliente,
            itens=itens,
            diagnostico=self.diagnostico,
            # T-2087 / `R-IDT-09` — **sem estas duas linhas a identidade some no
            # caminho com aditivo**, que é o do PGM. É a `T-1420` de novo, com
            # outro campo: `aplicar` monta um `Contract` a partir de uma lista
            # fixa, e o que não entrar nela desaparece em silêncio.
            identidade=self.identidade,
            processo=self.processo,
            propostas=self.propostas
            + tuple(nome for aditivo in aditivos for nome in aditivo.propostas),
        )

    @property
    def identificacao(self) -> str:
        """`R-ADT-11` — as peças deste quantitativo, nomeadas para o rodapé.

        Com duas peças, nomear só a primeira afirmaria como origem um documento
        que não é a origem inteira. `PA-A e PA-B`, `PA-A, PA-B e PA-C`.
        """
        if len(self.propostas) <= 1:
            return self.proposta
        return f"{', '.join(self.propostas[:-1])} e {self.propostas[-1]}"

    def codigos_ignorados(self) -> set[str]:
        """Os códigos que os blocos de quantitativo desta peça tocam.

        T-1617 / ESPEC 022 `R-QTD-07` — **o nome ficou histórico.** Desde a
        ESPEC 022 os blocos `Aumento` e `Redução` são aplicados, e não ignorados;
        o que sobrevive é a pergunta *quais códigos esta peça movimenta por
        quantitativo*.

        Continua existindo por um consumidor só, e ele não é a `V-REC-01`:
        `V-ADT-04` a usa para detectar aumento ou redução de código que o
        consolidado não contém — sintoma de peça intermediária faltante ou de
        bloco rotulado errado.

        O antigo consumidor era o `explicados` da `V-REC-01` (`D-08` da ESPEC
        019), que saiu na T-1614. Removê-la junto teria derrubado a `V-ADT-04`,
        que nada tem a ver com aquela decisão.
        """
        return self.codigos_de(RotuloDeBloco.AUMENTO) | self.codigos_de(
            RotuloDeBloco.REDUCAO
        )

    def blocos_com(self, rotulo: RotuloDeBloco) -> tuple[BlocoDeItens, ...]:
        return tuple(bloco for bloco in self.blocos if bloco.rotulo == rotulo)

    def codigos_de(self, rotulo: RotuloDeBloco) -> set[str]:
        """Os códigos que os blocos deste rótulo trazem.

        É por aqui que a `D-08` vai saber quais códigos um bloco descartado tocou,
        e é o insumo de `R-ADT-04` e `R-ADT-05`.
        """
        return {
            codigo
            for bloco in self.blocos_com(rotulo)
            for codigo in bloco.codigos
        }

    @property
    def soma_dos_totais(self) -> Decimal:
        """Soma dos valores totais declarados linha a linha.

        Base do checksum (V-CTR-03). Somam-se os totais **declarados em cada
        linha**, não ``preço × quantidade × meses``: a fórmula varia por item —
        em HORA/HOMEM a quantidade já é o total do período e os meses não
        multiplicam, enquanto em serviços mensais multiplicam. Somar o que o
        documento afirma dispensa interpretar a regra de preço, que está fora
        do escopo do MVP, e ainda assim prova que nenhuma linha se perdeu.
        """
        return sum((item.total_declarado for item in self.itens), Decimal(0))

    def itens_de(self, codigo: str) -> list[ContractItem]:
        return [item for item in self.itens if item.codigo.valor == codigo]

    def quantidade_para(self, codigo: str, qualificador: str | None = None) -> Decimal | None:
        """Resolve a quantidade contratada de uma entrada do catálogo.

        Sem qualificador, **soma** todas as linhas daquele código —
        ``10.050.00001.00`` vale 300 + 4.000 + 480 = 4.780. Com qualificador,
        casa a linha cuja descrição o contenha, sem somar: ``14.025.00011.00``
        rende duas linhas de 1, ``IT0101`` e ``SG0721`` (ESPEC 001 R-CTR-02).

        A resolução vive aqui, e não no extrator, porque depende do catálogo:
        só ele sabe se um código deve ser somado ou desdobrado. O extrator não
        precisa adivinhar em tempo de leitura.
        """
        candidatos = self.itens_de(codigo)
        if not candidatos:
            return None

        if qualificador:
            alvo = qualificador.upper()
            candidatos = [i for i in candidatos if alvo in i.descricao.upper()]
            if not candidatos:
                return None

        return sum((item.quantidade for item in candidatos), Decimal(0))

    def descricao_para(self, codigo: str, qualificador: str | None = None) -> str | None:
        candidatos = self.itens_de(codigo)
        if qualificador:
            alvo = qualificador.upper()
            candidatos = [i for i in candidatos if alvo in i.descricao.upper()]
        return candidatos[0].descricao if candidatos else None

    @property
    def codigos(self) -> set[str]:
        return {item.codigo.valor for item in self.itens}

    def posicao_de(self, codigo: str) -> int | None:
        """T-1276 / `R-REL-03` — índice de primeira aparição na tabela de itens.

        É o que o contrato passa a fornecer ao relatório: **a ordem**, e não
        mais a quantidade (`D-05`). Devolve ``None`` para código que o contrato
        não traz — e é esse ``None`` que manda a linha para o bloco final.

        A ordem editorial do modelo GRC não é derivável de fonte nenhuma: ela
        diverge da do contrato em 299 pares de 55 códigos (ESPEC 018 §2.3). A do
        contrato é a única com dono, e torna o documento conferível linha a
        linha contra o instrumento que ele comprova.
        """
        for posicao, item in enumerate(self.itens):
            if item.codigo.valor == codigo:
                return posicao
        return None
