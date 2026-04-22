import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");

    if (!projectId || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blink = createClient({ projectId, secretKey });

    // Query the app_users table - find by username, verify password in code
    let users: any[] = [];
    try {
      users = await (blink.db as any).appUsers.list({
        where: {
          username,
          isActive: "1"
        },
        limit: 1
      });
      
      // Verify password in code (handles special characters better)
      if (users && users.length > 0) {
        const matchedUser = users.find((u: any) => u.password === password);
        users = matchedUser ? [matchedUser] : [];
      }
    } catch (queryError) {
      console.error("Database query error:", queryError);
      throw queryError;
    }

    if (users && users.length > 0) {
      const dbUser = users[0];
      
      // Return the user data (excluding password if possible, though strict SELECT might be needed if schema has it)
      // For now, we return what we found, assuming client handles it as before
      return new Response(JSON.stringify({ user: dbUser }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
