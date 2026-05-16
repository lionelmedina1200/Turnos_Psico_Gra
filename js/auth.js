// ===== AUTH HELPERS =====

function showAuthTab(tab) {
  document.getElementById('formLogin').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('formRegister').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',    tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  showError('loginError', '');
  if (!email || !password) return showError('loginError', 'Completá email y contraseña.');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return showError('loginError', 'Email o contraseña incorrectos.');
  redirectAfterLogin(data.user);
}

async function doRegister() {
  const nombre    = document.getElementById('regNombre').value.trim();
  const tel       = document.getElementById('regTel').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const password  = document.getElementById('regPassword').value;
  showError('regError', '');

  if (!nombre || !email || !password) return showError('regError', 'Completá todos los campos obligatorios.');
  if (password.length < 6) return showError('regError', 'La contraseña debe tener al menos 6 caracteres.');

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { nombre, tel } }
  });
  if (error) return showError('regError', error.message);

  // Guardar perfil en tabla pacientes
  await supabase.from('pacientes').insert({ user_id: data.user.id, nombre, tel, email });
  redirectAfterLogin(data.user);
}

async function doGoogleLogin() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/paciente.html' }
  });
  if (error) alert('Error al conectar con Google.');
}

function redirectAfterLogin(user) {
  if (user.email === ADMIN_EMAIL) {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'paciente.html';
  }
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// Redirigir si ya hay sesión activa (en landing)
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) redirectAfterLogin(data.session.user);
  });
}
