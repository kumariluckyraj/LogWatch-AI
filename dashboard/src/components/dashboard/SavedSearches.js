import React, { useState, useEffect } from 'react';
import './SavedSearches.css';

const STORAGE_KEY = 'logwatch-saved-searches';

const defaultSearches = [
  { id: '1', name: 'All Errors', category: 'Common', query: { text: '', status: '400', backend: '', method: '' }, favorite: true, createdAt: Date.now() - 100000 },
  { id: '2', name: 'Server Errors', category: 'Common', query: { text: '', status: '500', backend: '', method: '' }, favorite: true, createdAt: Date.now() - 90000 },
  { id: '3', name: 'Stable Backend', category: 'Backend', query: { text: '', status: '', backend: 'stable', method: '' }, favorite: false, createdAt: Date.now() - 80000 },
  { id: '4', name: 'POST Requests', category: 'Method', query: { text: '', status: '', backend: '', method: 'POST' }, favorite: false, createdAt: Date.now() - 70000 },
];

const SavedSearches = ({ currentQuery, onApplySearch }) => {
  const [searches, setSearches] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveCategory, setSaveCategory] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSearches(JSON.parse(stored));
      } else {
        setSearches(defaultSearches);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSearches));
      }
    } catch (e) {
      console.error('[SavedSearches] load error:', e);
    }
  }, []);

  const persist = (updated) => {
    setSearches(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const saveSearch = () => {
    if (!saveName.trim()) return;
    const category = saveCategory.trim() || 'Uncategorized';
    const newSearch = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      category,
      query: { ...currentQuery },
      favorite: false,
      createdAt: Date.now(),
    };
    persist([newSearch, ...searches]);
    setSaveName('');
    setSaveCategory('');
    setShowSaveForm(false);
  };

  const deleteSearch = (id) => {
    persist(searches.filter(s => s.id !== id));
  };

  const toggleFavorite = (id) => {
    persist(searches.map(s => s.id === id ? { ...s, favorite: !s.favorite } : s));
  };

  const startRename = (search) => {
    setEditingId(search.id);
    setEditName(search.name);
    setEditCategory(search.category);
  };

  const commitRename = () => {
    if (!editName.trim()) return;
    persist(searches.map(s => s.id === editingId ? { ...s, name: editName.trim(), category: editCategory.trim() || 'Uncategorized' } : s));
    setEditingId(null);
    setEditName('');
    setEditCategory('');
  };

  const categories = ['All', ...Array.from(new Set(searches.map(s => s.category)))];
  const filteredSearches = activeCategory === 'All' ? searches : searches.filter(s => s.category === activeCategory);
  const favorites = searches.filter(s => s.favorite);

  return (
    <div className="ss-container">
      <div className="ss-header">
        <button className="ss-toggle-btn" onClick={() => setShowPanel(!showPanel)}>
          {showPanel ? '▼' : '▶'} Saved Searches
        </button>
        <button className="ss-save-btn" onClick={() => setShowSaveForm(!showSaveForm)}>
          + Save Current
        </button>
      </div>

      {showPanel && (
        <div className="ss-panel">
          {favorites.length > 0 && (
            <div className="ss-section">
              <div className="ss-section-title">⭐ Favorites</div>
              <div className="ss-list">
                {favorites.map(search => (
                  <div key={search.id} className="ss-item ss-item-favorite">
                    <button className="ss-apply-btn" onClick={() => onApplySearch(search.query)} title={search.query.text || 'No text filter'}>
                      {search.name}
                    </button>
                    <span className="ss-category-tag">{search.category}</span>
                    <div className="ss-actions">
                      <button onClick={() => toggleFavorite(search.id)} title="Unfavorite">☆</button>
                      <button onClick={() => startRename(search)} title="Rename">✎</button>
                      <button onClick={() => deleteSearch(search.id)} title="Delete">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ss-section">
            <div className="ss-section-title">Categories</div>
            <div className="ss-categories">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`ss-cat-btn ${activeCategory === cat ? 'ss-cat-active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="ss-section">
            <div className="ss-section-title">
              {activeCategory === 'All' ? 'All Searches' : activeCategory}
              <span className="ss-count">{filteredSearches.length}</span>
            </div>
            <div className="ss-list">
              {filteredSearches.length === 0 && (
                <div className="ss-empty">No saved searches yet</div>
              )}
              {filteredSearches.map(search => (
                <div key={search.id} className="ss-item">
                  {editingId === search.id ? (
                    <div className="ss-edit-row">
                      <input
                        className="ss-edit-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                        autoFocus
                      />
                      <input
                        className="ss-edit-input ss-edit-input-small"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                      />
                    </div>
                  ) : (
                    <>
                      <button className="ss-apply-btn" onClick={() => onApplySearch(search.query)} title={search.query.text || 'No text filter'}>
                        {search.favorite ? '⭐ ' : ''}{search.name}
                      </button>
                      <span className="ss-category-tag">{search.category}</span>
                      <div className="ss-actions">
                        <button onClick={() => toggleFavorite(search.id)} title={search.favorite ? 'Unfavorite' : 'Favorite'}>
                          {search.favorite ? '☆' : '★'}
                        </button>
                        <button onClick={() => startRename(search)} title="Rename">✎</button>
                        <button onClick={() => deleteSearch(search.id)} title="Delete">🗑</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {showSaveForm && (
            <div className="ss-save-form">
              <input
                className="ss-save-input"
                placeholder="Search name..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveSearch()}
                autoFocus
              />
              <input
                className="ss-save-input"
                placeholder="Category (optional)"
                value={saveCategory}
                onChange={(e) => setSaveCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveSearch()}
              />
              <div className="ss-save-actions">
                <button className="ss-save-confirm" onClick={saveSearch}>Save</button>
                <button className="ss-save-cancel" onClick={() => { setShowSaveForm(false); setSaveName(''); setSaveCategory(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SavedSearches;
