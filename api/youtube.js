const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const MAX_IDS = 50;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ids } = req.query;

  if (!ids) {
    return res.status(400).json({ error: 'Missing required parameter: ids' });
  }

  const videoIds = ids.split(',').map(id => id.trim()).filter(Boolean);

  if (videoIds.length === 0) {
    return res.status(400).json({ error: 'No valid video IDs provided' });
  }

  if (videoIds.length > MAX_IDS) {
    return res.status(400).json({ error: `Too many IDs. Maximum is ${MAX_IDS}` });
  }

  const invalid = videoIds.filter(id => !VIDEO_ID_PATTERN.test(id));
  if (invalid.length > 0) {
    return res.status(400).json({ error: 'One or more video IDs have invalid format' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${apiKey}`;

  try {
    const response = await fetch(url);

    if (response.status === 403) {
      const body = await response.json().catch(() => ({}));
      const reason = body?.error?.errors?.[0]?.reason;
      if (reason === 'quotaExceeded') {
        return res.status(503).json({ error: 'YouTube API quota exceeded. Try again tomorrow.' });
      }
      return res.status(502).json({ error: 'YouTube API access denied' });
    }

    if (!response.ok) {
      console.error(`YouTube API returned ${response.status}`);
      return res.status(502).json({ error: 'YouTube API error' });
    }

    const data = await response.json();

    const videos = (data.items || []).map(item => ({
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.maxres?.url
        || item.snippet.thumbnails?.high?.url
        || item.snippet.thumbnails?.medium?.url
        || '',
      publishedAt: item.snippet.publishedAt,
      viewCount: parseInt(item.statistics.viewCount || '0', 10),
      likeCount: parseInt(item.statistics.likeCount || '0', 10),
      commentCount: parseInt(item.statistics.commentCount || '0', 10),
    }));

    return res.status(200).json({ videos });
  } catch (err) {
    console.error('Failed to fetch from YouTube API:', err.message);
    return res.status(502).json({ error: 'Failed to reach YouTube API' });
  }
}
