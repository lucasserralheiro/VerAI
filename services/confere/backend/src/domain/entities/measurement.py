"""Agregado da medição — resultado da leitura da aba `Levantamento`."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from domain.entities.measurement_item import MARCA_SEM_DESENVOLVIMENTO, MeasurementItem


@dataclass(frozen=True)
class DiagnosticoDaAba:
    """ESPEC 027 `R-LEV-05` — o que a leitura da aba `Levantamento` observou.

    Existe para que `V-MED-01` deixe de dizer apenas *"o layout pode ter
    mudado"*. Com estes três campos, a causa distingue aba vazia de coluna
    deslocada de arquivo sem código nenhum — sem abrir a planilha de novo.

    Espelha o `DiagnosticoDaGrade` do contrato (ESPEC 017 `R-GRD-07`), do
    outro lado do formulário.
    """

    linhas_preenchidas: int
    colunas_lidas: int
    #: Coluna 1-based -> quantos códigos de serviço ela traz, na linha inteira.
    codigos_por_coluna: dict[int, int]


@dataclass(frozen=True)
class ApuracaoDescontada:
    """ESPEC 031 `R-APU-01` — um bloco descontado, e os códigos que ele lista.

    Guarda o **título** ao lado dos códigos porque os dois consumidores precisam
    de metades diferentes: a `R-APU-03` pergunta *"este código está aqui?"* e o
    registro de `R-APU-08` pergunta *"como se chama o bloco onde ele não está?"*.
    Mantê-los juntos evita que a segunda resposta seja remontada por concatenação.
    """

    titulo: str
    codigos: frozenset[str]


@dataclass
class Measurement:
    data_levantamento: date | None = None
    contrato_referencia: str = ""
    # Título do relatório, lido da primeira linha da aba. Compor o texto a
    # partir do contrato produziria "COMPROVAÇÃO TC 52/SMIT/2024" onde o
    # modelo traz "COMPROVAÇÃO SMIT SUSTENTAÇÃO" — o nome do serviço não é
    # dedutível do número do contrato.
    titulo: str = ""
    itens: list[MeasurementItem] = field(default_factory=list)
    # ESPEC 027 `R-LEV-05` — só preenchido quando `itens` sai vazio (`R-LEV-06`).
    # Por último e com padrão, pela mesma razão do `diagnostico` do `Contract`:
    # dezenas de construções parciais nos testes quebrariam com campo
    # obrigatório.
    diagnostico: DiagnosticoDaAba | None = None

    def itens_de(self, codigo: str) -> list[MeasurementItem]:
        return [item for item in self.itens if item.codigo.valor == codigo]

    def item_para(self, codigo: str) -> MeasurementItem | None:
        """Resolve qual ocorrência do código vale para o relatório.

        A planilha traz o mesmo código duas vezes quando existe a variante que
        desconta recursos de desenvolvimento — E1.1 aparece como "total de
        recursos" e como "descontando", e a SAN idem. **A variante descontada
        sempre prevalece** (ESPEC 001 R-MED-02), que é o que o relatório modelo
        exibe.

        Havendo mais de uma ocorrência sem que nenhuma seja a descontada, vale a
        última lida: a planilha lista refinamentos abaixo do valor bruto.
        """
        candidatos = self.itens_de(codigo)
        if not candidatos:
            return None

        descontados = [item for item in candidatos if item.desconta_desenvolvimento]
        return descontados[-1] if descontados else candidatos[-1]

    def contratada_para(self, codigo: str) -> Decimal | None:
        """A quantidade contratada declarada para o código, onde quer que esteja.

        **Não sai de `item_para`.** Aquele resolve qual ocorrência vale para a
        *medição* — a variante que desconta desenvolvimento (`R-MED-02`) —, e
        essa variante costuma trazer a coluna `Quantidade Contratada` **vazia**:
        é o caso do `14.024.00005.00` nos dois pares reais, onde o total
        contratado está na ocorrência primária e só o medido está na descontada.

        Ler a contratada de `item_para` produziria `0` onde a planilha afirma
        3.500 — e um item conforme viraria *consumo sem cobertura* na análise.

        A quantidade contratada é atributo do **código**, não da variante de
        apuração: vale a primeira ocorrência que a declare.
        """
        for item in self.itens_de(codigo):
            if item.contratada is not None:
                return item.contratada
        return None

    # ── ESPEC 031 · a apuração descontada vale pela seção inteira ─────────────

    def _apuracoes_descontadas(self) -> dict[str, ApuracaoDescontada]:
        """`R-APU-01` — título do bloco bruto → códigos da apuração que o refaz.

        Um bloco é *apuração descontada* quando o **título** carrega a marca. O
        bruto que ele restabelece é aquele cujo título é igual ao dele removidos
        a marca e o separador que a precede. Casa exato nos quatro blocos
        descontados dos dois pares reais — os dois `E1.1` e os dois
        `TOTAIS VCPU e VRAM` —, sem sobra e sem ambiguidade.

        **Por título, e não por posição** (`D-02`). No piloto, `TOTAIS VCPU e
        VRAM` fica **entre** o bloco bruto de `E1.1` (L53-63) e o descontado dele
        (L71-80): parear com o anterior zeraria os códigos da seção errada. É a
        mesma decisão da ESPEC 018 `D-09` — a marca decide, não a posição —, um
        nível acima.

        **Nem por interseção de códigos.** *"O bruto é o que contém os códigos do
        descontado"* funciona nos dois arquivos de hoje e falha justamente quando
        a diferença é grande, que é o caso que esta regra existe para tratar.

        Título que não pareia **não entra no mapa**, e a leitura fica exatamente
        como era (`R-APU-05`). Quem transforma isso em achado é a `V-MED-04`;
        deixá-lo em silêncio seria reinstalar o defeito de ESPEC 018 §2.8, em que
        uma regra ficou inerte em produção sem que nada acusasse.
        """
        por_titulo: dict[str, set[str]] = {}
        for item in self.itens:
            por_titulo.setdefault(item.bloco_titulo, set()).add(item.codigo.valor)

        pares: dict[str, ApuracaoDescontada] = {}
        for titulo, codigos in por_titulo.items():
            bruto = _sem_a_marca(titulo)
            if bruto != titulo and bruto in por_titulo:
                pares[bruto] = ApuracaoDescontada(titulo=titulo, codigos=frozenset(codigos))
        return pares

    def blocos_descontados_sem_par(self) -> list[str]:
        """`R-APU-05` — os blocos com a marca no título que não acharam o bruto.

        Vazio nos dois pares reais, e é assim que tem de ser. Não sendo, a
        `R-APU-03` está inerte naquela seção — e é a `V-MED-04` que transforma
        isso em achado.

        O crivo mora aqui, e não na validação, porque *"este bloco pareia"* é
        fato sobre a planilha. A infraestrutura relata; ela não decide o que
        conta como par, e nem precisa conhecer a cirurgia de título que a
        `R-APU-01` faz.
        """
        pareados = {a.titulo for a in self._apuracoes_descontadas().values()}
        return [
            titulo
            for titulo in dict.fromkeys(item.bloco_titulo for item in self.itens)
            if MARCA_SEM_DESENVOLVIMENTO in titulo.upper() and titulo not in pareados
        ]

    def apuracao_descontada_de(self, bloco_bruto: str) -> str | None:
        """`R-APU-08` — o título da apuração que restabelece este bloco bruto.

        Existe para o registro de conferência poder nomear **os dois blocos**: de
        onde a linha veio e onde ela não está. Sem isto, quem chama teria de
        remontar o título concatenando a marca — inventando uma cadeia em vez de
        ler a que a planilha traz, e errando na primeira grafia diferente.
        """
        apuracao = self._apuracoes_descontadas().get(bloco_bruto)
        return apuracao.titulo if apuracao else None

    def omitido_da_apuracao_descontada(self, codigo: str) -> MeasurementItem | None:
        """`R-APU-03` — a ocorrência bruta que a apuração descontada não repete.

        O bloco descontado restabelece a seção **inteira**: código que ele omite
        mediu zero depois do desconto. Quem monta a planilha expressa esse zero
        **apagando a linha**, não escrevendo `0` — e era esse silêncio que
        `item_para` lia como *"não há variante"*, devolvendo a quantidade bruta.

        Devolve a ocorrência **bruta e intacta**, e não um item com a medida
        trocada nem um booleano (`D-03`):

        * *intacta*, porque `medida_texto` guarda o que a célula tem, e é ele que
          o `LinhaZerada` mostra a quem confere (`R-PER-02`, `R-APU-08`).
          Reescrevê-lo aqui faria o registro de conferência exibir o que o sistema
          inventou em lugar do que a planilha diz;
        * *a ocorrência*, e não `True`, porque quem chama precisa da linha na aba
          e do título do bloco para montar aquele registro.

        Quem converte para zero é a **emissão**, no caso de uso. Esta é a
        resolução, e a resposta dela é *"nenhuma ocorrência vale — e aqui está a
        que existe"*.

        Três condições, e as três (ESPEC 031 §2.5). A guarda é falsa para 118 dos
        120 códigos dos dois pares:

        1. o código não tem **nenhuma** ocorrência com a marca — tendo, a
           `R-MED-02` resolve e este caminho não é consultado;
        2. alguma ocorrência dele está em bloco que **pareia**;
        3. o código está **ausente** dos códigos daquela apuração.

        A quarta exigência é sobre a célula, não sobre o código: medida **não
        numérica** não é zerada (`R-APU-07`). `PACOTE` ausente da apuração
        descontada continua caindo na `R-REL-08` e saindo `1 / 1` — um pacote não
        é recurso de desenvolvimento contável, e **nenhum arquivo real acusaria**
        a falta desta guarda.
        """
        ocorrencias = self.itens_de(codigo)
        if not ocorrencias:
            return None
        if any(item.desconta_desenvolvimento for item in ocorrencias):
            return None

        apuracoes = self._apuracoes_descontadas()
        for item in ocorrencias:
            apuracao = apuracoes.get(item.bloco_titulo)
            if apuracao is not None and codigo not in apuracao.codigos and item.e_numerica:
                return item
        return None

    @property
    def codigos(self) -> set[str]:
        return {item.codigo.valor for item in self.itens}

    @property
    def codigos_em_ordem(self) -> list[str]:
        """T-1271 / `R-REL-01` — os códigos distintos, na ordem da aba.

        O universo do relatório passa a ser a aba `Levantamento` (ESPEC 018
        `D-03`): ela **contém** o contrato nos dois pares reais, e traz os
        códigos que só ela conhece.

        Ordem de aparição, e não ordenada: é ela que vale para o bloco final,
        onde não há posição no contrato de onde herdar (`R-REL-03`).
        """
        vistos: list[str] = []
        for item in self.itens:
            if item.codigo.valor not in vistos:
                vistos.append(item.codigo.valor)
        return vistos


def _sem_a_marca(titulo: str) -> str:
    """O título de um bloco descontado, sem a marca e sem o separador dela.

    `'E1.1 - … - TOTAL DE RECURSOS - DESCONTANDO RECURSOS DE DESENVOLVIMENTO'`
    rende `'E1.1 - … - TOTAL DE RECURSOS'`, que é o título do bloco bruto,
    caractere por caractere, nos quatro casos reais.

    Título sem a marca volta **inalterado**, e é o que faz `_apuracoes_descontadas`
    distinguir os dois: par exige que o resultado seja diferente da entrada.

    O `rstrip` dos travessões cobre as três grafias — hífen, meia-risca e
    travessão —, porque a fonte é uma planilha editada à mão e nenhuma delas foi
    escolhida por ninguém.
    """
    indice = titulo.upper().find(MARCA_SEM_DESENVOLVIMENTO)
    if indice < 0:
        return titulo
    return titulo[:indice].rstrip().rstrip("-–—").rstrip()
