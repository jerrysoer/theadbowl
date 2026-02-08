/**
 * TheAdBowl — Leaderboard Renderer
 * Features: native share, rank changes, My Top 3 picks, celebrity display
 */
class Leaderboard {
  constructor(containerEl) {
    this._container = containerEl;
    this._sortMode = 'views';
    this._previousRanks = new Map();
    this._picks = new Set(JSON.parse(localStorage.getItem('adbowl_picks') || '[]'));
    this._onPickChange = null;
  }

  get sortMode() { return this._sortMode; }
  set sortMode(mode) { this._sortMode = mode; }
  get picks() { return this._picks; }
  set onPickChange(fn) { this._onPickChange = fn; }

  loadSharedPicks(pickIds) {
    if (pickIds && pickIds.length) {
      this._picks = new Set(pickIds.slice(0, 3));
      this._savePicks();
    }
  }

  render(ads) {
    const sorted = this._sort(ads);
    const newRanks = new Map();
    sorted.forEach((ad, i) => newRanks.set(ad.id, i + 1));

    this._container.innerHTML = '';
    sorted.forEach((ad, i) => {
      const rank = i + 1;
      const prevRank = this._previousRanks.get(ad.id);
      const rankDelta = prevRank != null ? prevRank - rank : 0;
      const card = this._createCard(ad, rank, rankDelta);
      card.style.animationDelay = `${i * 60}ms`;
      this._container.appendChild(card);
    });

    this._previousRanks = newRanks;
  }

  _sort(ads) {
    const copy = [...ads];
    switch (this._sortMode) {
      case 'engagement':
        return copy.sort((a, b) => this._engagementRate(b) - this._engagementRate(a));
      case 'trending':
        return copy.sort((a, b) => (b.trending || 0) - (a.trending || 0));
      case 'views':
      default:
        return copy.sort((a, b) => b.viewCount - a.viewCount);
    }
  }

  _engagementRate(ad) {
    if (!ad.viewCount) return 0;
    return (ad.likeCount + ad.commentCount) / ad.viewCount;
  }

  _createCard(ad, rank, rankDelta) {
    const card = document.createElement('article');
    card.className = 'ad-card' + (rank <= 3 ? ' ad-card--featured' : '');
    if (this._picks.has(ad.id)) card.classList.add('ad-card--picked');
    card.setAttribute('aria-label', `Rank ${rank}: ${this._escape(ad.brand)}`);
    card.dataset.videoId = ad.id;

    const rankClass = rank === 1 ? 'ad-card__rank--gold'
      : rank === 2 ? 'ad-card__rank--silver'
      : rank === 3 ? 'ad-card__rank--bronze' : '';

    let rankChangeHtml = '';
    if (rankDelta > 0) {
      rankChangeHtml = `<span class="ad-card__rank-change ad-card__rank-change--up" title="Up ${rankDelta}">&#9650;${rankDelta}</span>`;
    } else if (rankDelta < 0) {
      rankChangeHtml = `<span class="ad-card__rank-change ad-card__rank-change--down" title="Down ${Math.abs(rankDelta)}">&#9660;${Math.abs(rankDelta)}</span>`;
    }

    const trendingHtml = ad.trending > 0
      ? `<span class="ad-card__trending">${this._formatNumber(ad.trending)} views/refresh</span>`
      : '';

    const lazyAttr = rank > 6 ? ' loading="lazy"' : '';
    const videoUrl = `https://www.youtube.com/watch?v=${this._escapeAttr(ad.id)}`;
    const shareText = `${this._escape(ad.brand)} is #${rank} on TheAdBowl! ${this._formatNumber(ad.viewCount)} views`;
    const embedId = this._escapeAttr(ad.id);
    const isPicked = this._picks.has(ad.id);

    const celebrityHtml = ad.celebrity
      ? `<p class="ad-card__celebrity">${this._escape(ad.celebrity)}</p>` : '';

    card.innerHTML = `
      <div class="ad-card__rank-wrap">
        <span class="ad-card__rank ${rankClass}">${rank}</span>
        ${rankChangeHtml}
      </div>
      <div class="ad-card__player" data-video-id="${embedId}">
        <div class="ad-card__thumbnail" aria-label="Play video" role="button" tabindex="0">
          <img
            src="${this._escapeAttr(ad.thumbnail)}"
            alt="${this._escapeAttr(ad.brand)} Big Game ad"
            width="640"
            height="360"
            ${lazyAttr}
          />
          <div class="ad-card__play-btn" aria-hidden="true">
            <svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.64 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#FF0000"/><path d="M45 24L27 14v20" fill="#fff"/></svg>
          </div>
          ${trendingHtml}
        </div>
      </div>
      <div class="ad-card__body">
        ${ad.category ? `<span class="ad-card__category">${this._escape(ad.category)}</span>` : ''}
        <h3 class="ad-card__brand">${this._escape(ad.brand)}</h3>
        <p class="ad-card__title">${this._escape(ad.adTitle || ad.title)}</p>
        ${celebrityHtml}
        <div class="ad-card__stats">
          <div>
            <span class="ad-card__stat-value">${this._formatNumber(ad.viewCount)}</span>
            <span class="ad-card__stat-label">Views</span>
          </div>
          <div>
            <span class="ad-card__stat-value">${this._formatNumber(ad.likeCount)}</span>
            <span class="ad-card__stat-label">Likes</span>
          </div>
          <div>
            <span class="ad-card__stat-value">${this._formatNumber(ad.commentCount)}</span>
            <span class="ad-card__stat-label">Comments</span>
          </div>
        </div>
        <div class="ad-card__actions">
          <button class="share-btn" data-action="share" data-url="${this._escapeAttr(videoUrl)}" data-text="${this._escapeAttr(shareText)}" data-title="${this._escapeAttr(ad.brand + ' \u2014 Big Game Ad')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>
          <button class="pick-btn ${isPicked ? 'pick-btn--active' : ''}" data-video-id="${embedId}" aria-pressed="${isPicked}">
            ${isPicked ? '&#9733; Picked' : '&#9734; Pick'}
          </button>
        </div>
      </div>
    `;

    card.querySelector('.share-btn').addEventListener('click', (e) => this._handleShare(e));
    card.querySelector('.pick-btn').addEventListener('click', (e) => this._handlePick(e));

    const thumb = card.querySelector('.ad-card__thumbnail');
    if (thumb) {
      const play = () => this._embedVideo(card.querySelector('.ad-card__player'));
      thumb.addEventListener('click', play);
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
      });
    }

    return card;
  }

  _embedVideo(playerEl) {
    if (!playerEl || playerEl.querySelector('iframe')) return;
    const videoId = playerEl.dataset.videoId;
    const iframe = document.createElement('iframe');
    iframe.className = 'ad-card__iframe';
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.setAttribute('title', 'YouTube video player');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
    playerEl.innerHTML = '';
    playerEl.appendChild(iframe);
  }

  async _handleShare(e) {
    const btn = e.currentTarget;
    const url = btn.dataset.url;
    const text = btn.dataset.text;
    const title = btn.dataset.title;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: toggle inline share options
    const existing = btn.parentElement.querySelector('.share-fallback');
    if (existing) { existing.remove(); return; }

    const fallback = document.createElement('div');
    fallback.className = 'share-fallback';
    fallback.innerHTML = `
      <button class="share-fallback__btn" data-action="copy">Copy Link</button>
      <button class="share-fallback__btn" data-action="twitter">X / Twitter</button>
      <button class="share-fallback__btn" data-action="whatsapp">WhatsApp</button>
    `;
    btn.parentElement.appendChild(fallback);

    fallback.addEventListener('click', async (fe) => {
      const action = fe.target.dataset.action;
      if (!action) return;
      if (action === 'copy') {
        try {
          await navigator.clipboard.writeText(url);
          fe.target.textContent = 'Copied!';
          setTimeout(() => fallback.remove(), 1500);
        } catch {
          const input = document.createElement('input');
          input.value = url;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
          fe.target.textContent = 'Copied!';
          setTimeout(() => fallback.remove(), 1500);
        }
      } else if (action === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,width=550,height=420');
        fallback.remove();
      } else if (action === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank', 'noopener');
        fallback.remove();
      }
    });

    setTimeout(() => { if (fallback.parentElement) fallback.remove(); }, 5000);
  }

  _handlePick(e) {
    const btn = e.currentTarget;
    const videoId = btn.dataset.videoId;

    if (this._picks.has(videoId)) {
      this._picks.delete(videoId);
      btn.classList.remove('pick-btn--active');
      btn.innerHTML = '&#9734; Pick';
      btn.setAttribute('aria-pressed', 'false');
      btn.closest('.ad-card').classList.remove('ad-card--picked');
    } else {
      if (this._picks.size >= 3) {
        const oldest = this._picks.values().next().value;
        this._picks.delete(oldest);
        const oldCard = this._container.querySelector(`[data-video-id="${oldest}"]`);
        if (oldCard) {
          const oldBtn = oldCard.querySelector('.pick-btn');
          if (oldBtn) {
            oldBtn.classList.remove('pick-btn--active');
            oldBtn.innerHTML = '&#9734; Pick';
            oldBtn.setAttribute('aria-pressed', 'false');
          }
          oldCard.classList.remove('ad-card--picked');
        }
      }
      this._picks.add(videoId);
      btn.classList.add('pick-btn--active');
      btn.innerHTML = '&#9733; Picked';
      btn.setAttribute('aria-pressed', 'true');
      btn.closest('.ad-card').classList.add('ad-card--picked');
    }

    this._savePicks();
    if (this._onPickChange) this._onPickChange(this._picks);
  }

  _savePicks() {
    localStorage.setItem('adbowl_picks', JSON.stringify([...this._picks]));
  }

  _formatNumber(num) {
    if (num == null) return '0';
    num = Number(num);
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  }

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _escapeAttr(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
