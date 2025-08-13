# Session Timeout

Warn users when their session is about to expire. Dependency-free.

When this function is called (usually each time a page is loaded), two timers
start in the background:

1. A warning timer that shows a dialog when the session is about to expire
2. A timeout timer that calls the onTimeout callback when the session expires

The user has two options when the warning appears: Continue the session or log
out. If they choose to continue, the timers reset and a keep-alive request is
made. If they choose to log out or don't respond, the onTimeout callback will be
called.

Timers are synchronized across multiple tabs using Local Storage.

## Installation

### Method 1: npm

Install via npm.

```bash
npm install @travishorn/session-timeout
```

Import the library.

```javascript
import sessionTimeout from "@travishorn/session-timeout";
```

### Method 2: CDN

Import the library from jsDelivr.

```html
<script type="module">
  import sessionTimeout from "https://cdn.jsdelivr.net/npm/@travishorn/session-timeout";
</script>
```

### Method 3: Download

Download [src/session-timeout.js](src/session-timeout.js).

Import the library from the downloaded file.

```html
<script type="module">
  import sessionTimeout from "./session-timeout.js";
</script>
```

## Usage

Call it in your scripts.

```javascript
sessionTimeout();
```

Or, optionally provide options as an object.

```javascript
sessionTimeout({
  continueText: "Continue Session",
  logoutText: "Log Out",
  message: "Your session is about to expire.",
  onContinue: () => {
    // Called when user clicks continue (defaults to making keep-alive request)
  },
  onLogout: () => {
    // Called when user clicks logout
  },
  onTimeout: () => {
    // Called when session times out (defaults to redirecting to /timed-out)
  },
  timeoutAt: 20 * 60 * 1000, // Call onTimeout after 20 minutes
  warnAt: 15 * 60 * 1000, // Show warning after 15 minutes
});
```

## Options

| Option         | Type     | Default                                        | Description                                            |
| -------------- | -------- | ---------------------------------------------- | ------------------------------------------------------ |
| `continueText` | string   | `"Continue Session"`                           | Text for the continue button                           |
| `logoutText`   | string   | `"Log Out"`                                    | Text for the logout button                             |
| `message`      | string   | `"Your session is about to expire."`           | Message shown in the warning dialog                    |
| `onContinue`   | function | `() => fetch('/keep-alive?time=${timestamp}')` | Callback function called when user clicks continue     |
| `onLogout`     | function | `undefined`                                    | Callback function called when user clicks logout       |
| `onTimeout`    | function | `() => window.location.href = "/timed-out"`    | Callback function called when session times out        |
| `timeoutAt`    | number   | `20 * 60 * 1000` (20 minutes)                  | Time in milliseconds before calling onTimeout          |
| `warnAt`       | number   | `15 * 60 * 1000` (15 minutes)                  | Time in milliseconds before showing the warning dialog |

## Styling

The warning dialog can be customized using CSS. The dialog element has the class
`session-timeout-dialog` which you can target in your stylesheets.

```css
.session-timeout-dialog {
  /* Customize the dialog appearance */
}
.session-timeout-dialog p {
  /* Style the message text */
}
.session-timeout-dialog .buttons {
  /* Style the button container */
}
.session-timeout-dialog button {
  /* Style the buttons */
}
.session-timeout-dialog button[data-action="continue"] {
  /* Style the continue button */
}
.session-timeout-dialog button[data-action="logout"] {
  /* Style the logout button */
}
```

## API

The `sessionTimeout()` function returns an object with the following methods:

| Method      | Description                               |
| ----------- | ----------------------------------------- |
| `close()`   | Manually close the warning dialog         |
| `destroy()` | Clears all timers and removes the dialog  |
| `reset()`   | Closes the dialog and restarts the timers |
| `show()`    | Manually show the warning dialog          |

For example, if an external event extended the user's session (like a `fetch()`
call), you can reset the timers:

```javascript
const session = sessionTimeout();

// When session is extended
session.reset();
```

## License

The MIT License (MIT)

Copyright © 2025 Travis Horn

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the “Software”), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
