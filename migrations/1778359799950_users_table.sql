-- Up Migration

CREATE TABLE "battleship"."games" (
  "game_id" serial4 NOT NULL,
  "current_turn" int4,
  "has_started" bool NOT NULL DEFAULT false,
  "has_placed" bool NOT NULL DEFAULT false,
  "has_ended" bool NOT NULL DEFAULT false,
  "is_singleplayer" bool NOT NULL DEFAULT false,
  "join_code" varchar(255) COLLATE "pg_catalog"."default" DEFAULT NULL::character varying,
  CONSTRAINT "games_pkey" PRIMARY KEY ("game_id")
);

-- Down Migration

DROP TABLE "battleship"."games";