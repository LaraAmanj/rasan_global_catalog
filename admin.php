<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
$company = cfg('company');
$adminData = [
    'loggedIn'   => is_admin(),
    'currency'   => cfg('currency'),
    'categories' => cfg('categories'),
    // Only sent to a logged-in admin, so the form can preview the price code
    'priceKey'   => is_admin() ? strtoupper((string) cfg('price_key')) : '',
];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#101e3a">
<meta name="robots" content="noindex">
<title>Admin · <?= e($company['name']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
<link rel="stylesheet" href="assets/admin.css">
</head>
<body>

<header class="topbar">
  <a class="brand" href="./">
    <span class="logo">RG</span>
    <span class="brand-text"><strong><?= e($company['name']) ?></strong><small>Product admin</small></span>
  </a>
  <a class="btn ghost-light" href="./">View catalog</a>
  <button class="btn ghost-light" id="logoutBtn" hidden>Log out</button>
</header>

<main class="wrap">
  <!-- Login -->
  <section id="loginView" class="login-card" hidden>
    <div class="modal-icon">🛡️</div>
    <h2>Admin login</h2>
    <form id="loginForm">
      <label class="field"><span>Password</span><input type="password" name="password" required autofocus></label>
      <p class="error" id="loginError"></p>
      <button class="btn primary block">Log in</button>
    </form>
  </section>

  <!-- Admin -->
  <section id="adminView" class="admin" hidden>
    <form id="productForm" class="panel form-panel" autocomplete="off">
      <div class="panel-head">
        <h2 id="formTitle">Add product</h2>
        <button type="button" class="link" id="resetForm" hidden>+ New</button>
      </div>
      <input type="hidden" name="id">

      <div class="image-drop" id="imageDrop">
        <img id="imagePreview" alt="" hidden>
        <div class="image-empty" id="imageEmpty">
          <span>📷</span>
          <strong>Tap to choose a photo</strong>
          <small>Saved on your server</small>
        </div>
        <input type="file" id="imageFile" accept="image/*">
        <div class="progress" id="progress" hidden><i></i></div>
      </div>
      <label class="field"><span>…or image link</span><input name="image" type="text" inputmode="url" placeholder="https://…"></label>

      <label class="field"><span>Product name *</span><input name="name" required maxlength="120"></label>
      <div class="field-row">
        <label class="field"><span>Category *</span><select name="category" required></select></label>
        <label class="field"><span>SKU *</span><input name="sku" required maxlength="40" style="text-transform:uppercase"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Price (<?= e(cfg('currency')) ?>) *</span><input name="price" type="number" step="0.01" min="0" inputmode="decimal" required></label>
        <div class="field">
          <span>Stock</span>
          <div class="segmented stock-toggle" id="stockToggle">
            <button type="button" data-v="1" class="active">Stock In</button>
            <button type="button" data-v="0">Stock Out</button>
          </div>
        </div>
      </div>
      <p class="hint">Customers will see the price as code: <b id="codePreview" class="price code small">—</b></p>
      <label class="field"><span>Note</span><textarea name="note" rows="3" maxlength="500" placeholder="e.g. 24 pcs per carton, new flavour, offer…"></textarea></label>

      <p class="error" id="formError"></p>
      <button class="btn primary block" id="saveBtn">Save product</button>
    </form>

    <div class="panel list-panel">
      <div class="panel-head">
        <h2>Products <small id="listCount"></small></h2>
      </div>
      <div class="list-tools">
        <input type="search" id="listSearch" placeholder="Search…">
        <select id="listCat"><option value="">All categories</option></select>
      </div>
      <div id="list" class="admin-list"></div>
    </div>
  </section>
</main>

<div class="toast" id="toast" role="status"></div>

<script>window.ADMIN = <?= json_encode($adminData, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>;</script>
<script type="module" src="assets/admin.js"></script>
</body>
</html>
