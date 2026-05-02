revoke all on function public.create_restaurant_with_owner(text) from public, anon, authenticated;
grant execute on function public.create_restaurant_with_owner(text) to authenticated;

revoke all on function public.is_restaurant_member(uuid) from public, anon, authenticated;
grant execute on function public.is_restaurant_member(uuid) to authenticated;

revoke all on function public.has_restaurant_role(uuid, text[]) from public, anon, authenticated;
grant execute on function public.has_restaurant_role(uuid, text[]) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_sole_owner() from public, anon, authenticated;
revoke all on function public.tg_set_updated_at() from public, anon, authenticated;