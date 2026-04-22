/**
 * CORS Configuration for API Requests
 * This module ensures all API requests include proper CORS headers
 * Values are dynamically generated based on the current project
 */

import { getEnv } from './env'

// Dynamically construct the origin URL from environment variables
const getProjectId = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Extract project ID from hostname (e.g., project-id.sites.blink.new)
    const match = hostname.match(/^([a-z0-9-]+)\.(sites|preview)\.blink\.new$/);
    if (match) return match[1];
  }
  return getEnv('VITE_BLINK_PROJECT_ID') || 'grim-torque-ai-zfan3glq';
};

const projectId = getProjectId();

// Extract the project suffix (the part after the last dash)
// This hash is used for edge function subdomains
const projectSuffix = projectId.includes('-') ? projectId.split('-').pop()! : projectId

const dynamicOrigin = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.host}`
  : `https://${projectId}.sites.blink.new`

// Dynamic function URLs based on project suffix
// NOTE: Ensure these functions are deployed using blink_deploy_function
export const FUNCTION_URLS = {
  generateImage: `https://${projectSuffix}--generate-image.functions.blink.new`,
  generateVideo: `https://${projectSuffix}--generate-video.functions.blink.new`,
  transformImage: `https://${projectSuffix}--transform-image.functions.blink.new`,
  checkJobStatus: `https://${projectSuffix}--check-job-status.functions.blink.new`,
  adminApi: `https://${projectSuffix}--admin-api.functions.blink.new`,
}

export const ADMIN_KEY = 'Dj@4747'

// Function names for SDK invoke
export const FUNCTIONS = {
  generateImage: 'generate-image',
  generateVideo: 'generate-video',
  transformImage: 'transform-image',
  checkJobStatus: 'check-job-status',
}

export const CORS_CONFIG = {
  headers: {
    "Access-Control-Allow-Origin": dynamicOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  },
  methods: ["POST", "OPTIONS"],
  origin: dynamicOrigin,
};

/**
 * Fetch wrapper that includes common headers
 */
export async function fetchWithCORS(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  // Add common headers
  headers.set("Content-Type", "application/json");

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Options for fetch requests
 * Uses dynamic origin based on current project
 */
export const fetchOptions = {
  standard: {
    mode: "cors" as const,
    credentials: "include" as const,
    headers: {
      "Content-Type": "application/json",
    },
  },
  standardPost: {
    method: "POST",
    mode: "cors" as const,
    credentials: "include" as const,
    headers: {
      "Content-Type": "application/json",
    },
  },
};