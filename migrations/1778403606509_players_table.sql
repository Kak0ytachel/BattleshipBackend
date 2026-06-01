-- Up Migration
CREATE TABLE "battleship"."players" (
     "player_id" serial4 NOT NULL,
     "user_id" int4 NOT NULL,
     "game_id" int4 NOT NULL,
     "role" int4,
     "is_active" bool NOT NULL DEFAULT true,
     "turns_skipping" int4 NOT NULL DEFAULT 0,
     "grid" jsonb,
     "is_current" bool DEFAULT false,
     "questions" varbit(100),
     "topics" varbit(20),
     "correct_answers" int4 NOT NULL DEFAULT 0,
     "wrong_answers" int4 NOT NULL DEFAULT 0,
     "bombs_placed" int4 NOT NULL DEFAULT 0,
     CONSTRAINT "players_pkey" PRIMARY KEY ("player_id")
);

-- Down Migration

DROP TABLE "battleship"."players";