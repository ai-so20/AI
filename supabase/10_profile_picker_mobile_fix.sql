-- AI PROCESS VIP V13
-- 프로필 40종 선택 저장 보정
-- 모바일 UI 자체는 GitHub 파일에서 수정되며,
-- 이 SQL은 기존 ALL-IN-ONE/구버전 함수가 profile-01~40을 거부하는 문제를 보정합니다.

create or replace function public.set_my_avatar(new_avatar text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new_avatar !~ '^profile-(0[1-9]|[12][0-9]|3[0-9]|40)$' then
    raise exception 'Invalid avatar';
  end if;

  update public.profiles
  set avatar = new_avatar
  where id = auth.uid()
    and approval_status = 'approved';

  if not found then
    raise exception 'Approved profile not found';
  end if;
end;
$$;

grant execute on function public.set_my_avatar(text) to authenticated;
