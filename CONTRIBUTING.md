# Contributing

Thanks for helping improve Local Eye Tracking. This project is an experimental browser app for local webcam-based attention feedback during typing practice.

## Development Setup

```bash
npm install
npm run dev
```

The local app runs at `http://127.0.0.1:5173/` by default.

## Useful Commands

```bash
npm test
npm run build
npm run analyze:evaluation -- <export.json>
```

Run tests and the production build before opening a pull request.

## Privacy Expectations

Do not commit webcam recordings, face images, student information, or private evaluation exports. The app is intended to process webcam frames locally in the browser, and contributions should preserve that local-only privacy model unless a change is explicitly discussed first.

## Accuracy Feedback

The most useful tracking feedback includes:

- Browser and operating system.
- Webcam position and lighting notes.
- Whether glasses, strong side light, or low light were involved.
- Which state failed, such as screen center, keyboard/down, off-left, off-right, leaning, or face missing.
- A user-triggered evaluation JSON export when it does not contain sensitive information.

Do not attach video or face screenshots to public issues.

## Pull Request Guidelines

- Keep changes focused.
- Prefer existing React, TypeScript, and domain module patterns.
- Add or update tests for classifier, calibration, smoothing, or evaluation logic changes.
- Avoid new remote services or network calls unless they are central to an approved change.
- Update the README when behavior, setup, privacy, or evaluation workflows change.
