# image-editor

View and edit images directly in Pulsar. A feature-rich image viewer with support for cropping, rotation, color adjustments, filters, and more.

## Features

- **Zoom & pan**: Zoom controls, keyboard shortcuts, and right-click drag to pan.
- **Image browsing**: Navigate between images in the same folder.
- **Transform tools**: Rotate, flip, resize, and crop images.
- **Color adjustments**: Brightness, contrast, saturation, hue, and auto-adjust.
- **Filters**: Blur, sharpen, grayscale, sepia, posterize, and invert.
- **Selection tools**: Create, resize, auto-select, and crop to selection.
- **Undo/redo**: Full history with viewport preservation.
- **Navigation panel**: Browse folder images via [navigation-panel](https://github.com/asiloisad/pulsar-navigation-panel).

## Installation

To install `image-editor` search for [image-editor](https://web.pulsar-edit.dev/packages/image-editor) in the Install pane of the Pulsar settings or run `ppm install image-editor`. Alternatively, you can run `ppm install asiloisad/pulsar-image-editor` to install a package directly from the GitHub repository.

## Mouse controls

- **Left-click drag**: Create selection.
- **Right-click drag**: Pan image.
- **Mouse wheel**: Navigate to previous/next image.
- **Ctrl + Mouse wheel**: Zoom in/out at cursor position.

## Commands

Commands available in `.image-editor`:

- `image-editor:zoom-in`: (`+`) increase zoom level,
- `image-editor:zoom-out`: (`-`) decrease zoom level,
- `image-editor:reset-zoom`: (`7`) reset to 100%,
- `image-editor:zoom-to-fit`: (`9`) scale to fit viewport,
- `image-editor:center`: (`8`) center image in viewport,
- `image-editor:first-image`: (`Home`) go to first image in folder,
- `image-editor:previous-image`: (`PageUp`) go to previous image,
- `image-editor:next-image`: (`PageDown`) go to next image,
- `image-editor:last-image`: (`End`) go to last image in folder,
- `image-editor:reload`: refresh image from disk,
- `image-editor:background-white`: set white background,
- `image-editor:background-black`: set black background,
- `image-editor:background-transparent`: set transparent background,
- `image-editor:background-native`: set native background,
- `image-editor:rotate-90-cw`: (`]`) rotate 90° clockwise,
- `image-editor:rotate-90-ccw`: (`[`) rotate 90° counter-clockwise,
- `image-editor:rotate-180`: rotate 180°,
- `image-editor:rotate-free`: rotate by custom angle,
- `image-editor:flip-horizontal`: (`H`) flip horizontally,
- `image-editor:flip-vertical`: (`V`) flip vertically,
- `image-editor:resize`: resize with aspect ratio lock,
- `image-editor:auto-adjust-colors`: automatic color optimization,
- `image-editor:brightness-contrast`: adjust brightness and contrast,
- `image-editor:saturation`: adjust color intensity,
- `image-editor:hue-shift`: rotate color spectrum,
- `image-editor:grayscale`: (`G`) convert to black & white,
- `image-editor:invert-colors`: (`I`) permanently invert colors,
- `image-editor:sepia`: apply sepia effect,
- `image-editor:posterize`: reduce color levels,
- `image-editor:blur`: custom blur radius,
- `image-editor:blur-light`: light blur,
- `image-editor:blur-medium`: (`B`) medium blur,
- `image-editor:blur-strong`: strong blur,
- `image-editor:sharpen`: custom sharpen strength,
- `image-editor:sharpen-light`: light sharpen,
- `image-editor:sharpen-medium`: (`S`) medium sharpen,
- `image-editor:sharpen-strong`: strong sharpen,
- `image-editor:auto-select`: (`A`) auto-detect and select content,
- `image-editor:auto-select-with-border`: (`Q`) auto-select with border padding,
- `image-editor:select-all`: select entire image,
- `image-editor:select-visible-area`: (`W`) select visible portion,
- `image-editor:copy-selection`: (`C`) copy selection to clipboard,
- `image-editor:crop-to-selection`: (`X`) crop to selection,
- `image-editor:hide-selection`: (`Escape`) clear selection,
- `image-editor:move`: (`M`) move file to new location,
- `image-editor:duplicate`: (`D`) create copy of file,
- `image-editor:edit-in-paint`: open in Windows Paint,
- `image-editor:show-properties`: view file and image info,
- `image-editor:undo`: (`Z`) revert to previous state,
- `image-editor:redo`: (`Y`) restore next state,
- `image-editor:attach-to-claude`: attach image to Claude chat.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
