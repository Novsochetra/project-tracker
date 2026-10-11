// Only names that always mean this computer. *.localhost is left out: macOS sends it to loopback,
// but some Linux resolvers ask DNS for it.
const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/i;

export const isLoopbackHost = (host: string): boolean => LOOPBACK.test(host.trim());
