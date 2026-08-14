/**
 * Standalone storage shim.
 *
 * The app was originally built to run inside a Claude.ai artifact, where
 * `window.storage` is provided by the host page and persists data per-user
 * on Anthropic's servers. This shim gives the same get/set/delete/list
 * interface but backs it with the browser's own localStorage, so the app
 * works as a fully independent, self-hosted web page. All data stays on
 * the visitor's own device and is never sent anywhere by this shim.
 */
(function () {
  function resolved(payload) {
    return Promise.resolve(payload);
  }

  window.storage = {
    get: function (key) {
      try {
        var raw = window.localStorage.getItem(key);
        if (raw === null) return resolved(null);
        return resolved({ key: key, value: raw, shared: false });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, value);
        return resolved({ key: key, value: value, shared: false });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    delete: function (key) {
      try {
        window.localStorage.removeItem(key);
        return resolved({ key: key, deleted: true, shared: false });
      } catch (e) {
        return Promise.reject(e);
      }
    },
    list: function (prefix) {
      try {
        var keys = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (!prefix || (k && k.indexOf(prefix) === 0)) keys.push(k);
        }
        return resolved({ keys: keys });
      } catch (e) {
        return Promise.reject(e);
      }
    },
  };
})();
