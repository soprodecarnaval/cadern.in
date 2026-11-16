---
title: Launch exporter uploads from project and songbook contexts
status: open
type: feature
milestone: collab-flow
---

# 010 — Launch exporter uploads from project and songbook contexts

## Objective

Exporter upload destinations come from a deep link launched on the relevant project or songbook-scoped score page.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Difficulty: large. Dependencies: 008, 009. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Project page launches new-score or new-version upload within that project. Songbook-scoped score page launches a new version for that score in that songbook context.
- Opening exporter without a valid deep link shows a pt-BR message directing users to the relevant pages; do not allow proceeding to an unscoped upload.
- Define typed deep-link payload carrying project, optional songbook, score and expected revision IDs; treat supplied identifiers as untrusted. Revalidate current auth, permissions, membership and score/songbook relationship server-side at upload time.
- Specify cross-project score behavior explicitly: existing fork/ownership rules apply; songbook membership alone cannot authorize a foreign score mutation.
- Specify how successful upload updates or offers to update the songbook pin under existing role/concurrency rules; never silently re-pin all songbooks.
- Support cold/warm launch on macOS, Windows and Linux, auth continuation, stale/deleted context, malformed links, cancellation and retries. No credentials in URLs.
- Supersedes the free-standing exporter destination selector from collab-flow 009; link exporter milestone to this task.

## Implementation plan

1. Iterate on wireframes with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved wireframes in this task directory.
2. Agree website launch controls and exporter context/message wireframes; settle upload/fork/re-pin contract.
3. Implement Electron protocol registration and typed IPC context handling; preserve context through auth and validate upload destinations.
4. Wire page launch actions and existing upload pipeline; add stale-context handling and update packaging/docs.

## Validation

Exercise cold/warm packaged launches on supported OSes, no-link message, both project modes and songbook revision upload, auth continuation, tampered IDs, revoked permissions, stale pins, foreign-score handling, cancellation and retry without duplicate uploads.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

Foreign-score fork behavior? Upload auto-repins or prompts?
