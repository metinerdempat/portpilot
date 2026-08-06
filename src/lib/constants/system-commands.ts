/**
 * Processes that are risky to kill — doing so can destabilise the OS or take a
 * shared service down. Matched against `lsof +c0` output (full command names).
 * Killing these is blocked in the UI.
 */
export const SYSTEM_COMMANDS = new Set([
	// macOS
	'launchd', 'ControlCenter', 'rapportd', 'sharingd', 'mDNSResponder',
	'AirPlayXPCHelper', 'identityservicesd', 'apsd', 'nsurlsessiond', 'cloudd',
	'remoted', 'SystemUIServer', 'WindowServer', 'coreaudiod', 'trustd',
	'searchpartyd', 'Spotlight', 'mds', 'mds_stores',
	// linux / cross-platform daemons
	'systemd', 'sshd', 'cupsd', 'cups-browsed', 'avahi-daemon', 'rpcbind',
	'netbiosd', 'dnsmasq',
	// windows system processes (image name without .exe)
	'System', 'svchost', 'services', 'lsass', 'wininit', 'csrss', 'smss',
	'winlogon', 'spoolsv', 'fontdrvhost', 'dwm', 'LsaIso', 'SearchIndexer'
]);
