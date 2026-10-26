import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const emptyOrder = {
  order_number: '',
  order_date: new Date().toLocaleDateString('en-CA'),
  order_time: new Date().toTimeString().slice(0, 5),
  fare: '',
  invoice_amount: '',
  cash_received: '',
  card_transfer: '',
  office_pos: '',
  personal_purchase: '',
  customer_change: '',
  other_expense: '',
  notes: '',
}

const money = (value) =>
  new Intl.NumberFormat('fa-IR').format(Number(value || 0))

export default function Dashboard({ user, onSignOut }) {
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState(emptyOrder)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')

  async function loadOrders() {
    setLoading(true)

    let query = supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (date) query = query.eq('order_date', date)

    if (search.trim()) {
      const term = search.trim().replace(/[,%()]/g, '')
      if (term) query = query.ilike('order_number', `%${term}%`)
    }

    const { data, error } = await query

    if (error) {
      setMessage(`خطا در دریافت سفارش‌ها: ${error.message}`)
    } else {
      setOrders(data || [])
      setMessage('')
    }

    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [date, search])

  function updateField(event) {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  function resetForm() {
    setForm({
      ...emptyOrder,
      order_date: new Date().toLocaleDateString('en-CA'),
      order_time: new Date().toTimeString().slice(0, 5),
    })
    setEditingId(null)
  }

  async function saveOrder(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    const payload = {
      user_id: user.id,
      order_number: form.order_number.trim(),
      order_date: form.order_date,
      order_time: form.order_time || null,
      fare: Number(form.fare || 0),
      invoice_amount: Number(form.invoice_amount || 0),
      cash_received: Number(form.cash_received || 0),
      card_transfer: Number(form.card_transfer || 0),
      office_pos: Number(form.office_pos || 0),
      personal_purchase: Number(form.personal_purchase || 0),
      customer_change: Number(form.customer_change || 0),
      other_expense: Number(form.other_expense || 0),
      notes: form.notes.trim(),
    }

    const result = editingId
      ? await supabase.from('orders').update(payload).eq('id', editingId)
      : await supabase.from('orders').insert(payload)

    if (result.error) {
      setMessage(`خطا در ذخیره: ${result.error.message}`)
    } else {
      setMessage(editingId ? 'سفارش ویرایش شد.' : 'سفارش ذخیره شد.')
      resetForm()
      await loadOrders()
    }

    setSaving(false)
  }

  function editOrder(order) {
    setForm({
      order_number: order.order_number || '',
      order_date: order.order_date || '',
      order_time: order.order_time?.slice(0, 5) || '',
      fare: String(order.fare ?? ''),
      invoice_amount: String(order.invoice_amount ?? ''),
      cash_received: String(order.cash_received ?? ''),
      card_transfer: String(order.card_transfer ?? ''),
      office_pos: String(order.office_pos ?? ''),
      personal_purchase: String(order.personal_purchase ?? ''),
      customer_change: String(order.customer_change ?? ''),
      other_expense: String(order.other_expense ?? ''),
      notes: order.notes || '',
    })
    setEditingId(order.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteOrder(order) {
    if (!window.confirm(`سفارش ${order.order_number} حذف شود؟`)) return

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', order.id)

    if (error) {
      setMessage(`خطا درحذف: ${error.message}`)
    } else {
      setMessage('سفارش حذف شد.')
      await loadOrders()
    }
  }

  const totalFare = orders.reduce((sum, order) => sum + Number(order.fare || 0), 0)
  const totalCash = orders.reduce((sum, order) => sum + Number(order.cash_received || 0), 0)
  const totalCard = orders.reduce((sum, order) => sum + Number(order.card_transfer || 0), 0)
  const totalExpenses = orders.reduce(
    (sum, order) =>
      sum +
      Number(order.personal_purchase || 0) +
      Number(order.customer_change || 0) +
      Number(order.other_expense || 0),
    0,
  )

  const fields = [
    ['order_number', 'شماره سفارش', 'text', true],
    ['order_date', 'تاریخ', 'date'],
    ['order_time', 'ساعت', 'time'],
    ['fare', 'کرایه پیک (تومان)', 'number'],
    ['invoice_amount', 'فاکتور مغازه (تومان)', 'number'],
    ['cash_received', 'وجه نقد دریافتی (تومان)', 'number'],
    ['card_transfer', 'واریز مستقیم به پیک (تومان)', 'number'],
    ['office_pos', 'پرداخت با کارت‌خوان دفتر (تومان)', 'number'],
    ['personal_purchase', 'خرید شخصی بابت سفارش (تومان)', 'number'],
    ['customer_change', 'پولی که به مشتری پس دادی (تومان)', 'number'],
    ['other_expense', 'سایر هزینه‌های شخصی (تومان)', 'number'],
  ]

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <h1>Courier Ledger</h1>
          <p>سلام، {user.email}</p>
        </div>
        <button className="logout" onClick={onSignOut}>خروج</button>
      </header>

      <section className="stats">
        <div className="stat">
          <span>تعداد سفارش‌ها</span>
          <strong>{money(orders.length)}</strong>
        </div>
        <div className="stat">
          <span>مجموع کرایه‌ها</span>
          <strong>{money(totalFare)}</strong>
          <small>تومان</small>
        </div>
        <div className="stat">
          <span>نقد دریافتی</span>
          <strong>{money(totalCash)}</strong>
          <small>تومان</small>
        </div>
        <div className="stat">
          <span>واریز مستقیم</span>
          <strong>{money(totalCard)}</strong>
          <small>تومان</small>
        </div>
        <div className="stat">
          <span>هزینه‌های ثبت‌شده</span>
          <strong>{money(totalExpenses)}</strong>
          <small>تومان</small>
        </div>
      </section>

      <section className="panel">
        <h2>{editingId ? 'ویرایش سفارش' : 'ثبت سفارش جدید'}</h2>

        <form className="order-form" onSubmit={saveOrder}>
          {fields.map(([name, label, type, required]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type={type}
                value={form[name]}
                onChange={updateField}
                required={Boolean(required)}
                min={type === 'number' ? 0 : undefined}
                step={type === 'number' ? 1 : undefined}
              />
            </label>
          ))}

          <label className="full-width">
            توضیحات
            <textarea
              name="notes"
              value={form.notes}
              onChange={updateField}
              rows="3"
            />
          </label>

          <div className="form-actions full-width">
            <button type="submit" disabled={saving}>
              {saving ? 'در حال ذخیره...' : editingId ? 'ذخیرهٔ تغییرات' : 'ثبت سفارش'}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                انصراف از ویرایش
              </button>
            )}
          </div>
        </form>

        {message && <div className="message">{message}</div>}
      </section>

      <section className="panel">
        <div className="list-heading">
          <h2>سفارش‌ها</h2>
          <button className="secondary refresh" onClick={loadOrders}>تازه‌سازی</button>
        </div>

        <div className="filters">
          <label>
            جست‌وجو با شماره سفارش
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="شماره سفارش..."
            />
          </label>
          <label>
            فیلتر تاریخ
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <button
            className="secondary clear-filter"
            onClick={() => { setDate(''); setSearch('') }}
          >
            پاک‌کردن فیلترها
          </button>
        </div>

        {loading ? (
          <p>در حال دریافت سفارش‌ها...</p>
        ) : orders.length === 0 ? (
          <p className="empty">هنوز سفارشی برای نمایش وجود ندارد.</p>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-title">
                  <strong>سفارش {order.order_number}</strong>
                  <span>{order.order_date} {order.order_time?.slice(0, 5)}</span>
                </div>
                <div className="order-details">
                  <span>کرایه: <b>{money(order.fare)}</b> تومان</span>
                  <span>فاکتور: {money(order.invoice_amount)} تومان</span>
                  <span>نقد دریافتی: {money(order.cash_received)} تومان</span>
                  <span>واریز مستقیم: {money(order.card_transfer)} تومان</span>
                  <span>کارت‌خوان دفتر: {money(order.office_pos)} تومان</span>
                </div>
                {order.notes && <p className="notes">{order.notes}</p>}
                <div className="order-actions">
                  <button className="secondary" onClick={() => editOrder(order)}>ویرایش</button>
                  <button className="danger" onClick={() => deleteOrder(order)}>حذف</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}