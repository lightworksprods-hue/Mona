const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Counter POS Database for Supabase...');

  // 1. Initial Store Settings
  const storeSettings = await prisma.storeSettings.upsert({
    where: { id: 'default-store-settings' },
      update: {
        storeName: 'MONA',
        receiptFooter: 'Thank you for shopping at MONA! Please come again.',
      },
    create: {
      id: 'default-store-settings',
      storeName: 'MONA',
      storeAddress: '88 Ayala Ave, Makati, Metro Manila',
      phone: '(02) 8812-3456 / 0917-123-4567',
      taxRate: 12.00, // 12% VAT in Philippines
      currencySymbol: '₱',
      receiptFooter: 'Thank you for shopping at MONA! Please come again.',
    },
  });
  console.log('Created Store Settings:', storeSettings.storeName);

  // 2. Initial Users (Admin & Cashier)
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const cashierPassword = await bcrypt.hash('cashier123', salt);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'Store Manager',
      email: 'admin@metropink.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  const cashierUser = await prisma.user.upsert({
    where: { username: 'cashier1' },
    update: {},
    create: {
      username: 'cashier1',
      fullName: 'Ana Santos (Cashier)',
      email: 'ana.cashier@metropink.com',
      passwordHash: cashierPassword,
      role: 'CASHIER',
    },
  });
  console.log('Created Users:', adminUser.username, cashierUser.username);

  // 3. Categories
  const categoriesData = [
    { name: 'Beverages', description: 'Bottled drinks, juices, soda, water' },
    { name: 'Bakery & Bread', description: 'Fresh loaves, pastries, biscuits' },
    { name: 'Snacks & Sweets', description: 'Chips, chocolates, candies' },
    { name: 'Dairy & Eggs', description: 'Fresh milk, butter, cheese, eggs' },
    { name: 'Pantry Staples', description: 'Rice, cooking oil, canned goods, sauces' },
    { name: 'Personal Care', description: 'Soaps, shampoo, toothpaste' },
    { name: 'Meat & Poultry', description: 'Fresh pork, beef, chicken, and processed meat' },
    { name: 'Frozen Foods', description: 'Frozen meals, seafood, vegetables, and desserts' },
    { name: 'Hotdogs & Sausages', description: 'Hotdogs, sausages, bacon, and cold cuts' },
    { name: 'Biscuits & Crackers', description: 'Biscuits, cookies, crackers, and wafers' },
    { name: 'Canned Goods', description: 'Canned meat, fish, vegetables, and fruit' },
    { name: 'Condiments & Sauces', description: 'Ketchup, mayonnaise, sauces, and seasonings' },
    { name: 'Household Essentials', description: 'Laundry, cleaning, paper, and kitchen supplies' },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const createdCat = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap[cat.name] = createdCat.id;
  }
  console.log('Created Categories:', Object.keys(categoryMap).length);

  // 4. Products with real Barcodes (EAN-13 / UPC-A compatible barcodes)
  const productsData = [
    {
      name: 'San Miguel Pale Pilsen 330ml Can',
      sku: 'BEV-SMP-330',
      barcode: '4800010075012',
      categoryId: categoryMap['Beverages'],
      description: 'Filipino premier lager beer',
      costPrice: 42.50,
      sellingPrice: 58.00,
      stockQuantity: 120,
      minStockLevel: 24,
      unit: 'can',
    },
    {
      name: 'Nature Spring Purified Water 500ml',
      sku: 'BEV-WAT-500',
      barcode: '4800049720013',
      categoryId: categoryMap['Beverages'],
      description: 'Bottled drinking water',
      costPrice: 10.00,
      sellingPrice: 16.50,
      stockQuantity: 240,
      minStockLevel: 50,
      unit: 'bottle',
    },
    {
      name: 'Coca-Cola Original Taste 1.5L',
      sku: 'BEV-COKE-15L',
      barcode: '4800016024182',
      categoryId: categoryMap['Beverages'],
      description: 'Classic carbonated soft drink 1.5 Liter',
      costPrice: 58.00,
      sellingPrice: 75.00,
      stockQuantity: 65,
      minStockLevel: 15,
      unit: 'bottle',
    },
    {
      name: 'Gardenia Classic White Bread 600g',
      sku: 'BAK-GAR-600',
      barcode: '4800014010019',
      categoryId: categoryMap['Bakery & Bread'],
      description: 'Fresh baked sliced white loaf',
      costPrice: 65.00,
      sellingPrice: 82.50,
      stockQuantity: 35,
      minStockLevel: 10,
      unit: 'pack',
    },
    {
      name: 'Oishi Prawn Crackers 60g',
      sku: 'SNK-OIS-060',
      barcode: '4800092110014',
      categoryId: categoryMap['Snacks & Sweets'],
      description: 'Crispy prawn flavored snack',
      costPrice: 15.00,
      sellingPrice: 22.00,
      stockQuantity: 95,
      minStockLevel: 20,
      unit: 'pack',
    },
    {
      name: 'Piattos Cheese Flavored Potato Chips 85g',
      sku: 'SNK-PIA-085',
      barcode: '4800016622012',
      categoryId: categoryMap['Snacks & Sweets'],
      description: 'Hexagonal potato chips cheese flavor',
      costPrice: 28.50,
      sellingPrice: 38.00,
      stockQuantity: 80,
      minStockLevel: 15,
      unit: 'pack',
    },
    {
      name: 'Magnolia Fresh Milk 1 Liter',
      sku: 'DAI-MAG-1000',
      barcode: '4800011145011',
      categoryId: categoryMap['Dairy & Eggs'],
      description: '100% pure fresh cow milk',
      costPrice: 85.00,
      sellingPrice: 108.00,
      stockQuantity: 28,
      minStockLevel: 8,
      unit: 'carton',
    },
    {
      name: 'Bounty Fresh Farm Eggs (Tray of 12)',
      sku: 'DAI-EGG-012',
      barcode: '4800088210124',
      categoryId: categoryMap['Dairy & Eggs'],
      description: 'Fresh brown eggs grade A dozen',
      costPrice: 95.00,
      sellingPrice: 120.00,
      stockQuantity: 40,
      minStockLevel: 12,
      unit: 'tray',
    },
    {
      name: 'Dinorado Premium Fragrant Rice 5kg',
      sku: 'PAN-RIC-5KG',
      barcode: '4800033100050',
      categoryId: categoryMap['Pantry Staples'],
      description: 'Aromatic soft grain white rice',
      costPrice: 260.00,
      sellingPrice: 320.00,
      stockQuantity: 50,
      minStockLevel: 10,
      unit: 'bag',
    },
    {
      name: 'Century Tuna Flakes in Oil 180g',
      sku: 'PAN-CEN-180',
      barcode: '4800042120018',
      categoryId: categoryMap['Pantry Staples'],
      description: 'Healthy canned tuna flakes',
      costPrice: 38.00,
      sellingPrice: 48.50,
      stockQuantity: 110,
      minStockLevel: 25,
      unit: 'can',
    },
    {
      name: 'Safeguard Pure White Soap 130g',
      sku: 'PER-SAF-130',
      barcode: '4902430120015',
      categoryId: categoryMap['Personal Care'],
      description: 'Antibacterial bath soap',
      costPrice: 42.00,
      sellingPrice: 55.00,
      stockQuantity: 75,
      minStockLevel: 15,
      unit: 'bar',
    },
    {
      name: 'Colgate Total Clean Mint Toothpaste 150g',
      sku: 'PER-COL-150',
      barcode: '6920354810012',
      categoryId: categoryMap['Personal Care'],
      description: '12 hour antibacterial cavity protection',
      costPrice: 88.00,
      sellingPrice: 115.00,
      stockQuantity: 45,
      minStockLevel: 10,
      unit: 'tube',
    },
  ];

  // Add 88 more products to the original 12-item catalog (100 total).
  // Product barcodes are generated uniquely for this seed catalog.
  const extraProductGroups = [
    {
      categoryName: 'Meat & Poultry', unit: 'kg', cost: 180, price: 235,
      names: [
        'Pork Kasim', 'Pork Liempo', 'Pork Chop', 'Pork Ground Meat', 'Pork Tenderloin',
        'Beef Sirloin', 'Beef Tapa Slices', 'Beef Ground Meat', 'Chicken Breast Fillet', 'Chicken Leg Quarter', 'Chicken Wings',
      ],
    },
    {
      categoryName: 'Frozen Foods', unit: 'pack', cost: 55, price: 85,
      names: [
        'Frozen French Fries', 'Frozen Mixed Vegetables', 'Frozen Green Peas', 'Frozen Corn', 'Frozen Fish Fillet',
        'Frozen Breaded Fish', 'Frozen Squid Rings', 'Frozen Shrimp', 'Frozen Siomai', 'Frozen Spring Rolls', 'Frozen Pizza',
      ],
    },
    {
      categoryName: 'Hotdogs & Sausages', unit: 'pack', cost: 70, price: 105,
      names: [
        'Classic Beef Hotdog', 'Chicken Hotdog', 'Cheese Hotdog', 'Jumbo Hotdog', 'Cocktail Hotdog',
        'Pork Sausage', 'Cheese Sausage', 'Breakfast Sausage', 'Longganisa Regular', 'Longganisa Hamonado', 'Bacon Slices',
      ],
    },
    {
      categoryName: 'Biscuits & Crackers', unit: 'pack', cost: 18, price: 28,
      names: [
        'Butter Cookies', 'Chocolate Chip Cookies', 'Cream-O Cookies', 'Chocolate Wafers', 'Vanilla Wafers',
        'Saltine Crackers', 'Cheese Crackers', 'Graham Crackers', 'Peanut Butter Biscuits', 'Milk Biscuits', 'Coconut Biscuits',
      ],
    },
    {
      categoryName: 'Canned Goods', unit: 'can', cost: 28, price: 42,
      names: [
        'Canned Corned Beef', 'Canned Beef Loaf', 'Canned Meatloaf', 'Canned Sardines Tomato', 'Canned Sardines Chili',
        'Canned Tuna Hot & Spicy', 'Canned Mackerel', 'Canned Pork & Beans', 'Canned Mushroom', 'Canned Green Peas', 'Canned Fruit Cocktail',
      ],
    },
    {
      categoryName: 'Condiments & Sauces', unit: 'bottle', cost: 35, price: 55,
      names: [
        'Banana Ketchup', 'Tomato Ketchup', 'Mayonnaise', 'Soy Sauce', 'Vinegar',
        'Oyster Sauce', 'Fish Sauce', 'Sweet Chili Sauce', 'Hot Sauce', 'All-Purpose Seasoning', 'Barbecue Marinade',
      ],
    },
    {
      categoryName: 'Household Essentials', unit: 'piece', cost: 45, price: 70,
      names: [
        'Laundry Detergent Powder', 'Fabric Conditioner', 'Dishwashing Liquid', 'Bleach', 'Floor Cleaner',
        'Glass Cleaner', 'Toilet Cleaner', 'Sponge Scrub', 'Garbage Bags', 'Paper Towels', 'Aluminum Foil',
      ],
    },
    {
      categoryName: 'Snacks & Sweets', unit: 'pack', cost: 20, price: 32,
      names: [
        'Potato Chips Original', 'Potato Chips Barbecue', 'Cheese Puffs', 'Nacho Chips', 'Chocolate Bar',
        'Peanut Candy', 'Gummy Candies', 'Lollipop Assorted', 'Caramel Popcorn', 'Trail Mix', 'Roasted Peanuts',
      ],
    },
  ];

  let generatedBarcode = 1;
  for (const group of extraProductGroups) {
    group.names.forEach((name, index) => {
      const code = String(generatedBarcode++).padStart(7, '0');
      productsData.push({
        name,
        sku: `${group.categoryName.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
        barcode: `480900${code}`,
        categoryId: categoryMap[group.categoryName],
        description: `${name} for everyday grocery shopping`,
        costPrice: group.cost,
        sellingPrice: group.price,
        stockQuantity: 20 + ((index * 7) % 81),
        minStockLevel: 10,
        unit: group.unit,
      });
    });
  }

  console.log('Products prepared:', productsData.length);

  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { barcode: p.barcode },
      update: {},
      create: p,
    });

    // Record initial restock movement
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type: 'RESTOCK',
        quantity: product.stockQuantity,
        balanceAfter: product.stockQuantity,
        reason: 'Initial store inventory seed',
        userId: adminUser.id,
      },
    });
  }

  console.log('Seeded Products:', productsData.length);
  console.log('Database Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
