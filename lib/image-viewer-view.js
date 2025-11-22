const fs = require('fs')
const path = require('path')
const { Emitter, CompositeDisposable, Disposable } = require('atom')
const etch = require('etch')
const $ = etch.dom

module.exports =
  class ImageViewerView {
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
      this.selectionStart = { x: 0, y: 0 }
      this.selectionEnd = { x: 0, y: 0 }
      this.isSaving = false
      etch.initialize(this)

      this.defaultBackgroundColor = atom.config.get('image-viewer.defaultBackgroundColor')
      this.refs.imageContainer.setAttribute('background', this.defaultBackgroundColor)

      this.refs.image.style.display = 'none'
      this.updateImageURI()

      this.updateImageURI()

      this.disposables.add(this.editor.onDidReplaceFile(() => this.updateImageURI()))
      this.disposables.add(this.editor.onDidChange(() => this.updateImageURI()))
      this.disposables.add(atom.commands.add(this.element, {
        'image-viewer:reload': () => this.updateImageURI(),
        'image-viewer:zoom-in': () => this.zoomIn(),
        'image-viewer:zoom-out': () => this.zoomOut(),
        'image-viewer:reset-zoom': () => this.resetZoom(),
        'image-viewer:zoom-to-fit': () => this.zoomToFit(),
        'image-viewer:zoom-to-100': () => this.zoomTo100(),
        'image-viewer:center': () => this.centerImage(),
        'image-viewer:next-image': () => this.nextImage(),
        'image-viewer:previous-image': () => this.previousImage(),
        'core:move-up': () => this.scrollUp(),
        'core:move-down': () => this.scrollDown(),
        'core:move-left': () => this.scrollLeft(),
        'core:move-right': () => this.scrollRight(),
        'core:page-up': () => this.pageUp(),
        'core:page-down': () => this.pageDown(),
        'core:move-to-top': () => this.scrollToTop(),
        'core:move-to-bottom': () => this.scrollToBottom(),
        'image-viewer:crop-to-selection': () => this.cropToSelection(),
        'image-viewer:save': () => this.save(),
        'image-viewer:save-image': () => this.saveImage(),
        'image-viewer:blur-selection-light': () => this.blurSelection(3),
        'image-viewer:blur-selection-medium': () => this.blurSelection(6),
        'image-viewer:blur-selection-strong': () => this.blurSelection(10)
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
        } else if (this.selecting) {
          const rect = this.refs.imageContainer.getBoundingClientRect()
          this.selectionEnd = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
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
          // If there's an existing selection, clear it and start new
          if (this.refs.selectionBox.style.display === 'block' && !this.selecting) {
            this.refs.selectionBox.style.display = 'none'
          }

          const rect = this.refs.imageContainer.getBoundingClientRect()
          this.selecting = true
          this.selectionStart = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          }
          this.selectionEnd = { ...this.selectionStart }
          this.refs.selectionBox.style.display = 'block'
          this.updateSelectionBox()
        }
      }
      this.mouseUpHandler = () => {
        if (this.panning) {
          this.panning = false
          this.refs.imageContainer.classList.remove('grabbing')
          this.refs.imageContainer.style.cursor = 'default'
        } else if (this.selecting) {
          this.selecting = false
          // Check if selection has any size (was dragged)
          const selWidth = Math.abs(this.selectionEnd.x - this.selectionStart.x)
          const selHeight = Math.abs(this.selectionEnd.y - this.selectionStart.y)
          // If selection is too small (just a click), hide it
          if (selWidth < 3 && selHeight < 3) {
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

    render() {
      return (
        $.div({ className: 'image-viewer', tabIndex: -1 },
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
            $.div({ className: 'selection-box', ref: 'selectionBox' })
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
    }

    updateSelectionBox() {
      if (!this.refs.selectionBox) return

      const left = Math.min(this.selectionStart.x, this.selectionEnd.x)
      const top = Math.min(this.selectionStart.y, this.selectionEnd.y)
      const width = Math.abs(this.selectionEnd.x - this.selectionStart.x)
      const height = Math.abs(this.selectionEnd.y - this.selectionStart.y)

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

      // Get selection coordinates in container space
      const selLeft = Math.min(this.selectionStart.x, this.selectionEnd.x)
      const selTop = Math.min(this.selectionStart.y, this.selectionEnd.y)
      const selWidth = Math.abs(this.selectionEnd.x - this.selectionStart.x)
      const selHeight = Math.abs(this.selectionEnd.y - this.selectionStart.y)

      if (selWidth === 0 || selHeight === 0) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      // Transform selection coordinates to image space
      // Container coords -> Image coords: (containerX - translateX) / zoom
      const imgLeft = (selLeft - this.translateX) / this.zoom
      const imgTop = (selTop - this.translateY) / this.zoom
      const imgWidth = selWidth / this.zoom
      const imgHeight = selHeight / this.zoom

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

        // Store the current selection position before updating the image
        const oldSelLeft = selLeft
        const oldSelTop = selTop
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
          this.translateX = oldSelLeft
          this.translateY = oldSelTop

          this.updateTransform()
          this.refs.selectionBox.style.display = 'none'

          // Emit update event to refresh status bar
          this.emitter.emit('did-update')

          atom.notifications.addSuccess('Image cropped', { description: 'Image has been cropped to selection. Use "Save" to save changes.' })
        }
      }, 'image/png')
    }

    blurSelection(blurLevel) {
      // Check if selection exists and is visible
      if (!this.refs.selectionBox || this.refs.selectionBox.style.display === 'none') {
        atom.notifications.addWarning('No selection', { description: 'Please create a selection first by dragging with the left mouse button.' })
        return
      }

      if (!this.loaded) {
        atom.notifications.addError('Image not loaded')
        return
      }

      // Get selection coordinates in container space
      const selLeft = Math.min(this.selectionStart.x, this.selectionEnd.x)
      const selTop = Math.min(this.selectionStart.y, this.selectionEnd.y)
      const selWidth = Math.abs(this.selectionEnd.x - this.selectionStart.x)
      const selHeight = Math.abs(this.selectionEnd.y - this.selectionStart.y)

      if (selWidth === 0 || selHeight === 0) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection has no area.' })
        return
      }

      // Transform selection coordinates to image space
      const imgLeft = Math.round((selLeft - this.translateX) / this.zoom)
      const imgTop = Math.round((selTop - this.translateY) / this.zoom)
      const imgWidth = Math.round(selWidth / this.zoom)
      const imgHeight = Math.round(selHeight / this.zoom)

      // Ensure coordinates are within image bounds
      const clampedLeft = Math.max(0, Math.min(imgLeft, this.refs.image.naturalWidth))
      const clampedTop = Math.max(0, Math.min(imgTop, this.refs.image.naturalHeight))
      const clampedWidth = Math.min(imgWidth, this.refs.image.naturalWidth - clampedLeft)
      const clampedHeight = Math.min(imgHeight, this.refs.image.naturalHeight - clampedTop)

      if (clampedWidth <= 0 || clampedHeight <= 0) {
        atom.notifications.addWarning('Invalid selection', { description: 'Selection is outside image bounds.' })
        return
      }

      // Create canvas from entire current image
      const canvas = document.createElement('canvas')
      canvas.width = this.refs.image.naturalWidth
      canvas.height = this.refs.image.naturalHeight
      const ctx = canvas.getContext('2d')

      // Draw the entire image first
      ctx.drawImage(this.refs.image, 0, 0)

      // Extract the selected region
      const selectedRegion = ctx.getImageData(clampedLeft, clampedTop, clampedWidth, clampedHeight)

      // Apply blur using CSS filter on a temporary canvas
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = clampedWidth
      tempCanvas.height = clampedHeight
      const tempCtx = tempCanvas.getContext('2d')

      // Draw selected region to temp canvas
      tempCtx.putImageData(selectedRegion, 0, 0)

      // Apply blur by drawing with filter
      const blurAmount = blurLevel * 2 // Scale blur level
      ctx.filter = `blur(${blurAmount}px)`
      ctx.drawImage(tempCanvas, 0, 0, clampedWidth, clampedHeight, clampedLeft, clampedTop, clampedWidth, clampedHeight)
      ctx.filter = 'none'

      // Convert canvas to blob and update image
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        this.refs.image.src = url
        this.refs.image.onload = () => {
          this.refs.image.onload = null
          this.updateTransform()
          atom.notifications.addSuccess('Blur applied', { description: `Blur level ${blurLevel} applied to selection. Use "Save" to save changes.` })
        }
      }, 'image/png')
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
            atom.notifications.addSuccess('Image saved', { description: `Saved to ${currentPath}` })
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
          atom.notifications.addSuccess('Image saved', { description: `Saved to ${savePath}` })
        }, mimeType)
      } catch (error) {
        atom.notifications.addError('Failed to save image', { description: error.message })
      }
    }
  }
