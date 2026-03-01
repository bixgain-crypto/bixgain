
DROP TRIGGER IF EXISTS admin_edit_block ON public.users;
DROP TRIGGER IF EXISTS balance_block ON public.users;
DROP FUNCTION IF EXISTS public.prevent_admin_edit();
DROP FUNCTION IF EXISTS public.prevent_balance_edit();

CREATE POLICY "Users can view own row"
  ON public.users FOR SELECT
  USING (id = auth.uid());
