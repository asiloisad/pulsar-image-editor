# Testing Checklist for Optimizations

## Quick Test (5 minutes)

### 1. Basic Loading
- [ ] Reload Pulsar (`Ctrl+Shift+F5`)
- [ ] Open an image >2MB
- [ ] Check console (F12) for: `"Loading large image: X MB"`
- [ ] Should load in <2 seconds
- [ ] Image should display correctly

### 2. Fast Navigation Test
- [ ] Have 3+ large images in a folder
- [ ] Click `>` button rapidly 5-10 times
- [ ] OR use mouse wheel to scroll through images quickly
- [ ] Check console - should see NO decode errors
- [ ] Images should switch smoothly

### 3. Settings Check
- [ ] Go to Settings → Packages → image-editor
- [ ] Verify new settings exist:
  - Large Image Threshold (default: 2)
  - Maximum History Size (default: 20)
- [ ] Try changing threshold to 1 MB
- [ ] Reload and test with 1.5MB image

## Full Test (15 minutes)

### 4. Memory Usage
- [ ] Open Task Manager / Activity Monitor
- [ ] Note current memory usage
- [ ] Open 5+ large images
- [ ] Apply filters to each
- [ ] Use undo/redo multiple times
- [ ] Memory should stay reasonable (<500MB increase)

### 5. Filters on Large Images
- [ ] Open 5MB+ image
- [ ] Select entire image or large area
- [ ] Apply blur filter
- [ ] Should see progress notification
- [ ] UI should remain responsive
- [ ] Filter should complete successfully

### 6. Undo/Redo Performance
- [ ] Open large image
- [ ] Apply 5+ different filters
- [ ] Undo 5 times (should be fast)
- [ ] Redo 5 times (should be fast)
- [ ] No memory spikes

### 7. Save Functionality
- [ ] Make edits to large image
- [ ] Save (Ctrl+S)
- [ ] Should save successfully
- [ ] Reload image - edits should persist

## Edge Cases (10 minutes)

### 8. Rapid Operations
- [ ] Open large image
- [ ] Rapidly apply multiple filters
- [ ] Should remain responsive
- [ ] All operations should complete

### 9. Mixed Image Sizes
- [ ] Navigate between small (<2MB) and large (>2MB) images
- [ ] Both should load correctly
- [ ] No errors in console

### 10. Long Session
- [ ] Keep editor open for 10+ minutes
- [ ] Navigate through many images
- [ ] Apply various filters
- [ ] Should remain stable
- [ ] No memory leaks

## Known Good Behavior

✅ **Loading large image:**
```
Loading large image: 5.2 MB
Image loaded in 1247ms (4000x3000)
```

✅ **Fast navigation:**
- No errors in console
- Smooth transitions
- Images load quickly

✅ **Memory usage:**
- Initial: ~100-200MB
- After 10 images: ~300-500MB
- Stable over time

## Red Flags

❌ **Decode errors:**
```
Error loading image: DOMException: The source image cannot be decoded.
```
**If you see this:** The fix didn't apply correctly, try full reload

❌ **Memory issues:**
- Memory growing beyond 1GB
- Memory not releasing after closing images

❌ **Performance issues:**
- Loading still taking >5 seconds for 5MB image
- UI freezing during operations

## If Tests Fail

1. **Full reload Pulsar:** Window → Reload (Ctrl+Shift+F5)
2. **Check console for errors:** Developer → Toggle Developer Tools
3. **Verify changes applied:** Check that view.js has the new code
4. **Test with fresh image:** Use a different large image
5. **Check system resources:** Ensure system isn't under heavy load

## Report Format

If issues found, report:
```
Issue: [Brief description]
Image size: [X MB]
Image dimensions: [W x H]
Error message: [If any]
Console output: [Copy relevant lines]
Steps to reproduce: [List steps]
System: [Windows/Mac/Linux]
Pulsar version: [Version]
```

## Success Criteria

All tests should pass:
- ✅ No decode errors during fast navigation
- ✅ Large images load in <3 seconds
- ✅ Memory usage stays under 500MB for typical use
- ✅ UI remains responsive during all operations
- ✅ All filters work correctly
- ✅ Undo/redo works smoothly

## After Testing

If all tests pass:
1. Commit changes with message from CHANGES.md
2. Update package version
3. Push to repository
4. Consider creating release notes

If tests fail:
1. Note which tests failed
2. Check console for errors
3. Review code changes
4. Test fixes
5. Repeat testing

---

**Estimated total testing time:** 30 minutes
**Minimum testing time:** 5 minutes (Quick Test only)

Happy testing! 🚀
