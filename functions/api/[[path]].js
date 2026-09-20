const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
const fail = (message, status = 400) => json({ ok: false, error: message }, status);
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const random = (size = 32) => b64(crypto.getRandomValues(new Uint8Array(size))).replace(/[+/=]/g, '');
const sha256 = async value => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))));
const hashPassword = async (password, salt = b64(crypto.getRandomValues(new Uint8Array(16)))) => {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return { salt, hash: b64(new Uint8Array(hash)) };
};
const secureEqual = (a, b) => { if (!a || !b || a.length !== b.length) return false; let n = 0; for (let i=0;i<a.length;i++) n |= a.charCodeAt(i)^b.charCodeAt(i); return n === 0; };
const cookie = request => Object.fromEntries((request.headers.get('cookie') || '').split(';').map(x => x.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2));
const body = async request => { try { return await request.json(); } catch { return {}; } };
const clean = (v, max=300) => String(v || '').trim().slice(0,max);
const age = dob => Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
const sessionCookie = (token, days) => `nv_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${days*86400}`;

async function currentUser(request, env) {
  const token = cookie(request).nv_session;
  if (!token) return null;
  const hash = await sha256(token);
  return env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now')`).bind(hash).first();
}
async function requireUser(request, env, roles) {
  const user = await currentUser(request, env);
  if (!user) throw Object.assign(new Error('Please log in.'), { status: 401 });
  if (user.status !== 'active') throw Object.assign(new Error('Account suspended.'), { status: 403 });
  if (roles && !roles.includes(user.role)) throw Object.assign(new Error('Admin access required.'), { status: 403 });
  return user;
}
async function createSession(userId, env) {
  const token = random(36), id = crypto.randomUUID(), days = Math.max(1, Number(env.SESSION_DAYS || 30));
  await env.DB.prepare(`INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,datetime('now',?))`).bind(id,userId,await sha256(token),`+${days} days`).run();
  return { token, days };
}
async function isMatched(db, a, b) { return db.prepare(`SELECT * FROM matches WHERE (user_a=? AND user_b=?) OR (user_a=? AND user_b=?)`).bind(a,b,b,a).first(); }
async function transfer(db, userId, amount, type, refType, refId, idem, metadata='{}') {
  const existing = await db.prepare('SELECT balance_after FROM coin_transactions WHERE idempotency_key=?').bind(idem).first();
  if (existing) return existing.balance_after;
  const wallet = await db.prepare('SELECT balance FROM wallets WHERE user_id=?').bind(userId).first();
  const next = Number(wallet?.balance || 0) + amount;
  if (next < 0) throw Object.assign(new Error('Not enough coins.'), { status: 409 });
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO wallets(user_id,balance) VALUES(?,0)').bind(userId),
    db.prepare('UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').bind(next,userId),
    db.prepare(`INSERT INTO coin_transactions(user_id,amount,type,reference_type,reference_id,idempotency_key,balance_after,metadata) VALUES(?,?,?,?,?,?,?,?)`).bind(userId,amount,type,refType,refId,idem,next,metadata)
  ]);
  return next;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.DB) return fail('D1 binding DB is not configured.', 503);
  const method = request.method, path = '/' + (Array.isArray(params.path) ? params.path.join('/') : params.path || '');
  try {
    if (path === '/health') return json({ ok:true, service:'NearVibe API', database:true, time:new Date().toISOString() });
    if (path === '/payments/webhook' && method === 'POST') {
      if (!env.STRIPE_WEBHOOK_SECRET) return fail('Webhook is not configured.',503);
      const raw=await request.text(), header=request.headers.get('stripe-signature')||'', parts=Object.fromEntries(header.split(',').map(x=>x.split('='))), signed=`${parts.t}.${raw}`;
      const key=await crypto.subtle.importKey('raw',enc.encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const expected=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(signed)))).map(x=>x.toString(16).padStart(2,'0')).join('');
      if(!parts.t||Math.abs(Date.now()/1000-Number(parts.t))>300||!secureEqual(expected,parts.v1))return fail('Invalid Stripe signature.',400);
      const event=JSON.parse(raw); if(event.type==='checkout.session.completed'&&event.data.object.payment_status==='paid'){const session=event.data.object,userId=Number(session.metadata?.user_id),pkg=await env.DB.prepare('SELECT * FROM coin_packages WHERE id=?').bind(session.metadata?.package_id||'').first();if(userId&&pkg)await transfer(env.DB,userId,pkg.coins,'coin_purchase','stripe_checkout',session.id,`stripe:${session.id}`,JSON.stringify({amount_total:session.amount_total}));}
      return json({received:true});
    }
    if (path === '/auth/signup' && method === 'POST') {
      const d = await body(request), email=clean(d.email,254).toLowerCase(), name=clean(d.name,30), dob=clean(d.dob,10);
      if (!/^\S+@\S+\.\S+$/.test(email) || clean(d.password,200).length < 10 || !name || age(dob) < 18) return fail('Valid details, age 18+, and a 10-character password are required.');
      const p = await hashPassword(d.password);
      const result = await env.DB.prepare(`INSERT INTO users(email,password_hash,password_salt,name,dob,gender,looking_for,approximate_area) VALUES(?,?,?,?,?,?,?,?)`).bind(email,p.hash,p.salt,name,dob,clean(d.gender,30),clean(d.lookingFor,30),clean(d.area,80)).run();
      await env.DB.prepare('INSERT INTO wallets(user_id,balance) VALUES(?,0)').bind(result.meta.last_row_id).run();
      await transfer(env.DB,result.meta.last_row_id,50,'welcome_bonus','user',String(result.meta.last_row_id),`welcome:${result.meta.last_row_id}`);
      const s=await createSession(result.meta.last_row_id,env); return json({ok:true,user:{id:result.meta.last_row_id,name,email,role:'user'}},201,{'set-cookie':sessionCookie(s.token,s.days)});
    }
    if (path === '/auth/login' && method === 'POST') {
      const d=await body(request), user=await env.DB.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').bind(clean(d.email,254)).first();
      if (!user) return fail('Email or password is incorrect.',401);
      const p=await hashPassword(clean(d.password,200),user.password_salt); if(!secureEqual(p.hash,user.password_hash)) return fail('Email or password is incorrect.',401);
      if(user.status!=='active') return fail('This account is suspended.',403);
      const s=await createSession(user.id,env); return json({ok:true,user:{id:user.id,name:user.name,email:user.email,role:user.role}},200,{'set-cookie':sessionCookie(s.token,s.days)});
    }
    if (path === '/auth/logout' && method === 'POST') { const token=cookie(request).nv_session; if(token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run(); return json({ok:true},200,{'set-cookie':'nv_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'}); }
    const user = await requireUser(request,env);
    if(path==='/admin/bootstrap'&&method==='POST'){const configured=await env.DB.prepare(`SELECT COUNT(*) AS total FROM users WHERE role='admin'`).first();if(Number(configured?.total||0)>0)return fail('Admin is already configured.',409);const d=await body(request);if(!env.ADMIN_SETUP_TOKEN||!secureEqual(clean(d.token,200),env.ADMIN_SETUP_TOKEN))return fail('Invalid setup token.',403);await env.DB.prepare(`UPDATE users SET role='admin' WHERE id=?`).bind(user.id).run();await env.DB.prepare(`INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES(?,'admin_bootstrap','user',?)`).bind(user.id,String(user.id)).run();return json({ok:true,role:'admin'});}
    if (path === '/me' && method === 'GET') { const w=await env.DB.prepare('SELECT balance FROM wallets WHERE user_id=?').bind(user.id).first(); return json({ok:true,user:{...user,password_hash:undefined,password_salt:undefined,balance:w?.balance||0}}); }
    if (path === '/me' && method === 'PATCH') { const d=await body(request); await env.DB.prepare(`UPDATE users SET name=?,bio=?,gender=?,looking_for=?,approximate_area=?,call_price=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(clean(d.name||user.name,30),clean(d.bio,500),clean(d.gender||user.gender,30),clean(d.lookingFor||user.looking_for,30),clean(d.area,80),Math.max(5,Math.min(500,Number(d.callPrice||user.call_price))),user.id).run(); return json({ok:true}); }
    if (path === '/me/photo' && method === 'POST') { const d=await body(request), photo=String(d.photo||''); if(!/^data:image\/(jpeg|png|webp);base64,/.test(photo)||photo.length>2800000)return fail('Use a JPEG, PNG or WebP under 2 MB.'); await env.DB.prepare('UPDATE users SET photo_data=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(photo,user.id).run(); return json({ok:true}); }
    if (path === '/profiles' && method === 'GET') { await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO users(email,password_hash,password_salt,name,dob,gender,looking_for,bio,approximate_area,is_ai,is_demo,adult_status,call_price) VALUES('chloe-ai@demo.nearvibe','disabled','AAAAAAAAAAAAAAAAAAAAAA==','Chloe AI','2000-04-12','Woman','Everyone','Virtual NearVibe guide who loves music, travel and good conversation.','AI demo — no real location',1,1,'demo',30)`),
      env.DB.prepare(`INSERT OR IGNORE INTO users(email,password_hash,password_salt,name,dob,gender,looking_for,bio,approximate_area,is_ai,is_demo,adult_status,call_price) VALUES('sophie-ai@demo.nearvibe','disabled','AAAAAAAAAAAAAAAAAAAAAA==','Sophie AI','1996-08-22','Woman','Everyone','Virtual profile for safely testing matches, messages, calls and gifts.','AI demo — no real location',1,1,'demo',40)`),
      env.DB.prepare(`INSERT OR IGNORE INTO users(email,password_hash,password_salt,name,dob,gender,looking_for,bio,approximate_area,is_ai,is_demo,adult_status,call_price) VALUES('aisha-ai@demo.nearvibe','disabled','AAAAAAAAAAAAAAAAAAAAAA==','Aisha AI','1998-01-17','Woman','Everyone','Friendly virtual account for exploring NearVibe features.','AI demo — no real location',1,1,'demo',25)`)
    ]); const rows=await env.DB.prepare(`SELECT id,name,CAST((julianday('now')-julianday(dob))/365.2425 AS INTEGER) age,bio,approximate_area,photo_data,is_ai,is_demo,adult_status,call_price FROM users WHERE id<>? AND status='active' AND id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?) AND id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id=?) ORDER BY is_demo DESC,created_at DESC LIMIT 50`).bind(user.id,user.id,user.id).all(); return json({ok:true,profiles:rows.results}); }
    if (/^\/profiles\/\d+\/like$/.test(path) && method==='POST') { const target=Number(path.split('/')[2]); if(target===user.id)return fail('Cannot like yourself.'); const targetUser=await env.DB.prepare(`SELECT id,is_ai,is_demo FROM users WHERE id=? AND status='active'`).bind(target).first();if(!targetUser)return fail('Profile not found.',404);await env.DB.prepare('INSERT OR IGNORE INTO likes(from_user_id,to_user_id) VALUES(?,?)').bind(user.id,target).run();if(targetUser.is_ai&&targetUser.is_demo)await env.DB.prepare('INSERT OR IGNORE INTO likes(from_user_id,to_user_id) VALUES(?,?)').bind(target,user.id).run();const mutual=await env.DB.prepare('SELECT 1 FROM likes WHERE from_user_id=? AND to_user_id=?').bind(target,user.id).first();let match=null;if(mutual){const a=Math.min(user.id,target),b=Math.max(user.id,target);await env.DB.prepare('INSERT OR IGNORE INTO matches(user_a,user_b) VALUES(?,?)').bind(a,b).run();match=await isMatched(env.DB,user.id,target);}return json({ok:true,matched:!!mutual,match}); }
    if (path==='/matches'&&method==='GET') { const rows=await env.DB.prepare(`SELECT m.id,u.id user_id,u.name,u.photo_data,u.is_ai,u.call_price,m.created_at FROM matches m JOIN users u ON u.id=CASE WHEN m.user_a=? THEN m.user_b ELSE m.user_a END WHERE (m.user_a=? OR m.user_b=?) AND u.status='active' ORDER BY m.id DESC`).bind(user.id,user.id,user.id).all(); return json({ok:true,matches:rows.results}); }
    if (/^\/matches\/\d+\/messages$/.test(path)) { const matchId=Number(path.split('/')[2]), match=await env.DB.prepare('SELECT * FROM matches WHERE id=? AND (user_a=? OR user_b=?)').bind(matchId,user.id,user.id).first(); if(!match)return fail('Match not found.',404); if(method==='GET'){const rows=await env.DB.prepare('SELECT id,sender_id,body,kind,gift_id,created_at FROM messages WHERE match_id=? ORDER BY id ASC LIMIT 200').bind(matchId).all();return json({ok:true,messages:rows.results});} if(method==='POST'){const d=await body(request),text=clean(d.body,1000);if(!text)return fail('Message is empty.');const r=await env.DB.prepare('INSERT INTO messages(match_id,sender_id,body) VALUES(?,?,?)').bind(matchId,user.id,text).run();return json({ok:true,id:r.meta.last_row_id},201);} }
    if(path==='/wallet'&&method==='GET'){const [w,l,p,g]=await Promise.all([env.DB.prepare('SELECT balance FROM wallets WHERE user_id=?').bind(user.id).first(),env.DB.prepare('SELECT * FROM coin_transactions WHERE user_id=? ORDER BY id DESC LIMIT 50').bind(user.id).all(),env.DB.prepare('SELECT * FROM coin_packages WHERE active=1').all(),env.DB.prepare('SELECT * FROM gifts WHERE active=1').all()]);return json({ok:true,balance:w?.balance||0,ledger:l.results,packages:p.results,gifts:g.results});}
    if(/^\/matches\/\d+\/gifts$/.test(path)&&method==='POST'){const matchId=Number(path.split('/')[2]),m=await env.DB.prepare('SELECT * FROM matches WHERE id=? AND (user_a=? OR user_b=?)').bind(matchId,user.id,user.id).first();if(!m)return fail('Match not found.',404);const d=await body(request),gift=await env.DB.prepare('SELECT * FROM gifts WHERE id=? AND active=1').bind(clean(d.giftId,30)).first();if(!gift)return fail('Gift not found.',404);const recipient=m.user_a===user.id?m.user_b:m.user_a;const idem=`gift:${user.id}:${crypto.randomUUID()}`;const bal=await transfer(env.DB,user.id,-gift.coin_cost,'gift','match',String(matchId),idem,JSON.stringify({giftId:gift.id,recipient}));await env.DB.prepare(`INSERT INTO messages(match_id,sender_id,body,kind,gift_id) VALUES(?,?,?,?,?)`).bind(matchId,user.id,`${gift.emoji} ${gift.name}`,'gift',gift.id).run();return json({ok:true,balance:bal});}
    if(/^\/matches\/\d+\/call-offers$/.test(path)&&method==='POST'){const matchId=Number(path.split('/')[2]),m=await env.DB.prepare('SELECT * FROM matches WHERE id=? AND (user_a=? OR user_b=?)').bind(matchId,user.id,user.id).first();if(!m)return fail('Match not found.',404);const d=await body(request),rate=Math.max(5,Math.min(500,Number(d.rate)));const recipient=m.user_a===user.id?m.user_b:m.user_a;const r=await env.DB.prepare('INSERT INTO call_offers(match_id,proposer_id,recipient_id,coins_per_minute,parent_offer_id) VALUES(?,?,?,?,?)').bind(matchId,user.id,recipient,rate,d.parentOfferId||null).run();return json({ok:true,id:r.meta.last_row_id,rate},201);}
    if(/^\/call-offers\/\d+\/(accept|decline|counter)$/.test(path)&&method==='POST'){const [, ,id,action]=path.split('/'),offer=await env.DB.prepare(`SELECT * FROM call_offers WHERE id=? AND recipient_id=? AND status='pending'`).bind(Number(id),user.id).first();if(!offer)return fail('Offer not found.',404);if(action==='counter'){const d=await body(request);await env.DB.prepare(`UPDATE call_offers SET status='countered',responded_at=CURRENT_TIMESTAMP WHERE id=?`).bind(offer.id).run();const r=await env.DB.prepare('INSERT INTO call_offers(match_id,proposer_id,recipient_id,coins_per_minute,parent_offer_id) VALUES(?,?,?,?,?)').bind(offer.match_id,user.id,offer.proposer_id,Math.max(5,Math.min(500,Number(d.rate))),offer.id).run();return json({ok:true,id:r.meta.last_row_id});}await env.DB.prepare('UPDATE call_offers SET status=?,responded_at=CURRENT_TIMESTAMP WHERE id=?').bind(action==='accept'?'accepted':'declined',offer.id).run();if(action==='decline')return json({ok:true});const r=await env.DB.prepare('INSERT INTO calls(match_id,payer_id,recipient_id,rate) VALUES(?,?,?,?)').bind(offer.match_id,offer.proposer_id,offer.recipient_id,offer.coins_per_minute).run();return json({ok:true,callId:r.meta.last_row_id});}
    if(/^\/calls\/\d+\/(tick|end)$/.test(path)&&method==='POST'){const [, ,id,action]=path.split('/'),call=await env.DB.prepare(`SELECT * FROM calls WHERE id=? AND (payer_id=? OR recipient_id=?) AND status='active'`).bind(Number(id),user.id,user.id).first();if(!call)return fail('Active call not found.',404);if(action==='end'){await env.DB.prepare(`UPDATE calls SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE id=?`).bind(call.id).run();return json({ok:true});}if(user.id!==call.payer_id)return fail('Only the payer may bill this call.',403);const minute=call.billed_minutes+1,idem=`call:${call.id}:minute:${minute}`,bal=await transfer(env.DB,user.id,-call.rate,'call_minute','call',String(call.id),idem,JSON.stringify({minute}));await env.DB.prepare(`UPDATE calls SET billed_minutes=?,last_billed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(minute,call.id).run();return json({ok:true,balance:bal,billedMinutes:minute});}
    if(/^\/users\/\d+\/(report|block)$/.test(path)&&method==='POST'){const [, ,id,action]=path.split('/'),target=Number(id);if(action==='block'){await env.DB.prepare('INSERT OR IGNORE INTO blocks(blocker_id,blocked_id) VALUES(?,?)').bind(user.id,target).run();return json({ok:true});}const d=await body(request);await env.DB.prepare('INSERT INTO reports(reporter_id,reported_user_id,reason,details) VALUES(?,?,?,?)').bind(user.id,target,clean(d.reason,100),clean(d.details,1000)).run();return json({ok:true},201);}
    if(path==='/verification/request'&&method==='POST'){await env.DB.prepare(`INSERT INTO verification_requests(user_id,status) VALUES(?,'pending')`).bind(user.id).run();return json({ok:true,status:'pending'},201);}
    if(path==='/payments/checkout'&&method==='POST'){if(!env.STRIPE_SECRET_KEY)return fail('Stripe is not configured yet.',503);const d=await body(request),pkg=await env.DB.prepare('SELECT * FROM coin_packages WHERE id=? AND active=1').bind(clean(d.packageId,30)).first();if(!pkg)return fail('Package not found.',404);const form=new URLSearchParams({mode:'payment',success_url:`${env.APP_ORIGIN}/?payment=success`,cancel_url:`${env.APP_ORIGIN}/?payment=cancelled`,'line_items[0][quantity]':'1','metadata[user_id]':String(user.id),'metadata[package_id]':pkg.id});if(pkg.stripe_price_id)form.set('line_items[0][price]',pkg.stripe_price_id);else{form.set('line_items[0][price_data][currency]','gbp');form.set('line_items[0][price_data][unit_amount]',String(pkg.price_pence));form.set('line_items[0][price_data][product_data][name]',`${pkg.coins} NearVibe coins`);}const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded'},body:form});const result=await response.json();if(!response.ok)return fail(result.error?.message||'Stripe checkout failed.',502);return json({ok:true,url:result.url});}
    if(path.startsWith('/admin/')) { await requireUser(request,env,['admin','moderator']); if(path==='/admin/overview'&&method==='GET'){const [users,reports,checks,calls]=await Promise.all([env.DB.prepare('SELECT COUNT(*) n FROM users').first(),env.DB.prepare(`SELECT COUNT(*) n FROM reports WHERE status='open'`).first(),env.DB.prepare(`SELECT COUNT(*) n FROM verification_requests WHERE status='pending'`).first(),env.DB.prepare(`SELECT COUNT(*) n FROM calls WHERE status='active'`).first()]);return json({ok:true,metrics:{users:users.n,openReports:reports.n,pendingVerifications:checks.n,activeCalls:calls.n}});}if(path==='/admin/reports'&&method==='GET'){const r=await env.DB.prepare(`SELECT r.*,a.name reporter,b.name reported FROM reports r JOIN users a ON a.id=r.reporter_id JOIN users b ON b.id=r.reported_user_id ORDER BY r.id DESC`).all();return json({ok:true,reports:r.results});}if(/^\/admin\/users\/\d+\/suspend$/.test(path)&&method==='POST'){const id=Number(path.split('/')[3]);await env.DB.batch([env.DB.prepare(`UPDATE users SET status='suspended' WHERE id=? AND role='user'`).bind(id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),env.DB.prepare(`INSERT INTO audit_log(actor_id,action,target_type,target_id) VALUES(?,'suspend','user',?)`).bind(user.id,String(id))]);return json({ok:true});}}
    return fail('Not found.',404);
  } catch (error) { if(String(error.message).includes('UNIQUE constraint')) return fail('That email is already registered.',409); return fail(error.message || 'Server error.', error.status || 500); }
}
