# image-editor

View and edit images directly in Pulsar. A feature-rich image viewer with support for cropping, rotation, color adjustments, filters, and more.

![view](https://github.com/asiloisad/pulsar-image-editor/blob/master/assets/view.png?raw=true)

## Features

- **Zoom & pan**: Zoom controls, keyboard shortcuts, and right-click drag to pan.
- **Image browsing**: Navigate between images in the same folder.
- **Transform tools**: Rotate, flip, resize, and crop images.
- **Color adjustments**: Brightness, contrast, saturation, hue, and auto-adjust.
- **Filters**: Blur, sharpen, grayscale, sepia, posterize, and invert.
- **Selection tools**: Create, resize, auto-select, and crop to selection.
- **SVG support**: View SVG images with automatic viewBox dimension handling (read-only).
- **Pending tab toggle**: Toggle the pending state of the editor tab.
- **Undo/redo**: Full history with viewport preservation.
- **Navigation panel**: Browse folder images via [navigation-panel](https://github.com/asiloisad/pulsar-navigation-panel).
- **API for packages**: Other packages can open images from data URLs without saving to disk. Used by [hydrogen-next](https://github.com/asiloisad/pulsar-hydrogen-next) to display plot outputs.

## Installation

To install `image-editor` search for [image-editor](https://web.pulsar-edit.dev/packages/image-editor) in the Install pane of the Pulsar settings or run `ppm install image-editor`. Alternatively, you can run `ppm install asiloisad/pulsar-image-editor` to install a package directly from the GitHub repository.

## Mouse controls

- **Left-click drag**: Create selection.
- **Right-click drag**: Pan image.
- **Mouse wheel**: Navigate to previous/next image (or zoom if `switchZoomAndNavigation` is disabled).
- **Ctrl + Mouse wheel**: Zoom in/out at cursor position (or navigate if `switchZoomAndNavigation` is disabled).

## Commands

Commands available in `.image-editor`:

- `image-editor:zoom-in`: <kbd>+</kbd> increase zoom level,
- `image-editor:zoom-out`: <kbd>-</kbd> decrease zoom level,
- `image-editor:reset-zoom`: <kbd>7</kbd> reset to 100%,
- `image-editor:zoom-to-fit`: <kbd>9</kbd> scale to fit viewport,
- `image-editor:center`: <kbd>8</kbd> center image in viewport,
- `image-editor:first-image`: <kbd>Home</kbd> go to first image in folder,
- `image-editor:previous-image`: <kbd>PageUp</kbd> go to previous image,
- `image-editor:next-image`: <kbd>PageDown</kbd> go to next image,
- `image-editor:last-image`: <kbd>End</kbd> go to last image in folder,
- `image-editor:reload`: refresh image from disk,
- `image-editor:background-white`: set white background,
- `image-editor:background-black`: set black background,
- `image-editor:background-transparent`: set transparent background,
- `image-editor:background-native`: set native background,
- `image-editor:rotate-90-cw`: <kbd>]</kbd> rotate 90° clockwise,
- `image-editor:rotate-90-ccw`: <kbd>[</kbd> rotate 90° counter-clockwise,
- `image-editor:rotate-180`: rotate 180°,
- `image-editor:rotate-free`: rotate by custom angle,
- `image-editor:flip-horizontal`: <kbd>H</kbd> flip horizontally,
- `image-editor:flip-vertical`: <kbd>V</kbd> flip vertically,
- `image-editor:resize`: resize with aspect ratio lock,
- `image-editor:auto-adjust-colors`: automatic color optimization,
- `image-editor:brightness-contrast`: adjust brightness and contrast,
- `image-editor:saturation`: adjust color intensity,
- `image-editor:hue-shift`: rotate color spectrum,
- `image-editor:grayscale`: <kbd>G</kbd> convert to black & white,
- `image-editor:invert-colors`: <kbd>I</kbd> permanently invert colors,
- `image-editor:sepia`: apply sepia effect,
- `image-editor:posterize`: reduce color levels,
- `image-editor:blur`: custom blur radius,
- `image-editor:blur-light`: light blur,
- `image-editor:blur-medium`: <kbd>B</kbd> medium blur,
- `image-editor:blur-strong`: strong blur,
- `image-editor:sharpen`: custom sharpen strength,
- `image-editor:sharpen-light`: light sharpen,
- `image-editor:sharpen-medium`: <kbd>S</kbd> medium sharpen,
- `image-editor:sharpen-strong`: strong sharpen,
- `image-editor:auto-select`: <kbd>A</kbd> auto-detect and select content,
- `image-editor:auto-select-with-border`: <kbd>Q</kbd> auto-select with border padding,
- `image-editor:select-all`: select entire image,
- `image-editor:select-visible-area`: <kbd>W</kbd> select visible portion,
- `image-editor:copy-selection`: <kbd>C</kbd> copy selection to clipboard,
- `image-editor:crop-to-selection`: <kbd>X</kbd> crop to selection,
- `image-editor:hide-selection`: <kbd>Escape</kbd> clear selection,
- `image-editor:edit-in-paint`: open in Windows Paint,
- `image-editor:show-properties`: view file and image info,
- `image-editor:undo`: <kbd>Z</kbd> revert to previous state,
- `image-editor:redo`: <kbd>Y</kbd> restore next state,
- `image-editor:attach-to-claude`: attach image to Claude chat.

## Provided Service `image-editor`

Allows other packages to open images directly from data URLs without saving to disk. Used by [hydrogen-next](https://web.pulsar-edit.dev/packages/hydrogen-next) to display plot outputs.

In your `package.json`:

```json
{
  "consumedServices": {
    "image-editor": {
      "versions": {
        "1.0.0": "consumeImageEditor"
      }
    }
  }
}
```

In your main module:

```javascript
module.exports = {
  imageEditor: null,

  consumeImageEditor(service) {
    this.imageEditor = service;
    return new Disposable(() => {
      this.imageEditor = null;
    });
  },

  openImage(dataUrl) {
    if (this.imageEditor) {
      this.imageEditor.openFromDataUrl(dataUrl, "My Image Title");
    }
  }
};
```

The opened image will be marked as "modified" and prompt the user to save when closing.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
