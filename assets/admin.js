const A = window.ADMIN;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => A.currency + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let products = [];
let pendingFile = null;
let inStock = true;

async function api(action, body) {
  const opts = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : {};
  const res = await fetch(`api.php?action=${action}`, { credentials: 'same-origin', ...opts });
  const data = await res.json().catch(() => ({ error: 'Server error' }));
  if (res.status === 401 && action !== 'admin_login') location.reload();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Photo upload (saved in uploads/ on this server) ─────────
/** Shrinks the photo to max 1200px JPEG so the catalog loads fast on mobile data. */
function resizeImage(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read image'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = URL.createObjectURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

/** Uploads the resized photo to api.php and returns its path, e.g. "uploads/mango-juice-1l.jpg". */
async function uploadImage(file, name, sku) {
  const data = await blobToBase64(await resizeImage(file));
  const bar = $('#progress');
  bar.hidden = false;
  bar.firstElementChild.style.width = '0%';
  // XHR rather than fetch so the progress bar can follow the upload.
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'api.php?action=upload_image');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) bar.firstElementChild.style.width = `${(e.loaded / e.total) * 100}%`;
    };
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { body = { error: 'Server error' }; }
      if (xhr.status === 401) location.reload();
      xhr.status < 300 ? resolve(body) : reject(new Error(body.error || 'Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    xhr.send(JSON.stringify({ name, sku, data }));
  });
  bar.hidden = true;
  return result.image;
}

// ── Price code preview (same rule as price_code() in lib.php) ─
function priceCode(price) {
  if (!Number.isFinite(price) || price < 0) return '—';
  return price.toFixed(2).split('').map((ch) => (ch === '.' ? '.' : A.priceKey[(Number(ch) + 9) % 10])).join('');
}

// ── Form ────────────────────────────────────────────────────
const form = $('#productForm');
form.category.innerHTML = '<option value="">Choose…</option>' +
  Object.entries(A.categories).map(([k, c]) => `<option value="${k}">${c.icon} ${esc(c.label)}</option>`).join('');
$('#listCat').innerHTML += Object.entries(A.categories).map(([k, c]) => `<option value="${k}">${c.icon} ${esc(c.label)}</option>`).join('');

function setStock(v) {
  inStock = v;
  document.querySelectorAll('#stockToggle button').forEach((b) => b.classList.toggle('active', (b.dataset.v === '1') === v));
}
$('#stockToggle').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setStock(b.dataset.v === '1');
});

function showPreview(src) {
  $('#imagePreview').hidden = !src;
  $('#imageEmpty').hidden = !!src;
  if (src) $('#imagePreview').src = src;
}

$('#imageFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingFile = file;
  showPreview(URL.createObjectURL(file));
});
form.image.addEventListener('input', () => {
  pendingFile = null;
  $('#imageFile').value = '';
  showPreview(form.image.value.trim());
});
const drop = $('#imageDrop');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, () => drop.classList.add('drag')));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('drag')));

form.price.addEventListener('input', () => {
  $('#codePreview').textContent = priceCode(parseFloat(form.price.value));
});

function resetForm() {
  form.reset();
  form.id.value = '';
  pendingFile = null;
  setStock(true);
  showPreview('');
  $('#formTitle').textContent = 'Add product';
  $('#resetForm').hidden = true;
  $('#formError').textContent = '';
  $('#codePreview').textContent = '—';
  renderList();
}
$('#resetForm').addEventListener('click', resetForm);

function editProduct(p) {
  form.id.value = p.id;
  form.name.value = p.name;
  form.category.value = p.category;
  form.sku.value = p.sku;
  form.price.value = p.price;
  form.note.value = p.note || '';
  form.image.value = p.image || '';
  pendingFile = null;
  $('#imageFile').value = '';
  setStock(!!p.in_stock);
  showPreview(p.image);
  $('#formTitle').textContent = 'Edit product';
  $('#resetForm').hidden = false;
  $('#formError').textContent = '';
  $('#codePreview').textContent = priceCode(Number(p.price));
  renderList();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#saveBtn');
  btn.disabled = true;
  $('#formError').textContent = '';
  try {
    let image = form.image.value.trim();
    if (pendingFile) {
      btn.textContent = 'Uploading photo…';
      image = await uploadImage(pendingFile, form.name.value.trim(), form.sku.value.trim());
    }
    btn.textContent = 'Saving…';
    await api('save_product', {
      id: form.id.value,
      name: form.name.value,
      category: form.category.value,
      sku: form.sku.value,
      price: form.price.value,
      note: form.note.value,
      image,
      in_stock: inStock,
    });
    toast(form.id.value ? 'Product updated' : 'Product added');
    await loadList();
    resetForm();
  } catch (err) {
    $('#formError').textContent = err.message;
    $('#progress').hidden = true;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save product';
  }
});

// ── List ────────────────────────────────────────────────────
async function loadList() {
  products = (await api('admin_products')).products;
  renderList();
}

function renderList() {
  const q = $('#listSearch').value.trim().toLowerCase();
  const cat = $('#listCat').value;
  const list = products.filter((p) => (!cat || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  $('#listCount').textContent = `· ${products.length}`;
  const editing = form.id.value;

  $('#list').innerHTML = list.length ? list.map((p) => {
    const c = A.categories[p.category] || { icon: '📦', label: p.category };
    const img = p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : `<span class="ph">${c.icon}</span>`;
    return `
      <div class="row ${editing === p.id ? 'editing' : ''}" data-id="${p.id}">
        <div class="row-img">${img}</div>
        <div class="row-main">
          <h4>${esc(p.name)}</h4>
          <div class="row-meta">
            <span>${esc(p.sku)}</span><span>${c.icon} ${esc(c.label)}</span><b>${money(p.price)}</b>
            <button class="pill ${p.in_stock ? 'in' : 'out'}" data-toggle title="Tap to switch">${p.in_stock ? 'Stock In' : 'Stock Out'}</button>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn ghost" data-edit>Edit</button>
          <button class="btn danger" data-delete>Delete</button>
        </div>
      </div>`;
  }).join('') : '<div class="empty small"><span>📦</span><p>No products yet</p></div>';
}

$('#listSearch').addEventListener('input', renderList);
$('#listCat').addEventListener('change', renderList);

$('#list').addEventListener('click', async (e) => {
  const row = e.target.closest('.row');
  if (!row) return;
  const p = products.find((x) => x.id === row.dataset.id);
  if (e.target.closest('[data-edit]')) editProduct(p);
  else if (e.target.closest('[data-delete]')) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await api('delete_product', { id: p.id });
    if (form.id.value === p.id) resetForm();
    toast('Deleted');
    loadList();
  } else if (e.target.closest('[data-toggle]')) {
    await api('save_product', { ...p, in_stock: !p.in_stock });
    toast(p.in_stock ? 'Marked Stock Out' : 'Marked Stock In');
    loadList();
  }
});

// ── Auth ────────────────────────────────────────────────────
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('admin_login', { password: e.target.password.value });
    location.reload();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  await api('admin_logout', {});
  location.reload();
});

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

if (A.loggedIn) {
  $('#adminView').hidden = false;
  $('#logoutBtn').hidden = false;
  loadList();
} else {
  $('#loginView').hidden = false;
}
