-- Run in the SQL editor of the owner's Supabase project. No secret keys belong here.
-- All counters and mutations for one account serialize on wish_sync_accounts FOR UPDATE.
BEGIN;
CREATE TABLE public.wish_sync_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  head bigint NOT NULL DEFAULT 0 CHECK(head BETWEEN 0 AND 9007199254740991)
);
CREATE TABLE public.wish_categories (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id uuid NOT NULL, name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, deleted_at timestamptz,
  version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
  seq bigint NOT NULL, server_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,id)
);
CREATE UNIQUE INDEX wish_category_name_active ON public.wish_categories(user_id,lower(btrim(name))) WHERE deleted_at IS NULL;
CREATE TABLE public.wish_products (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id uuid NOT NULL, name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160),
  description text NOT NULL CHECK(length(description)<=10000), category_id uuid NOT NULL,
  priority text NOT NULL CHECK(priority IN ('low','medium','high')),
  image_url text NOT NULL CHECK(length(image_url)<=2048 AND (image_url='' OR image_url ~ '^https?://[^[:space:]]+')),
  price_cents bigint CHECK(price_cents BETWEEN 0 AND 99999999999),
  desired_price_cents bigint CHECK(desired_price_cents BETWEEN 0 AND 99999999999),
  store text NOT NULL CHECK(length(store)<=160),
  original_url text NOT NULL CHECK(length(original_url)<=2048 AND (original_url='' OR original_url ~ '^https?://[^[:space:]]+')),
  notes text NOT NULL CHECK(length(notes)<=10000), status text NOT NULL CHECK(status IN ('pending','purchased')),
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, deleted_at timestamptz,
  version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991), seq bigint NOT NULL,
  server_updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,id),
  FOREIGN KEY(user_id,category_id) REFERENCES public.wish_categories(user_id,id)
);
CREATE TABLE public.wish_sync_changes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seq bigint NOT NULL, kind text NOT NULL CHECK(kind IN ('category','product')),
  entity_id uuid NOT NULL, version bigint NOT NULL, payload jsonb NOT NULL, op_id uuid NOT NULL,
  PRIMARY KEY(user_id,seq)
);
CREATE TABLE public.wish_sync_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  op_id uuid NOT NULL, request_hash text NOT NULL, response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,op_id)
);
CREATE INDEX wish_products_category_live ON public.wish_products(user_id,category_id) WHERE deleted_at IS NULL;

ALTER TABLE public.wish_sync_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wish_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wish_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wish_sync_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wish_sync_receipts ENABLE ROW LEVEL SECURITY;
DO $policies$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wish_sync_accounts','wish_categories','wish_products','wish_sync_changes','wish_sync_receipts'] LOOP
    EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id)',t);
    EXECUTE format('CREATE POLICY owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id)',t);
    EXECUTE format('CREATE POLICY owner_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid())=user_id) WITH CHECK ((SELECT auth.uid())=user_id)',t);
    EXECUTE format('CREATE POLICY owner_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id)',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    -- Direct writes cannot bypass the version/cursor/idempotency protocol, even with a valid JWT.
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  END LOOP;
END $policies$;

CREATE FUNCTION public.wish_sync_record(p_user uuid,p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $fn$
  SELECT CASE WHEN p_kind='category' THEN
    (SELECT jsonb_build_object('kind','category','id',c.id,'version',c.version,'seq',c.seq,'data',to_jsonb(c)-ARRAY['user_id','version','seq','server_updated_at']) FROM public.wish_categories c WHERE c.user_id=p_user AND c.id=p_id)
  ELSE
    (SELECT jsonb_build_object('kind','product','id',p.id,'version',p.version,'seq',p.seq,'data',to_jsonb(p)-ARRAY['user_id','version','seq','server_updated_at']) FROM public.wish_products p WHERE p.user_id=p_user AND p.id=p_id)
  END;
$fn$;
REVOKE ALL ON FUNCTION public.wish_sync_record(uuid,text,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.wish_sync_push(p_op_id uuid,p_kind text,p_id uuid,p_base_version bigint,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_user uuid := auth.uid(); v_head bigint; v_version bigint; v_current jsonb; v_result jsonb;
  v_receipt public.wish_sync_receipts%ROWTYPE; v_hash text;
  v_existing uuid; v_category uuid; v_deleted timestamptz; v_created timestamptz; v_updated timestamptz;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_op_id IS NULL OR p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('category','product') OR p_base_version IS NULL OR p_base_version<0 OR p_base_version>9007199254740991 OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>64000 THEN
    RAISE EXCEPTION 'Invalid sync envelope' USING ERRCODE='22023';
  END IF;
  IF p_payload->>'id' IS DISTINCT FROM p_id::text THEN RAISE EXCEPTION 'Identity mismatch' USING ERRCODE='22023'; END IF;
  INSERT INTO public.wish_sync_accounts(user_id) VALUES(v_user) ON CONFLICT DO NOTHING;
  SELECT head INTO v_head FROM public.wish_sync_accounts WHERE user_id=v_user FOR UPDATE;
  v_hash := md5(jsonb_build_object('kind',p_kind,'id',p_id,'base',p_base_version,'payload',p_payload)::text);
  SELECT * INTO v_receipt FROM public.wish_sync_receipts WHERE user_id=v_user AND op_id=p_op_id;
  IF FOUND THEN
    IF v_receipt.request_hash<>v_hash THEN RAISE EXCEPTION 'Operation ID reused with different content' USING ERRCODE='22023'; END IF;
    RETURN v_receipt.response;
  END IF;
  v_current := public.wish_sync_record(v_user,p_kind,p_id);
  IF (v_current IS NULL AND p_base_version<>0) THEN RAISE EXCEPTION 'Unknown remote version' USING ERRCODE='22023'; END IF;
  IF v_current IS NOT NULL AND (v_current->>'version')::bigint<>p_base_version THEN
    v_result := jsonb_build_object('status','conflict','record',v_current);
  ELSE
    IF jsonb_typeof(p_payload->'name')<>'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND (CASE WHEN p_kind='category' THEN 60 ELSE 160 END) OR jsonb_typeof(p_payload->'created_at')<>'string' OR jsonb_typeof(p_payload->'updated_at')<>'string' OR NOT(p_payload ? 'deleted_at') THEN
      RAISE EXCEPTION 'Invalid record fields' USING ERRCODE='22023';
    END IF;
    v_created := (p_payload->>'created_at')::timestamptz; v_updated := (p_payload->>'updated_at')::timestamptz;
    v_deleted := (p_payload->>'deleted_at')::timestamptz;
    IF v_created IS NULL OR v_updated IS NULL OR NOT isfinite(v_created) OR NOT isfinite(v_updated) OR (v_deleted IS NOT NULL AND NOT isfinite(v_deleted)) THEN RAISE EXCEPTION 'Invalid record dates' USING ERRCODE='22023'; END IF;
    IF p_kind='category' THEN
      IF v_deleted IS NOT NULL AND EXISTS(SELECT 1 FROM public.wish_products WHERE user_id=v_user AND category_id=p_id AND deleted_at IS NULL) THEN
        v_result := jsonb_build_object('status','category_in_use','record',v_current);
      ELSIF v_deleted IS NULL THEN
        SELECT id INTO v_existing FROM public.wish_categories WHERE user_id=v_user AND id<>p_id AND deleted_at IS NULL AND lower(btrim(name))=lower(btrim(p_payload->>'name')) LIMIT 1;
        IF FOUND THEN v_result := jsonb_build_object('status','category_name','record',public.wish_sync_record(v_user,'category',v_existing)); END IF;
      END IF;
    ELSE
      v_category := (p_payload->>'category_id')::uuid;
      IF NOT EXISTS(SELECT 1 FROM public.wish_categories WHERE user_id=v_user AND id=v_category AND (deleted_at IS NULL OR v_deleted IS NOT NULL)) THEN RAISE EXCEPTION 'Category must exist in the same account' USING ERRCODE='23503'; END IF;
      IF jsonb_typeof(p_payload->'description')<>'string' OR jsonb_typeof(p_payload->'image_url')<>'string' OR jsonb_typeof(p_payload->'store')<>'string' OR jsonb_typeof(p_payload->'original_url')<>'string' OR jsonb_typeof(p_payload->'notes')<>'string' OR p_payload->>'priority' NOT IN ('low','medium','high') OR p_payload->>'status' NOT IN ('pending','purchased') THEN RAISE EXCEPTION 'Invalid product fields' USING ERRCODE='22023'; END IF;
      IF NOT(p_payload ? 'price_cents') OR NOT(p_payload ? 'desired_price_cents') OR (jsonb_typeof(p_payload->'price_cents')<>'null' AND (jsonb_typeof(p_payload->'price_cents')<>'number' OR (p_payload->>'price_cents')::numeric<>trunc((p_payload->>'price_cents')::numeric))) OR (jsonb_typeof(p_payload->'desired_price_cents')<>'null' AND (jsonb_typeof(p_payload->'desired_price_cents')<>'number' OR (p_payload->>'desired_price_cents')::numeric<>trunc((p_payload->>'desired_price_cents')::numeric))) THEN RAISE EXCEPTION 'Price must be integer cents or null' USING ERRCODE='22023'; END IF;
    END IF;
    IF v_result IS NULL THEN
      v_version := COALESCE((v_current->>'version')::bigint,0)+1;
      UPDATE public.wish_sync_accounts SET head=head+1 WHERE user_id=v_user RETURNING head INTO v_head;
      IF p_kind='category' THEN
        INSERT INTO public.wish_categories(user_id,id,name,created_at,updated_at,deleted_at,version,seq)
          VALUES(v_user,p_id,btrim(p_payload->>'name'),v_created,v_updated,v_deleted,v_version,v_head)
          ON CONFLICT(user_id,id) DO UPDATE SET name=excluded.name,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at,version=excluded.version,seq=excluded.seq,server_updated_at=now();
      ELSE
        INSERT INTO public.wish_products(user_id,id,name,description,category_id,priority,image_url,price_cents,desired_price_cents,store,original_url,notes,status,created_at,updated_at,deleted_at,version,seq)
          VALUES(v_user,p_id,btrim(p_payload->>'name'),p_payload->>'description',v_category,p_payload->>'priority',p_payload->>'image_url',(p_payload->>'price_cents')::bigint,(p_payload->>'desired_price_cents')::bigint,p_payload->>'store',p_payload->>'original_url',p_payload->>'notes',p_payload->>'status',v_created,v_updated,v_deleted,v_version,v_head)
          ON CONFLICT(user_id,id) DO UPDATE SET name=excluded.name,description=excluded.description,category_id=excluded.category_id,priority=excluded.priority,image_url=excluded.image_url,price_cents=excluded.price_cents,desired_price_cents=excluded.desired_price_cents,store=excluded.store,original_url=excluded.original_url,notes=excluded.notes,status=excluded.status,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at,version=excluded.version,seq=excluded.seq,server_updated_at=now();
      END IF;
      v_current := public.wish_sync_record(v_user,p_kind,p_id);
      INSERT INTO public.wish_sync_changes(user_id,seq,kind,entity_id,version,payload,op_id) VALUES(v_user,v_head,p_kind,p_id,v_version,v_current->'data',p_op_id);
      v_result := jsonb_build_object('status','ok','record',v_current||jsonb_build_object('op_id',p_op_id));
    END IF;
  END IF;
  INSERT INTO public.wish_sync_receipts(user_id,op_id,request_hash,response) VALUES(v_user,p_op_id,v_hash,v_result);
  RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.wish_sync_push(uuid,text,uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wish_sync_push(uuid,text,uuid,bigint,jsonb) TO authenticated;

CREATE FUNCTION public.wish_sync_pull(p_cursor bigint DEFAULT 0,p_upper bigint DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); v_head bigint; v_upper bigint; v_cursor bigint; v_items jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_cursor IS NULL OR p_cursor<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
  INSERT INTO public.wish_sync_accounts(user_id) VALUES(v_user) ON CONFLICT DO NOTHING;
  SELECT head INTO v_head FROM public.wish_sync_accounts WHERE user_id=v_user FOR UPDATE;
  v_upper := COALESCE(p_upper,v_head);
  IF v_upper>v_head OR v_upper<p_cursor OR p_cursor>v_head THEN RAISE EXCEPTION 'Cursor outside account history' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',c.kind,'id',c.entity_id,'version',c.version,'seq',c.seq,'data',c.payload,'op_id',c.op_id) ORDER BY c.seq),'[]'::jsonb),COALESCE(max(c.seq),p_cursor)
    INTO v_items,v_cursor FROM (SELECT * FROM public.wish_sync_changes WHERE user_id=v_user AND seq>p_cursor AND seq<=v_upper ORDER BY seq LIMIT p_limit)c;
  RETURN jsonb_build_object('items',v_items,'cursor',v_cursor,'upper',v_upper,'more',v_cursor<v_upper);
END;
$fn$;
REVOKE ALL ON FUNCTION public.wish_sync_pull(bigint,bigint,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wish_sync_pull(bigint,bigint,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
