-- Product photo galleries for private inventory and published customer listings.
-- Existing single-photo clients keep working through image_url.
ALTER TABLE public.ajd_parts_inventory ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.store_items ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[];

CREATE OR REPLACE FUNCTION public.ajd_normalize_product_images()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
 source_urls text[];
 normalized text[] := '{}'::text[];
 photo text;
BEGIN
 IF TG_OP='INSERT' THEN
  source_urls := CASE WHEN cardinality(NEW.image_urls)>0 THEN NEW.image_urls
                     WHEN btrim(NEW.image_url)<>'' THEN ARRAY[NEW.image_url] ELSE '{}'::text[] END;
 ELSIF NEW.image_urls IS DISTINCT FROM OLD.image_urls THEN
  source_urls := NEW.image_urls;
 ELSIF NEW.image_url IS DISTINCT FROM OLD.image_url THEN
  IF btrim(NEW.image_url)='' THEN source_urls := '{}'::text[];
  ELSE
   source_urls := ARRAY[NEW.image_url] || ARRAY(
    SELECT value FROM unnest(OLD.image_urls) WITH ORDINALITY AS previous(value,position)
    WHERE value<>OLD.image_url AND value<>NEW.image_url ORDER BY position);
  END IF;
 ELSE RETURN NEW;
 END IF;
 IF source_urls IS NULL OR coalesce(array_ndims(source_urls),1)<>1 THEN
  RAISE EXCEPTION 'Product photos must be a one-dimensional list.' USING ERRCODE='23514';
 END IF;
 FOREACH photo IN ARRAY source_urls LOOP
  IF photo IS NULL OR length(btrim(photo))>2000 OR btrim(photo) !~* '^https?://' THEN
   RAISE EXCEPTION 'Product photos require complete public http(s) URLs.' USING ERRCODE='23514';
  END IF;
  photo := btrim(photo);
  IF NOT photo=ANY(normalized) THEN normalized := array_append(normalized,photo); END IF;
 END LOOP;
 IF cardinality(normalized)>10 THEN
  RAISE EXCEPTION 'A product can have up to 10 photos.' USING ERRCODE='23514';
 END IF;
 NEW.image_urls := normalized;
 NEW.image_url := coalesce(normalized[1],'');
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.ajd_normalize_product_images() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS ajd_normalize_product_images ON public.ajd_parts_inventory;
CREATE TRIGGER ajd_normalize_product_images BEFORE INSERT OR UPDATE OF image_url,image_urls
ON public.ajd_parts_inventory FOR EACH ROW EXECUTE FUNCTION public.ajd_normalize_product_images();
DROP TRIGGER IF EXISTS ajd_normalize_product_images ON public.store_items;
CREATE TRIGGER ajd_normalize_product_images BEFORE INSERT OR UPDATE OF image_url,image_urls
ON public.store_items FOR EACH ROW EXECUTE FUNCTION public.ajd_normalize_product_images();

CREATE OR REPLACE FUNCTION public.ajd_inventory_publish(p_inventory_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_item public.ajd_parts_inventory%rowtype;
 v_id uuid;
begin
 if not (select public.ajd_is_admin()) then raise exception 'Administrator access required'; end if;
 select * into v_item from public.ajd_parts_inventory where id=p_inventory_id for update;
 if not found then raise exception 'Inventory item not found'; end if;
 if v_item.archived then raise exception 'Restore this archived item before publishing.'; end if;
 if v_item.store_item_id is null then
   insert into public.store_items
   (title,category,price,condition,sku,brand,description,image_url,image_urls,status,stock_quantity,reserved_quantity)
   values
   (v_item.item_name,
    case v_item.item_type when 'Part' then 'Parts' when 'Accessory' then 'Accessories' else 'Other' end,
    v_item.sale_price,v_item.condition,v_item.sku,v_item.brand,
    case when btrim(v_item.public_description)<>'' then v_item.public_description
         when btrim(v_item.compatible_device)<>'' then 'Compatible with: '||v_item.compatible_device
         else '' end,
    v_item.image_url,v_item.image_urls,
    case when v_item.quantity>0 then 'available' else 'out_of_stock' end,
    v_item.quantity,0)
   returning id into v_id;
   update public.ajd_parts_inventory set store_item_id=v_id where id=p_inventory_id;
 else
   v_id := v_item.store_item_id;
   -- Re-run synchronization and validate pending reservations first.
   update public.ajd_parts_inventory set sale_price=sale_price where id=p_inventory_id;
   update public.store_items set
     status=case when v_item.quantity>0 then 'available' else 'out_of_stock' end,
     updated_at=now()
   where id=v_id;
   if not found then raise exception 'Linked storefront listing no longer exists'; end if;
 end if;
 return v_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.ajd_inventory_sync_linked_store()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.store_item_id is null then return new; end if;
 if exists(select 1 from public.store_items s where s.id=new.store_item_id
    and s.reserved_quantity>new.quantity) then
  raise exception 'Stock quantity cannot be below quantities reserved in customer requests; resolve reservations before reducing stock.';
 end if;

 update public.store_items as s
 set title=new.item_name,
     category=case new.item_type when 'Part' then 'Parts'
              when 'Accessory' then 'Accessories' else 'Other' end,
     price=new.sale_price,
     condition=new.condition,
     sku=new.sku,
     brand=new.brand,
     stock_quantity=new.quantity,
     description=case
       when btrim(new.public_description)<>'' then new.public_description
       when btrim(new.compatible_device)<>'' then 'Compatible with: '||new.compatible_device
       else '' end,
     image_url=new.image_url,
     image_urls=new.image_urls,
     status=case when new.archived or s.status='hidden' then 'hidden'
                 when new.quantity=0 then 'out_of_stock' else 'available' end,
     updated_at=now()
 where s.id=new.store_item_id;

 if not found then
  raise exception 'Linked storefront item is missing. Open Store Management and review its status.';
 end if;
 return new;
end;
$function$;
DO $constraints$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.ajd_parts_inventory'::regclass AND conname='ajd_inventory_image_count') THEN
  ALTER TABLE public.ajd_parts_inventory ADD CONSTRAINT ajd_inventory_image_count CHECK(cardinality(image_urls)<=10 AND array_position(image_urls,NULL) IS NULL AND coalesce(array_ndims(image_urls),1)=1);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.store_items'::regclass AND conname='ajd_store_image_count') THEN
  ALTER TABLE public.store_items ADD CONSTRAINT ajd_store_image_count CHECK(cardinality(image_urls)<=10 AND array_position(image_urls,NULL) IS NULL AND coalesce(array_ndims(image_urls),1)=1);
 END IF;
END;
$constraints$;

DROP TRIGGER IF EXISTS ajd_inventory_sync_linked_store ON public.ajd_parts_inventory;
CREATE TRIGGER ajd_inventory_sync_linked_store AFTER UPDATE OF item_name,item_type,sku,brand,compatible_device,quantity,sale_price,condition,public_description,image_url,image_urls,archived,store_item_id
ON public.ajd_parts_inventory FOR EACH ROW EXECUTE FUNCTION public.ajd_inventory_sync_linked_store();

-- Verify compatibility without creating or changing any shop inventory records.
DO $verification$
DECLARE result_urls text[]; result_cover text;
BEGIN
 CREATE TEMP TABLE ajd_product_photo_test(id integer,title text,image_url text NOT NULL DEFAULT '',image_urls text[] NOT NULL DEFAULT '{}') ON COMMIT DROP;
 CREATE TRIGGER test_photos BEFORE INSERT OR UPDATE OF image_url,image_urls ON ajd_product_photo_test FOR EACH ROW EXECUTE FUNCTION public.ajd_normalize_product_images();
 INSERT INTO ajd_product_photo_test(id,image_url) VALUES(1,'https://example.test/a.jpg');
 UPDATE ajd_product_photo_test SET image_urls=ARRAY['https://example.test/a.jpg','https://example.test/b.jpg'] WHERE id=1;
 UPDATE ajd_product_photo_test SET image_url='https://example.test/c.jpg' WHERE id=1;
 UPDATE ajd_product_photo_test SET title='Price or title edit keeps all photos' WHERE id=1;
 SELECT image_urls INTO result_urls FROM ajd_product_photo_test WHERE id=1;
 IF result_urls IS DISTINCT FROM ARRAY['https://example.test/c.jpg','https://example.test/b.jpg'] THEN RAISE EXCEPTION 'Legacy cover update lost gallery photos'; END IF;
 UPDATE ajd_product_photo_test SET image_urls=ARRAY['https://example.test/b.jpg','https://example.test/c.jpg'] WHERE id=1;
 SELECT image_url INTO result_cover FROM ajd_product_photo_test WHERE id=1;
 IF result_cover<>'https://example.test/b.jpg' THEN RAISE EXCEPTION 'Gallery cover did not follow ordering'; END IF;
 UPDATE ajd_product_photo_test SET image_urls='{}' WHERE id=1;
 SELECT image_url INTO result_cover FROM ajd_product_photo_test WHERE id=1;
 IF result_cover<>'' THEN RAISE EXCEPTION 'Removing all photos did not clear cover'; END IF;
 BEGIN
  UPDATE ajd_product_photo_test SET image_urls=ARRAY(SELECT 'https://example.test/'||i||'.jpg' FROM generate_series(1,11) AS i) WHERE id=1;
  RAISE EXCEPTION 'Photo limit was not enforced';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE ajd_product_photo_test SET image_urls=ARRAY['javascript:alert(1)'] WHERE id=1;
  RAISE EXCEPTION 'Unsafe photo URL was accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 DROP TABLE ajd_product_photo_test;
END;
$verification$;

