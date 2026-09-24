import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (typeof id !== 'string' || !/^[a-f0-9]{1,40}$/i.test(id)) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing benchmark id' });
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${id}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ success: false, error: 'Benchmark not found' });
    }

    const gist = (await response.json()) as {
      owner?: { login?: string };
      description?: string;
      files?: Record<string, { raw_url?: string }>;
    };

    // A caller-supplied gist ID is not permission to proxy arbitrary account
    // content. Only this service's benchmark records belong to this endpoint.
    const entry = Object.entries(gist.files ?? {}).find(([name]) =>
      /^realistic-benchmark-.+\.json$/.test(name)
    );
    const fileUrl = entry?.[1].raw_url;
    let trustedContent = false;
    if (typeof fileUrl === 'string') {
      try {
        const url = new URL(fileUrl);
        trustedContent =
          url.protocol === 'https:' &&
          url.hostname === 'gist.githubusercontent.com' &&
          !url.username &&
          !url.password &&
          !url.port &&
          url.pathname
            .toLowerCase()
            .startsWith(`/jborgia/${id.toLowerCase()}/raw/`);
      } catch {
        /* malformed upstream record is not a benchmark */
      }
    }
    if (
      gist.owner?.login?.toLowerCase() !== 'jborgia' ||
      !gist.description?.startsWith('SignalTree Realistic Benchmark:') ||
      !trustedContent ||
      !fileUrl
    ) {
      return res
        .status(404)
        .json({ success: false, error: 'Benchmark not found' });
    }
    const contentResponse = await fetch(fileUrl, { redirect: 'error' });

    if (!contentResponse.ok) {
      return res
        .status(500)
        .json({ success: false, error: 'Failed to load benchmark content' });
    }

    const benchmark = await contentResponse.json();

    return res.status(200).json({ success: true, benchmark });
  } catch (error) {
    console.error('Error fetching benchmark details:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Failed to fetch benchmark details' });
  }
}
