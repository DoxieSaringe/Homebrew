# Town Hall Readiness Test (Microsoft Teams)

Single-page web app (`index.html`) used to estimate whether a user connection is suitable for attending a Microsoft Teams Town Hall as a viewer.

## What The Test Measures

The test runs three phases:

1. Microsoft connectivity check (startup phase)
2. Latency profiling (multiple Microsoft-related endpoint profiles)
3. Sustained download test

The app then combines results into a user-facing quality assessment and optional advanced diagnostics.

## Endpoint Inventory

### Latency profiles (automatic)

All profiles are tested automatically in one run.

- `generic`
  - `https://www.microsoft.com/favicon.ico`
- `townhallMedia`
  - `https://b.public-teams.prod.ml.cdn.office.net/favicon.ico`
- `townhallMediaKey`
  - `https://b.public-teams.prod.ml.cdn.office.net/favicon.ico`
  - `https://kd.public-teams.keys.ml.teams.microsoft.com/favicon.ico`

Primary latency used for the main result is selected by priority:

1. `townhallMediaKey`
2. `townhallMedia`
3. `generic`

### Reference endpoints (advanced only)

Used for comparison context, not for the core quality badge.

- External reference: `https://www.cloudflare.com/favicon.ico`
- Internal reference: `https://marvin.corp.vattenfall.com/favicon.ico`

### Download throughput endpoints

The sustained download phase fetches these resources (cache-busted):

- `https://ajax.aspnetcdn.com/ajax/jquery/jquery-3.7.1.js` (~285 KB)
- `https://ajax.aspnetcdn.com/ajax/jquery.ui/1.13.2/jquery-ui.js` (~529 KB)
- `https://ajax.aspnetcdn.com/ajax/bootstrap/5.2.3/bootstrap.bundle.js` (~208 KB)
- `https://ajax.aspnetcdn.com/ajax/modernizr/modernizr-2.8.3.js` (~47 KB)

**Why multiple smaller files instead of one large file?**

A single large file would be the simplest approach, but it produces less accurate results in real-world network conditions. Here's why multiple files were chosen:

1. **Parallel downloading reflects real usage.** When attending a Town Hall, the browser fetches numerous small assets simultaneously — video chunks, thumbnails, signalling payloads, key delivery requests. Downloading one giant sequential file does not replicate this pattern.

2. **Avoids browser connection throttling.** Browsers cap a single connection to one host at a time. Fetching multiple files in parallel (`Promise.all`) opens several connections, which better saturates the available bandwidth and gives a more realistic throughput reading.

3. **Cache-busting is reliable.** Each URL is appended with a unique `?cb=` query string per round so browsers never serve a cached response. With a large dedicated test file this would waste significant bandwidth on retries; with smaller known-stable files the overhead is minimal.

4. **CORS support guaranteed.** The Microsoft AJAX CDN (`ajax.aspnetcdn.com`) is a Microsoft-owned CDN with permanent CORS headers, enabling `arrayBuffer()` reads that give exact byte counts. Picking a single large arbitrary file risks CORS being absent or removed in future.

5. **Total payload (~1.07 MB) is intentional.** This is large enough to produce a stable throughput measurement even on slower connections (≥ 2 Mbps takes under 5 seconds), but small enough not to be disruptive on metered or mobile connections.

The test runs 5 rounds of this parallel fetch, then reports the **median** speed across rounds to filter out single-round outliers.

## Core Constants And Thresholds

- `LATENCY_ROUNDS = 8`
- `REFERENCE_ROUNDS = 3`
- `GOOD_DOWNLOAD_MBPS = 3`
- `OK_DOWNLOAD_MBPS = 2`
- `GOOD_LATENCY_MS = 150`
- `OK_LATENCY_MS = 250`

## Metric Definitions

### Latency (median)

For each profile:

- 8 samples are measured.
- First 2 samples are treated as warm-up and excluded.
- Median is computed from samples 3..8.

### Jitter

Sample standard deviation of samples 3..8.

### P95

95th percentile of samples 3..8.

Implementation note: percentile index is computed with `ceil(p/100 * n) - 1` on sorted values.

### Stability score

Calculated from primary profile latency stats:

- `p95Spread = p95 - median`
- `Stable` when `jitter <= 20` and `p95Spread <= 60`
- `Variable` when `jitter <= 40` and `p95Spread <= 120`
- `Unstable` otherwise

## Quality Assessment Logic

When download result is available:

- `Good` if `download >= 3 Mbps` and `latency <= 150 ms`
- `OK` if `download >= 2 Mbps` and `latency <= 250 ms`
- `Weak` otherwise

When download result is unavailable:

- Uses latency-only fallback badges/descriptions:
  - low latency: `<= 100 ms`
  - medium latency: `<= 200 ms`
  - high latency: `> 200 ms`

## Advanced Panel Contents

Advanced view includes:

- Per-profile latency rows: `median / p95 / jitter`
- External/internal reference values
- Comparison message (heuristic) based on reference deltas
- Reference disclaimer

Reference comparison heuristics include checks like:

- Microsoft path appears slower than external reference by > 80 ms
- Both references are slow (possible local/ISP/VPN path issue)
- Internal reference significantly slower than external reference

## Data Included In "Copy Results"

The copy action includes:

- Overall assessment
- Timestamp
- Network context (location + connection type)
- Latency, jitter, p95
- Stability label
- Download speed
- External/internal references
- Per-profile `median / p95 / jitter`
- Assessment description text

## UI/UX Summary

- Default result is simplified for non-technical users.
- Technical context (references and profile details) is behind an `Advanced` toggle.
- Languages supported:
  - Swedish (`sv`)
  - English (`en`)
  - Dutch (`nl`)
  - Polish (`pl`)

## Execution Notes

- Static client-side app, no backend required.
- Open `index.html` in a browser.
- Requests use cache-busting query params.
- Several latency/reference requests use `fetch(..., { mode: 'no-cors' })` to measure elapsed time only.

## Caveats

- This is a readiness approximation, not a full Teams media telemetry equivalent.
- Browser/network policy may influence measured timing.
- Corporate proxies, VPN routing, and endpoint reachability can affect both latency and throughput outcomes.
- Internal reference endpoint availability depends on corporate network access.

## File Map

- App: `index.html`
- Documentation: `README.md`
