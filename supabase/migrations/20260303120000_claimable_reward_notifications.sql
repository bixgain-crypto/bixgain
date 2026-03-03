-- Claimable reward notifications for admin-triggered, user-claimed rewards.

CREATE TABLE IF NOT EXISTS public.user_reward_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  xp_amount INTEGER NOT NULL DEFAULT 0,
  bix_amount NUMERIC(18,8) NOT NULL DEFAULT 0,
  reason TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_reward_notifications_status_valid
    CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
  CONSTRAINT user_reward_notifications_non_negative_values
    CHECK (xp_amount >= 0 AND bix_amount >= 0),
  CONSTRAINT user_reward_notifications_non_zero_reward
    CHECK (xp_amount > 0 OR bix_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_reward_notifications_user_status
  ON public.user_reward_notifications(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_reward_notifications_expires_at
  ON public.user_reward_notifications(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_reward_notifications_created_at
  ON public.user_reward_notifications(created_at DESC);

DROP TRIGGER IF EXISTS update_user_reward_notifications_updated_at ON public.user_reward_notifications;
CREATE TRIGGER update_user_reward_notifications_updated_at
  BEFORE UPDATE ON public.user_reward_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_reward_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own reward notifications" ON public.user_reward_notifications;
CREATE POLICY "Users view own reward notifications"
  ON public.user_reward_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins create reward notifications" ON public.user_reward_notifications;
CREATE POLICY "Admins create reward notifications"
  ON public.user_reward_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE ALL ON TABLE public.user_reward_notifications FROM anon;
GRANT SELECT ON TABLE public.user_reward_notifications TO authenticated;
GRANT ALL ON TABLE public.user_reward_notifications TO service_role;

-- Atomic claim path for authenticated users.
CREATE OR REPLACE FUNCTION public.claim_reward_notification(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _notification public.user_reward_notifications%ROWTYPE;
  _user_row public.users%ROWTYPE;
  _xp INTEGER;
  _bix NUMERIC(18,8);
  _activity_points NUMERIC(18,8);
  _unit TEXT;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.user_reward_notifications
  SET
    status = 'claimed',
    claimed_at = now(),
    updated_at = now()
  WHERE id = p_notification_id
    AND user_id = _uid
    AND status = 'pending'
    AND expires_at > now()
  RETURNING *
  INTO _notification;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_reward_notifications
      WHERE id = p_notification_id
        AND user_id = _uid
        AND status = 'claimed'
    ) THEN
      RAISE EXCEPTION 'Reward already claimed';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.user_reward_notifications
      WHERE id = p_notification_id
        AND user_id = _uid
        AND expires_at <= now()
    ) THEN
      UPDATE public.user_reward_notifications
      SET
        status = CASE WHEN status = 'pending' THEN 'expired' ELSE status END,
        updated_at = now()
      WHERE id = p_notification_id
        AND user_id = _uid;

      RAISE EXCEPTION 'Reward claim expired';
    END IF;

    RAISE EXCEPTION 'Reward notification not found';
  END IF;

  _xp := COALESCE(_notification.xp_amount, 0);
  _bix := COALESCE(_notification.bix_amount, 0);

  IF _xp > 0 THEN
    BEGIN
      PERFORM public.progression_award_xp(_uid, _xp);
    EXCEPTION
      WHEN undefined_function THEN
        PERFORM public.award_xp(_uid, _xp);
    END;
  END IF;

  IF _bix > 0 THEN
    SELECT *
    INTO _user_row
    FROM public.users
    WHERE id = _uid
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.users (id)
      VALUES (_uid)
      ON CONFLICT (id) DO NOTHING;

      SELECT *
      INTO _user_row
      FROM public.users
      WHERE id = _uid
      FOR UPDATE;
    END IF;

    UPDATE public.users
    SET
      bix_balance = COALESCE(bix_balance, 0) + _bix,
      total_bix = COALESCE(total_bix, 0) + _bix
    WHERE id = _uid
    RETURNING *
    INTO _user_row;

    INSERT INTO public.reward_transactions (
      user_id,
      transaction_type,
      gross_amount,
      tax_amount,
      net_amount,
      running_balance,
      description,
      metadata
    )
    VALUES (
      _uid,
      'bonus',
      _bix,
      0,
      _bix,
      COALESCE(_user_row.bix_balance, 0),
      COALESCE(_notification.description, _notification.reason, 'Claimed admin reward notification'),
      jsonb_build_object(
        'source', 'reward_notification',
        'notification_id', _notification.id,
        'created_by', _notification.created_by,
        'xp_amount', _xp,
        'bix_amount', _bix
      )
    );
  END IF;

  _activity_points := CASE WHEN _xp > 0 THEN _xp ELSE _bix END;
  _unit := CASE WHEN _xp > 0 THEN 'xp' ELSE 'bix' END;

  INSERT INTO public.activities (
    user_id,
    activity_type,
    points_earned,
    description,
    metadata
  )
  VALUES (
    _uid,
    'custom',
    _activity_points,
    COALESCE(_notification.description, _notification.reason, 'Claimed reward'),
    jsonb_build_object(
      'unit', _unit,
      'source', 'reward_notification',
      'notification_id', _notification.id,
      'xp_amount', _xp,
      'bix_amount', _bix
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'notification_id', _notification.id,
    'xp_amount', _xp,
    'bix_amount', _bix,
    'claimed_at', _notification.claimed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_reward_notification(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_reward_notification(UUID) TO authenticated, service_role;

-- Ensure realtime publication includes this table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_reward_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_reward_notifications;
  END IF;
END;
$$;
