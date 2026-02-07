"""
Scrape Big Game ad video IDs from YouTube search.

Usage:
    python scrape-ads.py

Requires GOOGLE_API_KEY in environment (YouTube Data API v3 enabled).
Outputs JSON to stdout — pipe to docs/data/video-ids.json.
"""

import json
import os
import sys
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError


API_KEY = os.environ.get("GOOGLE_API_KEY")
SEARCH_QUERY = "Super Bowl LX 2026 commercial ad"
MAX_RESULTS = 50


def search_youtube(query, max_results=25):
    if not API_KEY:
        print("Error: GOOGLE_API_KEY not set in environment", file=sys.stderr)
        sys.exit(1)

    params = urlencode({
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": min(max_results, 50),
        "order": "viewCount",
        "key": API_KEY,
    })

    url = f"https://www.googleapis.com/youtube/v3/search?{params}"
    req = Request(url, headers={"Accept": "application/json"})

    try:
        with urlopen(req) as resp:
            data = json.loads(resp.read().decode())
    except HTTPError as e:
        print(f"YouTube API error: {e.code} {e.reason}", file=sys.stderr)
        sys.exit(1)

    ads = []
    for item in data.get("items", []):
        video_id = item["id"]["videoId"]
        snippet = item["snippet"]
        ads.append({
            "videoId": video_id,
            "brand": snippet["channelTitle"],
            "adTitle": snippet["title"],
            "category": "",
            "celebrity": None,
        })

    return ads


def main():
    print(f"Searching YouTube for: {SEARCH_QUERY}", file=sys.stderr)
    ads = search_youtube(SEARCH_QUERY, MAX_RESULTS)
    print(f"Found {len(ads)} results", file=sys.stderr)

    output = {
        "event": "Big Game LX",
        "year": 2026,
        "lastUpdated": "2026-02-07",
        "ads": ads,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
