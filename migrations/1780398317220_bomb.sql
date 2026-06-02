-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."bomb"("v_user_id" int4, "v_coordinates" TEXT[], "v_grade" int4)
    RETURNS "pg_catalog"."jsonb" AS $BODY$
DECLARE
    is_correct bool;
    v_player_id int; -- bomber
    v_opponent_id int; -- bombed
    v_opponent_player_id int;
    v_game_id int;
    v_opponent_grade int4;
    v_cell TEXT;
    v_power int4;
    v_is_shot bool;
--     v_has_ship bool;
    v_grid jsonb;
    result_json jsonb;
    v_counter int4;
    v_power_counter int4;
    v_shot_cells text[] := '{}';
    v_user_skipping int4;
    v_opponent_skipping int4;
    v_min_skipping int4;
    v_next int4;
BEGIN
    -- find game_id and player_id
    SELECT player_id, game_id into v_player_id, v_game_id FROM players where user_id = v_user_id and is_current = true;
    -- find opponent info
    SELECT user_id into v_opponent_id FROM players where game_id = v_game_id and user_id != v_user_id;
    select player_id into v_opponent_player_id from players where user_id = v_opponent_id and is_current = true;
    RAISE NOTICE 'items: % % % % %', v_user_id, v_player_id, v_game_id, v_opponent_id, v_opponent_player_id;

    -- check if correct turn
    select (current_turn = v_user_id) into is_correct from games where game_id = v_game_id;
    if not is_correct then
        return jsonb_build_object('error', 'wrong turn');
    end if;

    -- get opponent grade and replace with null
    SELECT speech_grade into v_opponent_grade from games where game_id = v_game_id;
    UPDATE games set speech_grade = null where game_id = v_game_id;

    -- determine power
    v_power := random(least(v_grade, v_opponent_grade), greatest(v_grade, v_opponent_grade) );

    RAISE NOTICE 'power: % % %', v_grade, v_opponent_grade, v_power;
    v_power_counter := v_power;
    v_counter := 0;
    FOREACH v_cell IN ARRAY v_coordinates LOOP
        SELECT (grid->v_cell->>'is_shot')::boolean into v_is_shot FROM players where player_id = v_opponent_player_id;
        v_counter := v_counter + 1;
        IF v_is_shot AND v_counter + v_power_counter <= 9 THEN
            CONTINUE;
        end if;
        IF v_power_counter <= 0 THEN
            EXIT;
        end if;
        v_power_counter := v_power_counter - 1;
        UPDATE players SET grid = jsonb_set(grid, ARRAY[v_cell, 'is_shot'], to_jsonb(true), true) where player_id = v_opponent_player_id;
        v_shot_cells := v_shot_cells || v_cell;

    end loop;

    UPDATE players set bombs_placed = bombs_placed + 1 where player_id = v_player_id;

    -- go to next turn
    UPDATE players set turns_skipping = turns_skipping + 5 where player_id = v_player_id;

    SELECT turns_skipping into v_user_skipping from players where player_id = v_player_id;
    SELECT turns_skipping into v_opponent_skipping from players where player_id = v_opponent_player_id;

    v_min_skipping := greatest(least(v_user_skipping, v_opponent_skipping), 0);

    UPDATE players set turns_skipping = turns_skipping - v_min_skipping where player_id = v_player_id;
    UPDATE players set turns_skipping = turns_skipping - v_min_skipping where player_id = v_opponent_player_id;

    v_user_skipping := v_user_skipping - v_min_skipping;
    v_opponent_skipping := v_opponent_skipping - v_min_skipping;

    IF v_opponent_skipping = 0 THEN
        UPDATE games set current_turn = v_opponent_id where game_id = v_game_id;
        UPDATE players set turns_skipping = greatest(0, turns_skipping - 1) where player_id = v_player_id;
        v_next := v_opponent_id;
    ELSE
        UPDATE games set current_turn = v_user_id where game_id = v_game_id;
        UPDATE players set turns_skipping = greatest(0, turns_skipping - 1) where player_id = v_opponent_player_id;
        v_next := v_user_id;
    end if;




    -- TODO: implement skipping turns on bombing

    select grid into v_grid from players where player_id = v_opponent_player_id;
    RAISE NOTICE 'v_grid: %', v_grid;

    result_json := jsonb_build_object('grid', v_grid, 'opponent_id', v_opponent_id, 'power', v_power, 'cells', v_shot_cells, 'next', v_next);

    RAISE NOTICE 'result_json: %', result_json;

    return result_json;
--   return
END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."bomb";