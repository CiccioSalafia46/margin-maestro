revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from authenticated;

revoke all on function public.protect_sole_owner() from public;
revoke all on function public.protect_sole_owner() from authenticated;

revoke all on function public.tg_set_updated_at() from public;
revoke all on function public.tg_set_updated_at() from authenticated;