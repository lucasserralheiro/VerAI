# Envio da Proposta Comercial pelo R2 — design

**Data:** 28/09/2026 · **Pedido:** "Vercel Blob: This store has been suspended." ao enviar arquivo em
Proposta Comercial → Nova conversão (produção e dev).

## Andamento (28/09/2026)

- ✅ Dev: link de envio, conversão só com o temporário, original e exclusão no R2, tela nova. Visto
  no Chrome do usuário (localhost:3000): PDF de 214 KB e outro de 84 KB subiram direto pro R2,
  conversão ok, originais em `propostas-comerciais/<id>/{0,1}/original.pdf`, conferência de totais
  lendo do R2 (251 totais). Prova no R2 real: o link grava; tamanho ou tipo diferente do assinado →
  403 `SignatureDoesNotMatch`.
- ✅ CORS configurado no painel da Cloudflare (bucket `verai-documentos`, 28/09): PUT, `content-type`,
  origens `https://verai-virid.vercel.app`, `http://localhost:3000`, `http://localhost:3001`.
- Commits: `7abc592` (r2), `ea958b8` (rota do link), mais o da tela. `route.ts`, `[id]/route.ts` e
  testes estão misturados com o "Converter em Markdown" (outra sessão, não commitado) e vão no commit
  combinado com o usuário.
- ⏳ Produção: hotfix (§7), só com autorização.

## 1. Problema

A tela "Nova conversão" (`src/app/propostas-comerciais/novo/page.tsx`) sobe cada arquivo **do
navegador direto pro Vercel Blob** (`upload()` do `@vercel/blob/client`, token de
`/api/propostas-comerciais/upload-token`) e manda só a URL pra `POST /api/propostas-comerciais`, que
baixa, copia pro caminho final (Blob de novo) e converte. O upload direto existe porque a função da
Vercel recusa corpo acima de 4,5 MB (413). O store do Blob está suspenso por cota desde 24/09 (dev e
produção usam o mesmo), então o primeiro passo já falha. Decisão do usuário (25/09): uploads vão pro
Cloudflare R2.

## 2. Solução

Mesmo desenho em dois passos, trocando o destino:

1. O navegador pede um **link de envio** a `POST /api/propostas-comerciais/envio`
   (`{ nome, tamanhoBytes }`). A rota confere login, extensão aceita (pdf/xlsx/csv/docx) e tamanho
   (até 50 MB, o mesmo teto do token antigo) e devolve `{ url, endereco, contentType }`:
   - `url`: PUT pré-assinado (AWS SigV4 por query string, **15 min**) pra
     `tmp-uploads/<uuid>.<ext>` no bucket R2 — assinando `content-type` e `content-length`, então o
     navegador só consegue mandar aquele tipo e aquele tamanho;
   - `endereco`: `r2:tmp-uploads/<uuid>.<ext>` (o formato que o `storage.ts` já lê e apaga).
2. O navegador faz o PUT direto no R2 e manda `{ nomeArquivo, url: endereco, tamanhoBytes }` pro
   `POST /api/propostas-comerciais`, como antes.
3. A rota de conversão **só aceita** endereço `r2:tmp-uploads/<uuid>.<ext>` vindo do navegador
   (ver §3), baixa do R2, grava o original em `propostas-comerciais/<id>/<indice>/original.<ext>` (R2,
   ao lado das imagens que a conversão já grava lá) e apaga o temporário (best-effort).

A assinatura fica em `src/lib/r2.ts`, com `node:crypto`, sem SDK — o mesmo motivo do módulo (sem
dependência nova). O envio do navegador fica num helper reaproveitável
(`src/lib/envio-r2-navegador.ts`) porque o upload da aba Documentos do cliente tem o mesmo problema e
vai usar o mesmo caminho depois (fora deste escopo).

## 3. Segurança — endereço vindo do navegador

Hoje a rota baixa **qualquer URL** que o navegador mandar (`getUpload(arquivo.url)`) e depois a
**apaga** (`deleteUpload`). Com o `storage.ts` lendo `r2:<chave>`, isso permitiria ler e apagar
qualquer arquivo do bucket — inclusive os do SharePoint de outro cliente. Por isso o endereço do
navegador tem que casar com `^r2:tmp-uploads/<uuid>\.(pdf|xlsx|csv|docx)$`; fora disso, 400 sem
baixar nada. URL do Blob deixa de ser aceita (o store está suspenso de qualquer forma).

## 4. Configuração do bucket (usuário, painel da Cloudflare)

A chave `R2_*` do VerAI não tem permissão de configuração do bucket (GET `?cors` → 403, medido em
28/09). O usuário configura:

- **CORS**: `AllowedOrigins` `https://verai-virid.vercel.app` e `http://localhost:3000`,
  `AllowedMethods` `PUT`, `AllowedHeaders` `content-type`, `MaxAgeSeconds` 3600.
- **Opcional**: regra de ciclo de vida apagando `tmp-uploads/` após 1 dia (envio abandonado no meio).

Sem o CORS o PUT do navegador falha com erro de rede; a tela mostra "Não foi possível enviar
"<nome>" para o armazenamento." em vez de uma mensagem técnica.

## 5. Exclusão

- Excluir a proposta (`DELETE /api/propostas-comerciais/[id]`) passa a apagar também o original de
  cada arquivo que esteja em `r2:propostas-comerciais/<id>/` (nunca o de `arquivoClienteId`, que é do
  repositório do cliente). O apagar por prefixo do Blob continua para as propostas antigas.
- Excluir um arquivo só (`DELETE …/arquivos/[arquivoId]`) já usa `deleteUpload`, que entende `r2:`.

## 6. Fora do escopo

- Upload da aba Documentos do cliente (`/api/arquivos/upload-token`) — mesmo mecanismo, próxima peça.
- PDFs de relatório, faturamento e histórico do ConfereAI (ainda no Blob).

## 7. Produção

A produção roda o hotfix `hotfix/confere-504` (sem `r2.ts`, sem R2 no `storage.ts`); o main local está
174 commits à frente, com migrações pendentes, e o push está bloqueado a pedido do usuário. As `R2_*`
já estão cadastradas em produção (25/09, mesmo bucket do dev). Recomendação: **novo hotfix** a partir
do que está no ar levando `r2.ts`, a leitura/exclusão `r2:` do `storage.ts`, as imagens da conversão
no R2 (feitas em 28/09) e este envio — sem o "Converter em Markdown" do repositório, que depende de
migração. Push e deploy só com autorização do usuário.
