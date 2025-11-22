# Testing Guide: Selection Resize and Move

## Quick Test Checklist

### Basic Resize Operations
- [ ] **Corner Resize (NW)** - Drag top-left corner, opposite corner stays fixed
- [ ] **Corner Resize (NE)** - Drag top-right corner
- [ ] **Corner Resize (SE)** - Drag bottom-right corner
- [ ] **Corner Resize (SW)** - Drag bottom-left corner
- [ ] **Edge Resize (N)** - Drag top edge, width stays same
- [ ] **Edge Resize (E)** - Drag right edge, height stays same
- [ ] **Edge Resize (S)** - Drag bottom edge
- [ ] **Edge Resize (W)** - Drag left edge

### Basic Move Operations
- [ ] **Move Center** - Click inside selection, drag to new position
- [ ] **Move to Corner** - Move selection to image corner
- [ ] **Move While Zoomed** - Zoom to 200%, move selection
- [ ] **Move While Panned** - Pan image, move selection

### Combined Operations
- [ ] **Resize then Move** - Resize selection, then move it
- [ ] **Move then Resize** - Move selection, then resize it
- [ ] **Create, Resize, Move, Crop** - Full workflow

### Edge Cases
- [ ] **Resize Past Opposite Edge** - Drag handle past opposite corner
  - Expected: Selection inverts and normalizes correctly
- [ ] **Very Small Resize** - Resize to just a few pixels
  - Expected: Should work, minimum size check on release
- [ ] **Resize at 400% Zoom** - Zoom way in and resize
  - Expected: Smooth operation, handles visible
- [ ] **Move Partially Off Image** - Move selection so part is outside
  - Expected: Allowed, can still see and manipulate
- [ ] **Resize During Pan** - Try to resize while image is moving
  - Expected: Resize doesn't work during pan

### Visual Feedback
- [ ] **Cursor Changes on Handles** - Each handle shows correct cursor
  - NW/SE: nw-resize / se-resize (diagonal)
  - N/S: n-resize / s-resize (vertical)
  - NE/SW: ne-resize / sw-resize (diagonal)
  - E/W: e-resize / w-resize (horizontal)
- [ ] **Move Cursor** - Cursor shows "move" when inside selection
- [ ] **Handle Visibility** - Handles visible at all zoom levels
- [ ] **Handle Clickability** - Handles are easy to grab (8x8px)

### Click Detection
- [ ] **Click Inside Selection** - Starts move (doesn't create new)
- [ ] **Click On Handle** - Starts resize (doesn't create new)
- [ ] **Click Outside Selection** - Clears old, creates new
- [ ] **Click Outside Then Inside** - Can create, then move

### Integration with Existing Features
- [ ] **Crop After Resize** - Resize selection, then crop
  - Expected: Crops exactly what's selected
- [ ] **Blur After Move** - Move selection, then blur
  - Expected: Blurs correct area
- [ ] **Copy After Resize** - Resize, then copy to clipboard
  - Expected: Copies resized area
- [ ] **Undo After Resize** - Resize selection, apply effect, undo
  - Expected: Undo works on effect, selection cleared

### Zoom and Pan Integration
- [ ] **Resize While Zoomed In** - At 300% zoom, resize selection
  - Expected: Selection resizes smoothly
- [ ] **Resize While Zoomed Out** - At 50% zoom, resize selection
  - Expected: Handles still grabbable and visible
- [ ] **Pan After Creating Selection** - Create selection, then pan image
  - Expected: Selection moves with image
- [ ] **Zoom After Creating Selection** - Create selection, then zoom
  - Expected: Selection scales with image

### Performance
- [ ] **Smooth Resize** - No lag when dragging handles
- [ ] **Smooth Move** - No lag when dragging selection
- [ ] **Multiple Resizes** - Resize many times in succession
  - Expected: Stays responsive
- [ ] **Large Image** - Test with 4K+ image
  - Expected: Operations still smooth

## Step-by-Step Test Scenarios

### Scenario 1: Precise Crop Workflow
1. Open image
2. Zoom to 150%
3. Create initial selection around subject
4. Grab SE corner, resize to fine-tune bottom-right
5. Grab N edge, adjust top edge
6. Click inside selection, move to better position
7. Grab W edge, adjust left edge
8. Crop (Alt+C)
9. **Expected**: Perfect crop of subject

### Scenario 2: Multi-Area Blur
1. Open image
2. Create selection around first area
3. Resize to exact size needed
4. Apply blur (Alt+B)
5. Click outside to create new selection
6. Resize and move new selection to second area
7. Apply blur again
8. **Expected**: Two separate blurred areas

### Scenario 3: Copy Precise Region
1. Open image
2. Zoom to 200% on detail area
3. Create selection
4. Grab corner handles to resize precisely
5. Move selection to center exact detail
6. Copy (Ctrl+C)
7. **Expected**: Clipboard has exact detail at full resolution

### Scenario 4: Handle Inverted Resize
1. Create selection (e.g., 100x100px area)
2. Grab SE corner handle
3. Drag it past NW corner (invert selection)
4. Release mouse
5. **Expected**: Selection normalizes, still usable
6. Resize again from new orientation
7. **Expected**: Works correctly

## Known Limitations (Expected Behavior)
- Selection can move partially or completely off image (by design)
- No snap-to-grid or constraint features (future enhancement)
- No keyboard nudging yet (future enhancement)
- No aspect ratio lock (future enhancement)
- Handles might be small at very low zoom levels

## Bug Indicators (Should NOT Happen)
- ❌ Selection disappears when resizing
- ❌ Handles not clickable
- ❌ Selection jumps to wrong position when moving
- ❌ Resize doesn't update visual box
- ❌ Clicking handle creates new selection
- ❌ Clicking inside selection creates new selection
- ❌ Selection doesn't follow image when panning
- ❌ Selection doesn't scale when zooming
- ❌ Crop/blur/copy affects wrong area after resize/move
- ❌ Console errors when resizing or moving

## Success Criteria
All checkboxes above should pass, and:
1. Resize feels smooth and natural
2. Move feels intuitive
3. Handles are easy to grab
4. Visual feedback is clear
5. Integration with crop/blur/copy works perfectly
6. No performance issues
7. Works at any zoom level
