/**
 * Edge function: check-job-status
 * Checks the status of async Sora 2 Pro video generation jobs
 * Returns job status and video URL when complete
 */

// In-memory cache for job results (temporary - in production use Deno KV or similar)
// const jobCache = new Map<string, {
//   status: string
//   videoUrl?: string
//   error?: string
//   createdAt: number
//   completedAt?: number
// }>();

// Cleanup old entries periodically
// setInterval(() => {
//   const cutoff = Date.now() - (3600000); // 1 hour
//   for (const [key, value] of jobCache) {
//     if (value.completedAt && value.completedAt < cutoff) {
//       jobCache.delete(key);
//     }
//   }
// }, 300000); // Cleanup every 5 minutes

import { createClient } from "npm:@blinkdotnew/sdk";

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Async, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
};

interface JobStatusRequest {
  job_id: string;
}

export default async function handler(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST or OPTIONS." }),
      {
        status: 405,
        headers: corsHeaders,
      }
    );
  }

  try {
    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");

    if (!projectId || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Configuration missing." }),
        { status: 500, headers: corsHeaders }
      );
    }

    const blink = createClient({ projectId, secretKey });
    const body: JobStatusRequest = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: job_id" }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Check job status in database
    const jobData = await blink.db.jobs.get(job_id);

    if (!jobData) {
      // Job not found
      // Check if it should have been created by now (grace period of 2 minutes)
      // ID format: sora-{timestamp}-{random}
      const parts = job_id.split('-');
      if (parts.length >= 2) {
        const timestamp = parseInt(parts[1]);
        if (!isNaN(timestamp)) {
          const timeSinceCreation = Date.now() - timestamp;
          if (timeSinceCreation > 2 * 60 * 1000) { // 2 minutes
             return new Response(
              JSON.stringify({
                success: true,
                data: {
                  completed: false,
                  failed: true,
                  error: "Job initialization failed. Please try again.",
                  status: "failed"
                }
              }),
              {
                status: 200,
                headers: corsHeaders,
              }
            );
          }
        }
      }

      // Job not found or still initializing (within grace period)
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            completed: false,
            failed: false,
            status: "processing"
          }
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // Check for stale jobs (auto-fail if stuck in processing for too long)
    const STALE_TIMEOUT = 60 * 60 * 1000; // 60 minutes
    if (jobData.status === "processing") {
      // Handle both camelCase and snake_case for creation timestamp
      const createdTimestamp = jobData.createdAt || jobData.created_at;
      const createdAt = createdTimestamp ? new Date(createdTimestamp).getTime() : Date.now();
      
      if (Date.now() - createdAt > STALE_TIMEOUT) {
        const errorMsg = "Job timed out. The generation took longer than expected.";
        
        // Mark as failed in DB so we don't check again
        try {
          await blink.db.jobs.update(job_id, {
            status: "failed",
            error: errorMsg
          });
        } catch (e) {
          console.error("Failed to update stale job:", e);
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              completed: false,
              failed: true,
              error: errorMsg,
              status: "failed"
            }
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }
    }

    // Return job status
    if (jobData.status === "completed") {
      const result = JSON.parse(jobData.result || "{}");
      
      // Extract video URL from various possible result structures
      // Different AI models return different response formats
      let videoUrl: string | undefined;
      
      // Try all possible paths where video URL might be stored
      videoUrl = result.video?.url 
        || result.file?.url
        || result.result?.video?.url 
        || result.result?.file?.url
        || result.data?.video?.url
        || result.data?.file?.url
        || result.url
        || result.result?.url
        || result.data?.url
        || result.video_url
        || result.result?.video_url
        || result.data?.video_url
        || result.outputs?.[0]?.url
        || result.images?.[0]?.url
        || result.data?.[0]?.url
        || result.data?.[0]?.file?.url;
      
      // If still not found, try to find any URL in the result
      if (!videoUrl && typeof result === 'object') {
        const findUrl = (obj: any, depth = 0): string | undefined => {
          if (depth > 5 || !obj || typeof obj !== 'object') return undefined;
          for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (typeof value === 'string' && value.startsWith('https://') && 
                (value.includes('.mp4') || value.includes('video') || value.includes('fal.ai'))) {
              return value;
            }
            if (typeof value === 'object') {
              const found = findUrl(value, depth + 1);
              if (found) return found;
            }
          }
          return undefined;
        };
        videoUrl = findUrl(result);
      }
      
      console.log("Job completed, extracted video URL:", videoUrl, "from result:", JSON.stringify(result).substring(0, 500));
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            completed: true,
            failed: false,
            videoUrl: videoUrl,
            status: "completed"
          }
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    } else if (jobData.status === "failed") {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            completed: false,
            failed: true,
            error: jobData.error,
            status: "failed"
          }
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    } else {
      // Still processing
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            completed: false,
            failed: false,
            status: "processing"
          }
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }
  } catch (error: any) {
    console.error("Error checking job status:", error);

    return new Response(
      JSON.stringify({
        error: error?.message || "Internal server error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

Deno.serve(handler);