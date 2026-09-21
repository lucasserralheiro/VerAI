// Cabeçalhos de segurança em todas as respostas. CSP fica de fora de propósito:
// o App Router usa scripts e estilos inline e exigiria nonces dedicados.
const securityHeaders = [
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: "standalone",
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
};

export default nextConfig;
