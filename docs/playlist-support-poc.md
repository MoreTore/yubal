# YouTube Music Playlist Support - POC Findings & Implementation Plan

> **Date:** 2025-01-02
> **Updated:** 2026-01-02
> **Status:** POC Complete, Ready for Implementation

## Executive Summary

This document captures the research and POC testing for adding YouTube Music **playlist** support to Yubal.

### Key Finding (Refined)

**Track type determines metadata availability, not playlist type.**

| Track Type | yt-dlp Metadata? | YouTube Music UI? | Description Pattern |
|------------|------------------|-------------------|---------------------|
| Album track (auto-generated) | ✅ Full | ✅ Full | "Provided to YouTube by..." |
| Music video (official) | ❌ None | ✅ Full | "Director...", "Official video..." |
| Non-music video | ❌ None | ❌ None | Anything else |

**Important:** YouTube Music's web UI shows metadata for music videos that yt-dlp cannot access. The UI has its own metadata layer that enriches videos, but this is not available for download.

This means:
- **Album URLs** (`OLAK*`) → Always have metadata (album tracks)
- **Playlist URLs** (`PL*`) → Depends on what tracks were added
- **User playlists with album tracks** → Have full metadata!
- **Curated playlists (Top 100, etc.)** → Usually music videos, no yt-dlp metadata
- **Music videos** → Show metadata in browser but yt-dlp can't extract it

---

## Part 1: Problem Statement

### Current State
- Yubal currently supports YouTube Music **albums**
- Albums work well because yt-dlp provides rich metadata (album, artist, track)
- Beets + Spotify successfully enriches and organizes album tracks

### Goal
- Add support for YouTube Music **playlists** (e.g., "Trending 20 Spain")
- Playlists contain tracks from different albums/artists
- Need a strategy for organizing and tagging these mixed tracks

---

## Part 2: POC Testing Results

### Test URLs Used

| Type | URL | Title | Has Metadata? |
|------|-----|-------|---------------|
| Album | `OLAK5uy_kckr2V4WvGQVbCsUNmNSLgYIM_od9SoFs` | DINASTÍA by Peso Pluma | ✅ Yes |
| Playlist (curated) | `PL4fGSI1pDJn6sMPCoD7PdSlEgyUylgxuT` | Top 100 Songs Spain | ❌ No |
| Playlist (user) | `PLbE6wFkAlDUeDUu98GuzkCWm60QjYvagQ` | test123 public playlist | ✅ Yes |
| Personal mix | `RDTMAK5uy_lz2owBgwWf1mjzyn_NbxzMViQzIg8IAIg` | My Mix 2 | ⚠️ Needs auth |

### Key Finding: Same Song, Different Metadata

We tested "La Perla" by ROSALÍA in both contexts:
- **Album track** (Track 7 in LUX album)
- **Playlist track** (Track 2 in Trending 20 Spain)

| Field | Album Track | Playlist Track |
|-------|-------------|----------------|
| `album` | `"LUX"` | `None` |
| `artist` | `"ROSALÍA, Yahritza Y Su Esencia"` | `None` |
| `artists` | `['ROSALÍA', 'Yahritza Y Su Esencia']` | `None` |
| `track` | `"La Perla"` | `None` |
| `channel` | `"ROSALÍA"` | `"ROSALÍA"` |
| `creators` | `['ROSALÍA', 'Yahritza Y Su Esencia']` | `None` |
| `release_year` | `2025` | `2025` |
| `title` | `"La Perla"` | `"ROSALÍA - La Perla (Official Video) ft. Yahritza Y Su Esencia"` |
| Video ID | `w7pjt9ZH3NM` | `GkTWxDB21cA` |

### Critical Insight: Different Video IDs

- **Album tracks** point to album-specific audio versions with rich metadata
- **Playlist tracks** point to music videos with minimal metadata
- These are literally different videos on YouTube's backend

### Refined Understanding: Track Type, Not Playlist Type

**Original assumption:** "Albums have metadata, playlists don't"
**Corrected understanding:** "Album tracks have metadata, music videos don't"

Testing revealed that **user-created playlists can have full metadata** if the user added album tracks (not music videos) when creating the playlist:

| Source | Contains | Has Metadata? |
|--------|----------|---------------|
| Album URL (OLAK*) | Album tracks | ✅ Always |
| Top 100 Spain (PL*) | Music videos | ❌ Never |
| test123 playlist (PL*) | Album tracks | ✅ Yes! |

**Detection method:** Check the video description's first line:
```python
def is_album_track(track_info: dict) -> bool:
    """Album tracks are auto-generated uploads from distributors."""
    desc = track_info.get('description', '')
    return desc.startswith('Provided to YouTube by')

def has_album_metadata(track_info: dict) -> bool:
    """Check if track has rich album metadata."""
    return (
        track_info.get('album') is not None
        and track_info.get('artist') is not None
    )
```

### Cookie Testing Results

Cookies were tested to see if authentication provides additional metadata:

| Test | Result |
|------|--------|
| Metadata with cookies | No additional fields |
| Metadata without cookies | Same fields available |
| Bot detection | Cookies may trigger signature extraction errors |
| Personal playlists (RDTMAK*) | Require auth, but follow same metadata rules |

**Conclusion:** Cookies provide no benefit for metadata extraction and may cause issues with YouTube's bot detection. Unauthenticated extraction is preferred.

### YouTube Music UI vs yt-dlp Metadata

**Important finding:** YouTube Music's web UI shows metadata for music videos that yt-dlp cannot access.

Testing playlist with mixed content types:

| Track | Type | yt-dlp Metadata? | YouTube Music UI Shows? |
|-------|------|------------------|------------------------|
| S P E Y S I D E | Album track | ✅ Full | ✅ Full |
| Latin Girl | Album track | ✅ Full | ✅ Full |
| A COLD PLAY | Album track | ✅ Full | ✅ Full |
| luther | Album track | ✅ Full | ✅ Full |
| 40.000 de vida... | Non-music video | ❌ None | ❌ None |
| ME INCREPAN... | Non-music video | ❌ None | ❌ None |
| Holocene (Official Video) | **Music video** | ❌ None | ✅ Full |

**Key insight:** YouTube Music has a **separate metadata layer** that enriches music videos with album/artist information in their web UI. This metadata exists in YouTube Music's database but is not:
- Embedded in the video file
- Accessible via yt-dlp's extraction
- Part of the YouTube Data API v3 (which doesn't expose music-specific metadata)

This means music videos like "Holocene" show correct artist/album in YouTube Music's interface, but when downloaded via yt-dlp, this enrichment is lost.

**Implication for implementation:** We cannot rely on YouTube Music's UI metadata - we must work with what yt-dlp provides, which means music videos will always lack album/artist metadata regardless of what the user sees in the browser.

### Available Fields for Playlist Tracks

From full extraction of playlist track:
```
channel: ROSALÍA              # Artist (reliable)
title: ROSALÍA - La Perla (Official Video) ft. Yahritza Y Su Esencia  # Messy
description: Contains 'LUX' Out Now...  # Sometimes has album hint
tags: ['ROSALÍA', 'LUX', ...]  # Sometimes has album name
release_year: 2025            # Video upload year (may differ from song release)
playlist_title: Trending 20 Spain  # Playlist name
playlist_index: 2             # Track position in playlist
```

---

## Part 3: Beets Matching Tests

### Test 1: Album Import Mode
```bash
beet import -q /tmp/yubal_playlist
# Result: "Importing as-is" - no match found
```

**Why it failed:**
- The "album" field is playlist title ("Trending 20 Spain")
- This album doesn't exist in MusicBrainz/Spotify
- Beets has nothing to match against

### Test 2: Singleton Import Mode
```bash
beet import --singleton -q /tmp/yubal_singleton
# Result: "Importing as-is" for both tracks
```

**Why it failed:**
- Messy titles make matching unreliable
- No album context for disambiguation
- Files went to `Non-Album/` with messy filenames

### Beets Matching Requirements

For reliable matching, beets needs:
1. **Clean title** - just the song name
2. **Artist name** - clean, not embedded in title
3. **Album name** - that exists in music databases

Playlist tracks only have #2 (from `channel` field). Without a real album name, beets cannot match.

---

## Part 4: Solution - Playlist as Pseudo-Album

### Approach

Treat playlists as "virtual albums" using playlist-level metadata:

```python
# yt-dlp metadata mapping for playlists
album = playlist_title      # e.g., "Trending 20 Spain"
artist = channel            # e.g., "Bizarrap"
track = playlist_index      # e.g., 1, 2, 3...
artwork = playlist_thumbnail
```

### Resulting File Structure
```
Playlists/
└── Trending 20 Spain/
    ├── 01 - J BALVIN - BZRP Music Sessions.opus
    ├── 02 - ROSALÍA - La Perla.opus
    └── 03 - La Oreja de Van Gogh - Todos Estamos Bailando.opus
```

### Embedded Metadata
```
title:  J BALVIN || BZRP Music Sessions #62/66
artist: Bizarrap
album:  Trending 20 Spain
track:  1
```

### POC Verification
```python
# Test download with playlist metadata
ydl_opts = {
    'postprocessors': [
        {
            'key': 'MetadataParser',
            'when': 'pre_process',
            'actions': [
                (Actions.INTERPRET, 'playlist_title', '%(meta_album)s'),
                (Actions.INTERPRET, 'channel', '%(meta_artist)s'),
                (Actions.INTERPRET, 'playlist_index', '%(meta_track)s'),
            ],
        },
        {'key': 'FFmpegMetadata', 'add_metadata': True},
        {'key': 'EmbedThumbnail'},
    ],
}
```

**Result:** Successfully embedded metadata with `album: Trending 20 Spain`

---

## Part 5: Implementation Plan

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Folder organization | `Playlists/{playlist_title}/` | Keeps playlists together, separate from albums |
| Metadata source | Depends on track type | Album tracks have metadata; music videos don't |
| Album field | `album` if present, else `playlist_title` | Use real album when available |
| Artist field | `artist` if present, else `channel` | Use structured artist when available |
| Artwork | Playlist thumbnail | Consistent for all tracks |
| Beets usage | Skip for music video playlists | Can't match without album/artist metadata |
| Detection | Check first track's metadata | Auto-detect, allow user override |

### Implementation Strategy Options

Given the refined understanding, there are three possible approaches:

#### Option A: Simple (Recommended for v1)
Treat all playlist imports as pseudo-albums regardless of track metadata.

**What "pseudo-album" means:** Use the playlist itself as the organizing unit, ignoring any album/artist metadata that individual tracks might have.

Example - playlist "test123" containing:
- Track 1: "S P E Y S I D E" (has `album: "SABLE, fABLE"`, `artist: "Bon Iver"`)
- Track 2: "Latin Girl" (has `album: "OT GALA 9"`, `artist: "Claudia Arenas"`)

**Pseudo-album result:**
```
Playlists/
└── test123 public playlist/      ← playlist_title becomes "album"
    ├── 01 - Bon Iver - S P E Y S I D E.opus
    └── 02 - Claudia Arenas - Latin Girl.opus

Embedded metadata:
  album: "test123 public playlist"  ← IGNORES the real album
  artist: "Bon Iver"                ← from channel field
  track: 1
```

**Alternative (use real metadata) would scatter tracks:**
```
Bon Iver/
└── 2024 - SABLE, fABLE/
    └── S P E Y S I D E.opus

Claudia Arenas/
└── OT GALA 9/
    └── Latin Girl.opus
```

The pseudo-album approach keeps the playlist together as a cohesive unit, which is typically what users want when importing a playlist.

**Example - playlist with only music videos (no metadata):**

"Top 100 Spain" containing:
- Track 1: title="Niña Pastori - Palillos y Panderos", channel="Niña Pastori Oficial", album=None
- Track 2: title="ROSALÍA - La Perla (Official Video)", channel="ROSALÍA", album=None

```
Playlists/
└── Top 100 Songs Spain/
    ├── 01 - Niña Pastori Oficial - Niña Pastori - Palillos y Panderos.opus
    └── 02 - ROSALÍA - ROSALÍA - La Perla (Official Video).opus

Embedded metadata:
  album: "Top 100 Songs Spain"
  artist: "Niña Pastori Oficial"  ← channel (only option)
  track: 1
```

Note: Titles are messy ("Official Video", artist in title) but this is unavoidable for music video tracks.

**Example - mixed playlist (some album tracks, some videos):**

Hypothetical "My Favorites" containing:
- Track 1: "S P E Y S I D E" (album track - has `album: "SABLE, fABLE"`)
- Track 2: "La Perla (Official Video)" (music video - `album: None`)

```
Playlists/
└── My Favorites/
    ├── 01 - Bon Iver - S P E Y S I D E.opus         ← clean title (album track)
    └── 02 - ROSALÍA - La Perla (Official Video).opus  ← messy title (video)

Embedded metadata for track 1:
  album: "My Favorites"    ← pseudo-album (ignores real "SABLE, fABLE")
  artist: "Bon Iver"
  track: 1

Embedded metadata for track 2:
  album: "My Favorites"    ← pseudo-album (no real album anyway)
  artist: "ROSALÍA"
  track: 2
```

Both tracks get consistent handling despite different source types.

- **Pro:** Simple, consistent behavior
- **Pro:** Works for all playlist types
- **Pro:** Keeps playlist as a collection
- **Con:** Doesn't leverage available metadata on some playlists
- **Con:** Messy titles on music video tracks

#### Option B: Smart Detection
Check each track for metadata and branch:
- Tracks with `album` field → Could use beets for enrichment
- Tracks without `album` field → Use pseudo-album approach
- **Pro:** Best metadata when available
- **Con:** Complex, mixed playlists get inconsistent handling

#### Option C: Per-Playlist Detection
Check first track to determine playlist type, apply consistent strategy:
- If first track has metadata → Treat as collection of album tracks
- If first track lacks metadata → Use pseudo-album approach
- **Pro:** Consistent per-playlist
- **Con:** May misclassify mixed playlists

**Recommendation:** Start with Option A for simplicity, consider Option C later.

### Files to Modify

| File | Changes |
|------|---------|
| `yubal/core/enums.py` | Add `ImportType` enum (ALBUM, PLAYLIST) |
| `yubal/core/models.py` | Add `import_type` to `AlbumInfo` and `Job` |
| `yubal/schemas/jobs.py` | Add `import_type` to request schema |
| `yubal/api/routes/jobs.py` | Accept and pass `import_type` |
| `yubal/services/downloader.py` | Add playlist-specific postprocessors |
| `yubal/services/sync.py` | Branch logic for album vs playlist |
| `web/src/...` | Add import type toggle |

### Implementation Steps

1. **Domain Model Updates**
   - Add `ImportType` enum to `enums.py`
   - Add `import_type` field to models

2. **API Updates**
   - Add `import_type` to job creation schema
   - Pass through to sync service

3. **Downloader Updates**
   - Add `_get_playlist_postprocessors()` method
   - Embed playlist metadata (title, channel, index)

4. **Sync Service Updates**
   - Branch on `import_type`
   - For playlists: download → organize (skip beets)
   - For albums: existing flow (download → beets)

5. **File Organization**
   - Create `Playlists/{playlist_title}/` directory
   - Move files directly (no beets involvement)

6. **Frontend Updates**
   - Add toggle for import type
   - Show auto-detected type but allow override

---

## Part 6: Limitations & Considerations

### Year/Date Reliability
- Album tracks: `release_date` = actual album release
- Playlist tracks: `release_date` = video upload date
- For playlist tracks, the year may not reflect the original song release

### Title Noise
- Playlist track titles contain "(Official Video)", "ft.", etc.
- No reliable way to clean without regex heuristics
- Accepted as trade-off for simplicity

### Album Hints in Description
- Some tracks have album name in description (e.g., "'LUX' Out Now")
- Only ~20% of tracks have this
- Not reliable enough to use programmatically

### Genre Information
- Skipping beets means no LastFM genre lookup
- Tracks will have YouTube's generic "Music" genre
- Acceptable trade-off for reliability

---

## Part 7: Test Cases

### Integration Test URLs

```python
# Album test (existing flow should still work)
album_url = "https://music.youtube.com/playlist?list=OLAK5uy_kckr2V4WvGQVbCsUNmNSLgYIM_od9SoFs"  # DINASTÍA

# Playlist test - music videos (no metadata)
playlist_no_meta = "https://music.youtube.com/playlist?list=PL4fGSI1pDJn6sMPCoD7PdSlEgyUylgxuT"  # Top 100 Spain

# Playlist test - album tracks (has metadata)
playlist_with_meta = "https://music.youtube.com/playlist?list=PLbE6wFkAlDUeDUu98GuzkCWm60QjYvagQ"  # test123
```

### Expected Results

**Album Import:**
```
data/
└── Peso Pluma/
    └── 2025 - DINASTÍA/
        ├── 01 - intro.opus
        ├── 02 - ...
        └── (beets-enriched metadata)
```

**Playlist Import (music videos - no metadata):**
```
data/
└── Playlists/
    └── Top 100 Songs Spain/
        ├── 01 - Niña Pastori - Palillos y Panderos.opus
        ├── 02 - ROSALÍA - La Perla (Official Video).opus
        └── (yt-dlp pseudo-album metadata)
```

**Playlist Import (album tracks - has metadata):**
```
data/
└── Playlists/
    └── test123 public playlist/
        ├── 01 - S P E Y S I D E.opus          # Has album: "SABLE, fABLE"
        ├── 02 - Latin Girl.opus               # Has album: "OT GALA 9"
        └── (original album metadata preserved)
```

---

## Appendix: yt-dlp Postprocessor Configuration

```python
# For albums (existing)
def _get_album_postprocessors(self):
    return [
        {'key': 'FFmpegExtractAudio', ...},
        {
            'key': 'MetadataParser',
            'when': 'pre_process',
            'actions': [
                (Actions.INTERPRET, 'playlist_index', '%(meta_track)s'),
                (Actions.INTERPRET, 'release_date', '%(meta_date)s'),
                (Actions.INTERPRET, '%(artists.0)s', '%(meta_artist)s'),
            ],
        },
        {'key': 'FFmpegMetadata', 'add_metadata': True},
        {'key': 'EmbedThumbnail'},
    ]

# For playlists (new)
def _get_playlist_postprocessors(self):
    return [
        {'key': 'FFmpegExtractAudio', ...},
        {
            'key': 'MetadataParser',
            'when': 'pre_process',
            'actions': [
                (Actions.INTERPRET, 'playlist_title', '%(meta_album)s'),
                (Actions.INTERPRET, 'channel', '%(meta_artist)s'),
                (Actions.INTERPRET, 'playlist_index', '%(meta_track)s'),
            ],
        },
        {'key': 'FFmpegMetadata', 'add_metadata': True},
        {'key': 'EmbedThumbnail'},
    ]
```
