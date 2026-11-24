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
const cartStrip = document.getElementById('cart-strip');

const CART_KEY = 'gleangrid-cart';

let products = [];
let activeCat = 'all';
const compareIds = new Set();
const cart = new Map();

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML.replace(/"/g, '&quot;');
}

function money(n) {
  return 'Rs ' + Number(n).toLocaleString('en-PK');
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

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    saved.forEach(([id, qty]) => {
      if (Number.isInteger(id) && Number.isInteger(qty) && qty > 0) cart.set(id, qty);
    });
  } catch (err) {
    cart.clear();
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify([...cart.entries()]));
  } catch (err) {
    return;
  }
}

function syncCart() {
  for (const [id, qty] of [...cart.entries()]) {
    const p = products.find(x => x.id === id);
    const max = p ? availableOf(p) : 0;
    if (max <= 0) cart.delete(id);
    else if (qty > max) cart.set(id, max);
  }
  saveCart();
}

function cartTotal() {
  let total = 0;
  for (const [id, qty] of cart) {
    const p = products.find(x => x.id === id);
    if (p) total += qty * p.unit_price;
  }
  return total;
}

function renderCartStrip() {
  const count = cart.size;
  cartStrip.classList.toggle('show', count > 0);
  cartStrip.innerHTML = count
    ? `<span><strong>Cart:</strong> ${count} ${count === 1 ? 'product' : 'products'}, ${money(cartTotal())}</span>
       <button class="btn" id="cart-open" type="button">View cart</button>`
    : '';
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
  else button = `<button class="btn" data-id="${p.id}">Add to cart</button>`;

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
    syncCart();
    fillChips();
    fillSellers();
    render();
    renderCartStrip();
    if (cartBox.open) renderCartBox();
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

loadCart();

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
      <button class="btn" type="submit" id="ob-submit">Add to cart</button>
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
  obTotal.textContent = qty > 0 ? 'Total: ' + money(qty * orderProduct.unit_price) : '';
}

function openOrderBox(p) {
  orderProduct = p;
  const available = availableOf(p);
  const inCart = cart.get(p.id) || 0;
  obTitle.textContent = (isPreorder(p) ? 'Pre-order ' : 'Add to cart: ') + p.name;
  obSub.textContent = available + ' kg available at Rs ' + p.unit_price + ' per kg' +
    (inCart ? ', ' + inCart + ' kg already in your cart' : '') +
    (p.pickup ? '. ' + p.pickup + '.' : '');
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

obForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const qty = Number(obQty.value);
  const available = availableOf(orderProduct);
  const current = cart.get(orderProduct.id) || 0;
  if (!Number.isInteger(qty) || qty <= 0) {
    showOrderMsg('Enter a whole number of kg.', 'error');
    return;
  }
  if (current + qty > available) {
    showOrderMsg('Only ' + available + ' kg is available, and ' + current + ' kg is already in your cart.', 'error');
    return;
  }
  cart.set(orderProduct.id, current + qty);
  saveCart();
  renderCartStrip();
  obSubmit.disabled = true;
  showOrderMsg('Added to your cart.', 'ok');
  setTimeout(() => orderBox.close(), 700);
});

const cartBox = document.createElement('dialog');
cartBox.className = 'cart-box';
cartBox.innerHTML = `
  <h2>Your cart</h2>
  <div id="cb-lines"></div>
  <p class="ctotal" id="cb-total"></p>
  <fieldset>
    <legend>How will you receive it?</legend>
    <label><input type="radio" name="fulfil" value="pickup" checked> Pickup</label>
    <label><input type="radio" name="fulfil" value="delivery"> Delivery</label>
  </fieldset>
  <p class="cmsg" id="cb-msg" role="status"></p>
  <div class="cactions">
    <button class="btn" type="button" id="cb-place">Place order</button>
    <button class="btn ghost" type="button" id="cb-close">Keep shopping</button>
  </div>`;
document.body.appendChild(cartBox);

const cbLines = document.getElementById('cb-lines');
const cbTotal = document.getElementById('cb-total');
const cbMsg = document.getElementById('cb-msg');
const cbPlace = document.getElementById('cb-place');

function showCartMsg(text, type) {
  cbMsg.textContent = text;
  cbMsg.className = 'cmsg ' + type;
}

function renderCartBox() {
  let html = '';
  for (const [id, qty] of cart) {
    const p = products.find(x => x.id === id);
    if (!p) continue;
    html += `
      <div class="cline">
        <div>
          <div class="cname">${esc(p.name)}</div>
          <div class="cmeta">${esc(p.seller)}, ${esc(p.pickup || 'Pickup or delivery')}</div>
        </div>
        <div class="csum">${money(qty * p.unit_price)}</div>
        <div class="cstep">
          <button type="button" data-act="dec" data-id="${id}" aria-label="One less ${esc(p.name)}">-</button>
          <span>${qty} kg</span>
          <button type="button" data-act="inc" data-id="${id}" aria-label="One more ${esc(p.name)}">+</button>
          <button type="button" class="crm" data-act="rm" data-id="${id}">Remove</button>
        </div>
      </div>`;
  }
  cbLines.innerHTML = html || '<p class="empty">Your cart is empty.</p>';
  cbTotal.textContent = cart.size ? 'Total: ' + money(cartTotal()) : '';
  cbPlace.disabled = cart.size === 0;
}

function openCart() {
  showCartMsg('', '');
  renderCartBox();
  cartBox.showModal();
}

cartStrip.addEventListener('click', (e) => {
  if (e.target.closest('#cart-open')) openCart();
});

cbLines.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const current = cart.get(id) || 0;
  const p = products.find(x => x.id === id);
  if (btn.dataset.act === 'inc' && p && current < availableOf(p)) cart.set(id, current + 1);
  if (btn.dataset.act === 'dec') {
    if (current <= 1) cart.delete(id);
    else cart.set(id, current - 1);
  }
  if (btn.dataset.act === 'rm') cart.delete(id);
  saveCart();
  renderCartBox();
  renderCartStrip();
  showCartMsg('', '');
});

document.getElementById('cb-close').addEventListener('click', () => cartBox.close());

cbPlace.addEventListener('click', async () => {
  cbPlace.disabled = true;
  const fulfilment = cartBox.querySelector('input[name="fulfil"]:checked').value;
  const items = [...cart.entries()].map(([product_id, qty]) => ({ product_id, qty }));
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, fulfilment })
    });
    const data = await res.json();

    if (res.status === 401) {
      showCartMsg('Please log in as a buyer to place an order.', 'error');
      setTimeout(() => { window.location.href = '/login.html'; }, 1200);
      return;
    }
    if (!res.ok) {
      showCartMsg(data.error, 'error');
      await loadProducts();
      renderCartBox();
      return;
    }

    cart.clear();
    saveCart();
    showCartMsg(data.message, 'ok');
    renderCartBox();
    renderCartStrip();
    await loadProducts();
    setTimeout(() => cartBox.close(), 2000);
  } catch (err) {
    showCartMsg('Could not reach the server. Please try again.', 'error');
    cbPlace.disabled = false;
  }
});

loadProducts();