-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."rate_done"("v_user_id" int4, "v_grade" int4)
    RETURNS "pg_catalog"."int4" AS $BODY$
DECLARE
    v_opponent_id int;
    v_player_id int; -- shooter
    v_opponent_player_id int;
    v_game_id int;
BEGIN
    -- find game_id and player_id
    SELECT player_id, game_id into v_player_id, v_game_id FROM players where user_id = v_user_id and is_current = true;
    -- find opponent info
    SELECT user_id into v_opponent_id FROM players where game_id = v_game_id and user_id != v_user_id;
    select player_id into v_opponent_player_id from players where user_id = v_opponent_id and is_current = true;
    RAISE NOTICE 'items: % % % % %', v_user_id, v_player_id, v_game_id, v_opponent_id, v_opponent_player_id;

    -- save speech topic
    UPDATE games set speech_grade = v_grade where game_id = v_game_id;
    -- return opponent_id
    return v_opponent_id;

END
$BODY$
    LANGUAGE plpgsql VOLATILE
                     COST 100;

-- Down Migration

DROP FUNCTION "battleship"."rate_done";