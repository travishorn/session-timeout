export default function sessionTimeout(options = {}) {
  const {
    warnAt = 15 * 60 * 1000, // 15 minutes default
    timeoutAt = 20 * 60 * 1000, // 20 minutes default
    onTimeout = () => {
      // Default timeout handler - redirect to /timed-out
      if (typeof window !== "undefined" && window.location) {
        window.location.href = "/timed-out";
      }
    },
    onContinue = () => {
      // Default continue handler - make keep-alive request
      if (typeof fetch !== "undefined") {
        const timestamp = Math.floor(Date.now() / 1000);
        fetch(`/keep-alive?time=${timestamp}`, { method: "GET" });
      }
    },
    message = "Your session is about to expire.",
    continueText = "Continue Session",
    logoutText = "Log Out",
    onLogout = () => {
      // Default logout handler - redirect to /logout
      if (typeof window !== "undefined" && window.location) {
        window.location.href = "/logout";
      }
    },
  } = options;

  let warnTimeoutId = null;
  let redirectTimeoutId = null;
  let dialog = null;
  let storageKey = "session-timeout-last-reset";
  let storageEventListener = null;

  const createDialog = () => {
    dialog = document.createElement("dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "session-timeout-title");
    dialog.classList.add("session-timeout-dialog");

    dialog.innerHTML = `
      <p>${message}</p>
      <div class="buttons">
        <button data-action="continue">${continueText}</button>
        <button data-action="logout">${logoutText}</button>
      </div>
    `;

    // Add event listeners
    const continueBtn = dialog.querySelector('[data-action="continue"]');
    const logoutBtn = dialog.querySelector('[data-action="logout"]');

    continueBtn.addEventListener("click", handleContinue);
    logoutBtn.addEventListener("click", handleLogout);

    return dialog;
  };

  const handleContinue = () => {
    if (onContinue) onContinue();
    closeDialog();
    // Update the last reset time in localStorage for cross-tab sync
    updateLastResetTime();
    // Restart timers after continuing
    startTimers();
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
    closeDialog();
    // Don't restart timers on logout
  };

  const closeDialog = () => {
    if (dialog) {
      // Check if close method exists (for environments like jsdom that don't support it)
      if (typeof dialog.close === "function") {
        dialog.close();
      }
      if (document.body.contains(dialog)) {
        document.body.removeChild(dialog);
      }
      dialog = null;
    }
  };

  const showDialog = () => {
    if (!dialog) {
      dialog = createDialog();
      document.body.appendChild(dialog);
    }
    // Check if showModal method exists (for environments like jsdom that don't support it)
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  };

  const handleTimeout = () => {
    closeDialog(); // Close dialog if still open
    if (onTimeout) onTimeout();
  };

  const updateLastResetTime = () => {
    if (typeof localStorage !== "undefined") {
      const timestamp = Date.now();
      localStorage.setItem(storageKey, timestamp.toString());
    }
  };

  const getLastResetTime = () => {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      return stored ? parseInt(stored, 10) : null;
    }
    return null;
  };

  const handleStorageChange = (event) => {
    if (event.key === storageKey && event.newValue) {
      // Another tab reset the timers, so we should reset ours too
      const newResetTime = parseInt(event.newValue, 10);
      const currentTime = Date.now();
      const timeSinceReset = currentTime - newResetTime;

      // If warning time has already passed, show dialog immediately
      if (timeSinceReset >= warnAt) {
        closeDialog();
        showDialog();
      }
      // Only reset if the new reset time is more recent than our current timers
      else if (timeSinceReset < Math.min(warnAt, timeoutAt)) {
        closeDialog();
        startTimers();
      }
    }
  };

  const setupStorageListener = () => {
    if (
      typeof window !== "undefined" &&
      typeof addEventListener !== "undefined"
    ) {
      storageEventListener = handleStorageChange;
      window.addEventListener("storage", storageEventListener);
    }
  };

  const removeStorageListener = () => {
    if (
      storageEventListener &&
      typeof window !== "undefined" &&
      typeof removeEventListener !== "undefined"
    ) {
      window.removeEventListener("storage", storageEventListener);
      storageEventListener = null;
    }
  };

  const startTimers = () => {
    // Clear any existing timers
    if (warnTimeoutId) {
      clearTimeout(warnTimeoutId);
      warnTimeoutId = null;
    }
    if (redirectTimeoutId) {
      clearTimeout(redirectTimeoutId);
      redirectTimeoutId = null;
    }

    // Handle zero or negative timeouts
    const actualWarnAt = Math.max(0, warnAt);
    const actualTimeoutAt = Math.max(0, timeoutAt);

    // Set warning timer
    warnTimeoutId = setTimeout(() => {
      showDialog();
    }, actualWarnAt);

    // Set timeout timer
    redirectTimeoutId = setTimeout(() => {
      handleTimeout();
    }, actualTimeoutAt);
  };

  const reset = () => {
    // Close dialog if it's open
    closeDialog();
    // Update the last reset time in localStorage
    updateLastResetTime();
    // Restart timers
    startTimers();
  };

  const destroy = () => {
    if (warnTimeoutId) {
      clearTimeout(warnTimeoutId);
      warnTimeoutId = null;
    }
    if (redirectTimeoutId) {
      clearTimeout(redirectTimeoutId);
      redirectTimeoutId = null;
    }
    closeDialog();
    removeStorageListener();
  };

  // Setup storage listener for cross-tab synchronization
  setupStorageListener();

  // Update localStorage on initialization to indicate this tab is active
  updateLastResetTime();

  // Check if there's a recent reset from another tab
  const lastResetTime = getLastResetTime();
  if (lastResetTime) {
    const timeSinceReset = Date.now() - lastResetTime;
    const minTimeout = Math.min(warnAt, timeoutAt);

    // If warning time has already passed, show dialog immediately
    if (timeSinceReset >= warnAt) {
      showDialog();
    }
    // If the last reset was recent enough, adjust our timers
    else if (timeSinceReset < minTimeout) {
      // Start timers with adjusted delays
      const remainingWarnTime = Math.max(0, warnAt - timeSinceReset);
      const remainingTimeoutTime = Math.max(0, timeoutAt - timeSinceReset);

      if (remainingWarnTime > 0) {
        warnTimeoutId = setTimeout(() => {
          showDialog();
        }, remainingWarnTime);
      }

      if (remainingTimeoutTime > 0) {
        redirectTimeoutId = setTimeout(() => {
          handleTimeout();
        }, remainingTimeoutTime);
      }
    } else {
      // Start fresh timers
      startTimers();
    }
  } else {
    // No previous reset, start fresh timers
    startTimers();
  }

  // Return public API
  return {
    destroy,
    show: showDialog,
    close: closeDialog,
    reset,
  };
}
