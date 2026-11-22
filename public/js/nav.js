(async function () {
  const nav = document.querySelector('.top nav');
  if (!nav) return;

  let user = null;
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) user = await res.json();
  } catch (err) {
    user = null;
  }

  const links = [['/', 'Marketplace']];
  if (!user) {
    links.push(['/sell.html', 'Sell produce']);
  } else if (user.role === 'buyer') {
    links.push(['/my-orders.html', 'My orders']);
  } else if (user.role === 'admin') {
    links.push(['/admin.html', 'Admin']);
  } else {
    links.push(['/sell.html', 'Orders'], ['/inventory.html', 'My products'], ['/pos.html', 'Counter sale']);
  }

  const path = location.pathname === '/index.html' ? '/' : location.pathname;
  nav.innerHTML = links
    .map(([href, label]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('');

  const last = document.createElement('a');
  last.className = 'login';
  if (user) {
    last.href = '#';
    last.textContent = 'Log out (' + user.name.split(' ')[0] + ')';
    last.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    });
  } else {
    last.href = '/login.html';
    last.textContent = 'Log in';
  }
  nav.appendChild(last);
})();