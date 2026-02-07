/**
 * TheAdBowl — Configuration
 */
const CONFIG = {
  API_URL: 'https://theadbowl.vercel.app/api/youtube',
  VIDEO_IDS_PATH: 'data/video-ids.json',
  REFRESH_INTERVAL: 2 * 60 * 1000, // 2 minutes
  KICKOFF_TIME: new Date('2026-02-09T18:30:00-05:00'), // Feb 9, 2026 6:30 PM ET
  BATCH_SIZE: 50,
};
