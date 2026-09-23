'use client'

// Modal de novo fornecedor — <dialog> nativo + showModal(), mesmo padrão de
// src/app/clientes/modal-cliente.tsx. O formulário é o mesmo da edição.

import { useEffect, useRef } from 'react'
import { FormularioFornecedor, type Fornecedor } from './formulario-fornecedor'

export function ModalFornecedor({
  aberto,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean
  aoFechar: () => void
  aoSalvar: (salvo: Fornecedor) => void
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (aberto && !el.open) el.showModal()
    else if (!aberto && el.open) el.close()
  }, [aberto])

  return (
    <dialog
      ref={dialogoRef}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label="Novo fornecedor"
      className="w-[min(56rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {/* Só monta com o modal aberto: cada abertura começa com o formulário limpo. */}
      {aberto && <FormularioFornecedor aoSalvar={aoSalvar} aoCancelar={() => dialogoRef.current?.close()} />}
    </dialog>
  )
}
