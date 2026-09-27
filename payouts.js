(() => {
  const $ = selector => document.querySelector(selector);
  const money = pence => `£${(Number(pence || 0) / 100).toFixed(2)}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const result = await response.json().catch(() => ({ error: 'Unexpected server response.' }));
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  function toast(message) {
    const element = $('#toast');
    if (!element) return alert(message);
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 2800);
  }

  function modal(html) {
    const overlay = $('#modal');
    const body = $('#modalbody');
    if (!overlay || !body) return;
    body.innerHTML = html;
    overlay.classList.remove('hide');
  }

  function closeModal() {
    $('#modal')?.classList.add('hide');
  }

  function payoutStatus(status) {
    if (!status.verified) return 'NearVibe verification required';
    if (!status.account) return 'Payout account not connected';
    if (!status.account.onboardingComplete) return 'Stripe setup needs finishing';
    if (!status.account.payoutsEnabled) return 'Stripe is reviewing your account';
    return 'Ready for withdrawals';
  }

  async function openWallet() {
    modal('<h2>NearVibe wallet</h2><p>Loading your secure wallet…</p>');
    try {
      const [wallet, connect, earnings] = await Promise.all([
        api('/wallet'), api('/connect/status'), api('/earnings')
      ]);
      const payoutRows = (earnings.payouts || []).slice(0, 5).map(item =>
        `<div class="payoutRow"><span>${money(item.amount_pence)}</span><span>${escapeHtml(item.status)}</span></div>`
      ).join('');
      const earningRows = (earnings.transactions || []).slice(0, 5).map(item =>
        `<div class="payoutRow"><span>${escapeHtml(item.type.replaceAll('_', ' '))}</span><span>+${money(item.amount_pence)}</span></div>`
      ).join('');

      modal(`
        <p class="eyebrow">SECURE WALLET</p>
        <h2>Coins and creator earnings</h2>
        <div class="earningsGrid">
          <div><small>COINS</small><strong>${Number(wallet.balance || 0)}</strong></div>
          <div><small>AVAILABLE</small><strong>${money(earnings.availablePence)}</strong></div>
          <div><small>PENDING</small><strong>${money(earnings.pendingPence)}</strong></div>
          <div><small>LIFETIME</small><strong>${money(earnings.lifetimePence)}</strong></div>
        </div>
        <div class="card payoutCard">
          <h3>Buy NearVibe coins</h3>
          <div class="stack">${wallet.packages.map(packageItem =>
            `<button class="secondary payoutBuy" data-id="${escapeHtml(packageItem.id)}">${Number(packageItem.coins)} coins · ${money(packageItem.price_pence)}</button>`
          ).join('')}</div>
          <p>Payments open securely in Stripe Checkout.</p>
        </div>
        <div class="card payoutCard">
          <h3>Creator payouts</h3>
          <p><strong>${escapeHtml(payoutStatus(connect))}</strong></p>
          ${!connect.verified ? '<button id="payoutVerify" class="secondary wide">Request NearVibe verification</button>' : ''}
          ${connect.verified && !connect.canWithdraw ? '<button id="payoutConnect" class="primary wide">Set up or finish Stripe payouts</button>' : ''}
          ${connect.canWithdraw ? `<label>Withdrawal amount (£)<input id="payoutAmount" type="number" min="10" step="0.01" value="${(Number(earnings.availablePence || 0) / 100).toFixed(2)}"></label><button id="payoutWithdraw" class="primary wide">Withdraw earnings</button>` : ''}
          <p>Minimum withdrawal: ${money(connect.minimumWithdrawalPence)}. Creators receive 70%; NearVibe keeps 30%.</p>
        </div>
        ${earningRows ? `<div class="card payoutCard"><h3>Recent earnings</h3>${earningRows}</div>` : ''}
        ${payoutRows ? `<div class="card payoutCard"><h3>Recent payouts</h3>${payoutRows}</div>` : ''}
      `);

      document.querySelectorAll('.payoutBuy').forEach(button => {
        button.onclick = async () => {
          button.disabled = true;
          try {
            const result = await api('/payments/checkout', {
              method: 'POST', body: JSON.stringify({ packageId: button.dataset.id })
            });
            location.href = result.url;
          } catch (error) {
            toast(error.message);
            button.disabled = false;
          }
        };
      });

      $('#payoutVerify')?.addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        try {
          const result = await api('/verification/request', { method: 'POST', body: '{}' });
          toast(result.status === 'approved' ? 'Already verified' : 'Verification request sent');
          closeModal();
        } catch (error) {
          toast(error.message);
          event.currentTarget.disabled = false;
        }
      });

      $('#payoutConnect')?.addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        try {
          const result = await api('/connect/onboard', { method: 'POST', body: '{}' });
          location.href = result.url;
        } catch (error) {
          toast(error.message);
          event.currentTarget.disabled = false;
        }
      });

      $('#payoutWithdraw')?.addEventListener('click', async event => {
        const amountPence = Math.round(Number($('#payoutAmount')?.value || 0) * 100);
        if (amountPence < Number(connect.minimumWithdrawalPence || 1000)) {
          return toast(`Minimum withdrawal is ${money(connect.minimumWithdrawalPence || 1000)}`);
        }
        if (amountPence > Number(earnings.availablePence || 0)) {
          return toast('That is more than your available earnings');
        }
        if (!confirm(`Withdraw ${money(amountPence)} to your connected Stripe account?`)) return;
        event.currentTarget.disabled = true;
        try {
          const result = await api('/withdrawals', {
            method: 'POST', body: JSON.stringify({ amountPence })
          });
          toast(`${money(result.amountPence)} payout sent`);
          await openWallet();
        } catch (error) {
          toast(error.message);
          event.currentTarget.disabled = false;
        }
      });
    } catch (error) {
      modal(`<h2>Wallet unavailable</h2><p>${escapeHtml(error.message)}</p><button id="retryPayoutWallet" class="primary wide">Try again</button>`);
      $('#retryPayoutWallet').onclick = openWallet;
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .earningsGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:15px 0}
    .earningsGrid div{padding:14px;border:1px solid #ffffff12;border-radius:16px;background:#100d18}
    .earningsGrid small{display:block;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.08em}
    .earningsGrid strong{display:block;margin-top:4px;font-size:22px;color:#ffd86d}
    .payoutCard{margin-top:12px}.payoutCard label{margin:12px 0}
    .payoutRow{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff0d;text-transform:capitalize}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', event => {
    if (!event.target.closest('#wallet')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openWallet();
  }, true);

  const query = new URLSearchParams(location.search);
  if (query.has('connect')) {
    history.replaceState({}, '', '/app');
    setTimeout(() => {
      toast(query.get('connect') === 'complete' ? 'Stripe payout setup updated' : 'Continue your Stripe payout setup');
      openWallet();
    }, 600);
  }
})();
