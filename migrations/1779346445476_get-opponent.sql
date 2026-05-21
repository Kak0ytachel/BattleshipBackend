-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."get_opponent"("v_user_id" int4)
    RETURNS "pg_catalog"."int4" AS $BODY$
DECLARE
    v_game_id int4;
    opponent_id int4;
BEGIN

    SELECT games.game_id into v_game_id FROM players left join games on (players.game_id = games.game_id) where players.user_id = v_user_id and has_started = true and has_ended = false and is_current = true;
    SELECT players.user_id into opponent_id from games left join players on (games.game_id = players.game_id) where (games.game_id = v_game_id and players.user_id != v_user_id);
   RETURN opponent_id;
END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."get_opponent";