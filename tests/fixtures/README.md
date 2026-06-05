# DOM Fixtures

Captured from the live Google Calendar Week view on 2026-06-04 (account
`you@example.com`). These are ground truth for `src/detect.js`.

## Files

- `declined.html` — an event the user has **declined**.
- `accepted.html` — an event the user has **accepted**.
- Tentative / all-day declined: **not captured** (none readily available at
  capture time). No fabricated fixtures. Detection logic targets the RSVP
  status field generically, so a tentative event would simply not match
  "Declined" and stay visible — the desired behavior.

## The detection signal

There is **NO strikethrough** in the current Google Calendar DOM (the original
design assumed `text-decoration: line-through`; this turned out to be wrong).

The durable signal is the accessibility text in the `div.XuJrye` element — the
screen-reader label. It is a comma-delimited string with the RSVP status as its
own field:

- Declined: `10:30am to 12pm, Team Sync, Sample User, Declined, No location, Color: Team Meetings, June 2, 2026`
- Accepted: `12pm to 12:30pm, Tech Proposal Review: ... , Sample User, Accepted, Location: https://..., June 2, 2026`

### Why match the delimited field, not a substring

The accepted event's **title** contains many commas and a URL. A naive
"does the text contain 'declined'?" check is fragile — an event titled
"Project declined-proposal review" would false-positive. The detector must
match `Declined` as a **comma-delimited token** (surrounded by `, ` / `,`),
i.e. one of the fields, not a loose substring.

### Element structure

- The event chip root is `div[role="button"][data-eventid]` (also has
  `data-eventchip`).
- The accessibility label lives in a descendant `div.XuJrye`.
- Matching on the root `data-eventid` element is what gets tagged for hiding.
