<div align="center">

# yubal

**Turn YouTube Music into a proper music library.**

One link in, tagged and organized files out. Albums sorted by artist and year. Playlists without duplicates. Media server ready.

[![CI](https://github.com/guillevc/yubal/actions/workflows/ci.yaml/badge.svg)](https://github.com/guillevc/yubal/actions/workflows/ci.yaml)
[![Release](https://img.shields.io/github/v/release/guillevc/yubal)](https://github.com/guillevc/yubal/releases)
[![Docker](https://img.shields.io/badge/ghcr.io-blue?logo=docker&logoColor=white)](https://ghcr.io/guillevc/yubal)
[![codecov](https://codecov.io/gh/guillevc/yubal/branch/master/graph/badge.svg)](https://codecov.io/gh/guillevc/yubal)

<picture>
  <img src="docs/demo.gif" alt="yubal demo">
</picture>

<sub>GIF is 3× speed</sub>

</div>

> [!IMPORTANT]
> **Upgrading from v0.1?** The folder structure and config has changed. See the [v0.2.0 release notes](https://github.com/guillevc/yubal/releases/tag/v0.2.0) for migration steps.

## Why yubal?

Downloading music is easy. _Organizing_ it is the hard part.

yubal takes a YouTube Music URL and produces a clean, tagged music library:

- **Albums** sorted into `Artist/Year - Album/` folders
- **Playlists** as M3U files—tracks go to their album folders, no duplicates
- **Metadata** from YouTube Music with fuzzy matching
- **Album art** embedded and saved alongside

Point your media server at the output folder. Done.

<details>
<summary>See folder structure</summary>

```
data/
├── Pink Floyd/
│   └── 1973 - The Dark Side of the Moon/
│       ├── 01 - Speak to Me.opus
│       ├── 02 - Breathe.opus
│       └── cover.jpg
│
├── Radiohead/
│   └── 1997 - OK Computer/
│       ├── 01 - Airbag.opus
│       ├── 02 - Paranoid Android.opus
│       └── cover.jpg
│
└── Playlists/
    ├── My Favorites.m3u
    └── My Favorites.jpg
```

When downloading a playlist, each track goes to its album folder—the M3U file just references them:

```m3u
#EXTM3U
#EXTINF:239,Pink Floyd - Breathe
../Pink Floyd/1973 - The Dark Side of the Moon/02 - Breathe.opus
#EXTINF:386,Radiohead - Paranoid Android
../Radiohead/1997 - OK Computer/02 - Paranoid Android.opus
```

</details>

## Features

**Works with any link** — Albums, playlists, or single tracks. Paste the URL, get organized files.

**Smart deduplication** — Download the same track across 10 playlists? It's stored once, referenced everywhere.

**Media server ready** — Tested with [Navidrome, Jellyfin, and Gonic](#-media-server-integration). Multi-artist tags work correctly.

**Reliable downloads** — Automatic retry on failures. Safe to interrupt. Never lose progress.

<details>
<summary>All features</summary>

- Web UI with real-time progress and job queue
- Native `opus` or transcode to `mp3`/`m4a`
- Fuzzy track matching for accurate metadata
- M3U playlist generation with relative paths
- Responsive design for mobile management

</details>

## Quick Start

```yaml
# compose.yaml
services:
  yubal:
    image: ghcr.io/guillevc/yubal:latest
    container_name: yubal
    user: 1000:1000
    ports:
      - 8000:8000
    environment:
      YUBAL_TZ: UTC
    volumes:
      - ./data:/app/data
      - ./config:/app/config
    restart: unless-stopped
```

> [!TIP]
> **Volume permissions:** The container runs as UID:GID 1000:1000 by default. If your host user has a different UID, either:
>
> - Change `user:` to match your UID:GID (run `id` to check), or
> - Set ownership on the volume directories: `sudo chown 1000:1000 data config`

```bash
docker compose up -d
# Open http://localhost:8000
```

## Configuration

| Variable              | Description                          | Default (Docker) |
| --------------------- | ------------------------------------ | ---------------- |
| `YUBAL_DATA`          | Music library output                 | `/app/data`      |
| `YUBAL_CONFIG`        | Config directory                     | `/app/config`    |
| `YUBAL_AUDIO_FORMAT`  | `opus`, `mp3`, or `m4a`              | `opus`           |
| `YUBAL_AUDIO_QUALITY` | Transcode quality (0=best, 10=worst) | `0`              |
| `YUBAL_TZ`            | Timezone (IANA format)               | `UTC`            |
| `YUBAL_LOG_LEVEL`     | `DEBUG`, `INFO`, `WARNING`, `ERROR`  | `INFO`           |

<details>
<summary>All options</summary>
| Variable             | Description            | Default (Docker) |
| -------------------- | ---------------------- | ---------------- |
| `YUBAL_HOST`         | Server bind address    | `0.0.0.0`        |
| `YUBAL_PORT`         | Server port            | `8000`           |
| `YUBAL_DEBUG`        | Debug mode             | `false`          |
| `YUBAL_CORS_ORIGINS` | Allowed CORS origins   | `["*"]`          |
| `YUBAL_RELOAD`       | Auto-reload (dev only) | `false`          |
| `YUBAL_TEMP`         | Temp directory         | System temp      |
</details>

## Media Server Integration

Point your media server at the output folder and scan. yubal writes proper multi-artist tags (`ARTISTS`) for correct artist linking.

| Server        | Setup                                                      |
| ------------- | ---------------------------------------------------------- |
| **Navidrome** | Works out of the box                                       |
| **Jellyfin**  | Enable "Use non-standard artists tags" in library settings |
| **Gonic**     | Set `GONIC_MULTI_VALUE_ARTIST=multi`                       |

<details>
<summary>Detailed setup guides</summary>

### Navidrome

No configuration required. Optionally, make imported playlists public:

```bash
ND_DEFAULTPLAYLISTPUBLICVISIBILITY=true
```

See [Navidrome docs](https://www.navidrome.org/docs/usage/configuration/options/).

### Jellyfin

For multi-artist support:

1. **Dashboard → Libraries → Music Library → Manage Library**
2. Check **Use non-standard artists tags**
3. Save and rescan

### Gonic

For multi-artist support:

```bash
GONIC_MULTI_VALUE_ARTIST=multi
GONIC_MULTI_VALUE_ALBUM_ARTIST=multi
```

M3U playlists with relative paths are not supported ([pending PR](https://github.com/sentriz/gonic/pull/537)).

</details>

## Cookies (Optional)

Need age-restricted content, private playlists, or Premium quality? Add your cookies:

1. Export with a browser extension ([yt-dlp guide](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp))
2. Place at `config/ytdlp/cookies.txt` or upload via the web UI

> [!CAUTION]
> Cookie usage may trigger stricter rate limiting and could put your account at risk. See [#3](https://github.com/guillevc/yubal/issues/3) and [yt-dlp wiki](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#youtube).

## What's Coming

- [x] Cookie import via Web UI
- [x] Multi-arch Docker images
- [x] Configurable audio format
- [x] Playlist support with M3U generation
      ([v0.2.0](https://github.com/guillevc/yubal/releases/tag/v0.2.0))
- [x] Single track downloads
      ([v0.3.0](https://github.com/guillevc/yubal/releases/tag/v0.3.0))
- [ ] Download lyrics
- [ ] Flat folder mode
- [ ] Browser extension
- [ ] Batch import
- [ ] Post-download webhooks
- [ ] Auto-sync playlists
- [ ] New music automatic discovery

## Support

If yubal is useful to you, consider supporting its development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/guillevc)

[![Sponsor](https://img.shields.io/badge/sponsor-GitHub-ea4aaa?logo=github)](https://github.com/sponsors/guillevc)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=guillevc/yubal&type=Date)](https://star-history.com/#guillevc/yubal&Date)

## Acknowledgments

Built with [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ytmusicapi](https://github.com/sigma67/ytmusicapi).

Thanks to everyone who's starred, shared, or contributed.

## License

[MIT](LICENSE)

---

<sub>For personal archiving only. Comply with YouTube's Terms of Service and applicable copyright laws.</sub>
