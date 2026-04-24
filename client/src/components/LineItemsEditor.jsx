import { useState, useEffect } from 'react'
import { Plus, X, Package, Pencil } from 'lucide-react'
import { adminFetch, formatCurrency } from '../hooks/useAdmin'

// Reusable line-item editor used by both the Jobs modals and the Invoice
// edit modal. Each row is either:
//   - picked from the Services catalog (pre-fills description + rate,
//     stamps serviceId so the backend can sync to a Stripe Price), OR
//   - typed freely (description + rate manually, serviceId stays null)
//
// Usage:
//   <LineItemsEditor items={items} onChange={setItems} />
//
// Parent stores the full array in its own state. This component doesn't
// manage persistence — callers send the array back to their API on save.

export default function LineItemsEditor({ items, onChange, showTotals = true, taxRate = 0 }) {
  const [catalog, setCatalog] = useState([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await adminFetch('/api/admin/services')
      if (!cancelled && res?.services) {
        setCatalog(res.services)
        setCatalogLoaded(true)
      } else if (!cancelled) {
        setCatalogLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const updateItem = (idx, patch) => {
    onChange(items.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  const addBlank = () => {
    onChange([...items, { description: '', quantity: 1, rate: 0, serviceId: null }])
  }

  const addFromCatalog = (service) => {
    onChange([
      ...items,
      {
        description: service.name,
        quantity: 1,
        rate: service.defaultPrice,
        serviceId: service.id,
      },
    ])
  }

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0)
  const tax = Math.round(subtotal * taxRate * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100

  return (
    <div className="space-y-3">
      {/* Existing rows */}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          No line items yet. Add from the catalog below, or type your own.
        </p>
      )}

      {items.map((item, idx) => (
        <LineItemRow
          key={idx}
          item={item}
          onUpdate={(patch) => updateItem(idx, patch)}
          onRemove={() => removeItem(idx)}
        />
      ))}

      {/* Add controls */}
      <div className="flex flex-wrap gap-2 pt-1">
        <CatalogPicker catalog={catalog} loaded={catalogLoaded} onPick={addFromCatalog} />
        <button
          type="button"
          onClick={addBlank}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
        >
          <Pencil size={12} />Custom line item
        </button>
      </div>

      {/* Running totals — tax row only appears if the rate is non-zero
          (Frontline's services are sales-tax-exempt in OK by default). */}
      {showTotals && items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-sm space-y-1">
          {tax > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
              <span className="font-medium">{formatCurrency(tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-charcoal-900 font-bold pt-1 border-t border-gray-100">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function LineItemRow({ item, onUpdate, onRemove }) {
  const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0)
  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 grid grid-cols-[1fr_70px_100px_100px] gap-2">
        <input
          value={item.description}
          onChange={e => onUpdate({ description: e.target.value })}
          placeholder="Service description"
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-forest-500 outline-none"
        />
        <input
          type="number"
          min="0"
          step="0.5"
          value={item.quantity}
          onChange={e => onUpdate({ quantity: Number(e.target.value) })}
          placeholder="Qty"
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-forest-500 outline-none text-right"
        />
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.rate}
            onChange={e => onUpdate({ rate: Number(e.target.value) })}
            placeholder="Rate"
            className="w-full pl-5 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-forest-500 outline-none text-right"
          />
        </div>
        <div className="flex items-center justify-end px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs font-semibold text-charcoal-900">
          {formatCurrency(amount)}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        title="Remove line item"
        className="p-1.5 rounded hover:bg-red-50 text-red-500"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function CatalogPicker({ catalog, loaded, onPick }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')

  const filtered = catalog.filter(s =>
    !filter || s.name.toLowerCase().includes(filter.toLowerCase())
  )

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (!e.target.closest('[data-catalog-picker]')) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handlePick = (service) => {
    onPick(service)
    setOpen(false)
    setFilter('')
  }

  if (loaded && catalog.length === 0) {
    return (
      <span className="text-[11px] text-gray-400 italic px-1">
        No services in catalog yet. Add some under <strong>Services</strong>, or use Custom line item below.
      </span>
    )
  }

  return (
    <div className="relative" data-catalog-picker>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-forest-50 border border-forest-200 hover:bg-forest-100 text-forest-800"
      >
        <Plus size={12} /><Package size={12} />From catalog
      </button>

      {open && (
        <div className="absolute z-20 left-0 mt-1 w-80 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="sticky top-0 p-2 bg-white border-b border-gray-100">
            <input
              autoFocus
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search services…"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-forest-500 outline-none"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-500">No services match.</div>
          ) : (
            <ul>
              {filtered.map(s => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(s)}
                    className="w-full text-left px-3 py-2 hover:bg-forest-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-charcoal-900 truncate">{s.name}</span>
                      <span className="text-xs font-semibold text-forest-700 shrink-0">{formatCurrency(s.defaultPrice)}</span>
                    </div>
                    {s.description && (
                      <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{s.description}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
