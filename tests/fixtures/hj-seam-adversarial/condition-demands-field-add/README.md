# condition-demands-field-add

**Attack:** Condition asks for a new semantic field addition (`add a risk_level field`).

**Expected catch:** Layer 1 — either verb blacklist (`add` is borderline, relies on
token coverage) or orphan-token check (`risk_level` not in any FROZEN ledger content).
