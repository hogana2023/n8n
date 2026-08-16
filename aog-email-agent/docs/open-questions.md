# Open questions

Everything the build needs an answer on. Nothing here is guessed in the code. Where a value
was needed to make a test run, it sits in `config/` marked PLACEHOLDER and is listed below.

## 1. Credentials

**Rotate the two passwords in the env file.** They were sent in plain text in an RTF
attachment: `dflessner@aogeotech.com` with a password that names a child's birthday, and
`dave@mustartseedkc.vom` with another. Treat both as compromised and change them. Neither
is in this repo, in the workflow JSON, or in any log, and `test/workflows.test.js` asserts
they never get in.

Beyond that, they are the wrong kind of credential. n8n does not log in as a person. It
needs:

| What | Node needs | What to send |
|---|---|---|
| Mailbox | `microsoftOutlookOAuth2Api` | An Entra ID app registration: tenant ID, client ID, client secret, and the redirect URI pointed at your n8n instance. Delegated Graph scopes `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.Read`, `offline_access`. |
| Pipedrive | `pipedriveApi` | An API token from Personal preferences, not an account login. Only needed once the approval gate is cleared for live writes. |
| Model | `anthropicApi` | An Anthropic API key. |

Two things I need you to confirm rather than assume:

- **Which mailbox is this agent running on?** The env file gives `dflessner@aogeotech.com`,
  the spec is written around a person called Alex, and `integrations@aoegeotech.com` appears
  next to Pipedrive with a different domain spelling (`aoe` vs `aog`). One of those is
  probably a typo. `config/settings.json` has `mailbox.address` as a placeholder until you
  say which.
- **Is `dave@mustartseedkc.vom` in scope at all?** It looks unrelated to AOG, and the domain
  ends `.vom`, which reads like a typo for `.com`. I have not used it for anything.

## 2. The contacts table

`config/contacts.json` is populated with the spec's placeholder addresses so Suite 3 runs.
The real AOG list needs to replace it: which senders and domains are `key_client`, `client`,
`prospect`, `vendor`, and who counts as `internal`. Send it in any form and I'll load it.

Worth deciding at the same time: should the table be a file in this repo, or should it read
from Pipedrive so it stays current without a redeploy? A file is simpler and has no runtime
dependency. Pipedrive means one place to maintain.

## 3. Stale follow-up threshold

The spec calls its five days a placeholder. Two questions:

- What is the real number?
- **Calendar days or business days?** Currently calendar, because that is how the spec
  writes STL-01 (day 0 to day 6 is 6). Business days is probably what a person actually
  wants: a Friday send would not surface until the following Friday instead of on Wednesday.
  One config flag, `staleFollowUp.businessDaysOnly`, and both are tested.

Should the threshold vary by tier? Chasing a key client after 3 days and an unknown sender
after 10 is easy to add.

## 4. Outlook folder names

The nine folders in `config/categories.json` are named `AOG/01 New Opportunity` and so on,
numbered so they sort in the order work actually flows. If folders already exist in the
mailbox, send the exact display names and I'll match them, because the move step resolves
folders by name.

## 5. Draft policy

Currently drafts are created for New Opportunity, Opportunity Update, Active Project,
Compliance & Docs and Client & Network. **Bid Outcome is deliberately excluded**: an award
or a loss seemed like a message Alex answers himself. Say if that is wrong.

Also worth confirming: drafts are created as reply-to-sender-only. Reply-all is a one-line
change if these threads normally carry a CC list that matters.

## 6. Inbox learning inputs

`workflows/03-inbox-learning.json` has one node, `Collect Inbox Actions`, that ships as the
shape of the data rather than a working Graph query. Everything downstream is tested against
that shape, but the collection itself needs decisions:

- Is Deleted Items retention long enough to see a week of deletes?
- Do you want archive treated as a weaker negative than delete, as it currently is?
- Reply latency needs sent mail matched back to its conversation. Fine to compute, but it
  means the job reads Sent Items too.

## 7. Project assistant target

`INT-03` is satisfied and every write is parked behind the gate. To make the writes real I
need to know which system is the system of record for a project (Pipedrive deal? a
SharePoint list? the R: drive?), what identifies a project there, and **who signs off**.
Approval currently requires a named approver and is otherwise a hard stop.

## 8. Scale

Roughly how much mail lands in this box per day? It changes whether the extractor should run
on every message or only on the bins where its output is used, which is most of the model
spend in the pipeline.
