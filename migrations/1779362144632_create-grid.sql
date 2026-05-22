-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."create_grid"("coordinates" jsonb, "v_user_id" int4)
    RETURNS "pg_catalog"."int4" AS $BODY$
DECLARE
    grid_dict JSONB := '{}'::jsonb;
    cell_num INT;
    cell_let_num INT;
    cell_let TEXT;
    grid_size INT;
    coordinate TEXT;
    has_ship BOOL;
    cell jsonb;

    v_game_id INT4;
    opponent_id INT4;
    is_empty bool;
BEGIN
    -- GET GAME_ID

    SELECT games.game_id into v_game_id FROM players left join games on (players.game_id = games.game_id) where players.user_id = v_user_id and has_started = true and has_placed = false and has_ended = false and is_current = true;

    -- CREATE GRID
    grid_size := 6;

    FOR cell_num in 1..grid_size LOOP

            FOR cell_let_num in 1..grid_size LOOP
                    cell_let := chr(64 + cell_let_num);
                    coordinate := cell_num || cell_let;
                    has_ship := jsonb_exists(coordinates, coordinate);
                    cell :=  json_build_object(
                            'has_ship', has_ship,
                            'is_shot', false,
                            'attempted', false
                             );
                    grid_dict := jsonb_set(grid_dict, ARRAY[coordinate], cell, true);

                END LOOP;
        END LOOP;

    -- INSERT GRID
    UPDATE players SET grid = grid_dict where user_id = v_user_id and is_current = true;

    IF NOT FOUND THEN
        RETURN -1; -- RETURNS -1 IF ERROR
    END IF;

    -- CHECK OPPONENT'S GRID

    SELECT players.user_id into opponent_id from games left join players on (games.game_id = players.game_id) where (games.game_id = v_game_id and players.user_id != v_user_id and is_active = true and is_current = true);

    SELECT (grid IS NULL) into is_empty FROM players where player_id = opponent_id and game_id = v_game_id;

    IF (is_empty) THEN

        RETURN 1; -- RETURNS 1 IF OKAY BUT OPPONENT NOT DONE YET

    END IF;

    UPDATE games set has_placed = true where game_id = v_game_id;

    RETURN opponent_id; -- RETURNS OPPONENT ID IF OPPONENT HAS PLACED TOO
END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."create_grid";