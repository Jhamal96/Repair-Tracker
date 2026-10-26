CREATE OR REPLACE FUNCTION public.ajd_submit_store_cart(p_items jsonb, p_customer_name text, p_customer_phone text, p_customer_email text, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_name text := btrim(coalesce(p_customer_name,''));
  v_phone text := btrim(coalesce(p_customer_phone,''));
  v_email text := lower(btrim(coalesce(p_customer_email,'')));
  v_notes text := btrim(coalesce(p_notes,''));
  v_line jsonb;
  v_id uuid;
  v_request uuid;
  v_existing uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_quantities integer[] := '{}'::integer[];
  v_price_total numeric(12,2) := 0;
  v_qty_total integer := 0;
  v_count integer := 0;
  v_recent_count integer;
  v_fingerprint text;
  v_product record;
begin
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Enter your full name (2–120 characters).';
  end if;
  if char_length(v_phone) not between 7 and 35
     or char_length(regexp_replace(v_phone,'[^0-9]','','g')) not between 7 and 15 then
    raise exception 'A valid phone number is required (7–15 digits).';
  end if;
  if v_email <> '' and (char_length(v_email) not between 6 and 200
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then
    raise exception 'Enter a valid email address or leave it blank.';
  end if;
  if char_length(v_notes)>1500 then
    raise exception 'Notes must be 1,500 characters or fewer.';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array'
     or jsonb_array_length(p_items) not between 1 and 12 then
    raise exception 'Select between 1 and 12 different products.';
  end if;

  for v_line in select value from jsonb_array_elements(p_items) as t(value)
  loop
    if jsonb_typeof(v_line)<>'object'
       or jsonb_typeof(v_line->'item_id')<>'string'
       or coalesce(v_line->>'item_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
       or jsonb_typeof(v_line->'quantity')<>'number'
       or coalesce(v_line->>'quantity','') !~ '^[0-9]{1,2}$' then
      raise exception 'Check your selected products and quantities.';
    end if;
    v_id:=(v_line->>'item_id')::uuid;
    if v_id=any(v_ids) then raise exception 'Each product can only appear once in your cart.'; end if;
    if (v_line->>'quantity')::integer not between 1 and 99 then
      raise exception 'Each product quantity must be between 1 and 99.';
    end if;
    v_ids:=array_append(v_ids,v_id);
    v_quantities:=array_append(v_quantities,(v_line->>'quantity')::integer);
    v_qty_total:=v_qty_total+(v_line->>'quantity')::integer;
    v_count:=v_count+1;
  end loop;
  if v_qty_total>99 then raise exception 'Cart quantity cannot exceed 99 units.'; end if;

  -- Both the existing single-item endpoint and this cart endpoint use this
  -- identical contact lock, preventing overlapping request-ratelimit races.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_email||'|'||v_phone,0)
  );
  select md5(string_agg(t.id::text||':'||t.qty::text,',' order by t.id::text)||'|'||v_notes)
    into v_fingerprint
    from unnest(v_ids,v_quantities) as t(id,qty);
  select id into v_existing
    from public.store_purchase_requests
   where customer_email=v_email
     and customer_phone=v_phone
     and customer_name=v_name
     and cart_fingerprint=v_fingerprint
     and created_at>now()-interval '90 seconds'
     and status='pending'
   order by created_at desc limit 1;
  if v_existing is not null then return v_existing; end if;

  select count(*)::integer into v_recent_count
    from public.store_purchase_requests
   where ((v_email<>'' and customer_email=v_email) OR customer_phone=v_phone)
     and created_at>now()-interval '15 minutes';
  if v_recent_count>=5 then
    raise exception 'Too many recent requests. Please try again in 15 minutes or call the shop.';
  end if;

  -- Lock every product in a stable order to avoid deadlocks with other carts.
  for v_product in
    select si.id, si.title, si.price, si.status,si.stock_quantity,si.reserved_quantity,
           t.qty
    from unnest(v_ids,v_quantities) as t(id,qty)
    join public.store_items si on si.id=t.id
    order by si.id for share of si
  loop
    if v_product.status<>'available'
       or v_product.stock_quantity-v_product.reserved_quantity<v_product.qty then
      raise exception 'Not enough available stock for %',v_product.title;
    end if;
    v_price_total:=v_price_total+v_product.price*v_product.qty;
  end loop;
  if (select count(*) from public.store_items where id=any(v_ids))<>v_count then
    raise exception 'A selected product is no longer available.';
  end if;

  insert into public.store_purchase_requests(
    item_id,item_title,item_price,quantity,customer_name,
    customer_phone,customer_email,notes,status,cart_fingerprint
  ) values (
    null, 'Cart · '||v_count::text||case when v_count=1 then ' product' else ' products' end,
    v_price_total,v_qty_total,v_name,v_phone,v_email,v_notes,'pending',v_fingerprint
  ) returning id into v_request;

  insert into public.store_purchase_request_items(request_id,item_id,item_title,item_price,quantity)
    select v_request,si.id,si.title,si.price,t.qty
    from unnest(v_ids,v_quantities) as t(id,qty)
    join public.store_items si on si.id=t.id;
  return v_request;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.ajd_submit_store_purchase(p_item_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text, p_quantity integer, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_item public.store_items%rowtype;
  v_id uuid;
  v_existing uuid;
  v_name text := btrim(coalesce(p_customer_name,''));
  v_phone text := btrim(coalesce(p_customer_phone,''));
  v_email text := lower(btrim(coalesce(p_customer_email,'')));
  v_notes text := btrim(coalesce(p_notes,''));
  v_recent_count integer;
BEGIN
  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'Choose an available product before submitting.';
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Enter your full name (2–120 characters).';
  END IF;
  IF char_length(v_phone) NOT BETWEEN 7 AND 35
     OR char_length(regexp_replace(v_phone,'[^0-9]','','g')) NOT BETWEEN 7 AND 15 THEN
    RAISE EXCEPTION 'A valid phone number is required (7–15 digits).';
  END IF;
  IF v_email <> '' AND (char_length(v_email) NOT BETWEEN 6 AND 200
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') THEN
    RAISE EXCEPTION 'Enter a valid email address or leave it blank.';
  END IF;
  IF char_length(v_notes)>1500 OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 99 THEN
    RAISE EXCEPTION 'Check the quantity (1–99) and notes (up to 1,500 characters).';
  END IF;

  -- Serialize submissions from the same contact to prevent concurrent duplicate
  -- requests and limit public form abuse without exposing private order data.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email||'|'||v_phone, 0));

  SELECT id INTO v_existing
    FROM public.store_purchase_requests
   WHERE customer_email=v_email
     AND customer_phone=v_phone
     AND customer_name=v_name
     AND item_id=p_item_id
     AND quantity=p_quantity
     AND notes=v_notes
     AND created_at>now()-interval '90 seconds'
     AND status='pending'
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT count(*)::integer INTO v_recent_count
    FROM public.store_purchase_requests
   WHERE ((v_email<>'' and customer_email=v_email) OR customer_phone=v_phone)
     AND created_at>now()-interval '15 minutes';
  IF v_recent_count>=5 THEN
    RAISE EXCEPTION 'Too many recent requests. Please try again in 15 minutes or call the shop.';
  END IF;

  SELECT * INTO v_item
    FROM public.store_items
   WHERE id=p_item_id
   FOR SHARE;
  IF NOT FOUND OR v_item.status<>'available' THEN
    RAISE EXCEPTION 'This product is currently unavailable.';
  END IF;
  IF v_item.stock_quantity-v_item.reserved_quantity < p_quantity THEN
    RAISE EXCEPTION 'Not enough stock available for that quantity.';
  END IF;

  INSERT INTO public.store_purchase_requests (
    item_id,item_title,item_price,quantity,customer_name,
    customer_phone,customer_email,notes,status
  ) VALUES (
    v_item.id,v_item.title,v_item.price,p_quantity,v_name,
    v_phone,v_email,v_notes,'pending'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$
;
