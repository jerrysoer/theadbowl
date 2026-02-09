/**
 * TheAdBowl — Halftime Show Leaderboard Renderer
 * Mirrors Leaderboard pattern with magenta accent and year-based sorting.
 */
class HalftimeLeaderboard {
  constructor(containerEl) {
    this._container = containerEl;
    this._sortMode = 'views';
    this._previousRanks = new Map();
  }

  get sortMode() { return this._sortMode; }
  set sortMode(mode) { this._sortMode = mode; }

  render(shows) {
    const sorted = this._sort(shows);
    const newRanks = new Map();
    sorted.forEach((show, i) => newRanks.set(show.id, i + 1));

    this._container.innerHTML = '';
    sorted.forEach((show, i) => {
      const rank = i + 1;
      const prevRank = this._previousRanks.get(show.id);
      const rankDelta = prevRank != null ? prevRank - rank : 0;
      const card = this._createCard(show, rank, rankDelta);
      card.style.animationDelay = `${i * 60}ms`;
      this._container.appendChild(card);
    });

    this._previousRanks = newRanks;
  }

  _sort(shows) {
    const copy = [...shows];
    switch (this._sortMode) {
      case 'engagement':
        return copy.sort((a, b) => this._engagementRate(b) - this._engagementRate(a));
      case 'year':
        return copy.sort((a, b) => b.year - a.year);
      case 'views':
      default:
        return copy.sort((a, b) => b.viewCount - a.viewCount);
    }
  }

  _engagementRate(show) {
    if (!show.viewCount) return 0;
    return (show.likeCount + show.commentCount) / show.viewCount;
  }

  _createCard(show, rank, rankDelta) {
    const card = document.createElement('article');
    card.className = 'halftime-card' + (rank <= 3 ? ' halftime-card--featured' : '');
    card.setAttribute('aria-label', `Rank ${rank}: ${this._escape(show.artist)}`);
    card.dataset.videoId = show.id;

    const rankClass = rank === 1 ? 'halftime-card__rank--first'
      : rank === 2 ? 'halftime-card__rank--second'
      : rank === 3 ? 'halftime-card__rank--third' : '';

    let rankChangeHtml = '';
    if (rankDelta > 0) {
      rankChangeHtml = `<span class="halftime-card__rank-change halftime-card__rank-change--up" title="Up ${rankDelta}">&#9650;${rankDelta}</span>`;
    } else if (rankDelta < 0) {
      rankChangeHtml = `<span class="halftime-card__rank-change halftime-card__rank-change--down" title="Down ${Math.abs(rankDelta)}">&#9660;${Math.abs(rankDelta)}</span>`;
    }

    const lazyAttr = rank > 6 ? ' loading="lazy"' : '';
    const hasVideo = !!show.id;
    const videoUrl = hasVideo ? `https://www.youtube.com/watch?v=${this._escapeAttr(show.id)}` : '';
    const shareText = `${this._escape(show.artist)}'s Super Bowl ${this._escape(show.superBowl)} halftime show is #${rank} on TheAdBowl!${hasVideo ? ' ' + this._formatNumber(show.viewCount) + ' views' : ''}`;
    const embedId = this._escapeAttr(show.id);

    const featuringHtml = show.featuring
      ? `<p class="halftime-card__featuring">ft. ${this._escape(show.featuring)}</p>` : '';

    let playerHtml;
    if (hasVideo) {
      playerHtml = `
      <div class="halftime-card__player" data-video-id="${embedId}">
        <div class="halftime-card__thumbnail" aria-label="Watch on YouTube" role="button" tabindex="0">
          <img
            src="${this._escapeAttr(show.thumbnail)}"
            alt="${this._escapeAttr(show.artist)} Super Bowl ${this._escapeAttr(show.superBowl)} halftime show"
            width="640"
            height="360"
            ${lazyAttr}
          />
          <div class="halftime-card__play-btn" aria-hidden="true">
            <svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.64 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#FF0000"/><path d="M45 24L27 14v20" fill="#fff"/></svg>
          </div>
        </div>
      </div>`;
    } else {
      playerHtml = `
      <div class="halftime-card__player halftime-card__player--pending">
        <div class="halftime-card__coming-soon">${show.year === 2026 ? 'Video coming soon' : 'No video available'}</div>
      </div>`;
    }

    card.innerHTML = `
      <div class="halftime-card__rank-wrap">
        <span class="halftime-card__rank ${rankClass}">${rank}</span>
        ${rankChangeHtml}
      </div>
      ${playerHtml}
      <div class="halftime-card__body">
        <span class="halftime-card__year">Super Bowl ${this._escape(show.superBowl)} &middot; ${show.year}</span>
        <h3 class="halftime-card__artist">${this._escape(show.artist)}</h3>
        ${featuringHtml}
        <p class="halftime-card__songs">${this._escape(show.songs)}</p>
        ${hasVideo ? `<div class="halftime-card__stats">
          <div>
            <span class="halftime-card__stat-value">${this._formatNumber(show.viewCount)}</span>
            <span class="halftime-card__stat-label">Views</span>
          </div>
          <div>
            <span class="halftime-card__stat-value">${this._formatNumber(show.likeCount)}</span>
            <span class="halftime-card__stat-label">Likes</span>
          </div>
          <div>
            <span class="halftime-card__stat-value">${this._formatNumber(show.commentCount)}</span>
            <span class="halftime-card__stat-label">Comments</span>
          </div>
        </div>` : ''}
        <div class="halftime-card__actions">
          <button class="share-btn halftime-share-btn" data-action="share" data-url="${this._escapeAttr(videoUrl)}" data-text="${this._escapeAttr(shareText)}" data-title="${this._escapeAttr(show.artist + ' \u2014 Super Bowl ' + show.superBowl + ' Halftime')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>
        </div>
      </div>
    `;

    card.querySelector('.halftime-share-btn').addEventListener('click', (e) => this._handleShare(e));

    const thumb = card.querySelector('.halftime-card__thumbnail');
    if (thumb && show.id) {
      const ytUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(show.id)}`;
      const open = () => window.open(ytUrl, '_blank', 'noopener');
      thumb.addEventListener('click', open);
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    }

    return card;
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
