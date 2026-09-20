(() => {
  const ADMIN_EMAIL = 'sam.admin@nearvibe.app';
  const $ = selector => document.querySelector(selector);
  const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const isAdmin = () => load('nv_user', {}).role === 'admin';
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  const style = document.createElement('style');
  style.textContent = `
    .admin-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px}
    .metric{background:var(--soft);border-radius:15px;padding:14px}.metric strong{display:block;font-size:25px}
    .admin-tag{display:inline-block;border-radius:99px;padding:5px 8px;background:#7c5cff22;color:#bbaeff;font-size:10px;font-weight:900}
    .admin-actions{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 14px}.admin-actions button{flex:1}
    .admin-note{border:1px solid #ffcc6640;background:#4b361c55;color:#ffd485;border-radius:14px;padding:12px;font-size:12px;margin-bottom:14px}
    nav.admin-nav{grid-template-columns:repeat(5,1fr)}
  `;
  document.head.appendChild(style);

  function seedReports() {
    if (!localStorage.getItem('nv_reports')) save('nv_reports', [
      { id: 1, account: 'Demo profile', reason: 'Fake profile', status: 'Open', created: 'Demo item' }
    ]);
  }
  function defaultVerifications() {
    return [
      { id: 1, name: 'Maya', age: 29, status: 'Pending' },
      { id: 2, name: 'Jordan', age: 27, status: 'Pending' }
    ];
  }
  function renderAdmin() {
    const screen = $('#admin');
    if (!screen) return;
    const reports = load('nv_reports', []);
    const suspended = load('nv_suspended', []);
    const verifications = load('nv_verifications', defaultVerifications());
    screen.innerHTML = `
      <div class="title"><div><p class="eyebrow">OWNER CONTROLS</p><h2>Admin</h2></div><span class="admin-tag">DEMO ADMIN</span></div>
      <div class="admin-note">This dashboard stores demo decisions only on this device. Secure server-side roles and audit logs are required before launch.</div>
      <div class="admin-grid">
        <div class="metric"><strong>${reports.filter(item => item.status === 'Open').length}</strong><span>Open reports</span></div>
        <div class="metric"><strong>${verifications.filter(item => item.status === 'Pending').length}</strong><span>Checks waiting</span></div>
        <div class="metric"><strong>${suspended.length}</strong><span>Suspended</span></div>
        <div class="metric"><strong>${typeof people === 'undefined' ? 0 : people.length}</strong><span>Demo profiles</span></div>
      </div>
      <div class="card"><h3>Moderation queue</h3>${reports.length ? reports.map(report => `
        <div class="row"><span><strong>${escapeHtml(report.account)}</strong><br><small>${escapeHtml(report.reason)} · ${escapeHtml(report.status)}</small></span></div>
        ${report.status === 'Open' ? `<div class="admin-actions"><button class="secondary resolve-report" data-id="${report.id}">Resolve</button><button class="danger suspend-account" data-name="${escapeHtml(report.account)}">Suspend</button></div>` : ''}
      `).join('') : '<p>No reports.</p>'}</div>
      <div class="card"><h3>Adult verification review</h3>${verifications.map(item => `
        <div class="row"><span><strong>${escapeHtml(item.name)}, ${item.age}</strong><br><small>${escapeHtml(item.status)}</small></span>${item.status === 'Pending' ? `<button class="mini approve-check" data-id="${item.id}">Approve demo</button>` : ''}</div>
      `).join('')}</div>
      <div class="card"><h3>Admin safeguards prepared</h3><ul><li>Role-based admin area</li><li>Report review and resolution</li><li>Account suspension state</li><li>Adult verification decisions</li><li>Demo audit timestamps</li></ul></div>`;
    screen.querySelectorAll('.resolve-report').forEach(button => button.onclick = () => {
      const items = load('nv_reports', []);
      const item = items.find(report => report.id === Number(button.dataset.id));
      if (item) { item.status = 'Resolved'; item.reviewedAt = new Date().toISOString(); save('nv_reports', items); }
      renderAdmin(); toast('Report marked resolved');
    });
    screen.querySelectorAll('.suspend-account').forEach(button => button.onclick = () => {
      const items = load('nv_suspended', []);
      if (!items.includes(button.dataset.name)) items.push(button.dataset.name);
      save('nv_suspended', items); renderAdmin(); toast('Demo account suspended');
    });
    screen.querySelectorAll('.approve-check').forEach(button => button.onclick = () => {
      const items = load('nv_verifications', defaultVerifications());
      const item = items.find(check => check.id === Number(button.dataset.id));
      if (item) { item.status = 'Demo approved'; item.reviewedAt = new Date().toISOString(); save('nv_verifications', items); }
      renderAdmin(); toast('Verification demo approved');
    });
  }
  function enableAdmin() {
    if (!isAdmin() || $('#admin')) return;
    seedReports();
    const screen = document.createElement('section');
    screen.id = 'admin'; screen.className = 'screen';
    $('#profile').after(screen);
    const button = document.createElement('button');
    button.dataset.screen = 'admin'; button.innerHTML = '<span>⚙</span>Admin';
    $('nav').appendChild(button); $('nav').classList.add('admin-nav');
    button.onclick = () => {
      document.querySelectorAll('nav button').forEach(item => item.classList.remove('on'));
      button.classList.add('on');
      document.querySelectorAll('.screen').forEach(item => item.classList.remove('on'));
      screen.classList.add('on'); renderAdmin();
    };
    renderAdmin();
  }
  const login = $('#login');
  login?.addEventListener('submit', event => {
    const email = login.querySelector('input[type="email"]')?.value.trim().toLowerCase();
    if (email !== ADMIN_EMAIL) return;
    event.preventDefault(); event.stopImmediatePropagation();
    localStorage.setItem('nv_user', JSON.stringify({ name: 'Sam', email: ADMIN_EMAIL, role: 'admin' }));
    $('#auth').classList.add('hide'); $('#main').classList.remove('hide');
    $('#pname').textContent = 'Sam'; $('#avatar').textContent = 'S';
    draw(); lists(); enableAdmin(); toast('Admin demo opened');
  }, true);
  const observer = new MutationObserver(() => {
    const body = $('#modalbody');
    const submit = body?.querySelector('#submitreport');
    if (!submit || submit.dataset.adminReady) return;
    submit.dataset.adminReady = '1';
    submit.onclick = () => {
      const reason = body.querySelector('select')?.value || 'Other safety concern';
      const reports = load('nv_reports', []);
      reports.push({ id: Date.now(), account: 'Reported account', reason, status: 'Open', created: new Date().toISOString() });
      save('nv_reports', reports); close(); toast('Report sent for admin review'); renderAdmin();
    };
  });
  observer.observe($('#modalbody'), { childList: true, subtree: true });
  if (isAdmin()) setTimeout(enableAdmin);
  const authNote = $('#login .center');
  if (authNote) authNote.innerHTML = `MVP demo: use any email and password.<br>Admin demo: <strong>${ADMIN_EMAIL}</strong>`;
})();
