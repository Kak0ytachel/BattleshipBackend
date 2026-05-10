-- Up Migration

CREATE TABLE "battleship"."users" (
   "user_id" serial4 NOT NULL,
   "name" varchar(255) COLLATE "pg_catalog"."default" DEFAULT 'Gracz'::character varying,
   "games_won" int4 DEFAULT 0,
   "games_lost" int4 DEFAULT 0,
   "created_at" timestamp(0) DEFAULT now(),
   CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- Down Migration

DROP TABLE "battleship"."users";