import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  users: defineTable({
    // Auth fields from @convex-dev/auth
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    // Game-specific fields
    username: v.optional(v.string()),
    usernameLower: v.optional(v.string()), // For case-insensitive lookup
    displayName: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    inQueue: v.optional(v.boolean()),
    // Stats fields
    totalGames: v.optional(v.number()),
    totalRoundWins: v.optional(v.number()),
    totalGameWins: v.optional(v.number()),
    elo: v.optional(v.number()),
  })
    .index("by_username_lower", ["usernameLower"])
    .index("by_in_queue", ["inQueue"]),

  games: defineTable({
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("betweenRounds"),
      v.literal("completed"),
      v.literal("abandoned"),
    ),
    player1Id: v.id("users"),
    player2Id: v.optional(v.id("users")),
    player1Color: v.union(v.literal("blue"), v.literal("brown")),
    currentRoundId: v.optional(v.id("rounds")),
    roundCount: v.number(),
    roundWins: v.object({
      player1: v.number(),
      player2: v.number(),
    }),
    winCondition: v.union(
      v.object({
        type: v.literal("openEnded"),
      }),
      v.object({
        type: v.literal("firstToN"),
        targetWins: v.number(),
      }),
    ),
    timeControl: v.union(
      v.null(), // null for untimed games
      v.object({
        startingSeconds: v.number(), // Initial time per player (e.g., 300 = 5 min)
        incrementSeconds: v.number(), // Time added after each turn (e.g., 10)
        betweenRoundSeconds: v.number(), // Time to ready up between rounds (e.g., 30)
      }),
    ),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    winner: v.optional(
      v.union(v.literal("player1"), v.literal("player2"), v.literal("draw")),
    ),
    betweenRoundState: v.optional(
      v.object({
        player1ReadyForNext: v.boolean(),
        player2ReadyForNext: v.boolean(),
        betweenRoundStartedAt: v.number(), // For timeout tracking
      }),
    ),
  })
    .index("by_player1", ["player1Id"])
    .index("by_player2", ["player2Id"])
    .index("by_status", ["status"])
    .index("by_player1_and_status", ["player1Id", "status"])
    .index("by_player2_and_status", ["player2Id", "status"]),

  rounds: defineTable({
    gameId: v.id("games"),
    roundNumber: v.number(),
    status: v.union(
      v.literal("setup"),
      v.literal("active"),
      v.literal("scoring"),
      v.literal("completed"),
    ),
    firstPlayer: v.union(v.literal("player1"), v.literal("player2")),
    currentTurnPlayer: v.union(v.literal("player1"), v.literal("player2")),
    turnNumber: v.number(),
    turnStartedAt: v.number(),
    timeRemaining: v.union(
      v.null(), // null for untimed games
      v.object({
        player1: v.number(), // Seconds remaining
        player2: v.number(), // Seconds remaining
      }),
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    endedBy: v.optional(v.union(v.literal("player1"), v.literal("player2"))),
    boardState: v.object({
      // 5x5 lattice, access via lattice[leftIndex][rightIndex]
      // 0 = empty, 1 = player1 stone, 2 = player2 stone
      lattice: v.array(v.array(v.number())),
      // Reserve counts (0-8 stones each)
      player1ReserveCount: v.number(),
      player2ReserveCount: v.number(),
      // Reveal positions (5 per player, left side = player1, right side = player2)
      player1RevealPositions: v.array(v.boolean()), // 5 booleans
      player2RevealPositions: v.array(v.boolean()), // 5 booleans
      // Swap positions (2 rows x 6 cols = 12 positions total, shared by both players)
      // 0 = empty, 1 = player1 stone, 2 = player2 stone
      swapPositions: v.array(v.array(v.number())),
    }),
    // 5 elements (one per sight line), server-shuffled, hidden from opponent
    player1SightTiles: v.array(
      v.union(
        v.literal("blueSun"),
        v.literal("brownSun"),
        v.literal("flower"),
        v.literal("void"),
      ),
    ),
    player2SightTiles: v.array(
      v.union(
        v.literal("blueSun"),
        v.literal("brownSun"),
        v.literal("flower"),
        v.literal("void"),
      ),
    ),
    revealedSightTiles: v.object({
      player1: v.array(v.boolean()), // 5 booleans, true if revealed
      player2: v.array(v.boolean()), // 5 booleans, true if revealed
    }),
    scoring: v.optional(
      v.object({
        capturedCharms: v.object({
          player1: v.array(
            v.union(
              v.literal("blueSun"),
              v.literal("brownSun"),
              v.literal("flower"),
            ),
          ),
          player2: v.array(
            v.union(
              v.literal("blueSun"),
              v.literal("brownSun"),
              v.literal("flower"),
            ),
          ),
        }),
        revealedVoidsByPlayer: v.object({
          player1: v.number(),
          player2: v.number(),
        }),
        points: v.object({
          player1: v.number(),
          player2: v.number(),
        }),
        winner: v.union(v.literal("player1"), v.literal("player2")),
      }),
    ),
  })
    .index("by_game", ["gameId", "roundNumber"])
    .index("by_game_and_status", ["gameId", "status"]),

  moves: defineTable({
    roundId: v.id("rounds"),
    gameId: v.id("games"), // Denormalized for easier querying
    turnNumber: v.number(),
    player: v.union(v.literal("player1"), v.literal("player2")),
    // Discriminated union of all 6 action types
    action: v.union(
      v.object({
        type: v.literal("cast"),
        position: v.object({
          leftIndex: v.number(),
          rightIndex: v.number(),
        }),
      }),
      v.object({
        type: v.literal("transfer"),
        fromPosition: v.object({
          leftIndex: v.number(),
          rightIndex: v.number(),
        }),
        toPosition: v.object({
          leftIndex: v.number(),
          rightIndex: v.number(),
        }),
      }),
      v.object({
        type: v.literal("recover"),
        fromPosition: v.object({
          leftIndex: v.number(),
          rightIndex: v.number(),
        }),
      }),
      v.object({
        type: v.literal("reveal"),
        targetPlayer: v.union(v.literal("player1"), v.literal("player2")),
        sightLineIndex: v.number(), // 0-4, maps directly to reveal position index
      }),
      v.object({
        type: v.literal("swap"),
        swapRow: v.number(), // 0-1
        swapCol: v.number(), // 0-5
        ownStonePosition: v.object({
          leftIndex: v.number(),
          rightIndex: v.number(),
        }),
        opponentStonePosition: v.object({
          leftIndex: v.number(),
          rightIndex: v.number(),
        }),
      }),
      v.object({
        type: v.literal("endRound"),
      }),
    ),
    timestamp: v.number(),
  })
    .index("by_round", ["roundId", "turnNumber"])
    .index("by_game", ["gameId", "timestamp"]),

  gameInvites: defineTable({
    gameId: v.id("games"),
    inviteCode: v.string(), // Unique 8-character alphanumeric string
    inviteType: v.union(v.literal("link"), v.literal("username")),
    createdByUserId: v.id("users"),
    createdByPlayer: v.union(v.literal("player1"), v.literal("player2")),
    targetUsername: v.optional(v.string()), // For username-based invites only
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
    ),
    usedByUserId: v.optional(v.id("users")),
    usedAt: v.optional(v.number()),
    expiresAt: v.number(),
  })
    .index("by_invite_code", ["inviteCode"])
    .index("by_game", ["gameId"])
    .index("by_target_username", ["targetUsername", "status"])
    .index("by_created_by", ["createdByUserId"]),

  matchmakingQueue: defineTable({
    userId: v.id("users"),
    username: v.string(), // Denormalized for easy display
    // V1: Fixed settings (5+10, 30s between, first-to-5). Fields kept for future flexibility
    timeControl: v.union(
      v.null(),
      v.object({
        startingSeconds: v.number(),
        incrementSeconds: v.number(),
        betweenRoundSeconds: v.number(),
      }),
    ),
    winCondition: v.union(
      v.object({
        type: v.literal("openEnded"),
      }),
      v.object({
        type: v.literal("firstToN"),
        targetWins: v.number(),
      }),
    ),
    status: v.union(v.literal("waiting"), v.literal("matched")),
    matchedWithUserId: v.optional(v.id("users")),
    gameId: v.optional(v.id("games")),
    joinedAt: v.number(),
    matchedAt: v.optional(v.number()),
    expiresAt: v.number(), // Auto-remove after 10 minutes
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status", "joinedAt"]), // FIFO matching
});
