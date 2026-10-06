# Space Attack: prompt history

## Chat 1 (1 of 1 the whole build happened here)

### 1. Kickoff

[Sent with the G2i brief and a screenshot of the reference longplay]

> Context: a paid calibration task from G2i, brief below, plus a screenshot from the reference longplay of Space Attack on the Emerson Arcadia 2001. Goal: a small, polished browser version that stays true to the original. Study the screenshot closely (formation, colours, HUD with energy bar and lives) and reverse engineer it, so we keep its theme and spirit alive. Must have: keyboard movement and firing with on-screen instructions, enemy waves, working collisions, a visible score and health or lives, increasing difficulty, and start, game over and restart screens. Constraints: a fresh project and two hours of active work. Deliverables: a GitHub repo and a Vercel deployment. Play test it before you finish, and tell me what you verified and anything left unfinished.

**Outcome:** the game was built as a fresh Vite and TypeScript canvas project covering every requirement, tested, and deployed to Vercel. The GitHub repo had to be created by hand.

**Takeaway:** pointing at the reference and listing the must-haves apart from the limits gives the work a clear finish line.

### 2. First push

> I've created AH228589/space-attack on GitHub. Please push the project and confirm the deploy still works.

**Outcome:** pushed, and Vercel connected to the repo so every push to main deploys.

**Takeaway:** naming the exact target and the expected end state makes success easy to check.

### 3. Mobile and mouse

> Goal: the game should work equally well on desktop, phones and tablets, in both orientations. Please add: 1) thumb-sized on-screen controls for left, right and fire (plus pause and sound), shown only on touch devices; 2) mouse support, where clicking or holding on the game fires. Constraint: no hard-coded px anywhere in the layout; use rem, % and viewport units so every screen size is supported. Test phone portrait, phone landscape and desktop before pushing.

**Outcome:** touch buttons, click or hold to fire, and portrait and landscape layouts in rem and viewport units. Testing caught two layout bugs (off-centre on desktop, touching the top edge in landscape), fixed before pushing.

**Takeaway:** a numbered checklist plus the screens to test on leaves nothing implied.

### 4. High scores and roguelike runs

> Two features. 1) A global arcade leaderboard: players who make the top 10 enter three initials arcade style (keyboard, touch and mouse); the table is shared across all players and shown at the end of every run; it should keep working offline and reject obviously fake scores; use storage that fits our Vercel setup. 2) Roguelike runs: real choices and variety between runs without losing the arcade identity. Propose an approach for both, then implement, test on a preview deployment, and only then push to production.

**Outcome:** a shared top 10 with arcade initials (a Vercel function with Blob storage, tested on a preview deployment first), an upgrade draft after every wave, random wave anomalies, and energy drops.

**Takeaway:** a shared leaderboard means a server, so saying so, along with the quality bars (offline, cheating, preview first), shapes a sturdier design from the start.

### 5. Bosses and difficulty

> Two changes. 1) A boss every 10 waves, designed as a bullet hell: dense but readable patterns, phases as its health drops, and a fair hitbox. 2) The upgrades made the game too easy: add enemy types with distinct behaviours, scale difficulty after each boss, and tone down the strongest upgrades. Measure the balance with a simulated playthrough rather than guessing, and show me the numbers.

[Follow-up sent while that work was in progress:]

> HUD change: replace the blinking 1UP in the top-left with a steady count of ships remaining, and make the last life stand out.

**Outcome:** a bullet-hell boss every 10th wave, three new enemy types, weaker upgrades, and a ships counter in place of 1UP. The simulated playthrough showed a weak build could take 16 minutes to beat a boss, so boss health was lowered and an enrage timer added.

**Takeaway:** asking for measurement instead of guesses is what surfaced the 16-minute boss fight.

### 6. Picking cards on mobile

> On phones, picking an upgrade card should feel natural: clear feedback when a card is touched, and no accidental picks while players are tapping to fire. Test it at phone size, then push to production.

**Outcome:** tapping already worked but took a card the instant it was touched; cards now work as press, slide and lift to take, with a TAKE label on the fire button.

**Takeaway:** describing the experience and the failure to avoid leads to a better design than naming the feature alone.
