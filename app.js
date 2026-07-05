import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ REEMPLAZÁ ESTOS VALORES con los de tu proyecto en Supabase
const SUPABASE_URL = 'https://yjqhbtxkxmxzvdzerhjq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcWhidHhreG14enZkemVyaGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTMxNTMsImV4cCI6MjA5ODc4OTE1M30.4LMKeps7EcpOsz91eI8ryrAoPsWlsUbTFAmZyMTMSh4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let mangas = [];
let editingId = null;

// ============================================================
// AUTH
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    renderDashboard(session.user);
  } else {
    renderLogin();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      renderDashboard(session.user);
    } else {
      renderLogin();
    }
  });

  document.getElementById('auth-form').addEventListener('submit', handleAuth);
  document.getElementById('logout-btn').addEventListener('click', () => supabase.auth.signOut());

  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isSignup = btn.dataset.form === 'signup';
      document.getElementById('confirm-field').classList.toggle('hidden', !isSignup);
      document.getElementById('auth-btn').textContent = isSignup ? 'Registrarse' : 'Iniciar sesión';
    });
  });
});

function renderLogin() {
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('dashboard-section').classList.add('hidden');
}

function renderDashboard(user) {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');
  document.getElementById('user-email').textContent = user.email;

  document.getElementById('add-btn').addEventListener('click', openAddModal);
  document.getElementById('refresh-btn').addEventListener('click', refreshAll);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`view-${tab.dataset.view}`).classList.add('active');
    });
  });

  document.getElementById('scrape-btn').addEventListener('click', handleScrape);
  document.getElementById('confirm-add-btn').addEventListener('click', handleConfirmAdd);
  document.getElementById('save-edit-btn').addEventListener('click', handleSaveEdit);
  document.getElementById('manga-url').addEventListener('input', () => {
    document.getElementById('scrape-btn').disabled = !document.getElementById('manga-url').value.trim();
  });

  document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
    el.addEventListener('click', closeModals);
  });

  loadMangas();
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('auth-error');
  const isSignup = document.querySelector('.auth-tab.active').dataset.form === 'signup';

  errorEl.classList.add('hidden');

  if (isSignup) {
    const confirm = document.getElementById('confirm-password').value;
    if (password !== confirm) {
      errorEl.textContent = 'Las contraseñas no coinciden';
      errorEl.classList.remove('hidden');
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
      errorEl.classList.remove('hidden');
      return;
    }
  }

  try {
    showLoading();
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      errorEl.textContent = 'Registro exitoso. Revisá tu email para confirmar la cuenta.';
      errorEl.style.color = 'var(--success)';
      errorEl.classList.remove('hidden');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.color = '';
    errorEl.classList.remove('hidden');
  } finally {
    hideLoading();
  }
}

// ============================================================
// MANGAS CRUD
// ============================================================

async function loadMangas() {
  const { data, error } = await supabase
    .from('mangas')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error al cargar mangas:', error);
    return;
  }

  mangas = data || [];
  renderAll();
}

async function addMangaToDB(manga) {
  const { data, error } = await supabase
    .from('mangas')
    .insert([{
      url: manga.url,
      title: manga.title,
      image_url: manga.imageUrl,
      current_chapter: manga.currentChapter,
      my_chapter: 0,
      reading_url: manga.readingUrl,
    }])
    .select();

  if (error) throw error;
  return data[0];
}

async function updateMangaInDB(id, updates) {
  const { data, error } = await supabase
    .from('mangas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
}

async function deleteMangaFromDB(id) {
  const { error } = await supabase
    .from('mangas')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================
// SCRAPING
// ============================================================

async function handleScrape() {
  const url = document.getElementById('manga-url').value.trim();
  const scrapeBtn = document.getElementById('scrape-btn');
  const msgEl = document.getElementById('scrape-msg');
  const resultEl = document.getElementById('scrape-result');

  msgEl.classList.add('hidden');
  resultEl.classList.add('hidden');

  if (!url) return;

  scrapeBtn.disabled = true;
  scrapeBtn.textContent = 'Scrapeando...';

  try {
    const res = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Error al scrapear');
    }

    document.getElementById('preview-img').src = data.imageUrl || '';
    document.getElementById('preview-title').textContent = data.title;
    document.getElementById('preview-chapter').textContent = data.currentChapter ?? '?';
    document.getElementById('confirm-add-btn').dataset.url = url;
    document.getElementById('confirm-add-btn').dataset.title = data.title;
    document.getElementById('confirm-add-btn').dataset.imageUrl = data.imageUrl || '';
    document.getElementById('confirm-add-btn').dataset.currentChapter = data.currentChapter || 0;
    document.getElementById('confirm-add-btn').dataset.readingUrl = data.readingUrl || '';

    resultEl.classList.remove('hidden');
    scrapeBtn.textContent = 'Scrapear';
    scrapeBtn.disabled = false;
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.classList.remove('hidden');
    scrapeBtn.textContent = 'Scrapear';
    scrapeBtn.disabled = false;
  }
}

async function handleConfirmAdd(e) {
  const btn = e.currentTarget;
  try {
    showLoading();
    const newManga = await addMangaToDB({
      url: btn.dataset.url,
      title: btn.dataset.title,
      imageUrl: btn.dataset.imageUrl,
      currentChapter: parseInt(btn.dataset.currentChapter, 10),
      readingUrl: btn.dataset.readingUrl,
    });
    mangas.unshift(newManga);
    renderAll();
    closeModals();
    document.getElementById('manga-url').value = '';
    document.getElementById('scrape-result').classList.add('hidden');
  } catch (err) {
    document.getElementById('scrape-msg').textContent = err.message;
    document.getElementById('scrape-msg').classList.remove('hidden');
  } finally {
    hideLoading();
  }
}

// ============================================================
// REFRESH
// ============================================================

async function refreshAll() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Actualizando...';
  showLoading();

  for (let i = 0; i < mangas.length; i++) {
    try {
      const res = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(mangas[i].url)}`);
      const data = await res.json();
      if (res.ok && !data.error && data.currentChapter) {
        if (data.currentChapter !== mangas[i].current_chapter) {
          mangas[i].current_chapter = data.currentChapter;
          mangas[i].reading_url = data.readingUrl || mangas[i].reading_url;
          await updateMangaInDB(mangas[i].id, {
            current_chapter: data.currentChapter,
            reading_url: data.readingUrl || mangas[i].reading_url,
          });
        }
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }

  renderAll();
  refreshBtn.disabled = false;
  refreshBtn.textContent = 'Actualizar';
  hideLoading();
}

// ============================================================
// RENDER
// ============================================================

function renderAll() {
  renderUpdated();
  renderList();
}

function renderUpdated() {
  const container = document.getElementById('updated-list');
  const updated = mangas.filter(m => m.current_chapter > m.my_chapter);

  if (!updated.length) {
    container.innerHTML = '<p class="empty-state">No hay mangas nuevos 🎉</p>';
    return;
  }

  container.innerHTML = updated.map(m => cardHTML(m, 'updated')).join('');
  container.querySelectorAll('.manga-card').forEach(card => {
    const id = card.dataset.id;
    const manga = mangas.find(m => m.id === id);
    if (manga?.reading_url) {
      card.addEventListener('click', () => window.open(manga.reading_url, '_blank'));
    }
  });
}

function renderList() {
  const container = document.getElementById('all-list');

  if (!mangas.length) {
    container.innerHTML = '<p class="empty-state">No hay mangas. ¡Agregá uno!</p>';
    return;
  }

  container.innerHTML = mangas.map(m => cardHTML(m, 'all')).join('');

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingId = btn.dataset.id;
      const manga = mangas.find(m => m.id === editingId);
      if (manga) {
        document.getElementById('edit-title').textContent = manga.title;
        document.getElementById('edit-my-chapter').value = manga.my_chapter;
        document.getElementById('edit-modal').classList.remove('hidden');
      }
    });
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este manga de tu lista?')) return;
      try {
        showLoading();
        await deleteMangaFromDB(btn.dataset.id);
        mangas = mangas.filter(m => m.id !== btn.dataset.id);
        renderAll();
      } catch (err) {
        console.error(err);
      } finally {
        hideLoading();
      }
    });
  });

  container.querySelectorAll('.manga-card').forEach(card => {
    const id = card.dataset.id;
    if (card.dataset.view !== 'all') return;
    const manga = mangas.find(m => m.id === id);
    if (manga?.reading_url) {
      card.addEventListener('click', () => window.open(manga.reading_url, '_blank'));
    }
  });
}

function cardHTML(manga, view) {
  const isUpdated = view === 'updated';
  const progress = manga.current_chapter > 0 ? Math.min(manga.my_chapter / manga.current_chapter, 1) : 0;
  const pct = Math.round(progress * 100);

  return `
    <div class="manga-card" data-id="${manga.id}" data-view="${view}">
      <div class="cover-wrap">
        <img src="${manga.image_url || ''}" alt="${escapeHtml(manga.title)}" loading="lazy"
             onerror="this.parentElement.innerHTML='<div style=\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.75rem\'>Sin imagen</div>'">
        ${isUpdated ? `<span class="badge">Nuevo</span>` : ''}
        ${manga.current_chapter > 0 ? `
        <div class="chapter-overlay">
          ${isUpdated
            ? `Cap ${manga.my_chapter} → ${manga.current_chapter}`
            : `Cap ${manga.my_chapter} / ${manga.current_chapter}`}
          <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
        </div>` : ''}
      </div>
      <div class="card-body">
        <h3>${escapeHtml(manga.title)}</h3>
        ${!isUpdated ? `<p>Mi cap: ${manga.my_chapter} · Actual: ${manga.current_chapter}</p>` : ''}
      </div>
      ${!isUpdated ? `
      <div class="card-actions">
        <button class="btn-secondary btn-edit" data-id="${manga.id}">Editar</button>
        <button class="btn-danger btn-delete" data-id="${manga.id}">Borrar</button>
      </div>` : ''}
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// EDIT
// ============================================================

async function handleSaveEdit() {
  const chapter = parseInt(document.getElementById('edit-my-chapter').value, 10);
  const msgEl = document.getElementById('edit-msg');
  msgEl.classList.add('hidden');

  if (isNaN(chapter) || chapter < 0) {
    msgEl.textContent = 'Ingresá un número válido';
    msgEl.classList.remove('hidden');
    return;
  }

  try {
    showLoading();
    const updated = await updateMangaInDB(editingId, { my_chapter: chapter });
    const idx = mangas.findIndex(m => m.id === editingId);
    if (idx !== -1) mangas[idx] = { ...mangas[idx], ...updated };
    renderAll();
    closeModals();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.classList.remove('hidden');
  } finally {
    hideLoading();
  }
}

// ============================================================
// MODALS
// ============================================================

function openAddModal() {
  document.getElementById('add-modal').classList.remove('hidden');
  document.getElementById('manga-url').focus();
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('scrape-result').classList.add('hidden');
  document.getElementById('scrape-msg').classList.add('hidden');
  editingId = null;
}

// ============================================================
// LOADING
// ============================================================

function showLoading() {
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}
