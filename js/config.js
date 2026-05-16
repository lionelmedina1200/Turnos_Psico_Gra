// =====================================================
//  CONFIGURACIÓN DE SUPABASE
//  Reemplazá estos valores con los de tu proyecto
// =====================================================

const SUPABASE_URL = 'https://dzvfjedtjhlvwipnxzmi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6dmZqZWR0amhsdndpcG54em1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDc2NTMsImV4cCI6MjA5NDUyMzY1M30.5JcK7Ll67WIFoTY6Z00qiOEEbzh8nC3y1lmiBkuo8zU';

// Email de la psicóloga (este email tiene acceso al panel admin)
const ADMIN_EMAIL = 'gracielacolli@gmail.com';

// =====================================================
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
