/**
 * Dialog utilities module
 * Contains dialog creation helpers for image adjustments
 */

// Create a draggable dialog with backdrop
function createDialogBackdrop() {
  const backdrop = document.createElement("div");
  backdrop.className = "image-editor-dialog-backdrop";
  return backdrop;
}

// Create dialog element with title and make it draggable
function createDraggableDialog(title) {
  const dialogElement = document.createElement("div");
  dialogElement.className = "image-editor-adjustment-dialog";

  // Make dialog draggable state
  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX = 0;
  let initialY = 0;

  const titleElement = document.createElement("h3");
  titleElement.className = "dialog-title";
  titleElement.textContent = title;
  dialogElement.appendChild(titleElement);

  const dragStart = (e) => {
    if (e.target === titleElement) {
      initialX = e.clientX - currentX;
      initialY = e.clientY - currentY;
      isDragging = true;
      dialogElement.style.cursor = "grabbing";
    }
  };

  const drag = (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      dialogElement.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;
    }
  };

  const dragEnd = () => {
    isDragging = false;
    dialogElement.style.cursor = "move";
  };

  titleElement.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  // Return cleanup function
  const cleanup = () => {
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", dragEnd);
  };

  return { dialogElement, titleElement, cleanup };
}

// Create a slider control for adjustments
function createSliderControl(config) {
  const container = document.createElement("div");
  container.className = "dialog-slider-container";

  const label = document.createElement("label");
  label.className = "dialog-label";
  label.textContent = config.label;
  container.appendChild(label);

  const controlsContainer = document.createElement("div");
  controlsContainer.className = "dialog-controls";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = config.min;
  slider.max = config.max;
  slider.value = config.default;
  slider.step = config.step;

  const valueLabel = document.createElement("span");
  valueLabel.className = "dialog-value-label";
  valueLabel.textContent = config.default;

  slider.addEventListener("input", () => {
    valueLabel.textContent = slider.value;
  });

  controlsContainer.appendChild(slider);
  controlsContainer.appendChild(valueLabel);
  container.appendChild(controlsContainer);

  return { container, slider, valueLabel };
}

// Create button container with Cancel and Apply buttons
function createButtonContainer(cancelText = "Cancel", applyText = "Apply") {
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "dialog-buttons";

  const cancelButton = document.createElement("button");
  cancelButton.className = "btn";
  cancelButton.textContent = cancelText;

  const applyButton = document.createElement("button");
  applyButton.className = "btn btn-primary";
  applyButton.textContent = applyText;

  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(applyButton);

  return { buttonContainer, cancelButton, applyButton };
}

// Create info element for displaying selection info
function createSelectionInfo(text) {
  const infoElement = document.createElement("div");
  infoElement.className = "dialog-selection-info";
  infoElement.textContent = text;
  return infoElement;
}

// Create a number input field
function createNumberInput(config) {
  const container = document.createElement("div");
  container.className = "dialog-slider-container";

  const label = document.createElement("label");
  label.className = "dialog-label";
  label.textContent = config.label;
  container.appendChild(label);

  const input = document.createElement("input");
  input.type = "number";
  input.className = "input-text native-key-bindings";
  input.value = config.default;
  input.min = config.min;
  input.max = config.max;
  input.style.width = "100%";
  container.appendChild(input);

  return { container, input };
}

// Create a checkbox control
function createCheckbox(id, labelText, checked = false) {
  const container = document.createElement("div");
  container.className = "dialog-slider-container";
  container.style.flexDirection = "row";
  container.style.alignItems = "center";
  container.style.gap = "8px";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = id;
  checkbox.checked = checked;

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;
  label.style.margin = "0";

  container.appendChild(checkbox);
  container.appendChild(label);

  return { container, checkbox };
}

// Create a row of quick-select buttons
function createQuickButtons(values, onClick, formatter = (v) => `${v}`) {
  const container = document.createElement("div");
  container.className = "dialog-slider-container";
  container.style.display = "flex";
  container.style.gap = "5px";
  container.style.flexWrap = "wrap";

  values.forEach((value) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.textContent = formatter(value);
    btn.addEventListener("click", () => onClick(value));
    container.appendChild(btn);
  });

  return container;
}

// Setup escape key handler for dialog
function setupEscapeHandler(backdrop, cleanup) {
  const escapeHandler = (e) => {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", escapeHandler);
      cleanup();
      if (document.body.contains(backdrop)) {
        document.body.removeChild(backdrop);
      }
    }
  };
  document.addEventListener("keydown", escapeHandler);
  return escapeHandler;
}

// Show a generic adjustment dialog with sliders
function showAdjustmentDialog(title, sliders, getSelectionArea, applyCallback, emitter) {
  const backdrop = createDialogBackdrop();
  const { dialogElement, cleanup: dialogCleanup } = createDraggableDialog(title);

  // Add selection info display
  const selectionInfo = createSelectionInfo("");
  const updateSelectionInfo = () => {
    const area = getSelectionArea();
    if (area) {
      if (area.hasSelection) {
        selectionInfo.textContent = `Will apply to selection: ${area.width}×${area.height}px`;
      } else {
        selectionInfo.textContent = "Will apply to entire image";
      }
    }
  };
  updateSelectionInfo();
  dialogElement.appendChild(selectionInfo);

  // Update selection info when mouse is released
  const selectionUpdateHandler = () => updateSelectionInfo();
  document.addEventListener("mouseup", selectionUpdateHandler);

  // Update selection info when selection visibility changes
  const selectionVisibilityHandler = () => updateSelectionInfo();
  emitter.on("selection-visibility-changed", selectionVisibilityHandler);

  // Create slider controls
  const sliderElements = [];
  sliders.forEach((config) => {
    const { container, slider } = createSliderControl(config);
    sliderElements.push(slider);
    dialogElement.appendChild(container);
  });

  // Create buttons
  const { buttonContainer, cancelButton, applyButton } = createButtonContainer();

  const fullCleanup = () => {
    dialogCleanup();
    document.removeEventListener("mouseup", selectionUpdateHandler);
    emitter.off("selection-visibility-changed", selectionVisibilityHandler);
    if (document.body.contains(backdrop)) {
      document.body.removeChild(backdrop);
    }
  };

  cancelButton.addEventListener("click", fullCleanup);

  applyButton.addEventListener("click", () => {
    const values = sliderElements.map((s) => parseFloat(s.value));
    applyCallback(values);
    fullCleanup();
  });

  dialogElement.appendChild(buttonContainer);
  backdrop.appendChild(dialogElement);
  document.body.appendChild(backdrop);

  // Setup escape handler
  const escapeHandler = setupEscapeHandler(backdrop, fullCleanup);

  // Focus the first slider
  if (sliderElements.length > 0) {
    sliderElements[0].focus();
  }

  return { backdrop, dialogElement, cleanup: fullCleanup };
}

module.exports = {
  createDialogBackdrop,
  createDraggableDialog,
  createSliderControl,
  createButtonContainer,
  createSelectionInfo,
  createNumberInput,
  createCheckbox,
  createQuickButtons,
  setupEscapeHandler,
  showAdjustmentDialog,
};
