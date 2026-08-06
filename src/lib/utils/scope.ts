/** Human label for a bind address — the security-relevant scope of a port. */
export const scopeLabel = (address: string): string => {
	if (address === '127.0.0.1' || address === '::1') return 'localhost only';
	if (address === '*' || address === '0.0.0.0' || address === '::') return 'exposed';
	return address;
};
