-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."end_game"("v_user_id" int4)
    RETURNS jsonb AS $BODY$
DECLARE
    v_player_id int4; -- winner
    v_game_id int4;
    v_opponent_id int4;
    v_opponent_player_id int4;
    correct_player int4;
    wrong_player int4;
    bombs_player int4;
    correct_opponent int4;
    wrong_opponent int4;
    bombs_opponent int4;
    results jsonb;
BEGIN
    -- find game_id and player_id
    SELECT player_id, game_id into v_player_id, v_game_id FROM players where user_id = v_user_id and is_current = true;

    -- find opponent info
    SELECT user_id into v_opponent_id FROM players where game_id = v_game_id and user_id != v_user_id;

    select player_id into v_opponent_player_id from players where user_id = v_opponent_id and is_current = true;

    RAISE NOTICE 'items: % % % % %', v_user_id, v_player_id, v_game_id, v_opponent_id, v_opponent_player_id;

    -- get stats
    select correct_answers, wrong_answers, bombs_placed into correct_player, wrong_player, bombs_player from players where player_id = v_player_id;
    select correct_answers, wrong_answers, bombs_placed into correct_opponent, wrong_opponent, bombs_opponent from players where player_id = v_opponent_player_id;

    -- end game
    UPDATE games set has_ended = true where game_id = v_game_id;

    -- set players as not current
    UPDATE players set is_current = false where player_id = v_player_id;

    UPDATE players set is_current = false where player_id = v_opponent_player_id;

    -- add won / lost to stats
    UPDATE users set games_won = games_won + 1 where user_id = v_user_id;

    UPDATE users set games_lost = games_lost + 1 where user_id = v_opponent_id;

    -- put stats in a jsonb
    results := jsonb_build_object(v_user_id, jsonb_build_object('correct_answers', correct_player, 'wrong_answers', wrong_player, 'bombs_placed', bombs_player),
                                  v_opponent_id, jsonb_build_object('correct_answers', correct_opponent, 'wrong_answers', wrong_opponent, 'bombs_placed', bombs_opponent));

    return results;
END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."end_game";