/**
 * Robust file download utility that works across all browsers
 * Handles immediate download triggering without delays
 */

export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    // Try fetching as blob first to force download for cross-origin resources
    // This works around browser security that ignores 'download' attribute on cross-origin links
    const response = await fetch(url, {
      mode: 'cors', // Ensure we request CORS access
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      return;
    }
  } catch (error) {
    console.warn('Blob download failed, falling back to anchor tag:', error);
  }

  // Fallback: standard anchor tag method
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank'; // Open in new tab if download attribute is ignored
    link.rel = 'noopener noreferrer';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
  } catch (error) {
    console.error('Download failed:', error);
    
    // Final fallback: try opening in new tab directly
    try {
      window.open(url, '_blank');
    } catch (fallbackError) {
      console.error('Fallback download also failed:', fallbackError);
    }
  }
}

/**
 * Download image file with proper extension
 */
export function downloadImage(imageUrl: string, filename?: string): void {
  // Ensure filename has an extension
  let safeFilename = filename || `ai-image-${Date.now()}`;
  if (!safeFilename.match(/\.(png|jpg|jpeg|webp)$/i)) {
    // Try to detect from URL or default to png
    const ext = imageUrl.split('.').pop()?.split(/[?#]/)[0];
    if (ext && ['png', 'jpg', 'jpeg', 'webp'].includes(ext.toLowerCase())) {
      safeFilename += `.${ext}`;
    } else {
      safeFilename += '.png';
    }
  }
  
  downloadFile(imageUrl, safeFilename);
}

/**
 * Download video file with proper extension
 */
export function downloadVideo(videoUrl: string, filename?: string): void {
  // Ensure filename has an extension
  let safeFilename = filename || `ai-video-${Date.now()}`;
  if (!safeFilename.match(/\.(mp4|webm|mov)$/i)) {
    // Try to detect from URL or default to mp4
    const ext = videoUrl.split('.').pop()?.split(/[?#]/)[0];
    if (ext && ['mp4', 'webm', 'mov'].includes(ext.toLowerCase())) {
      safeFilename += `.${ext}`;
    } else {
      safeFilename += '.mp4';
    }
  }
  
  downloadFile(videoUrl, safeFilename);
}
