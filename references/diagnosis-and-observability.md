# Diagnosis and Observability

## Purpose

This reference is for bug, failure, regression, anomaly, and systems-diagnosis requests.

It is NOT a default lens for every product-planning request.

## Core Position

- The user's description is input, not truth.
- A request may mix:
  - symptoms
  - guesses
  - wrong causal stories
  - missing facts
  - non-technical wording
- Diagnose the nature of the problem before proposing metrics or instrumentation.

## When To Apply This Reference

Use this reference when the request is about:

- Bugs
- Regressions
- Operational failures
- Anomalies
- Incident patterns
- Unexplained system behavior

Do NOT force this reference onto:

- Ordinary greenfield product ideation
- Feature scoping
- Concept exploration

## A-Stage Guidance For Diagnosis Cases

Separate:

- User-reported symptoms
- Objective facts (repo evidence)
- Suspected but unproven causes
- Missing observability

Ask questions that improve localization, not questions that force the user into implementation talk:

- What is happening now?
- What should happen instead?
- Where it first becomes visible?
- How often it happens?
- What environment or input seems related?

Propose truth surface entries accordingly:

- `confirmed_fact` for objective, verified symptoms
- `challenged_claim` for unverified causal stories
- `high_impact_risk` for unknown failure modes
- `dependency_chain` for cross-system dependencies

## Observability Principle

The goal is not "add more logs." The goal is better localization:

- Where did it fail?
- Where did it pass?
- What state was flowing through the system?
- Which dependency or branch caused the failure?

## Weak Moves To Reject

- Taking the user's causal story as fact
- Jumping straight to counters or thresholds before understanding the failure shape
- Proposing logs everywhere with no localization model
- Pretending missing facts are minor when they change the diagnosis direction
