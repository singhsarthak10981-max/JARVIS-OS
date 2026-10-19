# Local Bridge — proposal (not implemented)

Status: **proposed, awaiting approval.** Nothing in this document runs on your
machine today. The DJ launchpad reports `BRIDGE OFFLINE` until a bridge is
installed, and it never claims Rekordbox was launched unless the bridge
answered.

## The problem

JARVIS OS is a Next.js app. A browser page cannot start a desktop program. That
is a hard security boundary, not a bug, and it exists to stop any website from
executing arbitrary commands on your PC.

So "open Rekordbox" from a web UI needs one of these:

| Option | Works from browser | Risk | Verdict |
| --- | --- | --- | --- |
| Custom URL protocol (`jarvis://launch?app=rekordbox`) | Yes | Any page on the web can trigger it; registration is a registry write; allows only blind launch, no focus/status | Acceptable fallback only |
| Local helper service on loopback | Yes | Needs a running process; must be locked down carefully | **Recommended** |
| Generic shell endpoint (`POST /run {"cmd": "..."}`) | Yes | Remote code execution for anything that can reach the port | **Rejected** |
| Electron/Tauri desktop wrapper | Yes | Repackages the whole app; large change | Later, if JARVIS becomes a desktop app |

## Proposed design

A single small helper (`jarvis-bridge`), run by the user in PowerShell:

```
jarvis-bridge --port 7420
```

### Fixed action allowlist

The browser may only ask for a **named** action. There is no command string
anywhere in the protocol.

| Action | Effect |
| --- | --- |
| `rekordbox.launch` | Start Rekordbox if not running |
| `rekordbox.focus` | Bring an existing Rekordbox window to the foreground |
| `rekordbox.status` | Report whether the process is running |
| `spotify.launch` | Open the Spotify app or web player |

Each action maps to a hard-coded implementation in the helper. Adding a new
action requires editing the helper source — which means it is a deliberate act
by you, not something a web page can request.

### Transport rules

- Binds **127.0.0.1 only**. Never `0.0.0.0`, never a LAN address.
- Requires a bearer token, generated randomly on first run and printed once in
  the terminal. You paste it into JARVIS; it is stored in `localStorage` on your
  machine and nowhere else.
- Answers CORS only for `http://localhost:3000` and `http://127.0.0.1:3000`.
- Rejects requests without an `Origin` header (blocks `curl` from other apps
  unless they also know the token).
- No file reads, no file writes, no environment inspection, no audio access.
- Every call is logged to the terminal with action name and timestamp.
- If the token is missing or wrong: `401`. If the process is stopped: JARVIS
  shows `BRIDGE OFFLINE` and nothing else changes.

### Why this cannot be abused the way a shell endpoint could

1. The client cannot name a path, binary or argument — only one of four enum
   values.
2. Rekordbox is launched by resolving its installed path from the registry, not
   from anything the browser sends.
3. Loopback + token + origin check means another website cannot reach it, and a
   local process without the token cannot either.
4. Worst case for a stolen token is "Rekordbox opens" — not code execution.

## HTTPS caveat

Browsers block `http://127.0.0.1` from an HTTPS page (mixed content). JARVIS is
meant to run locally at `http://localhost:3000`, where this works. In a hosted
preview the launchpad detects the protocol and reports `HTTPS BLOCKED` instead
of failing silently.

## Implementation sketch (PowerShell, ~120 lines)

- `HttpListener` on `http://127.0.0.1:7420/`
- token file in `%LOCALAPPDATA%\JarvisBridge\token`
- `rekordbox.launch`: resolve install path via
  `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*` or the standard
  `Program Files\rekordbox\rekordbox.exe`, then `Start-Process`
- `rekordbox.focus`: `Get-Process rekordbox` + `SetForegroundWindow` via
  `Add-Type` P/Invoke (`user32.dll`), skipping if already foreground
- `rekordbox.status`: `Get-Process rekordbox` → `{"running": true|false}`

Everything above is standard Windows API usage. It is **untested here** because
this sandbox is Linux and has no Rekordbox installation. It must be verified on
the target PC before being described as working.

## What still needs your approval

1. Whether to build this helper at all.
2. Whether you prefer the helper (launch **and** focus) or just a URL protocol
   (launch only).
3. Where it should live — a separate repo, or `tools/bridge/` in this one.

Until then the launchpad stays honest: it offers the instructions and the
manual path, and it never reports a launch it did not perform.
