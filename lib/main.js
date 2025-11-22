const path = require('path')
const ImageViewer = require('./image-viewer')
const {CompositeDisposable} = require('atom')

// Files with these extensions will be opened as images
const imageExtensions = ['.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp']

module.exports = {
  activate () {
    this.imageEditorStatusView = null
    this.disposables = new CompositeDisposable()
    this.disposables.add(atom.workspace.addOpener(uri => {
      const uriExtension = path.extname(uri).toLowerCase()
      if (imageExtensions.includes(uriExtension)) {
        return new ImageViewer(uri)
      }
    }))
    this.disposables.add(atom.workspace.getCenter().onDidChangeActivePaneItem(() => this.attachImageViewerStatusView()))
  },

  deactivate () {
    if (this.imageEditorStatusView) {
      this.imageEditorStatusView.destroy()
    }
    this.disposables.dispose()
  },

  consumeStatusBar (statusBar) {
    this.statusBar = statusBar
    this.attachImageViewerStatusView()
  },

  attachImageViewerStatusView () {
    if (this.imageEditorStatusView || this.statusBar == null) {
      return
    }

    if (!(atom.workspace.getCenter().getActivePaneItem() instanceof ImageViewer)) {
      return
    }

    const ImageViewerStatusView = require('./image-viewer-status-view')
    this.imageEditorStatusView = new ImageViewerStatusView(this.statusBar)
    this.imageEditorStatusView.attach()
  },

  deserialize (state) {
    return ImageViewer.deserialize(state)
  }
}
