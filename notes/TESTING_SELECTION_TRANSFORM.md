# Testing Selection Transform Fix

## How to Test

### Test 1: Selection with Zoom
1. Open an image in the editor
2. Create a selection by dragging with left mouse button
3. Zoom in (Ctrl/Cmd + +)
4. **Expected**: Selection box should scale up with the image
5. Zoom out (Ctrl/Cmd + -)
6. **Expected**: Selection box should scale down with the image

### Test 2: Selection with Pan
1. Open an image
2. Zoom in to 200%
3. Create a selection
4. Pan the image by right-click dragging
5. **Expected**: Selection box should move with the image, staying on the same part of the image

### Test 3: Create Selection at Different Zooms
1. Open an image
2. Zoom to 50%
3. Create a selection around a specific feature
4. Zoom to 200%
5. **Expected**: Selection should still be around the same feature
6. Pan around
7. **Expected**: Selection moves with the feature

### Test 4: Crop with Transform
1. Open an image
2. Zoom to 150%
3. Pan to center an interesting part
4. Create a selection
5. Use Alt+C to crop
6. **Expected**: Cropped area should be exactly what was in the selection box

### Test 5: Copy with Transform
1. Open an image
2. Zoom to 200%
3. Create a selection
4. Copy (Ctrl/Cmd + C)
5. Paste into another application
6. **Expected**: Copied image should match what was visually selected

### Test 6: Blur with Transform
1. Open an image
2. Zoom and pan to a specific area
3. Create a selection
4. Apply blur (Alt+B)
5. **Expected**: Blur should be applied to the correct area of the image

## Edge Cases to Test

### Edge Case 1: Selection Across Zoom Levels
1. Zoom to 50%
2. Create selection
3. Zoom to 300%
4. Selection should still be valid and in correct position

### Edge Case 2: Very Small Selections
1. Zoom to 400%
2. Create a very small selection (few pixels)
3. Zoom out to 50%
4. Selection should still be visible (proportionally smaller)

### Edge Case 3: Selection at Image Edges
1. Create selection at the edge/corner of image
2. Zoom and pan
3. Selection should stay at the edge/corner

## What Should NOT Change
- Selection creation behavior (drag with left mouse button)
- Clearing selection (click outside)
- Keyboard shortcuts
- Menu commands
- Save/Save As functionality

## Known Behaviors
- Selection is cleared after operations like crop, rotate, flip (this is expected)
- Selection requires minimum drag distance to avoid accidental clicks
- Selection can only be created with left mouse button (right is for panning)
