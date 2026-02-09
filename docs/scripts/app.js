/**
 * TheAdBowl — App Orchestrator
 * Features: dual-section nav (Commercials + Halftime), deep-link sort,
 * celebrity search, My Top 3, share leaderboard, independent state per section
 */
(function () {
  'use strict';

  const api = new YouTubeAPI();
  const leaderboard = new Leaderboard(document.getElementById('leaderboard'));
  const halftimeLeaderboard = new HalftimeLeaderboard(document.getElementById('halftime-leaderboard'));

  // --- Ads Section DOM ---
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

  // --- Halftime Section DOM ---
  const htLoadingState = document.getElementById('ht-loading-state');
  const htErrorState = document.getElementById('ht-error-state');
  const htEmptyState = document.getElementById('ht-empty-state');
  const htErrorMessage = document.getElementById('ht-error-message');
  const htRetryBtn = document.getElementById('ht-retry-btn');
  const halftimeSearch = document.getElementById('halftime-search');

  // --- Section Nav DOM ---
  const sectionNavBtns = document.querySelectorAll('.section-nav__btn');
  const sectionIndicator = document.querySelector('.section-nav__indicator');
  const adsSection = document.getElementById('ads-section');
  const halftimeSection = document.getElementById('halftime-section');

  // --- State ---
  let videoMetadata = [];
  let mergedAds = [];
  let halftimeMetadata = [];
  let mergedHalftime = [];
  let refreshTimer = null;
  let searchQuery = '';
  let htSearchQuery = '';
  let activeSection = 'ads'; // 'ads' | 'halftime'
  let halftimeLoaded = false;
  const sectionScrollPositions = { ads: 0, halftime: 0 };

  /**
   * Bootstrap the app.
   */
  async function init() {
    const params = new URLSearchParams(window.location.search);
    const sortParam = params.get('sort');
    const picksParam = params.get('picks');
    const sectionParam = params.get('section');
    const htSortParam = params.get('htsort');

    // Restore ads sort
    if (sortParam && ['views', 'engagement', 'trending'].includes(sortParam)) {
      leaderboard.sortMode = sortParam;
      document.querySelectorAll('#ads-section .sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === sortParam);
        b.setAttribute('aria-checked', b.dataset.sort === sortParam ? 'true' : 'false');
      });
    }

    // Restore halftime sort
    if (htSortParam && ['views', 'engagement', 'year'].includes(htSortParam)) {
      halftimeLeaderboard.sortMode = htSortParam;
      document.querySelectorAll('.ht-sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === htSortParam);
        b.setAttribute('aria-checked', b.dataset.sort === htSortParam ? 'true' : 'false');
      });
    }

    if (picksParam) {
      leaderboard.loadSharedPicks(picksParam.split(',').filter(Boolean));
    }

    // Wire everything
    startCountdown();
    wireSectionNav();
    wireSortControls();
    wireHalftimeSortControls();
    wireSearch();
    wireHalftimeSearch();
    wireShareLeaderboard();
    wireBallot();
    retryBtn.addEventListener('click', refresh);
    htRetryBtn.addEventListener('click', refreshHalftime);

    leaderboard.onPickChange = (picks) => updateBallot(picks);
    updateBallot(leaderboard.picks);

    // Switch to halftime section if deep-linked
    if (sectionParam === 'halftime') {
      switchSection('halftime');
    }

    // Load ads
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

    // Pre-load halftime if starting on that section
    if (activeSection === 'halftime') {
      await loadHalftime();
    }
  }

  // ===================== SECTION NAVIGATION =====================

  function wireSectionNav() {
    sectionNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        switchSection(btn.dataset.section);
      });
    });
  }

  function switchSection(section) {
    if (section === activeSection) return;

    // Save scroll position for current section
    sectionScrollPositions[activeSection] = window.scrollY;

    activeSection = section;

    // Update nav buttons
    sectionNavBtns.forEach(btn => {
      const isActive = btn.dataset.section === section;
      btn.classList.toggle('section-nav__btn--active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Slide indicator
    if (section === 'halftime') {
      sectionIndicator.classList.add('section-nav__indicator--halftime');
    } else {
      sectionIndicator.classList.remove('section-nav__indicator--halftime');
    }

    // Toggle sections with animation
    if (section === 'ads') {
      halftimeSection.hidden = true;
      halftimeSection.classList.remove('section--active');
      adsSection.hidden = false;
      // Trigger reflow for animation
      void adsSection.offsetWidth;
      adsSection.classList.add('section--active');
    } else {
      adsSection.hidden = true;
      adsSection.classList.remove('section--active');
      halftimeSection.hidden = false;
      void halftimeSection.offsetWidth;
      halftimeSection.classList.add('section--active');
    }

    // Toggle ballot visibility (ads only)
    if (section === 'halftime') {
      ballot.hidden = true;
    } else {
      updateBallot(leaderboard.picks);
    }

    // Restore scroll position
    window.scrollTo(0, sectionScrollPositions[section] || 0);

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('section', section);
    history.replaceState(null, '', url);

    // Lazy-load halftime data on first visit
    if (section === 'halftime' && !halftimeLoaded) {
      loadHalftime();
    }
  }

  // ===================== ADS SECTION =====================

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

  // ===================== HALFTIME SECTION =====================

  async function loadHalftime() {
    try {
      showHtState('loading');

      // Load metadata
      const resp = await fetch(CONFIG.HALFTIME_IDS_PATH);
      if (!resp.ok) throw new Error('Failed to load halftime shows');
      const data = await resp.json();
      halftimeMetadata = data.shows || [];

      if (halftimeMetadata.length === 0) {
        showHtState('empty');
        return;
      }

      // Fetch stats from YouTube (non-fatal — show metadata even if API fails)
      const ids = halftimeMetadata.map(s => s.videoId).filter(Boolean);
      let statsMap = new Map();
      try {
        const stats = await api.fetchStats(ids);
        statsMap = new Map(stats.map(v => [v.id, v]));
      } catch (statsErr) {
        console.warn('Halftime YouTube stats unavailable:', statsErr.message);
      }

      mergedHalftime = halftimeMetadata.map(meta => {
        const live = statsMap.get(meta.videoId) || {};
        return {
          ...live,
          id: meta.videoId,
          artist: meta.artist,
          featuring: meta.featuring || null,
          year: meta.year,
          superBowl: meta.superBowl,
          songs: meta.songs || '',
          thumbnail: live.thumbnail || (meta.videoId ? `https://img.youtube.com/vi/${meta.videoId}/hqdefault.jpg` : ''),
          viewCount: live.viewCount || meta.viewCount || 0,
          likeCount: live.likeCount || meta.likeCount || 0,
          commentCount: live.commentCount || meta.commentCount || 0,
        };
      });

      renderHalftimeFiltered();
      updateHalftimeStatsBar(mergedHalftime);
      showHtState('content');
      halftimeLoaded = true;
    } catch (err) {
      showHtError(err.message);
    }
  }

  async function refreshHalftime() {
    halftimeLoaded = false;
    await loadHalftime();
  }

  function renderHalftimeFiltered() {
    let shows = mergedHalftime;
    if (htSearchQuery) {
      const q = htSearchQuery.toLowerCase();
      shows = mergedHalftime.filter(s => {
        const artist = (s.artist || '').toLowerCase();
        const feat = (s.featuring || '').toLowerCase();
        const songs = (s.songs || '').toLowerCase();
        const year = String(s.year);
        const sb = (s.superBowl || '').toLowerCase();
        return artist.includes(q) || feat.includes(q) || songs.includes(q) || year.includes(q) || sb.includes(q);
      });
    }

    if (shows.length === 0 && htSearchQuery) {
      showHtState('empty');
      return;
    }

    halftimeLeaderboard.render(shows);
    showHtState('content');
  }

  function showHtState(state) {
    htLoadingState.hidden = state !== 'loading';
    htErrorState.hidden = state !== 'error';
    htEmptyState.hidden = state !== 'empty';
    document.getElementById('halftime-leaderboard').hidden = state !== 'content';
  }

  function showHtError(msg) {
    htErrorMessage.textContent = msg || 'Something went wrong loading halftime shows.';
    showHtState('error');
  }

  function updateHalftimeStatsBar(shows) {
    const totalViews = shows.reduce((sum, s) => sum + s.viewCount, 0);
    const totalLikes = shows.reduce((sum, s) => sum + s.likeCount, 0);
    const years = shows.map(s => s.year);
    const span = years.length > 0 ? `${Math.min(...years)}\u2013${Math.max(...years)}` : '\u2014';

    document.getElementById('ht-stat-shows').textContent = shows.length;
    document.getElementById('ht-stat-views').textContent = formatCompact(totalViews);
    document.getElementById('ht-stat-likes').textContent = formatCompact(totalLikes);
    document.getElementById('ht-stat-span').textContent = span;
  }

  // ===================== COUNTDOWN =====================

  const countdownWrap = document.getElementById('countdown-wrap');
  const postgameWrap = document.getElementById('postgame-wrap');
  const postgameMessage = document.getElementById('postgame-message');
  const nextSbCountdown = document.getElementById('next-sb-countdown');
  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMins = document.getElementById('cd-mins');
  const cdSecs = document.getElementById('cd-secs');
  const nextCdDays = document.getElementById('next-cd-days');
  const nextCdHours = document.getElementById('next-cd-hours');
  const nextCdMins = document.getElementById('next-cd-mins');
  const nextCdSecs = document.getElementById('next-cd-secs');
  let countdownInterval = null;

  /**
   * Find the current and next Super Bowl from the schedule.
   */
  function getSuperbowlContext() {
    const now = new Date();
    const games = CONFIG.SUPER_BOWLS.map(sb => ({
      ...sb,
      kickoff: new Date(sb.date),
      gameEnd: new Date(new Date(sb.date).getTime() + 6 * 60 * 60 * 1000),
    }));

    // Find the current game (kickoff passed but less than 6 hours ago)
    const current = games.find(g => now >= g.kickoff && now < g.gameEnd);
    if (current) {
      const next = games.find(g => g.kickoff > current.kickoff);
      return { state: 'live', current, next };
    }

    // Find the next upcoming game
    const upcoming = games.find(g => now < g.kickoff);
    if (upcoming) {
      // Check if the previous game just ended (postgame wrap-up)
      const idx = games.indexOf(upcoming);
      const prev = idx > 0 ? games[idx - 1] : null;
      if (prev && now >= prev.gameEnd) {
        return { state: 'postgame', current: prev, next: upcoming };
      }
      return { state: 'pregame', current: upcoming, next: null };
    }

    // All games in the past — show last game as postgame
    const last = games[games.length - 1];
    return { state: 'postgame', current: last, next: null };
  }

  function startCountdown() {
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }

  function updateCountdown() {
    const now = new Date();
    const ctx = getSuperbowlContext();

    if (ctx.state === 'pregame') {
      // Counting down to the next kickoff
      countdownWrap.hidden = false;
      postgameWrap.hidden = true;
      const diff = ctx.current.kickoff - now;
      setCountdownDigits(cdDays, cdHours, cdMins, cdSecs, diff);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const dateStr = ctx.current.kickoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      contextMessage.textContent = days > 0
        ? `Big Game ${ctx.current.numeral} \u2014 ${dateStr}`
        : 'Kickoff today';
    } else if (ctx.state === 'live') {
      // Game is live
      countdownWrap.hidden = true;
      postgameWrap.hidden = false;
      postgameMessage.textContent = `GAME DAY \u2014 Big Game ${ctx.current.numeral} is LIVE. Stats updating every 2 minutes.`;
      nextSbCountdown.hidden = true;
    } else {
      // Postgame — show wrap message + next SB countdown
      countdownWrap.hidden = true;
      postgameWrap.hidden = false;
      postgameMessage.textContent = `That\u2019s a wrap on Big Game ${ctx.current.numeral} \u2014 thanks for watching the ads with us!`;

      if (ctx.next) {
        nextSbCountdown.hidden = false;
        const diff = ctx.next.kickoff - now;
        setCountdownDigits(nextCdDays, nextCdHours, nextCdMins, nextCdSecs, diff);
        const dateStr = ctx.next.kickoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        nextSbCountdown.querySelector('.next-sb-countdown__label').textContent =
          `Big Game ${ctx.next.numeral} \u2014 ${dateStr}`;
      } else {
        nextSbCountdown.hidden = true;
      }
    }
  }

  function setCountdownDigits(daysEl, hoursEl, minsEl, secsEl, diff) {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(mins).padStart(2, '0');
    secsEl.textContent = String(secs).padStart(2, '0');
  }

  // ===================== STATS BAR =====================

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

  // ===================== SORT CONTROLS =====================

  function wireSortControls() {
    document.querySelectorAll('#ads-section .sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ads-section .sort-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');

        leaderboard.sortMode = btn.dataset.sort;

        const url = new URL(window.location);
        url.searchParams.set('sort', btn.dataset.sort);
        history.replaceState(null, '', url);

        if (mergedAds.length > 0) renderFiltered();
      });
    });
  }

  function wireHalftimeSortControls() {
    document.querySelectorAll('.ht-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ht-sort-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');

        halftimeLeaderboard.sortMode = btn.dataset.sort;

        const url = new URL(window.location);
        url.searchParams.set('htsort', btn.dataset.sort);
        history.replaceState(null, '', url);

        if (mergedHalftime.length > 0) renderHalftimeFiltered();
      });
    });
  }

  // ===================== SEARCH =====================

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

  function wireHalftimeSearch() {
    if (!halftimeSearch) return;
    let debounceTimer;
    halftimeSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        htSearchQuery = halftimeSearch.value.trim();
        if (mergedHalftime.length > 0) renderHalftimeFiltered();
      }, 200);
    });
  }

  // ===================== SHARE =====================

  function wireShareLeaderboard() {
    if (!shareLeaderboardBtn) return;
    shareLeaderboardBtn.addEventListener('click', async () => {
      const sorted = [...mergedAds].sort((a, b) => b.viewCount - a.viewCount);
      const topAd = sorted[0];
      const totalViews = mergedAds.reduce((sum, a) => sum + a.viewCount, 0);

      const url = new URL(window.location);
      url.searchParams.set('sort', leaderboard.sortMode);
      url.searchParams.set('section', activeSection);
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

  // ===================== BALLOT =====================

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

  function updateBallot(picks) {
    if (!ballot || !ballotPicks) return;
    const pickArr = [...picks];

    // Only show ballot on ads section
    if (activeSection !== 'ads' || pickArr.length === 0) {
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

  // ===================== AUTO REFRESH =====================

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, CONFIG.REFRESH_INTERVAL);
  }

  // Boot
  init();
})();
