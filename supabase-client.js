// Achtung auf die richtige Schreibweise der Projekt-URL!
const SUPABASE_URL = 'https://mqqyvpmddaastacldbyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcXl2cG1kZGFhc3RhY2xkYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzAzNzUsImV4cCI6MjEwMzAwNjM3NX0.OWY2FUS7n9Jw-6FP0Hp1B9aY6AUAkEpZ6Xd7MpS0GLI'; // Deinen bestehenden Key hier stehen lassen

if (typeof supabase === 'undefined' || !supabase.auth) {
    var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabase = supabaseClient;
}