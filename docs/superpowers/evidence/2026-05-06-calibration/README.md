# 2026-05-06 ASSERTION-4 calibration evidence

Backs errata commit 95b1b72 (calibration kill-criterion fired).

- `raw-output-2026-05-06.json` — j-compile dispatch raw output (21 KB)
- `2026-05-06-threshold-calibration.json` — analyzed summary (9 ratios, 2 outliers excluded)
- `analyze.js` — analysis script (5th-pct + outlier exclusion)

Key finding: 5th-pct anchor 0.124 << spec floor 0.36, gap-width −0.24.
Round 4 implication: ratio metric class likely needs replacement, not retuning.

To reproduce: see `analyze.js` (frozen at this commit; future calibration runs
will re-derive in `.bonfire-calibration/` scratch, ignored at repo root).
