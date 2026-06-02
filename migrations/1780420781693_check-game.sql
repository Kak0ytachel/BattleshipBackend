-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."check_game"("v_user_id" int4)
    RETURNS "pg_catalog"."int4" AS $BODY$
DECLARE
    v_player_id int; -- shooter
    v_game_id int;
BEGIN
    -- find game_id and player_id
    SELECT player_id, game_id into v_player_id, v_game_id FROM players where user_id = v_user_id and is_current = true;
    RAISE NOTICE 'v_game_id: %', v_game_id;
    IF FOUND THEN
        RAISE NOTICE 'v_game found';
        return v_game_id;
    end if;
    RAISE NOTICE 'v_game not_found';
    return -1;

END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."check_game";