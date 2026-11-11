
from fastapi import FastAPI, HTTPException
import uuid
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from models import NoteCreate, NoteUpdate, Note
from repository import read_all, write_all

app = FastAPI(title="Notes API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/notes", response_model=Note)
def create_note(note: NoteCreate):
    notes = read_all()
    new_note = {**note.dict(), "id": 
                str(uuid.uuid4())}
    notes.append(new_note)
    write_all(notes)
    return new_note

@app.get("/notes", response_model=List[Note])
def get_notes():
    return read_all()

@app.put("/notes/{id}", response_model=Note)
def update_note(id: str, update: NoteUpdate):
    notes = read_all()
    for n in notes:
        if n["id"] == id:
            if update.title is not None: n["title"] = update.title
            if update.content is not None: n["content"] = update.content
            if update.tags is not None: n["tags"] = update.tags
            write_all(notes)
            return n
    raise HTTPException(404, "Note not found")

@app.delete("/notes/{note_id}")
def delete_note(note_id: str):
    notes = read_all()
    new_notes = [n for n in notes if n["id"] != note_id]
    if len(new_notes) == len(notes):
        raise HTTPException(404, "Note not found")
    write_all(new_notes)
    return {"message": "Deleted"}

@app.get("/notes/search")
def search_notes(tag: str = "", keyword: str = ""):
    notes = read_all()
    result = []
    for n in notes:
        if tag and tag.lower() not in [t.lower() for t in n["tags"]]:
            continue
        if keyword and keyword.lower() not in (n["title"]+n["content"]).lower():
            continue
        result.append(n)
    return result