# Fortnightly AI level reviews

The server uses `gpt-6-astra` with `reasoning.effort=medium` to decide `advance`, `hold`, or
`needs-guidance`. The parent can pause AI reviews and override the animal plan. A decision,
its explanation, uncertainty, book references, model/settings, and the resulting plan are
synced to Practice record. Older native clients receive plan changes through their existing
preferences event contract; the new review display requires the updated frontend.

## Schedule and evidence

- The first review is due fourteen local calendar days after actual recorded practice starts.
  A changed animal plan starts a fresh observation period. Parent note check-ins do not postpone
  AI reviews. Completed reviews schedule the next review fourteen days later. Overdue periods
  coalesce into one current review, so a long absence never triggers a paid backlog.
- A sixty-second server worker checks due accounts. Guests must sign in and explicitly import
  their device practice before the server can see it. An in-progress multi-batch upload and the
  thirty seconds after a write are excluded. Records not yet synced remain unknown.
- The input covers the previous fourteen calendar days plus the partial current day, with missing
  and rest days, completed/unfinished sessions, exact unaided response categories, per-chord
  coverage, clean versus referenced first sounds, replays, response latency totals, actual
  confusion pairs, and parent observations. Trial assistance annotations override the original
  response for interpretation. Unknown session plans are kept separate from current-plan evidence.
- The six latest short note excerpts and optional age/prior-training context accompany the
  summary. Notes are untrusted observations; instructions embedded in them cannot change the
  review policy. Account IDs and contact fields are omitted. Parents should avoid putting
  identifying details in optional notes. Full books and raw practice histories are not uploaded.

## Source rules and constraints

`backend/foundation_review_policy.py` contains newly written, cited paraphrases of the supplied
scanned books. Source page labels and stable IDs refer to the recovered reading editions; PDF
page numbers differ. The main rules are Book 1 pp. 157–158 (normally two weeks without genuine
listening errors), pp. 182–183 and Book 2 Q9 (initial red-only routine), Book 1 pp. 163–166 and
Book 2 Q10 (varied first sounds without a reference), Book 1 pp. 213–221 (same-triad inversion
exceptions), and Book 3 Q53/Q65/Q69 (rest, distress, and gentle practice).

One-choice participation is not discrimination. No global accuracy percentage is imposed.
The same-triad inversion exception is distinguished from shared single notes or similar pitch
height. The model may recommend progression under that exception with medium confidence; the
uncertainty stays visible. Low-confidence advances do not apply. Confidence labels are not
calibrated probabilities.

The server also blocks advancement before fourteen days on the current plan, with incomplete
preparation, missing/inconsistent current-plan evidence, or a customized active set. It applies
at most one next chord. At level nine and above, the required note-name/individual-note response
phase is not implemented, so AI cannot automatically advance past that boundary. A parent can
still manually configure the existing fourteen-chord catalog.

This is an app adaptation, not expert supervision or a validated absolute-pitch assessment.
The authors' interpretation of inversion errors is not presented as a diagnosis or guarantee.

## Reliability and email

Per-account database locks serialize sync and final application on PostgreSQL and SQLite.
Durable unique review rows prevent concurrent duplicate calls for a review period. Provider
requests run outside database transactions. A changed record invalidates an in-flight result;
the original result remains in the server audit but cannot change the plan or send a decision
email. Crashed claims are quarantined before retrying. Failed requests retry at most three times
per review period with twenty-four-hour spacing; unchanged practice remains usable.

Calls use the Responses API with strict structured output, `store=false`, a ninety-second timeout,
zero SDK retries, no tools, and a 2,400-token output cap including reasoning. Invalid, refused, or
incomplete output never changes the plan. Application logs suppress provider request bodies.
`foundation_reviews` retains the bounded evidence, snapshot hash, result, token usage, and status.
The global worker switch stops future calls without erasing records.

Account & email registers a parent address using the existing six-digit verification flow.
Reminders → “AI decisions & two-week check-ins — email” enables delivery. A verified address alone
does not opt in. Advance, hold, and guidance decisions each queue one email atomically with the
decision. Delivery rechecks the verified address and opt-in, uses the existing Postmark durable
outbox, and will not blindly resend an ambiguous timeout. Rest days do not suppress a decision
email. Postmark acceptance and actual inbox delivery remain different outcomes.

## Configuration

Server only: `OPENAI_API_KEY`, `EGUCHI_AI_REVIEWS_ENABLED=true`,
`EGUCHI_REVIEW_MODEL=gpt-6-astra`, `EGUCHI_REVIEW_REASONING=medium`.
Never use `EXPO_PUBLIC_*` for the API key. Reviews default on when the server key exists unless
explicitly disabled. Email uses `EGUCHI_REMINDERS_ENABLED=true`, `POSTMARK_API_TOKEN`,
`POSTMARK_FROM_EMAIL`, and optional `POSTMARK_FROM_NAME`/`POSTMARK_MESSAGE_STREAM`, matching
Reminder Manager's Postmark configuration. No unrelated credentials or data are copied.

`GET /api/foundation/ai-review` returns authenticated availability, schedule, and job status.
`/sync` returns server-owned review events; clients cannot submit forged review events. Existing
`/contact`, `/contact/request-code`, `/contact/verify`, and `/review-record` remain authenticated.
New tables are created by the existing startup metadata migration. Rollback is additive: set
`EGUCHI_AI_REVIEWS_ENABLED=false`; keep audit tables and events.

## Evaluation, 2026-09-12

The synthetic fixtures in `scripts/eguchi_review_cases.py` cover eleven scenarios: established
red routine, sparse red practice, stable two-chord recognition, first-sound errors, assisted
success, pure inversion confusion, mixed errors, repeated distress, recent regression, the
phase boundary, and a parent-note prompt injection. These are book-derived development cases,
not independently labeled expert judgments or evidence of effectiveness in children.

| Model | Reasoning | Calls | Decision-type matches | Input / output tokens |
| --- | --- | --- | --- | --- |
| GPT-5.6 Luna | medium | 11 | 11/11 | 26,407 / 4,290 |
| GPT-6 Astra | low | 3 | 3/3 | 7,557 / 772 |
| GPT-6 Astra | medium | 11 | 11/11 | 26,407 / 2,900 |

The first rubric required exactly `hold` for distress and `high` confidence on all advances.
Inspection showed those restrictions were inappropriate: guidance for repeated distress is
acceptable, and both Astra settings recommended the explicit inversion exception with medium
confidence. The final rubric accepts hold or guidance for distress and retains medium-confidence
advances while blocking low-confidence advances. The figures above are decision-type matches;
the original runs reported those rubric mismatches. No extra calls were spent to relabel them.
Medium is a conservative reasoning default with modest overhead; this small comparison does
not establish that it outperforms low. Final output and the book references were inspected.

The 25 calls used 60,371 input and 7,962 output tokens. Charging every token, including Luna,
at Astra's uncached cache-write/input ceiling and output rates gives an upper estimate of $1.15
for these evaluations, excluding later deployment smoke tests. Actual cached/Luna cost is lower.
Official API references: [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) and
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Offline fixture listing:
`python -m scripts.eval_eguchi_reviews --limit 11 --output /tmp/eguchi-eval.json`

Metered rerun (explicit opt-in, at most twelve calls):
`python -m scripts.eval_eguchi_reviews --live --model gpt-6-astra --effort medium --limit 11 --output /tmp/eguchi-eval.json`

Run automated tests with `OPENAI_API_KEY="" EGUCHI_AI_REVIEWS_ENABLED=false`; legacy
tests insert a dummy key when the variable is absent. An explicitly empty value prevents
the unrelated nugget fallback test from attempting a real API request. Build `frontend/dist` before the full backend
suite because existing SPA tests require it.
