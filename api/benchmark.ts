import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * @deprecated This API endpoint is no longer actively used.
 *
 * It was originally created for the "Extreme Depth" typing demo benchmark,
 * but that demo is not a competitive comparison and doesn't need historical tracking.
 *
 * This endpoint is kept for backward compatibility to access any existing historical data.
 *
 * For NEW benchmark data, see /api/realistic-benchmark.ts which handles the
 * "Realistic Comparison" benchmarks (SignalTree vs NgRx vs Akita vs NgXs).
 */

// BenchmarkSubmission removed with the POST handler that was its only user.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Retrieve all benchmarks
  if (req.method === 'GET') {
    try {
      // Fetch all benchmark gists
      const response = await fetch(
        `https://api.github.com/users/JBorgia/gists`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            ...(process.env.GITHUB_TOKEN && {
              Authorization: `token ${process.env.GITHUB_TOKEN}`,
            }),
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch gists');
      }

      const gists = (await response.json()) as Array<{
        id: string;
        description?: string;
        created_at: string;
        files: Record<string, { raw_url: string }>;
      }>;

      // Filter for benchmark gists
      const benchmarkGists = gists.filter((gist) =>
        gist.description?.startsWith('SignalTree Benchmark:')
      );

      // Fetch content of each benchmark gist
      const benchmarks = await Promise.all(
        benchmarkGists.slice(0, 100).map(async (gist) => {
          try {
            const fileKey = Object.keys(gist.files)[0];
            const fileUrl = gist.files[fileKey].raw_url;
            const contentResponse = await fetch(fileUrl);
            const content = await contentResponse.json();
            return {
              id: gist.id,
              createdAt: gist.created_at,
              ...content,
            };
          } catch (error) {
            console.error('Error fetching gist content:', error);
            return null;
          }
        })
      );

      return res.status(200).json({
        success: true,
        count: benchmarks.filter(Boolean).length,
        benchmarks: benchmarks.filter(Boolean),
      });
    } catch (error) {
      console.error('Error fetching benchmarks:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch benchmarks',
      });
    }
  }

  // POST: Submit new benchmark
  // POST removed 2026-09-24. The handler created GitHub gists with the
  // server's GITHUB_TOKEN, and its only gate was `consentGiven` — a
  // client-supplied boolean the demo client hardcoded to true. No caller
  // existed: `submitBenchmark()` was defined in the demo service and
  // invoked from nowhere. Unauthenticated writes to the owner's gist
  // account were therefore reachable with nothing using the feature.
  // CORS, Origin and sessionId are not authentication. Submission falls
  // through to the existing 405 below; GET is unchanged.

  return res.status(405).json({ error: 'Method not allowed' });
}
