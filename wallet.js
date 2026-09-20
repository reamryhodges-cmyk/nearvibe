(() => {
  const get = key => JSON.parse(localStorage.getItem(key) || 'null');
  let coins = Number(localStorage.getItem('nv_coins') || 50);
  let callPrice = Number(localStorage.getItem('nv_call_price') || 30);
  let callTimer = null;
  let ledger = get('nv_coin_ledger') || [{ text: 'Welcome bonus', amount: 50 }];

  if (typeof people !== 'undefined') {
    people.push(
      { name: 'Chloe AI', age: 26, away: 'AI demo profile', bio: 'Virtual NearVibe guide who loves music, travel and good conversation.', i: 'C', ai: true },
      { name: 'Sophie AI', age: 30, away: 'AI demo profile', bio: 'Virtual profile for safely testing matches, messages, calls and gifts.', i: 'S', ai: true },
      { name: 'Aisha AI', age: 28, away: 'AI demo profile', bio: 'Friendly virtual account for exploring NearVibe features.', i: 'A', ai: true }
    );
  }

  const save = () => {
    localStorage.setItem('nv_coins', String(coins));
    localStorage.setItem('nv_coin_ledger', JSON.stringify(ledger.slice(-20)));
    const balance = document.querySelector('#coinBalance');
    if (balance) balance.textContent = coins;
  };
  const addEntry = (text, amount) => { ledger.push({ text, amount }); save(); };
  const showToast = text => typeof toast === 'function' ? toast(text) : alert(text);

  const style = document.createElement('style');
  style.textContent = `.coinbar{display:flex;align-items:center;gap:7px}.coinbtn{border:1px solid #ffd45a44;background:#3a2f17;color:#ffd86d;border-radius:99px;padding:8px 11px;font-size:12px;font-weight:900}.packages,.gifts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.package,.gift{border:1px solid #ffffff12;background:var(--soft);color:white;border-radius:14px;padding:13px 7px;text-align:center;font-weight:800}.package small,.gift small{display:block;color:var(--muted);font-size:10px;margin-top:4px}.ledger{font-size:12px;color:var(--muted);border-top:1px solid #ffffff12;padding-top:12px}.cost{color:#ffd86d;font-weight:900}`;
  document.head.appendChild(style);

  const header = document.querySelector('.top');
  const safety = document.querySelector('#safety');
  if (header && safety) {
    const controls = document.createElement('div');
    controls.className = 'coinbar';
    controls.innerHTML = `<button id="wallet" class="coinbtn">🪙 <span id="coinBalance">${coins}</span></button>`;
    header.insertBefore(controls, safety);
    controls.appendChild(safety);
  }

  function wallet() {
    modal(`<p class="eyebrow">DEMO WALLET</p><h2>Get NearVibe coins</h2><p>Coins can be used for call minutes and virtual gifts. No real payment is taken in this demo.</p><div class="packages"><button class="package" data-coins="50">50 🪙<small>Demo £1.99</small></button><button class="package" data-coins="150">150 🪙<small>Demo £4.99</small></button><button class="package" data-coins="400">400 🪙<small>Demo £9.99</small></button></div><label>Your preferred call rate<select id="myCallPrice"><option value="20">20 coins/min</option><option value="30">30 coins/min</option><option value="50">50 coins/min</option><option value="75">75 coins/min</option></select></label><p><strong>Balance: <span class="cost">${coins} coins</span></strong></p><div class="ledger">${ledger.slice(-5).reverse().map(x => `${x.amount > 0 ? '+' : ''}${x.amount} — ${x.text}`).join('<br>')}</div>`);
    document.querySelector('#myCallPrice').value = String(callPrice);
    document.querySelector('#myCallPrice').onchange = event => { callPrice = Number(event.target.value); localStorage.setItem('nv_call_price', String(callPrice)); showToast(`Call rate set to ${callPrice} coins/min`); };
    document.querySelectorAll('.package').forEach(button => button.onclick = () => {
      const amount = Number(button.dataset.coins);
      coins += amount; addEntry('Demo coin package', amount); close(); showToast(`${amount} demo coins added`);
    });
  }

  function giftPicker(name = 'your match') {
    modal(`<p class="eyebrow">SEND A GIFT</p><h2>Choose a gift for ${name}</h2><p>Your balance: <span class="cost">${coins} coins</span></p><div class="gifts"><button class="gift" data-cost="5" data-gift="Rose">🌹<small>5 coins</small></button><button class="gift" data-cost="10" data-gift="Coffee">☕<small>10 coins</small></button><button class="gift" data-cost="25" data-gift="Diamond">💎<small>25 coins</small></button></div><p class="center">Virtual gifts have no cash value and cannot be withdrawn.</p>`);
    document.querySelectorAll('.gift').forEach(button => button.onclick = () => {
      const cost = Number(button.dataset.cost);
      if (coins < cost) { close(); wallet(); return showToast('Not enough coins'); }
      coins -= cost; addEntry(`${button.dataset.gift} gift sent`, -cost); close(); showToast(`${button.dataset.gift} sent to ${name}`);
    });
  }

  document.querySelector('#wallet')?.addEventListener('click', wallet);
  document.addEventListener('click', event => {
    const call = event.target.closest('#call');
    if (!call) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const chatName = document.querySelector('#modalbody h2')?.textContent || 'your match';
    const asking = chatName.includes('AI') ? 30 : callPrice;
    modal(`<p class="eyebrow">NEGOTIATE CALL RATE</p><h2>${chatName}'s asking rate</h2><p>The current rate is <span class="cost">${asking} coins per minute</span>. Accept it or bid a different per-minute rate. Billing starts only after acceptance.</p><label>Your bid per minute<input id="callBid" type="number" min="5" max="500" step="5" value="${asking}"></label><div class="modalactions"><button id="acceptAsk" class="primary">Accept ${asking}/min</button><button id="sendBid" class="secondary">Send bid</button></div>`);
    const settle = rate => {
      if (coins < rate) { close(); wallet(); return showToast(`You need ${rate} coins for the first minute`); }
      if (callTimer) clearInterval(callTimer);
      let elapsed = 0;
      const chargeMinute = () => {
        if (coins < rate) { clearInterval(callTimer); callTimer = null; close(); return showToast('Call ended — not enough coins'); }
        coins -= rate; elapsed += 1; addEntry(`Call minute with ${chatName}`, -rate);
        const minute = document.querySelector('#callMinutes'); if (minute) minute.textContent = elapsed;
        const liveBalance = document.querySelector('#liveBalance'); if (liveBalance) liveBalance.textContent = coins;
      };
      modal(`<p class="eyebrow">DEMO CALL ACTIVE</p><h2>Call with ${chatName}</h2><p>Agreed rate: <span class="cost">${rate} coins/min</span></p><div class="card center"><h1><span id="callMinutes">0</span> min</h1><p>Balance: <span id="liveBalance">${coins}</span> coins</p></div><button id="endCoinCall" class="danger wide">End call</button><p class="center">This is a billing demonstration; live video is not connected.</p>`);
      chargeMinute();
      callTimer = setInterval(chargeMinute, 60000);
      document.querySelector('#endCoinCall').onclick = () => { clearInterval(callTimer); callTimer = null; close(); showToast(`Call ended after ${elapsed} minute${elapsed === 1 ? '' : 's'}`); };
    };
    document.querySelector('#acceptAsk').onclick = () => settle(asking);
    document.querySelector('#sendBid').onclick = () => {
      const bid = Math.max(5, Math.min(500, Number(document.querySelector('#callBid').value) || 5));
      modal(`<p class="eyebrow">BID SENT</p><h2>${chatName} can respond</h2><p>Your bid is <span class="cost">${bid} coins per minute</span>.</p><div class="modalactions"><button id="acceptBid" class="primary">Accept bid</button><button id="counterBid" class="secondary">Counter-offer</button></div><button id="declineBid" class="danger wide" style="margin-top:8px">Decline</button>`);
      document.querySelector('#acceptBid').onclick = () => settle(bid);
      document.querySelector('#counterBid').onclick = () => {
        const counter = Math.max(bid + 5, asking);
        modal(`<p class="eyebrow">COUNTER-OFFER</p><h2>${chatName} proposes ${counter} coins/min</h2><p>You can accept the per-minute counter-offer or return to chat.</p><button id="acceptCounter" class="primary wide">Accept ${counter}/min</button>`);
        document.querySelector('#acceptCounter').onclick = () => settle(counter);
      };
      document.querySelector('#declineBid').onclick = () => { close(); showToast('Call bid declined'); };
    };
  }, true);

  const observer = new MutationObserver(() => {
    const body = document.querySelector('#modalbody');
    if (!body || !body.textContent.includes('PRIVATE MESSAGE') || body.querySelector('#sendGift')) return;
    const actions = body.querySelector('.modalactions');
    if (!actions) return;
    const button = document.createElement('button'); button.id = 'sendGift'; button.className = 'secondary'; button.textContent = '🎁 Send gift';
    button.onclick = () => giftPicker(body.querySelector('h2')?.textContent || 'your match'); actions.prepend(button);
  });
  observer.observe(document.querySelector('#modalbody'), { childList: true, subtree: true });

  const deckObserver = new MutationObserver(() => {
    const info = document.querySelector('#deck .info');
    if (!info || !info.querySelector('h3')?.textContent.includes(' AI,')) return;
    const badge = info.querySelector('.badge');
    if (badge) badge.textContent = '✦ Clearly labelled AI demo';
  });
  deckObserver.observe(document.querySelector('#deck'), { childList: true, subtree: true });

  const paidCard = [...document.querySelectorAll('.card h3')].find(x => x.textContent.includes('Paid-call'))?.parentElement;
  if (paidCard) paidCard.querySelector('p:last-child').textContent = 'Demo coin calls and gifts are enabled. Real payments and cash withdrawals remain disabled.';
  save();
})();
