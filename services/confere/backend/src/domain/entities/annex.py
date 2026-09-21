"""T-306 — Anexo de detalhamento (ESPEC 004).

Uma aba da planilha reduzida à sua **forma**: valores, formatação e mesclagens.
Nada aqui conhece o significado das colunas — as 19 abas vão de 3 a 22 colunas e
não têm semântica em comum. É justamente por isso que um anexo novo não exige
código: o que varia entre eles está na configuração e na própria planilha
(ESPEC 004 §7).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class Orientacao(StrEnum):
    """A orientação de página que o GRC usa para o anexo (ESPEC 004 §3)."""

    RETRATO = "retrato"
    PAISAGEM = "paisagem"


@dataclass(frozen=True, slots=True)
class CelulaAnexo:
    """Uma célula da aba, com o que a torna reconhecível na página impressa.

    Cor da fonte e borda não estavam na lista original de `R-ANX-06`, e são
    necessárias: os cabeçalhos das abas têm texto **branco** sobre fundo
    ``A52A2A``, e sem a cor sairiam pretos sobre vinho — ilegíveis. As bordas
    vêm da aba pelo mesmo motivo: as linhas em branco que separam blocos não
    têm grade, e desenhar uma criaria caixas vazias que o GRC não mostra.
    """

    texto: str = ""
    negrito: bool = False
    # Hexadecimal RRGGBB. `None` é ausência de preenchimento — distinta de
    # branco, que também é omitido na renderização por ser a cor do papel.
    preenchimento: str | None = None
    cor: str | None = None
    borda: bool = False
    # ESPEC 052 `R-ALN-01`/`R-ALN-02` — `"left"`, `"center"` ou `"right"`. Vem do
    # alinhamento explícito da célula na aba, ou — sem ele — do tipo do valor
    # original, reproduzindo o "Geral" do Excel (número e data à direita, texto
    # à esquerda).
    alinhamento: str = "left"


def _tem_conteudo(celula: CelulaAnexo) -> bool:
    """Texto ou preenchimento — **borda não conta** (ESPEC 014 `R-BRD-02`).

    É o mesmo critério que o leitor de aba usa para aparar as colunas do fim, e
    pela mesma razão medida lá: a borda sobrevive em coluna que o Excel não
    imprime. Uma faixa de cor sem texto, ao contrário, é conteúdo — é como as
    abas desenham seus cabeçalhos.
    """
    return bool(celula.texto or celula.preenchimento)


@dataclass(frozen=True, slots=True)
class FormaDoBloco:
    """O que uma faixa de linhas usa da grade do anexo (ESPEC 014).

    Uma aba tem tantas colunas quanto a sua maior tabela, e os blocos menores
    herdavam essa largura — em `Comunicação Dados` o preâmbulo saía com 16
    colunas a mais do que usa, todas emolduradas pela grade da tabela.
    """

    # Quantas colunas a tabela deste bloco tem. Sempre um prefixo da grade do
    # anexo: aparar pelo meio deslocaria as colunas seguintes e desfaria as
    # larguras medidas no GRC (`R-ANX-12`).
    colunas: int
    # As colunas sem conteúdo que sobraram **dentro** do prefixo. Ficam, com a
    # largura do GRC, e saem sem borda.
    colunas_vazias: frozenset[int]
    # Índices **absolutos** das linhas sem conteúdo. Elas ficam — são o respiro
    # entre os blocos da aba — e saem sem borda.
    linhas_vazias: frozenset[int]


@dataclass(frozen=True, slots=True)
class ImagemAnexo:
    """Uma figura colada na aba — não é célula, e por isso quase passou batido.

    O que parece um gráfico em `ServicosEmNuvem` é um **PNG** ancorado sobre a
    grade, guardado à parte no pacote da planilha. Um leitor de células não o
    enxerga: ele não está em lugar nenhum das linhas e colunas.
    """

    dados: bytes
    # Índice 0-based da linha sobre a qual a figura está ancorada. Pode ser
    # maior que o total de linhas: em `Internet` ela fica abaixo da tabela.
    linha: int
    largura_pt: float
    altura_pt: float


@dataclass(frozen=True, slots=True)
class Mesclagem:
    """Região mesclada, em índices 0-based e limites inclusivos."""

    linha: int
    coluna: int
    ate_linha: int
    ate_coluna: int

    @property
    def ancora(self) -> tuple[int, int]:
        """A célula que guarda o valor — o openpyxl deixa as outras vazias."""
        return (self.linha, self.coluna)

    def contem(self, linha: int, coluna: int) -> bool:
        return (
            self.linha <= linha <= self.ate_linha
            and self.coluna <= coluna <= self.ate_coluna
        )


@dataclass(frozen=True)
class Anexo:
    """Uma aba pronta para virar páginas do documento."""

    aba: str
    orientacao: Orientacao
    corpo: float
    # Índice 0-based da linha de cabeçalho de colunas. `None` quando a aba não
    # tem uma — o anexo sai sem repetição (`R-ANX-11`).
    linha_cabecalho: int | None = None
    # ESPEC 051 `R-SEG-01` — os índices 0-based dos cabeçalhos adicionais,
    # resolvidos na leitura como `linha_cabecalho` (ESPEC 037 `R-CAB-05`).
    # Vazio para os 17 anexos com uma única tabela de corpo.
    linhas_cabecalho_adicionais: tuple[int, ...] = ()
    linhas: tuple[tuple[CelulaAnexo, ...], ...] = ()
    mesclagens: tuple[Mesclagem, ...] = ()
    # Largura relativa de cada coluna na planilha. Usada quando a medição do
    # documento de referência não resolve o anexo.
    proporcoes: tuple[float, ...] = field(default=())
    # Geometria medida no GRC, em pontos. `larguras_pt` vazio significa medição
    # ambígua — vale a proporção da planilha, esticada até `largura_total_pt`.
    larguras_pt: tuple[float, ...] = field(default=())
    largura_total_pt: float | None = None
    altura_linha_pt: float | None = None
    imagens: tuple[ImagemAnexo, ...] = field(default=())

    @property
    def vazio(self) -> bool:
        """Nada que a página mostre — nem célula com conteúdo, nem figura.

        ESPEC 036 `R-VAZ-02`. Era `not self.linhas`, e essa pergunta deixava
        passar dois casos, os dois medidos contra o renderizador:

        * **aba com resquício de formatação** — `AbaReader._colunas_uteis` apara
          as colunas finais sem conteúdo e pode devolver zero; as linhas
          sobrevivem, vazias. O anexo não era `vazio`, e saía como uma tabela
          invisível numa página só dele — página em branco, sem sequer a frase;
        * **aba só com figura** — `blocos()` sempre soube emitir a figura
          ancorada, e o curto-circuito daqui a descartava. Era o único caso em
          que a página de "não trouxe conteúdo" apagava conteúdo de verdade.

        O critério é o de `_tem_conteudo` (ESPEC 014 `R-BRD-02`: texto ou
        preenchimento, **borda não conta**), aplicado ao anexo inteiro em vez de
        a uma faixa de linhas — o mesmo, e não um segundo (`D-02`).
        """
        if self.imagens:
            return False
        return not any(_tem_conteudo(celula) for linha in self.linhas for celula in linha)

    @property
    def total_colunas(self) -> int:
        return len(self.proporcoes) or max((len(linha) for linha in self.linhas), default=0)

    @property
    def larguras_medidas(self) -> tuple[float, ...]:
        """As larguras do GRC, se resolverem **todas** as colunas deste anexo.

        Uma medição com contagem diferente da aba não é aproveitável em parte:
        casar 3 fronteiras com 4 colunas exigiria adivinhar qual coluna ficou de
        fora, e o erro seria silencioso.
        """
        return self.larguras_pt if len(self.larguras_pt) == self.total_colunas else ()

    @property
    def cortes(self) -> tuple[int, ...]:
        """Onde o anexo se parte em segmentos — um por cabeçalho reconhecido.

        Existe por uma restrição do Word, não por gosto: **a repetição de
        cabeçalho só funciona nas primeiras linhas de uma tabela**. Em
        ``Usuários`` o cabeçalho é a 8ª linha da aba — antes dele vêm título,
        resumo e subtítulo —, e marcá-lo com ``w:tblHeader`` no meio de uma
        tabela única não produz efeito nenhum.

        Cortar a aba em tabelas resolve: cada segmento **começa** num
        cabeçalho, onde a marca vale (`R-ANX-11`).

        ESPEC 051 `R-SEG-02` a `R-SEG-06` generaliza o corte único da
        ESPEC 004 para mais de um: a âncora primária e as adicionais
        (`Servidores`, `ServidoresSemDesenv` — abas com uma segunda tabela de
        forma diferente empilhada) entram como candidatas, cada uma sujeita à
        mesma guarda de sempre — não corta quando o cabeçalho já é a primeira
        linha (nada a separar), nem quando uma mesclagem atravessaria o corte
        (partir uma região mesclada desalinharia os dois segmentos). O
        resultado sai ordenado e sem repetição: duas âncoras que resolvam na
        mesma linha colapsam num corte só (`R-SEG-06`).
        """
        candidatos: set[int] = {
            linha
            for linha in (self.linha_cabecalho, *self.linhas_cabecalho_adicionais)
            if linha is not None
        }
        return tuple(
            sorted(
                linha
                for linha in candidatos
                if linha > 0
                and not any(m.linha < linha <= m.ate_linha for m in self.mesclagens)
            )
        )

    # ── O que cada bloco usa da grade (ESPEC 014) ─────────────────────────────

    def forma_do_bloco(self, inicio: int, fim: int) -> FormaDoBloco:
        """Quantas colunas esta faixa de linhas usa, e o que nela está vazio.

        Perguntar isto por bloco, e não pela aba, é o que faz a tabela terminar
        onde o conteúdo dela termina — como a página do GRC (`R-BRD-01`).
        """
        usadas = self._colunas_com_conteudo(inicio, fim)
        # Uma faixa só de linhas em branco não usa coluna nenhuma. Ela continua
        # saindo, com a altura do GRC, porque é o respiro entre dois blocos;
        # uma coluna basta para carregar as fileiras, e nada nelas é desenhado.
        colunas = (max(usadas) + 1) if usadas else 1

        return FormaDoBloco(
            colunas=colunas,
            colunas_vazias=frozenset(set(range(colunas)) - usadas),
            linhas_vazias=frozenset(
                indice
                for indice in range(inicio, min(fim, len(self.linhas)))
                if not any(_tem_conteudo(celula) for celula in self.linhas[indice])
            ),
        )

    def _colunas_com_conteudo(self, inicio: int, fim: int) -> set[int]:
        """As colunas que a faixa usa, **contando a cobertura das mesclagens**.

        A cobertura é o detalhe que decide a regra, e não é visível olhando
        célula a célula: o ``openpyxl`` guarda o valor só na âncora e deixa
        vazias as demais células da região. Uma faixa de título mesclada de
        ponta a ponta parece, então, uma coluna com texto seguida de colunas
        vazias — e aparar por essa leitura encolheria o cabeçalho de **8 dos 19
        anexos** para um terço da largura (ESPEC 014 §2.4).
        """
        usadas = {
            coluna
            for linha in self.linhas[inicio:fim]
            for coluna, celula in enumerate(linha)
            if _tem_conteudo(celula)
        }

        ultima = self.total_colunas - 1
        for mesclagem in self.mesclagens:
            if mesclagem.linha < inicio or mesclagem.ate_linha >= fim:
                continue
            ancora = self.linhas[mesclagem.linha]
            if mesclagem.coluna >= len(ancora):
                continue
            if not _tem_conteudo(ancora[mesclagem.coluna]):
                continue
            usadas.update(range(mesclagem.coluna, min(mesclagem.ate_coluna, ultima) + 1))
        return usadas

    # ── A ordem em que o anexo sai ────────────────────────────────────────────

    def blocos(self) -> list[tuple[int, int, ImagemAnexo | None]]:
        """Faixas de linhas e figuras, na ordem do documento.

        Uma figura ancorada **sobre linhas vazias toma o lugar delas**. Não é
        licença: no Excel a figura flutua por cima da grade, e aquelas linhas
        existem justamente para abrir espaço — em `ServicosEmNuvem` são as
        linhas 6 a 18, todas vazias, e o GRC mostra o gráfico ali. Mantê-las
        empurraria a figura 6 cm para baixo e deixaria um vão em branco.

        Figura ancorada depois do fim da aba sai no fim, que é onde ela está —
        o caso de `Internet`.
        """
        saida: list[tuple[int, int, ImagemAnexo | None]] = []
        ordenadas = sorted(self.imagens, key=lambda i: i.linha)
        cursor = 0

        for imagem in ordenadas:
            if imagem.linha >= len(self.linhas) or imagem.linha < cursor:
                continue
            if imagem.linha > cursor:
                saida.append((cursor, imagem.linha, None))
            saida.append((imagem.linha, imagem.linha, imagem))
            cursor = self._fim_da_faixa_vazia(imagem.linha)

        if cursor < len(self.linhas):
            saida.append((cursor, len(self.linhas), None))

        saida.extend(
            (0, 0, imagem) for imagem in ordenadas if imagem.linha >= len(self.linhas)
        )
        return saida

    def _fim_da_faixa_vazia(self, inicio: int) -> int:
        """Até onde vai a sequência de linhas em branco a partir de `inicio`.

        Devolve o próprio `inicio` quando a linha tem conteúdo: aí a figura
        flutua sobre dados, e engolir a linha apagaria o que ela mostra.
        """
        fim = inicio
        while fim < len(self.linhas) and not any(
            _tem_conteudo(celula) for celula in self.linhas[fim]
        ):
            fim += 1
        return fim
