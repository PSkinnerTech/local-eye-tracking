# Security Policy

## Supported Versions

This project is an experimental prototype. Security fixes are currently applied to the latest `main` branch and the latest tagged release.

## Privacy and Webcam Handling

Local Eye Tracking is designed to run webcam processing in the browser. The app does not upload video frames, images, recordings, calibration data, or evaluation exports to a server.

Evaluation exports are user-triggered JSON files that contain numeric feature samples and classifier output. Do not attach webcam recordings, face images, student information, or other sensitive data to public issues.

## Reporting a Vulnerability

If you find a security or privacy issue, please report it privately through GitHub's private vulnerability reporting for this repository if it is available. For non-sensitive bugs or feature requests, open a regular GitHub issue.

Please include:

- A short description of the issue.
- Steps to reproduce it.
- The browser, operating system, and deployment mode you tested.
- Whether any local files, webcam permissions, or exported evaluation files were involved.
