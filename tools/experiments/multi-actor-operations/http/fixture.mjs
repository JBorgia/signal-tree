import http from 'node:http';
import { DispatchBackend } from '../dispatch-fixture.mjs';
import { reviewAuthority } from '../authority/review-fixture.mjs';

// Loopback reference endpoint; no production authentication or durable receipt store.
export async function startDispatchEndpoint({ reviewRequired = false } = {}) {
  const backend = new DispatchBackend();
  const hostReviewer = Object.freeze({});
  const review = reviewRequired ? reviewAuthority(backend, context => context === hostReviewer) : undefined;
  let loseNext = false;
  const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/commands') {
      response.writeHead(404).end(); return;
    }
    // Test credential configured by host, never taken from proposed actor labels.
    if (request.headers.authorization !== 'Bearer fixture-only') {
      response.writeHead(401).end(); return;
    }
    let bytes = 0;
    const chunks = [];
    try {
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 65536) { response.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const command = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!command || typeof command !== 'object' || typeof command.commandId !== 'string' || !command.commandId) {
        response.writeHead(400).end(); return;
      }
      const receipt = review
        ? review.apply(command, request.headers['x-review-grant'])
        : backend.apply(command);
      if (loseNext) { loseNext = false; response.destroy(); return; }
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(receipt));
    } catch {
      response.writeHead(400).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    backend,
    url: `http://127.0.0.1:${address.port}/commands`,
    // Test-host control only, deliberately not an HTTP/model-facing endpoint.
    grantReviewForTest(command) {
      if (!review) throw new Error('Review gate is not enabled');
      return review.approve(command, hostReviewer);
    },
    revokeReviewForTest(token) { review?.revoke(token); },
    loseNextAcknowledgment() { loseNext = true; },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      review?.dispose();
    },
  };
}
export function httpCommandAdapter(url, token = 'fixture-only', reviewGrant = () => undefined) {
  return {
    async apply(command) {
      const grant = reviewGrant(command);
      const response = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(grant === undefined ? {} : { 'x-review-grant': grant }) },
        body: JSON.stringify(command), signal: AbortSignal.timeout(5000),
      });
      // No correlated application receipt: conservatively uncertain. A status
      // response alone cannot prove a command was never accepted elsewhere.
      if (!response.ok) throw new Error(`Endpoint returned ${response.status}`);
      return response.json();
    },
  };
}
