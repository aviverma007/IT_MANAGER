/* IT Manager usage tracker — add to any web app:
 *   <script async src="http://<it-manager-host>:4000/track.js" data-app="APP_CODE"></script>
 * Optional: data-user-key="localStorageKeyHoldingTheUser"  or set  window.ITM_USER = "EMP123"  after login.
 * Sends a tiny beacon on open, on page changes and once a minute while the tab is visible. Never blocks the app. */
(function () {
  try {
    var s = document.currentScript;
    if (!s || window.__itmTracker) return;
    window.__itmTracker = true;
    var app = s.getAttribute("data-app");
    if (!app) return;
    var base = s.src.replace(/\/track\.js.*$/, "");
    var userKey = s.getAttribute("data-user-key");
    var IDLE = 30 * 60 * 1000;

    function get(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
    function set(store, k, v) { try { window[store].setItem(k, v); } catch (e) {} }
    function rid() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)); }

    var vid = get("localStorage", "itm_vid");
    if (!vid) { vid = rid(); set("localStorage", "itm_vid", vid); }

    function session() {
      var sid = get("sessionStorage", "itm_sid_" + app);
      var t = +(get("sessionStorage", "itm_sid_t_" + app) || 0);
      if (!sid || Date.now() - t > IDLE) { sid = rid(); set("sessionStorage", "itm_sid_" + app, sid); }
      set("sessionStorage", "itm_sid_t_" + app, String(Date.now()));
      return sid;
    }

    var FIELDS = ["employeeCode", "empCode", "emp_code", "EmpCode", "EmployeeCode", "empId", "employeeId", "code", "username", "userName", "UserName", "email", "Email", "name", "Name", "id"];
    function pick(v) {
      if (!v) return "";
      try {
        var o = JSON.parse(v);
        if (o && typeof o === "object") {
          var src = o.user && typeof o.user === "object" ? o.user : o.employee && typeof o.employee === "object" ? o.employee : o;
          for (var i = 0; i < FIELDS.length; i++) if (src[FIELDS[i]] && typeof src[FIELDS[i]] !== "object") return String(src[FIELDS[i]]);
          return "";
        }
        if (typeof o === "string" || typeof o === "number") v = String(o);
      } catch (e) {}
      v = String(v);
      // ignore tokens (JWTs, long opaque strings)
      if (v.length > 80 || (v.split(".").length === 3 && v.length > 40)) return "";
      return v;
    }
    var KEYS = ["user", "currentUser", "authUser", "loggedInUser", "userInfo", "userData", "employee", "emp", "profile", "auth", "session", "username", "userName", "empCode", "employeeCode", "email"];
    function user() {
      if (window.ITM_USER) return String(window.ITM_USER);
      if (userKey) return pick(get("localStorage", userKey) || get("sessionStorage", userKey));
      for (var i = 0; i < KEYS.length; i++) {
        var u = pick(get("localStorage", KEYS[i]) || get("sessionStorage", KEYS[i]));
        if (u) return u;
      }
      return "";
    }

    function send(ev) {
      var body = JSON.stringify({ app: app, ev: ev, sid: session(), vid: vid, user: user(), page: location.pathname + location.hash, t: Date.now() });
      var url = base + "/api/track";
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
      } catch (e) {}
      try { fetch(url, { method: "POST", body: body, mode: "no-cors", keepalive: true, headers: { "content-type": "text/plain" } }); } catch (e) {}
    }

    send("start");
    var last = location.href;
    function changed() { if (location.href !== last) { last = location.href; send("page"); } }
    ["pushState", "replaceState"].forEach(function (m) {
      var orig = history[m];
      history[m] = function () { var r = orig.apply(this, arguments); setTimeout(changed, 0); return r; };
    });
    window.addEventListener("popstate", changed);
    window.addEventListener("hashchange", changed);
    setInterval(function () { if (document.visibilityState === "visible") send("beat"); }, 60000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") send("beat"); });
    window.addEventListener("pagehide", function () { send("end"); });
  } catch (e) { /* never break the host app */ }
})();
