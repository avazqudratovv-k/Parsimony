# Design notes

The full design lives in the Parsimony Design System artifact (Claude Design): cover, brand book, 10
component cards, 7 screen pages, light and dark mode. This file keeps the tokens next to the code so the
React/MUI theme can be built from them.

## Colors

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #FAF8F4 | #161917 | Page |
| surface | #FFFDF9 | #1F2321 | Cards, rows, inputs |
| surface-sunken | #F1EDE5 | #2B302D | Icon tiles, chart tracks |
| line | #E9E4DA | #2E3330 | Hairline borders |
| line-strong | #857D70 | #6E746F | Control borders (3:1) |
| ink | #1F2421 | #ECE8E0 | Text |
| ink-muted | #5B605C | #A8ADA8 | Secondary text |
| ink-faint | #736C61 | #8A908B | Placeholders |
| accent | #1F6F5C | #5FB89E | The one green |
| accent-strong | #185A4B | #7CCBB3 | Hover |
| accent-soft | #E3EEE9 | #1D2E28 | Selected |
| on-accent | #FFFFFF | #0E1A16 | Text on green |
| warn | #8A5A00 | #E2B65E | Low confidence, daily limit |
| warn-soft | #F6EBD3 | #2E2717 | |
| warn-wash | #FBF3E4 | #26221A | Low-confidence row tint |
| danger | #A33A2C | #F0907F | Parse failed |
| danger-soft | #F7E4DF | #33201C | |

## Spacing, radius, size
- Spacing: 4, 8, 12, 16, 20, 24, 32, 40 px. Mobile page edge 16; desktop page edge and column gap 32.
- Radius: 6 (badges), 12 (default), 20 (sheet, dialog, viewfinder), 999 (chips only).
- Touch target at least 44 px, add bar 48 px, row at least 64 px. Only the sheet and dialog have a shadow.

## Type (size/line height, weight)
- Fonts: Inter (UI, tabular numerals on all amounts), Newsreader italic (wordmark only), a monospace font for the "You said" box.
- display 28/34 600, title 20/28 600, heading 16/24 600, body 15/22 400, small 13/18, caption 12/16 500.
- Amounts: monthly total 32/38 600, rows 15/22 600, chart 14/20 500.
- Wordmark: 22/28 in the app bar, 40/44 on the landing page.

## Behavior decisions
- Add bar is docked at the bottom on mobile and at the top of the list on desktop.
- Chart is horizontal bars (largest category in accent, the rest light sage) with amount and percentage.
- Currency tabs change only the chart; the list always shows every entry in its own currency.
- Desktop rows have a "Fix this" button; on mobile, tap a row to open details where "Fix this" is the main button.
- Entries with confidence below 0.75 get a warm tint and "Check this" instead of the source badge.

## To reconcile with the backend
- The design mock shows 50 AI entries per day resetting at 00:00 KST. The backend default is 30 per
  account (10 for demo) resetting at 00:00 UTC. Show the real numbers from `GET /api/usage`, and format
  `resets_at` in the user's local time.
