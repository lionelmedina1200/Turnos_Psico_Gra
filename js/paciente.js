// ===== PACIENTE JS =====

let currentUser = null;
let pacienteData = null;
let selectedFecha = null;
let selectedHora  = null;
let comprobanteURL = null;
let realtimeMsg = null;

const HORAS_BASE = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;
  document.getElementById('navUser').textContent = currentUser.user_metadata?.nombre || currentUser.email;

  // Cargar perfil
  const { data: p } = await supabase.from('pacientes').select('*').eq('user_id', currentUser.id).single();
  pacienteData = p;

  // Fecha mínima = mañana
  const manana = new Date(); manana.setDate(manana.getDate() + 1);
  document.getElementById('bookFecha').min = manana.toISOString().split('T')[0];
  document.getElementById('bookFecha').addEventListener('change', onFechaChange);

  loadConfig();
  loadMisTurnos();
  loadMensajes();
  subscribeMessages();
});

// ===== NAVEGACIÓN =====
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  document.getElementById('sb-' + id).classList.add('active');
  if (id === 'mensajes') markMessagesRead();
}

// ===== CARGAR CONFIG (CBU/Alias) =====
async function loadConfig() {
  const { data } = await supabase.from('config').select('*').single();
  if (!data) return;
  document.getElementById('configCBU').textContent    = data.cbu     || '—';
  document.getElementById('configAlias').textContent  = data.alias   || '—';
  document.getElementById('configTitular').textContent= data.titular || '—';
}

// ===== MIS TURNOS =====
async function loadMisTurnos() {
  const { data: turnos } = await supabase
    .from('turnos')
    .select('*')
    .eq('paciente_id', currentUser.id)
    .order('fecha', { ascending: true });

  const el = document.getElementById('turnosList');
  if (!turnos || !turnos.length) {
    el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text3)">
      <p>Todavía no tenés turnos reservados.</p>
      <button class="btn-main" style="max-width:200px;margin:1rem auto 0" onclick="showSection('nuevo')">Reservar turno</button>
    </div>`;
    return;
  }

  el.innerHTML = turnos.map(t => turnoCard(t, false)).join('');
}

function turnoCard(t, isAdmin) {
  const labels = {
    pendiente_pago: 'Esperando pago',
    pago_enviado:   'Comprobante enviado',
    confirmado:     'Confirmado',
    cancelado:      'Cancelado'
  };
  const fecha = formatFecha(t.fecha);
  const nombre = isAdmin ? (t.paciente_nombre || '—') : '';
  const avatarText = (t.paciente_nombre || 'P').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();

  return `<div class="turno-card">
    <div class="turno-avatar">${avatarText}</div>
    <div class="turno-body">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="turno-nombre">${isAdmin ? nombre : fecha + ' — ' + t.hora}</div>
        <span class="badge badge-${t.estado}">${labels[t.estado] || t.estado}</span>
      </div>
      ${isAdmin ? `<div class="turno-meta"><span>📅 ${fecha}</span><span>🕐 ${t.hora}</span><span>📱 ${t.paciente_tel || ''}</span></div>` : ''}
      ${t.motivo ? `<div class="turno-motivo">"${t.motivo}"</div>` : ''}
      ${isAdmin ? `<div class="turno-actions">
        ${t.estado === 'pago_enviado' ? `<button class="btn-sm btn-ver" onclick="verComprobante('${t.comprobante_url}','${t.id}')">Ver comprobante</button>` : ''}
        ${(t.estado === 'pago_enviado' || t.estado === 'pendiente_pago') ? `<button class="btn-sm btn-confirm" onclick="confirmarTurno('${t.id}')">Confirmar</button>` : ''}
        ${t.estado !== 'cancelado' ? `<button class="btn-sm btn-reject" onclick="cancelarTurno('${t.id}')">Cancelar</button>` : ''}
        ${t.estado === 'confirmado' ? `<button class="btn-sm btn-wsp" onclick="enviarWsp('${t.id}')">WhatsApp</button>` : ''}
      </div>` : ''}
    </div>
  </div>`;
}

// ===== BOOKING: PASO 1 FECHA =====
async function onFechaChange() {
  selectedFecha = document.getElementById('bookFecha').value;
  selectedHora  = null;
  if (!selectedFecha) return;

  // Obtener horarios habilitados de config
  const { data: cfg } = await supabase.from('config').select('horarios').single();
  const habilitados = cfg?.horarios || HORAS_BASE;

  // Obtener turnos ocupados en esa fecha
  const { data: ocupados } = await supabase
    .from('turnos')
    .select('hora')
    .eq('fecha', selectedFecha)
    .neq('estado', 'cancelado');

  const horasOcupadas = (ocupados || []).map(t => t.hora);
  const grid = document.getElementById('horariosGrid');
  grid.style.display = 'grid';
  grid.innerHTML = habilitados.map(h => `
    <button class="hora-btn" onclick="selectHora(this,'${h}')" ${horasOcupadas.includes(h) ? 'disabled' : ''}>${h}</button>
  `).join('');
}

function selectHora(btn, hora) {
  document.querySelectorAll('.hora-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedHora = hora;
  unlockStep2();
}

function unlockStep2() {
  if (!selectedFecha || !selectedHora) return;
  document.getElementById('step2').classList.remove('locked');
}

// ===== BOOKING: PASO 2 COMPROBANTE =====
function previewFile(input) {
  if (!input.files[0]) return;
  const url = URL.createObjectURL(input.files[0]);
  const img = document.getElementById('previewImg');
  img.src = url; img.style.display = 'block';
  document.getElementById('uploadText').textContent = input.files[0].name;
  unlockStep3();
}

function unlockStep3() {
  const motivo = '';
  document.getElementById('step3').classList.remove('locked');
  document.getElementById('summaryBox').innerHTML = `
    <strong>${formatFecha(selectedFecha)}</strong> a las <strong>${selectedHora}</strong><br>
    Valor de la sesión: <strong>$40.000</strong><br>
    Estado: <em>Pendiente de confirmación por la psicóloga</em>
  `;
}

// ===== BOOKING: PASO 3 ENVIAR =====
async function enviarSolicitud() {
  const btn = document.getElementById('btnEnviar');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const file = document.getElementById('comprobanteFile').files[0];
  const motivo = '';
  let compURL = null;

  if (file) {
    const ext = file.name.split('.').pop();
    const path = `comprobantes/${currentUser.id}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, file);
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path);
      compURL = urlData.publicUrl;
    }
  }

  const { error } = await supabase.from('turnos').insert({
    paciente_id:    currentUser.id,
    paciente_nombre: pacienteData?.nombre || currentUser.user_metadata?.nombre || currentUser.email,
    paciente_tel:   pacienteData?.tel || '',
    fecha:          selectedFecha,
    hora:           selectedHora,
    motivo,
    estado:         compURL ? 'pago_enviado' : 'pendiente_pago',
    comprobante_url: compURL
  });

  btn.disabled = false;
  btn.textContent = 'Enviar solicitud';

  if (error) { alert('Error al enviar: ' + error.message); return; }

  // Reset
  selectedFecha = null; selectedHora = null; compURL = null;
  document.getElementById('bookFecha').value = '';
  document.getElementById('horariosGrid').style.display = 'none';
  document.getElementById('previewImg').style.display = 'none';
  document.getElementById('comprobanteFile').value = '';
  document.getElementById('uploadText').textContent = 'Tocá para subir imagen';
  document.getElementById('step2').classList.add('locked');
  document.getElementById('step3').classList.add('locked');

  showSection('turnos');
  loadMisTurnos();
}

// ===== MENSAJES =====
async function loadMensajes() {
  const { data: msgs } = await supabase
    .from('mensajes')
    .select('*')
    .eq('paciente_id', currentUser.id)
    .order('created_at', { ascending: true });

  renderMessages(msgs || []);
}

function renderMessages(msgs) {
  const el = document.getElementById('chatMessages');
  if (!msgs.length) { el.innerHTML = '<p style="text-align:center;color:var(--text3);font-size:.85rem;padding:2rem">Todavía no hay mensajes. ¡Escribile a tu psicóloga!</p>'; return; }
  el.innerHTML = msgs.map(m => {
    const isMe = m.remitente === 'paciente';
    return `<div>
      <div class="msg ${isMe ? 'msg-me' : 'msg-other'}">${escapeHtml(m.contenido)}</div>
      <div class="msg-time" style="text-align:${isMe?'right':'left'}">${formatTime(m.created_at)}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function subscribeMessages() {
  realtimeMsg = supabase
    .channel('mensajes-paciente-' + currentUser.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'mensajes',
      filter: `paciente_id=eq.${currentUser.id}`
    }, () => {
      loadMensajes();
      // Mostrar badge si no está en mensajes
      const active = document.getElementById('sec-mensajes')?.classList.contains('active');
      if (!active) { const b = document.getElementById('badgeUnread'); b.style.display='flex'; b.textContent='!'; }
    })
    .subscribe();
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await supabase.from('mensajes').insert({
    paciente_id: currentUser.id,
    remitente:   'paciente',
    contenido:   text
  });
  loadMensajes();
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

async function markMessagesRead() {
  document.getElementById('badgeUnread').style.display = 'none';
  await supabase.from('mensajes')
    .update({ leido: true })
    .eq('paciente_id', currentUser.id)
    .eq('remitente', 'psicologa');
}

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
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
