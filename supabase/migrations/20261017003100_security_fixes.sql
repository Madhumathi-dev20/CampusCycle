-- 20261017003100_security_fixes.sql
-- Corrects 10 security and logic bugs identified in migration 030.

-- 1. Fix is_admin() to handle orphaned roles by joining with auth.users (Bug 9)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.user_roles r
    JOIN auth.users u ON r.user_id = u.id
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND r.role = 'admin'
      AND p.account_status = 'active'
  );
$$;

-- 2. Fix assert_workflow_account to ensure exceptions are reliably raised (Bug 1 & 2)
CREATE OR REPLACE FUNCTION public.assert_workflow_account(p_allow_suspended boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE current_status public.account_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT p.account_status INTO current_status FROM public.profiles p WHERE p.id = auth.uid();

  IF current_status IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF current_status = 'active' OR (p_allow_suspended AND current_status = 'suspended') THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Active account required';
END;
$$;

-- 3. Fix Report FKs to use profiles instead of public_profiles and use RESTRICT (Bug 3)
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reporter_public_profile_fk;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_user_public_profile_fk;

ALTER TABLE public.reports ADD CONSTRAINT reports_reporter_profile_fk
  FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.reports ADD CONSTRAINT reports_reported_user_profile_fk
  FOREIGN KEY (reported_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Fix storage policies to avoid TOCTOU gap by inlining status check (Bug 7)
DROP POLICY IF EXISTS "Active students upload into own folder" ON storage.objects;
CREATE POLICY "Active students upload into own folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active')
);

DROP POLICY IF EXISTS "Active students update own images" ON storage.objects;
CREATE POLICY "Active students update own images" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'listing-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active')
)
WITH CHECK (
  bucket_id = 'listing-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active')
);

DROP POLICY IF EXISTS "Active students delete own images" ON storage.objects;
CREATE POLICY "Active students delete own images" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'listing-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_status = 'active')
);

-- 5. Fix submit_request to lock owner profile and ensure requester is active (Bug 2 & 4)
CREATE OR REPLACE FUNCTION public.submit_request(p_listing_id uuid, p_request_type public.request_type, p_start date DEFAULT NULL, p_return date DEFAULT NULL, p_message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE l public.listings%rowtype; new_id uuid; required_type public.request_type;
BEGIN
  PERFORM public.assert_workflow_account(false);

  -- Lock listing and owner profile for verification
  SELECT * INTO l FROM public.listings WHERE id = p_listing_id FOR UPDATE;

  IF NOT FOUND OR l.moderation_status <> 'active' OR l.availability_status <> 'available' THEN RAISE EXCEPTION 'Listing is not available'; END IF;
  IF l.owner_id = auth.uid() THEN RAISE EXCEPTION 'You cannot request your own listing'; END IF;

  -- Lock owner profile to verify status
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = l.owner_id AND p.account_status = 'active' FOR UPDATE) THEN
    RAISE EXCEPTION 'Listing owner account is not active';
  END IF;

  required_type := CASE l.listing_type WHEN 'sell' THEN 'purchase'::public.request_type WHEN 'donate' THEN 'donation'::public.request_type ELSE 'borrowing'::public.request_type END;
  IF p_request_type <> required_type THEN RAISE EXCEPTION 'Request type does not match listing'; END IF;

  IF p_request_type = 'borrowing' THEN
    IF p_start IS NULL OR p_return IS NULL OR p_start < CURRENT_DATE OR p_return <= p_start THEN RAISE EXCEPTION 'Choose a valid future borrowing period'; END IF;
    IF (p_return - p_start) < l.min_borrow_days OR (p_return - p_start) > l.max_borrow_days THEN RAISE EXCEPTION 'Requested duration is outside the owner’s allowed range'; END IF;
    IF EXISTS (SELECT 1 FROM public.requests r WHERE r.listing_id = l.id AND r.request_type = 'borrowing' AND r.status IN ('accepted','handed_over','return_initiated','overdue') AND daterange(r.requested_start_date, r.requested_return_date + 1, '[)') && daterange(p_start, p_return + 1, '[)')) THEN RAISE EXCEPTION 'Those dates overlap an approved borrowing period'; END IF;
  ELSIF p_start IS NOT NULL OR p_return IS NOT NULL THEN RAISE EXCEPTION 'Dates are only accepted for borrowing';
  END IF;

  INSERT INTO public.requests(listing_id, requester_id, owner_id, request_type, requested_start_date, requested_return_date, message)
  VALUES (l.id, auth.uid(), l.owner_id, p_request_type, p_start, p_return, NULLIF(TRIM(p_message), '')) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- 6. Fix notify_request_change to validate actor_id (Bug 5)
CREATE OR REPLACE FUNCTION public.notify_request_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE target uuid; actor_text text; actor_id uuid; title_text text; body_text text; kind public.notification_type;
BEGIN
  IF tg_op = 'INSERT' THEN
    target := new.owner_id;
    kind := 'new_request';
    title_text := 'New ' || replace(new.request_type::text, '_', ' ') || ' request';
    body_text := 'A student sent a request for one of your listings.';
  ELSIF new.status IS DISTINCT FROM old.status THEN
    actor_text := nullif(current_setting('campuscycle.actor_id', true), '');
    IF actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      actor_id := actor_text::uuid;
    END IF;

    -- VALIDATION: Ensure actor_id is actually a participant in this request
    IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.requests WHERE id = new.id AND (requester_id = actor_id OR owner_id = actor_id)) THEN
      RAISE EXCEPTION 'Unauthorized actor_id in notification configuration';
    END IF;

    IF actor_id = new.requester_id THEN
      target := new.owner_id;
    ELSIF actor_id = new.owner_id THEN
      target := new.requester_id;
    ELSE
      target := CASE WHEN new.status IN ('accepted', 'rejected', 'handed_over', 'overdue') THEN new.requester_id ELSE new.owner_id END;
    END IF;

    kind := CASE new.status
      WHEN 'accepted' THEN 'request_accepted'
      WHEN 'rejected' THEN 'request_rejected'
      WHEN 'cancelled' THEN 'request_cancelled'
      WHEN 'handed_over' THEN 'handover_confirmed'
      WHEN 'return_initiated' THEN 'return_initiated'
      WHEN 'overdue' THEN 'item_overdue'
      WHEN 'completed' THEN CASE WHEN new.request_type = 'borrowing' THEN 'return_confirmed'::public.notification_type ELSE 'completion_update'::public.notification_type END
      ELSE 'completion_update'
    END;
    title_text := CASE kind
      WHEN 'request_accepted' THEN 'Request accepted'
      WHEN 'request_rejected' THEN 'Request declined'
      WHEN 'request_cancelled' THEN 'Request cancelled'
      WHEN 'handover_confirmed' THEN 'Handover recorded'
      WHEN 'return_initiated' THEN 'Return initiated'
      WHEN 'return_confirmed' THEN 'Return confirmed'
      WHEN 'item_overdue' THEN 'Borrowed item overdue'
      ELSE 'Request completed'
    END;
    body_text := CASE kind
      WHEN 'item_overdue' THEN 'The owner reported that the borrowed item is overdue.'
      ELSE 'The status of your request has changed to ' || replace(new.status::text, '_', ' ') || '.'
    END;
  ELSE
    RETURN new;
  END IF;

  INSERT INTO public.notifications(recipient_id, type, title, message, related_listing_id, related_request_id)
  VALUES (target, kind, title_text, body_text, new.listing_id, new.id);
  RETURN new;
END;
$$;

-- 7. Fix guard_listing_update to lock requests (Bug 6)
CREATE OR REPLACE FUNCTION public.guard_listing_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  workflow boolean := coalesce(current_setting('campuscycle.workflow', true), '') = 'on';
  terms_changed boolean;
BEGIN
  IF new.owner_id IS DISTINCT FROM old.owner_id OR new.moderation_status IS DISTINCT FROM old.moderation_status THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Protected listing fields cannot be changed'; END IF;
  END IF;

  terms_changed := new.listing_type IS DISTINCT FROM old.listing_type
    OR new.sale_price IS DISTINCT FROM old.sale_price
    OR new.borrowing_fee IS DISTINCT FROM old.borrowing_fee
    OR new.refundable_deposit IS DISTINCT FROM old.refundable_deposit
    OR new.min_borrow_days IS DISTINCT FROM old.min_borrow_days
    OR new.max_borrow_days IS DISTINCT FROM old.max_borrow_days;

  IF terms_changed AND NOT public.is_admin() THEN
    -- Lock requests for the listing to prevent race conditions during term validation
    IF EXISTS (SELECT 1 FROM public.requests r WHERE r.listing_id = old.id FOR UPDATE) THEN
      RAISE EXCEPTION 'Listing terms cannot change after a request has been submitted';
    END IF;
  END IF;

  IF new.availability_status IS DISTINCT FROM old.availability_status
     AND new.availability_status IN ('available', 'reserved', 'sold', 'donated')
     AND NOT workflow AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Use the approved request workflow to change listing availability';
  END IF;
  RETURN new;
END;
$$;

-- 8. Fix respond_to_request to validate requester on reject (Bug 10)
CREATE OR REPLACE FUNCTION public.respond_to_request(p_request_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  r public.requests%rowtype;
  l public.listings%rowtype;
  kind public.transaction_type;
  price numeric;
  required_type public.request_type;
BEGIN
  PERFORM public.assert_workflow_account(false);
  SELECT * INTO r FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR r.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Request not found or access denied'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be answered'; END IF;
  SELECT * INTO l FROM public.listings WHERE id = r.listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;

  IF p_accept THEN
    -- Check requester status
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.requester_id AND p.account_status = 'active') THEN
      RAISE EXCEPTION 'Requester account is not active';
    END IF;

    IF l.moderation_status <> 'active' OR l.availability_status <> 'available' THEN RAISE EXCEPTION 'Listing is no longer available'; END IF;
    required_type := CASE l.listing_type WHEN 'sell' THEN 'purchase'::public.request_type WHEN 'donate' THEN 'donation'::public.request_type ELSE 'borrowing'::public.request_type END;
    IF r.request_type <> required_type THEN RAISE EXCEPTION 'Request no longer matches the listing type'; END IF;

    IF r.request_type = 'borrowing' THEN
      IF r.requested_start_date < CURRENT_DATE OR r.requested_return_date <= r.requested_start_date
         OR (r.requested_return_date - r.requested_start_date) < l.min_borrow_days
         OR (r.requested_return_date - r.requested_start_date) > l.max_borrow_days THEN
        RAISE EXCEPTION 'Borrowing dates are no longer valid';
      END IF;
      IF EXISTS (SELECT 1 FROM public.requests x WHERE x.listing_id = r.listing_id AND x.id <> r.id AND x.request_type = 'borrowing' AND x.status IN ('accepted','handed_over','return_initiated','overdue') AND daterange(x.requested_start_date, x.requested_return_date + 1, '[)') && daterange(r.requested_start_date, r.requested_return_date + 1, '[)')) THEN RAISE EXCEPTION 'Those dates were just reserved by another request'; END IF;
    END IF;

    PERFORM set_config('campuscycle.workflow', 'on', true);
    UPDATE public.listings SET availability_status = 'reserved' WHERE id = l.id AND r.request_type <> 'borrowing';
    kind := CASE r.request_type WHEN 'purchase' THEN 'sale'::public.transaction_type WHEN 'donation' THEN 'donation'::public.transaction_type ELSE 'borrowing'::public.transaction_type END;
    price := CASE WHEN r.request_type = 'purchase' THEN l.sale_price WHEN r.request_type = 'borrowing' THEN coalesce(l.borrowing_fee, 0) ELSE 0 END;
    PERFORM set_config('campuscycle.actor_id', auth.uid()::text, true);
    UPDATE public.requests SET status = 'accepted' WHERE id = r.id;
    INSERT INTO public.transactions(listing_id, request_id, buyer_or_borrower_id, owner_id, transaction_type, agreed_price)
    VALUES (l.id, r.id, r.requester_id, r.owner_id, kind, price);
    IF r.request_type <> 'borrowing' THEN
      UPDATE public.requests SET status = 'rejected' WHERE listing_id = l.id AND id <> r.id AND status = 'pending';
    END IF;
  ELSE
    -- Rejection logic
    PERFORM set_config('campuscycle.actor_id', auth.uid()::text, true);

    -- Check requester status before rejection (for consistency)
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.requester_id AND p.account_status = 'active') THEN
      RAISE EXCEPTION 'Requester account is no longer active';
    END IF;

    UPDATE public.requests SET status = 'rejected' WHERE id = r.id;
  END IF;
END;
$$;

-- Add comments to mark this as a fix migration
COMMENT ON FUNCTION public.is_admin() IS 'Fixed to handle orphaned roles via auth.users join.';
COMMENT ON FUNCTION public.assert_workflow_account(boolean) IS 'Fixed to ensure exceptions are reliably raised.';
COMMENT ON FUNCTION public.submit_request(uuid, public.request_type, date, date, text) IS 'Added owner profile lock and verified requester status.';
COMMENT ON FUNCTION public.notify_request_change() IS 'Added actor_id participant validation.';
COMMENT ON FUNCTION public.guard_listing_update() IS 'Added request locking during term changes.';
COMMENT ON FUNCTION public.respond_to_request(uuid, boolean) IS 'Added requester status check on rejection.';
