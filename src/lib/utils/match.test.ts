import { describe, it, expect } from 'vitest';
import { matchContainer, matchDocker, matchPort } from './match';
import type { ContainerInfo, DockerPort, PortEntry } from '$lib/types';

const port = (o: Partial<PortEntry> = {}): PortEntry => ({
	port: 3000,
	pid: 100,
	command: 'node',
	user: 'metin',
	address: '127.0.0.1',
	protocol: 'TCP',
	risk: 'safe',
	...o
});

const dport = (o: Partial<DockerPort> = {}): DockerPort => ({
	hostPort: 5432,
	containerPort: 5432,
	protocol: 'tcp',
	address: '0.0.0.0',
	container: 'url_shortener_postgres',
	image: 'postgres:16',
	containerId: 'abc123',
	...o
});

const container = (o: Partial<ContainerInfo> = {}): ContainerInfo => ({
	id: 'abc123',
	name: 'edep_redis',
	image: 'redis:7-alpine',
	state: 'running',
	status: 'Up 3 hours (healthy)',
	health: 'healthy',
	createdAt: '3 hours ago',
	ports: '6379→6379',
	project: 'edep_server',
	service: 'redis',
	running: true,
	...o
});

describe('matchPort', () => {
	it('matches on port number, command, full command and user', () => {
		expect(matchPort(port({ port: 3000 }), '300')).toBe(true);
		expect(matchPort(port({ command: 'Node' }), 'node')).toBe(true);
		expect(matchPort(port({ fullCommand: '/usr/bin/astro dev' }), 'astro')).toBe(true);
		expect(matchPort(port({ user: 'root' }), 'root')).toBe(true);
	});

	it('does not match unrelated text', () => {
		expect(matchPort(port(), 'zzz')).toBe(false);
	});
});

describe('matchDocker', () => {
	it('matches on host/container port, container name and image', () => {
		expect(matchDocker(dport({ hostPort: 5432 }), '543')).toBe(true);
		expect(matchDocker(dport({ containerPort: 5432 }), '5432')).toBe(true);
		expect(matchDocker(dport({ container: 'Postgres' }), 'postgres')).toBe(true);
		expect(matchDocker(dport({ image: 'redis:7' }), 'redis')).toBe(true);
	});

	it('does not match unrelated text', () => {
		expect(matchDocker(dport(), 'nginx')).toBe(false);
	});
});

describe('matchContainer', () => {
	it('matches on name, image, project, service, status and ports', () => {
		expect(matchContainer(container({ name: 'Edep_Redis' }), 'redis')).toBe(true);
		expect(matchContainer(container({ image: 'redis:7-alpine' }), 'alpine')).toBe(true);
		expect(matchContainer(container({ project: 'edep_server' }), 'edep')).toBe(true);
		expect(matchContainer(container({ service: 'cache' }), 'cache')).toBe(true);
		expect(matchContainer(container({ status: 'Up 3 hours (healthy)' }), 'healthy')).toBe(true);
		expect(matchContainer(container({ ports: '6379→6379' }), '6379')).toBe(true);
	});

	it('does not match unrelated text', () => {
		expect(matchContainer(container(), 'mysql')).toBe(false);
	});
});
