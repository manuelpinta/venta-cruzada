-- RPC para recomendaciones con auth propio (sin supabase.auth), evitando bloqueo por RLS.

create or replace function public.app_list_recommendations(
  p_user_id uuid,
  p_country_code text
)
returns table (
  base_sku text,
  recommended_sku text
)
language sql
security definer
set search_path = public
as $$
  select r.base_sku, r.recommended_sku
  from public.cross_sell_recommendations r
  where r.user_id = p_user_id
    and r.country_code = p_country_code
  order by r.base_sku, r.recommended_sku;
$$;

create or replace function public.app_add_recommendation(
  p_user_id uuid,
  p_country_code text,
  p_base_sku text,
  p_recommended_sku text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'user_id requerido';
  end if;
  if coalesce(trim(p_country_code), '') = '' then
    raise exception 'country_code requerido';
  end if;
  if coalesce(trim(p_base_sku), '') = '' or coalesce(trim(p_recommended_sku), '') = '' then
    raise exception 'sku requerido';
  end if;

  if trim(p_base_sku) = trim(p_recommended_sku) then
    raise exception 'No puedes recomendarte a ti mismo';
  end if;

  insert into public.cross_sell_recommendations (user_id, country_code, base_sku, recommended_sku)
  values (p_user_id, trim(p_country_code), trim(p_base_sku), trim(p_recommended_sku));
end;
$$;

create or replace function public.app_remove_recommendation(
  p_user_id uuid,
  p_country_code text,
  p_base_sku text,
  p_recommended_sku text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.cross_sell_recommendations
  where user_id = p_user_id
    and country_code = trim(p_country_code)
    and base_sku = trim(p_base_sku)
    and recommended_sku = trim(p_recommended_sku);
$$;

grant execute on function public.app_list_recommendations(uuid, text) to anon, authenticated;
grant execute on function public.app_add_recommendation(uuid, text, text, text) to anon, authenticated;
grant execute on function public.app_remove_recommendation(uuid, text, text, text) to anon, authenticated;
