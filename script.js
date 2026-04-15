/* Bootstrap loader for section-based scripts. */
(function bootstrapLmsApp() {
  var moduleScripts = [
    'js/modules/utils.js',
    'js/modules/nav.js',
    'js/modules/admin.js',
    'js/modules/student.js',
    'js/modules/auth.js'
  ];

  // Surface precise script/line details for module parse/runtime failures.
  window.addEventListener('error', function (event) {
    var source = event.filename || 'unknown-file';
    var line = event.lineno || 0;
    var col = event.colno || 0;
    console.error('[TALeeO LMS] Runtime error at ' + source + ':' + line + ':' + col + ' -> ' + event.message);
  });

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error('Failed to load script: ' + src));
      };
      document.body.appendChild(script);
    });
  }

  (async function init() {
    try {
      for (var i = 0; i < moduleScripts.length; i++) {
        await loadScript(moduleScripts[i]);
      }

      // Preserve original startup sequence.
      initTabSession();
      initData();
      checkSession();
    } catch (err) {
      console.error('[TALeeO LMS] Bootstrap error:', err);
      alert('Application failed to load. Check console for details.');
    }
  })();
})();
