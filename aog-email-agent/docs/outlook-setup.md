# Connecting the mailbox

The Entra app registration exists. This is what to do with it.

**Nothing here is a place to paste the client secret.** It goes into n8n's credential store,
which encrypts it at rest, and nowhere else. The repo carries no AOG identifiers at all:
they live in `.env.local`, which is gitignored, and `.env.example` shows the names.

## 1. Two gotchas before you start

**The Secret ID is not the Secret Value.** Entra shows both on the same row and they look
alike. n8n wants the **Value**, the one with punctuation in it that Azure only shows once.
If you paste the Secret ID, auth fails with an unhelpful `invalid_client`.

**The default endpoints are wrong for a single-tenant app.** n8n ships the Microsoft
credential pointed at `/common/`, which only works for multi-tenant registrations. Swap
`common` for the tenant ID in both URLs or the consent screen rejects the sign-in.

## 2. Fill in the n8n credential

Credentials → New → **Microsoft Outlook OAuth2 API**.

| Field | Value |
|---|---|
| Client ID | `MS_CLIENT_ID` from `.env.local` |
| Client Secret | `MS_CLIENT_SECRET` from `.env.local` (the **Value**, not the ID) |
| Authorization URL | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/authorize` |
| Access Token URL | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token` |

Leave **Use Shared Mailbox** off unless the agent is running against a shared box rather
than a person's. If it is shared, turn it on and put the mailbox UPN in **User Principal
Name**.

## 3. Redirect URI

n8n shows its OAuth redirect URL at the top of the credential screen. It'll look like:

```
https://<your-n8n-host>/rest/oauth2-credential/callback
```

Copy that exactly into the app registration under **Authentication → Add a platform → Web
→ Redirect URIs**. It has to match character for character, including the scheme and any
port. This is the single most common reason the connect button fails.

## 4. Grant the Graph permissions

Under **API permissions**, add these **delegated** Microsoft Graph permissions. n8n
requests them by name during consent, and consent fails silently on anything missing:

```
openid              offline_access
Mail.ReadWrite      Mail.Send
Mail.ReadWrite.Shared   Mail.Send.Shared
MailboxSettings.Read
Contacts.Read       Contacts.ReadWrite
Calendars.Read      Calendars.Read.Shared      Calendars.ReadWrite
```

The pipeline itself only needs `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.Read` and
`offline_access`. The rest come along because n8n's Outlook credential requests one fixed
scope string for every Outlook node. If your tenant policy objects to the calendar and
contact scopes, that's a real conversation to have with whoever administers it, and the
answer is a narrowed credential rather than a narrowed consent.

If the tenant requires admin consent, click **Grant admin consent for <tenant>** after
adding them. Without it the connect button returns `AADSTS65001`.

Then hit **Connect my account** in n8n and sign in as the mailbox owner.

## 5. Create the nine folders

The router moves messages by folder **display name**, so the folders have to exist first
and the names have to match `config/categories.json` exactly:

```
AOG/01 New Opportunity      AOG/06 Internal - Team
AOG/02 Opportunity Update   AOG/07 Compliance & Docs
AOG/03 Bid Outcome          AOG/08 Low Priority - Noise
AOG/04 Active Project       AOG/09 Unclassified
AOG/05 Client & Network
```

Note `06` and `08` use a hyphen, not a slash. Outlook treats `/` as a folder separator, so
`Internal / Team` would silently create a nested folder called `Team`.

If you'd rather keep folder names you already have, send me the list and I'll change the
config instead. Don't rename them in Outlook only, the move step resolves by name and will
fail closed.

## 6. Check it before turning the pipeline on

Open the inbound workflow, select the **Inbox Trigger** node, and hit **Fetch Test Event**.
A message coming back means credential, redirect URI and scopes are all correct. Do this
before wiring the Anthropic key, so a failure has one possible cause instead of two.

## Rotate the secret

The client secret was pasted into a chat transcript, so treat it as exposed: create a new
one in **Certificates & secrets**, put the new value into n8n, then delete the old one.
Doing it in that order means no downtime. The same applies to the Anthropic key.
