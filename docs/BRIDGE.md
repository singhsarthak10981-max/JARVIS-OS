# Local Bridge — security design and Windows test plan

Status: **design only. Nothing here is implemented, installed, or scheduled to
run.** `tools/bridge/` does not exist yet. No process starts automatically, and
nothing runs until you explicitly approve and start it by hand.

This document is the approval artefact requested for the bridge: exact
allowlisted actions, authentication, local-only access, request validation, the
manual start/stop procedure, and the Windows tests that must pass before any of
it is described as working.

---

## 1. Why a bridge exists at all

JARVIS OS is a web app. A page cannot start a desktop program — that boundary is
what stops any website from executing commands on your PC. "Open Rekordbox" from
a browser therefore needs a helper on your machine. The design goal is that the
worst case for an attacker who fully compromises the page is **"Rekordbox
opens"** — not code execution.

### Options considered

| Option | Launch | Focus | Status | Risk | Verdict |
| --- | --- | --- | --- | --- | --- |
| Custom URL protocol (`jarvis://…`) | Yes | No | No | Any web page can trigger it; needs a registry write; blind launch | Rejected as primary |
| Local helper on loopback | Yes | Yes | Yes | Needs careful hardening | **Proposed** |
| Generic shell endpoint (`POST /run {"cmd":…}`) | Yes | Yes | Yes | Remote code execution for anything reaching the port | **Rejected outright** |
| Electron/Tauri desktop shell | Yes | Yes | Yes | Repackages the whole app | Out of scope |

---

## 2. Exact allowlisted actions

The complete surface. Four actions, no variants, no parameters, no paths, no
arguments. Anything else is rejected before dispatch.

| Action | Input | Does | Returns |
| --- | --- | --- | --- |
| `rekordbox.status` | none | Reads whether the `rekordbox` process exists | `{"ok":true,"running":true\|false}` |
| `rekordbox.launch` | none | Starts Rekordbox **if not already running** | `{"ok":true,"started":true\|false}` |
| `rekordbox.focus` | none | Brings the existing window to the foreground | `{"ok":true,"focused":true\|false}` |
| `spotify.launch` | none | Opens the Spotify app or web player | `{"ok":true}` |

Design rules enforced in code:

- The request body is `{ "action": "<one of the four>" }`. The action value is
  matched against a constant list with `switch`, not interpolated anywhere.
- **No action accepts a path, filename, URL, argument array or shell string.**
  There is no field in the schema that could carry one.
- Rekordbox's executable path is resolved by the helper from the Windows
  registry / standard install locations. It is never supplied by the client.
- Adding a fifth action requires editing the helper source and restarting it —
  a deliberate human act, not something a web page can request.

### Explicitly out of scope

No file reads, no file writes, no registry writes, no environment inspection,
no process listing beyond the `rekordbox` name match, no audio access, no MIDI,
no controller support, no arbitrary window enumeration.

---

## 3. Authentication

1. On first run the helper generates **32 bytes from a CSPRNG**
   (`RandomNumberGenerator`), prints it once, and stores it at
   `%LOCALAPPDATA%\JarvisBridge\token` with an ACL restricted to the current
   user.
2. You paste the token into JARVIS once. It is stored in that browser's
   `localStorage` under `jarvis:bridge-token` and sent as
   `Authorization: Bearer <token>`.
3. The helper compares tokens in **constant time** to avoid timing leaks.
4. Missing or wrong token → `401`. No body detail beyond `{"error":"unauthorized"}`.
5. **Rotate** by deleting the token file and restarting the helper; JARVIS
   reports `TOKEN REJECTED` until the new token is pasted.

The token never appears in a URL, query string, or log line.

---

## 4. Local-only access

| Control | Setting |
| --- | --- |
| Bind address | `127.0.0.1` only. Never `0.0.0.0`, never a LAN address. |
| Port | `7420` |
| IPv6 | Not bound at all |
| CORS | `Access-Control-Allow-Origin` reflects **only** `http://localhost:3000` and `http://127.0.0.1:3000` |
| Origin header | Requests without an `Origin` are rejected (`403`), so `curl` and other local apps cannot reach it unless they also forge an origin *and* know the token |
| Preflight | `OPTIONS` handled explicitly; only `POST` + `Authorization` + `Content-Type` allowed |
| Methods | `GET /health`, `POST /action`. Everything else `405`. |

Loopback binding means the port is unreachable from your network and from the
internet, even with the firewall off.

---

## 5. Request validation

Applied in this order, before any dispatch:

1. Method and path match exactly (`POST /action`).
2. `Origin` is an allowed origin.
3. `Authorization` header present and token matches (constant time).
4. `Content-Type: application/json` enforced.
5. Body size capped at **1 KB** and read with a hard limit.
6. Body parses as JSON and is a plain object.
7. `action` is a string and one of the four constants.
8. **Any** other property in the body is rejected rather than ignored — a
   request carrying `path`, `cmd`, `args` or similar is refused with `400`,
   which surfaces accidental or malicious expansion attempts instead of
   silently dropping them.

Responses are JSON with an explicit `ok` boolean. Errors never include stack
traces, filesystem paths, or token material.

### Rate limiting

A small in-memory limiter allows **10 requests per 10 seconds** per token and
returns `429` beyond that. This bounds accidental loops (for example a UI bug
polling `/health`) without needing any state on disk.

---

## 6. Manual start / stop

There is **no installer, no service, no scheduled task, no autostart key**. The
helper is a script you run in a PowerShell window when you want it, and closing
the window stops it.

### Start (PowerShell)

```powershell
# From the repo root, once the helper is approved and written:
cd tools\bridge
.\start-bridge.ps1
# First run prints the token once. Paste it into JARVIS → DJ → Performance → Setup.
# Leave the window open; closing it stops the bridge.
```

### Verify it is running

```powershell
# Confirm the listener is loopback-only — the Local Address must be 127.0.0.1
Get-NetTCPConnection -LocalPort 7420 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

### Stop

```powershell
# Preferred: press Ctrl+C in the bridge window, or just close it.
# If it is orphaned:
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*jarvis*' } | Stop-Process
```

Stopping the helper is always safe. JARVIS drops to `BRIDGE OFFLINE` within one
probe interval (15 s) and no other feature is affected.

### Revoke access

```powershell
Remove-Item "$env:LOCALAPPDATA\JarvisBridge\token"
```

JARVIS then shows `TOKEN REJECTED` until a new token is pasted.

---

## 7. What the UI does while the bridge is absent

- Bridge never starts on its own, so the default state is `BRIDGE OFFLINE`.
- `REKORDBOX: STATUS UNKNOWN` in the status bar. Launch is never inferred from
  the act of asking, and a successful request still reads **unknown** — only an
  explicit `rekordbox.status` answer may change it.
- Launch/Focus controls explain that they need the bridge instead of silently
  doing nothing.

---

## 8. Windows test plan

Each test must pass on the target PC before the bridge is described as working.
These are **yours to run** — this design was produced on Linux and none of it
has been executed against a real Rekordbox installation.

### A. Security

| # | Test | Expected |
| --- | --- | --- |
| A1 | `Get-NetTCPConnection -LocalPort 7420 -State Listen` | `LocalAddress` is `127.0.0.1`, never `0.0.0.0` |
| A2 | `curl http://127.0.0.1:7420/health` with no token | `401` |
| A3 | `curl -H "Authorization: Bearer wrong" …/health` | `401` |
| A4 | `POST /action` with `{"action":"rekordbox.launch","cmd":"calc.exe"}` | `400`, captured by the extra-property rule; `calc.exe` never starts |
| A5 | `POST /action` with `{"action":"openCalc"}` | `400` |
| A6 | `POST /action` with `{"action":"rekordbox.launch","path":"C:\\evil.exe"}` | `400` |
| A7 | From a second machine on the LAN, `Test-NetConnection <your-ip> -Port 7420` | Fails — not listening off-loopback |
| A8 | 11 rapid `/action` requests | Eleventh returns `429` |
| A9 | Kill the bridge, then click Launch in JARVIS | UI shows `BRIDGE OFFLINE`; no launch claim |

### B. Function

| # | Test | Expected |
| --- | --- | --- |
| B1 | `rekordbox.status` with Rekordbox closed | `{"ok":true,"running":false}` |
| B2 | `rekordbox.launch` with Rekordbox closed | Rekordbox starts; `started:true` |
| B3 | `rekordbox.launch` again while running | No second window; `started:false` |
| B4 | `rekordbox.focus` with another window in front | Rekordbox comes to front |
| B5 | `rekordbox.status` after a manual close | `running:false` |
| B6 | JARVIS status bar after B1–B5 | Flips to `RUNNING`/`STOPPED` only on an explicit answer |
| B7 | `spotify.launch` | Spotify opens, or the web player opens if the app is absent |

### C. Failure behaviour

| # | Test | Expected |
| --- | --- | --- |
| C1 | Rename the Rekordbox install folder, then `rekordbox.launch` | `ok:false` with a plain error; no crash |
| C2 | Revoke the token and restart | JARVIS shows `TOKEN REJECTED` |
| C3 | Launch JARVIS over HTTPS | UI shows `HTTPS BLOCKED` (mixed content) |
| C4 | Ctrl+C the bridge mid-session | Deck state, library and assignments survive untouched |

### D. Autostart verification

| # | Test | Expected |
| --- | --- | --- |
| D1 | `Get-ScheduledTask \| Where-Object TaskName -like '*jarvis*'` | Nothing |
| D2 | `Get-CimInstance Win32_Service \| Where-Object Name -like '*jarvis*'` | Nothing |
| D3 | Reboot the PC, do not start the bridge | JARVIS reports `BRIDGE OFFLINE` |

---

## 9. Approval gates

Nothing below happens without your explicit go-ahead.

1. **Approval to create `tools/bridge/`** — the code itself.
2. **Approval to run it once** for tests A–C on your machine.
3. **Approval for any autostart** — currently designed *against*; D1–D3 exist to
   prove none was added.

Until (1) and (2) are given, the plan stays documentation, the UI stays
`BRIDGE OFFLINE`, and Rekordbox status stays `UNKNOWN`.
