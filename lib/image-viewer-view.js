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
        'core:move-to-bottom': () => this.scrollToBottom()
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

      this.panHandler = (event) => {
        if (this.panning) {
          this.panDistance += Math.abs(event.movementX) + Math.abs(event.movementY)
          if (this.panDistance > 5) {
            this.panMoved = true
          }
          this.translateX += event.movementX
          this.translateY += event.movementY
          this.updateTransform()
        }
      }
      this.startPanHandler = (event) => {
        if (event.button === 2) { // Right click
          this.panning = true
          this.panMoved = false
          this.panDistance = 0
          this.refs.imageContainer.classList.add('grabbing')
        }
      }
      this.stopPanHandler = () => {
        this.panning = false
        this.refs.imageContainer.classList.remove('grabbing')
      }

      this.contextMenuHandler = (event) => {
        if (this.panMoved) {
          event.preventDefault()
          event.stopPropagation()
        }
      }

      this.refs.imageContainer.addEventListener('mousedown', this.startPanHandler)
      this.refs.imageContainer.addEventListener('contextmenu', this.contextMenuHandler)
      window.addEventListener('mousemove', this.panHandler)
      window.addEventListener('mouseup', this.stopPanHandler)

      this.disposables.add(new Disposable(() => {
        this.refs.imageContainer.removeEventListener('mousedown', this.startPanHandler)
        this.refs.imageContainer.removeEventListener('contextmenu', this.contextMenuHandler)
        window.removeEventListener('mousemove', this.panHandler)
        window.removeEventListener('mouseup', this.stopPanHandler)
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
            $.img({ ref: 'image' })
          )
        )
      )
    }

    updateImageURI() {
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
  }
