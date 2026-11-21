import { createServer } from 'node:http';
import { healthResponse } from './health.ts';

const host = '127.0.0.1';
const port = 3000;

createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(healthResponse()));
    return;
  }

  response.writeHead(404);
  response.end();
}).listen(port, host, () => {
  console.log(`CaroCard server: http://${host}:${port}`);
});
