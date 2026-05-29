-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."save_shot"("v_user_id" int4, "v_coordinate" text, "v_is_correct" bool)
    RETURNS "pg_catalog"."jsonb" AS $BODY$
DECLARE
    is_correct bool;
    v_opponent_user_id int;
    v_player_id int; -- shooter
    v_opponent_player_id int; -- shot
    v_game_id int;
    v_has_ship bool;
    v_grid jsonb;
    result_json jsonb;
BEGIN
    -- get opponent and user 's players
    v_opponent_user_id := "battleship".get_opponent(v_user_id);
    SELECT player_id into v_opponent_player_id from players where is_current = true and user_id = v_opponent_user_id;
    SELECT player_id into v_player_id from players where is_current = true and user_id = v_user_id;
    SELECT game_id into v_game_id from players where player_id = v_player_id;

    -- check if correct turn
    select (current_turn = v_user_id) into is_correct from games where game_id = v_game_id;
    if not is_correct then
        return jsonb_build_object('error', 'wrong turn');

    end if;

    -- check if has ship
    SELECT (grid->v_coordinate->>'has_ship')::boolean into v_has_ship FROM players where player_id = v_opponent_player_id;

    RAISE NOTICE 'v_has_ship: %', v_has_ship;

    -- mark as shot if answer is correct
    IF v_is_correct THEN
        UPDATE players SET grid = jsonb_set(grid, ARRAY[v_coordinate, 'is_shot'], to_jsonb(true), true) where player_id = v_opponent_player_id;
    ELSE
        UPDATE players SET grid = jsonb_set(grid, ARRAY[v_coordinate, 'tried'], to_jsonb(true), true) where player_id = v_opponent_player_id;
    END IF;

    -- update statistics for user (shooter)
    IF v_is_correct THEN
        UPDATE users set correct_answers = correct_answers + 1 where user_id = v_user_id;
    ELSE
        UPDATE users set wrong_answers = wrong_answers + 1 where user_id = v_user_id;
    END IF;

    -- go to next turn

    UPDATE games set current_turn = v_opponent_user_id where game_id = v_game_id;
    -- TODO: implement skipping turns on bombing

    select grid into v_grid from players where player_id = v_opponent_player_id;
    RAISE NOTICE 'v_grid: %', v_grid;

    result_json := jsonb_build_object('grid', v_grid, 'opponent_id', v_opponent_user_id);

    RAISE NOTICE 'result_json: %', result_json;

    return result_json;
--   return


END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100

-- Down Migration