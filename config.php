<?php
// ─────────────────────────────────────────────────────────────
//  Rasan Global Ltd — Sales Catalog configuration
//  Edit the values below, then reload the site.
// ─────────────────────────────────────────────────────────────
return [

    // Your company details (printed at the top of every PDF order)
    'company' => [
        'name'    => 'Rasan Global Ltd',
        'address' => 'Unit 6, Monmore Business Park, Dixon St, Wolverhampton, WV2 2BT',
        'phone'   => '07915289882',
        'email'   => 'rasangloballtd@yahoo.com',
    ],

    'currency' => '$',

    // ── Hidden price system ──────────────────────────────────
    // Customers never see the real price. Each product shows a
    // secret letter code instead, built from this 10-letter key:
    //
    //      digit:  1 2 3 4 5 6 7 8 9 0
    //      letter: M A K E P R O F I T
    //
    // e.g. price 12.50  →  code "MA.PT"
    // Only salesmen know the key, so they can read prices at a glance.
    // The key MUST be 10 different letters.
    'price_key' => 'MAKEPROFIT',

    // PIN that unlocks real prices on the device (also needed to export the PDF)
    'salesman_pin' => '2026',

    // Minutes before the prices lock again automatically
    'unlock_minutes' => 20,

    // Password for admin.php (add / edit products, upload images)
    'admin_password' => '2026',

    // ── Categories (shown first, in this order) ──────────────
    // 'image' is the photo on the category card (optional).
    'categories' => [
        'drink'         => ['label' => 'Drink',         'icon' => '🥤', 'image' => 'uploads/categoryImages/cate_drinks.jpg'],
        'toys'          => ['label' => 'Toys',          'icon' => '🧸', 'image' => 'uploads/categoryImages/cate_toys.jpg'],
        'household'     => ['label' => 'House Hold',    'icon' => '🏠', 'image' => 'uploads/categoryImages/cate_househodling.jpg'],
        'general_foods' => ['label' => 'General Foods', 'icon' => '🥫', 'image' => 'uploads/categoryImages/cate_foods.jpg'],
        'sweets'        => ['label' => 'Sweets',        'icon' => '🍬', 'image' => 'uploads/categoryImages/cate_sweets.jpg'],
        'snacks'        => ['label' => 'Chips, Biscuits & Gummy Bars', 'icon' => '🍟', 'image' => 'uploads/categoryImages/cate_ChipsBiscuitsGummyBars.jpg'],
    ],
];
