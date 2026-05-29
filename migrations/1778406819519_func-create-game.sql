-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."create_game"("v_user_id" int4)
    RETURNS "pg_catalog"."varchar" AS $BODY$
DECLARE
    v_game_id int;
    v_player_id int;
    code varchar;
    conflicts int;
    open_game_id int;
BEGIN

    -- CHECKS FOR RUNNING GAME WITH IS_CURRENT = TRUE AND RAISES ERROR IF FOUND
    select players.game_id into open_game_id from players left join games on (players.game_id = games.game_id) where (players.user_id = v_user_id and players.is_current = true and has_ended = false);

    if found then
        raise exception 'has_current_game: %', open_game_id;
    end if;

    -- CHECKS FOR STARTED GAME WITH NO PLAYERS JOINED AND RETURNS IF FOUND
    select join_code into code from games left join players on (games.game_id = players.game_id) where (select count(*) from players where players.game_id = games.game_id) = 1 and user_id = v_user_id and has_started = false;

    if found then
        return code;
    end if;

    -- CREATES NEW PLAYER AND GAME
    INSERT INTO games DEFAULT VALUES;
    SELECT currval(pg_get_serial_sequence('games','game_id')) into v_game_id;
    INSERT INTO players(user_id, game_id) values (v_user_id, v_game_id);
    SELECT currval(pg_get_serial_sequence('players','player_id')) into v_player_id;

    LOOP
        code := generate_uid(6);
        select count(*) from games where join_code = code into conflicts;
        IF conflicts = 0 THEN
            UPDATE games set join_code = code where game_id = v_game_id;
            EXIT;
        END IF;
    END LOOP;


    return code;
END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."create_game";