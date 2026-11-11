import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000/notes';

const TAG_COLORS = {
  work: '#E8F0FE', finance: '#E6F4EA', health: '#FCE8E6',
  ideas: '#FEF7E0', personal: '#F3E8FD', recipes: '#FCE4EC',
  shopping: '#E0F7FA', python: '#E8F0FE', default: '#F1F3F4'
};

function App() {
  const [notes, setNotes] = useState([]);
  const [formData, setFormData] = useState({ title: '', content: '', tags: '' });
  const [searchText, setSearchText] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sidebarView, setSidebarView] = useState('all');
  const [pinnedIds, setPinnedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get(API_URL);
      setNotes(res.data);
    } catch (e) { console.error(e); }
  };

  const createNote = async (e) => {
    e.preventDefault();
    const tagsArray = formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    await axios.post(API_URL, { ...formData, tags: tagsArray });
    setFormData({ title: '', content: '', tags: '' });
    setShowForm(false);
    fetchNotes();
  };
  const startEdit = (note) => {
  setFormData({ title: note.title, content: note.content, tags: note.tags ? note.tags.join(', ') : '' });
  setEditingId(note.id);
  setShowForm(true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
  const deleteNote = async (id) => {
    if (!window.confirm('Move to trash?')) return;
    await axios.delete(`${API_URL}/${id}`);
    fetchNotes();
  };

  const togglePin = (id) => {
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const allTags = useMemo(() => {
    const s = new Set();
    notes.forEach(n => (n.tags || []).forEach(t => s.add(t.toLowerCase())));
    return [...s];
  }, [notes]);

  const filtered = notes.filter(n => {
    if (sidebarView === 'archive' || sidebarView === 'trash') return false;
    if (selectedTag !== 'all' && !(n.tags || []).map(t=>t.toLowerCase()).includes(selectedTag)) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const pinned = filtered.filter(n => pinnedIds.includes(n.id));
  const others = filtered.filter(n => !pinnedIds.includes(n.id));

  const NoteCard = ({ note }) => (
    <div style={{ background: 'white', border: '1px solid #E8EAED', borderRadius: '16px', padding: '18px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: '700' }}>{note.title}</h3>
        <button onClick={() => togglePin(note.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }} title="Pin">
          {pinnedIds.includes(note.id) ? '📌' : '📍'}
        </button>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#5F6368', lineHeight: '1.5', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{note.content}</p>
      {note.summary && <p style={{ fontSize: '12px', background: '#E8F0FE', padding: '8px', borderRadius: '8px' }}>✨ {note.summary}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {(note.tags || []).map(tag => (
          <span key={tag} onClick={() => setSelectedTag(tag.toLowerCase())} style={{ background: TAG_COLORS[tag.toLowerCase()] || TAG_COLORS.default, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize' }}>{tag}</span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F3F4', paddingTop: '10px' }}>
        <span style={{ fontSize: '12px', color: '#9AA0A6' }}>Just now • {note.tags?.length || 0} tags</span>
         <button onClick={() => { setFormData({ title: note.title, content: note.content, tags: (note.tags || []).join(', ') }); setEditingId(note.id); setShowForm(true); }}>Edit</button>
        <button onClick={() => deleteNote(note.id)} style={{ border: 'none', background: '#FCE8E6', color: '#D93025', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>🗑 Delete</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: '#F8F9FA' }}>
      {/* SIDEBAR */}
      <div style={{ width: '260px', background: 'white', borderRight: '1px solid #E8EAED', padding: '20px', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
          <div style={{ width: '32px', height: '32px', background: '#1A73E8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800' }}>A</div>
          <span style={{ fontSize: '20px', fontWeight: '800' }}>Anchor</span>
        </div>
        <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '12px', background: '#1A73E8', color: 'white', border: 'none', borderRadius: '24px', fontWeight: '700', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' }}>+ New Note</button>
        <p style={{ fontSize: '11px', letterSpacing: '1px', color: '#9AA0A6', fontWeight: '700' }}>MENU</p>
        {[
          { id: 'all', label: 'All Notes', icon: '📝' },
          { id: 'archive', label: 'Archive', icon: '📦' },
          { id: 'trash', label: 'Trash', icon: '🗑️' },
        ].map(m => (
          <div key={m.id} onClick={() => { setSidebarView(m.id); setSelectedTag('all'); }} style={{ padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', background: sidebarView === m.id ? '#E8F0FE' : 'transparent', color: sidebarView === m.id ? '#1A73E8' : '#3C4043', fontWeight: sidebarView === m.id ? '700' : '500', marginBottom: '4px' }}>{m.icon} &nbsp;{m.label} <span style={{ float: 'right', color: '#9AA0A6' }}>{m.id === 'all' ? notes.length : 0}</span></div>
        ))}
        <p style={{ fontSize: '11px', letterSpacing: '1px', color: '#9AA0A6', fontWeight: '700', marginTop: '24px' }}>TAGS</p>
        <div onClick={() => { setSelectedTag('all'); setSidebarView('all'); }} style={{ padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', background: selectedTag === 'all' ? '#F1F3F4' : 'transparent' }}>🏷️ &nbsp;All Tags</div>
        {allTags.length === 0 && <p style={{ fontSize: '13px', color: '#9AA0A6', padding: '8px 12px' }}>No tags yet. Add a note with tags!</p>}
        {allTags.map(tag => (
          <div key={tag} onClick={() => { setSelectedTag(tag); setSidebarView('all'); }} style={{ padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', background: selectedTag === tag ? '#F1F3F4' : 'transparent', textTransform: 'capitalize' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: TAG_COLORS[tag] || '#ccc', marginRight: '8px' }}></span>{tag}
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: '28px 32px', maxWidth: '1100px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input placeholder="🔍 Search notes..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ flex: 1, padding: '13px 18px', borderRadius: '24px', border: '1px solid #E8EAED', background: 'white', fontSize: '14px', outline: 'none' }} />
          <button onClick={() => { setSearchText(''); setSelectedTag('all'); }} style={{ padding: '10px 18px', borderRadius: '24px', border: '1px solid #E8EAED', background: 'white', cursor: 'pointer' }}>Clear</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800' }}>{selectedTag === 'all' ? 'All Notes' : selectedTag}</h1>
            <p style={{ margin: '4px 0 0', color: '#5F6368', fontSize: '14px' }}>{filtered.length} notes • {pinned.length} pinned</p>
          </div>
          <span style={{ background: 'white', padding: '8px 14px', borderRadius: '20px', border: '1px solid #E8EAED', fontSize: '13px' }}>Sort: Recent ▼</span>
        </div>

        {showForm && (
          <form onSubmit={createNote} style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #E8EAED', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input required placeholder="Note Title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #E8EAED' }} />
            <textarea required placeholder="Write your note here..." value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #E8EAED', minHeight: '90px' }} />
            <input placeholder="Tags (e.g. work, ideas, python)" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #E8EAED' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" style={{ padding: '10px 20px', background: '#1A73E8', color: 'white', border: 'none', borderRadius: '20px', fontWeight: '700', cursor: 'pointer' }}>Save Note</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: '#F1F3F4', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        )}

        {sidebarView !== 'all' ? (
          <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', color: '#5F6368' }}>
            <div style={{ fontSize: '40px' }}>{sidebarView === 'archive' ? '📦' : '🗑️'}</div>
            <h3>{sidebarView === 'archive' ? 'Archive is empty' : 'Trash is empty'}</h3>
            <p>Your backend doesn't have archive/trash yet — this is just the UI for now. Your real notes are in All Notes.</p>
            <button onClick={() => setSidebarView('all')} style={{ padding: '10px 20px', background: '#1A73E8', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>Back to All Notes</button>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <h2 style={{ fontSize: '14px', letterSpacing: '1px', color: '#5F6368' }}>📌 PINNED</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                  {pinned.map(n => <NoteCard key={n.id} note={n} />)}
                </div>
              </>
            )}
            <h2 style={{ fontSize: '14px', letterSpacing: '1px', color: '#5F6368' }}>📝 {pinned.length > 0 ? 'OTHERS' : 'ALL NOTES'}</h2>
            {filtered.length === 0 ? (
              <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
                <p>No notes found. Click <b>+ New Note</b> to create one!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {others.map(n => <NoteCard key={n.id} note={n} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;