(() => {
  'use strict';

  const APP = window.APP;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => APP.currency + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const CART_KEY = 'rg_order_v1';
  const LOCK_ICON = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const OPEN_ICON = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>';
  const SALESMAN_KEY = 'rg_salesman';
  const VAT_KEY = 'rg_vat';

  const state = {
    products: [],
    unlocked: false, // PIN entered on this device (server session)
    showAll: false, // top lock: every real price visible
    revealed: new Set(), // card locks: single prices visible
    category: null, // null = category screen, 'all' = every category
    search: '',
    stock: 'all',
    cart: readCart(), // { [productId]: { qty, note } }
    afterUnlock: null,
    lockTimer: null,
  };

  // ── storage ───────────────────────────────────────────────
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch {}
  }

  // ── api ───────────────────────────────────────────────────
  async function api(action, body) {
    const opts = body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {};
    const res = await fetch(`api.php?action=${action}`, { credentials: 'same-origin', ...opts });
    const data = await res.json().catch(() => ({ error: 'Server error' }));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function applyCatalog(data) {
    state.products = data.products;
    state.unlocked = data.unlocked;
    if (!state.unlocked) {
      state.showAll = false;
      state.revealed.clear();
    }
    clearTimeout(state.lockTimer);
    if (data.unlocked) {
      state.lockTimer = setTimeout(() => api('products').then((d) => { applyCatalog(d); render(); toast('Prices locked again'); }), data.expires_in * 1000 + 500);
    }
  }

  const byId = (id) => state.products.find((p) => p.id === id);
  const isShown = (p) => state.unlocked && p.price !== undefined && (state.showAll || state.revealed.has(p.id));
  const catOf = (key) => APP.categories[key] || { label: key, icon: '📦' };
  // Salesman can give a discount by changing the unit price of a line
  const unitPrice = (l) => (l.price ?? l.product.price) || 0;
  const round2 = (n) => Math.round(n * 100) / 100;

  // ── rendering ─────────────────────────────────────────────
  function render() {
    const onCategories = state.category === null;
    $('#viewCategories').hidden = !onCategories;
    $('#viewProducts').hidden = onCategories;
    $('#backBtn').hidden = onCategories;
    document.body.classList.toggle('on-cats', onCategories);
    document.body.classList.toggle('unlocked', state.unlocked);
    document.body.classList.toggle('show-all', state.unlocked && state.showAll);
    $('#lockBtn').title = state.showAll ? 'All prices visible – tap to lock' : 'Show all real prices (salesman)';
    if (onCategories) renderCategories(); else renderProducts();
    renderCart();
  }

  function renderCategories() {
    const groups = {};
    state.products.forEach((p) => { (groups[p.category] ||= []).push(p); });
    $('#catGrid').innerHTML = Object.entries(APP.categories).map(([key, c], i) => {
      const items = groups[key] || [];
      const inStock = items.filter((p) => p.in_stock).length;
      const pct = items.length ? Math.round((inStock / items.length) * 100) : 0;
      return `
      <button class="cat-card ${c.image ? 'has-photo' : ''}" data-cat="${key}" style="--d:${i * 50}ms">
        ${c.image ? `<img class="cat-photo" src="${esc(c.image)}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('has-photo');this.remove()">` : ''}
        <span class="cat-top">
         <div></div>
        </span>
        <span class="cat-body">
          <span class="cat-name">${esc(c.label)}</span>
          <span class="cat-count">${items.length} ${items.length === 1 ? 'product' : 'products'}${items.length ? ` · ${inStock} in stock` : ''}</span>
          <span class="cat-bar"><i style="width:${pct}%"></i></span>
        </span>
        <span class="cat-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
      </button>`;
    }).join('');
  }

  function visibleProducts() {
    const q = state.search.trim().toLowerCase();
    return state.products.filter((p) =>
      (state.category === 'all' || p.category === state.category) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
      (state.stock === 'all' || (state.stock === 'in') === p.in_stock));
  }

  function renderProducts() {
    const tabs = [['all', { label: 'All', icon: '✨' }], ...Object.entries(APP.categories)];
    $('#catTabs').innerHTML = tabs.map(([key, c]) => `
      <button class="tab ${state.category === key ? 'active' : ''}" data-cat="${key}">
        <span>${c.icon}</span>${esc(c.label)}
      </button>`).join('');

    const list = visibleProducts();
    const c = state.category === 'all' ? { label: state.search ? 'Search results' : 'All products' } : catOf(state.category);
    $('#catTitle').textContent = c.label;
    const inStock = list.filter((p) => p.in_stock).length;
    $('#catMeta').textContent = `${list.length} products · ${inStock} in stock`;

    $('#grid').innerHTML = list.map(cardHtml).join('');
    $('#empty').hidden = list.length > 0;
  }

  function imageHtml(p, cls = '') {
    const icon = catOf(p.category).icon;
    if (!p.in_stock && APP.outOfStockImage) {
      return `<img class="${cls}" src="${esc(APP.outOfStockImage)}" alt="Out of stock" loading="lazy" data-fallback="${icon}">`;
    }
    return p.image
      ? `<img class="${cls}" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" data-fallback="${icon}">`
      : `<span class="ph ${cls}">${icon}</span>`;
  }

  function priceHtml(p) {
    return isShown(p)
      ? `<button class="price real" data-price title="Tap to hide this price">${OPEN_ICON}<span>${money(p.price)}</span></button>`
      : `<button class="price code" data-price title="Tap to show this price (salesman)">${LOCK_ICON}<span>Price</span></button>`;
  }

  function stepperHtml(id, qty) {
    return `<div class="stepper" data-id="${id}">
      <button data-dec aria-label="Less">−</button>
      <input type="number" min="0" inputmode="numeric" value="${qty}" data-qty aria-label="Quantity">
      <button data-inc aria-label="More">+</button>
    </div>`;
  }

  function cardHtml(p) {
    const line = state.cart[p.id];
    const zoomable = p.image && p.in_stock; // out of stock shows the "Out of stock" sign instead
    let action;
    if (line) action = stepperHtml(p.id, line.qty);
    else action = '<button class="btn add" data-add>+ Add</button>';

    return `
      <article class="card ${p.in_stock ? '' : 'is-out'} ${line ? 'in-cart' : ''}" data-id="${p.id}">
        <div class="card-img" ${zoomable ? 'data-zoom title="Tap to see full image"' : ''}>
          ${imageHtml(p)}
          <span class="badge ${p.in_stock ? 'in' : 'out'}">${p.in_stock ? 'Stock In' : 'Stock Out'}</span>
          ${zoomable ? '<span class="zoom-hint"><svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></span>' : ''}
        </div>
        <div class="card-body">
          <h3>${esc(p.name)}</h3>
          <span class="sku">SKU · ${esc(p.sku)}</span>
          ${p.note ? `<p class="note">📝 ${esc(p.note)}</p>` : ''}
          <div class="card-foot">
            ${priceHtml(p)}
            ${action}
          </div>
        </div>
      </article>`;
  }

  function cartLines() {
    return Object.entries(state.cart)
      .map(([id, line]) => ({ ...line, product: byId(id) }))
      .filter((l) => l.product);
  }

  function renderCart() {
    const lines = cartLines();
    const units = lines.reduce((s, l) => s + l.qty, 0);
    const count = $('#cartCount');
    count.hidden = lines.length === 0;
    count.textContent = lines.length;
    $('#cartSummary').textContent = lines.length ? `${lines.length} products · ${units} units` : 'No products yet';
    $('#exportBtn').disabled = lines.length === 0;
    $('#clearCart').hidden = lines.length === 0;

    $('#cartList').innerHTML = lines.length ? lines.map((l) => {
      const p = l.product;
      const u = unitPrice(l);
      const price = isShown(p)
        ? `<strong>${money(u * l.qty)}</strong>
           <label class="line-uprice">${esc(APP.currency)}<input type="number" min="0" step="0.01" inputmode="decimal" value="${u.toFixed(2)}" data-uprice aria-label="Unit price"> each</label>
           ${u < p.price ? `<small class="was">was ${money(p.price)} · −${Math.round((1 - u / p.price) * 100)}%</small>` : ''}`
        : `<span class="price code small">${esc(p.price_code)}</span>`;
      return `
        <div class="line" data-id="${p.id}">
          <div class="line-img">${imageHtml(p)}</div>
          <div class="line-main">
            <div class="line-top">
              <div><h4>${esc(p.name)}</h4><span class="sku">${esc(p.sku)}</span>${p.in_stock ? '' : ' <span class="line-out">Stock Out</span>'}</div>
              <button class="icon-btn sm" data-remove aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
            </div>
            <div class="line-mid">${stepperHtml(p.id, l.qty)}<div class="line-price">${price}</div></div>
            <textarea class="line-note" data-note rows="1" placeholder="Write a note for this item…">${esc(l.note || '')}</textarea>
          </div>
        </div>`;
    }).join('') : `<div class="empty small"><span>🛒</span><p>Tap “+ Add” on a product to start an order.</p></div>`;

    $('#totalRow').innerHTML = !lines.length ? '' : lines.every((l) => isShown(l.product))
      ? `<span>Total <small>(ex VAT)</small></span><strong>${money(lines.reduce((s, l) => s + unitPrice(l) * l.qty, 0))}</strong>`
      : `<span>Total</span><button class="link" data-reveal>🔒 Show prices to see total</button>`;
  }

  // ── cart actions ──────────────────────────────────────────
  function setQty(id, qty) {
    qty = Math.max(0, Math.min(99999, Math.floor(Number(qty) || 0)));
    if (qty === 0) delete state.cart[id];
    else state.cart[id] = { note: '', ...state.cart[id], qty };
    saveCart();
    refreshCard(id);
    renderCart();
  }

  // Only swap the price/button area, so the photo stays loaded (no flicker or re-download)
  function refreshCard(id) {
    const el = document.querySelector(`.card[data-id="${id}"]`);
    const p = byId(id);
    if (!el || !p) return;
    const fresh = document.createElement('div');
    fresh.innerHTML = cardHtml(p);
    const card = fresh.firstElementChild;
    el.className = card.className;
    el.querySelector('.card-foot').replaceWith(card.querySelector('.card-foot'));
  }

  function handleStepper(e) {
    const stepper = e.target.closest('.stepper');
    if (!stepper) return false;
    const id = stepper.dataset.id;
    const qty = state.cart[id]?.qty || 0;
    if (e.target.closest('[data-inc]')) setQty(id, qty + 1);
    else if (e.target.closest('[data-dec]')) setQty(id, qty - 1);
    return true;
  }

  // ── salesman lock ─────────────────────────────────────────
  /** `then` runs after a correct PIN, before the screen redraws. */
  function openPin(then = null) {
    state.afterUnlock = then;
    $('#pinError').textContent = '';
    $('#pinInput').value = '';
    $('#pinDialog').showModal();
    setTimeout(() => $('#pinInput').focus(), 50);
  }

  $('#pinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      applyCatalog(await api('unlock', { pin: $('#pinInput').value }));
      $('#pinDialog').close();
      const next = state.afterUnlock;
      state.afterUnlock = null;
      if (next) next();
      render();
      toast('Unlocked');
    } catch (err) {
      $('#pinError').textContent = err.message;
      $('#pinInput').select();
    }
  });

  function showAllPrices() {
    if (!state.unlocked) return openPin(() => { state.showAll = true; });
    state.showAll = true;
    render();
  }

  // Top lock: locked → show all (PIN), some shown → show all, all shown → lock everything
  $('#lockBtn').addEventListener('click', async () => {
    if (!state.unlocked || !state.showAll) return showAllPrices();
    applyCatalog(await api('lock', {}));
    render();
    toast('Prices hidden');
  });

  // Card lock: show or hide just this product's price
  function togglePrice(id) {
    if (!state.unlocked) return openPin(() => { state.revealed.add(id); });
    if (state.showAll) {
      state.showAll = false;
      state.revealed = new Set(state.products.map((p) => p.id));
      state.revealed.delete(id);
      return render();
    }
    if (state.revealed.has(id)) state.revealed.delete(id);
    else state.revealed.add(id);
    refreshCard(id);
    renderCart();
  }

  // ── drawer ────────────────────────────────────────────────
  function openCart() {
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closeCart() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true;
    document.body.classList.remove('no-scroll');
  }
  $('#cartBtn').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  $('#scrim').addEventListener('click', closeCart);

  $('#clearCart').addEventListener('click', () => {
    if (!confirm('Remove all products from this order?')) return;
    state.cart = {};
    saveCart();
    render();
  });

  // ── navigation & product events ───────────────────────────
  function goCategory(key) {
    state.category = key;
    state.stock = 'all';
    document.querySelectorAll('#stockFilter button').forEach((b) => b.classList.toggle('active', b.dataset.stock === 'all'));
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const tab = document.querySelector(`#catTabs .tab[data-cat="${key}"]`);
    tab?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  $('.hero-all').addEventListener('click', () => goCategory('all'));
  $('#catGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-cat]');
    if (card) goCategory(card.dataset.cat);
  });
  $('#catTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-cat]');
    if (tab) goCategory(tab.dataset.cat);
  });
  $('#backBtn').addEventListener('click', () => {
    state.category = null;
    state.search = '';
    $('#search').value = '';
    render();
  });

  $('#stockFilter').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.stock = b.dataset.stock;
    document.querySelectorAll('#stockFilter button').forEach((x) => x.classList.toggle('active', x === b));
    renderProducts();
  });

  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      if (state.search && state.category === null) state.category = 'all';
      render();
    }, 150);
  });

  $('#grid').addEventListener('click', (e) => {
    if (handleStepper(e)) return;
    const card = e.target.closest('.card');
    if (!card) return;
    if (e.target.closest('[data-price]')) return togglePrice(card.dataset.id);
    if (e.target.closest('[data-zoom]')) return openViewer(byId(card.dataset.id));
    if (card && e.target.closest('[data-add]')) {
      setQty(card.dataset.id, 1);
      toast('Added to order');
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-qty]')) setQty(e.target.closest('.stepper').dataset.id, e.target.value);
    if (e.target.matches('[data-uprice]')) setPrice(e.target.closest('.line').dataset.id, e.target.value);
  });

  /** Custom unit price for one line (discount). Empty or invalid → back to the normal price. */
  function setPrice(id, value) {
    const line = state.cart[id];
    const p = byId(id);
    if (!line || !p) return;
    const v = round2(Number(value));
    if (value === '' || !Number.isFinite(v) || v < 0 || v === p.price) delete line.price;
    else line.price = v;
    saveCart();
    renderCart();
  }

  $('#drawer').addEventListener('click', (e) => {
    if (e.target.closest('[data-reveal]')) return showAllPrices();
    if (handleStepper(e)) return;
    const line = e.target.closest('.line');
    if (line && e.target.closest('[data-remove]')) setQty(line.dataset.id, 0);
  });

  $('#drawer').addEventListener('input', (e) => {
    if (!e.target.matches('[data-note]')) return;
    const id = e.target.closest('.line').dataset.id;
    if (state.cart[id]) {
      state.cart[id].note = e.target.value.slice(0, 200);
      saveCart();
    }
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  });

  // Broken image link → show the category emoji instead
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
    const ph = document.createElement('span');
    ph.className = 'ph ' + img.className;
    ph.textContent = img.dataset.fallback;
    img.replaceWith(ph);
  }, true);

  // ── full image viewer ─────────────────────────────────────
  function openViewer(p) {
    const img = document.querySelector(`.card[data-id="${p?.id}"] .card-img img`);
    if (!img) return; // no photo, or it failed to load
    $('#viewerImg').src = p.image;
    $('#viewerImg').alt = p.name;
    $('#viewerCaption').textContent = p.name;
    $('#viewer').showModal();
  }
  // Tap anywhere outside the photo to close
  $('#viewer').addEventListener('click', (e) => {
    if (e.target !== $('#viewerImg')) $('#viewer').close();
  });

  document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  // ── PDF export ────────────────────────────────────────────
  function openExport() {
    const form = $('#exportForm');
    try { form.salesman.value = localStorage.getItem(SALESMAN_KEY) || ''; } catch {}
    let vat = null;
    try { vat = localStorage.getItem(VAT_KEY); } catch {}
    form.vat.value = vat ?? APP.vatRate ?? 0;
    $('#exportDialog').showModal();
  }

  $('#exportBtn').addEventListener('click', () => {
    if (!cartLines().length) return;
    if (!state.unlocked) return openPin(openExport);
    openExport();
  });

  $('#exportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const info = Object.fromEntries(['company', 'address', 'phone', 'salesman', 'note'].map((k) => [k, f[k].value.trim()]));
    info.vat = Math.max(0, Number(f.vat.value) || 0);
    try { localStorage.setItem(SALESMAN_KEY, info.salesman); localStorage.setItem(VAT_KEY, info.vat); } catch {}

    // Make sure the session is still unlocked (prices come from the server)
    applyCatalog(await api('products'));
    if (!state.unlocked) {
      $('#exportDialog').close();
      render();
      return openPin(openExport);
    }

    const btn = $('#makePdf');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      await buildPdf(info, cartLines());
      $('#exportDialog').close();
      // Order is done: start fresh for the next customer
      state.cart = {};
      saveCart();
      f.reset();
      f.vat.value = info.vat;
      closeCart();
      toast('PDF saved · order cleared');
    } catch (err) {
      console.error(err);
      alert('Could not create the PDF: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create PDF';
      render();
    }
  });

  async function buildPdf(info, lines) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const brand = [16, 30, 58];
    const accent = [245, 158, 11];
    const co = APP.company;
    const now = new Date();
    const orderNo = 'RG-' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Header band
    doc.setFillColor(...brand);
    doc.rect(0, 0, W, 36, 'F');
    doc.setFillColor(...accent);
    doc.rect(0, 36, W, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(co.name, 14, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text([co.address, [co.phone && 'Tel: ' + co.phone, co.email].filter(Boolean).join('   ·   ')], 14, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('SALES ORDER', W - 14, 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text([`Order no: ${orderNo}`, `Date: ${dateStr}`, APP.vatNumber && `VAT no: ${APP.vatNumber}`].filter(Boolean), W - 14, 22, { align: 'right' });

    // Customer box
    let y = 46;
    const addr = doc.splitTextToSize(info.address, 105);
    const boxH = 22 + addr.length * 4.6;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y - 6, W - 28, boxH, 2, 2, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('BILL TO', 19, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(info.company, 19, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(addr, 19, y + 11.5);
    doc.text('Tel: ' + info.phone, 19, y + 11.5 + addr.length * 4.6);

    if (info.salesman) {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text('SALESMAN', W - 19, y, { align: 'right' });
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(info.salesman, W - 19, y + 6, { align: 'right' });
    }

    // Items table
    let subtotal = 0, discount = 0, vat = 0;
    const body = lines.map((l) => {
      const p = l.product;
      const u = unitPrice(l);
      const lineNet = round2(u * l.qty);
      const lineVat = round2(lineNet * info.vat / 100);
      subtotal += lineNet;
      vat += lineVat;
      if (u < p.price) discount += round2((p.price - u) * l.qty);
      return [l.qty, p.sku, p.name, l.note || '', money(p.price), money(u), money(lineVat), `${info.vat}%`, money(lineNet + lineVat)];
    });
    subtotal = round2(subtotal);
    vat = round2(vat);
    const total = round2(subtotal + vat);

    doc.autoTable({
      startY: y - 6 + boxH + 6,
      head: [['Qty', 'Code', 'Item', 'Description', 'Old Price', 'Unit Price', 'VAT', 'TAX %', 'Total']],
      body,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, valign: 'middle', lineColor: [226, 232, 240], textColor: [15, 23, 42] },
      headStyles: { fillColor: brand, textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 22 },
        4: { cellWidth: 19, halign: 'right', textColor: [100, 116, 139] },
        5: { cellWidth: 19, halign: 'right' },
        6: { cellWidth: 17, halign: 'right' },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 21, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });

    // Totals
    y = doc.lastAutoTable.finalY + 8;
    if (y > H - 65) { doc.addPage(); y = 20; }
    const units = lines.reduce((s, l) => s + l.qty, 0);
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Products: ${lines.length}`, 14, y);
    doc.text(`Units: ${units}`, 14, y + 5);

    const sums = [
      ...(discount > 0 ? [['Discount included', '-' + money(discount)]] : []),
      ['Subtotal (ex VAT)', money(subtotal)],
      [`VAT (${info.vat}%)`, money(vat)],
    ];
    doc.setTextColor(15, 23, 42);
    sums.forEach(([label, value]) => {
      doc.text(label, W - 79, y);
      doc.text(value, W - 19, y, { align: 'right' });
      y += 6;
    });
    y += 3;

    doc.setFillColor(...brand);
    doc.roundedRect(W - 84, y - 5, 70, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('TOTAL', W - 79, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(money(total), W - 19, y + 3.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    if (info.note) {
      y += 18;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text('ORDER NOTE', 14, y);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9.5);
      doc.text(doc.splitTextToSize(info.note, W - 28), 14, y + 5);
    }

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, H - 14, W - 14, H - 14);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`${co.name} · Thank you for your order`, 14, H - 9);
      doc.text(`Page ${i} of ${pages}`, W - 14, H - 9, { align: 'right' });
    }

    const safe = info.company.replace(/[^\w-]+/g, '_').slice(0, 40);
    doc.save(`Order_${safe}_${orderNo}.pdf`);
  }

  // ── toast ────────────────────────────────────────────────
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ── start ────────────────────────────────────────────────
  api('products')
    .then((d) => { applyCatalog(d); state.showAll = d.unlocked; render(); })
    .catch((err) => { $('#catGrid').innerHTML = `<p class="error">Could not load products: ${esc(err.message)}</p>`; });
})();
