# Missing Person Identification System

A prototype web app for managing missing-person records and demonstrating an image-upload matching workflow.

## Features

- Upload an image and view a prototype match result.
- Add and review person records at `/records`.
- Store records in a local JSON file, or use MySQL when configured.

## Requirements

- Node.js 18 or later
- npm
- Optional: MySQL server

## Run locally

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is already in use, the server tries the next port and prints its address in the terminal.

Without a reachable MySQL server, the app uses `data/people.json` for storage and creates the data and upload directories automatically. To use MySQL, set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` before starting the server.

## Important limitations

This is a demonstration prototype, not a real facial-recognition system. Its matching score compares file-derived data with text descriptions; it does not verify a person's identity. Do not use results for real-world identification or safety decisions.

Person records and uploaded images may contain sensitive information. Keep them private and handle them only with appropriate consent and safeguards. Local record data and uploaded files are excluded from Git.
