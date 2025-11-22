# Bug Fix: FileListCache Initialization

## Issue
The application was crashing on startup and navigation with these errors:
```
TypeError: Cannot read properties of undefined (reading 'directory')
at ImageEditorView.getFileList (view.js:819:30)
```

## Root Cause
The `fileListCache` object was not being initialized in the constructor, causing it to be `undefined` when accessed by navigation methods.

## Fix
Added proper initialization of `fileListCache` in the constructor:

```javascript
// File navigation cache
this.fileListCache = {
  directory: null,
  files: [],
  currentIndex: -1,
  extensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg']
}
```

## Location
**File:** `lib/view.js`
**Line:** ~46-52 (in constructor)

## Testing
1. Reload Pulsar (`Ctrl+Shift+F5`)
2. Open an image
3. Try navigating with arrow keys or mouse wheel
4. Should work without errors

## Status
✅ **FIXED** - Ready for testing!
