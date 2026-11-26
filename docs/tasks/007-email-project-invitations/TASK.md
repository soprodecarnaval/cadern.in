---
title: Invite project members by email
status: in-progress
type: feature
milestone: collab-flow
---

# 007 — Invite project members by email

**On `main`:** [PR #435](https://github.com/soprodecarnaval/cadern.in/pull/435)
merged as `a8107ea6`. Live UI invitation validation is still unrecorded.

## Objective

Project invitations use email instead of Firebase displayName.

## Placement and dependencies

Milestone: [collab-flow](../../milestones/collab-flow/PLAN.md).
Difficulty: medium. Dependencies: None. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Replace username field, callable lookup payload and ambiguous-displayName handling with trimmed email lookup on the trusted backend.
- Retain ADMIN+ authorization, role limits, deterministic per-user invitation paths and existing accept/decline behavior.
- Do not expose email addresses in publicly readable member documents or permit arbitrary client Auth-user enumeration.
- Plan baseline: invite existing accounts only; show a humanized message for unknown email. Confirm unregistered-recipient support before expanding scope.
- Update historical username design references with links to this superseding task.

## Implementation plan

1. Iterate on wireframes with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved wireframes in this task directory.
2. Inspect ProjectSettingsPageView, findUserForInvite, invitation rules and function tests; agree wireframes.
3. Use server-side Auth email lookup; update caller contract, validation and error handling without broad user queries.

## Validation

Check valid/unknown/invalid email, whitespace, duplicate invite, existing member, unauthorized caller, allowed roles and accept/decline; verify public records contain no email.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

Resolved: existing accounts only.

## Approved wireframe

Keep the existing invite form and pending list. Replace username with email; show sending, invalid, unknown-account, existing-member and success states inline. Invitation controls remain restricted to admins and owners. Approved 2026-11-14.

## Validation progress

Functions emulator suite (20 tests), Firestore and Storage rules suite (103 tests), TypeScript and targeted lint passed. Live UI invitation flow has not been exercised.
