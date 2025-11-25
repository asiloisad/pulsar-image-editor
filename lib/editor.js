const path = require('path')
const fs = require('fs')
const { Emitter, File, CompositeDisposable } = require('atom')
const ImageEditorView = require('./view')

module.exports = class ImageEditor {
  static deserialize({ filePath }, treeView) {
    let fileStats;
    try {
      fileStats = fs.statSync(filePath);
    } catch (e) { }
    if (fileStats?.isFile()) {
      return new ImageEditor(filePath, treeView)
    } else {
      console.warn(`Could not deserialize image editor for path '${filePath}' because that file no longer exists`)
    }
  }

  constructor(filePath, treeView) {
    this.file = new File(filePath)
    this.treeView = treeView
    this.subscriptions = new CompositeDisposable()
    this.fileSubscriptions = new CompositeDisposable()
    this.emitter = new Emitter()
    this.handleFileEvents()
  }

  handleFileEvents() {
    this.fileSubscriptions.add(this.file.onDidDelete(() => {
      const currentPath = this.getPath()
      const pane = atom.workspace.paneForURI(currentPath)
      try {
        pane.destroyItem(pane.itemForURI(currentPath))
      } catch (e) {
        console.warn(`Could not destroy pane after external file was deleted: ${e}`)
      }
      this.destroy()
    }))

    this.fileSubscriptions.add(this.file.onDidRename(() => {
      this.emitter.emit('did-change-title')
    }))

    this.fileSubscriptions.add(this.file.onDidChange(() => {
      this.emitter.emit('did-change')
    }))
  }

  copy() {
    return new ImageEditor(this.getPath(), this.treeView)
  }

  get element() {
    return (this.view && this.view.element) || document.createElement('div')
  }

  get view() {
    if (!this.editorView) {
      try {
        this.editorView = new ImageEditorView(this)
      } catch (e) {
        console.warn(`Could not create ImageEditorView. This can be intentional in the event of an image file being deleted by an external program.`)
        return
      }
    }
    return this.editorView
  }

  serialize() {
    return { filePath: this.getPath(), deserializer: this.constructor.name }
  }

  terminatePendingState() {
    if (this.isEqual(atom.workspace.getCenter().getActivePane().getPendingItem())) {
      this.emitter.emit('did-terminate-pending-state')
    }
  }

  onDidTerminatePendingState(callback) {
    return this.emitter.on('did-terminate-pending-state', callback)
  }

  // Register a callback for when the image file changes
  onDidChange(callback) {
    return this.emitter.on('did-change', callback)
  }

  // Register a callback for when the image's title changes
  onDidChangeTitle(callback) {
    return this.emitter.on('did-change-title', callback)
  }

  // Register a callback for when the modification state changes
  onDidChangeModified(callback) {
    return this.emitter.on('did-change-modified', callback)
  }

  onDidReplaceFile(callback) {
    return this.emitter.on('did-replace-file', callback)
  }

  // Returns true if the image has been modified (history has edits)
  isModified() {
    return this.view ? this.view.isModified() : false
  }

  load(filePath) {
    this.fileSubscriptions.dispose()
    this.fileSubscriptions = new CompositeDisposable()
    this.file = new File(filePath)
    this.handleFileEvents()
    this.emitter.emit('did-replace-file')
    this.emitter.emit('did-change-title')
  }

  destroy() {
    this.subscriptions.dispose()
    this.fileSubscriptions.dispose()
    if (this.view) {
      this.view.destroy()
    }
    this.emitter.emit('did-destroy')
  }

  getAllowedLocations() {
    return ['center']
  }

  // Retrieves the filename of the open file.
  //
  // This is `'untitled'` if the file is new and not saved to the disk.
  //
  // Returns a {String}.
  getTitle() {
    const filePath = this.getPath()
    if (filePath) {
      return path.basename(filePath)
    } else {
      return 'untitled'
    }
  }

  // Retrieves the absolute path to the image.
  //
  // Returns a {String} path.
  getPath() {
    return this.file.getPath()
  }

  // Retrieves the URI of the image.
  //
  // Returns a {String}.
  getURI() {
    return this.getPath()
  }

  // Retrieves the encoded URI of the image.
  //
  // Returns a {String}.
  getEncodedURI() {
    return `file://${encodeURI(this.getPath().replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F')}`
  }

  // Compares two {ImageEditor}s to determine equality.
  //
  // Equality is based on the condition that the two URIs are the same.
  //
  // Returns a {Boolean}.
  isEqual(other) {
    return other instanceof ImageEditor && (this.getURI() === other.getURI())
  }

  // Essential: Invoke the given callback when the editor is destroyed.
  //
  // * `callback` {Function} to be called when the editor is destroyed.
  //
  // Returns a {Disposable} on which `.dispose()` can be called to unsubscribe.
  onDidDestroy(callback) {
    return this.emitter.on('did-destroy', callback)
  }
}
