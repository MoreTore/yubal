# Yubal Codebase Analysis

## 1. Project Overview

### What is Yubal?

**Yubal** is a self-hosted YouTube Music album/playlist downloader with automatic metadata tagging. It provides a web-based interface for downloading music from YouTube Music with proper metadata enrichment using yt-dlp for downloading and custom metadata extraction.

### Project Type
- **Full-Stack Web Application** with:
  - Python/FastAPI backend API
  - React/TypeScript frontend SPA
  - Docker containerization for deployment
  - CLI tools for direct library usage

### Tech Stack Summary

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 4, HeroUI |
| **Backend** | Python 3.12, FastAPI, Pydantic, uvicorn |
| **Core Library** | yt-dlp, ytmusicapi, mediafile, rapidfuzz |
| **Build Tools** | uv (Python), Bun (Node), just (task runner) |
| **Testing** | pytest (Python), Bun test (TypeScript) |
| **CI/CD** | GitHub Actions, Docker (GHCR) |
| **Deployment** | Docker multi-arch (amd64/arm64) |

### Architecture Pattern
- **Monorepo with workspace packages**
- **Service-oriented architecture** with clean separation
- **Protocol-based dependency injection** for testability
- **Event-driven job queue** for background processing

### Languages & Versions
- Python 3.12+ (strict type annotations with ruff)
- TypeScript 5.9+ (strict mode enabled)
- ES2022 target for modern JavaScript features

---

## 2. Detailed Directory Structure Analysis

```
yubal/
├── packages/                    # Python workspace packages (uv workspace)
│   ├── yubal/                   # Core library - extraction & download logic
│   │   ├── src/yubal/
│   │   │   ├── services/        # Business logic services
│   │   │   ├── models/          # Domain models (Pydantic)
│   │   │   ├── utils/           # Utility functions
│   │   │   ├── client.py        # YTMusic API client wrapper
│   │   │   ├── config.py        # Configuration dataclasses
│   │   │   ├── exceptions.py    # Custom exception hierarchy
│   │   │   └── cli.py           # CLI interface
│   │   └── tests/               # pytest test suite
│   │
│   └── api/                     # FastAPI backend application
│       └── src/yubal_api/
│           ├── api/             # HTTP layer
│           │   ├── routes/      # API endpoint handlers
│           │   ├── app.py       # FastAPI app factory
│           │   ├── dependencies.py  # Dependency injection
│           │   └── exceptions.py    # HTTP exceptions
│           ├── core/            # Domain models & enums
│           ├── schemas/         # Request/Response Pydantic models
│           ├── services/        # Application services
│           └── settings.py      # pydantic-settings configuration
│
├── web/                         # React frontend application
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── common/          # Shared UI components
│   │   │   ├── console/         # Log console components
│   │   │   ├── layout/          # Header, Footer
│   │   │   ├── magicui/         # Animation components
│   │   │   └── icons/           # Custom icons
│   │   ├── hooks/               # React custom hooks
│   │   ├── api/                 # API client (openapi-fetch)
│   │   ├── lib/                 # Utility functions
│   │   ├── App.tsx              # Main application
│   │   └── main.tsx             # Entry point
│   ├── vite.config.ts           # Vite configuration
│   ├── tsconfig.json            # TypeScript config
│   └── package.json             # Node dependencies
│
├── .github/workflows/           # CI/CD pipelines
│   ├── ci.yaml                  # Continuous Integration
│   └── cd.yaml                  # Continuous Deployment
│
├── Dockerfile                   # Multi-stage Docker build
├── justfile                     # Task runner commands
├── pyproject.toml               # Root Python workspace config
└── .env.example                 # Environment variables template
```

### Package Purposes

#### `packages/yubal/` - Core Library
The heart of the application containing:
- **Metadata extraction** from YouTube Music playlists/albums
- **Audio downloading** via yt-dlp integration
- **File tagging** using mediafile
- **Fuzzy matching** for album track resolution using rapidfuzz
- **CLI interface** for standalone usage

#### `packages/api/` - FastAPI Backend
HTTP API layer providing:
- **REST endpoints** for job management
- **Server-Sent Events (SSE)** for log streaming
- **Background job execution** with cancellation support
- **Static file serving** for the frontend build

#### `web/` - React Frontend
Single-page application featuring:
- **URL input** with validation for YouTube Music URLs
- **Download queue panel** with real-time progress
- **Console panel** streaming backend logs via SSE
- **Dark/Light theme** toggle with view transitions
- **Responsive design** using HeroUI components

---

## 3. File-by-File Breakdown

### Core Application Files

#### Backend Entry Points
| File | Purpose |
|------|---------|
| `packages/api/src/yubal_api/__main__.py` | uvicorn server launcher |
| `packages/api/src/yubal_api/api/app.py` | FastAPI application factory |
| `packages/api/src/yubal_api/settings.py` | pydantic-settings configuration |

#### Core Library Entry Points
| File | Purpose |
|------|---------|
| `packages/yubal/src/yubal/__init__.py` | Public API exports and factory functions |
| `packages/yubal/src/yubal/cli.py` | Click-based CLI interface |

#### Frontend Entry Points
| File | Purpose |
|------|---------|
| `web/src/main.tsx` | React DOM render with providers |
| `web/src/App.tsx` | Main application component |

### Business Logic Services

#### `packages/yubal/src/yubal/services/`

| Service | Responsibility |
|---------|----------------|
| `extractor.py` | `MetadataExtractorService` - Extracts track metadata from YouTube Music playlists |
| `downloader.py` | `DownloadService`, `YTDLPDownloader` - Downloads audio using yt-dlp |
| `tagger.py` | `tag_track()` - Applies metadata tags to audio files |
| `composer.py` | `PlaylistComposerService` - Generates M3U playlists and cover files |
| `playlist.py` | `PlaylistDownloadService` - Orchestrates full playlist download workflow |

#### `packages/api/src/yubal_api/services/`

| Service | Responsibility |
|---------|----------------|
| `job_store.py` | `JobStore` - In-memory job persistence with FIFO queue |
| `job_executor.py` | `JobExecutor` - Background task orchestration with cancellation |
| `sync_service.py` | `SyncService` - Adapter wrapping yubal library for API |
| `log_buffer.py` | `LogBuffer` - Circular buffer for log streaming via SSE |

### Configuration Files

| File | Purpose |
|------|---------|
| `pyproject.toml` | Root workspace config (uv workspace, ruff, pytest) |
| `packages/*/pyproject.toml` | Package-specific dependencies |
| `web/package.json` | Frontend dependencies and scripts |
| `web/vite.config.ts` | Vite bundler with proxy and chunking |
| `web/tsconfig.json` | TypeScript strict mode configuration |
| `.prettierrc` | Code formatting rules |
| `justfile` | Development task automation |
| `.env.example` | Environment variables documentation |

### Data Layer

The application uses **in-memory storage** for job management:

| Component | Description |
|-----------|-------------|
| `JobStore` | Thread-safe job queue with OrderedDict storage |
| `LogBuffer` | Circular buffer for recent log lines (SSE streaming) |

No persistent database is used - the application is designed for single-user, ephemeral job processing.

### Frontend Components

#### Layout Components
- `layout/header.tsx` - Application header with cookie dropdown and theme toggle
- `layout/footer.tsx` - Footer with version and links

#### Feature Components
- `url-input.tsx` - YouTube Music URL input with validation
- `downloads-panel.tsx` - Job queue with progress tracking
- `console-panel.tsx` - Real-time log streaming panel
- `common/job-card.tsx` - Individual job display with status, progress, and actions

#### UI Primitives
- `common/panel.tsx` - Reusable panel container
- `common/empty-state.tsx` - Empty state placeholder
- `common/error-boundary.tsx` - React error boundary
- `magicui/blur-fade.tsx` - Animated fade-in effect
- `magicui/animated-theme-toggler.tsx` - Theme switch with view transitions

### Testing Structure

#### Python Tests (`packages/yubal/tests/`)
| Test File | Coverage |
|-----------|----------|
| `test_downloader.py` | DownloadService, YTDLPDownloader |
| `test_composer.py` | PlaylistComposerService, M3U generation |
| `test_tagger.py` | Metadata tagging |
| `test_services.py` | Service integration |
| `test_filename.py` | Path building utilities |
| `test_models.py` | Domain model validation |
| `test_utils.py` | Utility functions |
| `test_cookies.py` | Cookie file handling |

#### Frontend Tests (`web/src/lib/`)
| Test File | Coverage |
|-----------|----------|
| `url.test.ts` | URL validation and type detection |
| `job-status.test.ts` | Job status utilities |

### DevOps & Deployment

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build (Bun → uv → slim runtime) |
| `.github/workflows/ci.yaml` | Lint, typecheck, test with coverage |
| `.github/workflows/cd.yaml` | Docker build and push to GHCR |

---

## 4. API Endpoints Analysis

### Base URL: `/api`

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/jobs` | Create a new download job |
| GET | `/jobs` | List all jobs (FIFO order) |
| POST | `/jobs/{job_id}/cancel` | Cancel a running/queued job |
| DELETE | `/jobs/{job_id}` | Delete a finished job |
| DELETE | `/jobs` | Clear all completed jobs |

### Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/logs/history` | Get buffered log entries |
| GET | `/logs/sse` | Stream logs via Server-Sent Events |

### Cookies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cookies/status` | Check if cookies are configured |
| POST | `/cookies` | Upload cookies.txt (Netscape format) |
| DELETE | `/cookies` | Delete cookies file |

### Request/Response Formats

**Create Job Request:**
```json
{
  "url": "https://music.youtube.com/playlist?list=...",
  "max_items": 50
}
```

**Job Response:**
```json
{
  "id": "uuid",
  "url": "...",
  "status": "downloading",
  "progress": 45.5,
  "album_info": {
    "title": "Album Name",
    "artist": "Artist Name",
    "year": 2024,
    "track_count": 12,
    "thumbnail_url": "...",
    "audio_codec": "OPUS",
    "kind": "album"
  },
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Authentication/Authorization
- No authentication required (designed for local/private deployment)
- CORS configured via `YUBAL_CORS_ORIGINS` environment variable
- Cookie-based YouTube Music authentication (optional) for private playlists

---

## 5. Architecture Deep Dive

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Container                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Application                    │   │
│  │                                                          │   │
│  │  ┌──────────────┐    ┌───────────────┐    ┌──────────┐  │   │
│  │  │   Static     │    │     API       │    │   SSE    │  │   │
│  │  │   Files      │    │   Routes      │    │  Stream  │  │   │
│  │  │  (web/dist)  │    │  /api/*       │    │ /logs/sse│  │   │
│  │  └──────────────┘    └───────┬───────┘    └────┬─────┘  │   │
│  │                              │                  │        │   │
│  │                     ┌────────▼────────┐   ┌────▼─────┐  │   │
│  │                     │   JobExecutor   │   │LogBuffer │  │   │
│  │                     │  (Background)   │   │(Circular)│  │   │
│  │                     └────────┬────────┘   └──────────┘  │   │
│  │                              │                           │   │
│  │                     ┌────────▼────────┐                  │   │
│  │                     │   SyncService   │                  │   │
│  │                     │    (Adapter)    │                  │   │
│  │                     └────────┬────────┘                  │   │
│  └──────────────────────────────┼───────────────────────────┘   │
│                                 │                                │
│  ┌──────────────────────────────▼───────────────────────────┐   │
│  │                   yubal Core Library                      │   │
│  │                                                          │   │
│  │  ┌─────────────────┐  ┌─────────────┐  ┌──────────────┐  │   │
│  │  │MetadataExtractor│  │DownloadSvc  │  │ComposerSvc   │  │   │
│  │  │    Service      │  │(yt-dlp)     │  │(M3U/Cover)   │  │   │
│  │  └────────┬────────┘  └──────┬──────┘  └──────────────┘  │   │
│  │           │                  │                            │   │
│  │  ┌────────▼────────┐  ┌──────▼──────┐                    │   │
│  │  │  YTMusicClient  │  │   Tagger    │                    │   │
│  │  │  (ytmusicapi)   │  │ (mediafile) │                    │   │
│  │  └─────────────────┘  └─────────────┘                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  External: yt-dlp → YouTube Music → FFmpeg                      │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Download Request

```
1. User submits URL via React frontend
         │
         ▼
2. POST /api/jobs creates Job in JobStore (PENDING)
         │
         ▼
3. JobExecutor.start_job() spawns asyncio Task
         │
         ▼
4. SyncService.execute() runs in thread pool
         │
         ├──► 4a. MetadataExtractorService.extract()
         │         - Fetches playlist via ytmusicapi
         │         - Resolves album info for each track
         │         - Fuzzy matches tracks to albums
         │
         ├──► 4b. DownloadService.download_tracks()
         │         - Downloads via yt-dlp
         │         - Tags files with metadata
         │         - Fetches and embeds cover art
         │
         └──► 4c. PlaylistComposerService
                   - Generates M3U playlist
                   - Saves cover image
         │
         ▼
5. Job status updated (COMPLETED/FAILED)
         │
         ▼
6. Frontend polls /api/jobs, displays result
```

### Key Design Patterns

1. **Protocol-based Dependency Injection**
   - `DownloaderProtocol`, `YTMusicProtocol` enable mocking
   - `JobExecutionStore` protocol for job store abstraction

2. **Iterator/Generator Pattern**
   - `extract()` and `download_tracks()` yield progress updates
   - Enables real-time progress tracking without blocking

3. **Cancel Token Pattern**
   - `CancelToken` class for cooperative cancellation
   - Checked at iteration boundaries for graceful shutdown

4. **Factory Functions**
   - `create_extractor()`, `create_downloader()`, `create_playlist_downloader()`
   - Simplifies library usage and hides dependency wiring

5. **Service Container**
   - `Services` dataclass holds application services
   - Set via `set_services()` during app lifespan
   - Retrieved via FastAPI dependencies

### Dependencies Between Modules

```
yubal_api (API layer)
    └── yubal (Core library)
            ├── ytmusicapi (YouTube Music API)
            ├── yt-dlp (Audio download)
            ├── mediafile (Tagging)
            └── rapidfuzz (Fuzzy matching)
```

---

## 6. Environment & Setup Analysis

### Required Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `YUBAL_ROOT` | Yes* | - | Project root directory (*set by justfile locally) |
| `YUBAL_DATA` | No | `{root}/data` | Music library output directory |
| `YUBAL_CONFIG` | No | `{root}/config` | Config directory (cookies at `ytdlp/cookies.txt`) |
| `YUBAL_HOST` | No | `127.0.0.1` | Server bind address |
| `YUBAL_PORT` | No | `8000` | Server port |
| `YUBAL_AUDIO_FORMAT` | No | `opus` | Audio codec (opus, mp3, m4a) |
| `YUBAL_AUDIO_QUALITY` | No | `0` | Quality (0=best, 10=worst) |
| `YUBAL_TZ` | No | `UTC` | Timezone (IANA format) |
| `YUBAL_DEBUG` | No | `false` | Enable debug mode |
| `YUBAL_LOG_LEVEL` | No | `INFO` | Log level |
| `YUBAL_CORS_ORIGINS` | No | `["*"]` | Allowed CORS origins |

### Installation & Setup

```bash
# Prerequisites: uv, bun, just

# Clone and enter project
git clone https://github.com/guillevc/yubal.git
cd yubal

# Install all dependencies
just install

# Run development servers (API + frontend)
just dev

# Or run production build
just prod
```

### Development Workflow

```bash
# Format code
just format

# Lint code
just lint

# Type check
just typecheck

# Run tests
just test

# Run all CI checks
just check

# Build Docker image
just docker-build
```

### Production Deployment (Docker)

```yaml
# compose.yaml
services:
  yubal:
    image: ghcr.io/guillevc/yubal:latest
    ports:
      - 8000:8000
    environment:
      YUBAL_TZ: UTC
    volumes:
      - ./data:/app/data
      - ./config:/app/config
    restart: unless-stopped
```

---

## 7. Technology Stack Breakdown

### Runtime Environment

| Component | Version | Purpose |
|-----------|---------|---------|
| Python | 3.12+ | Backend runtime |
| Node.js/Bun | Latest | Frontend build and test |
| FFmpeg | Static build | Audio transcoding |
| Deno | Latest | yt-dlp JavaScript interpreter |

### Backend Frameworks & Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| FastAPI | ^0.127.1 | Web framework |
| Pydantic | ^2.0.0 | Data validation |
| pydantic-settings | ^2.12.0 | Configuration management |
| uvicorn | ^0.40.0 | ASGI server |
| yt-dlp | ^2025.12.8 | YouTube download engine |
| ytmusicapi | ^1.9.0 | YouTube Music API client |
| mediafile | ^0.12.0 | Audio file tagging |
| rapidfuzz | ^3.0.0 | Fuzzy string matching |
| rich | ^14.2.0 | Terminal output formatting |
| click | ^8.1.0 | CLI framework |

### Frontend Frameworks & Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.2.3 | UI framework |
| HeroUI | ^2.8.7 | Component library |
| Tailwind CSS | ^4.1.18 | Utility CSS |
| Vite | ^7.3.1 | Build tool |
| TypeScript | ^5.9.3 | Type safety |
| motion | ^12.26.2 | Animations |
| lucide-react | ^0.562.0 | Icons |
| openapi-fetch | 0.15.0 | Type-safe API client |
| ts-pattern | ^5.9.0 | Pattern matching |
| ansi_up | ^6.0.6 | ANSI to HTML conversion |

### Build & Development Tools

| Tool | Purpose |
|------|---------|
| uv | Python package/project manager |
| Bun | JavaScript runtime and package manager |
| just | Command runner (like make) |
| ruff | Python linter and formatter |
| ESLint | TypeScript linter |
| Prettier | Code formatter |
| ty | Python type checker |

### Testing Frameworks

| Framework | Language | Purpose |
|-----------|----------|---------|
| pytest | Python | Unit/Integration testing |
| pytest-cov | Python | Coverage reporting |
| Bun test | TypeScript | Frontend testing |

### CI/CD & Deployment

| Component | Purpose |
|-----------|---------|
| GitHub Actions | CI/CD orchestration |
| Docker | Containerization |
| GHCR | Container registry |
| mise | Tool version management (CI) |
| Codecov | Coverage reporting |

---

## 8. Visual Architecture Diagram

### System Architecture

```
                                    ┌──────────────────────┐
                                    │    YouTube Music     │
                                    │   (music.youtube.com)│
                                    └──────────┬───────────┘
                                               │
                   ┌───────────────────────────┼───────────────────────────┐
                   │                           │                           │
                   │              ┌────────────▼────────────┐              │
                   │              │        yt-dlp           │              │
                   │              │   (audio extraction)    │              │
                   │              └────────────┬────────────┘              │
                   │                           │                           │
┌──────────┐       │  ┌────────────────────────▼─────────────────────────┐ │
│  Browser │◄──────┼──│                   FastAPI Server                  │ │
│          │       │  │                                                   │ │
│ ┌──────┐ │  HTTP │  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │ │
│ │React │ │◄──────┼──│  │ Static      │  │ REST API    │  │ SSE       │ │ │
│ │ SPA  │ │       │  │  │ /           │  │ /api/*      │  │ /api/logs │ │ │
│ └──────┘ │       │  │  └─────────────┘  └──────┬──────┘  └─────┬─────┘ │ │
└──────────┘       │  │                          │                │      │ │
                   │  │               ┌──────────▼──────────┐     │      │ │
                   │  │               │     Job System      │     │      │ │
                   │  │               │  ┌───────────────┐  │     │      │ │
                   │  │               │  │   JobStore    │  │     │      │ │
                   │  │               │  │  (In-Memory)  │  │     │      │ │
                   │  │               │  └───────────────┘  │     │      │ │
                   │  │               │  ┌───────────────┐  │     │      │ │
                   │  │               │  │ JobExecutor   │◄─┼─────┘      │ │
                   │  │               │  │ (Background)  │  │            │ │
                   │  │               │  └───────┬───────┘  │            │ │
                   │  │               └──────────┼──────────┘            │ │
                   │  │                          │                       │ │
                   │  │               ┌──────────▼──────────┐            │ │
                   │  │               │    yubal Library    │            │ │
                   │  │               │  ┌───────────────┐  │            │ │
                   │  │               │  │  Extractor    │  │            │ │
                   │  │               │  │  (ytmusicapi) │  │            │ │
                   │  │               │  └───────────────┘  │            │ │
                   │  │               │  ┌───────────────┐  │            │ │
                   │  │               │  │  Downloader   │  │            │ │
                   │  │               │  │  (yt-dlp)     │  │            │ │
                   │  │               │  └───────────────┘  │            │ │
                   │  │               │  ┌───────────────┐  │            │ │
                   │  │               │  │   Tagger      │  │            │ │
                   │  │               │  │  (mediafile)  │  │            │ │
                   │  │               │  └───────────────┘  │            │ │
                   │  │               └──────────────────────┘            │ │
                   │  │                          │                       │ │
                   │  └──────────────────────────┼───────────────────────┘ │
                   │                             │                         │
                   │                   ┌─────────▼─────────┐               │
                   │                   │   File System     │               │
                   │                   │  /app/data        │               │
                   │                   │  /app/config      │               │
                   │                   └───────────────────┘               │
                   │                                                       │
                   │                     Docker Container                  │
                   └───────────────────────────────────────────────────────┘
```

### Component Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │     App.tsx      │                                                   │
│  │                  │                                                   │
│  │  ┌────────────┐  │     ┌────────────────┐    ┌──────────────────┐   │
│  │  │  UrlInput  │──┼────►│  useJobs hook  │───►│  api/jobs.ts     │   │
│  │  └────────────┘  │     └────────────────┘    └────────┬─────────┘   │
│  │                  │                                    │             │
│  │  ┌────────────┐  │                           ┌────────▼─────────┐   │
│  │  │ Downloads  │◄─┼───────────────────────────│  api/client.ts   │   │
│  │  │   Panel    │  │                           │ (openapi-fetch)  │   │
│  │  └────────────┘  │                           └────────┬─────────┘   │
│  │                  │                                    │             │
│  │  ┌────────────┐  │     ┌────────────────┐             │             │
│  │  │  Console   │◄─┼─────│  EventSource   │◄────────────┘             │
│  │  │   Panel    │  │     │  (SSE Client)  │                           │
│  │  └────────────┘  │     └────────────────┘                           │
│  │                  │                                                   │
│  └──────────────────┘                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP / SSE
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend (FastAPI)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         api/ (HTTP Layer)                        │   │
│  │                                                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│   │
│  │  │routes/jobs  │  │routes/logs  │  │routes/health│  │routes/  ││   │
│  │  │             │  │  (SSE)      │  │             │  │cookies  ││   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └─────────┘│   │
│  │         │                │                                      │   │
│  │         │         ┌──────▼──────┐                               │   │
│  │         │         │  LogBuffer  │                               │   │
│  │         │         │  (Circular) │                               │   │
│  │         │         └─────────────┘                               │   │
│  │         │                                                       │   │
│  └─────────┼───────────────────────────────────────────────────────┘   │
│            │                                                           │
│  ┌─────────▼───────────────────────────────────────────────────────┐   │
│  │                     services/ (Application Layer)                │   │
│  │                                                                  │   │
│  │  ┌─────────────────┐        ┌─────────────────────────────┐     │   │
│  │  │    JobStore     │◄──────►│       JobExecutor           │     │   │
│  │  │   (In-Memory)   │        │    (Background Tasks)       │     │   │
│  │  │                 │        │                             │     │   │
│  │  │ - create_job    │        │  - start_job (asyncio)      │     │   │
│  │  │ - get_all_jobs  │        │  - cancel_job (CancelToken) │     │   │
│  │  │ - cancel_job    │        │  - progress callbacks       │     │   │
│  │  │ - transition_job│        │                             │     │   │
│  │  └─────────────────┘        └──────────────┬──────────────┘     │   │
│  │                                            │                    │   │
│  │                             ┌──────────────▼──────────────┐     │   │
│  │                             │        SyncService          │     │   │
│  │                             │    (Library Adapter)        │     │   │
│  │                             └──────────────┬──────────────┘     │   │
│  │                                            │                    │   │
│  └────────────────────────────────────────────┼────────────────────┘   │
│                                               │                        │
└───────────────────────────────────────────────┼────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           yubal (Core Library)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                        services/ (Domain Layer)                    │ │
│  │                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                 PlaylistDownloadService                      │  │ │
│  │  │              (Orchestrates full workflow)                    │  │ │
│  │  └───────┬─────────────────┬─────────────────┬─────────────────┘  │ │
│  │          │                 │                 │                     │ │
│  │  ┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐            │ │
│  │  │Metadata       │ │Download       │ │Playlist       │            │ │
│  │  │Extractor      │ │Service        │ │Composer       │            │ │
│  │  │               │ │               │ │               │            │ │
│  │  │- extract()    │ │- download_    │ │- compose()    │            │ │
│  │  │- fuzzy match  │ │  tracks()     │ │- M3U gen      │            │ │
│  │  └───────┬───────┘ └───────┬───────┘ └───────────────┘            │ │
│  │          │                 │                                       │ │
│  │  ┌───────▼───────┐ ┌───────▼───────┐ ┌───────────────┐            │ │
│  │  │YTMusicClient  │ │YTDLPDownloader│ │   Tagger      │            │ │
│  │  │(ytmusicapi)   │ │  (yt-dlp)     │ │ (mediafile)   │            │ │
│  │  └───────────────┘ └───────────────┘ └───────────────┘            │ │
│  │                                                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                         models/ (Domain Models)                    │ │
│  │                                                                    │ │
│  │  TrackMetadata, PlaylistInfo, DownloadResult, DownloadProgress    │ │
│  │  ExtractProgress, CancelToken, VideoType, ContentKind             │ │
│  │                                                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### File Structure Hierarchy

```
yubal/
├── packages/
│   ├── yubal/                      # Core library package
│   │   ├── src/yubal/
│   │   │   ├── __init__.py         # Public API exports
│   │   │   ├── cli.py              # Click CLI
│   │   │   ├── client.py           # YTMusic API wrapper
│   │   │   ├── config.py           # Configuration dataclasses
│   │   │   ├── exceptions.py       # Exception hierarchy
│   │   │   ├── models/
│   │   │   │   ├── domain.py       # Core domain models
│   │   │   │   └── ytmusic.py      # YTMusic response models
│   │   │   ├── services/
│   │   │   │   ├── extractor.py    # Metadata extraction
│   │   │   │   ├── downloader.py   # yt-dlp download
│   │   │   │   ├── tagger.py       # Audio file tagging
│   │   │   │   ├── composer.py     # M3U/cover generation
│   │   │   │   └── playlist.py     # Orchestration service
│   │   │   └── utils/              # Utility modules
│   │   └── tests/                  # pytest tests
│   │
│   └── api/                        # FastAPI API package
│       └── src/yubal_api/
│           ├── __init__.py
│           ├── __main__.py         # Server entrypoint
│           ├── settings.py         # pydantic-settings
│           ├── api/
│           │   ├── app.py          # FastAPI factory
│           │   ├── dependencies.py # DI configuration
│           │   ├── exceptions.py   # HTTP exceptions
│           │   └── routes/         # API endpoints
│           ├── core/               # Domain types
│           ├── schemas/            # Request/Response DTOs
│           └── services/           # Application services
│
├── web/                            # React frontend
│   ├── src/
│   │   ├── main.tsx               # Entry point
│   │   ├── App.tsx                # Root component
│   │   ├── index.css              # Global styles
│   │   ├── components/            # React components
│   │   ├── hooks/                 # Custom hooks
│   │   ├── api/                   # API client
│   │   └── lib/                   # Utilities
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── .github/workflows/             # CI/CD
├── Dockerfile                     # Container build
├── justfile                       # Task runner
├── pyproject.toml                 # Workspace config
└── .env.example                   # Environment template
```

---

## 9. Key Insights & Recommendations

### Code Quality Assessment

**Strengths:**
- Excellent separation of concerns with clear layering
- Protocol-based dependency injection enables testability
- Comprehensive type annotations in both Python and TypeScript
- Well-documented code with docstrings and comments
- Modern tooling (uv, Bun, Vite 7, React 19)
- Clean error handling with custom exception hierarchy
- Iterator-based progress reporting for real-time feedback

**Areas for Improvement:**
- No persistent storage - jobs are lost on restart
- Limited error recovery for failed downloads
- No retry mechanism for transient failures
- Single-user design without authentication

### Potential Improvements

1. **Persistence Layer**
   - Add SQLite for job persistence across restarts
   - Enable download history and statistics

2. **Error Recovery**
   - Implement retry with exponential backoff for transient failures
   - Add partial download resume capability

3. **Performance Optimizations**
   - Parallel track downloads with configurable concurrency
   - Pre-fetch album metadata while downloading

4. **User Experience**
   - Add batch URL import (multiple URLs at once)
   - Browser extension for one-click downloads
   - Mobile-friendly PWA support

### Security Considerations

1. **Cookie Handling**
   - Cookies are stored in plaintext - consider encryption at rest
   - Document risks of cookie usage in YouTube ToS context

2. **Input Validation**
   - URL validation is client-side only - add server-side validation
   - Consider rate limiting for API endpoints

3. **CORS Configuration**
   - Default `["*"]` is permissive - recommend configuring for production

4. **Container Security**
   - Running as root inside container - consider non-root user
   - Review yt-dlp subprocess execution security

### Performance Optimization Opportunities

1. **Frontend**
   - SSE reconnection logic could be more robust
   - Consider WebSocket for bi-directional communication
   - Add service worker for offline capability

2. **Backend**
   - Job store could use Redis for distributed deployments
   - Consider connection pooling for YouTube API requests
   - Log buffer could be moved to Redis Pub/Sub for scaling

3. **Docker**
   - Multi-stage build is well optimized
   - Consider Alpine-based final image for smaller size
   - Cache Python dependencies more aggressively

### Maintainability Suggestions

1. **Documentation**
   - Add API documentation (OpenAPI is available at `/api/openapi.json`)
   - Create architecture decision records (ADRs)
   - Document deployment best practices

2. **Testing**
   - Increase integration test coverage
   - Add E2E tests with Playwright
   - Add contract tests for API schema stability

3. **Monitoring**
   - Add structured logging with correlation IDs
   - Consider OpenTelemetry integration
   - Add health check endpoints for container orchestration

---

## Summary

Yubal is a well-architected, modern full-stack application that elegantly solves the problem of downloading and organizing music from YouTube Music. The codebase demonstrates excellent software engineering practices including:

- Clean separation between core library and API layer
- Protocol-based abstractions for testability
- Modern Python and TypeScript tooling
- Thoughtful UX with real-time progress feedback
- Production-ready Docker deployment

The project is actively maintained and follows a clear development workflow with proper CI/CD. While there are opportunities for enhancement (persistence, scaling, security hardening), the current implementation is well-suited for its target use case as a self-hosted, single-user application.
