const path = require("path");
const ImageEditor = require("./editor");
const { CompositeDisposable } = require("atom");

// Files with these extensions will be opened as images
const imageExtensions = [
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
];

/**
 * Image Editor Package
 * Provides an image viewer for common image formats.
 * Supports zooming, panning, and color inversion.
 */
module.exports = {
  treeView: null,
  claudeChat: null,

  /**
   * Activates the package and registers the image file opener.
   */
  activate() {
    atom.packages.disablePackage("image-view");

    this.styleSheet = document.createElement("style");
    document.head.appendChild(this.styleSheet);

    this.imageEditorStatusView = null;
    this.disposables = new CompositeDisposable();
    this.disposables.add(
      atom.workspace.addOpener((uri) => {
        const uriExtension = path.extname(uri).toLowerCase();
        if (imageExtensions.includes(uriExtension)) {
          return new ImageEditor(uri, this.treeView);
        }
      }),
      atom.commands.add("atom-workspace", {
        "image-editor:reverse-colors": () => this.toggleReverseColors(),
        "image-editor:attach-to-claude": () => this.attachToClaudeChat(),
      }),
      atom.workspace
        .getCenter()
        .onDidChangeActivePaneItem(() => this.attachImageEditorStatusView()),
      atom.config.observe("image-editor.reverseColors", (value) => {
        if (value) {
          this.styleSheet.textContent =
            ".image-container img { filter: invert(100%); }";
        } else {
          this.styleSheet.textContent =
            ".image-container img { filter: invert(0%); }";
        }
      }),
      // Watch for file changes in project directories
      atom.project.onDidChangeFiles((events) => {
        this.handleFileSystemChanges(events);
      })
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
   * Attaches the current image file to claude-chat.
   */
  attachToClaudeChat() {
    if (!this.claudeChat) {
      atom.notifications.addWarning("Claude Chat is not available");
      return;
    }
    const editor = atom.workspace.getCenter().getActivePaneItem();
    if (!(editor instanceof ImageEditor)) {
      return;
    }
    const filePath = editor.getPath();
    if (!filePath) {
      return;
    }
    const [projectPath, relativePath] = atom.project.relativizePath(filePath);
    const context = {
      type: "image",
      paths: [relativePath || filePath],
      label: path.basename(filePath),
      icon: "file-media",
    };
    const view = editor.view;
    if (view && view.selectionVisible) {
      const x1 = Math.round(Math.min(view.selectionStartImg.x, view.selectionEndImg.x));
      const y1 = Math.round(Math.min(view.selectionStartImg.y, view.selectionEndImg.y));
      const x2 = Math.round(Math.max(view.selectionStartImg.x, view.selectionEndImg.x));
      const y2 = Math.round(Math.max(view.selectionStartImg.y, view.selectionEndImg.y));
      if (x2 > x1 && y2 > y1) {
        context.selection = { x1, y1, x2, y2 };
        context.label += ` [${x1},${y1} - ${x2},${y2}]`;
      }
    }
    this.claudeChat.setAttachContext(context);
  },

  /**
   * Attaches the image editor status view to the status bar.
   */
  attachImageEditorStatusView() {
    if (this.imageEditorStatusView || this.statusBar === null) {
      return;
    }

    if (
      !(atom.workspace.getCenter().getActivePaneItem() instanceof ImageEditor)
    ) {
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
   * Toggles the reverse colors filter on/off.
   */
  toggleReverseColors() {
    atom.config.set(
      "image-editor.reverseColors",
      !atom.config.get("image-editor.reverseColors")
    );
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
      if (item instanceof ImageEditor && item.view && item.view.fileListCache) {
        const cache = item.view.fileListCache;

        // Only invalidate if the cached directory matches an affected directory
        if (cache.directory && affectedDirs.has(cache.directory)) {
          cache.directory = null;
          cache.files = [];
          cache.currentIndex = -1;
        }
      }
    });
  },
};
