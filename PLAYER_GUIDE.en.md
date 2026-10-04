[简体中文](./列车狼人杀游玩指南.md) ｜ **English**

# Train Werewolf — Player Guide

> A speeding train, a journey hiding deadly intent. Can you make it to the station alive?

---

## 1. What Kind of Game Is This?

Train Werewolf is a **multiplayer deduction-versus game**. You and your friends board the same train, but a **Killer** is hidden among you. The Killer's goal is to quietly eliminate everyone, while the passengers must survive and find the Killer.

- **Player count**: 5 ~ 15
- **Duration**: about 10 minutes by default (configured by the admin, range 5 ~ 20 minutes)
- **Roles**: 1 Killer, 1 Officer, everyone else is a Civilian

---

## 2. How a Round Unfolds

### ① Board and wait for departure
Get on the train and stand inside. Once everyone is aboard, the train **departs automatically**; an admin can also order departure manually. Before departure, the action bar shows "players boarded / total players".

> During the waiting phase you get two things: a **Guide Book** (click to view gameplay and map info at any time) and **Teleport to Train Head** (click to return to the train head). After departure the teleport item is taken back, and only the Guide Book remains.

### ② Roles are randomly assigned
After departure, the system randomly assigns everyone a role and privately tells you what you are.

### ③ Do tasks, earn coins
Shortly after the game starts, the system will **randomly assign you tasks** (not everyone has one at the same time). Tasks have a countdown, and **failing to finish before it runs out means instant death** (except for the Killer).

### ④ The Killer acts in secret
The Killer has an exclusive shop and can buy weapons such as poison, daggers, and grenades. The Killer also receives tasks, but those are only a **disguise** — running out of time won't kill them.

### ⑤ A winner is decided, return to the platform and restart
After the result is settled, everyone is teleported back to the platform, inventories are cleared, starting items are re-issued, and the next round is prepared.

### In-round HUD explained
Once a match starts, the vanilla health bar, hunger bar, and status-effect icons are **hidden** (so you can't tell at a glance who is hurt or poisoned). All key information is shown via the **action bar (the line of text above the hotbar)** and the **chat**, for example:

- Remaining game time (Killer only)
- Your task and its countdown (the countdown also shows on the XP bar)
- Stamina bar (only appears when your stamina is not full)

---

## 3. Three Roles, Three Playstyles

| Role | Count | Your Objective |
|------|:--:|------|
| 🩸 Killer | 1 | Kill everyone and stay hidden |
| 🔫 Officer | 1 | Protect passengers, find and kill the Killer |
| 🧑 Civilian | The rest | Survive and help the Officer find the Killer |

### 🩸 Killer — You Are the Hunter

You are the only person on the train who knows what they're doing.

**Your advantages:**
- You start with **100 coins**, then automatically gain **+15 coins** every 10 seconds
- An exclusive shop (occupying hotbar slot 9) where you can buy weapons others can't
- The action bar shows you the **remaining game time**
- **For each passenger that dies**: you gain **+100 coins** and the round time is extended by **+60 seconds**

**Your arsenal (see the Item Quick Reference for details):** Dagger, Derringer pistol, Crowbar, Lockpick, Poison, Grenade, Baseball Bat, Blackout Device.

**Killer tips:**
- Doing tasks is your **best disguise** — do them alongside others and nobody will suspect you
- Poison is the quietest kill — poison a plate and wait for someone to take and eat it themselves
- The "blackout + dagger" combo: first black out to blind everyone while you turn invisible, then strike amid the chaos
- Don't run around carrying the bat all day — the frenzy state instantly gives you away
- Each kill extends the round time, so you can afford to be patient

---

### 🔫 Officer — You Are the Guardian

You are the only law enforcer on the train, with a revolver — but you must **beware of friendly fire**.

**Your advantage:** You start with a **Revolver**.

**Your responsibility:** Protect civilians and find the Killer; complete tasks to earn coins and buy defensive items for yourself.

**A deadly rule — friendly-fire penalty:**
As soon as your bullet hits a **Civilian**, your pistol will **drop immediately** (fall to the ground, where someone else can pick it up), and you will **permanently lose the right to carry a gun**. Always confirm your target before firing!

**Officer tips:**
- The pistol is a deterrent, not a tool for spraying shots — aim carefully before firing
- Buy a "Magic Conch" and confirm a suspect's role before acting
- The "Father's Pocket Watch" is your second life — acquire it first
- Communicate with civilians, exchange clues, and don't charge in alone

---

### 🧑 Civilian — You Are the Survivor

You are an ordinary passenger on the train, with no weapon and no privileges, but you are the **largest group** — and the Killer is hiding among you.

**Your daily routine:**
- Complete tasks to earn coins
- Use coins to buy items and stay alive
- Observe the people around you and work with the Officer to catch the Killer

**Civilian tips:**
- Buy the "Father's Pocket Watch" first — it can block one fatal hit for you
- If you find someone suspicious, use the "Magic Conch" to confirm their role
- Don't act alone — the Killer loves isolated prey
- Watch for who keeps sneaking around near the plates
- The Note is your only communication tool — make good use of it

---

## 4. Task Guide

Tasks are randomly assigned after the game starts; the countdown shows on the **XP bar**, along with a prompt. As time runs low, various negative effects are applied to you — this is the system warning you: **hurry up and do your task!**

> A Civilian's or Officer's task timing out = instant death (leaving a corpse). A task the Killer receives is only a disguise — timing out won't kill them.

| # | Task | How to do it | Tips |
|:--:|------|------|------|
| 1 | **Ventilation** | Walk to the ventilation area at the train head or tail and stand there for a while | — |
| 2 | **Toilet** | Find a toilet and crouch | With a **Water Bottle** you can complete it directly |
| 3 | **Sleep** | Open a room and find a bed to lie down on | The room door requires the matching key |
| 4 | **Eat** | Eat any valid food | Plates let you take food directly |
| 5 | **Hydrate** | Drink any valid beverage | — |
| 6 | **Social** | Stand near another passenger for a while | With a **Cigarette** you can smoke one to complete it directly |

---

## 5. Stamina and Movement

A **stamina system** is enabled in-round (it can be toggled by the admin):

- Max stamina is **100**; the stamina bar only shows on the action bar when it isn't full
- **Sprinting** continuously drains stamina
- After you stop sprinting for about 3 seconds, it begins to slowly recover
- Running out of stamina puts you in an "**exhausted**" state: you **cannot sprint** for a short time, and it clears only once stamina recovers to a certain level

**Jumping** may also be disabled by the admin (in-round only).

> Stamina values (drain/recovery rates), whether the system is enabled, and whether the Killer has infinite stamina are all adjusted by the admin in the config panel.

---

## 6. Item Quick Reference

| Item | Effect |
|------|------|
| Dagger | Charge and release to assassinate a player in front of you |
| Revolver | The Officer's sidearm, can fire; friendly fire on a Civilian drops the gun and permanently loses it |
| Derringer Pistol | A small gun, **it disappears if it doesn't hit** |
| Baseball Bat | Held by the Killer it enters about **30 seconds of frenzy** (faster movement), a swing that connects kills instantly; the bat auto-disappears after 30 seconds |
| Grenade | Throw it, and players within a radius of **3 blocks** die instantly |
| Poison | Poison a **plate**; someone who takes the poisoned food and eats it gets nauseous after about **5 seconds** and dies of poison in **60 seconds** (Royal Jelly cures it) |
| Blackout Device | Killer only: all players on the map are **blinded for 20 seconds**, while the Killer becomes **invisible for 20 seconds** |
| Crowbar | Pries a door and locks it shut (see "Doors and Keys"); using it consumes 1 |
| Lockpick | A master key that can open doors **1~9** without leaving a trace |
| Keys 1~8 | Open the room door with the matching number; randomly issued at the start |
| Magic Conch | Right-click another player to **privately** learn their role (Killer/Officer/Civilian); consumes 1 |
| Father's Pocket Watch | While **held down and used**, the action bar shows the remaining time; when you take a fatal hit it is **automatically consumed to save you once** |
| Wild Royal Jelly | Drink it to **cure poisoning** |
| Mineral Water | Drinking it leaves a **Water Bottle** in your inventory |
| Water Bottle | Using it during the Toilet task completes it directly |
| Cigarette | Smoking one during the Social task completes it directly |
| Cocktails ×5 | Old Fashioned / Mojito / Martini / Cosmopolitan / Champagne, all valid beverages |
| Note | Use on air to edit its contents, use on a person to send it; after death the contents stay on your corpse |
| Firecracker | A spawn egg you can buy in the shop; once released it explodes on a timer |
| Guide Book | View gameplay and map info at any time |

---

## 7. Doors, Keys, and Crowbars

There are **10 numbered doors** on the train, each with different rules:

| Door | Opening condition |
|:--:|------|
| **Doors 1 ~ 8** | Requires the **key with the matching number**, or a **Lockpick** |
| **Door 9** | **Only a Lockpick** works |
| **Door 10** | **Requires no item at all** — anyone can open or close it |

**General rules:**
- After opening, a door automatically closes after **3 seconds** (except doors locked shut with a crowbar)
- If a **button** next to a door is pressed, the corresponding door opens automatically
- At the start, each person randomly receives one key; the key is locked in the inventory and **won't drop or be removed**; even if you die, others can't take it

**How to use the crowbar (consumes 1):**
- On **doors 1 ~ 9**: use it while **standing** (not sneaking) → opens the door and **locks it permanently** (locked for this round, reset after the result). After that, no one can open it with a key.
- On **door 10**: use it while **sneaking** → closes the door and **locks it for 40 seconds**.
- On a locked door, using a key shows "locked by a crowbar".

> Tip: prying open doors 1~9 is a "one-time sabotage", good for a Killer blocking routes; locking door 10 only lasts 40 seconds, good for temporary rearguard denial.

---

## 8. Coins and Shops

### Where do coins come from?
- **Killer**: starts at 100, +15 every 10 seconds, and +100 for each passenger death
- **Civilian / Officer**: +25 for each completed task (starting at 0)

### Where to buy?

**Killer Shop**
- The Killer opens the "Killer Shop" item in hotbar slot 9
- It contains Killer-exclusive weapons and items

**Vending Machine**
- Right-click the **vending machine block** on the map
- Everyone can buy, and the goods are configured by the admin

---

## 9. Note System (the Only Way to Communicate)

Everyone starts with a note, locked in the inventory.

**How to use it?**
- **Right-click air** → open the editing interface and type what you want to say
- **Right-click another player** → send the note's contents to them
- If you die, the note's contents **stay on your corpse**, where others can read them

The note is the game's **only text-communication method** — use it to pass intelligence, call for help, and warn others.

---

## 10. Death and Settlement

- **Death**: your character falls to the ground and becomes a **corpse** (bearing your name), then you enter **spectator mode**, able to watch but no longer act.
- **Falling off the train**: if you fall below the train, you are likewise eliminated (but leave no corpse).
- **Corpse**: other players can view your corpse (and the contents of your note).
- **Settlement**: after one side wins, everyone is teleported back to the platform, inventories and statuses are cleared, starting items are re-issued, and the next round is prepared.

**Win conditions:**

- Killer dies → **Passengers (Civilian + Officer) win**
- All passengers die → **Killer wins**
- Time runs out with passengers still alive → **Passengers win**

---

## 11. General Tips Quick Reference

### Playing the Killer
- Pretending to do tasks and acting together with everyone is the best disguise
- Poison is the safest — no direct confrontation needed
- The time after a blackout is your best chance to strike, but don't use it in front of others
- Buy a pocket watch for protection — if you die, the game is over

### Playing the Officer
- Don't rush to fire; confirm the role before acting
- Buy a conch first to verify suspects, and only fire once you've confirmed it's the Killer
- The pocket watch is your second life — be sure to buy it
- Communicate with civilians and gather intelligence

### Playing the Civilian
- The pocket watch is the most important item — buy it first
- Don't get isolated; acting as a group is safer
- Pay attention to whose behavior is abnormal
- The note is your mouth — use it to pass information

---

## 12. FAQ

**Q: Why can't I drop the items in my inventory?**
Starting items such as keys, the guide book, and the note are locked and can't be dropped or removed from the inventory, to prevent misclicks.

**Q: Why can't I see my health and hunger bars?**
These are hidden in-round to avoid exposing injured/poisoned states. Check the action bar and chat for key information.

**Q: Why did my bat suddenly disappear?**
The bat only sustains about 30 seconds of frenzy; once the time passes it auto-disappears.

**Q: Can I pick my gun back up after dropping it?**
You can pick it back up, but once an Officer hits a Civilian they **permanently lose the right to fire**, so picking it up is meaningless.

**Q: What happens if I fail a task?**
Civilians and the Officer die on the spot; the Killer's task is only a disguise, so timing out is harmless.

---

> Good luck — on this train, the one you should trust least is often the one who smiles the most naturally.