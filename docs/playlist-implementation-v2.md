# Playlist Support Implementation Plan

> **Date:** 2026-01-08
> **Status:** Ready for Implementation
> **Supersedes:** docs/playlist-implementation-plan.md

## Summary

Add YouTube Music playlist support to Yubal with the full workflow:
1. Enrich metadata (ytmusicapi) - search for album info on music videos
2. Download (yt-dlp) - includes thumbnail embedding
3. Patch metadata (mutagen) - overwrite with clean ytmusicapi data
4. Organize to `Playlists/{name}/`
5. Beets import (CLI flags: `--move=no --copy=no`)
6. Generate M3U

**Key decisions:**
- Backend auto-detects album vs playlist from URL (OLAK5uy_ = album)
- Use dataclasses for metadata structures
- File naming: `01 - Artist - Title.opus`
- Continue with partial results on failed tracks
- Search ytmusicapi for album info when tracks are missing it (music videos)
- Use existing beets config with CLI flags (no separate config file)
- Detailed progress phases in UI

---

## Files to Create

| File | Purpose |
|------|---------|
| `yubal/services/metadata_enricher.py` | ytmusicapi playlist fetching + album search |
| `yubal/services/metadata_patcher.py` | mutagen metadata patching |
| `yubal/services/m3u_generator.py` | M3U file generation |
| `tests/test_metadata_enricher.py` | Enricher unit tests |

## Files to Modify

| File | Changes |
|------|---------|
| `pyproject.toml` | Add `ytmusicapi>=1.9.0` |
| `yubal/core/enums.py` | Add `ImportType` enum + URL detection functions |
| `yubal/settings.py` | Add `playlists_dir` property |
| `yubal/services/sync.py` | Add `sync_playlist()` method |
| `yubal/services/tagger.py` | Add `tag_playlist()` with `--move=no --copy=no` flags |
| `yubal/api/routes/jobs.py` | Add URL type routing in `run_sync_job()` |

---

## Implementation Order

### Step 1: Foundation
```
pyproject.toml         - Add ytmusicapi>=1.9.0
yubal/core/enums.py    - Add ImportType enum + extract_playlist_id() + detect_import_type()
yubal/settings.py      - Add playlists_dir property
```

### Step 2: Metadata Services
```
yubal/services/metadata_enricher.py  - TrackMetadata, PlaylistMetadata dataclasses
                                     - MetadataEnricher.get_playlist()
                                     - MetadataEnricher._search_album() for music videos
yubal/services/metadata_patcher.py   - MetadataPatcher.patch_files()
yubal/services/m3u_generator.py      - generate_m3u()
```

### Step 3: Tagger Extension
```
yubal/services/tagger.py - Add tag_playlist() method:
                           - Same as tag_album() but passes --move=no --copy=no to beets
```

### Step 4: Sync Service
```
yubal/services/sync.py - Add sync_playlist() method:
  1. Enrich metadata via MetadataEnricher (0-10%)
     - Fetch playlist info
     - Search for album info on tracks missing it
  2. Download via existing downloader (10-60%)
     - yt-dlp handles thumbnail embedding
  3. Patch metadata via MetadataPatcher (60-70%)
     - Overwrite with clean ytmusicapi data
  4. Move files to Playlists/{name}/ (70-75%)
     - Rename to "01 - Artist - Title.opus" format
  5. Run beets via tag_playlist() (75-90%)
     - Uses --move=no --copy=no flags
  6. Generate M3U (90-100%)

  Error handling: Skip failed tracks, continue with partial results
```

### Step 5: API Routing
```
yubal/api/routes/jobs.py - In run_sync_job():
  import_type = detect_import_type(url)
  if import_type == ImportType.ALBUM:
      sync_service.sync_album(...)
  else:
      sync_service.sync_playlist(...)
```

### Step 6: Tests & Lint
```
tests/test_metadata_enricher.py  - Mock ytmusicapi, verify parsing
just format && just lint
```

---

## Key Code Snippets

### ImportType Enum + URL Detection (`yubal/core/enums.py`)
```python
import re
from enum import Enum

class ImportType(str, Enum):
    ALBUM = "album"
    PLAYLIST = "playlist"

# Album playlist IDs start with OLAK5uy_
_ALBUM_PREFIX = "OLAK5uy_"

def extract_playlist_id(url: str) -> str | None:
    """Extract playlist ID from YouTube Music URL."""
    match = re.search(r"list=([^&]+)", url)
    return match.group(1) if match else None

def detect_import_type(url: str) -> ImportType:
    """Detect whether URL is album or playlist."""
    playlist_id = extract_playlist_id(url)
    if playlist_id and playlist_id.startswith(_ALBUM_PREFIX):
        return ImportType.ALBUM
    return ImportType.PLAYLIST
```

### Settings Property (`yubal/settings.py`)
```python
@property
def playlists_dir(self) -> Path:
    return self.data_dir / "Playlists"
```

### Tagger.tag_playlist() (`yubal/services/tagger.py`)
```python
def tag_playlist(
    self,
    audio_files: list[Path],
    progress_callback: ProgressCallback | None = None,
) -> TagResult:
    """Tag playlist files without moving them."""
    # Same as tag_album but with --move=no --copy=no
    cmd = [
        sys.executable, "-m", "beets",
        "-c", str(self.beets_config),
        "import", "-q",
        "--move=no", "--copy=no",  # Keep files in place
        str(audio_files[0].parent),
    ]
    # ... rest same as tag_album
```

### MetadataEnricher dataclasses (`yubal/services/metadata_enricher.py`)
```python
from dataclasses import dataclass

@dataclass
class TrackMetadata:
    video_id: str
    title: str
    artist: str
    album: str | None
    thumbnail_url: str | None
    track_number: int
    is_available: bool

@dataclass
class PlaylistMetadata:
    playlist_id: str
    title: str
    track_count: int
    tracks: list[TrackMetadata]
```

---

## Output Structure

```
data/
├── {Artist}/                    # Albums (existing)
│   └── {Year} - {Album}/
└── Playlists/                   # Playlists (new)
    └── {Playlist Name}/
        ├── {Playlist Name}.m3u
        ├── 01 - Artist - Title.opus
        ├── 02 - Artist - Title.opus
        └── ...
```

---

## Testing

**Manual test URLs:**
- Album: `https://music.youtube.com/playlist?list=OLAK5uy_kckr2V4WvGQVbCsUNmNSLgYIM_od9SoFs`
- Playlist: `https://music.youtube.com/playlist?list=PLbE6wFkAlDUeDUu98GuzkCWm60QjYvagQ`

**Unit tests (`tests/test_metadata_enricher.py`):**
- Test `extract_playlist_id()` with various URL formats
- Test `detect_import_type()` OLAK5uy_ detection
- Mock ytmusicapi responses, verify TrackMetadata/PlaylistMetadata parsing

**Integration checklist:**
- [ ] URL detection correctly identifies album vs playlist
- [ ] Playlist tracks download to `Playlists/{name}/`
- [ ] Metadata patched with ytmusicapi data (clean titles/artists)
- [ ] M3U file generated with correct relative paths
- [ ] yt-dlp embeds thumbnails as album art
- [ ] Beets enriches in place (files don't move)
- [ ] Progress updates work through all 6 phases
- [ ] Cancellation works at each phase
- [ ] Failed tracks are skipped, rest continue
