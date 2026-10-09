import { RECURSOS, RECURSOS_DO_VERAI } from '@/lib/integracao/feed'

import { escopoDeLeitura } from './autenticar'

// Documento OpenAPI 3.1 da API de plataforma do VerAI, gerado do catálogo de recursos — recurso novo
// aparece aqui sozinho. Servido em GET /api/v1/openapi.json (público: não traz dado nenhum).

export function documentoOpenApi(urlBase: string) {
  const registro = {
    type: 'object',
    required: ['id', 'hash', 'dados'],
    properties: {
      id: { type: 'string' },
      chaveCliente: { type: ['string', 'null'], description: 'Sigla do cliente normalizada (sem acento, maiúscula, só letras e números).' },
      chaveGerencia: { type: ['string', 'null'], description: 'Gerência normalizada ("GRC4", "KAM2").' },
      hash: { type: 'string', description: 'SHA-256 do JSON canônico de `dados` — mudou o hash, mudou o registro.' },
      dados: { type: 'object', additionalProperties: true },
    },
  }
  const erro = {
    type: 'object',
    properties: { erro: { type: 'object', properties: { codigo: { type: 'string' }, mensagem: { type: 'string' } } } },
  }
  const paths: Record<string, unknown> = {
    '/api/v1': {
      get: {
        summary: 'Descoberta: o aplicativo da chave e os recursos que ele pode ler',
        responses: { '200': { description: 'OK' }, '401': { description: 'Chave ausente ou inválida', content: { 'application/json': { schema: erro } } } },
      },
    },
    '/api/v1/acoes/localizar-contratos': {
      post: {
        summary: 'Resolve números de contrato escritos de qualquer jeito ("17/2025-SGM") para os contratos do VerAI',
        description: 'Escopo contratos:ler. Corpo: `{ "contratos": [{ "numero": "17/2025-SGM", "cliente": "SGM" }] }` (até 500).',
        responses: { '200': { description: 'Um resultado por número: encontrado | ambiguo | nenhum | ilegivel' } },
      },
    },
  }
  for (const recurso of RECURSOS) {
    const { rotulo, descricao } = RECURSOS_DO_VERAI[recurso]
    paths[`/api/v1/${recurso}`] = {
      get: {
        summary: `${rotulo} — lista`,
        description: `${descricao}\n\nEscopo: \`${escopoDeLeitura(recurso)}\`.`,
        parameters: [
          { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limite', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 } },
          { name: 'cliente', in: 'query', description: 'Sigla do cliente', schema: { type: 'string' } },
          { name: 'gerencia', in: 'query', description: 'Gerência ("GRC-4")', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Página do recurso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    objeto: { const: 'lista' },
                    recurso: { const: recurso },
                    hash: { type: 'string', description: 'Hash do conjunto inteiro — igual ao da última leitura = nada mudou.' },
                    total: { type: 'integer' },
                    pagina: { type: 'integer' },
                    paginas: { type: 'integer' },
                    limite: { type: 'integer' },
                    data: { type: 'array', items: registro },
                  },
                },
              },
            },
          },
          '403': { description: `Sem o escopo ${escopoDeLeitura(recurso)}`, content: { 'application/json': { schema: erro } } },
        },
      },
    }
    paths[`/api/v1/${recurso}/{id}`] = {
      get: {
        summary: `${rotulo} — um registro`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: '`{ objeto: "registro", recurso, data }`' }, '404': { description: 'Não existe' } },
      },
    }
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'VerAI — API de plataforma',
      version: '1',
      description:
        'Leitura dos dados comerciais do VerAI por outros sistemas. Cada sistema é um aplicativo cadastrado em /admin/api, com chave própria e escopos por recurso. Mudanças são avisadas por webhook assinado (X-Webhook-Assinatura: t=<unix>,v1=<HMAC-SHA256(segredo, "<t>.<corpo>")>); o aviso diz só QUAIS recursos mudaram — busque os dados pela API.',
    },
    servers: [{ url: urlBase }],
    security: [{ chave: [] }],
    components: { securitySchemes: { chave: { type: 'http', scheme: 'bearer', description: 'Chave do aplicativo (vrai_…)' } } },
    paths,
  }
}
