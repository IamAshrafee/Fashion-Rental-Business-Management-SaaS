import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true,
});

Object.defineProperty(globalThis, 'PointerEvent', {
  value: MouseEvent,
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  value: () => false,
});

Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  value: () => undefined,
});

Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
  value: () => undefined,
});
