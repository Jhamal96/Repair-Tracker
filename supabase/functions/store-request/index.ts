// AJD's Wireless Repairs — anonymous storefront request intake.
// Public customers never receive database table privileges or service credentials.
// The server-side RPC enforces stock checks, mandatory contact info and throttling.
const ALLOWED_ORIGINS = new Set([
  "https://repair.ajdapp.org",
  "https://repair.ajdapp.com",
  "https://repair.jhamal16.workers.dev",
  "https://www.ajdapp.org"
]);

type RequestBody = {
  item_id?: unknown;
  items?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  customer_email?: unknown;
  quantity?: unknown;
  notes?: unknown;
  website?: unknown;
};

function response(
  payload: Record<string, unknown>,
  status: number,
  origin: string | null
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin",
    "x-content-type-options": "nosniff",
    "access-control-allow-methods": "POST, OPTIONS, GET",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-max-age": "86400"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["access-control-allow-origin"] = origin;
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 120;
}
function validPhone(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length >= 7 && value.trim().length <= 35 &&
    /^\+?[\d\s().-]+$/.test(value.trim()) &&
    /^\d{7,15}$/.test(value.replace(/\D/g, ""));
}
function validEmail(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length >= 6 && value.trim().length <= 200 &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim());
}
function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return response({ error: "This storefront origin is not allowed." }, 403, null);
  }

  if (request.method === "OPTIONS") {
    return response({ ok: true }, 200, origin);
  }

  if (request.method === "GET") {
    // Harmless public health check to support non-writing deployment tests.
    const configured = Boolean(
      Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );
    return response(
      { service: "ajd-store-request", status: configured ? "ready" : "unavailable" },
      configured ? 200 : 503,
      origin
    );
  }

  if (request.method !== "POST") {
    return response({ error: "Only POST requests are accepted." }, 405, origin);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return response({ error: "Please submit a valid purchase request." }, 415, origin);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 16000) {
    return response({ error: "Request is too large." }, 413, origin);
  }

  let body: RequestBody;
  try {
    const raw = await request.text();
    if (raw.length > 16000) {
      return response({ error: "Request is too large." }, 413, origin);
    }
    body = JSON.parse(raw) as RequestBody;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Invalid body");
    }
  } catch {
    return response({ error: "Enter a valid purchase request and try again." }, 400, origin);
  }

  // Optional honeypot for unsolicited automated submissions.
  if (typeof body.website === "string" && body.website.trim()) {
    return response({ error: "We could not verify this request." }, 400, origin);
  }
  const cartMode = Array.isArray(body.items);
  let cartItems: Array<{item_id:string;quantity:number}> = [];
  if (cartMode) {
    const lines = body.items as unknown[];
    if (lines.length < 1 || lines.length > 12) {
      return response({ error: "Choose between 1 and 12 different products." }, 422, origin);
    }
    const seen = new Set<string>();
    for (const line of lines) {
      if (!line || typeof line !== "object" || Array.isArray(line)) {
        return response({ error: "One or more cart items are invalid." }, 422, origin);
      }
      const item = line as Record<string,unknown>;
      if (!validUuid(item.item_id) || !Number.isInteger(item.quantity)
          || (item.quantity as number) < 1 || (item.quantity as number) > 99
          || seen.has((item.item_id as string).toLowerCase())) {
        return response({ error: "Check your selected items and quantities." }, 422, origin);
      }
      seen.add((item.item_id as string).toLowerCase());
      cartItems.push({item_id:item.item_id as string,quantity:item.quantity as number});
    }
    if (cartItems.reduce((sum,item)=>sum+item.quantity,0)>99) {
      return response({ error: "Cart quantity cannot exceed 99 units." }, 422, origin);
    }
  } else if (!validUuid(body.item_id)) {
    return response({ error: "Please select an available product." }, 422, origin);
  }
  if (!validName(body.customer_name)) {
    return response({ error: "Please enter your full name." }, 422, origin);
  }
  if (!validPhone(body.customer_phone)) {
    return response({ error: "A valid phone number is required (7–15 digits)." }, 422, origin);
  }
  const email = body.customer_email == null ? "" : body.customer_email;
  if (typeof email !== "string" || (email.trim() && !validEmail(email))) {
    return response({ error: "Enter a valid email address or leave it blank." }, 422, origin);
  }
  if (!cartMode && (!Number.isInteger(body.quantity) || (body.quantity as number) < 1 || (body.quantity as number) > 99)) {
    return response({ error: "Enter a quantity between 1 and 99." }, 422, origin);
  }
  if (typeof body.notes !== "string" || body.notes.length > 1500) {
    return response({ error: "Notes must be 1,500 characters or fewer." }, 422, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) {
    console.error("AJD store request service is missing required server credentials");
    return response({ error: "The purchase request service is temporarily unavailable. Please call the shop." }, 503, origin);
  }
  try {
    const rpc = await fetch(
      url + (cartMode
        ? "/rest/v1/rpc/ajd_submit_store_cart"
        : "/rest/v1/rpc/ajd_submit_store_purchase"),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
          "apikey": secret,
          "authorization": "Bearer " + secret
        },
        body: JSON.stringify(cartMode ? {
          p_items:cartItems,
          p_customer_name: body.customer_name.trim(),
          p_customer_phone: body.customer_phone.trim(),
          p_customer_email: email.trim().toLowerCase(),
          p_notes: body.notes.trim()
        } : {
          p_item_id: body.item_id,
          p_customer_name: body.customer_name.trim(),
          p_customer_phone: body.customer_phone.trim(),
          p_customer_email: email.trim().toLowerCase(),
          p_quantity: body.quantity,
          p_notes: body.notes.trim()
        }),
        signal: AbortSignal.timeout(12000)
      }
    );

    if (!rpc.ok) {
      const errorBody: {message?: string; code?: string} = await rpc.json().catch(() => ({}));
      const errText = String(errorBody.message || "");
      // Show only specific safe user-facing validation errors; never echo database internals.
      const safeErrors = [
        "full name", "phone number", "email address", "quantity",
        "currently unavailable", "stock available", "recent requests",
        "Check the quantity", "Choose an available product",
        "selected products", "cart", "product", "Cart quantity",
        "Each product", "Choose between"
      ];
      const friendly = safeErrors.some(fragment => errText.includes(fragment))
        ? errText
        : "Unable to submit right now. Please try again or call the shop.";
      console.error("AJD purchase RPC failed:", rpc.status, errorBody.code ?? "unknown");
      return response({ error: friendly }, rpc.status >= 500 ? 503 : 422, origin);
    }

    const requestId: unknown = await rpc.json().catch(() => null);
    if (!validUuid(requestId)) {
      console.error("AJD purchase RPC returned invalid request ID");
      return response({ error: "Unable to confirm your request. Please call the shop before submitting again." }, 503, origin);
    }
    return response({
      ok: true,
      request_id: requestId,
      message: cartMode
        ? "Your cart request was received. We will confirm availability for all selected products."
        : "Your purchase request was received. We will contact you to confirm availability."
    }, 201, origin);
  } catch (err) {
    console.error("AJD store purchase endpoint fetch failed:", err instanceof Error ? err.name : "unknown");
    return response({ error: "The store is having trouble connecting. Please retry in a moment or call us." }, 503, origin);
  }
});
