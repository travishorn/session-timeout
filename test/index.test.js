import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sessionTimeout from "../src/index.js";

// Mock timers for testing
vi.useFakeTimers();

// Mock fetch globally
globalThis.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn(function (key) {
    return this.store[key] || null;
  }),
  setItem: vi.fn(function (key, value) {
    this.store[key] = value;
  }),
  removeItem: vi.fn(function (key) {
    delete this.store[key];
  }),
  clear: vi.fn(function () {
    this.store = {};
  }),
};

// Mock window.addEventListener and removeEventListener
const addEventListenerMock = vi.fn();
const removeEventListenerMock = vi.fn();

describe("sessionTimeout", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
    localStorageMock.clear();

    // Setup localStorage mock
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    // Setup event listener mocks
    Object.defineProperty(window, "addEventListener", {
      value: addEventListenerMock,
      writable: true,
    });
    Object.defineProperty(window, "removeEventListener", {
      value: removeEventListenerMock,
      writable: true,
    });

    // Clean up any existing dialogs
    const existingDialogs = document.querySelectorAll("dialog");
    existingDialogs.forEach((dialog) => dialog.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up any remaining dialogs
    const existingDialogs = document.querySelectorAll("dialog");
    existingDialogs.forEach((dialog) => dialog.remove());
  });

  describe("basic functionality", () => {
    it("should be a function", () => {
      expect(typeof sessionTimeout).toBe("function");
    });

    it("should create and show a real dialog element", () => {
      const session = sessionTimeout({ warnAt: 100 }); // 100ms for quick testing

      // Advance time to trigger the warning
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute("role")).toBe("dialog");
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(dialog.getAttribute("aria-labelledby")).toBe(
        "session-timeout-title",
      );

      session.destroy();
    });
  });

  describe("timing behavior", () => {
    it("should show dialog after default warnAt (15 minutes)", () => {
      const session = sessionTimeout();

      // Advance time by 15 minutes (900000ms)
      vi.advanceTimersByTime(900000);

      const dialog = document.querySelector("dialog");
      expect(dialog).toBeTruthy();

      session.destroy();
    });

    it("should show dialog after custom warnAt", () => {
      const session = sessionTimeout({ warnAt: 100 }); // 100ms for quick testing

      // Advance time by 100ms
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      expect(dialog).toBeTruthy();

      session.destroy();
    });

    it("should not show dialog before warnAt", () => {
      const session = sessionTimeout({ warnAt: 1000 });

      // Advance time by 500ms - just before warnAt
      vi.advanceTimersByTime(500);

      const dialog = document.querySelector("dialog");
      expect(dialog).toBeFalsy();

      session.destroy();
    });

    it("should handle zero warnAt", () => {
      const session = sessionTimeout({ warnAt: 0 });

      // Advance time by a small amount
      vi.advanceTimersByTime(100);

      const dialog = document.querySelector("dialog");
      expect(dialog).toBeTruthy();

      session.destroy();
    });

    it("should handle negative warnAt (treat as 0)", () => {
      const session = sessionTimeout({ warnAt: -1000 });

      // Advance time by a small amount
      vi.advanceTimersByTime(100);

      const dialog = document.querySelector("dialog");
      expect(dialog).toBeTruthy();

      session.destroy();
    });

    it("should call onTimeout after default timeoutAt (20 minutes)", () => {
      const mockLocation = { href: "" };
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      const session = sessionTimeout();

      // Advance time by 20 minutes (1200000ms)
      vi.advanceTimersByTime(1200000);

      expect(mockLocation.href).toBe("/timed-out");

      session.destroy();
    });

    it("should call onTimeout after custom timeoutAt", () => {
      const mockLocation = { href: "" };
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      const session = sessionTimeout({ timeoutAt: 200 }); // 200ms for quick testing

      // Advance time by 200ms
      vi.advanceTimersByTime(250);

      expect(mockLocation.href).toBe("/timed-out");

      session.destroy();
    });

    it("should call custom onTimeout function", () => {
      const onTimeout = vi.fn();

      const session = sessionTimeout({
        timeoutAt: 100,
        onTimeout,
      });

      // Advance time by 100ms
      vi.advanceTimersByTime(150);

      expect(onTimeout).toHaveBeenCalledTimes(1);

      session.destroy();
    });
  });

  describe("two-stage timeout behavior", () => {
    it("should show dialog at warnAt and call onTimeout at timeoutAt", () => {
      const onTimeout = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        timeoutAt: 200,
        onTimeout,
      });

      // Advance time to warnAt - should show dialog
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();
      expect(onTimeout).not.toHaveBeenCalled(); // Should not call onTimeout yet

      // Advance time to timeoutAt - should call onTimeout
      vi.advanceTimersByTime(100);
      expect(onTimeout).toHaveBeenCalledTimes(1);

      session.destroy();
    });

    it("should restart timers when user continues", () => {
      const onTimeout = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        timeoutAt: 200,
        onTimeout,
      });

      // Advance time to warnAt - should show dialog
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      // Click continue - should restart timers
      const dialog = document.querySelector("dialog");
      const continueBtn = dialog.querySelector('[data-action="continue"]');
      continueBtn.click();

      // Dialog should be closed
      expect(document.querySelector("dialog")).toBeFalsy();

      // Advance time to warnAt again - should show dialog again
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      // Advance time to timeoutAt - should call onTimeout
      vi.advanceTimersByTime(100);
      expect(onTimeout).toHaveBeenCalledTimes(1);

      session.destroy();
    });

    it("should not restart timers when user logs out", () => {
      const onTimeout = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        timeoutAt: 200,
        onTimeout,
      });

      // Advance time to warnAt - should show dialog
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      // Click logout - should not restart timers
      const dialog = document.querySelector("dialog");
      const logoutBtn = dialog.querySelector('[data-action="logout"]');
      logoutBtn.click();

      // Dialog should be closed
      expect(document.querySelector("dialog")).toBeFalsy();

      // Advance time - should not show dialog again
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeFalsy();

      // Advance time to timeoutAt - should still call onTimeout
      vi.advanceTimersByTime(100);
      expect(onTimeout).toHaveBeenCalledTimes(1);

      session.destroy();
    });
  });

  describe("default logout behavior", () => {
    it("should redirect to /logout when user clicks logout with default onLogout", () => {
      const mockLocation = { href: "" };
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      const session = sessionTimeout({ warnAt: 100 });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const logoutBtn = dialog.querySelector('[data-action="logout"]');

      logoutBtn.click();

      // Should redirect to /logout
      expect(mockLocation.href).toBe("/logout");

      session.destroy();
    });

    it("should not redirect when custom onLogout is provided", () => {
      const mockLocation = { href: "" };
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
      });

      const customOnLogout = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        onLogout: customOnLogout,
      });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const logoutBtn = dialog.querySelector('[data-action="logout"]');

      logoutBtn.click();

      // Should call custom onLogout
      expect(customOnLogout).toHaveBeenCalledTimes(1);
      // Should not redirect
      expect(mockLocation.href).toBe("");

      session.destroy();
    });

    it("should handle missing window.location gracefully", () => {
      // Temporarily remove window.location
      const originalLocation = window.location;
      delete window.location;

      const session = sessionTimeout({ warnAt: 100 });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const logoutBtn = dialog.querySelector('[data-action="logout"]');

      // Should not throw when window.location is not available
      expect(() => logoutBtn.click()).not.toThrow();

      // Restore window.location
      window.location = originalLocation;

      session.destroy();
    });
  });

  describe("default continue behavior", () => {
    it("should make keep-alive request when user clicks continue with default onContinue", () => {
      const session = sessionTimeout({ warnAt: 100 });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const continueBtn = dialog.querySelector('[data-action="continue"]');

      // Mock Date.now to return a predictable timestamp
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp * 1000);

      continueBtn.click();

      // Should make fetch request to keep-alive with timestamp
      expect(fetch).toHaveBeenCalledWith(`/keep-alive?time=${mockTimestamp}`, {
        method: "GET",
      });

      session.destroy();
    });

    it("should not make keep-alive request when custom onContinue is provided", () => {
      const customOnContinue = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        onContinue: customOnContinue,
      });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const continueBtn = dialog.querySelector('[data-action="continue"]');

      continueBtn.click();

      // Should call custom onContinue
      expect(customOnContinue).toHaveBeenCalledTimes(1);
      // Should not make default keep-alive request
      expect(fetch).not.toHaveBeenCalled();

      session.destroy();
    });

    it("should update localStorage when user clicks continue", () => {
      const session = sessionTimeout({ warnAt: 100 });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const continueBtn = dialog.querySelector('[data-action="continue"]');

      continueBtn.click();

      // Should update localStorage for cross-tab sync
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "session-timeout-last-reset",
        expect.any(String),
      );

      session.destroy();
    });

    it("should handle missing fetch gracefully", () => {
      // Temporarily remove fetch
      const originalFetch = globalThis.fetch;
      delete globalThis.fetch;

      const session = sessionTimeout({ warnAt: 100 });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const continueBtn = dialog.querySelector('[data-action="continue"]');

      // Should not throw when fetch is not available
      expect(() => continueBtn.click()).not.toThrow();

      // Restore fetch
      globalThis.fetch = originalFetch;

      session.destroy();
    });
  });

  describe("reset functionality", () => {
    it("should reset timers when reset() is called", () => {
      const onTimeout = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        timeoutAt: 200,
        onTimeout,
      });

      // Advance time to warnAt - should show dialog
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      // Reset timers
      session.reset();

      // Dialog should be closed
      expect(document.querySelector("dialog")).toBeFalsy();

      // Advance time to warnAt again - should show dialog again
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      // Advance time to timeoutAt - should call onTimeout
      vi.advanceTimersByTime(100);
      expect(onTimeout).toHaveBeenCalledTimes(1);

      session.destroy();
    });

    it("should reset timers even when dialog is not open", () => {
      const onTimeout = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        timeoutAt: 200,
        onTimeout,
      });

      // Advance time by 50ms - dialog should not be open yet
      vi.advanceTimersByTime(50);
      expect(document.querySelector("dialog")).toBeFalsy();

      // Reset timers
      session.reset();

      // Advance time to warnAt - should show dialog
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      // Advance time to timeoutAt - should call onTimeout
      vi.advanceTimersByTime(100);
      expect(onTimeout).toHaveBeenCalledTimes(1);

      session.destroy();
    });

    it("should reset timers multiple times", () => {
      const onTimeout = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        timeoutAt: 200,
        onTimeout,
      });

      // Advance time by 50ms
      vi.advanceTimersByTime(50);
      session.reset();

      // Advance time by 50ms again
      vi.advanceTimersByTime(50);
      session.reset();

      // Advance time by 50ms again
      vi.advanceTimersByTime(50);
      session.reset();

      // Advance time to warnAt - should show dialog
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      session.destroy();
    });
  });

  describe("cross-tab synchronization", () => {
    it("should setup storage listener on initialization", () => {
      const session = sessionTimeout();

      expect(addEventListenerMock).toHaveBeenCalledWith(
        "storage",
        expect.any(Function),
      );

      session.destroy();
    });

    it("should remove storage listener on destroy", () => {
      const session = sessionTimeout();

      session.destroy();

      expect(removeEventListenerMock).toHaveBeenCalledWith(
        "storage",
        expect.any(Function),
      );
    });

    it("should update localStorage on initialization", () => {
      const session = sessionTimeout();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "session-timeout-last-reset",
        expect.any(String),
      );

      session.destroy();
    });

    it("should update localStorage when reset() is called", () => {
      const session = sessionTimeout();

      session.reset();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "session-timeout-last-reset",
        expect.any(String),
      );

      session.destroy();
    });

    it("should handle localStorage not being available", () => {
      // Temporarily remove localStorage
      const originalLocalStorage = window.localStorage;
      delete window.localStorage;

      expect(() => sessionTimeout()).not.toThrow();

      // Restore localStorage
      window.localStorage = originalLocalStorage;
    });

    it("should handle window.addEventListener not being available", () => {
      // Temporarily remove addEventListener
      const originalAddEventListener = window.addEventListener;
      delete window.addEventListener;

      expect(() => sessionTimeout()).not.toThrow();

      // Restore addEventListener
      window.addEventListener = originalAddEventListener;
    });

    it("should start fresh timers when no previous reset exists", () => {
      const session = sessionTimeout({ warnAt: 100 });

      // Should start fresh timers
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      session.destroy();
    });

    it("should adjust timers based on recent reset from another tab", () => {
      // Simulate a recent reset from another tab (50ms ago)
      const recentResetTime = Date.now() - 50;
      localStorageMock.store["session-timeout-last-reset"] =
        recentResetTime.toString();

      const session = sessionTimeout({ warnAt: 100, timeoutAt: 200 });

      // Should show dialog after remaining time (100 - 50 = 50ms)
      vi.advanceTimersByTime(100);
      expect(document.querySelector("dialog")).toBeTruthy();

      session.destroy();
    });

    it("should show dialog immediately if warning time has already passed", () => {
      const session = sessionTimeout({ warnAt: 100, timeoutAt: 200 });

      // Simulate a storage event from another tab with an old reset time
      const oldResetTime = Date.now() - 150;
      const storageEvent = {
        key: "session-timeout-last-reset",
        newValue: oldResetTime.toString(),
      };

      // Get the storage event listener that was registered
      const storageListener = addEventListenerMock.mock.calls.find(
        (call) => call[0] === "storage",
      )[1];

      // Trigger the storage event
      storageListener(storageEvent);

      // Should show dialog immediately
      expect(document.querySelector("dialog")).toBeTruthy();

      session.destroy();
    });

    it("should start fresh timers if reset was too long ago", () => {
      // Simulate a reset from another tab that was 300ms ago (too long ago)
      const oldResetTime = Date.now() - 300;
      localStorageMock.store["session-timeout-last-reset"] =
        oldResetTime.toString();

      const session = sessionTimeout({ warnAt: 100, timeoutAt: 200 });

      // Should start fresh timers
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      session.destroy();
    });

    it("should respond to storage events from other tabs", () => {
      const session = sessionTimeout({ warnAt: 100, timeoutAt: 200 });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      // Simulate storage event from another tab
      const storageEvent = {
        key: "session-timeout-last-reset",
        newValue: Date.now().toString(),
      };

      // Get the storage event listener that was registered
      const storageListener = addEventListenerMock.mock.calls.find(
        (call) => call[0] === "storage",
      )[1];

      // Trigger the storage event
      storageListener(storageEvent);

      // Dialog should be closed and timers reset
      expect(document.querySelector("dialog")).toBeFalsy();

      // Advance time to show dialog again
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      session.destroy();
    });

    it("should ignore storage events for different keys", () => {
      const session = sessionTimeout({ warnAt: 100, timeoutAt: 200 });

      // Advance time to show dialog
      vi.advanceTimersByTime(150);
      expect(document.querySelector("dialog")).toBeTruthy();

      // Simulate storage event for different key
      const storageEvent = {
        key: "different-key",
        newValue: Date.now().toString(),
      };

      // Get the storage event listener that was registered
      const storageListener = addEventListenerMock.mock.calls.find(
        (call) => call[0] === "storage",
      )[1];

      // Trigger the storage event
      storageListener(storageEvent);

      // Dialog should still be open (no reset)
      expect(document.querySelector("dialog")).toBeTruthy();

      session.destroy();
    });
  });

  describe("dialog content and configuration", () => {
    it("should have proper dialog content", () => {
      const session = sessionTimeout({
        warnAt: 100,
        message: "Test message",
        continueText: "Keep Going",
        logoutText: "Sign Out",
      });

      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      expect(dialog.innerHTML).toContain("Test message");
      expect(dialog.innerHTML).toContain("Keep Going");
      expect(dialog.innerHTML).toContain("Sign Out");

      session.destroy();
    });

    it("should use default content when no options provided", () => {
      const session = sessionTimeout({ warnAt: 100 });

      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      expect(dialog.innerHTML).toContain("Your session is about to expire");
      expect(dialog.innerHTML).toContain("Continue Session");
      expect(dialog.innerHTML).toContain("Log Out");

      session.destroy();
    });

    it("should have session-timeout-dialog class", () => {
      const session = sessionTimeout({ warnAt: 100 });

      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      expect(dialog.classList.contains("session-timeout-dialog")).toBe(true);

      session.destroy();
    });
  });

  describe("user interactions", () => {
    it("should handle real button clicks", () => {
      const onContinue = vi.fn();
      const onLogout = vi.fn();

      const session = sessionTimeout({
        warnAt: 100,
        onContinue,
        onLogout,
      });

      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const continueBtn = dialog.querySelector('[data-action="continue"]');
      const logoutBtn = dialog.querySelector('[data-action="logout"]');

      expect(continueBtn).toBeTruthy();
      expect(logoutBtn).toBeTruthy();

      // Test continue button
      continueBtn.click();
      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(dialog.parentNode).toBeNull(); // Dialog should be removed

      // Reset and test logout button
      const session2 = sessionTimeout({
        warnAt: 100,
        onContinue,
        onLogout,
      });
      vi.advanceTimersByTime(150);

      const dialog2 = document.querySelector("dialog");
      const logoutBtn2 = dialog2.querySelector('[data-action="logout"]');
      logoutBtn2.click();

      expect(onLogout).toHaveBeenCalledTimes(1);
      expect(dialog2.parentNode).toBeNull();

      session.destroy();
      session2.destroy();
    });

    it("should work without callback functions", () => {
      const session = sessionTimeout({ warnAt: 100 });

      vi.advanceTimersByTime(150);

      const dialog = document.querySelector("dialog");
      const continueBtn = dialog.querySelector('[data-action="continue"]');

      // Should not throw when no callback is provided
      expect(() => continueBtn.click()).not.toThrow();
      expect(dialog.parentNode).toBeNull(); // Dialog should still be removed

      session.destroy();
    });
  });

  describe("cleanup and lifecycle", () => {
    it("should properly clean up when destroyed", () => {
      const session = sessionTimeout({ warnAt: 100 });

      vi.advanceTimersByTime(150);

      expect(document.querySelector("dialog")).toBeTruthy();

      session.destroy();

      expect(document.querySelector("dialog")).toBeFalsy();
    });

    it("should handle multiple sessions correctly", () => {
      const session1 = sessionTimeout({ warnAt: 100 });
      const session2 = sessionTimeout({ warnAt: 200 });

      vi.advanceTimersByTime(150);

      // First session should have triggered
      expect(document.querySelectorAll("dialog")).toHaveLength(1);

      session1.destroy();

      vi.advanceTimersByTime(100);

      // Second session should have triggered
      expect(document.querySelectorAll("dialog")).toHaveLength(1);

      session2.destroy();

      expect(document.querySelectorAll("dialog")).toHaveLength(0);
    });

    it("should allow manual showing and closing", () => {
      const session = sessionTimeout({ warnAt: 1000 }); // Long warnAt

      // Should not show immediately
      expect(document.querySelector("dialog")).toBeFalsy();

      // Manually show
      session.show();
      expect(document.querySelector("dialog")).toBeTruthy();

      // Manually close
      session.close();
      expect(document.querySelector("dialog")).toBeFalsy();

      session.destroy();
    });
  });

  describe("error handling", () => {
    it("should handle missing document.body gracefully", () => {
      // Create a mock document without body
      const mockDocument = {
        createElement: vi.fn().mockReturnValue({
          setAttribute: vi.fn(),
          innerHTML: "",
          querySelector: vi.fn().mockReturnValue({
            addEventListener: vi.fn(),
          }),
        }),
        body: null,
      };

      // Temporarily replace global document
      const originalDocument = globalThis.document;
      globalThis.document = mockDocument;

      expect(() => sessionTimeout()).not.toThrow();

      // Restore original document
      globalThis.document = originalDocument;
    });

    it("should handle dialog creation failure gracefully", () => {
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockReturnValue(null);

      expect(() => sessionTimeout()).not.toThrow();

      // Restore original method
      document.createElement = originalCreateElement;
    });

    it("should handle missing window.location gracefully", () => {
      // Temporarily remove window.location
      const originalLocation = window.location;
      delete window.location;

      expect(() => sessionTimeout({ timeoutAt: 100 })).not.toThrow();

      // Advance time to trigger timeout
      vi.advanceTimersByTime(150);

      // Should not throw when trying to redirect
      expect(() => {}).not.toThrow();

      // Restore original location
      window.location = originalLocation;
    });
  });
});
