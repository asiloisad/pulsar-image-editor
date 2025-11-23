const path = require('path')
const ImageEditor = require('./editor')
const { CompositeDisposable } = require('atom')

// Files with these extensions will be opened as images
const imageExtensions = ['.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp']

module.exports = {
  treeView: null,
  
  activate() {
    atom.packages.disablePackage('image-view')

    this.styleSheet = document.createElement("style")
    document.head.appendChild(this.styleSheet)

    this.imageEditorStatusView = null
    this.disposables = new CompositeDisposable()
    this.disposables.add(
      atom.workspace.addOpener(uri => {
        const uriExtension = path.extname(uri).toLowerCase()
        if (imageExtensions.includes(uriExtension)) {
          return new ImageEditor(uri, this.treeView)
        }
      }),
      atom.commands.add('atom-workspace', {
        'image-editor:reverse-colors': () => this.toggleReverseColors(),
      }),
      atom.workspace.getCenter().onDidChangeActivePaneItem(
        () => this.attachImageEditorStatusView()
      ),
      atom.config.observe('image-editor.reverseColors', (value) => {
        if (value) {
          this.styleSheet.textContent = '.image-container img { filter: invert(100%); }'
        } else {
          this.styleSheet.textContent = '.image-container img { filter: invert(0%); }'
        }
      }),
      // Watch for file changes in project directories
      atom.project.onDidChangeFiles(events => {
        this.handleFileSystemChanges(events)
      })
    )
  },

  deactivate() {
    if (this.imageEditorStatusView) {
      this.imageEditorStatusView.destroy()
    }
    this.disposables.dispose()
  },

  consumeStatusBar(statusBar) {
    this.statusBar = statusBar
    this.attachImageEditorStatusView()
  },

  consumeTreeView(treeView) {
    this.treeView = treeView
    return this.treeView
  },

  attachImageEditorStatusView() {
    if (this.imageEditorStatusView || this.statusBar == null) {
      return
    }

    if (!(atom.workspace.getCenter().getActivePaneItem() instanceof ImageEditor)) {
      return
    }

    const ImageEditorStatusView = require('./status')
    this.imageEditorStatusView = new ImageEditorStatusView(this.statusBar)
    this.imageEditorStatusView.attach()
  },

  deserialize(state) {
    return ImageEditor.deserialize(state, this.treeView)
  },

  toggleReverseColors() {
    atom.config.set('image-editor.reverseColors', !atom.config.get('image-editor.reverseColors'))
  },

  /**
   * Handle file system changes and invalidate file list caches in active image editors
   */
  handleFileSystemChanges(events) {
    // Collect affected directories from image file events
    const affectedDirs = new Set()
    
    for (const event of events) {
      const ext = path.extname(event.path).toLowerCase()
      
      // Check if this is an image file
      if (imageExtensions.includes(ext)) {
        affectedDirs.add(path.dirname(event.path))
      }
      
      // For rename events, also check oldPath
      if (event.action === 'renamed' && event.oldPath) {
        const oldExt = path.extname(event.oldPath).toLowerCase()
        if (imageExtensions.includes(oldExt)) {
          affectedDirs.add(path.dirname(event.oldPath))
        }
      }
    }

    // If no image file directories were affected, nothing to do
    if (affectedDirs.size === 0) {
      return
    }

    // Get all active pane items
    const paneItems = atom.workspace.getPaneItems()
    
    // Find all ImageEditor instances and invalidate their caches if their directory is affected
    paneItems.forEach(item => {
      if (item instanceof ImageEditor && item.view && item.view.fileListCache) {
        const cache = item.view.fileListCache
        
        // Only invalidate if the cached directory matches an affected directory
        if (cache.directory && affectedDirs.has(cache.directory)) {
          cache.directory = null
          cache.files = []
          cache.currentIndex = -1
        }
      }
    })
  }
}
