# Personal Notes Manager Frontend

This frontend is a React + Vite app for the personal notes manager. It connects to the FastAPI backend, displays notes in a Google Keep-style layout, and supports tag filtering, searching, pinning, and note editing.

## Stack

- React 19
- Vite
- Axios
- CSS-in-JSX styling

## Local Development

From this folder, install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

## Notes App Features

- Search notes by title and content
- Filter tags from the sidebar
- Create new notes from the floating action button
- Edit or delete a note
- Pin important notes to the top of the list

## Backend Dependency

The frontend expects the backend API to be running on:

```text
http://127.0.0.1:8000
```

See the root project README for full setup instructions.
