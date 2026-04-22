# Blend/Merge Feature Improvements (v2)

## Overview
Enhanced the BLEND/MERGE feature to improve accuracy, consistency, and overall visual quality of merged images.

## Key Improvements

### 1. Advanced Prompt Engineering
- **Structured Format**: Prompts now use a clear hierarchical structure with sections:
  - BLEND OPERATION metadata (synthesis level, blend factor)
  - PRIMARY IMAGE identification (Image 1 as anchor)
  - REFERENCE IMAGES specification (Images 2+ as sources)
  - MODE selection (Dynamic Fusion, Style Transfer, or Subject Integration)
  - Explicit PRIORITY instructions for each mode
  - OUTPUT REQUIREMENTS for consistency
  - USER DIRECTION for creative guidance

- **Technical Precision**: 
  - Improved mode-specific instructions with technical language
  - "PRIORITY" markers ensure model focus on critical aspects
  - Emphasis on photorealism, lighting consistency, and seamless integration
  - Clear distinction between reference images and primary anchor

- **Blend Strength Description**:
  - Changed from generic ("aggressive", "subtle", "balanced") 
  - To technical ("low-synthesis", "medium-synthesis", "high-synthesis")
  - Percentage factor (10-100%) explicitly stated in prompt
  - Used throughout to guide synthesis amount

### 2. Model Selection Optimization
- **Default Model**: Changed from Nano Banana to **Nano Banana Pro**
  - Pro version has better understanding of complex multi-image blending
  - More accurate subject integration and style transfer
  - Superior lighting consistency across merged images
  - Better edge blending and composition understanding

### 3. Enhanced Retry Mechanism
- **Blend-Specific Retry Logic**:
  - Added `BLEND_MAX_RETRIES = 4` (one extra retry for blend operations)
  - Blend operations get more attempts due to increased complexity
  
- **Extended Timeouts**:
  - `MODIFY_TIMEOUT`: 60s → 80s (general transformations)
  - `BLEND_TIMEOUT`: New 100s timeout specifically for multi-image blending
  - Automatic timeout detection based on image count
  - Gives complex operations more time to process

- **Smart Timeout Selection**:
  - Blend with 1 image: Uses standard MODIFY_TIMEOUT (80s)
  - Blend with 2+ images: Uses extended BLEND_TIMEOUT (100s)
  - Provides flexibility based on complexity

### 4. Image Ordering and Clarity
- **Primary Image Anchor**: Explicitly marked as "Image 1 (structural anchor and base composition)"
- **Reference Images**: Clearly specified as "Images 2+ (sources for blending)"
- **Prevents ambiguity**: Ensures model understands role of each image
- **Maintains composition integrity**: Primary image structure guides the blend

### 5. Mode-Specific Instructions

#### Style Transfer (Aesthetic Focus)
```
PRIORITY: Transfer artistic style, color palette, mood, and lighting 
from reference images (2+) onto the primary subject in image 1
```
- Best for: Applying artistic style, color grade, or mood
- Preserves: Subject identity and composition
- Transforms: Visual language, aesthetic, lighting

#### Subject Integration (Content Focus)
```
PRIORITY: Seamlessly integrate subjects and key visual elements 
from reference images (2+) into the environment of image 1
```
- Best for: Adding new subjects or elements
- Preserves: Primary environment and composition
- Integrates: New subjects with matching lighting/texture

#### Dynamic Fusion (Balanced)
```
PRIORITY: Create balanced synthesis merging all images into one cohesive composition
```
- Best for: Equal contribution from all images
- Extracts: Essence from each image
- Combines: Composition, subjects, style, and mood dynamically

### 6. Quality Control Measures
- **Output Requirements** explicitly stated:
  - Single cohesive ultra-high-quality image
  - Photorealistic rendering with consistent lighting
  - Seamless integration with no visible boundaries
  - Maintain color grading consistency
  - Professional composition and depth

- **Photorealism Emphasis**: 
  - All modes emphasize photorealistic output
  - Lighting consistency across merged elements
  - No visible seams or integration artifacts
  - Professional-grade composition

## Technical Details

### New Parameters

**In `ai-retry.ts`**:
```typescript
const BLEND_MAX_RETRIES = 4
const BLEND_TIMEOUT = 100000 // 100 seconds
```

**In `modifyImageWithRetry()`**:
```typescript
modifyImageWithRetry(params, isBlend: boolean = false)
```

### Prompt Structure Example

```
BLEND OPERATION - medium-synthesis synthesis (50% blend factor)
PRIMARY IMAGE: Image 1 (structural anchor and base composition)
REFERENCE IMAGES: Images 2+ (sources for blending)
MODE: Dynamic Fusion

PRIORITY: Create balanced synthesis merging all images into one cohesive composition...

OUTPUT REQUIREMENTS:
- Single cohesive ultra-high-quality image
- Photorealistic rendering with consistent lighting
- Seamless integration with no visible boundaries
- Maintain color grading consistency
- Professional composition and depth

USER DIRECTION: [user's creative prompt]
```

## Expected Improvements

1. **Higher Success Rate**: Extra retry and extended timeout reduce failures
2. **Better Accuracy**: Structured prompts guide model more precisely
3. **Consistent Quality**: Pro model provides more reliable results
4. **Cleaner Integration**: Explicit photorealism requirements reduce artifacts
5. **User Expectations**: Clear mode descriptions help users choose correctly
6. **Visual Coherence**: Emphasis on lighting and texture consistency

## Testing Recommendations

1. Test blend modes with 2-3 images of similar subjects
2. Test with wildly different images (extreme style transfer)
3. Test blend strength range (0.1 → 1.0)
4. Compare results with/without RAW mode
5. Verify timeout handling with slow network

## Backward Compatibility

✅ Fully backward compatible - no breaking changes to component API
✅ Optional `isBlend` parameter in retry function (defaults to false)
✅ Existing code continues to work without modification
