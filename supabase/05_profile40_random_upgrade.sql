-- AI PROCESS VIP V6
-- 40종 동물 프로필 + 가입 시 랜덤 프로필 지정

-- 1) 회원이 직접 변경할 수 있는 프로필 키를 40종으로 교체
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

-- 2) Supabase Auth 사용자가 생성될 때 40종 중 하나를 자동 랜덤 지정
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  random_avatar text;
begin
  random_avatar := 'profile-' || lpad((floor(random() * 40) + 1)::int::text, 2, '0');

  insert into public.profiles (
    id,
    nickname,
    real_name,
    approval_status,
    avatar
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'nickname',
    new.raw_user_meta_data ->> 'real_name',
    'pending',
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar', ''), random_avatar)
  );

  return new;
end;
$$;

-- 3) 기존 회원도 예전 프로필이면 40종 중 하나로 랜덤 교체
update public.profiles
set avatar = 'profile-' || lpad((floor(random() * 40) + 1)::int::text, 2, '0')
where avatar is null
   or avatar !~ '^profile-(0[1-9]|[12][0-9]|3[0-9]|40)$';
