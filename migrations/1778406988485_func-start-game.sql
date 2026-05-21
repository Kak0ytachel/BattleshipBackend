-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."start_game"("v_user_id" int4, "v_join_code" varchar)
    RETURNS "pg_catalog"."bool" AS $BODY$
DECLARE
    v_game_id int;
    opponent_player_id int;
BEGIN
    -- Routine body goes here...
    SELECT games.game_id into v_game_id from games left join players on (games.game_id = players.game_id) where join_code = v_join_code and has_started = false and user_id != v_user_id;


    IF NOT FOUND THEN
        RETURN false; -- RAISE ERROR
    END IF;
    insert into players (user_id, game_id) values (v_user_id, v_game_id);
    update players set is_current = true where game_id = v_game_id and user_id = v_user_id;

    select player_id into opponent_player_id from players left join games on (players.game_id = games.game_id) where user_id != v_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Opponent not found';
    end if;

    update players set is_current = true where game_id = v_game_id and user_id = v_user_id;
    update games set has_started = true where game_id = v_game_id;

    return true;
END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."start_game";