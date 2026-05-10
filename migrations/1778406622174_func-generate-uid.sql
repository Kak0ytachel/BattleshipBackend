-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."generate_uid"("len" int4=5)
    RETURNS "pg_catalog"."varchar" AS $BODY$
DECLARE
    chars TEXT := 'QWERTYUIOPASDFGHJKLZXCVBNM1234567890';
    l INT := length(chars);
    i INT := 0;
    x INT := 0;
    output VARCHAR := '';
BEGIN
    -- Routine body goes here...
    WHILE i < len LOOP
            x := random() * l;
            output := output || substr(chars, x, 1);
            i := i + 1;
        END LOOP;
    RETURN output;
END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."generate_uid";