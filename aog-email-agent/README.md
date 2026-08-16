# AOG Email Agent

Inbound mail for Alpha Omega Geotech: routed into nine bins, facts pulled into a fixed
schema, priority set from the contacts table, reply drafts written and linted, plus three
scheduled jobs. Built against `aogemailagenttestspec.md`, which is treated as the
requirement and not as a suggestion.

## Running it

```bash
cd aog-email-agent

npm test          # everything that does not need a model. 129 checks, no dependencies.
npm run build     # regenerate workflows/*.json from src/ and config/
npm run eval      # the model-backed suites, scored against the spec's bars
```

`npm test` needs nothing but Node 20+. There is no install step and no dependency tree.

`npm run eval` needs `ANTHROPIC_API_KEY`. It runs every fixture three times, as the spec
asks, and reports a case that disagrees with itself as FLAKY rather than quietly taking the
majority answer. Set `AOG_LLM_CACHE=1` to record a run and replay it later.

## How it fits together

```
Outlook trigger
  -> Normalize Message        one text rendering, shared by every later prompt
  -> Priority Tier Lookup     contacts table, no model, runs before anything else
  -> Text Classifier          8 categories + fallback branch = nine bins
  -> Bin: <name>              one Set node per branch, stamps category and folder
  -> Move To Folder
  -> Information Extractor    fixed schema, reference date injected
  -> Merge Facts              strips any tier the model tried to emit
  -> Needs A Reply?           response_needed AND category on the draft list
       yes -> Write Draft -> Lint Draft -> Draft Clean? -> Save Reply Draft
       no  -> Stage Project Record
```

Three scheduled workflows run off the same code: stale follow-up, inbox learning, daily
executive summary.

### Where the logic actually lives

n8n Code nodes cannot import local files, so pure logic would normally have to exist twice
and drift. It doesn't here. `bin/build-workflows.mjs` reads the real module source, strips
the ESM syntax, and pastes it into the Code node with the config frozen in. The unit tests
run against `src/`, and `test/workflows.test.js` parses every generated body so a broken
paste fails the suite rather than the mailbox.

Edit `src/` and `config/`. Never edit `workflows/*.json`. Run `npm run build` after.

## Design decisions worth knowing

**Unclassified is the fallback branch, not a ninth category.** If it were listed as a
category the model could pick it by elimination, and "no clear match" would start competing
with real bins. As a fallback it can only be reached by the model declining everything else.

**The tier never touches a model.** `src/tier.js` has no LLM import and never will.
`stripModelTier()` runs on every extraction result and deletes anything tier-shaped before
it can reach a record. Both are asserted in `test/priority.test.js`.

**Content decides the bin, the table decides the tier.** A marketing blast from a key
client files as Noise and still carries `key_client`. Neither overrides the other.

**Single-class is enforced in code.** If the model hedges and marks two bins true,
`resolveCategory()` takes the earlier one on the documented tie-break ladder rather than
whichever key happened to come first in the JSON.

**The five daily-brief sections are assembled in code.** A model asked to write a brief
will eventually drop an empty section or backfill it with something old to look useful.
The section list is a loop over config, so it cannot.

**Nothing writes outward.** `ProjectAssistantSink` has no live writer attached in the
generated workflow. It builds the intended write, logs it as a dry run, and parks it for
approval. Replies are created with `saveAsDraft`, so the workflow cannot send mail at all.

**Two lint failures and nobody gets a draft.** An empty drafts folder beats one Alex has to
proofread for invented prices.

## Layout

```
config/     categories, contacts table, operational knobs
prompts/    classifier, extractor, summary and draft system prompts
src/        the implementation, unit tested
test/       fixtures from the spec + the offline suites
workflows/  generated n8n JSON, importable
bin/        the eval runner and the workflow generator
docs/       spec coverage table
```

See `docs/spec-coverage.md` for a fixture-by-fixture map of where each spec case is
implemented and tested, and `docs/open-questions.md` for what still needs an answer.
