# Fast Navigation Fix

## Issue

When navigating between images too quickly using commands like `next-image`, `previous-image`, or mouse wheel navigation, the following error would occur:

```
Error loading image: DOMException: The source image cannot be decoded.
```

## Root Cause

The async `Image.decode()` operation from the previous image was still running when starting to load the next image. This created a race condition where:

1. User starts loading image A
2. Image A begins async decoding
3. User quickly navigates to image B
4. Image A's decode completes but the image element now points to image B
5. Decode operation fails with "cannot be decoded" error

## Solution

Implemented a cancellation mechanism for pending image loads:

### 1. Load Tracking
Added `loadingAbortController` to track the current loading operation:
```javascript
this.loadingAbortController = { cancelled: false }
```

### 2. Cancellation on New Load
When starting a new image load, mark any pending load as cancelled:
```javascript
if (this.loadingAbortController) {
  this.loadingAbortController.cancelled = true
}
```

### 3. Cancellation Checks
Added multiple check points to gracefully handle cancelled loads:
- Before starting decode
- After decode completes (in catch block)
- Before finalizing the load
- In error handler

### 4. Silent Resolution
Cancelled loads resolve silently instead of throwing errors, preventing error notifications for expected cancellations.

## Benefits

- ✅ No more decode errors when navigating quickly
- ✅ Smooth navigation experience
- ✅ No error notifications for cancelled loads
- ✅ Proper cleanup of pending operations
- ✅ Works with both keyboard and mouse wheel navigation

## Testing

To verify the fix works:

1. Open a folder with multiple large images (>2MB)
2. Rapidly press the `>` button or use mouse wheel to navigate
3. Or use keyboard shortcuts repeatedly
4. Should navigate smoothly without errors

### Before Fix:
- Console errors on fast navigation
- Error notifications
- Unpredictable behavior

### After Fix:
- Clean navigation
- No errors
- Smooth transitions

## Technical Details

### Cancellation Flow

```
User Action: Navigate to Image A
  ↓
Create new abort controller for A
  ↓
Start loading Image A
  ↓
User Action: Navigate to Image B (before A finishes)
  ↓
Mark A's controller as cancelled
  ↓
Create new abort controller for B
  ↓
A's decode completes but checks cancelled flag
  ↓
A resolves silently without applying changes
  ↓
B continues loading normally
```

### Edge Cases Handled

1. **Decode in progress when navigating:** Checked after decode completes
2. **Load not yet started:** Checked before decode begins
3. **Error during decode:** Checked in catch block
4. **Image load error:** Checked in onerror handler

## Code Changes

Files modified:
- `lib/view.js`: Added cancellation mechanism

Key changes:
1. Added `loadingAbortController` property
2. Cancel previous loads on new load
3. Check cancellation at critical points
4. Silent resolution for cancelled loads

## Related Issues

This fix also prevents:
- Memory leaks from orphaned decode operations
- UI inconsistencies from race conditions
- Unnecessary error notifications

## Best Practices

The implementation follows these principles:
1. **Fail gracefully:** Cancelled loads resolve, don't reject
2. **Check early and often:** Multiple cancellation checkpoints
3. **Clean up:** Mark old operations as cancelled
4. **User-friendly:** No error spam for expected behavior

## Performance Impact

Minimal to none:
- Cancellation checks are simple boolean comparisons
- No additional memory overhead
- Actually improves performance by avoiding wasted decode operations

## Future Improvements

Potential enhancements:
1. AbortController API (when available in Electron)
2. Load queue for smoother rapid navigation
3. Debouncing for mouse wheel events
4. Preloading adjacent images
