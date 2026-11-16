---
title: Humanize all authentication errors
status: in-progress
type: feature
milestone: auth-improvements
---

# 003 — Humanize all authentication errors

## Objective

All website and exporter auth failures display actionable pt-BR messages instead of Firebase codes.

## Placement and dependencies

Milestone: [auth-improvements](../../milestones/auth-improvements/PLAN.md).
Difficulty: small. Dependencies: None. Execution order: [workstreams](../WORKSTREAMS.md).

## Requirements

- Inventory login, signup, verification, password reset, Google OAuth, reauthentication and exporter auth call sites, including errors added by the existing Auth milestone.
- Centralize error-to-message mapping; cover known errors and provide a safe humanized fallback for unknown errors. Keep raw codes for diagnostics only.
- Preserve privacy-safe responses and existing authentication behavior.

## Implementation plan

1. Iterate on wireframes with the user and obtain approval before implementation. Cover normal, loading, empty, failure, and permission states where applicable; record approved wireframes in this task directory.
2. Audit src/auth.tsx, AuthModal and export-app auth rendering.
3. Agree wireframes/copy, implement shared mapping, replace raw message/code rendering.

## Validation

Exercise each auth flow, representative known failures and unknown fallback on website and exporter; assert raw Firebase errors never reach user-facing text.

Run focused tests and relevant type/build checks after implementation. This task authorizes planning only; implementation requires plan approval.

## Unresolved questions

None.

## Approved wireframes

Approved 2026-11-14: retain existing site modal and exporter form layouts; show humanized errors in their existing alert locations. Empty and loading states retain existing controls. Verification and password errors appear beside their respective actions. Unknown failures use a generic retry message without codes.

## Progress

Shared mapping applied to site authentication, password changes, and exporter login and verification. Mapper tests, targeted lint, typecheck and website/exporter builds pass with dummy Firebase configuration. Live UI flow validation remains.
