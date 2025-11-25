# Data Model Design - Sneaky Town

## Overview

This document outlines the complete data model for Sneaky Town, a 2-player turn-based hidden information board game. The model supports:

- User accounts with unique usernames (case-insensitive)
- Online multiplayer only (test via multiple browser profiles)
- Timed and untimed games
- Multi-round games with win tracking
- Full move history for replay capability
- Matchmaking and invite system (username or link-based)
- Extensible meta-game mechanics

## Design Principles

1. **Hybrid Event Sourcing**: Store both denormalized state (for fast queries) AND complete move history (for replay/audit)
2. **Hidden Information**: Sight tile arrangements are private until revealed
3. **Transactional Consistency**: All state updates happen atomically with move recording
4. **Simple Data Structures**: Use arrays where possible for clarity and performance
5. **Extensibility**: Schema accommodates future features (stats, rankings, tournaments)

## Resolved Design Decisions

- ✅ **Online only**: No offline mode; use multiple test accounts on dev server for testing
- ✅ **Usernames**: Case-insensitive (store lowercase, allow any case for display)
- ✅ **Sight tiles**: Server-side shuffling for consistency
- ✅ **Turn timers**: Per-round timer with starting time + increment per turn + between-round timer
- ✅ **Matchmaking**: Fixed settings for V1 (5 min + 10s increment, 30s between rounds, first to 5 wins)
- ✅ **Invites**: 24-hour expiration, support both link and username-based
- ✅ **Move history**: Retained permanently for full replay capability
- ✅ **Lattice structure**: 2D array for simplicity and performance (see below)
- ✅ **Win conditions**: First-to-N or open-ended (no best-of-N)
- ✅ **Timed/Untimed**: Support both; matchmaking uses timed, invites can create untimed

---

## Core Entities

### 1. `users` Table

User profiles and authentication.

```typescript
{
  // Convex auth fields (automatically included):
  // _id, _creationTime, email, emailVerificationTime, etc.

  username: string,              // unique, 3-20 chars, alphanumeric + underscore
  usernameLower: string,         // lowercase version for case-insensitive lookup
  displayName?: string,          // optional friendly name
  createdAt: number,             // timestamp

  // Matchmaking
  inQueue: boolean,              // currently in matchmaking queue

  // Future stats fields:
  totalGames?: number,
  totalRoundWins?: number,
  totalGameWins?: number,
  elo?: number,
}
```

**Indexes:**

- `by_username_lower` on `[usernameLower]` (for case-insensitive lookup and uniqueness)
- `by_in_queue` on `[inQueue]` (for matchmaking)

**Notes:**

- Username must be unique (case-insensitive) and set during onboarding
- `usernameLower` is automatically set from `username` for lookups
- Display can preserve user's chosen capitalization
- Convex Auth handles email/password or OAuth

---

### 2. `games` Table

Overall game metadata spanning multiple rounds.

```typescript
{
  _id: Id<"games">,
  _creationTime: number,

  // Game identification
  status: "pending" | "active" | "betweenRounds" | "completed" | "abandoned",

  // Players
  player1Id: Id<"users">,
  player2Id?: Id<"users">,          // undefined until player 2 joins
  player1Color: "blue" | "brown",   // assigned at game creation

  // Round tracking
  currentRoundId?: Id<"rounds">,
  roundCount: number,               // number of rounds played
  roundWins: {
    player1: number,
    player2: number,
  },

  // Meta-game configuration
  winCondition: {
    type: "openEnded" | "firstToN",
    targetWins?: number,            // for firstToN (e.g., 3)
  },

  // Time control (null for untimed games)
  timeControl: {
    startingSeconds: number,        // initial time per player (e.g., 300 = 5 min)
    incrementSeconds: number,       // time added after each turn (e.g., 5)
    betweenRoundSeconds: number,    // time to ready up between rounds (e.g., 30)
  } | null,

  // Lifecycle
  createdAt: number,
  startedAt?: number,               // when both players joined
  completedAt?: number,
  winner?: "player1" | "player2" | "draw",

  // Between-round state
  betweenRoundState?: {
    player1ReadyForNext: boolean,
    player2ReadyForNext: boolean,
    betweenRoundStartedAt: number,  // for timing out between-round phase
  },
}
```

**Indexes:**

- `by_player1` on `[player1Id]`
- `by_player2` on `[player2Id]`
- `by_status` on `[status]`
- `by_player1_and_status` on `[player1Id, status]`
- `by_player2_and_status` on `[player2Id, status]`

**Notes:**

- `status: "pending"` - waiting for player2 to join
- `status: "active"` - round in progress
- `status: "betweenRounds"` - waiting for players to confirm next round
- `status: "completed"` - game finished normally
- `status: "abandoned"` - game left incomplete
- **Timed games**: `timeControl` is set; time runs during rounds and between rounds
  - Common time controls: `{startingSeconds: 300, incrementSeconds: 5, betweenRoundSeconds: 30}` (5+5, 30s to ready)
  - If player's time expires during round: auto-executes "end round" action
  - If player's time expires between rounds: game abandoned, opponent wins
- **Untimed games**: `timeControl` is `null`; no time pressure, can be picked up anytime
  - Ideal for casual play, asynchronous games with notifications (future)

---

### 3. `rounds` Table

Individual round data with denormalized state AND hidden information.

```typescript
{
  _id: Id<"rounds">,
  _creationTime: number,

  // Round identification
  gameId: Id<"games">,
  roundNumber: number,              // 1-indexed
  status: "setup" | "active" | "scoring" | "completed",

  // Turn management
  firstPlayer: "player1" | "player2",  // who goes first this round
  currentTurnPlayer: "player1" | "player2",
  turnNumber: number,               // increments with each move
  turnStartedAt: number,            // timestamp when current turn started

  // Time tracking (null for untimed games)
  timeRemaining: {
    player1: number,                // seconds remaining for player1
    player2: number,                // seconds remaining for player2
  } | null,

  // Round lifecycle
  startedAt: number,
  endedAt?: number,
  endedBy?: "player1" | "player2",  // who called "end round"

  // DENORMALIZED STATE (current state of the round)
  boardState: {
    // Stones on the 5x5 lattice (25 intersections)
    // lattice[leftIndex][rightIndex] = cell content
    // Each cell is null (empty) or { player, stoneId }
    lattice: Array<Array<{
      player: "player1" | "player2",
      stoneId: string,              // e.g., "player1-0" through "player1-7"
    } | null>>,                     // 5x5 array

    // Stones in reserve (available to cast)
    player1Reserve: string[],       // stone IDs, e.g., ["player1-0", "player1-3"]
    player2Reserve: string[],

    // Sacrificed stones (from Reveal and Swap actions)
    // These stones are placed on special positions and cannot be recovered
    player1Sacrificed: Array<{
      stoneId: string,
      actionType: "reveal" | "swap",
      revealIndex?: number,         // 0-4 if actionType === "reveal"
      swapIndex?: number,           // 0-11 if actionType === "swap"
    }>,
    player2Sacrificed: Array<{
      stoneId: string,
      actionType: "reveal" | "swap",
      revealIndex?: number,
      swapIndex?: number,
    }>,
  },

  // HIDDEN INFORMATION - sight tile arrangements
  // These arrays represent the ORDER of sight tiles in each player's rack
  // Index 0-4 corresponds to sight lines 0-4
  player1SightTiles: Array<"blueSun" | "brownSun" | "flower" | "void" | "void">,
  player2SightTiles: Array<"blueSun" | "brownSun" | "flower" | "void" | "void">,

  // Revealed sight tiles (after Reveal actions)
  revealedSightTiles: {
    player1: boolean[],             // 5 booleans, true if revealed
    player2: boolean[],
  },

  // SCORING (computed when round ends)
  scoring?: {
    charmLocations: {
      blueSun: { leftIndex: number, rightIndex: number },
      brownSun: { leftIndex: number, rightIndex: number },
      flower: { leftIndex: number, rightIndex: number },
    },
    capturedCharms: {
      player1: Array<"blueSun" | "brownSun" | "flower">,
      player2: Array<"blueSun" | "brownSun" | "flower">,
    },
    revealedVoidsByPlayer: {
      player1: number,              // count of voids revealed by player1
      player2: number,
    },
    points: {
      player1: number,
      player2: number,
    },
    winner: "player1" | "player2",  // ties go to non-ender
  },
}
```

**Indexes:**

- `by_game` on `[gameId, roundNumber]`
- `by_game_and_status` on `[gameId, status]`

**Notes:**

- **Lattice structure**: 5x5 2D array, access via `lattice[leftIndex][rightIndex]`
  - Simple and performant: O(1) access, easy iteration
  - Each cell is `null` or `{ player: "player1" | "player2", stoneId: string }`
  - StoneId needed for Transfer, Recover, and Swap actions
- Sight tiles are shuffled server-side during round setup
- Hidden information (sight tiles) is only sent to respective players in queries
- Stone IDs follow convention: `"player1-0"` through `"player1-7"`, `"player2-0"` through `"player2-7"`
- **Time tracking (timed games only)**:
  - Time is deducted from `timeRemaining` when turn completes, then incremented based on game's time control
  - If a player's time reaches 0 during round: system auto-executes "end round" action
  - If a player's time reaches 0 between rounds: game abandoned, opponent wins by timeout
- **Untimed games**: `timeRemaining` is `null`, no time pressure

---

### 4. `moves` Table

Complete event log for replay capability.

```typescript
{
  _id: Id<"moves">,
  _creationTime: number,

  // Move identification
  roundId: Id<"rounds">,
  gameId: Id<"games">,              // denormalized for easier querying
  turnNumber: number,
  player: "player1" | "player2",

  // Action data (discriminated union)
  action:
    | {
        type: "cast",
        stoneId: string,
        position: { leftIndex: number, rightIndex: number },
      }
    | {
        type: "transfer",
        stoneId: string,
        fromPosition: { leftIndex: number, rightIndex: number },
        toPosition: { leftIndex: number, rightIndex: number },
      }
    | {
        type: "recover",
        stoneId: string,
        fromPosition: { leftIndex: number, rightIndex: number },
      }
    | {
        type: "reveal",
        stoneId: string,              // stone being sacrificed
        targetPlayer: "player1" | "player2",
        sightLineIndex: number,       // 0-4
      }
    | {
        type: "swap",
        stoneId: string,              // stone being sacrificed
        swapIndex: number,            // 0-11 (which swap position)
        ownStoneId: string,           // player's stone being swapped
        opponentStoneId: string,      // opponent's stone being swapped
        ownStonePosition: { leftIndex: number, rightIndex: number },
        opponentStonePosition: { leftIndex: number, rightIndex: number },
      }
    | {
        type: "endRound",
      },

  timestamp: number,
}
```

**Indexes:**

- `by_round` on `[roundId, turnNumber]`
- `by_game` on `[gameId, timestamp]`

**Notes:**

- Moves are immutable once written
- Full replay capability by replaying moves in order
- Stores all necessary information to reconstruct state

---

### 5. `gameInvites` Table

Support for link-based and username-based invites.

```typescript
{
  _id: Id<"gameInvites">,
  _creationTime: number,

  // Invite metadata
  gameId: Id<"games">,
  inviteCode: string,               // unique random string (e.g., 8 chars)
  inviteType: "link" | "username",

  // Creator
  createdByUserId: Id<"users">,
  createdByPlayer: "player1" | "player2",

  // Targeting (for username invites)
  targetUsername?: string,

  // Usage
  status: "pending" | "accepted" | "declined" | "expired",
  usedByUserId?: Id<"users">,
  usedAt?: number,

  // Expiry
  expiresAt: number,                // timestamp
}
```

**Indexes:**

- `by_invite_code` on `[inviteCode]`
- `by_game` on `[gameId]`
- `by_target_username` on `[targetUsername, status]`
- `by_created_by` on `[createdByUserId]`

**Notes:**

- Link invites: `inviteType === "link"`, no `targetUsername`, anyone can join
- Username invites: `inviteType === "username"`, specific `targetUsername` (case-insensitive match)
- Invites expire after 24 hours
- Invite code must be unique (8-character alphanumeric)

---

### 6. `matchmakingQueue` Table

Players waiting to be matched for a game.

```typescript
{
  _id: Id<"matchmakingQueue">,
  _creationTime: number,

  // Player info
  userId: Id<"users">,
  username: string,               // denormalized for easy display

  // Preferences (for future use - V1 uses fixed settings)
  // V1: All entries use same settings, fields kept for future flexibility
  timeControl: {
    startingSeconds: number,
    incrementSeconds: number,
    betweenRoundSeconds: number,
  } | null,                         // null for untimed games
  winCondition: {
    type: "openEnded" | "firstToN",
    targetWins?: number,
  },

  // Matching
  status: "waiting" | "matched",
  matchedWithUserId?: Id<"users">,
  gameId?: Id<"games">,

  // Lifecycle
  joinedAt: number,
  matchedAt?: number,
  expiresAt: number,              // auto-remove after 10 minutes
}
```

**Indexes:**

- `by_user` on `[userId]`
- `by_status` on `[status, joinedAt]` (for FIFO matching)

**Notes:**

- **V1: Fixed matchmaking settings** - all matchmaking games use the same configuration:
  - Time control: `{ startingSeconds: 300, incrementSeconds: 10, betweenRoundSeconds: 30 }` (5 min + 10s, 30s between rounds)
  - Win condition: `{ type: "firstToN", targetWins: 5 }` (first to 5 round wins)
  - This eliminates matching complexity and provides consistent competitive experience
- Simple FIFO matching for V1: first person in queue matches with next person
- Queue entries expire after 10 minutes of waiting
- When match found, both entries updated to `status: "matched"` and linked to new game
- Future V2+: Allow custom preferences with flexible matching and ELO ranges
- Untimed games and custom time controls only available via invite system

---

## Action Types Reference

The six action types from the rules:

1. **Cast**: Place a reserve stone onto an empty lattice intersection
2. **Transfer**: Move an already-cast stone to a different empty intersection
3. **Recover**: Return a cast stone to your reserve
4. **Reveal**: Sacrifice a reserve stone to reveal opponent's sight tile
5. **Swap**: Sacrifice a reserve stone to swap your stone with opponent's stone
6. **End Round**: End the round and proceed to scoring

---

## State Transitions

### Game Lifecycle

```
pending → active → betweenRounds → active → ... → completed
                                    ↓
                                abandoned
```

### Round Lifecycle

```
setup → active → scoring → completed
```

### Between-Round Flow

1. Round ends with status "completed"
2. Game status becomes "betweenRounds"
3. Both players see round results and "ready for next round" button
4. When both ready, new round created, game status returns to "active"
5. If either player declines, game status becomes "completed"

---

## Hidden Information Strategy

**Problem**: Sight tiles must be hidden from opponent until revealed.

**Solution**: Queries filter based on requesting user:

```typescript
// In query for round state
export const getRoundState = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const round = await ctx.db.get(args.roundId);
    const game = await ctx.db.get(round.gameId);

    // Determine which player is requesting
    const isPlayer1 = game.player1Id === userId;
    const isPlayer2 = game.player2Id === userId;

    return {
      ...round,
      // Only send appropriate sight tiles
      player1SightTiles: isPlayer1 ? round.player1SightTiles : null,
      player2SightTiles: isPlayer2 ? round.player2SightTiles : null,
      // Send revealed tiles to both
      revealedSightTiles: round.revealedSightTiles,
    };
  },
});
```

---

## Time Control Implementation

### Timed vs Untimed Games

**Timed Games** (`timeControl` is set):

- Each player has a time bank that depletes during their turns
- Time is added back after each move (increment)
- Time runs during between-round phase with separate timer
- Auto-actions on timeout (end round during play, abandon between rounds)
- Typical for matchmaking and competitive play

**Untimed Games** (`timeControl` is `null`):

- No time pressure whatsoever
- Players can take as long as they want between moves
- No timeout/abandonment based on time
- Ideal for casual play, teaching, or asynchronous games
- Created via invite only (not available in matchmaking)

### Time Deduction Flow (Timed Games)

**During Round (Player Turns):**

1. Player makes a move at time `T1`
2. System calculates elapsed time: `elapsed = T1 - turnStartedAt`
3. Deduct from current player's time: `timeRemaining.currentPlayer -= elapsed`
4. **Check for timeout**: if `timeRemaining.currentPlayer <= 0`
   - Auto-execute "end round" action (player loses turn advantage)
   - Proceed to scoring with current board state
5. Otherwise, add increment: `timeRemaining.currentPlayer += game.timeControl.incrementSeconds`
6. Update `turnStartedAt = T1` for next turn

**Between Rounds:**

1. Round completes at time `T1`, game enters betweenRounds state
2. Set `betweenRoundStartedAt = T1`
3. Each player has `game.timeControl.betweenRoundSeconds` to ready up
4. When player readies, no time deduction
5. If time expires (`T_now - betweenRoundStartedAt > betweenRoundSeconds`):
   - Check which player(s) haven't readied
   - Game status becomes "abandoned"
   - Non-ready player(s) forfeit, opponent wins

### Example

```typescript
// Game settings: 5 minutes + 5 second increment, 30 second between rounds
timeControl: {
  startingSeconds: 300,
  incrementSeconds: 5,
  betweenRoundSeconds: 30
}

// Player 1's turn starts at T=0
// Player 1 thinks for 12 seconds, makes move at T=12
timeRemaining.player1 = 300 - 12 + 5 = 293 seconds

// Player 2's turn starts at T=12
// Player 2 thinks for 8 seconds, makes move at T=20
timeRemaining.player2 = 300 - 8 + 5 = 297 seconds

// ... round ends at T=180
// Player 1 readies at T=190 (10 seconds)
// Player 2 readies at T=205 (25 seconds)
// Both readied within 30 seconds → new round starts

// Alternative: if player 2 doesn't ready by T=210 (30 seconds)
// → Game abandoned, player 1 wins by timeout
```

### Timeout Behavior

| Phase          | Timeout Result                   | Winner Determination                             |
| -------------- | -------------------------------- | ------------------------------------------------ |
| During round   | Auto "end round" action executed | Scoring proceeds normally (may still win round!) |
| Between rounds | Game abandoned                   | Player who readied (or neither if both timeout)  |

---

## Extensibility Considerations

### Future Features to Support

1. **Player Stats**: Add stats fields to `users` table

   - Win/loss records
   - Average moves per round
   - Favorite strategies
   - ELO rating

2. **Advanced Matchmaking**: Enhance `matchmakingQueue`

   - Custom time control preferences (V1 uses fixed 5+10 first-to-5)
   - ELO-based matching
   - Rating ranges
   - Flexible matching (allow slight time variations)

3. **Tournaments**: New `tournaments` table

   - Bracket management
   - Scheduling
   - Prize pools

4. **Spectating**: Add `spectators` array to `games`

   - Real-time viewing
   - No hidden information shown to spectators

5. **Replay Sharing**: Add `replayShares` table

   - Public/private replay links
   - Annotations and commentary

6. **In-Game Chat**: New `messages` table (deferred for now)

   - Round-scoped messages
   - Emotes
   - Good game / thanks messages

7. **Game Variants**: Add `gameSettings` to `games`
   - Custom board sizes
   - Alternative scoring rules
   - Fischer random (random sight tile pools)

---

## Implementation Notes

### Why Track Stone IDs in Lattice?

Initially considered using just numbers (0=empty, 1=player1, 2=player2) for the lattice, but stone IDs are necessary because:

1. **Transfer action**: "Move THIS stone to another position" - need to identify which stone
2. **Recover action**: "Return THIS stone to reserve" - need to identify which stone
3. **Swap action**: "Swap my stone X with opponent's stone Y" - need both IDs
4. **UI feedback**: Showing which specific stone moved helps with animations and clarity

The 2D array of `{ player, stoneId } | null` gives us:

- ✅ O(1) position lookups: `lattice[left][right]`
- ✅ Stone identification for all actions
- ✅ Simple iteration: `for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)`
- ✅ Easy to serialize/validate with Convex validators

### Design Decisions - Resolved ✅

1. **Abandonment Logic**: ✅ RESOLVED

   - **Timed games**: 30-second window between rounds (configurable per game via `betweenRoundSeconds`)
   - If time expires during round: auto-execute "end round" action
   - If time expires between rounds: game abandoned, opponent wins
   - **Untimed games**: No abandonment based on time (future: manual forfeit button)

2. **Matchmaking Algorithm**: ✅ RESOLVED

   - Exact match on time control settings required
   - Simple FIFO within each preference group
   - Future: add flexible matching with ELO ranges

3. **Move Validation Errors**: ✅ RESOLVED

   - Not tracking for now (not worried about cheating)
   - Hidden information makes brute-force search less useful
   - Future: could add if cheating becomes an issue

4. **Reconnection Handling**: ✅ RESOLVED
   - Time keeps running in timed games (incentivizes quick reconnection)
   - Game state persists, can resume anytime
   - Convex's real-time subscriptions handle reconnection automatically

---

## Testing Strategy

With online-only mode, testing requires:

1. Multiple browser profiles or browsers (Chrome, Firefox, Safari)
2. Each profile signs in as different test user
3. Dev deployment URL is accessible across all browsers
4. Test invites by copying links between browsers
5. Test matchmaking by queueing from different browsers

Recommended test accounts:

- `testuser1@example.com` / `TestUser1`
- `testuser2@example.com` / `TestUser2`
- `testuser3@example.com` / `TestUser3`

---

## Next Steps

1. ✅ Finalize data model (current document)
2. Implement Convex schema in `convex/schema.ts`
3. Create TypeScript types in `src/game-logic/types.ts`
4. Implement game state machine in `src/game-logic/state-machine.ts`
5. Build core Convex mutations and queries:
   - User registration and username setting
   - Game creation and invites
   - Round setup with sight tile shuffling
   - Move execution with validation
   - Time tracking and timeout handling
   - Matchmaking queue management
6. Set up test users for multi-browser testing
