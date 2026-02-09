/**
 * TheAdBowl — Configuration
 */
const CONFIG = {
  API_URL: 'https://theadbowl.vercel.app/api/youtube',
  VIDEO_IDS_PATH: 'data/video-ids.json',
  HALFTIME_IDS_PATH: 'data/halftime-shows.json',
  REFRESH_INTERVAL: 2 * 60 * 1000, // 2 minutes
  KICKOFF_TIME: new Date('2026-02-08T18:30:00-05:00'), // Feb 8, 2026 6:30 PM ET
  BATCH_SIZE: 50,

  // Super Bowl schedule — add future games here each year
  SUPER_BOWLS: [
    { numeral: 'LX',    date: '2026-02-08T18:30:00-05:00', city: 'Santa Clara' },
    { numeral: 'LXI',   date: '2027-02-14T18:30:00-05:00', city: 'Los Angeles' },
    { numeral: 'LXII',  date: '2028-02-13T18:30:00-05:00', city: 'Atlanta' },
  ],
};
