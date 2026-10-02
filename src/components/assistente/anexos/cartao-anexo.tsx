import { AlertCircle, CheckCircle2, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EstadoAnexo } from './enviar-anexo'

export function textoDaEtapa(anexo: EstadoAnexo): string {
  switch (anexo.etapa) {
    case 'fila':
      return 'Na fila…'
    case 'enviando':
      return 'Enviando…'
    case 'ocr':
      return anexo.progresso ? `Lendo página ${anexo.progresso.pagina} de ${anexo.progresso.total} (OCR)…` : 'Lendo (OCR)…'
    case 'lendo':
      return 'Lendo…'
    case 'pronto':
      return 'Pronto'
    case 'erro':
      return anexo.erro ? `Erro: ${anexo.erro}` : 'Erro'
  }
}

/** Um anexo da conversa e o andamento dele (envio, OCR, leitura, pronto ou erro). */
export function CartaoAnexo({ anexo }: { anexo: EstadoAnexo }) {
  const emCurso = anexo.etapa !== 'pronto' && anexo.etapa !== 'erro'
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
        anexo.etapa === 'erro' ? 'border-red-crit/30 bg-red-crit/[0.04]' : 'border-navy/15 bg-navy/[0.02]'
      )}
    >
      <FileText className="size-4 shrink-0 text-navy" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-navy" title={anexo.nome}>
          {anexo.nome}
        </p>
        <p className={cn(anexo.etapa === 'erro' ? 'text-red-crit' : 'text-mid-grey')} role={anexo.etapa === 'erro' ? 'alert' : undefined}>
          {textoDaEtapa(anexo)}
        </p>
      </div>
      {emCurso && <Loader2 className="size-3.5 shrink-0 animate-spin text-mid-grey" aria-hidden />}
      {anexo.etapa === 'pronto' && <CheckCircle2 className="size-3.5 shrink-0 text-green-ok" aria-hidden />}
      {anexo.etapa === 'erro' && <AlertCircle className="size-3.5 shrink-0 text-red-crit" aria-hidden />}
    </div>
  )
}
