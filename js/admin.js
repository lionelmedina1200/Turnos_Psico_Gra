// ===== ADMIN JS =====

let adminUser = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let allTurnos = [];
let filtroEstado = 'pendiente_pago';
let selectedPatientId = null;

const HORAS_TODAS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user.email === ADMIN_EMAIL) {
    adminUser = session.user;
    showAdminPanel();
  }
});

async function doAdminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPass').value;
  const errEl = document.getElementById('adminError');
  errEl.style.display = 'none';

  if (email !== ADMIN_EMAIL) {
    errEl.textContent = 'Este acceso es solo para la psicóloga.';
    errEl.style.display = 'block'; return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) { errEl.textContent = 'Contraseña incorrecta.'; errEl.style.display = 'block'; return; }
  adminUser = data.user;
  showAdminPanel();
}

function showAdminPanel() {
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadAllTurnos();
  loadConfig();
  loadPatientsMessages();
  buildHorariosConfig();
  subscribeRealtime();
}

function doAdminLogout() {
  supabase.auth.signOut();
  window.location.href = 'index.html';
}

// ===== NAVEGACIÓN =====
function showAdminSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  document.getElementById('sb-' + id).classList.add('active');
  if (id === 'calendario') renderCalendar();
}

// ===== CARGAR TURNOS =====
async function loadAllTurnos() {
  const { data } = await supabase.from('turnos').select('*').order('fecha').order('hora');
  allTurnos = data || [];
  renderSolicitudes();
  updateBadges();
  renderCalendar();
}

// ===== SOLICITUDES =====
function filterSolicitudes(estado, btn) {
  filtroEstado = estado;
  document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderSolicitudes();
}

function renderSolicitudes() {
  const lista = filtroEstado === 'todos'
    ? allTurnos
    : allTurnos.filter(t => t.estado === filtroEstado);

  const el = document.getElementById('solicitudesList');
  if (!lista.length) {
    el.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text3)">No hay turnos en esta categoría.</div>`;
    return;
  }
  el.innerHTML = lista.map(t => adminTurnoCard(t)).join('');
}

function adminTurnoCard(t) {
  const labels = { pendiente_pago:'Esperando pago', pago_enviado:'Comprobante enviado', confirmado:'Confirmado', cancelado:'Cancelado' };
  const avatarText = (t.paciente_nombre||'P').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
  return `<div class="turno-card">
    <div class="turno-avatar">${avatarText}</div>
    <div class="turno-body">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div class="turno-nombre">${t.paciente_nombre || '—'}</div>
        <span class="badge badge-${t.estado}">${labels[t.estado]||t.estado}</span>
      </div>
      <div class="turno-meta">
        <span>📅 ${formatFecha(t.fecha)}</span>
        <span>🕐 ${t.hora}</span>
        ${t.paciente_tel ? `<span>📱 ${t.paciente_tel}</span>` : ''}
      </div>
      ${t.motivo ? `<div class="turno-motivo">"${t.motivo}"</div>` : ''}
      <div class="turno-actions">
        ${t.comprobante_url ? `<button class="btn-sm btn-ver" onclick="verComprobante('${t.id}')">Ver comprobante</button>` : ''}
        ${(t.estado === 'pago_enviado' || t.estado === 'pendiente_pago') ? `<button class="btn-sm btn-confirm" onclick="confirmarTurno('${t.id}')">✓ Confirmar</button>` : ''}
        ${t.estado !== 'cancelado' ? `<button class="btn-sm btn-reject" onclick="cancelarTurno('${t.id}')">✕ Cancelar</button>` : ''}
        ${t.estado === 'confirmado' ? `<button class="btn-sm btn-wsp" onclick="prepWsp('${t.id}')">WhatsApp</button>` : ''}
      </div>
    </div>
  </div>`;
}

// ===== ACCIONES TURNO =====
async function confirmarTurno(id) {
  await supabase.from('turnos').update({ estado: 'confirmado' }).eq('id', id);
  await loadAllTurnos();
  prepWsp(id);
}

async function cancelarTurno(id) {
  if (!confirm('¿Cancelar este turno?')) return;
  await supabase.from('turnos').update({ estado: 'cancelado' }).eq('id', id);
  loadAllTurnos();
}

// ===== VER COMPROBANTE =====
function verComprobante(id) {
  const t = allTurnos.find(x => x.id == id);
  if (!t) return;
  const content = `
    <h3 style="font-family:'DM Serif Display',serif;font-weight:400;margin-bottom:8px">Comprobante de pago</h3>
    <p style="font-size:.85rem;color:var(--text2)">${t.paciente_nombre} — ${formatFecha(t.fecha)} ${t.hora}</p>
    ${t.comprobante_url
      ? `<img src="${t.comprobante_url}" class="modal-img" alt="Comprobante">`
      : `<p style="margin-top:12px;color:var(--text3)">No se adjuntó imagen.</p>`
    }
    <div class="modal-actions">
      ${(t.estado === 'pago_enviado') ? `<button class="btn-main" style="flex:1" onclick="confirmarTurno('${t.id}');closeModal()">✓ Confirmar turno</button>` : ''}
      <button class="btn-sm btn-reject" onclick="cancelarTurno('${t.id}');closeModal()">✕ Cancelar</button>
    </div>
  `;
  openModal(content);
}

// ===== WHATSAPP =====
async function prepWsp(id) {
  const t = allTurnos.find(x => x.id == id);
  if (!t) return;

  const { data: cfg } = await supabase.from('config').select('wsp_psicologa').single();
  const telPsi = cfg?.wsp_psicologa || '';

  const msgPaciente = `Hola ${(t.paciente_nombre||'').split(' ')[0]} 👋\n\nTu turno de psicología está *confirmado* ✅\n📅 Fecha: ${formatFecha(t.fecha)}\n🕐 Hora: ${t.hora}\n\nCualquier cambio, avisame con anticipación. ¡Te espero! 😊`;
  const msgPsi = `📋 Nuevo turno confirmado\n👤 Paciente: ${t.paciente_nombre}\n📅 Fecha: ${formatFecha(t.fecha)}\n🕐 Hora: ${t.hora}\n📱 Tel: ${t.paciente_tel||'—'}`;

  const content = `
    <h3 style="font-family:'DM Serif Display',serif;font-weight:400;margin-bottom:8px">Avisos por WhatsApp</h3>
    <p style="font-size:.85rem;color:var(--text2);margin-bottom:12px">Se abrirán dos chats: uno al paciente y otro a vos.</p>
    <p style="font-size:.78rem;color:var(--text3);margin-bottom:4px">Mensaje al paciente:</p>
    <div class="wsp-preview">${escapeHtml(msgPaciente)}</div>
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn-sm btn-wsp" style="flex:1" onclick="abrirWspPaciente('${encodeURIComponent(msgPaciente)}','${t.paciente_tel}')">
        📲 Enviar al paciente
      </button>
      ${telPsi ? `<button class="btn-sm btn-wsp" style="flex:1" onclick="abrirWspPsi('${encodeURIComponent(msgPsi)}','${telPsi}')">
        📲 Enviarme aviso
      </button>` : ''}
      <button class="btn-sm" onclick="closeModal()">Cerrar</button>
    </div>
  `;
  openModal(content);
}

function abrirWspPaciente(msgEnc, tel) {
  const telLimpio = String(tel).replace(/\D/g,'');
  window.open(`https://wa.me/${telLimpio}?text=${msgEnc}`, '_blank');
}
function abrirWspPsi(msgEnc, tel) {
  const telLimpio = String(tel).replace(/\D/g,'');
  window.open(`https://wa.me/${telLimpio}?text=${msgEnc}`, '_blank');
}

// ===== CALENDARIO =====
function cambiarMes(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}

function renderCalendar() {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('calMesTitle').textContent = `${meses[calMonth]} ${calYear}`;

  const grid = document.getElementById('calendarGrid');
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const hoy = new Date();

  let html = dias.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  const primerDia = new Date(calYear, calMonth, 1);
  const ultimoDia = new Date(calYear, calMonth + 1, 0);
  const startDow = primerDia.getDay();

  // Celdas vacías antes
  for (let i = 0; i < startDow; i++) html += `<div class="cal-day other-month"></div>`;

  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    const fechaStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const esTurnosDia = allTurnos.filter(t => t.fecha === fechaStr);
    const tienePend = esTurnosDia.some(t => t.estado === 'pendiente_pago' || t.estado === 'pago_enviado');
    const tieneConf = esTurnosDia.some(t => t.estado === 'confirmado');
    const esHoy = (hoy.getFullYear()===calYear && hoy.getMonth()===calMonth && hoy.getDate()===d);

    const clases = ['cal-day',
      esHoy ? 'today' : '',
      esTurnosDia.length ? 'has-turnos' : ''
    ].filter(Boolean).join(' ');

    const dots = [
      tienePend ? '<span class="cal-dot cal-dot-pend"></span>' : '',
      tieneConf ? '<span class="cal-dot cal-dot-conf"></span>' : ''
    ].join('');

    html += `<div class="${clases}" onclick="selectCalDay('${fechaStr}',${d})">
      <div class="cal-day-num">${d}</div>
      ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
    </div>`;
  }
  grid.innerHTML = html;
  document.getElementById('calDetail').style.display = 'none';
}

function selectCalDay(fecha, d) {
  document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');

  const turnosDia = allTurnos.filter(t => t.fecha === fecha && t.estado !== 'cancelado');
  const det = document.getElementById('calDetail');
  document.getElementById('calDetailTitle').textContent = formatFecha(fecha);

  if (!turnosDia.length) {
    document.getElementById('calDetailTurnos').innerHTML = `<p style="color:var(--text3);font-size:.875rem">Sin turnos este día.</p>`;
  } else {
    document.getElementById('calDetailTurnos').innerHTML = turnosDia
      .sort((a,b) => a.hora.localeCompare(b.hora))
      .map(t => {
        const labels = { pendiente_pago:'Esperando pago', pago_enviado:'Comprobante enviado', confirmado:'Confirmado' };
        return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:500;min-width:48px">${t.hora}</span>
          <span style="flex:1">${t.paciente_nombre||'—'}</span>
          <span class="badge badge-${t.estado}">${labels[t.estado]||t.estado}</span>
        </div>`;
      }).join('');
  }
  det.style.display = 'block';
}

// ===== MENSAJES ADMIN =====
let realtimeAdmin = null;

async function loadPatientsMessages() {
  // Obtener todos los pacientes que tienen mensajes
  const { data: msgs } = await supabase
    .from('mensajes')
    .select('paciente_id, contenido, created_at, leido, remitente')
    .order('created_at', { ascending: false });

  if (!msgs) return;

  // Agrupar por paciente
  const byPaciente = {};
  msgs.forEach(m => {
    if (!byPaciente[m.paciente_id]) byPaciente[m.paciente_id] = { msgs: [], unread: 0 };
    byPaciente[m.paciente_id].msgs.push(m);
    if (!m.leido && m.remitente === 'paciente') byPaciente[m.paciente_id].unread++;
  });

  // Obtener nombres de pacientes
  const ids = Object.keys(byPaciente);
  if (!ids.length) return;
  const { data: pacientes } = await supabase.from('pacientes').select('user_id,nombre').in('user_id', ids);
  const nombreMap = {};
  (pacientes||[]).forEach(p => nombreMap[p.user_id] = p.nombre);

  const sidebar = document.getElementById('msgsSidebar');
  sidebar.innerHTML = ids.map(pid => {
    const info = byPaciente[pid];
    const ultimo = info.msgs[0];
    const nombre = nombreMap[pid] || pid.slice(0,8)+'...';
    return `<div class="patient-item ${selectedPatientId===pid?'active':''}" onclick="selectPatient('${pid}','${escapeAttr(nombre)}')">
      <div class="turno-avatar" style="width:32px;height:32px;font-size:.75rem;flex-shrink:0">${nombre.slice(0,2).toUpperCase()}</div>
      <div style="min-width:0;flex:1">
        <div class="patient-name">${nombre}</div>
        <div class="patient-preview">${escapeHtml(ultimo?.contenido||'')}</div>
      </div>
      ${info.unread ? `<span class="patient-unread">${info.unread}</span>` : ''}
    </div>`;
  }).join('');

  // Total unread
  const totalUnread = Object.values(byPaciente).reduce((s,x)=>s+x.unread,0);
  const b = document.getElementById('badgeMsgs');
  if (totalUnread) { b.style.display='flex'; b.textContent=totalUnread; }
  else b.style.display='none';
}

async function selectPatient(pid, nombre) {
  selectedPatientId = pid;
  loadPatientsMessages();

  const { data: msgs } = await supabase
    .from('mensajes')
    .select('*')
    .eq('paciente_id', pid)
    .order('created_at', { ascending: true });

  // Marcar como leídos
  await supabase.from('mensajes').update({ leido: true }).eq('paciente_id', pid).eq('remitente', 'paciente');

  const chatEl = document.getElementById('msgsChat');
  const mensajesHtml = (msgs||[]).map(m => {
    const isPsi = m.remitente === 'psicologa';
    return `<div>
      <div class="msg ${isPsi ? 'msg-me' : 'msg-other'}">${escapeHtml(m.contenido)}</div>
      <div class="msg-time" style="text-align:${isPsi?'right':'left'}">${formatTime(m.created_at)}</div>
    </div>`;
  }).join('');

  chatEl.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:500;font-size:.9rem">${nombre}</div>
    <div class="chat-messages" id="adminChatMsgs">${mensajesHtml || '<p style="text-align:center;color:var(--text3);padding:2rem;font-size:.85rem">Sin mensajes todavía.</p>'}</div>
    <div class="chat-input-wrap">
      <textarea class="chat-input" id="adminMsgInput" placeholder="Responder a ${nombre}..." rows="1" onkeydown="handleAdminMsgKey(event)"></textarea>
      <button class="chat-send" onclick="sendAdminMessage('${pid}')">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  `;
  const msgs2 = document.getElementById('adminChatMsgs');
  if (msgs2) msgs2.scrollTop = msgs2.scrollHeight;
}

async function sendAdminMessage(pid) {
  const input = document.getElementById('adminMsgInput');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  await supabase.from('mensajes').insert({ paciente_id: pid, remitente: 'psicologa', contenido: text });
  selectPatient(pid, '');
  loadPatientsMessages();
}

function handleAdminMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const pid = selectedPatientId;
    if (pid) sendAdminMessage(pid);
  }
}

// ===== CONFIG =====
function buildHorariosConfig() {
  const el = document.getElementById('horariosConfig');
  el.innerHTML = HORAS_TODAS.map(h => `
    <label class="hora-check">
      <input type="checkbox" value="${h}" checked> ${h}
    </label>
  `).join('');
}

async function loadConfig() {
  const { data } = await supabase.from('config').select('*').single();
  if (!data) return;
  if (data.cbu)          document.getElementById('cfgCBU').value     = data.cbu;
  if (data.alias)        document.getElementById('cfgAlias').value   = data.alias;
  if (data.titular)      document.getElementById('cfgTitular').value = data.titular;
  if (data.wsp_psicologa) document.getElementById('cfgWspPsi').value = data.wsp_psicologa;
  if (data.horarios) {
    document.querySelectorAll('#horariosConfig input[type=checkbox]').forEach(cb => {
      cb.checked = data.horarios.includes(cb.value);
    });
  }
}

async function saveConfig() {
  const cbu      = document.getElementById('cfgCBU').value.trim();
  const alias    = document.getElementById('cfgAlias').value.trim();
  const titular  = document.getElementById('cfgTitular').value.trim();
  const wspPsi   = document.getElementById('cfgWspPsi').value.trim();
  const horarios = [...document.querySelectorAll('#horariosConfig input:checked')].map(c => c.value);

  const { error } = await supabase.from('config').upsert({ id: 1, cbu, alias, titular, wsp_psicologa: wspPsi, horarios });
  const ok = document.getElementById('cfgOk');
  ok.style.display = error ? 'none' : 'block';
  setTimeout(() => { ok.style.display = 'none'; }, 2500);
}

// ===== REALTIME =====
function subscribeRealtime() {
  supabase.channel('admin-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, loadAllTurnos)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => {
      loadPatientsMessages();
      if (selectedPatientId) selectPatient(selectedPatientId, '');
    })
    .subscribe();
}

// ===== BADGES =====
function updateBadges() {
  const pend = allTurnos.filter(t => t.estado === 'pago_enviado' || t.estado === 'pendiente_pago').length;
  const b = document.getElementById('badgePend');
  if (pend) { b.style.display='flex'; b.textContent=pend; }
  else b.style.display='none';
}

// ===== MODAL =====
function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalTurno').classList.add('open');
}
function closeModal() {
  document.getElementById('modalTurno').classList.remove('open');
}
document.addEventListener('click', e => {
  if (e.target.id === 'modalTurno') closeModal();
});

// ===== UTILS =====
function formatFecha(f) {
  if (!f) return '';
  const [y,m,d] = f.split('-');
  const nombres = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${nombres[parseInt(m)]} ${y}`;
}
function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
}
function escapeHtml(t) {
  return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(t) {
  return String(t||'').replace(/'/g,"\\'");
}
