import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';

const eanParity = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];
const eanLeft = {
  L: ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'],
  G: ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'],
};
const eanRight = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];

function barcodePattern(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 13) return null;
  const parity = eanParity[Number(digits[0])];
  let pattern = '101';
  for (let index = 1; index <= 6; index += 1) pattern += eanLeft[parity[index - 1]][Number(digits[index])];
  pattern += '01010';
  for (let index = 7; index <= 12; index += 1) pattern += eanRight[Number(digits[index])];
  return `${pattern}101`;
}

function barcodeSvg(value) {
  const pattern = barcodePattern(value);
  if (!pattern) return `<div class="barcode-fallback">${String(value || '')}</div>`;
  const bars = [...pattern].map((bit, index) => bit === '1' ? `<rect x="${index * 2}" y="0" width="2" height="82" />` : '').join('');
  return `<svg class="barcode-svg" viewBox="0 0 ${pattern.length * 2} 100" role="img" aria-label="Barcode ${value}"><g fill="#111">${bars}</g><text x="${pattern.length}" y="98" text-anchor="middle">${value}</text></svg>`;
}

function printBarcode(product) {
  const printWindow = window.open('', '_blank', 'width=520,height=420');
  if (!printWindow) return;
  const safe = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  printWindow.document.write(`<!doctype html><html><head><title>Barcode - ${safe(product.name)}</title><style>body{font-family:Arial,sans-serif;margin:24px;text-align:center;color:#111}.label{width:360px;margin:auto;padding:18px;border:1px dashed #999}.name{font-size:18px;font-weight:700;margin-bottom:6px}.meta{font-size:12px;color:#555;margin:3px}.price{font-size:16px;font-weight:700;margin-top:8px}.barcode-svg{display:block;width:100%;height:115px;margin:14px auto 0}.barcode-svg text{font:12px Arial}.barcode-fallback{font:24px monospace;margin:24px 0}@media print{body{margin:0}.label{border:0}}</style></head><body><div class="label"><div class="name">${safe(product.name)}</div><div class="meta">SKU: ${safe(product.sku)}</div>${barcodeSvg(product.barcode)}<div class="price">${safe(formatCurrency(product.sellingPrice))}</div></div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
  printWindow.document.close();
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isImportingProducts, setIsImportingProducts] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '',
    minStockLevel: '5',
    unit: 'pcs',
    buyOneTakeOne: false,
    description: '',
    isActive: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  // Search automatically while typing, with a short debounce to avoid excess requests.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, categoryFilter]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await api.getProducts({
        search,
        categoryId: categoryFilter,
      });
      setProducts(res.data || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;

    setErrorMessage('');
    setSuccessMessage('');
    setIsCreatingCategory(true);

    try {
      await api.createCategory({
        name,
        description: categoryDescription.trim(),
      });
      setCategoryName('');
      setCategoryDescription('');
      await loadCategories();
      setSuccessMessage(`Category "${name}" created successfully.`);
    } catch (err) {
      setErrorMessage(err.message || 'Error creating category');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const nextCharacter = text[index + 1];
      if (character === '"' && quoted && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === ',' && !quoted) {
        row.push(value.trim());
        value = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && nextCharacter === '\n') index += 1;
        row.push(value.trim());
        if (row.some((cell) => cell !== '')) rows.push(row);
        row = [];
        value = '';
      } else {
        value += character;
      }
    }

    row.push(value.trim());
    if (row.some((cell) => cell !== '')) rows.push(row);
    return rows;
  };

  const handleImportProducts = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');
    setIsImportingProducts(true);

    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('The CSV must contain a header row and at least one product row.');

      const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const requiredHeaders = ['name', 'sku', 'barcode', 'costprice', 'sellingprice'];
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
      if (missingHeaders.length) {
        throw new Error(`Missing required CSV columns: ${missingHeaders.join(', ')}`);
      }

      const categoryByName = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category]));
      const importedProducts = [];
      const errors = [];

      rows.slice(1).forEach((cells, rowIndex) => {
        const rowNumber = rowIndex + 2;
        const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
        const requiredValues = requiredHeaders.filter((header) => !record[header]);
        const costPrice = Number(record.costprice);
        const sellingPrice = Number(record.sellingprice);

        if (requiredValues.length) {
          errors.push(`Row ${rowNumber}: missing ${requiredValues.join(', ')}`);
          return;
        }
        if (!Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
          errors.push(`Row ${rowNumber}: costPrice and sellingPrice must be non-negative numbers`);
          return;
        }

        const categoryNameValue = record.category || record.categoryname;
        const category = categoryNameValue ? categoryByName.get(categoryNameValue.toLowerCase()) : null;
        if (categoryNameValue && !category) {
          errors.push(`Row ${rowNumber}: category "${categoryNameValue}" was not found`);
          return;
        }

        importedProducts.push({
          name: record.name,
          sku: record.sku,
          barcode: record.barcode,
          categoryId: category?.id || '',
          description: record.description || '',
          costPrice,
          sellingPrice,
          stockQuantity: record.stockquantity || 0,
          minStockLevel: record.minstocklevel || 5,
          unit: record.unit || 'pcs',
          taxRate: record.taxrate || 0,
          buyOneTakeOne: ['true', '1', 'yes'].includes((record.buyonetakeone || '').toLowerCase()),
          isActive: !['false', '0', 'no'].includes((record.isactive || '').toLowerCase()),
        });
      });

      let createdCount = 0;
      for (const product of importedProducts) {
        try {
          await api.createProduct(product);
          createdCount += 1;
        } catch (error) {
          errors.push(`SKU ${product.sku}: ${error.message || 'could not be created'}`);
        }
      }

      await loadProducts();
      if (errors.length) {
        setErrorMessage(`Imported ${createdCount} product${createdCount === 1 ? '' : 's'} with ${errors.length} issue${errors.length === 1 ? '' : 's'}: ${errors.join('; ')}`);
      } else {
        setSuccessMessage(`Successfully imported ${createdCount} product${createdCount === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to import products.');
    } finally {
      setIsImportingProducts(false);
    }
  };

  const downloadImportTemplate = () => {
    const template = 'name,sku,barcode,category,description,costPrice,sellingPrice,stockQuantity,minStockLevel,unit,taxRate,buyOneTakeOne,isActive\nSample Product,SAMPLE-001,2000000000015,Beverages,Example item,10,15,20,5,pcs,0,false,true\n';
    const url = URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      categoryId: categories[0]?.id || '',
      costPrice: '',
      sellingPrice: '',
      stockQuantity: '0',
      minStockLevel: '5',
      unit: 'pcs',
      buyOneTakeOne: false,
      description: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId || '',
      costPrice: p.costPrice.toString(),
      sellingPrice: p.sellingPrice.toString(),
      stockQuantity: p.stockQuantity.toString(),
      minStockLevel: p.minStockLevel.toString(),
      unit: p.unit || 'pcs',
      buyOneTakeOne: Boolean(p.buyOneTakeOne),
      description: p.description || '',
      isActive: p.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, formData);
        setSuccessMessage(`Product "${formData.name}" updated successfully.`);
      } else {
        await api.createProduct(formData);
        setSuccessMessage(`Product "${formData.name}" created successfully.`);
      }
      setIsModalOpen(false);
      loadProducts();
    } catch (err) {
      setErrorMessage(err.message || 'Error saving product');
    }
  };

  const handleGenerateBarcode = async () => {
    setIsGeneratingBarcode(true);
    setErrorMessage('');
    try {
      const res = await api.generateBarcode();
      setFormData((current) => ({ ...current, barcode: res.data.barcode }));
    } catch (err) {
      setErrorMessage(err.message || 'Unable to generate barcode.');
    } finally {
      setIsGeneratingBarcode(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to deactivate or remove product "${name}"?`)) {
      try {
        await api.deleteProduct(id);
        setSuccessMessage(`Product "${name}" handled successfully.`);
        loadProducts();
      } catch (err) {
        setErrorMessage(err.message || 'Error deleting product');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pos-panel-header" style={{ borderRadius: 'var(--radius-sm)' }}>
        <h1 className="pos-panel-title" style={{ fontSize: '18px' }}>Product Catalog Management</h1>
        <button id="btn-add-product" className="btn btn-primary" onClick={handleOpenAdd}>
          + Add Product
        </button>
      </div>

      <div className="pos-panel" style={{ padding: '16px' }}>
        <div style={{ marginBottom: '10px' }}>
          <h2 className="pos-panel-title" style={{ fontSize: '15px' }}>Add Category</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--secondary-text)', fontSize: '12px' }}>
            Create a category for the product catalog.
          </p>
        </div>
        <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-group" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <label className="field-label" htmlFor="category-name">Category Name *</label>
            <input
              id="category-name"
              type="text"
              required
              className="form-control"
              placeholder="e.g. Frozen Foods"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: '2 1 300px', marginBottom: 0 }}>
            <label className="field-label" htmlFor="category-description">Description (Optional)</label>
            <input
              id="category-description"
              type="text"
              className="form-control"
              placeholder="Short description"
              value={categoryDescription}
              onChange={(event) => setCategoryDescription(event.target.value)}
            />
          </div>
          <button id="btn-add-category" type="submit" className="btn btn-primary" disabled={isCreatingCategory}>
            {isCreatingCategory ? 'Adding...' : 'Add Category'}
          </button>
        </form>
      </div>

      <div className="pos-panel" style={{ padding: '16px' }}>
        <div style={{ marginBottom: '10px' }}>
          <h2 className="pos-panel-title" style={{ fontSize: '15px' }}>Bulk Import Products</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--secondary-text)', fontSize: '12px' }}>
            Upload a CSV file. Required columns: name, sku, barcode, costPrice, sellingPrice. Category values must match an existing category name.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="btn btn-primary" htmlFor="products-csv-import">
            {isImportingProducts ? 'Importing...' : 'Choose CSV File'}
          </label>
          <input
            id="products-csv-import"
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportProducts}
            disabled={isImportingProducts}
            style={{ display: 'none' }}
          />
          <button type="button" className="btn btn-secondary" onClick={downloadImportTemplate} disabled={isImportingProducts}>
            Download CSV Template
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="pos-panel" style={{ padding: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="search-input"
          style={{ flex: 1, minWidth: '220px' }}
          placeholder="Search by product name, SKU, or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-control"
          style={{ minWidth: '160px' }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Products Table */}
      <div className="pos-panel">
        <div className="table-container">
          <table className="pos-table" id="products-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Barcode</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Selling Price</th>
                <th style={{ textAlign: 'center' }}>Stock</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>
                    {isLoading ? 'Loading products...' : 'No products found.'}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.description && (
                        <div style={{ fontSize: '11px', color: 'var(--secondary-text)' }}>{p.description}</div>
                      )}
                    </td>
                    <td>{p.category?.name || 'Unassigned'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.sku}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      <div>{p.barcode}</div>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => printBarcode(p)} style={{ marginTop: '5px' }}>
                        Print label
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(p.costPrice)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {formatCurrency(p.sellingPrice)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="badge-tag"
                        style={{
                          backgroundColor:
                            p.stockQuantity <= 0
                              ? 'var(--error-bg)'
                              : p.stockQuantity <= p.minStockLevel
                              ? 'var(--warning-bg)'
                              : 'var(--light-pink)',
                          color:
                            p.stockQuantity <= 0
                              ? 'var(--error)'
                              : p.stockQuantity <= p.minStockLevel
                              ? 'var(--warning)'
                              : 'var(--dark-pink)',
                        }}
                      >
                        {p.stockQuantity} {p.unit}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge-tag ${p.isActive ? '' : 'btn-secondary'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: '6px' }}
                        onClick={() => handleOpenEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--error)' }}
                        onClick={() => handleDelete(p.id, p.name)}
                      >
                        {p.isActive ? 'Deactivate' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="form-group">
                  <label className="field-label">Product Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="field-label">SKU (Stock Keeping Unit) *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Barcode (EAN/UPC) *</label>
                    <div style={{ display: 'flex', gap: '7px' }}>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      />
                      <button type="button" className="btn btn-secondary" onClick={handleGenerateBarcode} disabled={isGeneratingBarcode}>
                        {isGeneratingBarcode ? 'Generating...' : 'Generate'}
                      </button>
                    </div>
                    <small style={{ color: 'var(--secondary-text)' }}>Generate an internal EAN-13 or enter a supplier barcode.</small>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="field-label">Category</label>
                    <select
                      className="form-control"
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="field-label">Unit of Measure</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="pcs, bottle, kg, can"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="field-label">Cost Price (₱) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="form-control"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Selling Price (₱) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="form-control"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {!editingProduct && (
                    <div className="form-group">
                      <label className="field-label">Initial Stock Quantity</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={formData.stockQuantity}
                        onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="field-label">Min Stock Alert Level</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={formData.minStockLevel}
                      onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="field-label">Description (Optional)</label>
                  <textarea
                    rows="2"
                    className="form-control"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="isActiveCheckbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <label htmlFor="isActiveCheckbox" className="field-label" style={{ marginBottom: 0 }}>
                    Active Product (Available for Cashier Scanning)
                  </label>
                </div>

                <div className="form-group promotion-toggle">
                  <input
                    type="checkbox"
                    id="buyOneTakeOneCheckbox"
                    checked={formData.buyOneTakeOne}
                    onChange={(e) => setFormData({ ...formData, buyOneTakeOne: e.target.checked })}
                  />
                  <label htmlFor="buyOneTakeOneCheckbox" className="field-label" style={{ marginBottom: 0 }}>
                    Buy 1 Take 1 promotion (deducts 2 units of stock for every 1 paid)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
