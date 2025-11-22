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
  }
}
