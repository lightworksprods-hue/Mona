const prisma = require('../config/db');
const { createAuditLog } = require('../services/auditService');

// Get all products with optional search query & category filter
exports.getProducts = async (req, res, next) => {
  try {
    const { search, categoryId, activeOnly } = req.query;

    const where = {};
    if (activeOnly === 'true' || activeOnly === true) {
      where.isActive = true;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      ...(activeOnly === 'true' || activeOnly === true
        ? {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              sellingPrice: true,
              stockQuantity: true,
              unit: true,
              isActive: true,
              category: { select: { id: true, name: true } },
            },
          }
        : {
            include: {
              category: { select: { id: true, name: true } },
            },
          }),
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

// Scan barcode fast lookup (Critical for Counter POS)
exports.lookupBarcode = async (req, res, next) => {
  try {
    const { code } = req.params;
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Barcode is required.' });
    }

    const trimmed = code.trim();

    // Try exact match on barcode or SKU
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ barcode: trimmed }, { sku: trimmed }],
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with barcode/SKU "${trimmed}" was not found.`,
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: `Product "${product.name}" is marked inactive and cannot be sold.`,
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Get single product by ID
exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Create product (Admin only)
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      sku,
      barcode,
      categoryId,
      description,
      costPrice,
      sellingPrice,
      stockQuantity = 0,
      minStockLevel = 5,
      unit = 'pcs',
      taxRate = 0,
      isActive = true,
    } = req.body;

    const existingBarcode = await prisma.product.findUnique({ where: { barcode } });
    if (existingBarcode) {
      return res.status(400).json({ success: false, message: `Barcode "${barcode}" is already assigned to "${existingBarcode.name}".` });
    }

    const existingSku = await prisma.product.findUnique({ where: { sku } });
    if (existingSku) {
      return res.status(400).json({ success: false, message: `SKU "${sku}" is already assigned to "${existingSku.name}".` });
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        barcode,
        categoryId: categoryId || null,
        description,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        stockQuantity: parseFloat(stockQuantity) || 0,
        minStockLevel: parseFloat(minStockLevel) || 5,
        unit,
        taxRate: parseFloat(taxRate) || 0,
        isActive: Boolean(isActive),
      },
      include: {
        category: true,
      },
    });

    // Record initial inventory movement if stock > 0
    if (product.stockQuantity > 0) {
      await prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'RESTOCK',
          quantity: product.stockQuantity,
          balanceAfter: product.stockQuantity,
          reason: 'Initial stock intake on product creation',
          userId: req.user.id,
        },
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product.id,
      details: { name, barcode, sku, sellingPrice },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Update product (Admin only)
exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      sku,
      barcode,
      categoryId,
      description,
      costPrice,
      sellingPrice,
      minStockLevel,
      unit,
      taxRate,
      isActive,
    } = req.body;

    // Check unique barcode and SKU conflict
    if (barcode) {
      const conflict = await prisma.product.findFirst({
        where: { barcode, NOT: { id } },
      });
      if (conflict) {
        return res.status(400).json({ success: false, message: `Barcode "${barcode}" is already in use by another product.` });
      }
    }

    if (sku) {
      const conflict = await prisma.product.findFirst({
        where: { sku, NOT: { id } },
      });
      if (conflict) {
        return res.status(400).json({ success: false, message: `SKU "${sku}" is already in use by another product.` });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (sku !== undefined) data.sku = sku;
    if (barcode !== undefined) data.barcode = barcode;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (description !== undefined) data.description = description;
    if (costPrice !== undefined) data.costPrice = parseFloat(costPrice);
    if (sellingPrice !== undefined) data.sellingPrice = parseFloat(sellingPrice);
    if (minStockLevel !== undefined) data.minStockLevel = parseFloat(minStockLevel);
    if (unit !== undefined) data.unit = unit;
    if (taxRate !== undefined) data.taxRate = parseFloat(taxRate);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: id,
      details: data,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Delete / Deactivate product
exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if product has sales
    const salesCount = await prisma.saleItem.count({ where: { productId: id } });
    if (salesCount > 0) {
      // Soft-delete / deactivate to preserve historical transaction integrity
      const deactivated = await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return res.json({
        success: true,
        message: 'Product has transaction history; it has been deactivated instead of deleted.',
        data: deactivated,
      });
    }

    await prisma.product.delete({ where: { id } });

    await createAuditLog({
      userId: req.user.id,
      action: 'PRODUCT_DELETED',
      entity: 'Product',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Product permanently removed.' });
  } catch (error) {
    next(error);
  }
};
