/** Indicador de atividade. `motion-reduce:animate-none` porque ele gira por até
 *  um minuto: a WCAG 2.2.2 é nível A e trata de movimento automático acima de
 *  5 s. Indicador de carregamento costuma ser aceito como essencial, mas a
 *  classe custa nada e encerra a dúvida — quem pediu menos movimento recebe o
 *  texto sem o giro. */
export function Giro({ className = "h-4 w-4" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className={`${className} shrink-0 animate-spin motion-reduce:animate-none`}
		>
			<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
			<path
				d="M21 12a9 9 0 0 0-9-9"
				fill="none"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
			/>
		</svg>
	);
}
