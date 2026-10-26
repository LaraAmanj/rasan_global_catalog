<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$input  = [];

if ($isPost) {
    // JSON-only POSTs: a plain HTML form on another site can't send these.
    if (!str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
        json_out(['error' => 'Bad request'], 400);
    }
    $input = json_decode((string) file_get_contents('php://input'), true) ?: [];
}

function require_post(bool $isPost): void
{
    if (!$isPost) {
        json_out(['error' => 'POST required'], 405);
    }
}

function require_admin(): void
{
    if (!is_admin()) {
        json_out(['error' => 'Please log in again'], 401);
    }
}

function catalog_payload(): array
{
    return [
        'unlocked'   => is_salesman(),
        'expires_in' => is_salesman() ? $_SESSION['salesman_until'] - time() : 0,
        'products'   => array_map('public_product', load_products()),
    ];
}

function too_many_attempts(string $key): bool
{
    return ($_SESSION[$key . '_blocked_until'] ?? 0) > time();
}

function record_failure(string $key): void
{
    $_SESSION[$key . '_fails'] = ($_SESSION[$key . '_fails'] ?? 0) + 1;
    if ($_SESSION[$key . '_fails'] >= 5) {
        $_SESSION[$key . '_blocked_until'] = time() + 60;
        $_SESSION[$key . '_fails'] = 0;
    }
}

switch ($action) {

    // ── Catalog ─────────────────────────────────────────────
    case 'products':
        json_out(catalog_payload());

    case 'unlock':
        require_post($isPost);
        if (too_many_attempts('pin')) {
            json_out(['error' => 'Too many tries. Wait one minute.'], 429);
        }
        if (!hash_equals((string) cfg('salesman_pin'), (string) ($input['pin'] ?? ''))) {
            record_failure('pin');
            json_out(['error' => 'Wrong PIN'], 401);
        }
        $_SESSION['pin_fails'] = 0;
        $_SESSION['salesman_until'] = time() + 60 * (int) cfg('unlock_minutes');
        json_out(catalog_payload());

    case 'lock':
        require_post($isPost);
        unset($_SESSION['salesman_until']);
        json_out(catalog_payload());

    // ── Admin ───────────────────────────────────────────────
    case 'admin_login':
        require_post($isPost);
        if (too_many_attempts('admin')) {
            json_out(['error' => 'Too many tries. Wait one minute.'], 429);
        }
        if (!hash_equals((string) cfg('admin_password'), (string) ($input['password'] ?? ''))) {
            record_failure('admin');
            json_out(['error' => 'Wrong password'], 401);
        }
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        json_out(['ok' => true]);

    case 'admin_logout':
        require_post($isPost);
        unset($_SESSION['admin']);
        json_out(['ok' => true]);

    case 'admin_products':
        require_admin();
        json_out(['products' => load_products()]);

    case 'save_product':
        require_post($isPost);
        require_admin();

        $name     = trim((string) ($input['name'] ?? ''));
        $sku      = strtoupper(trim((string) ($input['sku'] ?? '')));
        $category = (string) ($input['category'] ?? '');
        $price    = $input['price'] ?? null;
        $note     = trim((string) ($input['note'] ?? ''));
        $image    = trim((string) ($input['image'] ?? ''));
        $id       = (string) ($input['id'] ?? '');

        if ($name === '' || $sku === '') {
            json_out(['error' => 'Name and SKU are required'], 422);
        }
        if (!isset(cfg('categories')[$category])) {
            json_out(['error' => 'Choose a category'], 422);
        }
        if (!is_numeric($price) || $price < 0) {
            json_out(['error' => 'Price must be a number'], 422);
        }
        if ($image !== '' && !preg_match('#^https://#i', $image) && !preg_match(UPLOAD_PATTERN, $image)) {
            json_out(['error' => 'Image must be an uploaded photo or an https:// link'], 422);
        }

        $products = load_products();
        $oldImage = '';
        $existing = null;
        foreach ($products as $p) {
            if ($p['sku'] === $sku && $p['id'] !== $id) {
                json_out(['error' => "SKU $sku is already used by \"{$p['name']}\""], 422);
            }
            if ($p['id'] === $id) {
                $existing = $p;
            }
        }

        $product = [
            'id'         => $id !== '' ? $id : bin2hex(random_bytes(6)),
            'name'       => mb_substr($name, 0, 120),
            'category'   => $category,
            'sku'        => mb_substr($sku, 0, 40),
            'price'      => round((float) $price, 2),
            'note'       => mb_substr($note, 0, 500),
            'image'      => $image,
            'in_stock'   => (bool) ($input['in_stock'] ?? true),
            // Editing keeps the original date, so only new products jump to the top
            'created_at' => $existing === null ? date('c') : ($existing['created_at'] ?? ''),
            'updated_at' => date('c'),
        ];

        $found = false;
        foreach ($products as $i => $p) {
            if ($p['id'] === $product['id']) {
                $oldImage = (string) ($p['image'] ?? '');
                $products[$i] = $product;
                $found = true;
            }
        }
        if (!$found) {
            array_unshift($products, $product);
        }
        save_products($products);
        remove_unused_upload($oldImage, $products);
        json_out(['ok' => true, 'product' => $product]);

    case 'delete_product':
        require_post($isPost);
        require_admin();
        $id = (string) ($input['id'] ?? '');
        $products = load_products();
        $removed  = array_filter($products, fn ($p) => $p['id'] === $id);
        $products = array_filter($products, fn ($p) => $p['id'] !== $id);
        save_products($products);
        foreach ($removed as $p) {
            remove_unused_upload((string) ($p['image'] ?? ''), $products);
        }
        json_out(['ok' => true]);

    // Photos arrive already resized to a JPEG by admin.js, sent as base64 inside JSON.
    case 'upload_image':
        require_post($isPost);
        require_admin();
        $bytes = base64_decode((string) ($input['data'] ?? ''), true);
        if ($bytes === false || $bytes === '' || strlen($bytes) > MAX_UPLOAD_BYTES) {
            json_out(['error' => 'Photo is empty or too big (max 5 MB)'], 422);
        }
        $info = @getimagesizefromstring($bytes);
        if (!$info || $info[2] !== IMAGETYPE_JPEG) {
            json_out(['error' => 'Photo must be a JPEG image'], 422);
        }
        // Named after the product, e.g. "mango-juice-1l.jpg"; "-2", "-3"… if that name is taken.
        $base = upload_slug((string) ($input['name'] ?? '')) ?: upload_slug((string) ($input['sku'] ?? '')) ?: 'item';
        if (!is_dir(UPLOAD_DIR)) {
            mkdir(UPLOAD_DIR, 0775, true);
        }
        $file = "$base.jpg";
        for ($n = 2; file_exists(UPLOAD_DIR . '/' . $file); $n++) {
            $file = "$base-$n.jpg";
        }
        if (file_put_contents(UPLOAD_DIR . '/' . $file, $bytes, LOCK_EX) === false) {
            json_out(['error' => 'Could not save the photo. Is uploads/ writable?'], 500);
        }
        json_out(['ok' => true, 'image' => 'uploads/' . $file]);

    default:
        json_out(['error' => 'Unknown action'], 404);
}
