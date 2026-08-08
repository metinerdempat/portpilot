// Production entry: bind to loopback by default so the adapter-node server
// (which otherwise listens on 0.0.0.0, i.e. every network interface) isn't
// exposed to the LAN. Override deliberately with e.g. HOST=0.0.0.0 pnpm start.
if (!process.env.HOST) process.env.HOST = '127.0.0.1';
import('./build/index.js');
