// ====== Supabase config ======
// Shared client used by every page (index.html, dashboard.html, etc).
// Replace these two values with the ones from your Supabase project:
// Project Settings -> API -> Project URL / anon public key
const SUPABASE_URL = "https://lnxdjhajshpqsricttys.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxueGRqaGFqc2hwcXNyaWN0dHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjQ0NjYsImV4cCI6MjEwMTAwMDQ2Nn0.WGlL_t6eCBaoB_0iNHNjCeYaXfcXT94lJPp8oglgHKU";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== Shared display-name helper ======
// Best-effort display name for users who signed up before the full_name
// field existed, or who somehow have no metadata (e.g. account made
// directly in the Supabase dashboard). Not a reliable name split - just
// capitalizes the email's local part and strips trailing digits.
function deriveNameFromEmail(email) {
    const localPart = email.split("@")[0];
    const cleaned = localPart.replace(/[0-9]+$/, "");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getDisplayName(user) {
    const fullName = user?.user_metadata?.full_name;
    if (fullName) return fullName;
    return deriveNameFromEmail(user.email);
}
