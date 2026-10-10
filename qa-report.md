# Night Yard QA

Checked on a phone-sized window (390 by 844, and a taller 402 by 874) and on a desktop window (1280 by 800), against the local app and a local PocketBase.

## What passed

Guest start: the welcome card offers a free account, try it first, and sign in. Try it first opens the field, then the short tour (Next, then Skip). The guest chip stays up until you make an account.

Sign up, sign in, change password, sign out, and sign in again with the new password. After sign out the plays stay on the phone. After sign in they still say they are saved to the account. A reload keeps the signed-in plays.

Sync: once the account matches the phone, the app makes no account requests for 10 seconds. An edit made while offline says it is saved on the phone and will sync. Coming back online saves it to the account. A reload still shows that edit (Stick moved to the 40).

Delete a play, tap Undo, and it comes back. A reload after a real edit keeps the play.

Playbooks: the last playbook cannot be deleted. A new one can be created, renamed, copied, and deleted. A play can be copied into another playbook and moved into another playbook.

Tools: Move and Draw stay selected when you open Paths or Plays and come back. Redraw does not switch the tool. On an 11-on-11 play the route bar has Block, Redraw, Remove, Flip, and Change. Flipping one route changes the drawing. Flip play mirrors the players. A defender can be given Deep third. Kickoff, kick return, punt, punt return, field goal, and field-goal block are on 11-on-11. Flag says it does not use kicking, and Block is not offered. Flag positions include QB, WR, and C, and leave out TE and T. Tackle positions include TE and T.

A new play opens on the 30. Corndog opens first (the ball is on the 3). Stick starts on the 30. Who has the ball can be Us or Them. Categories filter the list. On the desktop sidebar, search finds Stick, the play-type menu can hide the pass plays, and the down arrow moves to the next play. The phone list does not show a search box until there are more than 12 plays; that rule is covered by a unit test.

Playback starts, pauses, and the slider moves through the play.

Exports: a white picture and a color picture download as PNGs. A play file and a playbook file download as Night Yard JSON, and loading the play file brings the play back. Make a playbook PDF, in color and in white. Each file is a real PDF with a cover, a quick view, and one page per play. The color file is larger because the cover uses the color dog. The white file uses the line dog. Quick-view numbering is covered by the PDF unit tests.

Tooltips show on desktop hover. Show tips again starts the tour. The page sets maximum scale to 1 and user-scalable to no, and the app height follows the window. The tall phone keeps the welcome card, the field, and the tool bar on screen. Nothing scrolls sideways.

The production build uses base `/nightyard/`. `index.html` loads `/nightyard/registerSW.js`, which registers `/nightyard/sw.js`. That worker updates itself (`skipWaiting` and `clientsClaim`) and does not cache `/nightyard/pb` (network only, and the navigation fallback skips that path).

Automated checks: 149 unit tests, and 12 Playwright tests against the local PocketBase. `npm test` and `npm run test:e2e`.

## What was fixed

The welcome card stayed on top of the account form, so a real tap on Make free account or Sign in could not reach the boxes. The card now steps aside while the account form or the save prompt is open, and comes back if you close the form without signing in.

Closing Setup wrote the old lineup name back over the formation you had just picked. Kickoff could look selected, then the title returned to the previous lineup. The lineup name box now follows the formation you pick.

The Show password button sat inside the password label, so the field and the button shared one name. The button is now beside the field.

After sign out, the save line disappeared even though the plays were still on the phone. If the open play already matches what is stored, the line says Saved.

## Anything left

A live service-worker swap (install one build, then open a newer build and watch it replace itself) was not clicked through in a browser. The dev server does not register a worker on purpose. The production worker is generated as auto-update, and a unit test locks that setting.

The phone search box was not filled in with 13 plays on screen. The rule (search after 12) is a unit test, and the desktop search box was used.

A real pinch on a phone was not performed. The viewport tag forbids page zoom, and the pinch and double-tap helpers have unit tests.
