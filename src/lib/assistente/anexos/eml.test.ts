import { lerEml } from './eml'

const eml = (s: string) => Buffer.from(s.replace(/\n/g, '\r\n'), 'utf8')

it('cabeçalhos e corpo text/plain em quoted-printable', () => {
  const r = lerEml(eml(`From: Ana <ana@sp.gov.br>\nTo: lucas@prodam.sp.gov.br\nDate: Thu, 01 Oct 2026 10:00:00 -0300\nSubject: =?UTF-8?Q?Reajuste_do_contrato?=\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: quoted-printable\n\nPrezados, solicitamos o reajuste at=C3=A9 30/10.\n`))
  expect(r).toEqual({ de: 'Ana <ana@sp.gov.br>', para: 'lucas@prodam.sp.gov.br', data: 'Thu, 01 Oct 2026 10:00:00 -0300', assunto: 'Reajuste do contrato', corpo: 'Prezados, solicitamos o reajuste até 30/10.', anexos: [] })
})

it('multipart: prefere text/plain, cai para html, decodifica base64 e lista anexos', () => {
  const corpo64 = Buffer.from('<p>Segue o <b>aditivo</b>.</p>', 'utf8').toString('base64')
  const r = lerEml(eml(`From: x@y\nSubject: Aditivo\nContent-Type: multipart/mixed; boundary="B"\n\n--B\nContent-Type: text/html; charset=UTF-8\nContent-Transfer-Encoding: base64\n\n${corpo64}\n--B\nContent-Type: application/pdf; name="TA 03.pdf"\nContent-Disposition: attachment; filename="TA 03.pdf"\nContent-Transfer-Encoding: base64\n\nJVBERi0=\n--B--\n`))
  expect(r.corpo).toBe('Segue o aditivo.')
  expect(r.anexos).toEqual(['TA 03.pdf'])
  expect(r.assunto).toBe('Aditivo')
})

it('corpo e assunto em UTF-8 cru (8bit) mantêm o acento', () => {
  const r = lerEml(eml(`From: x@y\nSubject: Prorrogação\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: 8bit\n\nExecução até sexta.\n`))
  expect(r.corpo).toBe('Execução até sexta.')
  expect(r.assunto).toBe('Prorrogação')
})

const eml1252 = (s: string) => Buffer.from(s.replace(/\n/g, '\r\n'), 'latin1')

it('charset windows-1252 no corpo html em quoted-printable e no assunto encoded-word', () => {
  const r = lerEml(eml1252(`From: x@y\nSubject: =?iso-8859-1?Q?Execu=E7=E3o?=\nContent-Type: text/html; charset=windows-1252\nContent-Transfer-Encoding: quoted-printable\n\n<p>Execu=E7=E3o at=E9 sexta</p>\n`))
  expect(r.corpo).toBe('Execução até sexta')
  expect(r.assunto).toBe('Execução')
})

it('encoded-words adjacentes descartam o espaço entre eles', () => {
  const r = lerEml(eml(`From: x@y\nSubject: =?UTF-8?Q?Presta=C3=A7=C3=A3o?=\n =?UTF-8?Q?_de_servi=C3=A7o?=\n\ncorpo\n`))
  expect(r.assunto).toBe('Prestação de serviço')
})

it('nome de anexo RFC 2231 é percent-decodificado', () => {
  const r = lerEml(eml(`From: x@y\nContent-Type: multipart/mixed; boundary="B"\n\n--B\nContent-Type: text/plain\n\noi\n--B\nContent-Type: application/pdf\nContent-Disposition: attachment; filename*=UTF-8''TA%2003.pdf\nContent-Transfer-Encoding: base64\n\nJVBERi0=\n--B--\n`))
  expect(r.anexos).toEqual(['TA 03.pdf'])
})
