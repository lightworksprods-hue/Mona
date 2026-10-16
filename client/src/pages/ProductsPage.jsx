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
