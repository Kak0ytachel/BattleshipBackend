-- Up Migration

CREATE OR REPLACE FUNCTION "battleship"."create_user"("vname" varchar=NULL::character varying)
    RETURNS "pg_catalog"."int4" AS $BODY$
declare
    uid int;
BEGIN
    -- Routine body goes here...
    if vname is null or length(vname) = 0 then
        insert into users default values;
    else
        insert into users(name) values (vname);
    end if;
    SELECT currval(pg_get_serial_sequence('users','user_id')) into uid;
    return uid;
END
$BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;

-- Down Migration

DROP FUNCTION "battleship"."create_user";
