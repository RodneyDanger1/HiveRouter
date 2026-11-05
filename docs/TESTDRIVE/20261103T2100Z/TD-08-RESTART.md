# TD-08 Lead-owned restart evidence

**TestDrive run:** `20261103T2100Z`

- Before restart: `runCount=15`, prompt tokens `128528`, completion tokens `102509`, cost `$0.07927932`, active `null`.
- Lead stopped the 8787 process and relaunched via `HiveRouter.lnk`/`launch-desktop.ps1`.
- Launcher log: `server unhealthy` → `starting npm start` → `server healthy` at 15:46:43; window reopened 1440×780 at 80,40.
- After restart: **`runCount=15`**, same token/cost totals, active `null`; SQLite persisted all 4 new runs. No interrupted run appeared.
- This completes the restart portion of TD-08; the draft reload was independently observed by the driver/UI watchdog before restart. Exact client-area geometry remains 1426×773 vs outer 1440×780 (frame/client distinction, accepted; test card tolerance).
- Remaining TD-08 note: the driver’s isolated browser profile draft was verified before restart; the Lead did not re-drive after restart. Persistence of the desktop profile requires a manual relaunch check, but the DB/restart invariant is verified.
