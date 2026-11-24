const board = document.getElementById('board');
const searchBox = document.getElementById('search');
const chipsBox = document.querySelector('.chips');
const sellerSel = document.getElementById('f-seller');
const minBox = document.getElementById('f-min');
const maxBox = document.getElementById('f-max');
const availSel = document.getElementById('f-avail');
const resetBtn = document.getElementById('f-reset');
const compareBar = document.getElementById('compare-bar');
const compareCount = document.getElementById('compare-count');
const compareOpen = document.getElementById('compare-open');
const compareClear = document.getElementById('compare-clear');
const compareDialog = document.getElementById('compare-dialog');
const compareBody = document.getElementById('compare-body');
const compareClose = document.getElementById('compare-close');

let products = [];
let activeCat = 'all';
const compareIds = new Set();

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML.replace(/"/g, '&quot;');
}

function availableOf(p) {
  return p.on_hand - p.reserved;
}

function isPreorder(p) {
  return Boolean(p.ready_on) && new Date(p.ready_on) > new Date();
}

function fmtDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shorten(text, max) {
  return text.length > max ? text.slice(0, max).trim() + '...' : text;
}

function fillChips() {
  const cats = [...new Set(products.map(p => p.category))].sort();
  if (activeCat !== 'all' && !cats.includes(activeCat)) activeCat = 'all';
  chipsBox.innerHTML = ['all', ...cats].map(c =>
    `<button class="chip ${c === activeCat ? 'active' : ''}" data-cat="${esc(c)}">${c === 'all' ? 'All' : esc(c)}</button>`
  ).join('');
}

function rowHTML(p) {
  const available = availableOf(p);
  const freePct = p.on_hand ? (available / p.on_hand) * 100 : 0;
  const heldPct = p.on_hand ? (p.reserved / p.on_hand) * 100 : 0;
  const preorder = isPreorder(p);

  let note;
  let low = false;
  if (preorder) {
    note = `Ready ${fmtDate(p.ready_on)}, ${available} kg open for pre-order`;
  } else if (available === 0) {
    note = 'Fully reserved';
    low = true;
  } else if (available <= 20) {
    note = `Only ${available} kg free`;
    low = true;
  } else {
    note = `${available} kg free, ${p.reserved} kg reserved`;
  }

  let button;
  if (available === 0) button = '<button class="btn" disabled>Not available</button>';
  else if (preorder) button = `<button class="btn pre" data-id="${p.id}">Pre-order</button>`;
  else button = `<button class="btn" data-id="${p.id}">Order</button>`;

  const pickupLine = p.pickup ? `<div class="where">${esc(p.pickup)}</div>` : '';
  const descLine = p.description ? `<div class="where">${esc(shorten(p.description, 90))}</div>` : '';

  return `
    <article class="row">
      <div>
        <div class="name">${esc(p.name)}</div>
        <div class="where">${esc(p.seller)}, ${esc(p.place)}</div>
        ${pickupLine}
        ${descLine}
        <label class="cmp"><input type="checkbox" data-cmp="${p.id}" ${compareIds.has(p.id) ? 'checked' : ''}> Compare</label>
      </div>
      <div class="bar-col">
        <div class="crate" role="img" aria-label="${available} kg free, ${p.reserved} kg reserved">
          <span class="free" style="width:${freePct}%"></span>
          <span class="held" style="width:${heldPct}%"></span>
        </div>
        <div class="stock-note ${low ? 'low' : ''}">${note}</div>
      </div>
      <div class="price">Rs ${p.unit_price}<small>per kg</small></div>
      ${button}
    </article>`;
}

function filtered() {
  const q = searchBox.value.trim().toLowerCase();
  const min = minBox.value === '' ? null : Number(minBox.value);
  const max = maxBox.value === '' ? null : Number(maxBox.value);
  return products.filter(p => {
    const available = availableOf(p);
    if (activeCat !== 'all' && p.category !== activeCat) return false;
    if (q && !p.name.toLowerCase().includes(q) && !p.seller.toLowerCase().includes(q)) return false;
    if (sellerSel.value !== 'all' && p.seller !== sellerSel.value) return false;
    if (min !== null && p.unit_price < min) return false;
    if (max !== null && p.unit_price > max) return false;
    if (availSel.value === 'in' && (available <= 0 || isPreorder(p))) return false;
    if (availSel.value === 'pre' && !isPreorder(p)) return false;
    return true;
  });
}

function updateCompareBar() {
  compareCount.textContent = compareIds.size;
  compareBar.classList.toggle('show', compareIds.size > 0);
  compareOpen.disabled = compareIds.size < 2;
}

function render() {
  const list = filtered();
  board.innerHTML = list.length
    ? list.map(rowHTML).join('')
    : '<p class="empty">Nothing matches. Clear the filters or try another search.</p>';
  updateCompareBar();
}

function fillSellers() {
  const current = sellerSel.value;
  const names = [...new Set(products.map(p => p.seller))].sort();
  sellerSel.innerHTML = '<option value="all">All sellers</option>' +
    names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  sellerSel.value = names.includes(current) ? current : 'all';
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Server returned ' + res.status);
    products = await res.json();
    fillChips();
    fillSellers();
    render();
  } catch (err) {
    board.innerHTML = '<p class="empty">Could not load produce. Check that the server is running, then refresh.</p>';
  }
}

function compareHTML(list) {
  const rows = [
    ['Seller', p => p.seller],
    ['Place', p => p.place || ''],
    ['Category', p => p.category],
    ['Price per kg', p => 'Rs ' + p.unit_price],
    ['Available', p => availableOf(p) + ' kg'],
    ['Reserved', p => p.reserved + ' kg'],
    ['Ready on', p => (isPreorder(p) ? fmtDate(p.ready_on) : 'Now')],
    ['Pickup or delivery', p => p.pickup || 'Not stated'],
    ['About', p => p.description || 'Not stated']
  ];
  const head = '<tr><th></th>' + list.map(p => `<th>${esc(p.name)}</th>`).join('') + '</tr>';
  const body = rows.map(([label, get]) =>
    `<tr><th>${label}</th>${list.map(p => `<td>${esc(String(get(p)))}</td>`).join('')}</tr>`
  ).join('');
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

[searchBox, minBox, maxBox].forEach(el => el.addEventListener('input', render));
[sellerSel, availSel].forEach(el => el.addEventListener('change', render));

chipsBox.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  activeCat = chip.dataset.cat;
  fillChips();
  render();
});

resetBtn.addEventListener('click', () => {
  searchBox.value = '';
  minBox.value = '';
  maxBox.value = '';
  sellerSel.value = 'all';
  availSel.value = 'all';
  activeCat = 'all';
  fillChips();
  render();
});

board.addEventListener('change', (e) => {
  const box = e.target.closest('input[data-cmp]');
  if (!box) return;
  const id = Number(box.dataset.cmp);
  if (box.checked) {
    if (compareIds.size >= 3) {
      box.checked = false;
      return;
    }
    compareIds.add(id);
  } else {
    compareIds.delete(id);
  }
  updateCompareBar();
});

compareOpen.addEventListener('click', () => {
  const list = [...compareIds].map(id => products.find(p => p.id === id)).filter(Boolean);
  compareBody.innerHTML = compareHTML(list);
  compareDialog.showModal();
});

compareClear.addEventListener('click', () => {
  compareIds.clear();
  render();
});

compareClose.addEventListener('click', () => compareDialog.close());

const orderBox = document.createElement('dialog');
orderBox.className = 'order-box';
orderBox.innerHTML = `
  <h2 id="ob-title"></h2>
  <p class="sub" id="ob-sub"></p>
  <form id="ob-form">
    <label for="ob-qty">Quantity (kg)</label>
    <input id="ob-qty" type="number" min="1" step="1" value="1" required>
    <p class="total" id="ob-total"></p>
    <p class="msg" id="ob-msg" role="status"></p>
    <div class="actions">
      <button class="btn" type="submit" id="ob-submit">Place order</button>
      <button class="btn ghost" type="button" id="ob-cancel">Cancel</button>
    </div>
  </form>`;
document.body.appendChild(orderBox);

const obTitle = document.getElementById('ob-title');
const obSub = document.getElementById('ob-sub');
const obForm = document.getElementById('ob-form');
const obQty = document.getElementById('ob-qty');
const obTotal = document.getElementById('ob-total');
const obMsg = document.getElementById('ob-msg');
const obSubmit = document.getElementById('ob-submit');

let orderProduct = null;

function showOrderMsg(text, type) {
  obMsg.textContent = text;
  obMsg.className = 'msg ' + type;
}

function updateTotal() {
  const qty = Number(obQty.value);
  obTotal.textContent = qty > 0 ? 'Total: Rs ' + (qty * orderProduct.unit_price).toLocaleString('en-PK') : '';
}

function openOrderBox(p) {
  orderProduct = p;
  const available = availableOf(p);
  obTitle.textContent = (isPreorder(p) ? 'Pre-order ' : 'Order ') + p.name;
  obSub.textContent = available + ' kg available at Rs ' + p.unit_price + ' per kg' + (p.pickup ? '. ' + p.pickup + '.' : '');
  obQty.max = available;
  obQty.value = 1;
  obSubmit.disabled = false;
  showOrderMsg('', '');
  updateTotal();
  orderBox.showModal();
}

board.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  const product = products.find(p => p.id === Number(btn.dataset.id));
  if (product) openOrderBox(product);
});

obQty.addEventListener('input', updateTotal);
document.getElementById('ob-cancel').addEventListener('click', () => orderBox.close());

obForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  obSubmit.disabled = true;
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: orderProduct.id, qty: Number(obQty.value) })
    });
    const data = await res.json();

    if (res.status === 401) {
      showOrderMsg('Please log in as a buyer to place an order.', 'error');
      setTimeout(() => { window.location.href = '/login.html'; }, 1200);
      return;
    }
    if (!res.ok) {
      showOrderMsg(data.error, 'error');
      obSubmit.disabled = false;
      return;
    }

    showOrderMsg('Order placed. Total: Rs ' + data.total, 'ok');
    await loadProducts();
    setTimeout(() => orderBox.close(), 1500);
  } catch (err) {
    showOrderMsg('Could not reach the server. Please try again.', 'error');
    obSubmit.disabled = false;
  }
});

loadProducts();