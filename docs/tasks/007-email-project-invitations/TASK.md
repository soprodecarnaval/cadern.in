---
title: Invite project members by email
status: open
type: feature
milestone: collab-flow
---

# 007 — Invite project members by email

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

Invite unregistered emails too? Baseline: existing accounts.
