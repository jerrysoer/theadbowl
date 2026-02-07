"""
Refresh video-ids.json with new Super Bowl LX ads from YouTube search.

Merges new discoveries into the existing file without overwriting
curated metadata (brand, category, celebrity) for existing entries.

Usage:
    GOOGLE_API_KEY=... python scripts/refresh-ads.py

Exits with code 0 if changes were made, 1 if no new ads found.
"""

import json
import os
import sys
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'docs', 'data', 'video-ids.json')
API_KEY = os.environ.get('GOOGLE_API_KEY')

SEARCH_QUERIES = [
    'Super Bowl LX 2026 commercial',
    'Super Bowl 2026 ad full',
    'Super Bowl 60 commercial 2026',
]
MAX_RESULTS_PER_QUERY = 50


def search_youtube(query, max_results=50):
    """Search YouTube for videos matching the query."""
    params = urlencode({
        'part': 'snippet',
        'q': query,
        'type': 'video',
        'maxResults': min(max_results, 50),
        'order': 'viewCount',
        'key': API_KEY,
    })

    url = f'https://www.googleapis.com/youtube/v3/search?{params}'
    req = Request(url, headers={'Accept': 'application/json'})

    try:
        with urlopen(req) as resp:
            data = json.loads(resp.read().decode())
    except HTTPError as e:
        print(f'YouTube API error: {e.code} {e.reason}', file=sys.stderr)
        return []

    results = []
    for item in data.get('items', []):
        video_id = item['id']['videoId']
        snippet = item['snippet']
        results.append({
            'videoId': video_id,
            'brand': snippet['channelTitle'],
            'adTitle': snippet['title'],
            'category': '',
            'celebrity': None,
        })

    return results


def main():
    if not API_KEY:
        print('Error: GOOGLE_API_KEY not set', file=sys.stderr)
        sys.exit(2)

    # Load existing data
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)

    existing_ids = {ad['videoId'] for ad in data['ads']}
    print(f'Existing ads: {len(existing_ids)}', file=sys.stderr)

    # Search for new ads
    new_ads = []
    seen = set(existing_ids)

    for query in SEARCH_QUERIES:
        print(f'Searching: {query}', file=sys.stderr)
        results = search_youtube(query, MAX_RESULTS_PER_QUERY)
        for ad in results:
            if ad['videoId'] not in seen:
                seen.add(ad['videoId'])
                new_ads.append(ad)

    if not new_ads:
        print('No new ads found.', file=sys.stderr)
        sys.exit(1)

    print(f'Found {len(new_ads)} new ads:', file=sys.stderr)
    for ad in new_ads:
        print(f'  - {ad["brand"]}: {ad["adTitle"]}', file=sys.stderr)

    # Merge into existing data
    data['ads'].extend(new_ads)
    data['lastUpdated'] = __import__('datetime').date.today().isoformat()

    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)
        f.write('\n')

    print(f'Updated {DATA_FILE} with {len(new_ads)} new ads (total: {len(data["ads"])})', file=sys.stderr)
    sys.exit(0)


if __name__ == '__main__':
    main()
