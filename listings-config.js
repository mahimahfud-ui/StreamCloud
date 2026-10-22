/* Public Supabase settings for StreamCloud admin listings.
   The anon / publishable key is designed to be public (row-level security protects the data).
   NEVER put the service-role key, ADMIN_PIN, Gemini or OMDb keys in this file. */
window.STREAMCLOUD_SUPABASE = {
  url: "https://husydmiujigyonlxbuuj.supabase.co",
  anonKey: "sb_publishable_S20xF3_NWiQjA727-mG6oQ_Rxst1YQM"  // Public publishable key; RLS protects database access
};

/* Admin Ultra layer (steppers, live-preview dock, Catalogue Pro, AI tools) */

/* Load admin enhancements in dependency order: Admin Ultra first, then AI Copilot. */
(function () {
  function load(src, done) {
    var s = document.createElement("script");
    s.src = src;
    s.async = false;
    if (done) s.addEventListener("load", done, { once: true });
    document.head.appendChild(s);
  }
  load("./admin-ultra.js", function () { load("./admin-ai-plus.js", function () { load("./admin-polish.js"); }); });
})();
