# Selection Transform Fix

## Problem
The selection box did not move or scale with the image when zooming or panning. This happened because selection coordinates were stored in viewport/container space rather than image space, so when the image transformed via CSS, the selection box stayed in its original position.

## Solution
Changed the selection coordinate system to use image space instead of viewport space. This way, the selection is always relative to the image itself, not the viewport.

## Key Changes

### 1. Coordinate Storage
**Before:**
```javascript
this.selectionStart = { x: 0, y: 0 }  // Viewport coordinates
this.selectionEnd = { x: 0, y: 0 }    // Viewport coordinates
```

**After:**
```javascript
this.selectionStartImg = { x: 0, y: 0 }  // Image space coordinates
this.selectionEndImg = { x: 0, y: 0 }    // Image space coordinates
```

### 2. Mouse Event Handlers
Updated to convert viewport coordinates to image space:

```javascript
// Convert viewport to image space
const viewportX = event.clientX - rect.left
const viewportY = event.clientY - rect.top
this.selectionStartImg = {
  x: (viewportX - this.translateX) / this.zoom,
  y: (viewportY - this.translateY) / this.zoom
}
```

### 3. Selection Box Rendering
The `updateSelectionBox()` method now converts from image space to viewport space:

```javascript
// Convert from image space to viewport space
const left = leftImg * this.zoom + this.translateX
const top = topImg * this.zoom + this.translateY
const width = widthImg * this.zoom
const height = heightImg * this.zoom
```

### 4. Transform Updates
Added selection box updates to:
- `updateTransform()` - Updates selection whenever zoom/pan changes
- Panning mouse movement - Updates selection during panning
- All zoom operations automatically trigger selection update

### 5. Updated Methods
All methods that used the old viewport-based coordinates now use image-based coordinates:
- `cropToSelection()`
- `copySelectionToClipboard()`
- `getSelectionArea()`
- Mouse event handlers

## Behavior
Now when you:
- **Zoom in/out**: Selection box scales with the image
- **Pan (right-click drag)**: Selection box moves with the image
- **Create selection**: Works at any zoom level
- **Crop/Copy**: Operates on the correct image area regardless of zoom/pan state

## Technical Details
The conversion between spaces:
- **Viewport → Image**: `(viewportCoord - translate) / zoom`
- **Image → Viewport**: `imageCoord * zoom + translate`

This ensures the selection always represents the same region of the actual image pixels, regardless of how the image is displayed in the viewport.
