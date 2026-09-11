
(function() {
  'use strict';

  const STORAGE_KEY_AI = 'aem_ai_config';
  const STORAGE_KEY_ENVS = 'aem_environments';
  const STORAGE_SCHEMA_VERSION = 2;

  const providerSelect = document.getElementById('ai-provider');
  const apiKeyInput = document.getElementById('ai-api-key');
  const modelInput = document.getElementById('ai-model');
  const saveBtn = document.getElementById('save-btn');
  const clearBtn = document.getElementById('clear-btn');
  const statusDiv = document.getElementById('status');

  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file');
  const backupStatus = document.getElementById('backup-status');

  function loadConfig() {
    chrome.storage.local.get([STORAGE_KEY_AI], function(result) {
      const config = result[STORAGE_KEY_AI] || {};
      providerSelect.value = config.provider || 'openai';
      if (config.apiKey) {
        apiKeyInput.placeholder = '•••••••• (saved)';
        apiKeyInput.value = '';
      } else {
        apiKeyInput.placeholder = 'Enter your API key';
      }
      modelInput.value = config.model || '';
    });
  }

  function showStatus(msg, isError) {
    statusDiv.textContent = msg;
    statusDiv.className = 'status' + (isError ? ' error' : '');
    setTimeout(function() {
      statusDiv.textContent = '';
      statusDiv.className = 'status';
    }, 4000);
  }

  function saveConfig() {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const model = modelInput.value.trim();

    if (!apiKey) {
      chrome.storage.local.get([STORAGE_KEY_AI], function(result) {
        const existing = result[STORAGE_KEY_AI] || {};
        if (existing.apiKey) {
          const config = {
            provider: provider,
            apiKey: existing.apiKey,
            model: model
          };
          const obj = {};
          obj[STORAGE_KEY_AI] = config;
          chrome.storage.local.set(obj, function() {
            showStatus('Settings saved.', false);
          });
        } else {
          showStatus('Please enter your API key.', true);
        }
      });
      return;
    }

    const config = {
      provider: provider,
      apiKey: apiKey,
      model: model
    };
    const obj = {};
    obj[STORAGE_KEY_AI] = config;

    chrome.storage.local.set(obj, function() {
      apiKeyInput.value = '';
      apiKeyInput.placeholder = '•••••••• (saved)';
      showStatus('Settings saved.', false);
    });
  }

  function clearKey() {
    if (!confirm('Remove your stored API key?')) return;
    chrome.storage.local.get([STORAGE_KEY_AI], function(result) {
      const config = result[STORAGE_KEY_AI] || {};
      config.apiKey = '';
      const obj = {};
      obj[STORAGE_KEY_AI] = config;
      chrome.storage.local.set(obj, function() {
        apiKeyInput.value = '';
        apiKeyInput.placeholder = 'Enter your API key';
        showStatus('API key cleared.', false);
      });
    });
  }

  // ============================================================
  //  BACKUP & RESTORE (ENVIRONMENTS)
  // ============================================================
  function isValidEnvUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:') {
        if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return false;
      } else if (parsed.protocol !== 'https:') {
        return false;
      }
      if (parsed.username || parsed.password) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function getEnvironments() {
    return new Promise(function(resolve) {
      chrome.storage.sync.get([STORAGE_KEY_ENVS], function(result) {
        const data = result[STORAGE_KEY_ENVS];
        if (data && Array.isArray(data.environments)) {
          resolve(data.environments);
        } else {
          resolve([]);
        }
      });
    });
  }

  function saveEnvironments(envs) {
    return new Promise(function(resolve) {
      const payload = { schemaVersion: STORAGE_SCHEMA_VERSION, environments: envs };
      const obj = {};
      obj[STORAGE_KEY_ENVS] = payload;
      chrome.storage.sync.set(obj, resolve);
    });
  }

  function showBackupStatus(msg, isError) {
    backupStatus.textContent = msg;
    backupStatus.className = 'status' + (isError ? ' error' : '');
  }

  async function exportEnvironments() {
    const envs = await getEnvironments();
    if (envs.length === 0) {
      showBackupStatus('No environments to export.', true);
      return;
    }
    const json = JSON.stringify(envs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aem-environments-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showBackupStatus('Exported ' + envs.length + ' environment(s).', false);
  }

  async function importEnvironmentsFromFile(file) {
    let parsed;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch (_) {
      showBackupStatus('That file is not valid JSON.', true);
      return;
    }

    if (!Array.isArray(parsed)) {
      showBackupStatus('Expected a JSON array of environments.', true);
      return;
    }

    const valid = [];
    let skipped = 0;
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || !item.name || !isValidEnvUrl(item.authorUrl)) {
        skipped++;
        continue;
      }
      valid.push({
        id: Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
        name: String(item.name),
        authorUrl: item.authorUrl,
        publishUrl: isValidEnvUrl(item.publishUrl) ? item.publishUrl : '',
        isCloud: item.isCloud !== false,
        customLinks: Array.isArray(item.customLinks)
          ? item.customLinks
              .filter(function(l) { return l && isValidEnvUrl(l.url) && l.label; })
              .map(function(l) {
                return {
                  id: Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
                  label: String(l.label),
                  url: l.url
                };
              })
          : []
      });
    }

    if (valid.length === 0) {
      showBackupStatus('No valid environments found in that file.', true);
      return;
    }

    const current = await getEnvironments();
    await saveEnvironments(current.concat(valid));
    showBackupStatus(
      'Imported ' + valid.length + ' environment(s).' + (skipped > 0 ? ' Skipped ' + skipped + ' invalid entr' + (skipped === 1 ? 'y' : 'ies') + '.' : ''),
      false
    );
  }

  exportBtn.addEventListener('click', exportEnvironments);
  importBtn.addEventListener('click', function() {
    importFileInput.value = '';
    importFileInput.click();
  });
  importFileInput.addEventListener('change', function() {
    const file = importFileInput.files && importFileInput.files[0];
    if (file) importEnvironmentsFromFile(file);
  });

  document.addEventListener('DOMContentLoaded', loadConfig);
  saveBtn.addEventListener('click', saveConfig);
  clearBtn.addEventListener('click', clearKey);

  apiKeyInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') saveConfig();
  });
  modelInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') saveConfig();
  });
})();