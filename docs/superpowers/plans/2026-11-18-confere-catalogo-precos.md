# Confere lê o catálogo de preços do VerAI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao Confere uma fonte de verdade sobre os códigos de catálogo da PRODAM (código → descrição →
grupo), lida automaticamente do VerAI, para avisar quando um código não existe no catálogo vigente ou quando
a letra de perfil usada não corresponde à descrição oficial.

**Architecture:** VerAI expõe o catálogo como mais um recurso da API de plataforma já existente
(`/api/v1/tabelaPrecos`, autenticação por `ApiApp`). O Confere (serviço Python separado) busca esse recurso por
HTTP com cache de 10 min em memória, e uma validação nova (`V-CAT-01`) cruza os códigos da medição com o
catálogo, só avisando — nunca bloqueando, nunca alterando quantidade ou classificação.

**Tech Stack:** TypeScript/Next.js + Prisma (VerAI), Python/httpx/pytest (Confere).

## Global Constraints

- A validação **nunca bloqueia e nunca altera** quantidade, classificação ou `perfil_ou_pacote` — só soma
  `ValidationReport.avisos` (Severity.AVISA).
- Catálogo vazio (`{}`) é **"indisponível"** (VerAI fora do ar, chave ausente) — a validação sai em silêncio,
  nunca gera achado "código ausente" por isso.
- Cache do catálogo no Confere: TTL de 10 min, timeout de rede de 3 s. Nenhuma biblioteca nova — `httpx` já é
  dependência (`pyproject.toml`).
- O recurso `tabelaPrecos` no VerAI usa `chaveCliente: null`, `chaveGerencia: null` (dado global, não por
  cliente) — mesmo padrão de `null` que o recurso `gerencias` já usa em `src/lib/integracao/feed.ts`.
- Nenhuma rota nova no VerAI: `/api/v1/<recurso>` já é genérica. Nenhum mecanismo de autenticação novo no
  Confere: reaproveita a `API de plataforma` (spec `2026-10-08-api-plataforma-design.md`).
- Spec de referência: `docs/superpowers/specs/2026-11-18-confere-catalogo-precos-design.md`.

---

### Task 1: VerAI — recurso `tabelaPrecos` na API de plataforma

**Files:**
- Modify: `src/lib/integracao/feed.ts` (dentro de `CARREGADORES` e de `RECURSOS_DO_VERAI`)
- Test: `src/lib/integracao/feed.test.ts` (novo)

**Interfaces:**
- Consumes: `prisma.tabelaPrecos.findFirst`, `prisma.itemTabelaPrecos.findMany` (Prisma Client já gerado;
  models em `prisma/schema.prisma:776-815`).
- Produces: recurso `tabelaPrecos` registrado em `CARREGADORES` e `RECURSOS_DO_VERAI`, consumível por
  `listarRecurso('tabelaPrecos', opcoes?, hoje?)` (assinatura já existente em `feed.ts`). Cada registro:
  `{ id: string, chaveCliente: null, chaveGerencia: null, dados: { codigo, descricao, grupo, secoes, unidade } }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/integracao/feed.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    tabelaPrecos: { findFirst: jest.fn() },
    itemTabelaPrecos: { findMany: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { listarRecurso } from './feed'

describe('recurso tabelaPrecos', () => {
  it('devolve um registro por item da versão vigente, sem chave de cliente/gerência', async () => {
    ;(prisma.tabelaPrecos.findFirst as jest.Mock).mockResolvedValue({ id: 'tab1' })
    ;(prisma.itemTabelaPrecos.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'item1',
        codigo: '14.046.00008.00',
        descricao: 'PLATAFORMA DE BANCO DE DADOS - POSTGRESQL - PERFIL A',
        grupo: 'E',
        secoes: 'E - PLATAFORMAS > E1. BANCO DE DADOS',
        unidade: 'PLATAFORMA/MÊS',
      },
    ])

    const lista = await listarRecurso('tabelaPrecos')

    expect(lista?.total).toBe(1)
    expect(lista?.registros[0]).toMatchObject({
      id: 'item1',
      chaveCliente: null,
      chaveGerencia: null,
      dados: {
        codigo: '14.046.00008.00',
        descricao: 'PLATAFORMA DE BANCO DE DADOS - POSTGRESQL - PERFIL A',
        grupo: 'E',
      },
    })
    expect(prisma.itemTabelaPrecos.findMany).toHaveBeenCalledWith({
      where: { tabelaId: 'tab1' },
      orderBy: { posicao: 'asc' },
    })
  })

  it('sem versão vigente, lista vazia (nunca erro)', async () => {
    ;(prisma.tabelaPrecos.findFirst as jest.Mock).mockResolvedValue(null)

    const lista = await listarRecurso('tabelaPrecos')

    expect(lista?.total).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/lib/integracao/feed.test.ts`
Expected: FAIL — `recurso_inexistente` / `listarRecurso('tabelaPrecos')` devolve `null` (`lista?.total` é
`undefined`), porque o recurso ainda não existe em `CARREGADORES`.

- [ ] **Step 3: Implementar o carregador e o rótulo**

Em `src/lib/integracao/feed.ts`, dentro do objeto `CARREGADORES` (depois do método `solicitacoes`, antes do
`}` que fecha o objeto, por volta da linha 330):

```ts
  async tabelaPrecos() {
    const tabela = await prisma.tabelaPrecos.findFirst({ orderBy: { ordem: 'desc' }, select: { id: true } })
    if (!tabela) return []
    const itens = await prisma.itemTabelaPrecos.findMany({ where: { tabelaId: tabela.id }, orderBy: { posicao: 'asc' } })
    return itens.map((i) => ({
      id: i.id,
      chaveCliente: null,
      chaveGerencia: null,
      dados: { codigo: i.codigo, descricao: i.descricao, grupo: i.grupo, secoes: i.secoes, unidade: i.unidade },
    }))
  },
```

E em `RECURSOS_DO_VERAI` (depois da linha de `solicitacoes`):

```ts
  tabelaPrecos: { rotulo: 'Tabela de preços', descricao: 'Catálogo de serviços da PRODAM: código, descrição, grupo e preço da versão vigente.' },
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/lib/integracao/feed.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/integracao/feed.ts src/lib/integracao/feed.test.ts
git commit -m "feat(api): expõe tabela de preços como recurso da API de plataforma"
```

---

### Task 2: Confere — cliente HTTP do catálogo (`CatalogoVerAI`)

**Files:**
- Create: `services/confere/backend/src/infrastructure/catalogo/verai_cliente.py`
- Test: `services/confere/backend/tests/test_verai_cliente.py`

**Interfaces:**
- Consumes: nada de outras tasks — módulo independente, só `httpx` (já em `pyproject.toml`) e env vars
  `VERAI_BASE_URL`, `VERAI_API_KEY`.
- Produces: `ItemCatalogo` (dataclass frozen: `codigo: str`, `descricao: str`, `grupo: str`) e
  `CatalogoVerAI` (classe com `obter(*, agora: float | None = None, cliente: httpx.Client | None = None) ->
  dict[str, ItemCatalogo]`), consumidos pela Task 3 (via dict) e pela Task 4 (via `CatalogoVerAI` em si).

- [ ] **Step 1: Escrever os testes que falham**

Criar `services/confere/backend/tests/test_verai_cliente.py`:

```python
from __future__ import annotations

import httpx
import pytest

from infrastructure.catalogo.verai_cliente import CatalogoVerAI


def _resposta_pagina(itens: list[dict], pagina: int, paginas: int) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "objeto": "lista",
            "recurso": "tabelaPrecos",
            "hash": "x",
            "total": len(itens),
            "pagina": pagina,
            "paginas": paginas,
            "limite": 1000,
            "data": [{"id": i["codigo"], "chaveCliente": None, "chaveGerencia": None, "dados": i} for i in itens],
        },
    )


def _item(codigo: str, descricao: str = "", grupo: str = "E") -> dict:
    return {"codigo": codigo, "descricao": descricao, "grupo": grupo}


@pytest.fixture(autouse=True)
def _configurado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VERAI_BASE_URL", "https://verai.teste")
    monkeypatch.setenv("VERAI_API_KEY", "vrai_teste")


def test_sem_configuracao_devolve_vazio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VERAI_BASE_URL", raising=False)
    monkeypatch.delenv("VERAI_API_KEY", raising=False)
    catalogo = CatalogoVerAI()

    assert catalogo.obter() == {}


def test_busca_e_concatena_paginas() -> None:
    chamadas: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        chamadas.append(request)
        pagina = int(request.url.params["pagina"])
        if pagina == 1:
            return _resposta_pagina([_item("14.046.00008.00", "PERFIL A")], 1, 2)
        return _resposta_pagina([_item("14.048.00010.00", "PERFIL A")], 2, 2)

    cliente = httpx.Client(transport=httpx.MockTransport(handler))
    catalogo = CatalogoVerAI()

    resultado = catalogo.obter(cliente=cliente)

    assert set(resultado) == {"14.046.00008.00", "14.048.00010.00"}
    assert resultado["14.046.00008.00"].descricao == "PERFIL A"
    assert len(chamadas) == 2
    assert chamadas[0].headers["authorization"] == "Bearer vrai_teste"


def test_cache_respeita_ttl() -> None:
    chamadas = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal chamadas
        chamadas += 1
        return _resposta_pagina([_item("14.046.00008.00")], 1, 1)

    cliente = httpx.Client(transport=httpx.MockTransport(handler))
    catalogo = CatalogoVerAI(ttl_s=600.0)

    catalogo.obter(agora=0.0, cliente=cliente)
    catalogo.obter(agora=500.0, cliente=cliente)

    assert chamadas == 1


def test_ttl_expirado_busca_de_novo() -> None:
    chamadas = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal chamadas
        chamadas += 1
        return _resposta_pagina([_item("14.046.00008.00")], 1, 1)

    cliente = httpx.Client(transport=httpx.MockTransport(handler))
    catalogo = CatalogoVerAI(ttl_s=600.0)

    catalogo.obter(agora=0.0, cliente=cliente)
    catalogo.obter(agora=601.0, cliente=cliente)

    assert chamadas == 2


def test_erro_http_sem_cache_anterior_devolve_vazio() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    cliente = httpx.Client(transport=httpx.MockTransport(handler))
    catalogo = CatalogoVerAI()

    assert catalogo.obter(cliente=cliente) == {}


def test_erro_http_mantem_cache_anterior() -> None:
    def handler_ok(request: httpx.Request) -> httpx.Response:
        return _resposta_pagina([_item("14.046.00008.00")], 1, 1)

    def handler_falha(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    catalogo = CatalogoVerAI(ttl_s=600.0)
    catalogo.obter(agora=0.0, cliente=httpx.Client(transport=httpx.MockTransport(handler_ok)))

    resultado = catalogo.obter(agora=601.0, cliente=httpx.Client(transport=httpx.MockTransport(handler_falha)))

    assert "14.046.00008.00" in resultado
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd services/confere/backend && uv run pytest tests/test_verai_cliente.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'infrastructure.catalogo'`

- [ ] **Step 3: Implementar `verai_cliente.py`**

```python
"""Catálogo de preços do VerAI, lido via API de plataforma.

Spec docs/superpowers/specs/2026-11-18-confere-catalogo-precos-design.md §3-4. Nunca derruba a
geração do relatório: configuração ausente, timeout, erro HTTP — tudo cai em cache vazio (ou no
que já havia), e quem usa (`infrastructure/validations/catalog_validations.py`) trata `{}` como
"catálogo indisponível", não como "catálogo sem item nenhum".
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import httpx

TTL_PADRAO_S = 600.0
TIMEOUT_PADRAO_S = 3.0


@dataclass(frozen=True)
class ItemCatalogo:
    codigo: str
    descricao: str
    grupo: str


class CatalogoVerAI:
    def __init__(self, ttl_s: float = TTL_PADRAO_S, timeout_s: float = TIMEOUT_PADRAO_S) -> None:
        self._ttl_s = ttl_s
        self._timeout_s = timeout_s
        self._cache: dict[str, ItemCatalogo] = {}
        self._cache_em: float | None = None

    def obter(
        self, *, agora: float | None = None, cliente: httpx.Client | None = None
    ) -> dict[str, ItemCatalogo]:
        """O catálogo vigente, código → item. `agora`/`cliente` existem para o teste controlar
        o relógio e a rede; em produção os dois ficam no padrão (relógio real, cliente novo)."""
        momento = agora if agora is not None else time.monotonic()
        if self._cache_em is not None and momento - self._cache_em < self._ttl_s:
            return self._cache

        base_url = os.getenv("VERAI_BASE_URL")
        chave = os.getenv("VERAI_API_KEY")
        if not base_url or not chave:
            return self._cache

        proprio = cliente is None
        http = cliente or httpx.Client(timeout=self._timeout_s)
        try:
            self._cache = self._buscar_tudo(http, base_url.rstrip("/"), chave)
            self._cache_em = momento
        except (httpx.HTTPError, KeyError, ValueError, TypeError):
            pass
        finally:
            if proprio:
                http.close()

        return self._cache

    def _buscar_tudo(self, http: httpx.Client, base_url: str, chave: str) -> dict[str, ItemCatalogo]:
        itens: dict[str, ItemCatalogo] = {}
        pagina = 1
        while True:
            resposta = http.get(
                f"{base_url}/api/v1/tabelaPrecos",
                params={"pagina": pagina, "limite": 1000},
                headers={"Authorization": f"Bearer {chave}"},
                timeout=self._timeout_s,
            )
            resposta.raise_for_status()
            corpo = resposta.json()
            for registro in corpo["data"]:
                dados = registro["dados"]
                itens[dados["codigo"]] = ItemCatalogo(
                    codigo=dados["codigo"], descricao=dados["descricao"], grupo=dados["grupo"]
                )
            if pagina >= corpo["paginas"]:
                break
            pagina += 1
        return itens
```

Criar também `services/confere/backend/src/infrastructure/catalogo/__init__.py` **vazio** — todo subpacote
de `infrastructure` tem um (`annex`, `contract`, `di`, `measurement`, `report`, `shared`, `validations`),
e este segue o mesmo padrão.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd services/confere/backend && uv run pytest tests/test_verai_cliente.py -v`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add services/confere/backend/src/infrastructure/catalogo/ services/confere/backend/tests/test_verai_cliente.py
git commit -m "feat(confere): cliente do catálogo de preços do VerAI, com cache de 10 min"
```

---

### Task 3: Confere — validação `V-CAT-01`

**Files:**
- Create: `services/confere/backend/src/infrastructure/validations/catalog_validations.py`
- Test: `services/confere/backend/tests/test_catalog_validations.py`

**Interfaces:**
- Consumes: `ItemCatalogo` da Task 2 (`infrastructure.catalogo.verai_cliente.ItemCatalogo`); `Measurement`
  (`domain.entities.measurement`, já existente: `codigos_em_ordem: list[str]`, `item_para(codigo: str) ->
  MeasurementItem | None`); `MeasurementItem.contratada_texto`/`medida_texto` (já existentes);
  `ValidationReport.registrar(validacao, severidade, mensagem, codigo=None)` e `Severity` (já existentes em
  `domain.entities.validation_finding`).
- Produces: `v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao: Measurement, achados:
  ValidationReport, catalogo: Mapping[str, ItemCatalogo]) -> None`, consumida pela Task 4.

- [ ] **Step 1: Escrever os testes que falham**

Criar `services/confere/backend/tests/test_catalog_validations.py`:

```python
from __future__ import annotations

from domain.entities.measurement import Measurement
from domain.entities.measurement_item import MeasurementItem
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.service_code import ServiceCode
from infrastructure.catalogo.verai_cliente import ItemCatalogo
from infrastructure.validations.catalog_validations import (
    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente,
)


def _item(codigo: str, contratada: str = "", medida: str = "") -> MeasurementItem:
    return MeasurementItem(
        codigo=ServiceCode(codigo),
        descricao="",
        bloco_titulo="",
        medida_texto=medida,
        contratada_texto=contratada,
        linha=1,
    )


def _catalogo(*itens: ItemCatalogo) -> dict[str, ItemCatalogo]:
    return {i.codigo: i for i in itens}


def test_catalogo_vazio_nao_gera_achado() -> None:
    medicao = Measurement(itens=[_item("14.999.00000.00")])
    achados = ValidationReport()

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo={})

    assert achados.achados == []


def test_codigo_fora_do_catalogo_gera_aviso() -> None:
    medicao = Measurement(itens=[_item("14.999.00000.00")])
    achados = ValidationReport()
    catalogo = _catalogo(
        ItemCatalogo(codigo="14.046.00008.00", descricao="PLATAFORMA POSTGRESQL - PERFIL A", grupo="E")
    )

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo)

    assert len(achados.avisos) == 1
    assert achados.avisos[0].codigo == "14.999.00000.00"
    assert "não encontrado na tabela de preços" in achados.avisos[0].mensagem


def test_codigo_no_catalogo_sem_letra_nao_gera_achado() -> None:
    medicao = Measurement(itens=[_item("14.046.00008.00", contratada="10", medida="8")])
    achados = ValidationReport()
    catalogo = _catalogo(
        ItemCatalogo(codigo="14.046.00008.00", descricao="MPLS - 8 Mbps", grupo="C")
    )

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo)

    assert achados.achados == []


def test_perfil_coerente_com_catalogo_nao_gera_achado() -> None:
    medicao = Measurement(itens=[_item("14.046.00008.00", contratada="A", medida="A")])
    achados = ValidationReport()
    catalogo = _catalogo(
        ItemCatalogo(codigo="14.046.00008.00", descricao="PLATAFORMA POSTGRESQL - PERFIL A", grupo="E")
    )

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo)

    assert achados.achados == []


def test_perfil_incoerente_com_descricao_oficial_gera_aviso() -> None:
    """O caso do e-mail: `14.048.00010.00` contratado perfil A, catálogo diz outro perfil."""
    medicao = Measurement(itens=[_item("14.048.00010.00", contratada="A", medida="-")])
    achados = ValidationReport()
    catalogo = _catalogo(
        ItemCatalogo(codigo="14.048.00010.00", descricao="PLATAFORMA SQL SERVER - PERFIL B", grupo="E")
    )

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo)

    assert len(achados.avisos) == 1
    assert "perfil A" in achados.avisos[0].mensagem
    assert achados.avisos[0].codigo == "14.048.00010.00"
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd services/confere/backend && uv run pytest tests/test_catalog_validations.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'infrastructure.validations.catalog_validations'`

- [ ] **Step 3: Implementar `catalog_validations.py`**

```python
"""V-CAT-01: código e perfil contra o catálogo de preços do VerAI.

Spec docs/superpowers/specs/2026-11-18-confere-catalogo-precos-design.md §5. Só avisa — nunca
bloqueia, nunca altera quantidade, classificação ou `perfil_ou_pacote` de linha nenhuma.
"""

from __future__ import annotations

import re
from collections.abc import Mapping

from domain.entities.measurement import Measurement
from domain.entities.validation_finding import Severity, ValidationReport
from infrastructure.catalogo.verai_cliente import ItemCatalogo

_LETRA_DE_PERFIL = re.compile(r"^[A-Z]$")
_PERFIL_NA_DESCRICAO = re.compile(r"PERFIL\s+([A-E])\b", re.IGNORECASE)


def _letra(texto: str) -> str | None:
    limpo = texto.strip().upper()
    return limpo if _LETRA_DE_PERFIL.fullmatch(limpo) else None


def v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(
    medicao: Measurement,
    achados: ValidationReport,
    catalogo: Mapping[str, ItemCatalogo],
) -> None:
    """Código ausente do catálogo vigente, ou perfil que a descrição oficial não confirma.

    `catalogo` vazio é "catálogo indisponível" (VerAI fora do ar, chave não configurada) — a
    validação sai em silêncio, porque ausência de dado não é evidência de problema.
    """
    if not catalogo:
        return

    for codigo in medicao.codigos_em_ordem:
        item_catalogo = catalogo.get(codigo)
        if item_catalogo is None:
            achados.registrar(
                "V-CAT-01",
                Severity.AVISA,
                f"código {codigo} não encontrado na tabela de preços vigente — "
                "confira se não foi descontinuado ou digitado errado.",
                codigo=codigo,
            )
            continue

        item = medicao.item_para(codigo)
        if item is None:  # pragma: no cover — código veio da própria medição
            continue

        letra = _letra(item.contratada_texto) or _letra(item.medida_texto)
        if letra is None:
            continue

        achado_perfil = _PERFIL_NA_DESCRICAO.search(item_catalogo.descricao)
        if achado_perfil is None or achado_perfil.group(1).upper() != letra:
            achados.registrar(
                "V-CAT-01",
                Severity.AVISA,
                f"perfil {letra} do código {codigo} não corresponde à descrição "
                f'oficial do catálogo: "{item_catalogo.descricao}".',
                codigo=codigo,
            )
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd services/confere/backend && uv run pytest tests/test_catalog_validations.py -v`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add services/confere/backend/src/infrastructure/validations/catalog_validations.py services/confere/backend/tests/test_catalog_validations.py
git commit -m "feat(confere): V-CAT-01 avisa código fora do catálogo ou perfil incoerente"
```

---

### Task 4: Confere — wiring no `DIContainer`

**Files:**
- Modify: `services/confere/backend/src/infrastructure/di/container.py`
- Test: `services/confere/backend/tests/test_container_catalogo.py` (novo)

**Interfaces:**
- Consumes: `CatalogoVerAI` (Task 2), `v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente` (Task 3),
  `DIContainer._obter(nome, fabrica)` (já existente, linha 103).
- Produces: `DIContainer.catalogo_verai() -> CatalogoVerAI` (singleton), chamado dentro de
  `DIContainer.gerar()`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `services/confere/backend/tests/test_container_catalogo.py`:

```python
from __future__ import annotations

import pytest

from infrastructure.catalogo.verai_cliente import CatalogoVerAI
from infrastructure.di.container import DIContainer


def test_catalogo_verai_e_singleton() -> None:
    container = DIContainer()

    assert container.catalogo_verai() is container.catalogo_verai()
    assert isinstance(container.catalogo_verai(), CatalogoVerAI)


def test_sem_configuracao_obter_devolve_vazio_sem_excecao(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VERAI_BASE_URL", raising=False)
    monkeypatch.delenv("VERAI_API_KEY", raising=False)
    container = DIContainer()

    assert container.catalogo_verai().obter() == {}
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd services/confere/backend && uv run pytest tests/test_container_catalogo.py -v`
Expected: FAIL — `AttributeError: 'DIContainer' object has no attribute 'catalogo_verai'`

- [ ] **Step 3: Adicionar o import, o getter e a chamada**

Em `services/confere/backend/src/infrastructure/di/container.py`, depois do bloco de import de
`reconciliation_validations` (por volta da linha 61):

```python
from infrastructure.catalogo.verai_cliente import CatalogoVerAI
from infrastructure.validations.catalog_validations import (
    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente,
)
```

Depois do método `leitor_de_anexos` (por volta da linha 117):

```python
    def catalogo_verai(self) -> CatalogoVerAI:
        return self._obter("catalogo_verai", CatalogoVerAI)
```

Dentro de `gerar()`, logo depois da chamada a `v_ctr_05_codigo_contratado_ausente_da_aba` (por volta da
linha 331 — continua **dentro** do `if medicao.itens:`, no mesmo nível de indentação do `if not
_sob_pergunta_de_identidade(achados):` que a antecede):

```python
            v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(
                medicao, achados, self.catalogo_verai().obter()
            )
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd services/confere/backend && uv run pytest tests/test_container_catalogo.py -v`
Expected: PASS (2 testes)

- [ ] **Step 5: Rodar a suíte inteira que já roda no Windows (as de `resource` ficam de fora, são do Linux do Render)**

Run: `cd services/confere/backend && uv run pytest tests/ -q --ignore=tests/test_api_e2e.py --ignore=tests/test_divergencia_de_fonte.py --ignore=tests/test_jobs.py --ignore=tests/test_memoria.py --ignore=tests/test_pdf_sem_texto.py --ignore=tests/test_responsividade.py --ignore=tests/test_segredo_compartilhado.py`
Expected: PASS — nenhum teste de `test_reconciliation.py` (que roda `DIContainer().gerar()` em arquivos
reais, sem `VERAI_BASE_URL`/`VERAI_API_KEY` configurados no ambiente de teste) quebra, porque sem
configuração `catalogo_verai().obter()` devolve `{}` e `V-CAT-01` sai em silêncio.

- [ ] **Step 6: Commit**

```bash
git add services/confere/backend/src/infrastructure/di/container.py services/confere/backend/tests/test_container_catalogo.py
git commit -m "feat(confere): liga V-CAT-01 ao fluxo de geração do relatório"
```

---

### Task 5: Credencial e variáveis de ambiente (sem código — ações no painel)

**Por que é uma task própria:** sem isto, as Tasks 1-4 funcionam em teste mas o Confere em produção nunca
tem `VERAI_BASE_URL`/`VERAI_API_KEY` configurados — `catalogo_verai().obter()` sempre devolve `{}` e
`V-CAT-01` nunca aparece de verdade. É o único passo manual de todo o design (seção 3 da spec); feito uma
vez, o resto já é automático.

- [ ] **Step 1: Criar o `ApiApp` no VerAI**

Em produção (`https://<domínio-do-verai>/admin/api`, aba Aplicativos): criar aplicativo "Confere", escopo
`tabelaPrecos:ler`. Copiar a chave `vrai_…` exibida — ela só aparece uma vez.

- [ ] **Step 2: Configurar o Render do `confere-backend`**

No painel do Render, serviço `confere-backend` → Environment: adicionar
- `VERAI_BASE_URL` = URL de produção do VerAI (`https://<domínio-do-verai>`, sem barra final)
- `VERAI_API_KEY` = a chave copiada no Step 1

Salvar — o Render reinicia o serviço com as novas variáveis (não é um deploy de código, não precisa de
push).

- [ ] **Step 3: Verificar**

```bash
curl -s https://confere-backend.onrender.com/health
```
Expected: `{"status":"ok"}` — confirma que o serviço voltou depois de aplicar as variáveis. A confirmação de
que `V-CAT-01` está ativo vem do próximo relatório gerado pela tela: um código fora do catálogo ou com
perfil incoerente agora aparece como aviso.

- [ ] **Step 4: Nenhum commit** — esta task não toca o repositório; é configuração de ambiente.
