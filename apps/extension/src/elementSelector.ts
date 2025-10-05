/**
 * Element selector utilities for remote control
 * Generates unique, stable CSS selectors for DOM elements
 */

/**
 * Generate a unique CSS selector for an element
 * Priority: id > data-* attributes > class + nth-child > tag + nth-child
 */
export function getElementSelector(element: Element): string | null {
  if (!(element instanceof Element)) {
    return null;
  }

  // 1. Try ID (most reliable)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // 2. Try data-testid or data-id (common in modern apps)
  const testId = element.getAttribute('data-testid') || element.getAttribute('data-id');
  if (testId) {
    const tag = element.tagName.toLowerCase();
    return `${tag}[data-testid="${CSS.escape(testId)}"], ${tag}[data-id="${CSS.escape(testId)}"]`;
  }

  // 3. Try name attribute for form elements
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    if (element.name) {
      const tag = element.tagName.toLowerCase();
      return `${tag}[name="${CSS.escape(element.name)}"]`;
    }
  }

  // 4. Build path with classes and nth-child
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add classes if available
    if (current.classList.length > 0) {
      const classes = Array.from(current.classList)
        .filter(cls => !cls.match(/^(hover|active|focus|disabled)/)) // Skip state classes
        .slice(0, 3) // Limit to 3 classes for brevity
        .map(cls => `.${CSS.escape(cls)}`)
        .join('');
      selector += classes;
    }

    // Add nth-child for uniqueness
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const index = siblings.indexOf(current) + 1;
      if (siblings.length > 1) {
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Find element by selector
 */
export function findElementBySelector(selector: string): Element | null {
  if (!selector) return null;

  try {
    return document.querySelector(selector);
  } catch (error) {
    console.error('[Weetle] Invalid selector:', selector, error);
    return null;
  }
}

/**
 * Simulate a click on an element
 */
export function simulateClick(element: Element): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  // First, try the native click method
  if ('click' in element && typeof element.click === 'function') {
    element.click();
    return;
  }

  // Fallback to dispatching events
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(clickEvent);
}

/**
 * Simulate keyboard input on an element
 */
export function simulateKeyboardInput(
  element: Element,
  key: string,
  code: string,
  modifiers: {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }
): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  // Focus the element first
  element.focus();

  // Dispatch keydown event
  const keydownEvent = new KeyboardEvent('keydown', {
    key,
    code,
    ...modifiers,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(keydownEvent);

  // For input elements, update the value
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (key.length === 1 && !modifiers.ctrlKey && !modifiers.metaKey) {
      // Single character input
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const currentValue = element.value;
      element.value =
        currentValue.substring(0, start) +
        key +
        currentValue.substring(end);
      element.selectionStart = element.selectionEnd = start + 1;

      // Trigger input event
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (key === 'Backspace') {
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const currentValue = element.value;

      if (start === end && start > 0) {
        // Delete one character before cursor
        element.value =
          currentValue.substring(0, start - 1) +
          currentValue.substring(end);
        element.selectionStart = element.selectionEnd = start - 1;
      } else if (start !== end) {
        // Delete selection
        element.value =
          currentValue.substring(0, start) +
          currentValue.substring(end);
        element.selectionStart = element.selectionEnd = start;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Dispatch keyup event
  const keyupEvent = new KeyboardEvent('keyup', {
    key,
    code,
    ...modifiers,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(keyupEvent);
}
