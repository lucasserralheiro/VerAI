"use client";

import { useEffect, useRef } from "react";

interface Props {
  aberto: boolean;
  /** Nome do arquivo, na barra do topo. */
  titulo: string;
  /** O PDF a mostrar (`/api/arquivos/<id>?modo=inline`). */
  url: string;
  onFechar: () => void;
}

/** O PDF numa janela por cima da tela, no lugar de uma aba nova: a pessoa confere o
 *  documento e volta ao formulário sem perder nada do que preencheu.
 *
 *  `<dialog>` nativo com `showModal()`, como os outros diálogos do Confere (foco preso, Esc e
 *  fundo inerte de graça). Sem rolagem própria: quem rola é o leitor de PDF dentro do quadro. O
 *  conteúdo só monta com a janela aberta, para não baixar o arquivo à toa. */
export function JanelaDoPdf({ aberto, titulo, url, onFechar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (aberto && !el.open) el.showModal();
    else if (!aberto && el.open) el.close();
  }, [aberto]);

  return (
    <dialog
      ref={dialogo}
      onClose={onFechar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) onFechar();
      }}
      aria-label={`PDF: ${titulo}`}
      className="h-[90vh] w-[min(80rem,calc(100vw-2rem))] max-w-none flex-col rounded-lg border border-confere-line bg-white p-0 shadow-lg backdrop:bg-black/50 open:flex"
    >
      {/* Fechada, a janela não deixa nada no DOM: o nome do arquivo já está na linha do formulário. */}
      {aberto && (
        <>
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-confere-line px-6 py-3">
            <h2
              title={titulo}
              className="min-w-0 truncate text-lg font-semibold text-confere-navy-800"
            >
              {titulo}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-confere-navy-100 bg-white px-4 py-2 text-sm font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-confere-prodam-orange"
              >
                Abrir em nova aba
              </a>
              <button
                type="button"
                onClick={onFechar}
                className="rounded-md bg-confere-brand-navy px-5 py-2 text-sm font-semibold text-white transition hover:bg-confere-navy-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-confere-prodam-orange focus-visible:ring-offset-2"
              >
                Fechar
              </button>
            </div>
          </div>
          <iframe
            src={url}
            title={`PDF: ${titulo}`}
            className="min-h-0 w-full flex-1 bg-confere-surface"
          />
        </>
      )}
    </dialog>
  );
}
