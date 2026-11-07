# Sessions

Build a standalone Herdr overlay that searches past Hermes, Pi and PiG sessions. Open it with
`mod.open:sessions` (for example bind `ctrl-shift-s` in `keys.json`). Type to search; use the
arrow keys and Enter, or click a row, to resume in a new tab. Escape closes the overlay.

Search the shown space's machine. An overlay opened with props may specify `machines`, an array
of additional Herdr machine names. A matching space must already be open on the session's machine
for resume. The Python helper reads the machine's `~/.hermes/state.db` read-only and its Pi/PiG
JSONL files; Python 3 is required on each searched machine. Only sessions with a user message
are shown. Searches stop after roughly three seconds and inspect at most the newest 2,000 Pi/PiG
files; results are capped at 50. Queries travel as arguments, never through a shell. Only validated
session IDs are passed to an agent. The helper is sent to remote machines via `exec` as Python
source, so they do not need a copy of the mod.

Mod files: `mods/sessions/main.js`, `mod.json`, `logic.mjs`, `search.py`, `test_logic.mjs`.
Verify with `node sessions/mods/sessions/test_logic.mjs`,
`python3 -I tests/test_sessions_search.py` and `herdr-app check sessions/mods/sessions`.
