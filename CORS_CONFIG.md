# CORS Configuration Documentation

## Overview

This document describes the Cross-Origin Resource Sharing (CORS) configuration for the AI Image & Video Generation Platform.

## CORS Headers Configuration

All API requests for image and video generation include the following CORS headers:

```
Access-Control-Allow-Origin: https://ai-image-video-gener-xej2allm.sites.blink.new
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

## Implementation Details

### 1. Frontend Origin
- **Domain**: `https://ai-image-video-gener-xej2allm.sites.blink.new`
- **Purpose**: The frontend application where generation requests originate

### 2. Allowed Methods
- **POST**: Used for image and video generation requests
- **OPTIONS**: Used for CORS preflight requests

### 3. Allowed Headers
- **Authorization**: For authentication tokens (JWT)
- **Content-Type**: For JSON request bodies

### 4. Max Age
- **86400 seconds** (24 hours): Browser cache duration for preflight requests

## Files Modified

### `/src/lib/cors-middleware.ts`
- Central CORS configuration module
- Provides functions to get CORS configuration and headers
- Includes global fetch interceptor setup
- Logs CORS configuration for debugging

### `/src/lib/api-config.ts`
- API configuration constants
- Fetch wrapper functions with CORS support

### `/src/lib/ai-retry.ts`
- Updated with CORS headers constants
- Retry logic for generation requests with proper CORS handling

### `/src/App.tsx`
- Initialize CORS middleware on app load
- Log CORS configuration in browser console
- Verify CORS headers are set correctly

## API Endpoints

### Image Generation
- **Path**: `/api/generate-image`
- **Method**: POST
- **CORS Headers**: Applied
- **Request Body**:
  ```json
  {
    "prompt": "string",
    "model": "string",
    "n": 1,
    "size": "1024x1024"
  }
  ```

### Video Generation
- **Path**: `/api/generate-video`
- **Method**: POST
- **CORS Headers**: Applied
- **Request Body**:
  ```json
  {
    "prompt": "string",
    "model": "string",
    "duration": "10s",
    "aspect_ratio": "16:9",
    "image_url": "optional"
  }
  ```

### Image Transformation
- **Path**: `/api/transform-image`
- **Method**: POST
- **CORS Headers**: Applied
- **Request Body**:
  ```json
  {
    "images": ["url1", "url2"],
    "prompt": "string",
    "model": "string",
    "n": 1
  }
  ```

## CORS Preflight Flow

1. **Browser sends OPTIONS request** with headers:
   - `Origin: https://ai-image-video-gener-xej2allm.sites.blink.new`
   - `Access-Control-Request-Method: POST`
   - `Access-Control-Request-Headers: Authorization, Content-Type`

2. **Server responds with CORS headers**:
   - `Access-Control-Allow-Origin: https://ai-image-video-gener-xej2allm.sites.blink.new`
   - `Access-Control-Allow-Methods: POST, OPTIONS`
   - `Access-Control-Allow-Headers: Authorization, Content-Type`
   - `Access-Control-Max-Age: 86400`

3. **Browser caches preflight response** for 24 hours

4. **Browser sends actual POST request** with original headers

## Browser Console Logs

When the app loads, check the browser console for:

```
🔒 CORS Configuration
Allowed Origin: https://ai-image-video-gener-xej2allm.sites.blink.new
Allowed Methods: ["POST", "OPTIONS"]
Allowed Headers: ["Authorization", "Content-Type", "Accept"]
Headers Object: {...}

✅ CORS Configuration initialized
Frontend Origin: https://ai-image-video-gener-xej2allm.sites.blink.new
Allowed Backend Origin: https://ai-image-video-gener-xej2allm.sites.blink.new
```

## Testing CORS Configuration

### 1. Check Console Logs
Open browser DevTools → Console to see CORS configuration logs.

### 2. Check Network Tab
- Open DevTools → Network tab
- Trigger image/video generation
- Look for OPTIONS preflight request
- Verify response headers include CORS headers

### 3. Manual Test
```javascript
// In browser console
fetch('https://ai-image-video-gener-xej2allm.sites.blink.new/api/generate-image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://ai-image-video-gener-xej2allm.sites.blink.new'
  },
  body: JSON.stringify({
    prompt: 'test',
    model: 'seedream-4.5'
  })
})
.then(r => r.json())
.then(data => console.log(data))
```

## Troubleshooting

### Issue: CORS Error in Console
**Solution**: Verify that:
1. The frontend origin matches exactly
2. All required headers are included
3. The backend is sending correct CORS response headers
4. Check Network tab for OPTIONS requests

### Issue: 405 Method Not Allowed
**Solution**: Ensure the endpoint supports:
- POST for actual requests
- OPTIONS for preflight requests

### Issue: 400 Bad Request
**Solution**: Verify request body includes required fields:
- `prompt` (string)
- `model` (string)
- Model-specific parameters (size, duration, etc.)

## Edge Functions

Edge functions deployed for CORS handling:
1. **generate-image**: Text-to-image generation with CORS headers
2. **generate-video**: Text-to-video and image-to-video generation with CORS headers
3. **transform-image**: Image transformation and blending with CORS headers

Each function includes:
- Automatic CORS header injection
- OPTIONS request handling
- POST request validation
- Error handling with CORS headers

## Security Considerations

1. **Single Origin Only**: CORS is restricted to the exact frontend domain
2. **Explicit Methods**: Only POST and OPTIONS are allowed
3. **Header Whitelist**: Only specific headers are allowed
4. **No Credentials**: Cross-origin credentials are not enabled by default
5. **Max Age**: Preflight caching is limited to 24 hours

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [CORS Specification](https://fetch.spec.whatwg.org/#cors-protocol)
- [Blink SDK Documentation](https://docs.blink.new/)

## Support

For CORS-related issues:
1. Check browser console for error messages
2. Review Network tab for request/response details
3. Verify frontend and backend origins match
4. Check that all required headers are present
5. Contact support if issues persist
