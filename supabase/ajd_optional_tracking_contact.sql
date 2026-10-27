CREATE OR REPLACE FUNCTION public.ajd_public_track_repair(p_ticket text, p_contact text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_record jsonb;
 v_phone text;
 v_email text;
 v_ticket text := trim(coalesce(p_ticket,''));
 v_contact text := lower(trim(coalesce(p_contact,'')));
begin
 if length(v_ticket) not between 4 and 80 or (v_contact<>'' and length(v_contact) not between 5 and 254) then return null; end if;

 select to_jsonb(r) into v_record
   from public.repairs r
   where r.id::text = v_ticket or r.invoice_number = upper(v_ticket)
   limit 1;

 if v_record is null then return null; end if;
 v_phone := regexp_replace(coalesce(v_record->>'customer_phone',''),'[^0-9]','','g');
 v_email := lower(trim(coalesce(v_record->>'customer_email','')));
 if v_contact<>'' and not ((length(v_phone)>=7 and v_phone=regexp_replace(v_contact,'[^0-9]','','g'))
   or (v_email<>'' and length(v_email)>5 and v_email=v_contact)) then
   return null;
 end if;

 -- Only information needed for tracking is returned after contact verification.
 -- No customer name, phone, email, address, purchase costs or technician notes.
 return jsonb_build_object(
  'id',v_record->>'id',
  'invoice_number',v_record->>'invoice_number',
  'make_model',v_record->>'make_model',
  'status',v_record->>'status',
  'amount',v_record->>'amount',
  'deposit_amount',v_record->>'deposit_amount',
  'payment_status',v_record->>'payment_status',
  'created_at',v_record->>'created_at',
  'updated_at',v_record->>'updated_at',
  'picked_up_at',v_record->>'picked_up_at'
 );
end;
$function$

