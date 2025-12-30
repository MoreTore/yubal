<div align="center">

# yubal

**YouTube albums, downloaded and tagged automatically**

[![ci](https://github.com/guillevc/yubal/actions/workflows/ci.yaml/badge.svg)](https://github.com/guillevc/yubal/actions/workflows/ci.yaml)
[![GitHub Release](https://img.shields.io/github/v/release/guillevc/yubal)](https://github.com/guillevc/yubal/releases)
[![Docker](https://img.shields.io/badge/Docker-ghcr-blue?logo=docker&logoColor=white)](https://ghcr.io/guillevc/yubal)
[![License: MIT](https://img.shields.io/badge/License-MIT-white)](LICENSE)

<picture>
  <img src="docs/demo.gif" alt="Demo" width="700">
</picture>
</div>

## How It Works

Paste a YouTube Music album URL, and _yubal_ handles the rest:

```
                                 ┌──────────┐
                ┌─────────┐      │ Spotify  │
                │ YouTube │      │ metadata │
                └──────▲──┘      └──▲───────┘
                       │            │
                    ┌──────────────────┐
                    │       yubal      │──────► /Artist/Year - Album
YouTube Music ─────►│                  │        ├─01 - Track.opus
  Album URLs        │ (yt-dlp + beets) │        ├─02 - Track.opus
                    └──────────────────┘        ├─...
                                                └─cover.jpg
```

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — Downloads audio from YouTube/YouTube Music
- **[beets](https://beets.io)** — Auto-tags music using Spotify metadata

## Features

- Web UI for submitting albums and monitoring progress
- Sequential job queue — one download at a time, no conflicts
- Auto-tagging via MusicBrainz + Spotify
- Album art fetching and embedding
- Docker-ready with multi-arch support

## Quick Start

```yaml
# compose.yaml
---
services:
  yubal:
    image: ghcr.io/guillevc/yubal:dev
    environment:
      YUBAL_TZ: UTC
    ports:
      - 8000:8000
    volumes:
      - ./data:/app/data
      - ./beets:/app/beets
      - ./ytdlp:/app/ytdlp
```

Open [http://localhost:8000](http://localhost:8000) and paste a YouTube Music album URL.

> You can upload your YouTube cookies to be used by yubal from the Web UI or by adding `cookies.txt` to your `yt-dlp` folder.
>
> This is only required for age-restricted or private content.
> Although If you own a premium YouTube account, you may also benefit from better audio quality when downloading with your extracted cookies.
>
> More information here: https://github.com/yt-dlp/yt-dlp/wiki/Extractors#youtube

## Configuration

> Default audio settings will output `opus` audio files without transcoding.
>
> Transcoding at best quality will be performed if source is different from `opus` (rare cases).

All configuration is done via Environment Variables. You can override any of these via `environment` if running in Docker or by `.env` file when running locally.

| Variable              | Description                     | Docker       | Local       |
| --------------------- | ------------------------------- | ------------ | ----------- |
| `YUBAL_HOST`          | Server bind address             | `0.0.0.0`    | `127.0.0.1` |
| `YUBAL_PORT`          | Server port                     | `8000`       | `8000`      |
| `YUBAL_DATA_DIR`      | Music library output            | `/app/data`  | `./data`    |
| `YUBAL_BEETS_DIR`     | Beets config + database         | `/app/beets` | `./beets`   |
| `YUBAL_YTDLP_DIR`     | yt-dlp config (cookies)         | `/app/ytdlp` | `./ytdlp`   |
| `YUBAL_AUDIO_FORMAT`  | Output format                   | `opus`       | `opus`      |
| `YUBAL_AUDIO_QUALITY` | Transcoding quality (VBR scale) | `0`          | `0`         |
| `YUBAL_TZ`            | Timezone (IANA format)          | `UTC`        | `UTC`       |

## Acknowledgments

- Color scheme: [Flexoki](https://stephango.com/flexoki) by Steph Ango
- https://github.com/yt-dlp/yt-dlp
- https://github.com/beetbox/beets

## License

[MIT](LICENSE)

## Disclaimer

This software is provided for **personal use only**. Users are responsible
for complying with YouTube's Terms of Service and applicable copyright laws
in their jurisdiction.

The authors are not responsible for any misuse of this software.
