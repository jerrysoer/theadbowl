/**
 * TheAdBowl — YouTube API Client
 */
class YouTubeAPI {
  constructor() {
    this._previousViews = new Map();
  }

  /**
   * Load video metadata from local JSON file.
   */
  async loadVideoIds() {
    const resp = await fetch(CONFIG.VIDEO_IDS_PATH);
    if (!resp.ok) throw new Error('Failed to load video IDs');
    return resp.json();
  }

  /**
   * Fetch stats for a list of video IDs, batching if needed.
   * Returns an array of video stat objects.
   */
  async fetchStats(videoIds) {
    const batches = [];
    for (let i = 0; i < videoIds.length; i += CONFIG.BATCH_SIZE) {
      batches.push(videoIds.slice(i, i + CONFIG.BATCH_SIZE));
    }

    const results = await Promise.all(
      batches.map(batch => this._fetchBatch(batch))
    );

    const videos = results.flat();

    // Calculate trending deltas
    for (const video of videos) {
      const prev = this._previousViews.get(video.id);
      video.trending = prev != null ? video.viewCount - prev : 0;
      this._previousViews.set(video.id, video.viewCount);
    }

    return videos;
  }

  /**
   * Fetch a single batch of video IDs from the API proxy.
   */
  async _fetchBatch(ids) {
    const url = `${CONFIG.API_URL}?ids=${ids.join(',')}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `API error: ${resp.status}`);
    }

    const data = await resp.json();
    return data.videos || [];
  }
}
