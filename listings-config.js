/* Public Supabase settings for StreamCloud admin listings.
   The anon / publishable key is designed to be public (row-level security protects the data).
   NEVER put the service-role key, ADMIN_PIN, Gemini or OMDb keys in this file. */
window.STREAMCLOUD_SUPABASE = {
  url: "https://husydmiujigyonlxbuuj.supabase.co",
  anonKey: "sb_publishable_S20xF3_NWiQjA727-mG6oQ_Rxst1YQM"  // Public publishable key; RLS protects database access
};

/* Admin Ultra layer (steppers, live-preview dock, Catalogue Pro, AI tools) */
(function () { var s = document.createElement("script"); s.src = "./admin-ultra.js"; s.defer = true; document.head.appendChild(s); })();
