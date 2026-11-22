const board = document.getElementById('board');
const searchBox = document.getElementById('search');
const chips = document.querySelectorAll('.chip');

let products = [];
let activeCat = 'all';

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function rowHTML(p) {
  const available = p.on_hand - p.reserved;
  const freePct = p.on_hand ? (available / p.on_hand) * 100 : 0;
  const heldPct = p.on_hand ? (p.reserved / p.on_hand) * 100 : 0;
  const isPreorder = p.ready_on && new Date(p.ready_on) > new Date();

  let note, low = false;
  if (isPreorder) {
    const date = new Date(p.ready_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    note = `Ready ${date}, ${available} kg open for pre-order`;
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
  else if (isPreorder) button = `<button class="btn pre" data-id="${p.id}">Pre-order</button>`;
  else button = `<button class="btn" data-id="${p.id}">Order</button>`;

  return `
    <article class="row">
      <div>
        <div class="name">${esc(p.name)}</div>
        <div class="where">${esc(p.seller)}, ${esc(p.place)}</div>
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

function render() {
  const q = searchBox.value.trim().toLowerCase();
  const list = products.filter(p =>
    (activeCat === 'all' || p.category === activeCat) &&
    (p.name.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q))
  );
  board.innerHTML = list.length
    ? list.map(rowHTML).join('')
    : '<p class="empty">Nothing matches. Clear the search or pick another category.</p>';
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Server returned ' + res.status);
    products = await res.json();
    render();
  } catch (err) {
    board.innerHTML = '<p class="empty">Could not load produce. Check that the server is running, then refresh.</p>';
  }
}

searchBox.addEventListener('input', render);
chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCat = chip.dataset.cat;
    render();
  });
});

loadProducts();
// Header mein login ki halat dikhao
async function showUser() {
  const loginLink = document.querySelector('.top nav .login');
  if (!loginLink) return;

  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return; // login nahi hai, "Log in" wesa hi rahe

    const user = await res.json();
    loginLink.textContent = 'Log out (' + user.name.split(' ')[0] + ')';
    loginLink.href = '#';
    loginLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    });
  } catch (err) {
    // server band ho to header jaisa hai waisa rahe
  }
}

showUser();
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
  const available = p.on_hand - p.reserved;
  const isPreorder = p.ready_on && new Date(p.ready_on) > new Date();
  obTitle.textContent = (isPreorder ? 'Pre-order ' : 'Order ') + p.name;
  obSub.textContent = available + ' kg available at Rs ' + p.unit_price + ' per kg';
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