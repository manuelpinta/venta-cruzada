-- Login simple por employee_number + password hash (sin Supabase Auth).

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists password_salt text,
  add column if not exists password_hash text;

comment on column public.profiles.password_salt is
  'Salt aleatoria por usuario para hash SHA-256 del password.';

comment on column public.profiles.password_hash is
  'Hash SHA-256 en hex de (password_salt || password_plano).';

create or replace function public.set_profile_password(p_employee_number text, p_password text)
returns void
language plpgsql
security definer
as $$
declare
  v_salt text;
begin
  if p_employee_number is null or trim(p_employee_number) = '' then
    raise exception 'employee_number requerido';
  end if;
  if p_password is null or length(trim(p_password)) < 4 then
    raise exception 'password demasiado corto';
  end if;

  v_salt := encode(gen_random_bytes(16), 'hex');

  update public.profiles
  set
    password_salt = v_salt,
    password_hash = encode(digest(v_salt || p_password, 'sha256'), 'hex')
  where employee_number = trim(p_employee_number);

  if not found then
    raise exception 'No existe profile para employee_number=%', p_employee_number;
  end if;
end;
$$;

create or replace function public.app_login_simple(p_employee_number text, p_password text)
returns table (
  id uuid,
  employee_number text,
  country_code text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee text;
  v_hash text;
  v_salt text;
begin
  v_employee := trim(coalesce(p_employee_number, ''));
  if v_employee = '' or coalesce(p_password, '') = '' then
    return;
  end if;

  select p.password_hash, p.password_salt
    into v_hash, v_salt
  from public.profiles p
  where p.employee_number = v_employee
  limit 1;

  if v_hash is null then
    return;
  end if;

  if encode(extensions.digest(coalesce(v_salt, '') || p_password, 'sha256'), 'hex') <> lower(v_hash) then
    return;
  end if;

  return query
  select p.id, p.employee_number, p.country_code, p.role
  from public.profiles p
  where p.employee_number = v_employee
  limit 1;
end;
$$;

grant execute on function public.app_login_simple(text, text) to anon, authenticated;
