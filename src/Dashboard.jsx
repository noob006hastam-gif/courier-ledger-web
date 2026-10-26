import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const money = (value) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(Number(value) || 0));

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

const emptyOrder = () => ({
  order_number: '',
  order_date: today(),
  order_time: new Date().toTimeString().slice(0, 5),
  fare: '',
  invoice_amount: '',
  cash_received: '',
  card_transfer: '',
  office_pos: '',
  personal_purchase: '',
  customer_change: '',
  other_expense: '',
  status: 'settled',
  notes: ''
});

const expenseCategories = {
  fuel: 'بنزین',
  oil: 'روغن',
  repair: 'تعمیرات',
  parts: 'قطعات',
  other: 'سایر'
};

const emptyExpense = () => ({
  expense_date: today(),
  category: 'fuel',
  amount: '',
  odometer_km: '',
  next_service_km: '',
  description: ''
});

const emptySettlement = () => ({
  period_start: monthStart(),
  period_end: today(),
  office_transfer_received: '',
  cash_handed_over: '',
  commission_paid: '',
  notes: ''
});

function number(value) {
  return Math.max(0, Number(value) || 0);
}

function csvDownload(filename, rows) {
  const csv = '\uFEFF' + rows.map((row) =>
    row.map((value) => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard({ user, onSignOut }) {
  const [tab, setTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(today());

  const [orderForm, setOrderForm] = useState(emptyOrder());
  const [editingOrder, setEditingOrder] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);

  const [expenseForm, setExpenseForm] = useState(emptyExpense());
  const [editingExpense, setEditingExpense] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const [settlementForm, setSettlementForm] = useState(emptySettlement());
  const [showSettlementForm, setShowSettlementForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [orderResult, expenseResult, settlementResult] =
        await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .order('order_date', { ascending: false })
            .order('order_time', { ascending: false })
            .limit(2000),

          supabase
            .from('motorcycle_expenses')
            .select('*')
            .order('expense_date', { ascending: false })
            .limit(2000),

          supabase
            .from('settlements')
            .select('*')
            .order('period_end', { ascending: false })
            .limit(500)
        ]);

      if (orderResult.error) throw orderResult.error;
      if (expenseResult.error) throw expenseResult.error;
      if (settlementResult.error) throw settlementResult.error;

      setOrders(orderResult.data || []);
      setExpenses(expenseResult.data || []);
      setSettlements(settlementResult.data || []);
    } catch (err) {
      setError(
        err.message ||
        'بارگذاری اطلاعات ناموفق بود. اتصال و دسترسی دیتابیس رو بررسی کن.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (fromDate && order.order_date < fromDate) return false;
      if (toDate && order.order_date > toDate) return false;

      if (!query) return true;

      return [
        order.order_number,
        order.notes,
        order.status
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      );
    });
  }, [orders, search, fromDate, toDate]);

  const periodExpenses = useMemo(() => {
    return expenses.filter((expense) =>
      (!fromDate || expense.expense_date >= fromDate) &&
      (!toDate || expense.expense_date <= toDate)
    );
  }, [expenses, fromDate, toDate]);

  const stats = useMemo(() => {
    const active = filteredOrders.filter(
      (order) => order.status !== 'cancelled'
    );

    const sum = (key) => active.reduce(
      (total, order) => total + number(order[key]), 0
    );

    const fare = sum('fare');
    const commission = fare * 0.2;
    const motorcycleCosts = periodExpenses.reduce(
      (total, expense) => total + number(expense.amount), 0
    );

    return {
      count: active.length,
      invoices: sum('invoice_amount'),
      fare,
      commission,
      cash: sum('cash_received'),
      card: sum('card_transfer'),
      pos: sum('office_pos'),
      personal: sum('personal_purchase'),
      change: sum('customer_change'),
      other: sum('other_expense'),
      motorcycleCosts,
      estimatedNet: fare - commission - motorcycleCosts
    };
  }, [filteredOrders, periodExpenses]);

  function resetOrderForm() {
    setOrderForm(emptyOrder());
    setEditingOrder(null);
    setShowOrderForm(false);
  }

  function startEditOrder(order) {
    setEditingOrder(order.id);
    setOrderForm({
      ...emptyOrder(),
      ...order,
      fare: String(order.fare ?? ''),
      invoice_amount: String(order.invoice_amount ?? ''),
      cash_received: String(order.cash_received ?? ''),
      card_transfer: String(order.card_transfer ?? ''),
      office_pos: String(order.office_pos ?? ''),
      personal_purchase: String(order.personal_purchase ?? ''),
      customer_change: String(order.customer_change ?? ''),
      other_expense: String(order.other_expense ?? '')
    });
    setShowOrderForm(true);
    setTab('orders');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        user_id: user.id,
        order_number: orderForm.order_number.trim(),
        order_date: orderForm.order_date,
        order_time: orderForm.order_time || null,
        fare: number(orderForm.fare),
        invoice_amount: number(orderForm.invoice_amount),
        cash_received: number(orderForm.cash_received),
        card_transfer: number(orderForm.card_transfer),
        office_pos: number(orderForm.office_pos),
        personal_purchase: number(orderForm.personal_purchase),
        customer_change: number(orderForm.customer_change),
        other_expense: number(orderForm.other_expense),
        status: orderForm.status,
        notes: orderForm.notes.trim()
      };

      const result = editingOrder
        ? await supabase
            .from('orders')
            .update(payload)
            .eq('id', editingOrder)
            .eq('user_id', user.id)
        : await supabase.from('orders').insert(payload);

      if (result.error) throw result.error;

      setNotice(editingOrder ? 'سفارش ویرایش شد.' : 'سفارش ثبت شد.');
      resetOrderForm();
      await loadData();
    } catch (err) {
      setError(err.message || 'ذخیرهٔ سفارش انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteOrder(order) {
    if (!window.confirm(
      `سفارش ${order.order_number || 'بدون شماره'} حذف بشه؟`
    )) return;

    setError('');
    setNotice('');

    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', order.id)
      .eq('user_id', user.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice('سفارش حذف شد.');
    await loadData();
  }

  function startEditExpense(expense) {
    setEditingExpense(expense.id);
    setExpenseForm({
      ...emptyExpense(),
      ...expense,
      amount: String(expense.amount ?? ''),
      odometer_km: String(expense.odometer_km ?? ''),
      next_service_km: String(expense.next_service_km ?? '')
    });
    setShowExpenseForm(true);
    setTab('motorcycle');
  }

  function resetExpenseForm() {
    setExpenseForm(emptyExpense());
    setEditingExpense(null);
    setShowExpenseForm(false);
  }

  async function saveExpense(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        user_id: user.id,
        expense_date: expenseForm.expense_date,
        category: expenseForm.category,
        amount: number(expenseForm.amount),
        odometer_km: expenseForm.odometer_km
          ? Number(expenseForm.odometer_km)
          : null,
        next_service_km: expenseForm.next_service_km
          ? Number(expenseForm.next_service_km)
          : null,
        description: expenseForm.description.trim()
      };

      const result = editingExpense
        ? await supabase
            .from('motorcycle_expenses')
            .update(payload)
            .eq('id', editingExpense)
            .eq('user_id', user.id)
        : await supabase
            .from('motorcycle_expenses')
            .insert(payload);

      if (result.error) throw result.error;

      setNotice(editingExpense ? 'هزینه ویرایش شد.' : 'هزینه ثبت شد.');
      resetExpenseForm();
      await loadData();
    } catch (err) {
      setError(err.message || 'ذخیرهٔ هزینه انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteExpense(expense) {
    if (!window.confirm('این هزینه حذف بشه؟')) return;

    const { error: deleteError } = await supabase
      .from('motorcycle_expenses')
      .delete()
      .eq('id', expense.id)
      .eq('user_id', user.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice('هزینه حذف شد.');
    await loadData();
  }

  async function saveSettlement(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        user_id: user.id,
        period_start: settlementForm.period_start,
        period_end: settlementForm.period_end,
        office_transfer_received: number(
          settlementForm.office_transfer_received
        ),
        cash_handed_over: number(settlementForm.cash_handed_over),
        commission_paid: number(settlementForm.commission_paid),
        notes: settlementForm.notes.trim()
      };

      const { error: insertError } = await supabase
        .from('settlements')
        .insert(payload);

      if (insertError) throw insertError;

      setNotice('تسویه ثبت شد.');
      setSettlementForm(emptySettlement());
      setShowSettlementForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'ثبت تسویه انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  function exportOrders() {
    csvDownload('courier-orders.csv', [[
      'شماره سفارش', 'تاریخ', 'ساعت', 'کرایه',
      'فاکتور', 'نقد دریافتی', 'کارت به کارت',
      'پوز دفتر', 'خرید شخصی', 'پول خرد مشتری',
      'هزینه دیگر', 'وضعیت', 'یادداشت'
    ], ...orders.map((order) => [
      order.order_number, order.order_date, order.order_time,
      order.fare, order.invoice_amount, order.cash_received,
      order.card_transfer, order.office_pos,
      order.personal_purchase, order.customer_change,
      order.other_expense, order.status, order.notes
    ])]);
  }

  function exportExpenses() {
    csvDownload('motorcycle-expenses.csv', [[
      'تاریخ', 'دسته', 'مبلغ', 'کیلومتر',
      'کیلومتر سرویس بعدی', 'شرح'
    ], ...expenses.map((expense) => [
      expense.expense_date,
      expenseCategories[expense.category] || expense.category,
      expense.amount, expense.odometer_km,
      expense.next_service_km, expense.description
    ])]);
  }

  const latestOdometer = expenses
    .filter((item) => item.odometer_km != null)
    .reduce((max, item) => Math.max(max, Number(item.odometer_km)), 0);

  const upcomingService = expenses
    .filter((item) => item.next_service_km != null)
    .sort((a, b) => Number(a.next_service_km) - Number(b.next_service_km))[0];

  const nav = [
    ['overview', 'نمای کلی', '▦'],
    ['orders', 'سفارش‌ها', '▤'],
    ['motorcycle', 'هزینهٔ موتور', '◉'],
    ['settlements', 'تسویه‌ها', '⇄'],
    ['reports', 'گزارش‌ها', '▥']
  ];

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">CL</div>
          <div>
            <strong>Courier Ledger</strong>
            <small>دفتر حساب پیک موتوری</small>
          </div>
        </div>

        <div className="user-tools">
          <span className="user-email">{user.email}</span>
          <button className="ghost-button" onClick={onSignOut}>
            خروج
          </button>
        </div>
      </header>

      <nav className="tabbar" aria-label="بخش‌های برنامه">
        {nav.map(([id, label, icon]) => (
          <button
            key={id}
            className={`tab-button ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>

      <section className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">COURIER WORKSPACE</p>
            <h1>{nav.find(([id]) => id === tab)?.[1]}</h1>
            <p className="muted">اطلاعات مالی و کاری خودت رو مدیریت کن.</p>
          </div>
          <button className="ghost-button" onClick={loadData}>
            ↻ تازه‌سازی
          </button>
        </div>

        {error && <div className="alert error" role="alert">{error}</div>}
        {notice && <div className="alert success" role="status">{notice}</div>}

        {loading && (
          <div className="panel loading-panel">در حال دریافت اطلاعات...</div>
        )}

        {!loading && tab === 'overview' && (
          <>
            <div className="filter-row panel">
              <label>
                از تاریخ
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>
              <label>
                تا تاریخ
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
            </div>

            <div className="stats-grid">
              <Stat label="تعداد سفارش" value={money(stats.count)} />
              <Stat label="مجموع فاکتور مغازه" value={money(stats.invoices)} />
              <Stat label="مجموع کرایه" value={money(stats.fare)} featured />
              <Stat label="کمیسیون تخمینی ۲۰٪" value={money(stats.commission)} />
              <Stat label="دریافتی نقدی ثبت‌شده" value={money(stats.cash)} />
              <Stat label="کارت‌به‌کارت ثبت‌شده" value={money(stats.card)} />
              <Stat label="پوز دفتر ثبت‌شده" value={money(stats.pos)} />
              <Stat label="هزینه‌های موتور" value={money(stats.motorcycleCosts)} />
              <Stat
                label="خالص تخمینی"
                value={money(stats.estimatedNet)}
                featured
              />
            </div>

            <p className="muted footnote">
              همهٔ مبالغ به واحد پولی‌ای هستند که هنگام ثبت استفاده می‌کنی.
              خالص تخمینی = کرایه − کمیسیون تخمینی − هزینه‌های موتور.
              این عدد سود قطعی یا مبلغ تسویهٔ دفتر نیست.
            </p>

            <section className="panel">
              <div className="section-heading">
                <h2>آخرین سفارش‌ها</h2>
                <button
                  className="primary-button small"
                  onClick={() => {
                    resetOrderForm();
                    setShowOrderForm(true);
                    setTab('orders');
                  }}
                >
                  + سفارش جدید
                </button>
              </div>
              <OrderTable
                orders={filteredOrders.slice(0, 5)}
                onEdit={startEditOrder}
                onDelete={deleteOrder}
              />
            </section>
          </>
        )}

        {!loading && tab === 'orders' && (
          <>
            <div className="toolbar panel">
              <input
                aria-label="جست‌وجوی سفارش"
                placeholder="جست‌وجوی شماره سفارش یا یادداشت..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className="primary-button"
                onClick={() => {
                  resetOrderForm();
                  setShowOrderForm(!showOrderForm);
                }}
              >
                + ثبت سفارش
              </button>
              <button className="ghost-button" onClick={exportOrders}>
                خروجی CSV
              </button>
            </div>

            <div className="filter-row panel">
              <label>
                از تاریخ
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>
              <label>
                تا تاریخ
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
            </div>

            {showOrderForm && (
              <form className="panel data-form" onSubmit={saveOrder}>
                <div className="section-heading">
                  <h2>{editingOrder ? 'ویرایش سفارش' : 'سفارش جدید'}</h2>
                  <button
                    type="button"
                    className="text-button"
                    onClick={resetOrderForm}
                  >
                    بستن
                  </button>
                </div>

                <div className="form-grid">
                  <Field label="شماره سفارش">
                    <input
                      value={orderForm.order_number}
                      onChange={(e) => setOrderForm({
                        ...orderForm, order_number: e.target.value
                      })}
                      required
                    />
                  </Field>
                  <Field label="تاریخ">
                    <input
                      type="date"
                      value={orderForm.order_date}
                      onChange={(e) => setOrderForm({
                        ...orderForm, order_date: e.target.value
                      })}
                      required
                    />
                  </Field>
                  <Field label="ساعت">
                    <input
                      type="time"
                      value={orderForm.order_time || ''}
                      onChange={(e) => setOrderForm({
                        ...orderForm, order_time: e.target.value
                      })}
                    />
                  </Field>
                  <Field label="کرایهٔ پیک">
                    <input
                      type="number" min="0" step="1"
                      value={orderForm.fare}
                      onChange={(e) => setOrderForm({
                        ...orderFo