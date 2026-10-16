const prisma = require('../config/db');

// List all categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// Create category
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const existing = await prisma.category.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists.' });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
      },
    });

    res.status(201).json({ success: true, message: 'Category created.', data: category });
  } catch (error) {
    next(error);
  }
};

// Update category
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description ? description.trim() : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    res.json({ success: true, message: 'Category updated.', data: category });
  } catch (error) {
    next(error);
  }
};

// Delete category
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    res.json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    next(error);
  }
};
