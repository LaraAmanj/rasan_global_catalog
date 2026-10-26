<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
$company = cfg('company');
$appData = [
    'company'    => $company,
    'currency'   => cfg('currency'),
    'vatRate'    => (float) (cfg('vat_rate') ?? 0),
    'vatNumber'  => (string) (cfg('vat_number') ?? ''),
    // Shown instead of the product photo when a product is out of stock
    'outOfStockImage' => image_url('uploads/out_of_stock.jpg'),
    'categories' => cfg('categories'),
];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#101e3a">
<meta name="apple-mobile-web-app-capable" content="yes">
<title><?= e($company['name']) ?> · Catalog</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>

<header class="topbar">
  <button class="icon-btn" id="backBtn" hidden aria-label="Back to categories">
    <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
  </button>
  <a class="brand" href="./">
    <span class="logo">RG</span>
    <span class="brand-text"><strong><?= e($company['name']) ?></strong><small>Sales Catalog</small></span>
  </a>
  <label class="search">
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
    <input type="search" id="search" placeholder="Search name or SKU…" autocomplete="off">
  </label>
  <button class="icon-btn lock" id="lockBtn" aria-label="Salesman prices">
    <svg class="i-locked" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
    <svg class="i-open" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>
  </button>
  <button class="icon-btn cart-btn" id="cartBtn" aria-label="Order">
    <svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/></svg>
    <span class="count" id="cartCount" hidden>0</span>
  </button>
</header>

<main class="wrap">
  <section id="viewCategories">
    <div class="hero">
      <div class="hero-text">
        <span class="hero-eyebrow"><i></i>Wholesale catalog</span>
        <h1>Choose a <span>category</span></h1>
        <p>Pick a section to start browsing products</p>
      </div>
      <button class="hero-all" data-cat="all">
        View all products
        <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
    <div class="cat-grid" id="catGrid"></div>
  </section>

  <section id="viewProducts" hidden>
    <div class="cat-tabs" id="catTabs"></div>
    <div class="section-head">
      <div>
        <h2 id="catTitle"></h2>
        <p id="catMeta"></p>
      </div>
      <div class="segmented" id="stockFilter">
        <button data-stock="all" class="active">All</button>
        <button data-stock="in">In stock</button>
        <button data-stock="out">Stock out</button>
      </div>
    </div>
    <div class="grid" id="grid"></div>
    <div class="empty" id="empty" hidden>
      <span>🔍</span>
      <p>No products found</p>
    </div>
  </section>
</main>

<!-- Order drawer -->
<div class="scrim" id="scrim" hidden></div>
<aside class="drawer" id="drawer" aria-hidden="true">
  <div class="drawer-head">
    <div>
      <h3>Current order</h3>
      <small id="cartSummary"></small>
    </div>
    <button class="icon-btn" id="closeCart" aria-label="Close">
      <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <div class="drawer-body" id="cartList"></div>
  <div class="drawer-foot">
    <div class="total-row" id="totalRow"></div>
    <button class="btn primary block" id="exportBtn">
      <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
      Export order to PDF
    </button>
    <button class="btn ghost block" id="clearCart">Clear order</button>
  </div>
</aside>

<!-- PIN dialog -->
<dialog id="pinDialog" class="modal">
  <form method="dialog" id="pinForm">
    <div class="modal-icon">🔐</div>
    <h3>Salesman access</h3>
    <p class="muted">Enter your PIN to show real prices.</p>
    <input type="password" id="pinInput" inputmode="numeric" autocomplete="off" placeholder="••••" class="pin-input" required>
    <p class="error" id="pinError"></p>
    <div class="modal-actions">
      <button type="button" class="btn ghost" data-close>Cancel</button>
      <button type="submit" class="btn primary">Unlock</button>
    </div>
  </form>
</dialog>

<!-- Export dialog -->
<dialog id="exportDialog" class="modal wide">
  <form method="dialog" id="exportForm">
    <h3>Customer details</h3>
    <p class="muted">These will be printed on the PDF order.</p>
    <label class="field"><span>Company name *</span><input name="company" required maxlength="120"></label>
    <label class="field"><span>Address *</span><textarea name="address" rows="2" required maxlength="300"></textarea></label>
    <label class="field"><span>Phone *</span><input name="phone" type="tel" required maxlength="40"></label>
    <div class="field-row">
      <label class="field"><span>Salesman</span><input name="salesman" maxlength="60"></label>
      <label class="field"><span>Order note</span><input name="note" maxlength="200"></label>
    </div>
    <label class="field"><span>VAT %</span><input name="vat" type="number" min="0" max="100" step="0.01" inputmode="decimal" required></label>
    <div class="modal-actions">
      <button type="button" class="btn ghost" data-close>Cancel</button>
      <button type="submit" class="btn primary" id="makePdf">Create PDF</button>
    </div>
  </form>
</dialog>

<!-- Full image viewer -->
<dialog id="viewer" class="viewer">
  <button type="button" class="icon-btn viewer-close" data-close aria-label="Close">
    <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
  </button>
  <img id="viewerImg" alt="">
  <p class="viewer-caption" id="viewerCaption"></p>
</dialog>

<div class="toast" id="toast" role="status"></div>

<script>window.APP = <?= json_encode($appData, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>;</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
<script src="assets/app.js"></script>
</body>
</html>
