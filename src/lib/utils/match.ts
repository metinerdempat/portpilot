import type { ContainerInfo, DockerPort, PortEntry } from '$lib/types';

/** Filter predicate for a TCP port row — matches port, command (incl. full) or user. */
export const matchPort = (p: PortEntry, q: string): boolean =>
	String(p.port).includes(q) ||
	p.command.toLowerCase().includes(q) ||
	(p.fullCommand ?? '').toLowerCase().includes(q) ||
	p.user.toLowerCase().includes(q);

/** Filter predicate for a Docker port row. */
export const matchDocker = (d: DockerPort, q: string): boolean =>
	String(d.hostPort).includes(q) ||
	String(d.containerPort).includes(q) ||
	d.container.toLowerCase().includes(q) ||
	d.image.toLowerCase().includes(q);

/** Filter predicate for a container row. */
export const matchContainer = (c: ContainerInfo, q: string): boolean =>
	c.name.toLowerCase().includes(q) ||
	c.image.toLowerCase().includes(q) ||
	(c.project ?? '').toLowerCase().includes(q) ||
	(c.service ?? '').toLowerCase().includes(q) ||
	c.status.toLowerCase().includes(q) ||
	c.ports.toLowerCase().includes(q);
