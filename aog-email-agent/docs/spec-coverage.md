# Spec coverage

Every case in `aogemailagenttestspec.md`, where it is implemented, and how it is checked.

Two kinds of row:

- **Offline** runs in `npm test` with no model and no network. It passes today.
- **Eval** runs in `npm run eval` and needs `ANTHROPIC_API_KEY`. The fixture and the scoring
  are written and committed; the number is not measured until a key exists.

---

## Suite 1: Routing

Implemented in `prompts/classifier.system.txt`, `src/classify.js`, and the Text Classifier
node in `workflows/01-inbound-pipeline.json`. Fixtures in `test/fixtures/routing.json`.

| Case | Expected bin | How it is handled | Check |
|---|---|---|---|
| CLS-01 | New Opportunity | first-time solicitation, ladder rung 3 | Eval |
| CLS-02 | Opportunity Update | labeled addendum, ladder rung 2 | Eval |
| CLS-03 | Bid Outcome | award beats the signature request, ladder rung 1 | Eval |
| CLS-04 | Active Project | outside sender, job underway, rung 4 | Eval |
| CLS-05 | Client & Network | intro offer is explicitly not a solicitation | Eval |
| CLS-06 | Internal / Team | AOG sender on internal ops beats Active Project | Eval |
| CLS-07 | Compliance & Docs | paperwork request is the point of the message | Eval |
| CLS-08 | Low Priority / Noise | vendor promo, no action | Eval |
| CLS-09 | Low Priority / Noise | newsletter from a key client, judged on content | Eval |
| CLS-10 | Opportunity Update | prompt says use this "even when it adds scope and reads like a fresh request" | Eval |
| CLS-11 | Bid Outcome | tabulation named in the Bid Outcome definition | Eval |
| CLS-12 | Client & Network | relationship, no live job | Eval |
| CLS-13 | New Opportunity | threads render oldest-first and classify on the opening request | Eval + Offline (`wiring.test.js` proves the render order) |
| CLS-14 | Unclassified | reached only through the fallback branch | Eval + Offline (`resolveCategory` on empty output) |

Structural guarantees checked offline in `test/wiring.test.js` and `test/workflows.test.js`:
nine bins exist, all nine classifier outputs are wired so nothing is dropped, single-class
is enforced in code, and the prompt carries the never-route-a-solicitation-to-Noise rule.

**Bars.** Overall accuracy 0.92, recall 0.98 / 0.95 / 0.95 on the three pursuit categories,
and zero solicitation leakage into Noise, all scored in `bin/aog-eval.mjs`.

---

## Suite 2: Extraction

Implemented in `prompts/extractor.schema.json`, `prompts/extractor.system.txt`,
`src/extract.js`. Fixtures in `test/fixtures/extraction.json`.

| Case | What it pins | How it is handled | Check |
|---|---|---|---|
| EXT-01 | full field set from CLS-01 | schema field descriptions carry the rules (project name without the bid number, client from the domain) | Eval |
| EXT-02 | date deferred to an attachment | `date_in_attachment` exists so a null due date is a statement, not a shrug | Eval |
| EXT-03 | primary vs other dates | bid date beats pre-bid, stated in the prompt | Eval |
| EXT-04 | active project, no date | null stays null | Eval |
| EXT-05 | four requested items, "by Friday" | matcher resolves the weekday rather than hardcoding it | Eval + Offline (`matchers.test.js`) |
| EXT-06 | intro fields from CLS-05 | `intro_opportunity` / `intro_target` | Eval |

Offline in `wiring.test.js`: a missing date normalizes to `null` and never to a guess,
`due_date` and `primary_due_date` stay in step, and an intro target with no intro is dropped.

**Bar.** Due-date exact match 0.95, plus a red-line count of real deadlines recorded as null.

---

## Suite 3: Priority tier — fully offline, passing

Implemented in `src/tier.js` and `config/contacts.json`. Tested in `test/priority.test.js`.

| Case | Expected | Check |
|---|---|---|
| PRI-01 | key_client, source lookup | Offline |
| PRI-02 | unknown, source default | Offline |
| PRI-03 | internal, source lookup | Offline |
| PRI-04 | routed Noise, tier still key_client | Offline |

Plus: `Name <addr>` parsing, domain fallback, and the red-line test that a tier emitted by
a model is stripped before it can reach a record.

**Bar.** Correct tier 1.00. Met, and it is a pure table lookup so it cannot drift.

---

## Suite 4: Thread summary

Implemented in `prompts/summary.system.txt` and `src/summarize.js`. Fixtures in
`test/fixtures/thread-summary.json`, where the threads the spec describes in prose are
written out so the contains-checks have something concrete to run against.

| Case | What it pins | How it is handled | Check |
|---|---|---|---|
| SUM-01 | 6 borings, 25 ft, Cedar Park, ≤60 words | the eval collects every number in the thread, so an invented count fails | Eval |
| SUM-02 | 8 borings current, 4 not the plan | prompt: "report where the thread landed, not where it started" | Eval |

SUM-01's "any depth or count not in the thread" is checked by set difference against the
thread's own numbers rather than by a hand-written blocklist.

---

## Suite 5: Draft reply — lint fully offline and passing

Implemented in `src/draft.js` (the gate), `prompts/draft.system.txt` (the writing),
`src/draftLint.js` (the check). Tested in `test/draft-lint.test.js`, fixtures in
`test/fixtures/draft.json`.

| Case | Expected | Check |
|---|---|---|
| DRV-01 | draft generated, lint clean | Offline (lint) + Eval (generation) |
| DRV-02 | no draft, response_needed false | Offline |
| DRV-03 | defers pricing, no dollar figure | Offline (lint) + Eval (generation) |

The lint covers em dashes, the banned vocabulary and phrase lists, required contractions,
"not just X but Y", self-posed questions, anaphora, semicolons, length, and the fabrication
guard. The fabrication guard is comparative: a figure is a violation only when the source
thread does not contain it, so quoting a number back at the person who wrote it passes.

A draft that fails the lint is regenerated once with its violations fed back. A second
failure means no draft at all.

**Bars.** Lint pass 1.00 and fabricated commitments 0, both enforced as gates.

---

## Suite 6: Stale follow-up — fully offline, passing

Implemented in `src/stale.js`, wired in `workflows/02-stale-followup.json`. Tested in
`test/stale.test.js`.

| Case | Expected | Check |
|---|---|---|
| STL-01 | surfaced at day 6, threshold 5 | Offline |
| STL-02 | not surfaced, reply on day 2 | Offline |
| STL-03 | not surfaced, different person same thread | Offline |

Matching is on `conversationId` alone, which is what makes STL-03 work. Additional cases
cover a reply that predates the last outbound (still stale), threads AOG never wrote on,
and noise that is never chased.

---

## Suite 7: Inbox learning — fully offline, passing

Implemented in `src/learning.js`, wired in `workflows/03-inbox-learning.json`. Tested in
`test/learning.test.js`.

| Case | Expected | Check |
|---|---|---|
| LRN-01 | 3 unread deletes lower the weight | Offline |
| LRN-02 | fast replies raise the weight | Offline |
| LRN-03 | key_client tier holds, weight barely moves | Offline |

LRN-03's floor is two mechanisms, not one: a per-action clamp on damped tiers, and a hard
per-tier weight floor. A separate test fires fifty deletes at a key client and asserts the
floor holds. A sender that bottoms out is flagged `review_for_demotion` for a human and is
never demoted automatically.

---

## Suite 8: Daily executive summary — fully offline, passing

Implemented in `src/dailySummary.js`, wired in `workflows/04-daily-summary.json`. Tested in
`test/daily-summary.test.js`.

| Case | Expected | Check |
|---|---|---|
| SUMX-01 | all five sections present | Offline |
| SUMX-02 | CLS-01 under New Opportunities, its 2/14 date under Critical Deadlines | Offline |
| SUMX-03 | empty section says none, not omitted, not padded | Offline |

Sections are a loop over `settings.dailySummary.sections`, so omission is structurally
impossible. A separate test feeds the job a day of stale records and asserts every section
comes back empty, which is the no-carryover half of SUMX-03.

SUMX-02 forced a config change: the critical-deadline horizon has to clear a normal bid
cycle, since CLS-01 arrives 30 days before its due date and the spec wants that date in the
same day's brief.

---

## Suite 9: Project-assistant integration — fully offline, passing

Implemented in `src/integration.js`, wired into the inbound pipeline. Tested in
`test/integration.test.js`.

| Case | Expected | Check |
|---|---|---|
| INT-01 | Oakmont record carries project name and stage | Offline |
| INT-02 | same message id twice, one record | Offline |
| INT-03 | no live write before approval, dry run logged | Offline |

INT-03 is enforced by construction rather than by a flag. The sink takes its live writer as
an injected dependency and the generated workflow injects nothing, so the node cannot reach
Pipedrive, SharePoint or the R: drive whatever it is fed. `test/workflows.test.js` asserts
no `liveWriter` appears in the generated Code node.

---

## The red line

| Ship blocker | Where it is stopped | Check |
|---|---|---|
| A real solicitation routed to Low Priority / Noise | explicit precedence rule in the classifier prompt, plus a per-pass leakage counter in the eval | Offline (rule present) + Eval (counted) |
| A real deadline recorded as "no deadline" | schema wording, `date_in_attachment` as the honest alternative, and a swallowed-deadline counter | Offline (null never guessed) + Eval (counted) |
| A project email written to a live system with no approval gate | no live writer injected, everything queued and dry-run logged | Offline |
| A priority tier set by the LLM | no model in `src/tier.js`, tier absent from the extractor schema, `stripModelTier` on every result | Offline |
