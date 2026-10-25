# Rasan Global Ltd — Sales Catalog (PHP)

A responsive product catalog for salesmen (phone, iPad, desktop).

- **Categories first:** Drink, Toys, House Hold, General Foods, Sweets, Chips Biscuits & Gummy Bars (photos in `uploads/categoryImages/`)
- **Each product shows:** image, name, SKU, note, Stock In / Stock Out, and a hidden price
- **Order → PDF:** add products, set quantities, write a note per item, enter the customer's company name, address and phone, then export a PDF order
- **Admin page** (`admin.php`) to add, edit and delete products, switch stock, and upload product photos

No database, no Composer and no outside services: products are stored in `data/products.json` and photos in `uploads/`.

## Run it

```bash
cd rasan_global_catalog
php -S 0.0.0.0:8000
```

- Catalog: http://localhost:8000
- Admin:   http://localhost:8000/admin.php (password in `config.php`)

To open it on an iPad or phone on the same Wi-Fi, use `http://<your-computer-ip>:8000`.
For real use, upload the folder to any PHP 8+ host (Apache works with the included `.htaccess`). `data/` and `uploads/` must be writable by PHP.

## The hidden price (how salesmen read it)

Customers never see the real price. Each product shows a **letter code** built from a secret 10-letter key (`price_key` in `config.php`):

| Digit  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0 |
|--------|---|---|---|---|---|---|---|---|---|---|
| Letter | M | A | K | E | P | R | O | F | I | T |

`MA.PT` = **12.50** · `M.AP` = **1.25** · `T.EP` = **0.45**

Salesmen learn the word **MAKEPROFIT**, so they can read prices in front of a customer without anyone else knowing.
You can change it to any word with 10 *different* letters, e.g. `BLACKHORSE`.

**Second option, the PIN:** tap the 🔒 button (or any price code) and enter the salesman PIN. The real prices and the order total then appear on that device for `unlock_minutes` before locking again. The real prices are never sent to the browser until the PIN is entered, so they can't be found with "view source".
Exporting the PDF needs the PIN, because the PDF shows the real prices.

## Product photos

In `admin.php`, tap the photo box and choose a picture. It is resized in the browser to at most 1200px, saved as a JPEG in `uploads/` on your server, and shown in the catalog and in the PDF. When a product is deleted or gets a new photo, the old file is removed.
You can also paste any `https://` image link instead (images from other sites may not appear inside the PDF).

Back up `uploads/` together with `data/products.json`.

## Before going live: change these in `config.php`

- `company`: name, address, phone and email (printed on the PDF)
- `currency`
- `salesman_pin` (default `1234`)
- `admin_password` (default `change-me-now`)
- `price_key`, if you want a different secret word

## Files

```
index.php          catalog page
admin.php          product admin
api.php            JSON API (catalog, PIN unlock, admin CRUD)
lib.php            helpers (price code, storage, session)
config.php         all settings
data/products.json products (12 samples included, delete them in admin)
assets/            CSS + JS (PDF uses jsPDF + autoTable from cdnjs)
uploads/           product photos (only .jpg files can be opened)
```
