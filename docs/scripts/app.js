/**
 * TheAdBowl — App Orchestrator
 */
(function () {
  'use strict';

  const api = new YouTubeAPI();
  const leaderboard = new Leaderboard(document.getElementById('leaderboard'));

  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const emptyState = document.getElementById('empty-state');
  const errorMessage = document.getElementById('error-message');
  const retryBtn = document.getElementById('retry-btn');
  const contextMessage = document.getElementById('context-message');
  const liveIndicator = document.getElementById('live-indicator');

  let videoMetadata = [];
  let mergedAds = [];
  let refreshTimer = null;

  /**
   * Bootstrap the app.
   */
  async function init() {
    startCountdown();
    wireSortControls();
    retryBtn.addEventListener('click', refresh);

    try {
      const data = await api.loadVideoIds();
      videoMetadata = data.ads || [];

      if (videoMetadata.length === 0) {
        showState('empty');
        return;
      }

      await refresh();
      startAutoRefresh();
    } catch (err) {
      showError(err.message);
    }
  }

  /**
   * Fetch latest stats, merge with metadata, and render.
   */
  async function refresh() {
    try {
      showState('loading');

      const ids = videoMetadata.map(ad => ad.videoId);
      const stats = await api.fetchStats(ids);

      // Merge metadata with live stats
      const statsMap = new Map(stats.map(v => [v.id, v]));
      mergedAds = videoMetadata.map(meta => {
        const live = statsMap.get(meta.videoId) || {};
        return {
          ...live,
          id: meta.videoId,
          brand: meta.brand,
          adTitle: meta.adTitle,
          category: meta.category || '',
          celebrity: meta.celebrity || null,
          thumbnail: live.thumbnail || '',
          viewCount: live.viewCount || 0,
          likeCount: live.likeCount || 0,
          commentCount: live.commentCount || 0,
          trending: live.trending || 0,
        };
      });

      if (mergedAds.length === 0) {
        showState('empty');
        return;
      }

      leaderboard.render(mergedAds);
      updateStatsBar(mergedAds);
      showState('content');

      // Show live indicator if during game window
      const now = new Date();
      const gameStart = CONFIG.KICKOFF_TIME;
      const gameEnd = new Date(gameStart.getTime() + 5 * 60 * 60 * 1000); // ~5 hours
      if (now >= gameStart && now <= gameEnd) {
        liveIndicator.hidden = false;
      }
    } catch (err) {
      showError(err.message);
    }
  }

  /**
   * Show loading, error, empty, or content state.
   */
  function showState(state) {
    loadingState.hidden = state !== 'loading';
    errorState.hidden = state !== 'error';
    emptyState.hidden = state !== 'empty';
    document.getElementById('leaderboard').hidden = state !== 'content';
  }

  function showError(msg) {
    errorMessage.textContent = msg || 'Something went wrong. We\'ll try again shortly.';
    showState('error');
  }

  /**
   * Countdown timer elements.
   */
  const countdownWrap = document.getElementById('countdown-wrap');
  const postgameMessage = document.getElementById('postgame-message');
  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMins = document.getElementById('cd-mins');
  const cdSecs = document.getElementById('cd-secs');
  let countdownInterval = null;

  /**
   * Start the live countdown ticker (updates every second).
   */
  function startCountdown() {
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }

  function updateCountdown() {
    const now = new Date();
    const kickoff = CONFIG.KICKOFF_TIME;
    const diff = kickoff - now;

    if (diff <= 0) {
      // Game has started or is over
      clearInterval(countdownInterval);
      countdownWrap.hidden = true;

      const hoursPast = Math.abs(diff) / (1000 * 60 * 60);
      postgameMessage.hidden = false;
      if (hoursPast < 6) {
        postgameMessage.textContent = 'GAME DAY — Super Bowl LX is LIVE. Stats updating every 2 minutes.';
      } else {
        postgameMessage.textContent = "That's a wrap on Super Bowl LX — thanks for watching the ads with us!";
      }
      return;
    }

    // Pre-game: show ticking countdown
    countdownWrap.hidden = false;
    postgameMessage.hidden = true;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    cdDays.textContent = String(days).padStart(2, '0');
    cdHours.textContent = String(hours).padStart(2, '0');
    cdMins.textContent = String(mins).padStart(2, '0');
    cdSecs.textContent = String(secs).padStart(2, '0');

    contextMessage.textContent = days > 0
      ? `Super Bowl LX — Feb 8, 2026`
      : 'Kickoff today';
  }

  /**
   * Update aggregate stats bar.
   */
  function updateStatsBar(ads) {
    const totalViews = ads.reduce((sum, a) => sum + a.viewCount, 0);
    const totalLikes = ads.reduce((sum, a) => sum + a.likeCount, 0);

    document.getElementById('stat-ads').textContent = ads.length;
    document.getElementById('stat-views').textContent = formatCompact(totalViews);
    document.getElementById('stat-likes').textContent = formatCompact(totalLikes);
    document.getElementById('stat-updated').textContent = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatCompact(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  }

  /**
   * Wire sort control buttons.
   */
  function wireSortControls() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sort-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');

        leaderboard.sortMode = btn.dataset.sort;
        if (mergedAds.length > 0) {
          leaderboard.render(mergedAds);
        }
      });
    });
  }

  /**
   * Start auto-refresh interval.
   */
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, CONFIG.REFRESH_INTERVAL);
  }

  // Boot
  init();
})();
