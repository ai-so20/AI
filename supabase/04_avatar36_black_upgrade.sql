-- AI PROCESS VIP V5 avatar expansion: Gold / Blue / Black, 12 animals = 36 profiles
create or replace function public.set_my_avatar(new_avatar text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new_avatar !~ '^(vip_0[1-6]|(dog|cat|redpanda|quokka|penguin|panda|hedgehog|squirrel|meerkat|beaver|rabbit|otter)-(gold|blue|black))$' then
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

-- Admin member approval / member list helpers
create or replace function public.get_admin_all_profiles()
returns table(
  member_id uuid,
  nickname text,
  real_name text,
  avatar text,
  role text,
  approval_status text,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  select p.id, p.nickname, p.real_name, p.avatar, p.role, p.approval_status, p.created_at
  from public.profiles p
  where exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.approval_status = 'approved'
  )
  order by
    case when p.approval_status = 'pending' then 0 when p.approval_status = 'approved' then 1 else 2 end,
    p.created_at desc;
$$;

grant execute on function public.get_admin_all_profiles() to authenticated;

create or replace function public.admin_set_profile_approval(target_member_id uuid, target_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_current_user_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;

  if target_status not in ('approved','rejected') then
    raise exception '지원하지 않는 승인 상태입니다.';
  end if;

  if target_member_id = auth.uid() then
    raise exception '관리자 본인의 상태는 변경할 수 없습니다.';
  end if;

  if exists (
    select 1 from public.profiles
    where id = target_member_id and role = 'admin'
  ) then
    raise exception '다른 관리자 계정은 변경할 수 없습니다.';
  end if;

  update public.profiles
  set approval_status = target_status
  where id = target_member_id;

  if not found then
    raise exception '회원을 찾을 수 없습니다.';
  end if;

  if target_status = 'rejected' then
    update public.members
    set status = 'left', left_at = now()
    where id = target_member_id;
  end if;

  insert into public.moderation_logs(target_member_id, operator_id, action, reason)
  values (
    target_member_id,
    auth.uid(),
    case when target_status = 'approved' then 'approve' else 'reject' end,
    '관리자 화면에서 처리'
  );
end;
$$;

grant execute on function public.admin_set_profile_approval(uuid,text) to authenticated;
