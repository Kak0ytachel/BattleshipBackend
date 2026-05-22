-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."get_questions"("v_user_id" int4, "num" int4=4)
    RETURNS int[] AS $BODY$
DECLARE
    max_number int4 := 99; -- zero-based
    v_player_id int4;
    num_left int4;
    is_empty bool;
    item record;
    ans int[];
BEGIN

    -- 0 - DEFAULT, NOT USED
    -- 1 - ALREADY REQUESTED

    -- FIND PLAYER_ID
    SELECT player_id into v_player_id FROM players where is_current = true and is_active = true and user_id = v_user_id;

    -- CHECK IF IS EMPTY
    SELECT (questions is null) into is_empty from players where player_id = v_player_id;

    -- CREATE 00000 IF EMPTY
    IF is_empty THEN
        UPDATE players SET questions = REPEAT('0', max_number + 1)::varbit where player_id = v_player_id;
    END IF;

    -- COUNT HOW MANY LEFT
    SELECT count(idx) into num_left
    FROM players, generate_series(0, max_number) as idx
    WHERE player_id = v_player_id and get_bit(questions, idx) = 0;

    -- RESET TO 00000 IF LESS THEN REQUESTED
    IF num_left < num THEN
        UPDATE players SET questions = REPEAT('0', max_number + 1)::varbit where player_id = v_player_id;
    END IF;

    -- GET SOME RANDOM 0 BITS
    FOR item IN
        SELECT idx
        FROM players, generate_series(0, max_number) as idx
        WHERE player_id = v_player_id and get_bit(questions, idx) = 0
        ORDER BY random()
        LIMIT num
        LOOP
            -- FLIP CHOSEN TO 1
            UPDATE players SET questions = set_bit(questions, item.idx, 1) WHERE player_id = v_player_id;
            -- ADD TO ANS
            ans := array_append(ans, item.idx);
        END LOOP;

    RETURN ans;

END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship".get_questions(v_user_id int4, num int4);