/**
 * TheAdBowl — Leaderboard Renderer
 */
class Leaderboard {
  constructor(containerEl) {
    this._container = containerEl;
    this._sortMode = 'views';
  }

  get sortMode() {
    return this._sortMode;
  }

  set sortMode(mode) {
    this._sortMode = mode;
  }

  /**
   * Render the leaderboard with sorted ad cards.
   */
  render(ads) {
    const sorted = this._sort(ads);
    this._container.innerHTML = '';

    sorted.forEach((ad, i) => {
      const rank = i + 1;
      const card = this._createCard(ad, rank);
      card.style.animationDelay = `${i * 60}ms`;
      this._container.appendChild(card);
    });
  }

  /**
   * Sort ads by current mode.
   */
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

  /**
   * Create a single ad card DOM element.
   */
  _createCard(ad, rank) {
    const card = document.createElement('article');
    card.className = 'ad-card' + (rank <= 3 ? ' ad-card--featured' : '');
    card.setAttribute('aria-label', `Rank ${rank}: ${this._escape(ad.brand)}`);

    const rankClass = rank === 1 ? 'ad-card__rank--gold'
      : rank === 2 ? 'ad-card__rank--silver'
      : rank === 3 ? 'ad-card__rank--bronze'
      : '';

    const trendingHtml = ad.trending > 0
      ? `<span class="ad-card__trending">${this._formatNumber(ad.trending)} views/refresh</span>`
      : '';

    const lazyAttr = rank > 6 ? ' loading="lazy"' : '';

    const videoUrl = `https://www.youtube.com/watch?v=${this._escapeAttr(ad.id)}`;
    const shareText = `${this._escape(ad.brand)} is #${rank} on TheAdBowl! ${this._formatNumber(ad.viewCount)} views`;

    const embedId = this._escapeAttr(ad.id);

    card.innerHTML = `
      <span class="ad-card__rank ${rankClass}">${rank}</span>
      <div class="ad-card__player" data-video-id="${embedId}">
        <div class="ad-card__thumbnail" aria-label="Play video" role="button" tabindex="0">
          <img
            src="${this._escapeAttr(ad.thumbnail)}"
            alt="${this._escapeAttr(ad.brand)} Super Bowl ad"
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
          <button class="share-btn" data-action="copy" data-url="${this._escapeAttr(videoUrl)}" data-text="${this._escapeAttr(shareText)}">
            Copy Link
          </button>
          <button class="share-btn" data-action="twitter" data-url="${this._escapeAttr(videoUrl)}" data-text="${this._escapeAttr(shareText)}">
            Share on X
          </button>
        </div>
      </div>
    `;

    // Wire up share buttons
    card.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this._handleShare(e));
    });

    // Wire up click-to-play embed
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

  /**
   * Replace thumbnail with YouTube iframe embed.
   */
  _embedVideo(playerEl) {
    if (!playerEl || playerEl.querySelector('iframe')) return;
    const videoId = playerEl.dataset.videoId;
    const iframe = document.createElement('iframe');
    iframe.className = 'ad-card__iframe';
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.setAttribute('title', 'YouTube video player');
    playerEl.innerHTML = '';
    playerEl.appendChild(iframe);
  }

  /**
   * Handle share button clicks.
   */
  async _handleShare(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const url = btn.dataset.url;
    const text = btn.dataset.text;

    if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = 'Copied!';
        btn.classList.add('share-btn--copied');
        setTimeout(() => {
          btn.textContent = 'Copy Link';
          btn.classList.remove('share-btn--copied');
        }, 2000);
      } catch {
        // Fallback for older browsers
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000);
      }
    } else if (action === 'twitter') {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(twitterUrl, '_blank', 'noopener,width=550,height=420');
    }
  }

  /**
   * Format numbers with K/M/B suffixes.
   */
  _formatNumber(num) {
    if (num == null) return '0';
    num = Number(num);
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  }

  /**
   * Escape HTML to prevent XSS.
   */
  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Escape for use in HTML attributes.
   */
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
