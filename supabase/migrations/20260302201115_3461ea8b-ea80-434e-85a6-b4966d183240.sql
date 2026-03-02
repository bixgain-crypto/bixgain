-- Restrict stakes UPDATE policy to admin-only (stake modifications go through edge functions with service_role)
DROP POLICY IF EXISTS "System update stakes" ON public.stakes;
CREATE POLICY "System update stakes"
ON public.stakes FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));