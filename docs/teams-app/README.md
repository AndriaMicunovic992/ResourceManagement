# databob Teams app (bot install package)

This packages the bot so it can be **installed for people in Teams** — which is
what lets the bot open a 1:1 chat and DM them their reminders. You only build the
package once; installing it for a user (or org-wide) is what creates the
conversation the server needs.

## What you need
- The bot's **Microsoft App ID** (the same value entered in **Settings → Microsoft
  Teams → Bot App ID**).
- Two PNG icons in this folder:
  - `color.png` — 192×192, full colour.
  - `outline.png` — 32×32, transparent, single-colour (white on transparent).

## Build the package
1. In `manifest.json`, replace **both** `REPLACE_WITH_BOT_APP_ID` occurrences
   (`id` and `bots[0].botId`) with your bot's App ID.
2. Zip the **three files together at the top level** (no parent folder):
   ```
   manifest.json
   color.png
   outline.png
   ```
   → `databob-teams.zip`

## Install it
1. **Teams admin center** (admin.teams.microsoft.com) → **Teams apps → Manage
   apps → Upload new app** → upload `databob-teams.zip`.
2. To push it to everyone: **Teams apps → Setup policies → (Global / a policy) →
   Add apps → databob → Save**. Or let people add it themselves from the catalog.

## Confirm the bot's endpoint
In the Azure Bot resource → **Configuration → Messaging endpoint**:
```
https://<your-production-domain>/api/teams/messages
```
and make sure the **Microsoft Teams** channel is enabled.

## Verify delivery
1. In Teams, open the **databob** app/chat and send it any message (e.g. "hi") —
   this registers your conversation with the server.
2. In **Settings → Microsoft Teams**, click **Send test message to me** → the DM
   should arrive in that chat within a second or two.

## Roll it out without per-person action

You don't need each person to add the bot. Two options:

- **Teams setup policy** (admin, one-time): Teams admin center → **Teams apps →
  Setup policies → Global** → **Add apps → databob → Save**. Installs it for
  everyone; each install auto-registers their conversation. (Propagation can take
  a few hours.)
- **"Connect all people"** button in **Settings → Microsoft Teams** — installs the
  app for every Microsoft-linked person immediately via Microsoft Graph. Requires,
  on the bot's **app registration** (API permissions, **application** type, with
  **admin consent**):
  - `TeamsAppInstallation.ReadWriteForUser.All`
  - `AppCatalog.Read.All`
  The app must already be **uploaded to your org app catalog** (steps above) so
  Graph can find it by its App ID.

Notes
- Only people who sign in with **Microsoft (Entra SSO)** can receive DMs — that's
  how the Teams user is matched to a databob account.
- The messaging endpoint is public by design; the server verifies every inbound
  request against the Bot Framework signing keys before trusting it.
