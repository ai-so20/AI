-- 새 프로젝트에 복원 후 구조 확인용
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public'
order by table_name, ordinal_position;

select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
order by p.proname;

select * from cron.job order by jobid;
