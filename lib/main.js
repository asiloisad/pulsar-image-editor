const path = require("path");
const ImageEditor = require("./editor");
const { CompositeDisposable } = require("atom");

// Files with these extensions will be opened as images
const imageExtensions = [".bmp", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp"];

/**
 * Image Editor Package
 * Provides an image viewer for common image formats.
 * Supports zooming and panning.
 */
module.exports = {
  treeView: null,
  claudeChat: null,

  /**
   * Opens an image from a data URL in a new image editor tab.
   * This allows other packages to display images without saving to disk.
   * @param {string} dataUrl - The image data URL (e.g., "data:image/png;base64,...")
   * @param {string} [title="Untitled Image"] - The title for the editor tab
   * @returns {ImageEditor} The created image editor instance
   */
  openFromDataUrl(dataUrl, title = "Untitled Image") {
    const imageEditor = ImageEditor.fromDataUrl(dataUrl, title);
    atom.workspace
      .getActivePane()
      .activateItem(atom.workspace.getActivePane().addItem(imageEditor));
    return imageEditor;
  },

  /**
   * Provides the image-editor service for other packages.
   * @returns {Object} Service object with openFromDataUrl method
   */
  provideImageEditor() {
    return {
      openFromDataUrl: this.openFromDataUrl.bind(this),
    };
  },

  /**
   * Activates the package and registers the image file opener.
   */
  activate() {
    atom.packages.disablePackage("image-view");

    this.imageEditorStatusView = null;
    this.disposables = new CompositeDisposable();
    this.disposables.add(
      atom.workspace.addOpener((uri) => {
        const uriExtension = path.extname(uri).toLowerCase();
        if (imageExtensions.includes(uriExtension)) {
          return new ImageEditor(uri, this.treeView);
        }
      }),
      atom.workspace
        .getCenter()
        .onDidChangeActivePaneItem(() => this.attachImageEditorStatusView()),
      // Watch for file changes in project directories
      atom.project.onDidChangeFiles((events) => {
        this.handleFileSystemChanges(events);
      }),
    );
  },

  /**
   * Deactivates the package and disposes resources.
   */
  deactivate() {
    if (this.imageEditorStatusView) {
      this.imageEditorStatusView.destroy();
    }
    this.disposables.dispose();
  },

  /**
   * Consumes the status bar service for image dimension display.
   * @param {Object} statusBar - The status bar service object
   */
  consumeStatusBar(statusBar) {
    this.statusBar = statusBar;
    this.attachImageEditorStatusView();
  },

  /**
   * Consumes the tree-view service.
   * @param {Object} treeView - The tree-view service object
   * @returns {Object} The tree-view service
   */
  consumeTreeView(treeView) {
    this.treeView = treeView;
    return this.treeView;
  },

  /**
   * Consumes the claude-chat service.
   * @param {Object} claudeChat - The claude-chat service object
   */
  consumeClaudeChat(claudeChat) {
    this.claudeChat = claudeChat;
  },

  /**
   * Attaches the image editor status view to the status bar.
   */
  attachImageEditorStatusView() {
    if (this.imageEditorStatusView || this.statusBar === null) {
      return;
    }

    if (!(atom.workspace.getCenter().getActivePaneItem() instanceof ImageEditor)) {
      return;
    }

    const ImageEditorStatusView = require("./status");
    this.imageEditorStatusView = new ImageEditorStatusView(this.statusBar);
    this.imageEditorStatusView.attach();
  },

  /**
   * Deserializes an ImageEditor from saved state.
   * @param {Object} state - The serialized state
   * @returns {ImageEditor} The restored image editor
   */
  deserialize(state) {
    return ImageEditor.deserialize(state, this.treeView);
  },

  /**
   * Handles file system changes and invalidates file list caches in active image editors.
   * @param {Array} events - Array of file system change events
   */
  handleFileSystemChanges(events) {
    // Collect affected directories from image file events
    const affectedDirs = new Set();

    for (const event of events) {
      const ext = path.extname(event.path).toLowerCase();

      // Check if this is an image file
      if (imageExtensions.includes(ext)) {
        affectedDirs.add(path.dirname(event.path));
      }

      // For rename events, also check oldPath
      if (event.action === "renamed" && event.oldPath) {
        const oldExt = path.extname(event.oldPath).toLowerCase();
        if (imageExtensions.includes(oldExt)) {
          affectedDirs.add(path.dirname(event.oldPath));
        }
      }
    }

    // If no image file directories were affected, nothing to do
    if (affectedDirs.size === 0) {
      return;
    }

    // Get all active pane items
    const paneItems = atom.workspace.getPaneItems();

    // Find all ImageEditor instances and invalidate their caches if their directory is affected
    paneItems.forEach((item) => {
      if (item instanceof ImageEditor && item.view && item.view.navigator) {
        const navigator = item.view.navigator;
        const cache = navigator.fileListCache;

        // Invalidate file list cache if the cached directory matches an affected directory
        if (cache.directory && affectedDirs.has(cache.directory)) {
          navigator.invalidateCache();
        }
      }
    });
  },
};
