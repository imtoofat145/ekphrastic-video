# Ekphrastic Video Viewer

Production MP4 video viewer for [Ekphrastic.io](https://ekphrastic.io), built with React and [Vidstack](https://www.vidstack.io/).

Sibling apps: `pack/pdf`, `pack/swiper`.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Production uses `.env.production` (`VITE_BASE_PATH=/video`) for deployment at [presenting.link/video](https://presenting.link/video/).

## Deploy (presenting.link)

The video viewer is hosted at **`https://presenting.link/video/`** (sibling to the PDF app at `/pdf/` and swiper at `/presentation/`).

1. **Build** — `npm run build` loads `.env.production` and sets React Router `basename` to `/video`.
2. **Upload** — copy the entire `dist/` folder to the server’s `/video/` directory (`index.html`, `ek_loader.svg`, and `assets/`).
3. **Test** — open a URL with a video id:

```
https://presenting.link/video/?id=<attachmentId>&mode=test
```

After deploy, Network should show `POST .../api/wf/video` and the MP4 loading — not only HTML/JS/CSS.

**Local subdirectory smoke test (PowerShell):**

```powershell
$env:VITE_BASE_PATH="/video"; npm run build; npm run preview
```

Then open `http://localhost:4173/video/?id=<id>&mode=test` (path may vary with preview server).

### Hosting notes

- Upload **`dist/` contents** into the **`/video/`** folder (not site root).
- Prefer URLs with a trailing slash: `/video/?id=...` (avoids relative asset resolution edge cases when the path is `/video` without a slash).
- **SPA fallback:** the server must serve `index.html` for client-side routes under `/video/` (e.g. `/video/attachment/123`). If `/video/` works but `/video/attachment/...` returns 404, add rewrite rules (Apache `FallbackResource`, nginx `try_files`, etc.) — same requirement as PDF at `/pdf/`.

## Usage

### Ekphrastic asset (JSON-driven)

Production:

```
https://presenting.link/video/?id=<attachmentId>&uid=<visitorUid>
```

Local dev (root):

```
/?id=<attachmentId>&uid=<visitorUid>
```

Optional params: `uaid`, `dark=true`, `mode=test`, `preview=yes`, `collection=yes`, `modal=yes`, `panel=about|presentation`

### URL parameters

| Parameter | Purpose |
|-----------|---------|
| `?id=` | Video Payloadlist id — fetches MP4 via API |
| `?video=` | Direct MP4 URL (bypasses API) |
| `?uid=` | Visitor uid for Ekphrastic tracking |
| `?uaid=` | Existing analytics session id |
| `?dark=true` | Enable dark mode |
| `?mode=test` | Use test API endpoints |
| `?preview=yes` | Show back button in toolbar (`window.close()`) |
| `?collection=yes` | Show back button labeled “Back to Collection” (`window.close()`) |
| `?modal=yes` | Modal embed context; hides preview back button |
| `?panel=about` / `?panel=presentation` | Open drawer on load |

Examples:

```
https://presenting.link/video/?id=<attachmentId>&uid=<visitorUid>&preview=yes
https://presenting.link/video/?id=<attachmentId>&modal=yes
```

### Direct MP4 URL (demo / testing)

```
https://presenting.link/video/?video=https://files.vidstack.io/sprite-fight/720p.mp4
```

### Legacy attachment path

```
https://presenting.link/video/attachment/<id>
```

Redirects to `https://presenting.link/video/?id=<id>`.

## Environment variables

| Variable | Default (dev) | Production |
|----------|---------------|------------|
| `VITE_BASE_PATH` | `/` | `/video` (via `.env.production`) |
| `VITE_VIDEO_API_URL` | `https://cdn.ekphrastic.io/api/wf/video` | same |
| `VITE_TRACK_VISITOR_START_URL` | `https://cdn.ekphrastic.io/api/wf/track_visit_start` | same |
| `VITE_TRACK_EVENTS_URL` | `https://cdn.ekphrastic.io/api/wf/track_events` | same |
| `VITE_GA_MEASUREMENT_ID` | — | — |

See `.env.example` for optional overrides.

## Analytics events

GA4: `video_opened`, `video_started`, `video_paused`, `video_resumed`, `video_seeked`, `video_progress_*`, `video_completed`, `video_load_error`

Ekphrastic `track_events` (when `uid` + session active): `Play:1`, `Pause:1`, `Finished:1`, `Time:15`, `Author:1`, `Info:1`, `Report:1`
