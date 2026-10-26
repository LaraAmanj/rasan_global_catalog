<?php
declare(strict_types=1);

// Own cookie name and path, so it never clashes with another PHP site on the same domain
session_name('RGCATALOG');
session_set_cookie_params([
    'path'     => rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/\\') . '/',
    'secure'   => ($_SERVER['HTTPS'] ?? 'off') !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

const DATA_FILE = __DIR__ . '/data/products.json';
const UPLOAD_DIR = __DIR__ . '/uploads';
const UPLOAD_PATTERN = '#^uploads/[A-Za-z0-9_-]+\.jpg$#';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function cfg(?string $key = null)
{
    static $config;
    $config ??= require __DIR__ . '/config.php';
    return $key === null ? $config : ($config[$key] ?? null);
}

function e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function load_products(): array
{
    if (!is_file(DATA_FILE)) {
        return [];
    }
    $data = json_decode((string) file_get_contents(DATA_FILE), true);
    $data = is_array($data) ? $data : [];
    // Sorted by SKU, natural order so TOY-2 comes before TOY-10
    usort($data, fn ($a, $b) => strnatcasecmp((string) ($a['sku'] ?? ''), (string) ($b['sku'] ?? '')));
    return $data;
}

function save_products(array $products): void
{
    if (!is_dir(dirname(DATA_FILE))) {
        mkdir(dirname(DATA_FILE), 0775, true);
    }
    $json = json_encode(array_values($products), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    file_put_contents(DATA_FILE, $json, LOCK_EX);
}

/** Turns "Mango Juice 1L" into "mango-juice-1l" for photo file names. */
function upload_slug(string $text): string
{
    $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($text)), '-');
    return rtrim(substr($slug, 0, 60), '-');
}

/** Deletes a photo from uploads/ once no product uses it any more. */
function remove_unused_upload(string $image, array $products): void
{
    if (!preg_match(UPLOAD_PATTERN, $image)) {
        return;
    }
    foreach ($products as $p) {
        if (($p['image'] ?? '') === $image) {
            return;
        }
    }
    @unlink(__DIR__ . '/' . $image);
}

/** Turns 12.50 into "MA.PT" using the secret 10-letter price key. */
function price_code(float $price): string
{
    $key = strtoupper((string) cfg('price_key'));
    if (strlen($key) !== 10 || count(array_unique(str_split($key))) !== 10) {
        $key = 'MAKEPROFIT';
    }
    $code = '';
    foreach (str_split(number_format($price, 2, '.', '')) as $ch) {
        $code .= $ch === '.' ? '.' : $key[((int) $ch + 9) % 10];
    }
    return $code;
}

function is_salesman(): bool
{
    return ($_SESSION['salesman_until'] ?? 0) > time();
}

function is_admin(): bool
{
    return !empty($_SESSION['admin']);
}

/** Adds ?v=<file time> to uploaded photos so browsers can cache them for a long time but still see a replaced photo. */
function image_url(string $image): string
{
    if (!preg_match(UPLOAD_PATTERN, $image)) {
        return $image;
    }
    $time = @filemtime(__DIR__ . '/' . $image);
    return $time ? "$image?v=$time" : $image;
}

/** What the catalog is allowed to see. The real price only leaves the server after the PIN is entered. */
function public_product(array $p): array
{
    $out = [
        'id'         => $p['id'],
        'name'       => $p['name'],
        'category'   => $p['category'],
        'sku'        => $p['sku'],
        'note'       => $p['note'] ?? '',
        'image'      => image_url((string) ($p['image'] ?? '')),
        'in_stock'   => (bool) ($p['in_stock'] ?? true),
        'price_code' => price_code((float) $p['price']),
    ];
    if (is_salesman()) {
        $out['price'] = (float) $p['price'];
    }
    return $out;
}

function json_out(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
