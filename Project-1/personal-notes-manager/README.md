# Personal Notes Manager

A lightweight personal notes application with a FastAPI backend and a React + Vite frontend. It stores notes in a local JSON file, supports tagging, searching, and basic note management, and was built as a simple, fast workspace for everyday note-taking.

## Overview

This project is split into two parts:

- Backend: FastAPI REST API for creating, reading, updating, and deleting notes
- Frontend: React app for managing notes in a clean dashboard-style interface

## Features

- Create, edit, and delete notes
- Search notes by title/content
- Filter notes by tag
- Pin notes to the top of the list
- Store notes in a JSON file for a lightweight local database
- CORS-enabled API for local frontend integration

## Tech Stack

- Python 3.13
- FastAPI
- Pydantic
- React 19
- Vite
- Axios

## Project Structure

```text
personal-notes-manager/
├── backend/
│   ├── .venv/
│   ├── main.py
│   ├── models.py
│   ├── notes.json
│   ├── repository.py
│   └── test_openai.py
├── frontend/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── README.md
│   └── vite.config.js
├── README.md
└── .gitignore (if present in your environment)
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm

## Backend Setup

1. Open a terminal and go to the backend folder:

```bash
cd backend
```

2. Create or activate the virtual environment:

```bash
.\.venv\Scripts\activate
```

If the environment is not available, create it with:

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install fastapi uvicorn pydantic python-dotenv openai
```

3. Run the API server:

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at:

- http://127.0.0.1:8000/docs
- http://127.0.0.1:8000/notes

## Frontend Setup

1. Open a terminal in the frontend folder:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the app in development mode:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

4. Open the Vite app in a browser:

```text
http://127.0.0.1:5173
```

## API Endpoints

### Create a note

```http
POST /notes
```

Request body:

```json
{
  "title": "Meeting notes",
  "content": "Discuss launch timeline",
  "tags": ["work", "planning"]
}
```

### Get all notes

```http
GET /notes
```

### Update a note

```http
PUT /notes/{id}
```

### Delete a note

```http
DELETE /notes/{note_id}
```

### Search notes

```http
GET /notes/search?keyword=launch&tag=work
```

## Environment Variables

If you want to run the OpenAI connectivity check in `backend/test_openai.py`, create a `.env` file in the backend folder:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Then run:

```bash
python test_openai.py
```

## Notes Storage

The backend stores all notes in:

```text
backend/notes.json
```

This file is simple JSON and is suitable for a lightweight local storage setup without a database.

## Validation

I checked the project by running the available validation commands:

```bash
cd frontend
"C:\Program Files\nodejs\npm.cmd" run build
```

Result: Vite production build succeeded.

```bash
cd backend
.\.venv\Scripts\python -m py_compile main.py models.py repository.py
```

Result: Python files compiled without syntax errors.

## Troubleshooting

- If the frontend cannot reach the backend, ensure the FastAPI server is running on port 8000.
- If npm is blocked by PowerShell execution policy, run npm through the explicit executable:

```bash
& "C:\Program Files\nodejs\npm.cmd" run dev
```

- If the OpenAI API check fails, confirm the `.env` file exists and the API key is valid.

## Summary

This project is a clean starter for a personal notes manager with quick local setup, JSON-based persistence, and a dashboard-like UI. It is easy to extend with features like categories, markdown support, authentication, or database-backed storage.
