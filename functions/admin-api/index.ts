import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-admin-key",
};

const ADMIN_KEY = "Dj@4747";

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") || "users";
  const adminKey = req.headers.get("x-admin-key");
  
  // Allow public GET access to branding settings only
  const isPublicBrandingRequest = resource === "branding" && req.method === "GET";
  
  // Check auth for non-public endpoints
  if (!isPublicBrandingRequest && adminKey !== ADMIN_KEY) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }), 
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");

    if (!projectId || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Missing config" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blink = createClient({ projectId, secretKey });
    const id = url.searchParams.get("id");
    
    // Public endpoint: Get branding only (no auth required)
    if (resource === "branding" && req.method === "GET") {
      const settings = await blink.db.appSettings.list();
      const branding = {
        logoUrl: '/branding/logo.png',
        backgroundUrl: '/branding/background.png'
      };
      
      if (settings && Array.isArray(settings)) {
        settings.forEach((row: any) => {
          if (row.key === 'logo_url' && row.value) {
            branding.logoUrl = row.value;
          }
          if (row.key === 'background_url' && row.value) {
            branding.backgroundUrl = row.value;
          }
        });
      }
      
      return new Response(JSON.stringify(branding), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resource: Upload
    if (resource === "upload") {
      if (req.method === "POST") {
        try {
          const formData = await req.formData();
          const file = formData.get("file");
          const path = formData.get("path") as string;
          
          if (!file || !path) {
            return new Response(JSON.stringify({ error: "Missing file or path" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          
          // Upload to storage
          const { publicUrl } = await blink.storage.upload(file as File, path);
          
          return new Response(JSON.stringify({ publicUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (uploadError: any) {
           console.error("Upload error:", uploadError);
           return new Response(JSON.stringify({ error: "Upload failed: " + (uploadError.message || uploadError) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resource: Users
    if (resource === "users") {
      if (req.method === "GET") {
        const users = await blink.db.appUsers.list({ orderBy: { createdAt: 'desc' } });
        return new Response(JSON.stringify(users), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "POST") {
        const body = await req.json();
        // Ensure credits is set
        if (body.credits === undefined) body.credits = 10;
        const result = await blink.db.appUsers.create(body);
        return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "PUT" && id) {
        const body = await req.json();
        const result = await blink.db.appUsers.update(id, body);
        return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "DELETE" && id) {
        await blink.db.appUsers.delete(id);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Resource: Settings (Branding)
    if (resource === "settings") {
       if (req.method === "GET") {
         const settings = await blink.db.appSettings.list();
         return new Response(JSON.stringify(settings), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
       }
       
       if (req.method === "POST") {
         // Used for creating new setting
         const body = await req.json();
         const result = await blink.db.appSettings.create(body);
         return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
       }

       if (req.method === "PUT" && id) {
         // Used for updating existing setting
         const body = await req.json();
         const result = await blink.db.appSettings.update(id, body);
         return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
       }
    }

    return new Response(JSON.stringify({ error: "Method not allowed or missing ID" }), { status: 400, headers: corsHeaders });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

Deno.serve(handler);