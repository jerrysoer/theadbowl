/**
 * TheAdBowl — App Orchestrator
 * Features: deep-link sort, celebrity search, My Top 3, share leaderboard
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
  const shareLeaderboardBtn = document.getElementById('share-leaderboard-btn');
  const celebritySearch = document.getElementById('celebrity-search');
  const ballot = document.getElementById('ballot');
  const ballotPicks = document.getElementById('ballot-picks');
  const ballotShareBtn = document.getElementById('ballot-share-btn');

  let videoMetadata = [];
  let mergedAds = [];
  let refreshTimer = null;
  let searchQuery = '';

  /**
   * Bootstrap the app.
   */
  async function init() {
    // Read URL params for deep-linking
    const params = new URLSearchParams(window.location.search);
    const sortParam = params.get('sort');
    const picksParam = params.get('picks');

    if (sortParam && ['views', 'engagement', 'trending'].includes(sortParam)) {
      leaderboard.sortMode = sortParam;
      document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === sortParam);
        b.setAttribute('aria-checked', b.dataset.sort === sortParam ? 'true' : 'false');
      });
    }

    if (picksParam) {
      leaderboard.loadSharedPicks(picksParam.split(',').filter(Boolean));
    }

    startCountdown();
    wireSortControls();
    wireSearch();
    wireShareLeaderboard();
    wireBallot();
    retryBtn.addEventListener('click', refresh);

    leaderboard.onPickChange = (picks) => updateBallot(picks);
    updateBallot(leaderboard.picks);

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
          publishedAt: live.publishedAt || '',
        };
      }).filter(ad => {
        if (ad.publishedAt && !ad.publishedAt.startsWith('2026')) return false;
        const blocked = ['nfl', 'abc news', 'cbs news', 'nbc news', 'espn',
          'good morning america', 'entertainment tonight', 'fox news',
          'jimmy kimmel live', 'the tonight show starring jimmy fallon',
          'late night with seth meyers', 'yahoo entertainment', 'page six'];
        if (blocked.includes(ad.brand.trim().toLowerCase())) return false;
        return true;
      });

      if (mergedAds.length === 0) {
        showState('empty');
        return;
      }

      renderFiltered();
      updateStatsBar(mergedAds);
      updateBallot(leaderboard.picks);
      showState('content');

      const now = new Date();
      const gameStart = CONFIG.KICKOFF_TIME;
      const gameEnd = new Date(gameStart.getTime() + 5 * 60 * 60 * 1000);
      if (now >= gameStart && now <= gameEnd) {
        liveIndicator.hidden = false;
      }
    } catch (err) {
      showError(err.message);
    }
  }

  /**
   * Render with current search filter applied.
   */
  function renderFiltered() {
    let ads = mergedAds;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      ads = mergedAds.filter(ad => {
        const celeb = (ad.celebrity || '').toLowerCase();
        const brand = (ad.brand || '').toLowerCase();
        const title = (ad.adTitle || '').toLowerCase();
        const category = (ad.category || '').toLowerCase();
        return celeb.includes(q) || brand.includes(q) || title.includes(q) || category.includes(q);
      });
    }
    leaderboard.render(ads);
  }

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

  // --- Countdown ---
  const countdownWrap = document.getElementById('countdown-wrap');
  const postgameMessage = document.getElementById('postgame-message');
  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMins = document.getElementById('cd-mins');
  const cdSecs = document.getElementById('cd-secs');
  let countdownInterval = null;

  function startCountdown() {
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }

  function updateCountdown() {
    const now = new Date();
    const kickoff = CONFIG.KICKOFF_TIME;
    const diff = kickoff - now;

    if (diff <= 0) {
      clearInterval(countdownInterval);
      countdownWrap.hidden = true;
      const hoursPast = Math.abs(diff) / (1000 * 60 * 60);
      postgameMessage.hidden = false;
      if (hoursPast < 6) {
        postgameMessage.textContent = 'GAME DAY \u2014 Big Game LX is LIVE. Stats updating every 2 minutes.';
      } else {
        postgameMessage.textContent = "That's a wrap on Big Game LX \u2014 thanks for watching the ads with us!";
      }
      return;
    }

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

    contextMessage.textContent = days > 0 ? 'Big Game LX \u2014 Feb 8, 2026' : 'Kickoff today';
  }

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
   * Wire sort controls with deep-link URL updates.
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

        // Deep-link: update URL without reload
        const url = new URL(window.location);
        url.searchParams.set('sort', btn.dataset.sort);
        history.replaceState(null, '', url);

        if (mergedAds.length > 0) renderFiltered();
      });
    });
  }

  /**
   * Wire celebrity/brand search with debounce.
   */
  function wireSearch() {
    if (!celebritySearch) return;
    let debounceTimer;
    celebritySearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = celebritySearch.value.trim();
        if (mergedAds.length > 0) renderFiltered();
      }, 200);
    });
  }

  /**
   * Wire share leaderboard button.
   */
  function wireShareLeaderboard() {
    if (!shareLeaderboardBtn) return;
    shareLeaderboardBtn.addEventListener('click', async () => {
      const sorted = [...mergedAds].sort((a, b) => b.viewCount - a.viewCount);
      const topAd = sorted[0];
      const totalViews = mergedAds.reduce((sum, a) => sum + a.viewCount, 0);

      const url = new URL(window.location);
      url.searchParams.set('sort', leaderboard.sortMode);
      const shareUrl = url.toString();

      const text = topAd
        ? `The #1 Big Game ad is ${topAd.brand} with ${formatCompact(topAd.viewCount)} views! ${mergedAds.length} ads tracked, ${formatCompact(totalViews)} total views.`
        : 'Track every Big Game ad live on TheAdBowl!';

      if (navigator.share) {
        try {
          await navigator.share({ title: 'TheAdBowl \u2014 Big Game LX Ad Rankings', text, url: shareUrl });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(text + ' ' + shareUrl);
        const origText = shareLeaderboardBtn.innerHTML;
        shareLeaderboardBtn.textContent = 'Copied!';
        setTimeout(() => { shareLeaderboardBtn.innerHTML = origText; }, 2000);
      } catch {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,width=550,height=420');
      }
    });
  }

  /**
   * Wire My Top 3 ballot share.
   */
  function wireBallot() {
    if (!ballotShareBtn) return;
    ballotShareBtn.addEventListener('click', async () => {
      const picks = [...leaderboard.picks];
      if (picks.length === 0) return;

      const url = new URL(window.location);
      url.searchParams.set('picks', picks.join(','));
      url.searchParams.set('sort', leaderboard.sortMode);
      const shareUrl = url.toString();

      const pickBrands = picks.map(id => {
        const ad = mergedAds.find(a => a.id === id);
        return ad ? ad.brand : id;
      });

      const text = `My Top ${picks.length} Big Game ads: ${pickBrands.join(', ')}! What are yours?`;

      if (navigator.share) {
        try {
          await navigator.share({ title: 'My Top 3 Big Game Ads', text, url: shareUrl });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(text + ' ' + shareUrl);
        ballotShareBtn.textContent = 'Copied!';
        setTimeout(() => { ballotShareBtn.textContent = 'Share My Top 3'; }, 2000);
      } catch {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,width=550,height=420');
      }
    });
  }

  /**
   * Update the floating ballot bar.
   */
  function updateBallot(picks) {
    if (!ballot || !ballotPicks) return;
    const pickArr = [...picks];

    if (pickArr.length === 0) {
      ballot.hidden = true;
      return;
    }

    ballot.hidden = false;
    ballotPicks.innerHTML = '';

    pickArr.forEach((id, i) => {
      const ad = mergedAds.find(a => a.id === id);
      const chip = document.createElement('div');
      chip.className = 'ballot__chip';
      if (ad && ad.thumbnail) {
        chip.innerHTML = `
          <span class="ballot__chip-num">${i + 1}</span>
          <img class="ballot__chip-thumb" src="${ad.thumbnail}" alt="" width="48" height="27" />
          <span class="ballot__chip-brand">${ad ? ad.brand : '...'}</span>
        `;
      } else {
        chip.innerHTML = `
          <span class="ballot__chip-num">${i + 1}</span>
          <span class="ballot__chip-brand">${ad ? ad.brand : '...'}</span>
        `;
      }
      ballotPicks.appendChild(chip);
    });

    if (ballotShareBtn) {
      ballotShareBtn.textContent = pickArr.length < 3
        ? `Pick ${3 - pickArr.length} more`
        : 'Share My Top 3';
      ballotShareBtn.disabled = pickArr.length < 1;
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, CONFIG.REFRESH_INTERVAL);
  }

  // Boot
  init();
})();
