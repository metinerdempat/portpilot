// Shared constants. No logic lives here — just values.

/** Auto-refresh poll interval, in milliseconds. */
export const REFRESH_MS = 3000;

/** Ports below this need root to bind and are usually system/service ports. */
export const PRIVILEGED_PORT_MAX = 1024;

/** Placeholder bar widths (as % of the process column) for the skeleton rows. */
export const SKELETON_TCP_WIDTHS = [46, 58, 40, 64, 50, 42, 60, 48];
export const SKELETON_DOCKER_WIDTHS = [54, 44, 60, 48, 52];

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
	'netbiosd', 'dnsmasq'
]);
