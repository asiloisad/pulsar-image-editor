const fs = require('fs')
const path = require('path')
const { Emitter, CompositeDisposable, Disposable } = require('atom')
const etch = require('etch')
const $ = etch.dom

module.exports =
  class ImageEditorView {
    constructor(editor) {
      this.editor = editor
      this.emitter = new Emitter()
      this.disposables = new CompositeDisposable()
      this.imageSize = fs.statSync(this.editor.getPath()).size
      this.loaded = false
      this.levels = [0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2, 3, 4, 5, 7.5, 10]
      this.zoom = 1.00; this.step = null; this.auto = false
      this.translateX = 0
      this.translateY = 0
      this.panning = false
      this.selecting = false
      this.resizing = false
      this.resizeHandle = null // Which handle is being dragged: nw, n, ne, e, se, s, sw, w
      this.moving = false
      this.moveStartMouse = { x: 0, y: 0 }
      this.moveStartSelection = { x1: 0, y1: 0, x2: 0, y2: 0 }
      // Store selection in image space (not viewport space)
      this.selectionStartImg = { x: 0, y: 0 }
      this.selectionEndImg = { x: 0, y: 0 }
      this.isSaving = false

      // Undo/Redo history
      this.history = []
      this.historyIndex = -1
      this.maxHistorySize = 20

      etch.initialize(this)

      this.defaultBackgroundColor = atom.config.get('image-editor.defaultBackgroundColor')
      this.refs.imageContainer.setAttribute('background', this.defaultBackgroundColor)

      this.refs.image.style.display = 'none'
      this.updateImageURI()

      this.updateImageURI()

      this.disposables.add(this.editor.onDidReplaceFile(() => this.updateImageURI()))
      this.disposables.add(this.editor.onDidChange(() => this.updateImageURI()))
      this.disposables.add(atom.commands.add(this.element, {
        'image-editor:reload': () => this.updateImageURI(),
        'image-editor:zoom-in': () => this.zoomIn(),
        'image-editor:zoom-out': () => this.zoomOut(),
        'image-editor:reset-zoom': () => this.resetZoom(),
        'image-editor:zoom-to-fit': () => this.zoomToFit(),
        'image-editor:zoom-to-100': () => this.zoomTo100(),
        'image-editor:center': () => this.centerImage(),
        'image-editor:next-image': () => this.nextImage(),
        'image-editor:previous-image': () => this.previousImage(),
        'core:move-up': () => this.scrollUp(),
        'core:move-down': () => this.scrollDown(),
        'core:move-left': () => this.scrollLeft(),
        'core:move-right': () => this.scrollRight(),
        'core:page-up': () => this.pageUp(),
        'core:page-down': () => this.pageDown(),
        'core:move-to-top': () => this.scrollToTop(),
        'core:move-to-bottom': () => this.scrollToBottom(),
        'image-editor:crop-to-selection': () => this.cropToSelection(),
        'image-editor:save': () => this.save(),
        'image-editor:save-image': () => this.saveImage(),
        'image-editor:blur-light': () => this.blurImage(6),
        'image-editor:blur-medium': () => this.blurImage(12),
        'image-editor:blur-strong': () => this.blurImage(20),
        'image-editor:rotate-90-cw': () => this.rotate(90),
        'image-editor:rotate-90-ccw': () => this.rotate(-90),
        'image-editor:rotate-180': () => this.rotate(180),
        'image-editor:flip-horizontal': () => this.flipHorizontal(),
        'image-editor:flip-vertical': () => this.flipVertical(),
        'image-editor:grayscale': () => this.applyGrayscale(),
        'image-editor:invert-colors': () => this.invertColors(),
        'image-editor:sepia': () => this.applySepia(),
        'image-editor:sharpen-light': () => this.sharpenImage(0.5),
        'image-editor:sharpen-medium': () => this.sharpenImage(1.0),
        'image-editor:sharpen-strong': () => this.sharpenImage(1.5),
        'image-editor:brightness-contrast': () => this.showBrightnessContrastDialog(),
        'image-editor:saturation': () => this.showSaturationDialog(),
        'image-editor:hue-shift': () => this.showHueShiftDialog(),
        'image-editor:posterize': () => this.showPosterizeDialog(),
        'image-editor:copy-selection': () => this.copySelectionToClipboard(),
        'image-editor:undo': () => this.undo(),
        'image-editor:redo': () => this.redo()
      }))

      this.disposables.add(atom.tooltips.add(this.refs.whiteTransparentBackgroundButton, { title: 'Use white transparent background' }))
      this.disposables.add(atom.tooltips.add(this.refs.blackTransparentBackgroundButton, { title: 'Use black transparent background' }))
      this.disposables.add(atom.tooltips.add(this.refs.transparentTransparentBackgroundButton, { title: 'Use transparent background' }))
      this.disposables.add(atom.tooltips.add(this.refs.nativeBackgroundButton, { title: 'Use native background' }))

      const clickHandler = (event) => {
        event.preventDefault()
        event.stopPropagation()
        this.changeBackground(event.target.value)
      }

      this.refs.whiteTransparentBackgroundButton.addEventListener('click', clickHandler)
      this.disposables.add(new Disposable(() => { this.refs.whiteTransparentBackgroundButton.removeEventListener('click', clickHandler) }))
      this.refs.blackTransparentBackgroundButton.addEventListener('click', clickHandler)
      this.disposables.add(new Disposable(() => { this.refs.blackTransparentBackgroundButton.removeEventListener('click', clickHandler) }))
      this.refs.transparentTransparentBackgroundButton.addEventListener('click', clickHandler)
      this.disposables.add(new Disposable(() => { this.refs.transparentTransparentBackgroundButton.removeEventListener('click', clickHandler) }))
      this.refs.nativeBackgroundButton.addEventListener('click', clickHandler)
      this.disposables.add(new Disposable(() => { this.refs.nativeBackgroundButton.removeEventListener('click', clickHandler) }))

      const zoomInClickHandler = () => {
        this.zoomIn()
      }
      this.refs.zoomInButton.addEventListener('click', zoomInClickHandler)
      this.disposables.add(new Disposable(() => { this.refs.zoomInButton.removeEventListener('click', zoomInClickHandler) }))

      const zoomOutClickHandler = () => {
        this.zoomOut()
      }
      this.refs.zoomOutButton.addEventListener('click', zoomOutClickHandler)
      this.disposables.add(new Disposable(() => { this.refs.zoomOutButton.removeEventListener('click', zoomOutClickHandler) }))

      const resetZoomClickHandler = () => {
        this.resetZoom()
      }
      this.refs.resetZoomButton.addEventListener('click', resetZoomClickHandler)
      this.disposables.add(new Disposable(() => { this.refs.resetZoomButton.removeEventListener('click', resetZoomClickHandler) }))

      const prevImageClickHandler = () => {
        this.previousImage()
      }
      this.refs.prevImageButton.addEventListener('click', prevImageClickHandler)
      this.disposables.add(new Disposable(() => { this.refs.prevImageButton.removeEventListener('click', prevImageClickHandler) }))

      const nextImageClickHandler = () => {
        this.nextImage()
      }
      this.refs.nextImageButton.addEventListener('click', nextImageClickHandler)
      this.disposables.add(new Disposable(() => { this.refs.nextImageButton.removeEventListener('click', nextImageClickHandler) }))

      const centerClickHandler = () => {
        this.centerImage()
      }
      this.refs.centerButton.addEventListener('click', centerClickHandler)
      this.disposables.add(new Disposable(() => { this.refs.centerButton.removeEventListener('click', centerClickHandler) }))

      const zoomToFitClickHandler = () => {
        this.zoomToFit()
      }
      this.refs.zoomToFitButton.addEventListener('click', zoomToFitClickHandler)
      this.disposables.add(new Disposable(() => { this.refs.zoomToFitButton.removeEventListener('click', zoomToFitClickHandler) }))

      const zoomTo100ClickHandler = () => {
        this.zoomTo100()
      }
      this.refs.zoomTo100Button.addEventListener('click', zoomTo100ClickHandler)
      this.disposables.add(new Disposable(() => { this.refs.zoomTo100Button.removeEventListener('click', zoomTo100ClickHandler) }))

      const wheelContainerHandler = (event) => {
        if (event.ctrlKey) {
          event.stopPropagation()
          const factor = event.wheelDeltaY > 0 ? 1.2 / 1 : 1 / 1.2
          this.zoomToMousePosition(factor * this.zoom, event)
        } else {
          const now = Date.now()
          if (this.lastScrollTime && now - this.lastScrollTime < 150) return
          this.lastScrollTime = now

          if (event.wheelDeltaY < 0) {
            this.nextImage()
          } else if (event.wheelDeltaY > 0) {
            this.previousImage()
          }
        }
      }
      this.refs.imageContainer.addEventListener('wheel', wheelContainerHandler)
      this.disposables.add(new Disposable(() => { this.refs.imageContainer.removeEventListener('wheel', wheelContainerHandler) }))

      this.resizeObserver = new ResizeObserver(() => {
        if (this.auto === 1) {
          this.zoomTo100()
        } else if (this.auto) {
          this.zoomToFit()
        }
      })
      this.resizeObserver.observe(this.refs.imageContainer)

      this.mouseMoveHandler = (event) => {
        if (this.panning) {
          this.panDistance += Math.abs(event.movementX) + Math.abs(event.movementY)
          if (this.panDistance > 5) {
            this.panMoved = true
          }
          this.translateX += event.movementX
          this.translateY += event.movementY
          this.updateTransform()
          // Update selection box position if there's an active selection
          if (this.refs.selectionBox.style.display === 'block') {
            this.updateSelectionBox()
          }
        } else if (this.moving) {
          const rect = this.refs.imageContainer.getBoundingClientRect()
          const viewportX = event.clientX - rect.left
          const viewportY = event.clientY - rect.top
          const imgX = (viewportX - this.translateX) / this.zoom
          const imgY = (viewportY - this.translateY) / this.zoom

          // Calculate delta in image space
          const deltaX = imgX - this.moveStartMouse.x
          const deltaY = imgY - this.moveStartMouse.y

          // Update selection position
          this.selectionStartImg.x = this.moveStartSelection.x1 + deltaX
          this.selectionStartImg.y = this.moveStartSelection.y1 + deltaY
          this.selectionEndImg.x = this.moveStartSelection.x2 + deltaX
          this.selectionEndImg.y = this.moveStartSelection.y2 + deltaY

          this.updateSelectionBox()
        } else if (this.resizing) {
          const rect = this.refs.imageContainer.getBoundingClientRect()
          // Convert viewport coordinates to image space
          const viewportX = event.clientX - rect.left
          const viewportY = event.clientY - rect.top
          const imgX = (viewportX - this.translateX) / this.zoom
          const imgY = (viewportY - this.translateY) / this.zoom

          // Update the appropriate corner/edge based on which handle is being dragged
          const handle = this.resizeHandle

          // Determine which coordinates to update based on handle
          if (handle.includes('n')) {
            this.selectionStartImg.y = imgY
          }
          if (handle.includes('s')) {
            this.selectionEndImg.y = imgY
          }
          if (handle.includes('w')) {
            this.selectionStartImg.x = imgX
          }
          if (handle.includes('e')) {
            this.selectionEndImg.x = imgX
          }

          this.updateSelectionBox()
        } else if (this.selecting) {
          const rect = this.refs.imageContainer.getBoundingClientRect()
          // Convert viewport coordinates to image space
          const viewportX = event.clientX - rect.left
          const viewportY = event.clientY - rect.top
          this.selectionEndImg = {
            x: (viewportX - this.translateX) / this.zoom,
            y: (viewportY - this.translateY) / this.zoom
          }
          this.updateSelectionBox()
        }
      }
      this.mouseDownHandler = (event) => {
        if (event.button === 2) { // Right click
          this.panning = true
          this.panMoved = false
          this.panDistance = 0
          this.refs.imageContainer.classList.add('grabbing')
          this.refs.imageContainer.style.cursor = 'grab'
        } else if (event.button === 0) { // Left click
          // Don't start new selection if clicking on a resize handle
          if (event.target.classList.contains('selection-handle')) {
            return
          }

          // Check if clicking inside existing selection
          const hasSelection = this.refs.selectionBox.style.display === 'block'
          if (hasSelection) {
            const rect = this.refs.imageContainer.getBoundingClientRect()
            const viewportX = event.clientX - rect.left
            const viewportY = event.clientY - rect.top
            const imgX = (viewportX - this.translateX) / this.zoom
            const imgY = (viewportY - this.translateY) / this.zoom

            const minX = Math.min(this.selectionStartImg.x, this.selectionEndImg.x)
            const maxX = Math.max(this.selectionStartImg.x, this.selectionEndImg.x)
            const minY = Math.min(this.selectionStartImg.y, this.selectionEndImg.y)
            const maxY = Math.max(this.selectionStartImg.y, this.selectionEndImg.y)

            // If clicking inside selection, start moving it
            if (imgX >= minX && imgX <= maxX && imgY >= minY && imgY <= maxY) {
              this.moving = true
              this.moveStartMouse = { x: imgX, y: imgY }
              this.moveStartSelection = {
                x1: this.selectionStartImg.x,
                y1: this.selectionStartImg.y,
                x2: this.selectionEndImg.x,
                y2: this.selectionEndImg.y
              }
              return
            }

            // Clicking outside - clear selection and start new
            this.refs.selectionBox.style.display = 'none'
          }

          const rect = this.refs.imageContainer.getBoundingClientRect()
          this.selecting = true
          // Convert viewport coordinates to image space
          const viewportX = event.clientX - rect.left
          const viewportY = event.clientY - rect.top
          this.selectionStartImg = {
            x: (viewportX - this.translateX) / this.zoom,
            y: (viewportY - this.translateY) / this.zoom
          }
          this.selectionEndImg = { ...this.selectionStartImg }
          this.refs.selectionBox.style.display = 'block'
          this.updateSelectionBox()
        }
      }
      this.mouseUpHandler = () => {
        if (this.panning) {
          this.panning = false
          this.refs.imageContainer.classList.remove('grabbing')
          this.refs.imageContainer.style.cursor = 'default'
        } else if (this.moving) {
          this.moving = false
          // Normalize selection after moving
          const minX = Math.min(this.selectionStartImg.x, this.selectionEndImg.x)
          const maxX = Math.max(this.selectionStartImg.x, this.selectionEndImg.x)
          const minY = Math.min(this.selectionStartImg.y, this.selectionEndImg.y)
          const maxY = Math.max(this.selectionStartImg.y, this.selectionEndImg.y)

          this.selectionStartImg = { x: minX, y: minY }
          this.selectionEndImg = { x: maxX, y: maxY }
          this.updateSelectionBox()
        } else if (this.resizing) {
          this.resizing = false
          this.resizeHandle = null

          // Normalize selection (ensure start is top-left, end is bottom-right)
          const minX = Math.min(this.selectionStartImg.x, this.selectionEndImg.x)
          const maxX = Math.max(this.selectionStartImg.x, this.selectionEndImg.x)
          const minY = Math.min(this.selectionStartImg.y, this.selectionEndImg.y)
          const maxY = Math.max(this.selectionStartImg.y, this.selectionEndImg.y)

          this.selectionStartImg = { x: minX, y: minY }
          this.selectionEndImg = { x: maxX, y: maxY }

          // Check if selection has any size
          const selWidth = maxX - minX
          const selHeight = maxY - minY
          const minSize = 3 / this.zoom
          if (selWidth < minSize && selHeight < minSize) {
            this.refs.selectionBox.style.display = 'none'
          }

          this.updateSelectionBox()
        } else if (this.selecting) {
          this.selecting = false
          // Check if selection has any size (was dragged) - check in image space
          const selWidth = Math.abs(this.selectionEndImg.x - this.selectionStartImg.x)
          const selHeight = Math.abs(this.selectionEndImg.y - this.selectionStartImg.y)
          // If selection is too small (just a click), hide it
          const minSize = 3 / this.zoom  // Minimum size in image space
          if (selWidth < minSize && selHeight < minSize) {
            this.refs.selectionBox.style.display = 'none'
          }
          // Otherwise keep selection box visible
        }
      }

      this.contextMenuHandler = (event) => {
        if (this.panMoved) {
          event.preventDefault()
          event.stopPropagation()
        }
      }

      this.refs.imageContainer.addEventListener('mousedown', this.mouseDownHandler)
      this.refs.imageContainer.addEventListener('contextmenu', this.contextMenuHandler)
      window.addEventListener('mousemove', this.mouseMoveHandler)
      window.addEventListener('mouseup', this.mouseUpHandler)

      this.disposables.add(new Disposable(() => {
        this.refs.imageContainer.removeEventListener('mousedown', this.mouseDownHandler)
        this.refs.imageContainer.removeEventListener('contextmenu', this.contextMenuHandler)
        window.removeEventListener('mousemove', this.mouseMoveHandler)
        window.removeEventListener('mouseup', this.mouseUpHandler)
      }))

      // Add resize handle listeners
      this.setupResizeHandles()
    }

    onDidLoad(callback) {
      return this.emitter.on('did-load', callback)
    }

    update() { }

    destroy() {
      this.disposables.dispose()
      this.emitter.dispose()
      this.resizeObserver.disconnect()
      etch.destroy(this)
    }

    setupResizeHandles() {
      const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

      handles.forEach(handle => {
        const refName = 'handle' + handle.toUpperCase()
        const element = this.refs[refName]

        const handleMouseDown = (event) => {
          event.preventDefault()
          event.stopPropagation()
          this.resizing = true
          this.resizeHandle = handle
        }

        element.addEventListener('mousedown', handleMouseDown)
        this.disposables.add(new Disposable(() => {
          element.removeEventListener('mousedown', handleMouseDown)
        }))
      })
    }

    render() {
      return (
        $.div({ className: 'image-editor', tabIndex: -1 },
          $.div({ className: 'image-controls', ref: 'imageControls' },
            $.div({ className: 'image-controls-group image-controls-group-background' },
              $.a({ className: 'image-controls-color-white', value: 'white', ref: 'whiteTransparentBackgroundButton' },
                'white'
              ),
              $.a({ className: 'image-controls-color-black', value: 'black', ref: 'blackTransparentBackgroundButton' },
                'black'
              ),
              $.a({ className: 'image-controls-color-transparent', value: 'transparent', ref: 'transparentTransparentBackgroundButton' },
                'transparent'
              ),
              $.a({ className: 'image-controls-color-native', value: 'native', ref: 'nativeBackgroundButton' },
                'native'
              )
            ),
            $.div({ className: 'image-controls-group image-controls-group-navigation btn-group' },
              $.button({ className: 'btn', ref: 'prevImageButton', title: 'Previous Image' },
                '<'
              ),
              $.button({ className: 'btn', ref: 'zoomOutButton' },
                '-'
              ),
              $.button({ className: 'btn reset-zoom-button', ref: 'resetZoomButton' },
                ''
              ),
              $.button({ className: 'btn', ref: 'zoomInButton' },
                '+'
              ),
              $.button({ className: 'btn', ref: 'nextImageButton', title: 'Next Image' },
                '>'
              ),
            ),
            $.div({ className: 'image-controls-group image-controls-group-zoom btn-group' },
              $.button({ className: 'btn center-button', ref: 'centerButton' },
                'Center'
              ),
              $.button({ className: 'btn zoom-to-fit-button', ref: 'zoomToFitButton' },
                'Zoom to fit'
              ),
              $.button({ className: 'btn zoom-to-100-button', ref: 'zoomTo100Button' },
                'Zoom to 100'
              )
            )
          ),
          $.div({ className: 'image-container', ref: 'imageContainer' },
            $.img({ ref: 'image' }),
            $.div({ className: 'selection-box', ref: 'selectionBox' },
              $.div({ className: 'selection-handle nw', ref: 'handleNW' }),
              $.div({ className: 'selection-handle n', ref: 'handleN' }),
              $.div({ className: 'selection-handle ne', ref: 'handleNE' }),
              $.div({ className: 'selection-handle e', ref: 'handleE' }),
              $.div({ className: 'selection-handle se', ref: 'handleSE' }),
              $.div({ className: 'selection-handle s', ref: 'handleS' }),
              $.div({ className: 'selection-handle sw', ref: 'handleSW' }),
              $.div({ className: 'selection-handle w', ref: 'handleW' })
            )
          )
        )
      )
    }

    updateImageURI() {
      // Skip reload if we're currently saving to prevent losing the current view
      if (this.isSaving) return

      this.refs.image.src = `${this.editor.getEncodedURI()}?time=${Date.now()}`
      this.refs.image.onload = () => {
        this.refs.image.onload = null
        this.originalHeight = this.refs.image.naturalHeight
        this.originalWidth = this.refs.image.naturalWidth
        this.imageSize = fs.statSync(this.editor.getPath()).size
        this.loaded = true

        // Reset transform
        this.translateX = 0
        this.translateY = 0

        this.zoomTo100()
        this.centerImage() // Center initially

        this.refs.image.style.display = ''

        // Reset history when loading a new image
        this.history = []
        this.historyIndex = -1
        this.saveToHistory() // Save initial state

        this.emitter.emit('did-update')
        this.emitter.emit('did-load')
      }
    }

    onDidUpdate(callback) {
      return this.emitter.on('did-update', callback)
    }

    updateSize(zoom) {
      if (!this.loaded || this.element.offsetHeight === 0) {
        return
      }
      this.auto = false
      this.refs.zoomToFitButton.classList.remove('selected')
      this.refs.zoomTo100Button.classList.remove('selected')

      this.zoom = Math.min(Math.max(zoom, 0.001), 100)
      // this.step is no longer needed for scroll-based zoom, but keeping if referenced elsewhere (it was used in scroll handlers)

      this.updateTransform()
    }

    updateTransform() {
      this.refs.image.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.zoom})`
      // Clear explicit width/height to let transform handle it, or keep them if needed for layout (but we use absolute pos now)
      this.refs.image.style.width = ''
      this.refs.image.style.height = ''

      const percent = Math.round(this.zoom * 1000) / 10
      this.refs.resetZoomButton.textContent = percent + '%'

      // Update selection box position if visible
      if (this.refs.selectionBox && this.refs.selectionBox.style.display === 'block') {
        this.updateSelectionBox()
      }
    }

    updateSelectionBox() {
      if (!this.refs.selectionBox) return

      // Convert from image space to viewport space
      const leftImg = Math.min(this.selectionStartImg.x, this.selectionEndImg.x)
      const topImg = Math.min(this.selectionStartImg.y, this.selectionEndImg.y)
      const widthImg = Math.abs(this.selectionEndImg.x - this.selectionStartImg.x)
      const heightImg = Math.abs(this.selectionEndImg.y - this.selectionStartImg.y)

      // Transform to viewport coordinates
      const left = leftImg * this.zoom + this.translateX
      const top = topImg * this.zoom + this.translateY
      const width = widthImg * this.zoom
      const height = heightImg * this.zoom

      this.refs.selectionBox.style.left = left + 'px'
      this.refs.selectionBox.style.top = top + 'px'
      this.refs.selectionBox.style.width = width + 'px'
      this.refs.selectionBox.style.height = height + 'px'
    }

    centerImage() {
      if (!this.loaded || this.element.offsetHeight === 0) return

      const containerWidth = this.refs.imageContainer.offsetWidth
      const containerHeight = this.refs.imageContainer.offsetHeight
      const imageWidth = this.refs.image.naturalWidth * this.zoom
      const imageHeight = this.refs.image.naturalHeight * this.zoom

      this.translateX = (containerWidth - imageWidth) / 2 + (imageWidth * 0.5 * (1 - 1 / this.zoom)) * this.zoom // Wait, simplified:
      // With transform-origin: 0 0
      // Top-left of image is at (translateX, translateY)
      // Center of image is at (translateX + naturalWidth*zoom/2, translateY + naturalHeight*zoom/2)
      // We want center of image at (containerWidth/2, containerHeight/2)

      this.translateX = (containerWidth - this.refs.image.naturalWidth * this.zoom) / 2
      this.translateY = (containerHeight - this.refs.image.naturalHeight * this.zoom) / 2

      this.updateTransform()
    }

    zoomToMousePosition(newZoom, event) {
      if (!this.loaded) return

      const { left, top } = this.refs.imageContainer.getBoundingClientRect()
      const mouseX = event.clientX - left
      const mouseY = event.clientY - top

      // Point in image coordinates (unscaled)
      const imageX = (mouseX - this.translateX) / this.zoom
      const imageY = (mouseY - this.translateY) / this.zoom

      this.updateSize(newZoom)

      // We want (imageX * newZoom + newTranslateX) = mouseX
      this.translateX = mouseX - imageX * this.zoom
      this.translateY = mouseY - imageY * this.zoom

      this.updateTransform()
    }

    zoomToCenterPoint(newZoom) {
      if (!this.loaded) return

      const containerWidth = this.refs.imageContainer.offsetWidth
      const containerHeight = this.refs.imageContainer.offsetHeight

      const centerX = containerWidth / 2
      const centerY = containerHeight / 2

      const imageX = (centerX - this.translateX) / this.zoom
      const imageY = (centerY - this.translateY) / this.zoom

      this.updateSize(newZoom)

      this.translateX = centerX - imageX * this.zoom
      this.translateY = centerY - imageY * this.zoom

      this.updateTransform()
    }

    _zoomToFit(limit, auto, element) {
      if (!this.loaded || this.element.offsetHeight === 0) {
        return
      }
      let zoom = Math.min(
        this.refs.imageContainer.offsetWidth / this.refs.image.naturalWidth,
        this.refs.imageContainer.offsetHeight / this.refs.image.naturalHeight,
      )
      if (limit) { zoom = Math.min(zoom, limit) }
      this.updateSize(zoom)
      this.centerImage()
      this.auto = auto
      element.classList.add('selected')
    }

    zoomToFit() {
      this._zoomToFit(false, true, this.refs.zoomToFitButton)
    }

    zoomTo100() {
      this._zoomToFit(1, 1, this.refs.zoomTo100Button)
    }

    zoomOut() {
      for (let i = this.levels.length - 1; i >= 0; i--) {
        if (this.levels[i] < this.zoom) {
          this.zoomToCenterPoint(this.levels[i])
          break
        }
      }
    }

    zoomIn() {
      for (let i = 0; i < this.levels.length; i++) {
        if (this.levels[i] > this.zoom) {
          this.zoomToCenterPoint(this.levels[i])
          break
        }
      }
    }

    resetZoom() {
      if (!this.loaded || this.element.offsetHeight === 0) {
        return
      }
      this.zoomToCenterPoint(1)
    }

    changeBackground(color) {
      if (this.loaded && this.element.offsetHeight > 0 && color) {
        this.refs.imageContainer.setAttribute('background', color)
      }
    }

    scrollUp() {
      this.translateY += this.refs.imageContainer.offsetHeight / 10
      this.updateTransform()
    }

    scrollDown() {
      this.translateY -= this.refs.imageContainer.offsetHeight / 10
      this.updateTransform()
    }

    scrollLeft() {
      this.translateX += this.refs.imageContainer.offsetWidth / 10
      this.updateTransform()
    }

    scrollRight() {
      this.translateX -= this.refs.imageContainer.offsetWidth / 10
      this.updateTransform()
    }

    pageUp() {
      this.translateY += this.refs.imageContainer.offsetHeight
      this.updateTransform()
    }

    pageDown() {
      this.translateY -= this.refs.imageContainer.offsetHeight
      this.updateTransform()
    }

    scrollToTop() {
      this.translateY = 0
      this.updateTransform()
    }

    scrollToBottom() {
      this.translateY = this.refs.imageContainer.offsetHeight - this.refs.image.naturalHeight * this.zoom
      this.updateTransform()
    }

    getAdjacentImage(direction) {
      const currentPath = this.editor.getPath()
      const directory = path.dirname(currentPath)
      const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg']

      try {
        const files = fs.readdirSync(directory)
          .filter(file => extensions.includes(path.extname(file).toLowerCase()))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

        const currentFile = path.basename(currentPath)
        const currentIndex = files.indexOf(currentFile)

        if (currentIndex === -1) return null

        let newIndex = currentIndex + direction
        if (newIndex < 0) newIndex = files.length - 1
        if (newIndex >= files.length) newIndex = 0

        return path.join(directory, files[newIndex])
      } catch (e) {
        console.error('Error finding adjacent image:', e)
        return null
      }
    }



    nextImage() {
      const nextPath = this.getAdjacentImage(1)
      if (nextPath) {
        this.editor.load(nextPath)
      }
    }

    previousImage() {
      const prevPath = this.getAdjacentImage(-1)
      if (prevPath) {
        this.editor.load(prevPath)
      }
    }

    cropToSelection() {
      // Check if selection exists and is visible
      if (!this.refs.selectionBox || this.refs.selectionBox.style.display === 'none') {
        atom.notifications.addWarning('No selection', { description: 'Please create a selection first by dragging with the left mouse button.' })
        return
      }

      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      // Get selection coordinates in image space (already stored)
      const imgLeft = Math.min(this.selectionStartImg.x, this.selectionEndImg.x)
      const imgTop = Math.min(this.selectionStartImg.y, this.selectionEndImg.y)
      const imgWidth = Math.abs(this.selectionEndImg.x - this.selectionStartImg.x)
      const imgHeight = Math.abs(this.selectionEndImg.y - this.selectionStartImg.y)

      if (imgWidth === 0 || imgHeight === 0) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      // Create canvas for cropping
      const canvas = document.createElement('canvas')
      canvas.width = imgWidth
      canvas.height = imgHeight
      const ctx = canvas.getContext('2d')

      // Draw the cropped portion
      ctx.drawImage(
        this.refs.image,
        imgLeft, imgTop, imgWidth, imgHeight,  // Source rectangle
        0, 0, imgWidth, imgHeight               // Destination rectangle
      )

      // Convert canvas to blob and update image
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)

        // Store the current viewport position and zoom before updating the image
        const viewportLeft = imgLeft * this.zoom + this.translateX
        const viewportTop = imgTop * this.zoom + this.translateY
        const currentZoom = this.zoom

        this.refs.image.src = url
        this.refs.image.onload = () => {
          this.refs.image.onload = null
          this.originalHeight = this.refs.image.naturalHeight
          this.originalWidth = this.refs.image.naturalWidth

          // Keep the same zoom level
          this.zoom = currentZoom

          // Adjust translation so the cropped area appears in the same position
          // The top-left of the new image should appear where the selection was
          this.translateX = viewportLeft
          this.translateY = viewportTop

          this.updateTransform()
          this.refs.selectionBox.style.display = 'none'

          // Save to history AFTER the crop is applied
          this.saveToHistory()

          // Emit update event to refresh status bar
          this.emitter.emit('did-update')

          if (atom.config.get('image-editor.showSuccessMessages.crop')) {
            atom.notifications.addSuccess('Image cropped', { description: 'Image has been cropped to selection. Use "Save" to save changes.' })
          }
        }
      }, 'image/png')
    }

    blurImage(blurLevel) {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      const clampedLeft = area.left
      const clampedTop = area.top
      const clampedWidth = area.width
      const clampedHeight = area.height

      // Create canvas from entire current image
      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      // Draw the entire image first
      ctx.drawImage(this.refs.image, 0, 0)

      // Extract the region to blur
      const selectedRegion = ctx.getImageData(clampedLeft, clampedTop, clampedWidth, clampedHeight)

      // Calculate blur radius based on level
      const radius = blurLevel * 2 // Scale blur level

      // Apply Fast Gaussian Blur using box blur approximation
      this.fastGaussianBlur(selectedRegion, clampedWidth, clampedHeight, radius)

      // Put the blurred data back to main canvas
      ctx.putImageData(selectedRegion, clampedLeft, clampedTop)

      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Blur level ${blurLevel} applied to ${areaText}`, 'blur', true)
    }

    // Fast Gaussian Blur implementation using box blur approximation
    fastGaussianBlur(imageData, width, height, radius) {
      const pixels = imageData.data
      const boxes = this.boxesForGauss(radius, 3) // 3 passes for good approximation

      // Apply horizontal and vertical box blurs
      for (let i = 0; i < 3; i++) {
        this.boxBlur(pixels, width, height, (boxes[i] - 1) / 2)
      }
    }

    // Calculate box sizes for Gaussian approximation
    boxesForGauss(sigma, n) {
      const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1)
      let wl = Math.floor(wIdeal)
      if (wl % 2 === 0) wl--
      const wu = wl + 2

      const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)
      const m = Math.round(mIdeal)

      const sizes = []
      for (let i = 0; i < n; i++) {
        sizes.push(i < m ? wl : wu)
      }
      return sizes
    }

    // Box blur implementation (horizontal + vertical)
    boxBlur(pixels, width, height, radius) {
      const temp = new Uint8ClampedArray(pixels.length)

      // Horizontal pass
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, a = 0, count = 0

          for (let kx = -radius; kx <= radius; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx))
            const offset = (y * width + px) * 4
            r += pixels[offset]
            g += pixels[offset + 1]
            b += pixels[offset + 2]
            a += pixels[offset + 3]
            count++
          }

          const offset = (y * width + x) * 4
          temp[offset] = r / count
          temp[offset + 1] = g / count
          temp[offset + 2] = b / count
          temp[offset + 3] = a / count
        }
      }

      // Vertical pass
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, a = 0, count = 0

          for (let ky = -radius; ky <= radius; ky++) {
            const py = Math.min(height - 1, Math.max(0, y + ky))
            const offset = (py * width + x) * 4
            r += temp[offset]
            g += temp[offset + 1]
            b += temp[offset + 2]
            a += temp[offset + 3]
            count++
          }

          const offset = (y * width + x) * 4
          pixels[offset] = r / count
          pixels[offset + 1] = g / count
          pixels[offset + 2] = b / count
          pixels[offset + 3] = a / count
        }
      }
    }

    async save() {
      if (!this.loaded) {
        atom.notifications.addError('No image to save')
        return
      }

      const currentPath = this.editor.getPath()
      if (!currentPath) {
        // If no path exists, fall back to saveImage (Save As)
        return this.saveImage()
      }

      try {
        this.isSaving = true
        const ext = path.extname(currentPath).toLowerCase()
        const mimeType = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png'

        // Create canvas from current image
        const canvas = document.createElement('canvas')
        canvas.width = this.refs.image.naturalWidth
        canvas.height = this.refs.image.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(this.refs.image, 0, 0)

        // Convert to blob
        canvas.toBlob(async (blob) => {
          try {
            const buffer = Buffer.from(await blob.arrayBuffer())
            fs.writeFileSync(currentPath, buffer)
            if (atom.config.get('image-editor.showSuccessMessages.save')) {
              atom.notifications.addSuccess('Image saved', { description: `Saved to ${currentPath}` })
            }
          } finally {
            // Clear flag after a short delay to ensure file watcher event is ignored
            setTimeout(() => { this.isSaving = false }, 100)
          }
        }, mimeType)
      } catch (error) {
        this.isSaving = false
        atom.notifications.addError('Failed to save image', { description: error.message })
      }
    }

    async saveImage() {
      if (!this.loaded) {
        atom.notifications.addError('No image to save')
        return
      }

      const { remote } = require('electron')
      const currentPath = this.editor.getPath()
      const defaultPath = currentPath || 'untitled.png'

      try {
        const result = await remote.dialog.showSaveDialog({
          defaultPath: defaultPath,
          filters: [
            { name: 'PNG Images', extensions: ['png'] },
            { name: 'JPEG Images', extensions: ['jpg', 'jpeg'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.canceled || !result.filePath) {
          return
        }

        const savePath = result.filePath
        const ext = path.extname(savePath).toLowerCase()
        const mimeType = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png'

        // Create canvas from current image
        const canvas = document.createElement('canvas')
        canvas.width = this.refs.image.naturalWidth
        canvas.height = this.refs.image.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(this.refs.image, 0, 0)

        // Convert to blob
        canvas.toBlob(async (blob) => {
          const buffer = Buffer.from(await blob.arrayBuffer())
          fs.writeFileSync(savePath, buffer)
          if (atom.config.get('image-editor.showSuccessMessages.save')) {
            atom.notifications.addSuccess('Image saved', { description: `Saved to ${savePath}` })
          }
        }, mimeType)
      } catch (error) {
        atom.notifications.addError('Failed to save image', { description: error.message })
      }
    }

    rotate(degrees) {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      // Create canvas for rotation
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      // For 90 or 270 degree rotations, swap width and height
      const isOrthogonal = Math.abs(degrees) === 90 || Math.abs(degrees) === 270
      if (isOrthogonal) {
        canvas.width = this.refs.image.naturalHeight
        canvas.height = this.refs.image.naturalWidth
      } else {
        canvas.width = this.refs.image.naturalWidth
        canvas.height = this.refs.image.naturalHeight
      }

      // Save current state
      ctx.save()

      // Move to center, rotate, then move back
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((degrees * Math.PI) / 180)
      ctx.translate(-this.refs.image.naturalWidth / 2, -this.refs.image.naturalHeight / 2)

      // Draw the image
      ctx.drawImage(this.refs.image, 0, 0)
      ctx.restore()

      // Convert canvas to blob and update image
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        this.refs.image.src = url
        this.refs.image.onload = () => {
          this.refs.image.onload = null
          this.originalHeight = this.refs.image.naturalHeight
          this.originalWidth = this.refs.image.naturalWidth

          // Reset transform and center
          this.translateX = 0
          this.translateY = 0
          this.zoomTo100()
          this.centerImage()

          this.updateTransform()
          this.refs.selectionBox.style.display = 'none'

          // Save to history AFTER rotation is applied
          this.saveToHistory()

          // Emit update event to refresh status bar
          this.emitter.emit('did-update')

          if (atom.config.get('image-editor.showSuccessMessages.transform')) {
            const direction = degrees > 0 ? 'clockwise' : 'counter-clockwise'
            atom.notifications.addSuccess('Image rotated', {
              description: `Rotated ${Math.abs(degrees)}° ${degrees === 180 ? '' : direction}. Use "Save" to save changes.`
            })
          }
        }
      }, 'image/png')
    }

    flipHorizontal() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      // Create canvas for flipping
      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      // Flip horizontally
      ctx.save()
      ctx.scale(-1, 1)
      ctx.drawImage(this.refs.image, -canvas.width, 0)
      ctx.restore()

      // Convert canvas to blob and update image
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        this.refs.image.src = url
        this.refs.image.onload = () => {
          this.refs.image.onload = null
          this.updateTransform()
          this.refs.selectionBox.style.display = 'none'

          // Save to history AFTER flipping is applied
          this.saveToHistory()

          // Emit update event to refresh status bar
          this.emitter.emit('did-update')

          if (atom.config.get('image-editor.showSuccessMessages.transform')) {
            atom.notifications.addSuccess('Image flipped', {
              description: 'Flipped horizontally. Use "Save" to save changes.'
            })
          }
        }
      }, 'image/png')
    }

    flipVertical() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      // Create canvas for flipping
      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      // Flip vertically
      ctx.save()
      ctx.scale(1, -1)
      ctx.drawImage(this.refs.image, 0, -canvas.height)
      ctx.restore()

      // Convert canvas to blob and update image
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        this.refs.image.src = url
        this.refs.image.onload = () => {
          this.refs.image.onload = null
          this.updateTransform()
          this.refs.selectionBox.style.display = 'none'

          // Save to history AFTER flipping is applied
          this.saveToHistory()

          // Emit update event to refresh status bar
          this.emitter.emit('did-update')

          if (atom.config.get('image-editor.showSuccessMessages.transform')) {
            atom.notifications.addSuccess('Image flipped', {
              description: 'Flipped vertically. Use "Save" to save changes.'
            })
          }
        }
      }, 'image/png')
    }

    // Helper method to get selection area or entire image
    getSelectionArea() {
      const hasSelection = this.refs.selectionBox && this.refs.selectionBox.style.display !== 'none'

      if (hasSelection) {
        // Selection coordinates are already in image space
        const imgLeft = Math.round(Math.min(this.selectionStartImg.x, this.selectionEndImg.x))
        const imgTop = Math.round(Math.min(this.selectionStartImg.y, this.selectionEndImg.y))
        const imgWidth = Math.round(Math.abs(this.selectionEndImg.x - this.selectionStartImg.x))
        const imgHeight = Math.round(Math.abs(this.selectionEndImg.y - this.selectionStartImg.y))

        if (imgWidth === 0 || imgHeight === 0) {
          return null // Invalid selection
        }

        return {
          hasSelection: true,
          left: Math.max(0, Math.min(imgLeft, this.refs.image.naturalWidth)),
          top: Math.max(0, Math.min(imgTop, this.refs.image.naturalHeight)),
          width: Math.min(imgWidth, this.refs.image.naturalWidth - Math.max(0, imgLeft)),
          height: Math.min(imgHeight, this.refs.image.naturalHeight - Math.max(0, imgTop))
        }
      } else {
        return {
          hasSelection: false,
          left: 0,
          top: 0,
          width: this.refs.image.naturalWidth,
          height: this.refs.image.naturalHeight
        }
      }
    }

    applyGrayscale() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      // Draw the entire image
      ctx.drawImage(this.refs.image, 0, 0)

      // Get the area to process
      const imageData = ctx.getImageData(area.left, area.top, area.width, area.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }

      ctx.putImageData(imageData, area.left, area.top)

      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Grayscale applied to ${areaText}`, 'adjustment', true)
    }

    invertColors() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      // Save to history
      this.saveToHistory()

      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(this.refs.image, 0, 0)

      const imageData = ctx.getImageData(area.left, area.top, area.width, area.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i]         // Red
        data[i + 1] = 255 - data[i + 1] // Green
        data[i + 2] = 255 - data[i + 2] // Blue
        // Alpha channel (i + 3) remains unchanged
      }

      ctx.putImageData(imageData, area.left, area.top)

      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Colors inverted on ${areaText}`, 'adjustment')
    }

    applySepia() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      // Save to history
      this.saveToHistory()

      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(this.refs.image, 0, 0)

      const imageData = ctx.getImageData(area.left, area.top, area.width, area.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189))
        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168))
        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131))
      }

      ctx.putImageData(imageData, area.left, area.top)

      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Sepia tone applied to ${areaText}`, 'adjustment')
    }

    sharpenImage(strength) {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      // Save to history
      this.saveToHistory()

      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(this.refs.image, 0, 0)

      const imageData = ctx.getImageData(area.left, area.top, area.width, area.height)
      const pixels = imageData.data
      const width = area.width
      const height = area.height

      // Sharpen kernel (adjustable by strength)
      const kernel = [
        0, -strength, 0,
        -strength, 1 + 4 * strength, -strength,
        0, -strength, 0
      ]

      const result = new Uint8ClampedArray(pixels.length)

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) { // RGB channels only
            let sum = 0
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * width + (x + kx)) * 4 + c
                const kernelIdx = (ky + 1) * 3 + (kx + 1)
                sum += pixels[idx] * kernel[kernelIdx]
              }
            }
            const idx = (y * width + x) * 4 + c
            result[idx] = Math.min(255, Math.max(0, sum))
          }
          // Copy alpha channel
          const idx = (y * width + x) * 4
          result[idx + 3] = pixels[idx + 3]
        }
      }

      // Copy edges from original
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
            const idx = (y * width + x) * 4
            for (let c = 0; c < 4; c++) {
              result[idx + c] = pixels[idx + c]
            }
          }
        }
      }

      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = result[i]
      }

      ctx.putImageData(imageData, area.left, area.top)

      const strengthName = strength === 0.5 ? 'light' : strength === 1.0 ? 'medium' : 'strong'
      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Sharpen (${strengthName}) applied to ${areaText}`, 'adjustment')
    }

    copySelectionToClipboard() {
      if (!this.refs.selectionBox || this.refs.selectionBox.style.display === 'none') {
        atom.notifications.addWarning('No selection', { description: 'Please create a selection first by dragging with the left mouse button.' })
        return
      }

      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      // Get selection coordinates in image space
      const imgLeft = Math.min(this.selectionStartImg.x, this.selectionEndImg.x)
      const imgTop = Math.min(this.selectionStartImg.y, this.selectionEndImg.y)
      const imgWidth = Math.abs(this.selectionEndImg.x - this.selectionStartImg.x)
      const imgHeight = Math.abs(this.selectionEndImg.y - this.selectionStartImg.y)

      if (imgWidth === 0 || imgHeight === 0) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = imgWidth
      canvas.height = imgHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(
        this.refs.image,
        imgLeft, imgTop, imgWidth, imgHeight,
        0, 0, imgWidth, imgHeight
      )

      canvas.toBlob((blob) => {
        const { clipboard, nativeImage } = require('electron')
        blob.arrayBuffer().then(buffer => {
          const image = nativeImage.createFromBuffer(Buffer.from(buffer))
          clipboard.writeImage(image)
          if (atom.config.get('image-editor.showSuccessMessages.clipboard')) {
            atom.notifications.addSuccess('Selection copied', { description: 'Selection copied to clipboard.' })
          }
        })
      }, 'image/png')
    }

    // Helper method to update image from canvas (saves to history first)
    updateImageFromCanvas(canvas, successMessage, configKey = 'adjustment') {
      // Save current state to history before making changes
      this.saveToHistory()

      this.updateImageFromCanvasWithoutHistory(canvas, successMessage, configKey)
    }

    // Helper method to update image from canvas without saving to history first
    // Set saveToHistoryAfter to true to save AFTER the image loads (for proper undo/redo)
    updateImageFromCanvasWithoutHistory(canvas, successMessage, configKey = 'adjustment', saveToHistoryAfter = false) {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        this.refs.image.src = url
        this.refs.image.onload = () => {
          this.refs.image.onload = null
          this.updateTransform()
          this.refs.selectionBox.style.display = 'none'
          this.emitter.emit('did-update')

          // Save to history AFTER the image is updated (if requested)
          if (saveToHistoryAfter) {
            this.saveToHistory()
          }

          if (atom.config.get(`image-editor.showSuccessMessages.${configKey}`)) {
            atom.notifications.addSuccess(successMessage, { description: 'Use "Save" to save changes.' })
          }
        }
      }, 'image/png')
    }

    // Dialog methods for adjustments with sliders
    showBrightnessContrastDialog() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      const panel = this.showAdjustmentDialog(
        'Brightness & Contrast',
        [
          { label: 'Brightness', min: -100, max: 100, default: 0, step: 1 },
          { label: 'Contrast', min: -100, max: 100, default: 0, step: 1 }
        ],
        (values) => this.applyBrightnessContrast(values[0], values[1])
      )
    }

    showSaturationDialog() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      this.showAdjustmentDialog(
        'Saturation',
        [
          { label: 'Saturation', min: -100, max: 100, default: 0, step: 1 }
        ],
        (values) => this.applySaturation(values[0])
      )
    }

    showHueShiftDialog() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      this.showAdjustmentDialog(
        'Hue Shift',
        [
          { label: 'Hue', min: 0, max: 360, default: 0, step: 1 }
        ],
        (values) => this.applyHueShift(values[0])
      )
    }

    showPosterizeDialog() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      this.showAdjustmentDialog(
        'Posterize',
        [
          { label: 'Levels', min: 2, max: 32, default: 8, step: 1 }
        ],
        (values) => this.applyPosterize(values[0])
      )
    }

    showAdjustmentDialog(title, sliders, applyCallback) {
      const dialogElement = document.createElement('div')
      dialogElement.className = 'image-editor-adjustment-dialog'
      dialogElement.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--base-background-color);
        border: 1px solid var(--base-border-color);
        border-radius: 5px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        min-width: 300px;
      `

      const titleElement = document.createElement('h3')
      titleElement.textContent = title
      titleElement.style.marginTop = '0'
      dialogElement.appendChild(titleElement)

      const sliderElements = []
      const valueElements = []

      sliders.forEach((config, index) => {
        const container = document.createElement('div')
        container.style.marginBottom = '15px'

        const label = document.createElement('label')
        label.textContent = config.label
        label.style.display = 'block'
        label.style.marginBottom = '5px'
        container.appendChild(label)

        const sliderContainer = document.createElement('div')
        sliderContainer.style.display = 'flex'
        sliderContainer.style.alignItems = 'center'
        sliderContainer.style.gap = '10px'

        const slider = document.createElement('input')
        slider.type = 'range'
        slider.min = config.min
        slider.max = config.max
        slider.value = config.default
        slider.step = config.step
        slider.style.flex = '1'
        sliderElements.push(slider)

        const valueLabel = document.createElement('span')
        valueLabel.textContent = config.default
        valueLabel.style.minWidth = '40px'
        valueLabel.style.textAlign = 'right'
        valueElements.push(valueLabel)

        slider.addEventListener('input', () => {
          valueLabel.textContent = slider.value
        })

        sliderContainer.appendChild(slider)
        sliderContainer.appendChild(valueLabel)
        container.appendChild(sliderContainer)
        dialogElement.appendChild(container)
      })

      const buttonContainer = document.createElement('div')
      buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;'

      const cancelButton = document.createElement('button')
      cancelButton.className = 'btn'
      cancelButton.textContent = 'Cancel'
      cancelButton.addEventListener('click', () => {
        document.body.removeChild(dialogElement)
      })

      const applyButton = document.createElement('button')
      applyButton.className = 'btn btn-primary'
      applyButton.textContent = 'Apply'
      applyButton.addEventListener('click', () => {
        const values = sliderElements.map(s => parseFloat(s.value))
        applyCallback(values)
        document.body.removeChild(dialogElement)
      })

      buttonContainer.appendChild(cancelButton)
      buttonContainer.appendChild(applyButton)
      dialogElement.appendChild(buttonContainer)

      document.body.appendChild(dialogElement)

      // Focus the first slider
      if (sliderElements.length > 0) {
        sliderElements[0].focus()
      }
    }

    applyBrightnessContrast(brightness, contrast) {
      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(this.refs.image, 0, 0)

      const imageData = ctx.getImageData(area.left, area.top, area.width, area.height)
      const data = imageData.data

      const brightnessAdjust = brightness * 2.55 // Convert -100 to 100 range to -255 to 255
      const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast))

      for (let i = 0; i < data.length; i += 4) {
        // Apply contrast first, then brightness
        for (let c = 0; c < 3; c++) {
          let value = data[i + c]
          // Contrast
          value = contrastFactor * (value - 128) + 128
          // Brightness
          value = value + brightnessAdjust
          data[i + c] = Math.min(255, Math.max(0, value))
        }
      }

      ctx.putImageData(imageData, area.left, area.top)

      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Brightness & contrast adjusted on ${areaText}`, 'adjustment', true)
    }

    applySaturation(saturation) {
      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(this.refs.image, 0, 0)

      const imageData = ctx.getImageData(area.left, area.top, area.width, area.height)
      const data = imageData.data

      const saturationFactor = (saturation + 100) / 100

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        const gray = 0.299 * r + 0.587 * g + 0.114 * b

        data[i] = Math.min(255, Math.max(0, gray + saturationFactor * (r - gray)))
        data[i + 1] = Math.min(255, Math.max(0, gray + saturationFactor * (g - gray)))
        data[i + 2] = Math.min(255, Math.max(0, gray + saturationFactor * (b - gray)))
      }

      ctx.putImageData(imageData, area.left, area.top)

      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Saturation adjusted on ${areaText}`, 'adjustment', true)
    }

    applyHueShift(hueShift) {
      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(this.refs.image, 0, 0)

      const imageData = ctx.getImageData(area.left, area.top, area.width, area.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255
        const g = data[i + 1] / 255
        const b = data[i + 2] / 255

        // RGB to HSL
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        let h, s, l = (max + min) / 2

        if (max === min) {
          h = s = 0
        } else {
          const d = max - min
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
            case g: h = ((b - r) / d + 2) / 6; break
            case b: h = ((r - g) / d + 4) / 6; break
          }
        }

        // Shift hue
        h = (h + hueShift / 360) % 1
        if (h < 0) h += 1

        // HSL to RGB
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1
          if (t > 1) t -= 1
          if (t < 1/6) return p + (q - p) * 6 * t
          if (t < 1/2) return q
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
          return p
        }

        let nr, ng, nb
        if (s === 0) {
          nr = ng = nb = l
        } else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s
          const p = 2 * l - q
          nr = hue2rgb(p, q, h + 1/3)
          ng = hue2rgb(p, q, h)
          nb = hue2rgb(p, q, h - 1/3)
        }

        data[i] = Math.round(nr * 255)
        data[i + 1] = Math.round(ng * 255)
        data[i + 2] = Math.round(nb * 255)
      }

      ctx.putImageData(imageData, area.left, area.top)

      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Hue shifted on ${areaText}`, 'adjustment', true)
    }

    applyPosterize(levels) {
      const area = this.getSelectionArea()
      if (!area) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(this.refs.image, 0, 0)

      const imageData = ctx.getImageData(area.left, area.top, area.width, area.height)
      const data = imageData.data

      const step = 255 / (levels - 1)

      for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          data[i + c] = Math.round(Math.round(data[i + c] / step) * step)
        }
      }

      ctx.putImageData(imageData, area.left, area.top)

      const areaText = area.hasSelection ? 'selection' : 'image'
      this.updateImageFromCanvasWithoutHistory(canvas, `Posterized to ${levels} levels on ${areaText}`, 'adjustment', true)
    }

    // Undo/Redo functionality
    saveToHistory() {
      if (!this.loaded) return

      // Create a canvas to capture current state
      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(this.refs.image, 0, 0)

      // Get data URL
      const dataUrl = canvas.toDataURL('image/png')

      // Store both image state and viewport state
      const historyEntry = {
        imageData: dataUrl,
        translateX: this.translateX,
        translateY: this.translateY,
        zoom: this.zoom,
        imageWidth: this.refs.image.naturalWidth,
        imageHeight: this.refs.image.naturalHeight
      }

      // If we're not at the end of history, remove forward history
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1)
      }

      // Add to history
      this.history.push(historyEntry)

      // Limit history size
      if (this.history.length > this.maxHistorySize) {
        this.history.shift()
      } else {
        this.historyIndex++
      }
    }

    undo() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      if (this.historyIndex <= 0) {
        atom.notifications.addWarning('Nothing to undo', { description: 'Already at the oldest change.' })
        return
      }

      this.historyIndex--
      this.loadFromHistory()

      if (atom.config.get('image-editor.showSuccessMessages.history')) {
        atom.notifications.addSuccess('Undo', { description: `Reverted to previous state (${this.historyIndex + 1}/${this.history.length}).` })
      }
    }

    redo() {
      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      if (this.historyIndex >= this.history.length - 1) {
        atom.notifications.addWarning('Nothing to redo', { description: 'Already at the newest change.' })
        return
      }

      this.historyIndex++
      this.loadFromHistory()

      if (atom.config.get('image-editor.showSuccessMessages.history')) {
        atom.notifications.addSuccess('Redo', { description: `Restored to next state (${this.historyIndex + 1}/${this.history.length}).` })
      }
    }

    loadFromHistory() {
      if (this.historyIndex < 0 || this.historyIndex >= this.history.length) return

      const historyEntry = this.history[this.historyIndex]
      
      // Support old history format (just strings) for backward compatibility
      const dataUrl = typeof historyEntry === 'string' ? historyEntry : historyEntry.imageData
      
      const img = new Image()
      img.onload = () => {
        this.refs.image.src = dataUrl
        this.refs.image.onload = () => {
          this.refs.image.onload = null
          this.originalHeight = this.refs.image.naturalHeight
          this.originalWidth = this.refs.image.naturalWidth
          
          // Restore viewport state if available
          if (typeof historyEntry === 'object' && historyEntry.translateX !== undefined) {
            this.translateX = historyEntry.translateX
            this.translateY = historyEntry.translateY
            this.zoom = historyEntry.zoom
            // Clear auto-zoom flags
            this.auto = false
            this.refs.zoomToFitButton.classList.remove('selected')
            this.refs.zoomTo100Button.classList.remove('selected')
          }
          
          this.updateTransform()
          this.refs.selectionBox.style.display = 'none'
          this.emitter.emit('did-update')
        }
      }
      img.src = dataUrl
    }
  }
