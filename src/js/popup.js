(function() {
  'use strict';

  // ============================================================
  //  CONSTANTS
  // ============================================================
  const STORAGE_KEY_ENVS = 'aem_environments';
  const STORAGE_KEY_AI = 'aem_ai_config';
  const STORAGE_SCHEMA_VERSION = 2;

  // ============================================================
  //  DOM REFS
  // ============================================================
  const envList = document.getElementById('env-list');
  const envSearchInput = document.getElementById('env-search');
  const showAddBtn = document.getElementById('show-add-form');
  const addForm = document.getElementById('add-form');
  const cancelAddBtn = document.getElementById('cancel-add');
  const saveEnvBtn = document.getElementById('save-env');
  const addError = document.getElementById('add-error');
  const duplicateNote = document.getElementById('duplicate-note');

  const envNameInput = document.getElementById('env-name');
  const envAuthorInput = document.getElementById('env-author');
  const envPublishInput = document.getElementById('env-publish');
  const envIsCloudInput = document.getElementById('env-is-cloud');
  const envTierRow = document.getElementById('env-tier-row');
  const envTierSelect = document.getElementById('env-tier');

  const MAX_CUSTOM_LINKS = 8;

  const detectBanner = document.getElementById('detect-banner');
  const detectHost = document.getElementById('detect-host');
  const detectAddBtn = document.getElementById('detect-add-btn');
  const detectDismissBtn = document.getElementById('detect-dismiss-btn');

  const aiPrompt = document.getElementById('ai-prompt');
  const aiGenerateBtn = document.getElementById('ai-generate');
  const aiStatus = document.getElementById('ai-status');
  const aiOutput = document.getElementById('ai-output');
  const aiSettingsLink = document.getElementById('ai-settings-link');

  // ============================================================
  //  UTILITY: SAFE DOM CREATION
  // ============================================================
  function createElem(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (key === 'textContent') {
          el.textContent = value;
        } else if (key === 'className') {
          el.className = value;
        } else {
          el.setAttribute(key, value);
        }
      }
    }
    if (children) {
      for (const child of children) {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else if (child) {
          el.appendChild(child);
        }
      }
    }
    return el;
  }

  function createLink(href, text) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function createCopyBtn(url) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.title = 'Copy link';
    btn.textContent = '📋';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(url).then(function() {
        btn.textContent = '✓';
        setTimeout(function() { btn.textContent = '📋'; }, 1500);
      }).catch(function() {
        btn.textContent = '✗';
        setTimeout(function() { btn.textContent = '📋'; }, 1500);
      });
    });
    return btn;
  }

  function createLinkRow(url, label, onRemove) {
    const row = document.createElement('span');
    row.className = 'link-row';
    row.appendChild(createLink(url, label));
    row.appendChild(createCopyBtn(url));
    if (onRemove) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'link-remove-btn';
      rm.title = 'Remove link';
      rm.textContent = '×';
      rm.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      });
      row.appendChild(rm);
    }
    return row;
  }

  // ============================================================
  //  URL VALIDATION
  // ============================================================
  function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed === '') return false;

    try {
      const parsed = new URL(trimmed);

      // Protocol must be https, or http for localhost only
      if (parsed.protocol === 'http:') {
        const host = parsed.hostname;
        if (host !== 'localhost' && host !== '127.0.0.1') {
          return false;
        }
      } else if (parsed.protocol !== 'https:') {
        return false;
      }

      // Block credentials in URL
      if (parsed.username || parsed.password) {
        return false;
      }

      // Block dangerous schemes (defense-in-depth, protocol check above already covers these)
      const scheme = parsed.protocol.replace(':', '').toLowerCase();
      const dangerous = ['javascript', 'data', 'file', 'chrome', 'chrome-extension'];
      if (dangerous.indexOf(scheme) !== -1) {
        return false;
      }

      // Basic hostname validation
      const host = parsed.hostname;
      if (!host || host.length === 0) return false;

      // Reject non-localhost IPs
      const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4.test(host) && host !== '127.0.0.1') {
        return false;
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeUrl(url) {
    if (!url) return '';
    let trimmed = url.trim();
    // Ensure protocol
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    // Remove trailing slash
    trimmed = trimmed.replace(/\/+$/, '');
    return trimmed;
  }

  function validateAndNormalizeUrl(url) {
    const normalized = normalizeUrl(url);
    if (!isValidUrl(normalized)) {
      return null;
    }
    return normalized;
  }

  // ============================================================
  //  STORAGE: ENVIRONMENTS
  // ============================================================
  function getEnvironments() {
    return new Promise(function(resolve) {
      chrome.storage.sync.get([STORAGE_KEY_ENVS], function(result) {
        const data = result[STORAGE_KEY_ENVS];
        if (data && data.schemaVersion === STORAGE_SCHEMA_VERSION && Array.isArray(data.environments)) {
          resolve(data.environments);
        } else {
          // Attempt migration from old format
          migrateOldStorage().then(resolve);
        }
      });
    });
  }

  function saveEnvironments(envs) {
    return new Promise(function(resolve) {
      const payload = {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        environments: envs
      };
      const obj = {};
      obj[STORAGE_KEY_ENVS] = payload;
      chrome.storage.sync.set(obj, resolve);
    });
  }

  function getDefaultEnvironments() {
    function freshId() {
      return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
    }
    return [
      {
        id: freshId(),
        name: 'Cloud Example (edit me)',
        authorUrl: 'https://author-p12345-e67890.adobeaemcloud.com',
        publishUrl: 'https://publish-p12345-e67890.adobeaemcloud.com',
        isCloud: true,
        tier: 'dev',
        customLinks: []
      },
      {
        id: freshId(),
        name: 'Classic Example (edit me)',
        authorUrl: 'https://author.example.com',
        publishUrl: '',
        isCloud: false,
        customLinks: []
      },
      {
        id: freshId(),
        name: 'Local SDK (edit me)',
        authorUrl: 'http://localhost:4502',
        publishUrl: 'http://localhost:4503',
        isCloud: true,
        tier: 'dev',
        customLinks: []
      }
    ];
  }

  function migrateOldStorage() {
    return new Promise(function(resolve) {
      chrome.storage.sync.get(null, function(all) {
        const migrated = [];
        const keysToRemove = [];

        for (const key of Object.keys(all)) {
          // Old format used keys starting with "_" and values "url|username|password"
          if (key.charAt(0) === '_' && typeof all[key] === 'string') {
            const parts = all[key].split('|');
            if (parts.length >= 1) {
              let host = parts[0] || '';
              host = normalizeUrl(host);
              // Skip invalid hosts; drop credentials anyway
              if (!isValidUrl(host)) {
                keysToRemove.push(key);
                continue;
              }
              const name = key.substring(1);
              const isCloud = host.indexOf('adobeaemcloud.com') !== -1;
              let publishUrl = '';
              if (isCloud && host.indexOf('author-') !== -1) {
                publishUrl = host.replace('author-', 'publish-');
              }
              migrated.push({
                id: Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
                name: name,
                authorUrl: host,
                publishUrl: publishUrl,
                isCloud: isCloud
              });
            }
            keysToRemove.push(key);
          }
        }

        // Fresh install: nothing to migrate and nothing to clean up.
        // Seed a starter set so the popup isn't empty on first use.
        if (migrated.length === 0 && keysToRemove.length === 0) {
          const defaults = getDefaultEnvironments();
          const payload = { schemaVersion: STORAGE_SCHEMA_VERSION, environments: defaults };
          const toSave = {};
          toSave[STORAGE_KEY_ENVS] = payload;
          chrome.storage.sync.set(toSave, function() { resolve(defaults); });
          return;
        }

        const payload = {
          schemaVersion: STORAGE_SCHEMA_VERSION,
          environments: migrated
        };
        const toSave = {};
        toSave[STORAGE_KEY_ENVS] = payload;

        chrome.storage.sync.set(toSave, function() {
          if (keysToRemove.length > 0) {
            chrome.storage.sync.remove(keysToRemove, function() {
              resolve(migrated);
            });
          } else {
            resolve(migrated);
          }
        });
      });
    });
  }

  // ============================================================
  //  STORAGE: AI CONFIG (local, NOT sync)
  // ============================================================
  function getAIConfig() {
    return new Promise(function(resolve) {
      chrome.storage.local.get([STORAGE_KEY_AI], function(result) {
        const config = result[STORAGE_KEY_AI] || {};
        resolve({
          provider: config.provider || 'openai',
          apiKey: config.apiKey || '',
          model: config.model || ''
        });
      });
    });
  }

  // ============================================================
  //  RENDER ENVIRONMENTS
  // ============================================================
  async function renderEnvironments() {
    const allEnvs = await getEnvironments();
    const term = ((envSearchInput && envSearchInput.value) || '').trim().toLowerCase();
    const envs = term
      ? allEnvs.filter(function(env) {
          return (env.name || '').toLowerCase().indexOf(term) !== -1 ||
                 (env.authorUrl || '').toLowerCase().indexOf(term) !== -1;
        })
      : allEnvs;

    // Clear list safely
    while (envList.firstChild) {
      envList.removeChild(envList.firstChild);
    }

    if (allEnvs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No environments configured. Add one below.';
      envList.appendChild(empty);
      return;
    }

    if (envs.length === 0) {
      const noMatch = document.createElement('div');
      noMatch.className = 'empty-state';
      noMatch.textContent = 'No environments match your search.';
      envList.appendChild(noMatch);
      return;
    }

    for (const env of envs) {
      const card = document.createElement('div');
      card.className = 'env-card';

      // --- Header row ---
      const header = document.createElement('div');
      header.className = 'env-header';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'env-name';
      nameSpan.textContent = env.name || 'Unnamed';

      const badge = document.createElement('span');
      badge.className = 'env-badge' + (env.isCloud ? '' : ' classic');
      badge.textContent = env.isCloud
        ? '☁️ Cloud · ' + (env.tier === 'stage' ? 'Stage' : env.tier === 'prod' ? 'Prod' : 'Dev')
        : '💻 Classic';
      nameSpan.appendChild(badge);

      const duplicateBtn = document.createElement('button');
      duplicateBtn.className = 'env-duplicate-btn';
      duplicateBtn.textContent = '⧉';
      duplicateBtn.setAttribute('aria-label', 'Duplicate environment ' + (env.name || 'Unnamed'));
      duplicateBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        showDuplicateForm(env);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'env-delete-btn';
      deleteBtn.textContent = '✕';
      deleteBtn.setAttribute('aria-label', 'Delete environment ' + (env.name || 'Unnamed'));
      deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('Delete environment "' + (env.name || 'Unnamed') + '"?')) {
          getEnvironments().then(function(current) {
            const filtered = current.filter(function(item) {
              return item.id !== env.id;
            });
            saveEnvironments(filtered).then(renderEnvironments);
          });
        }
      });

      header.appendChild(nameSpan);
      header.appendChild(duplicateBtn);
      header.appendChild(deleteBtn);

      // --- Host display ---
      const hostDisplay = document.createElement('div');
      hostDisplay.className = 'env-host';
      hostDisplay.textContent = env.authorUrl || 'No URL';

      card.appendChild(header);
      card.appendChild(hostDisplay);

      // --- Quick links, grouped into rows: content -> dev tools -> external ---
      const links = generateLinks(env);
      const groups = [
        { key: 'content', links: links.filter(function(l) { return l.group === 'content'; }) },
        { key: 'dev', links: links.filter(function(l) { return l.group === 'dev'; }) },
        { key: 'external', links: links.filter(function(l) { return l.group === 'external'; }) }
      ];

      for (const group of groups) {
        if (group.links.length === 0) continue;
        const row = document.createElement('div');
        row.className = 'env-links env-links-' + group.key;
        for (const link of group.links) {
          row.appendChild(createLinkRow(link.url, link.label, null));
        }
        card.appendChild(row);
      }

      // --- Custom (bookmarked) links get their own row ---
      const customLinks = Array.isArray(env.customLinks) ? env.customLinks : [];
      const customRow = document.createElement('div');
      customRow.className = 'env-links env-links-custom';

      for (const link of customLinks) {
        customRow.appendChild(createLinkRow(link.url, link.label, function() {
          removeCustomLink(env.id, link.id);
        }));
      }

      if (customLinks.length < MAX_CUSTOM_LINKS) {
        const addLinkBtn = document.createElement('button');
        addLinkBtn.type = 'button';
        addLinkBtn.className = 'add-link-btn';
        addLinkBtn.textContent = '+ Link';
        addLinkBtn.addEventListener('click', function() {
          toggleAddLinkForm(card, env.id);
        });
        customRow.appendChild(addLinkBtn);
      } else {
        const maxNote = document.createElement('span');
        maxNote.className = 'max-links-note';
        maxNote.textContent = 'Max ' + MAX_CUSTOM_LINKS + ' links reached';
        customRow.appendChild(maxNote);
      }

      card.appendChild(customRow);
      envList.appendChild(card);
    }
  }

  // ============================================================
  //  CUSTOM LINKS
  // ============================================================
  function toggleAddLinkForm(card, envId) {
    const existing = card.querySelector('.add-link-form');
    if (existing) {
      existing.remove();
      return;
    }

    const form = document.createElement('div');
    form.className = 'add-link-form';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'Label (e.g. Dispatcher)';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://...';

    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error hidden';

    const actions = document.createElement('div');
    actions.className = 'link-form-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
      const label = labelInput.value.trim();
      const url = validateAndNormalizeUrl(urlInput.value.trim());
      if (!label || !url) {
        errorDiv.textContent = 'Enter a label and a valid URL.';
        errorDiv.classList.remove('hidden');
        return;
      }
      await addCustomLink(envId, label, url);
      renderEnvironments();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() {
      form.remove();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(labelInput);
    form.appendChild(urlInput);
    form.appendChild(actions);
    form.appendChild(errorDiv);
    card.appendChild(form);
    labelInput.focus();
  }

  async function addCustomLink(envId, label, url) {
    const current = await getEnvironments();
    const env = current.find(function(e) { return e.id === envId; });
    if (!env) return;
    if (!Array.isArray(env.customLinks)) env.customLinks = [];
    env.customLinks.push({
      id: Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      label: label,
      url: url
    });
    await saveEnvironments(current);
  }

  async function removeCustomLink(envId, linkId) {
    const current = await getEnvironments();
    const env = current.find(function(e) { return e.id === envId; });
    if (!env || !Array.isArray(env.customLinks)) return;
    env.customLinks = env.customLinks.filter(function(l) { return l.id !== linkId; });
    await saveEnvironments(current);
    renderEnvironments();
  }

  // ============================================================
  //  GENERATE LINKS
  // ============================================================
  function generateLinks(env) {
    const author = env.authorUrl || '';
    const publish = env.publishUrl || '';
    const isCloud = env.isCloud !== false;
    const isLocal = author.indexOf('localhost') !== -1 || author.indexOf('127.0.0.1') !== -1;
    const tier = env.tier || 'dev';
    // AEMaaCS only exposes CRXDE/Packages/OSGi/Tools/User Admin on Dev/RDE
    // (or the local SDK, which always behaves like Dev). Stage/Prod block these.
    const isDevAccess = isLocal || tier === 'dev';

    const links = [];

    if (!author) return links;

    function addLink(group, label, url) {
      if (url && isValidUrl(url)) {
        links.push({ group: group, label: label, url: url });
      }
    }

    if (isCloud) {
      // --- AEM as a Cloud Service ---
      // Group order: content (daily navigation) -> dev tools -> external consoles.
      addLink('content', '📄 Author', author + '/ui');
      if (publish && isValidUrl(publish)) {
        addLink('content', '🌐 Publish', publish + '/ui');
      }
      addLink('content', '🧭 Sites', author + '/sites.html');
      addLink('content', '📁 Assets', author + '/assets.html');
      addLink('content', '🧱 Experience Fragments', author + '/experience-fragments.html');

      if (isDevAccess) {
        // Dev/RDE (and local SDK) allow direct developer console access
        addLink('dev', '💻 CRXDE Lite', author + '/crx/de/index.jsp');
        addLink('dev', '📦 Packages', author + '/crx/packmgr/index.jsp');
        addLink('dev', '🔍 Query Builder', author + '/libs/cq/search/content/querydebug.html');
        addLink('dev', '🧪 GraphiQL', author + '/graphiql');
        addLink('dev', '📤 Sling Distribution', author + '/libs/sling/distribution/console/content/distribution.html');
        addLink('dev', '🧵 Servlet Resolver', author + '/system/console/servletresolver');
        addLink('dev', '🗂️ Resource Resolver', author + '/system/console/jcrresolver');
        addLink('dev', '🧬 Components', author + '/system/console/components');
        addLink('dev', '🕸️ Dependency Finder', author + '/system/console/depfinder');
        addLink('dev', '🗃️ Context-Aware Configs', author + '/system/console/slingconf');
        addLink('dev', '🧠 Threads', author + '/system/console/threads');
        addLink('dev', '🩺 Health Check', author + '/system/console/healthcheck');
        addLink('dev', '📋 Error Log', author + '/system/console/slinglog');
        addLink('dev', '🔁 Workflows', author + '/libs/cq/workflow/content/console.html');
        addLink('dev', '🔧 System Console', author + '/system/console');
        addLink('dev', '⚙️ OSGi Config', author + '/system/console/configMgr');
        addLink('dev', '📊 OSGi Bundles', author + '/system/console/bundles');
        addLink('dev', '🧩 Tools', author + '/tools/general/console.html');
        addLink('dev', '👤 User Admin', author + '/libs/granite/security/content/useradmin.html');
        addLink('external', '☁️ Cloud Manager', 'https://experience.adobe.com/cloud-manager');
      } else {
        // Stage/Prod: developer consoles are blocked, everything routes through Cloud Manager.
        addLink('external', '☁️ Cloud Manager (Dev Console)', 'https://experience.adobe.com/cloud-manager');
      }
    } else {
      // --- Classic AEM (On-Prem / AMS) ---
      addLink('content', '📄 Sites', author + '/sites.html');
      addLink('content', '📁 Assets', author + '/assets.html');
      addLink('content', '🧱 Experience Fragments', author + '/experience-fragments.html');
      addLink('dev', '💻 CRXDE', author + '/crx/de/index.jsp');
      addLink('dev', '📦 Packages', author + '/crx/packmgr/index.jsp');
      addLink('dev', '🔍 Query Builder', author + '/libs/cq/search/content/querydebug.html');
      addLink('dev', '📤 Sling Distribution', author + '/libs/sling/distribution/console/content/distribution.html');
      addLink('dev', '🔗 Replication Agents', author + '/etc/replication/agents.author.html');
      addLink('dev', '🧵 Servlet Resolver', author + '/system/console/servletresolver');
      addLink('dev', '🗂️ Resource Resolver', author + '/system/console/jcrresolver');
      addLink('dev', '🧬 Components', author + '/system/console/components');
      addLink('dev', '🕸️ Dependency Finder', author + '/system/console/depfinder');
      addLink('dev', '🗃️ Context-Aware Configs', author + '/system/console/slingconf');
      addLink('dev', '🧠 Threads', author + '/system/console/threads');
      addLink('dev', '🩺 Health Check', author + '/system/console/healthcheck');
      addLink('dev', '📋 Error Log', author + '/system/console/slinglog');
      addLink('dev', '🔁 Workflows', author + '/libs/cq/workflow/content/console.html');
      addLink('dev', '⚙️ OSGi', author + '/system/console');
      addLink('dev', '👤 Users', author + '/libs/granite/security/content/useradmin.html');
    }

    return links;
  }

  // ============================================================
  //  ADD ENVIRONMENT FORM
  // ============================================================
  let pendingCustomLinks = [];

  function showAddForm(prefill) {
    addForm.classList.remove('hidden');
    showAddBtn.classList.add('hidden');
    envNameInput.value = (prefill && prefill.name) || '';
    envAuthorInput.value = (prefill && prefill.authorUrl) || '';
    envPublishInput.value = (prefill && prefill.publishUrl) || '';
    envIsCloudInput.checked = prefill ? !!prefill.isCloud : true;
    envTierSelect.value = (prefill && prefill.tier) || 'dev';
    envTierRow.classList.toggle('hidden', !envIsCloudInput.checked);
    addError.classList.add('hidden');
    addError.textContent = '';

    pendingCustomLinks = (prefill && prefill.customLinks) || [];
    if (prefill && prefill.sourceName && pendingCustomLinks.length > 0) {
      duplicateNote.textContent = 'Copying ' + pendingCustomLinks.length + ' bookmarked link(s) from "' + prefill.sourceName + '". They keep their original URLs even if you change the Author/Publish URL above.';
      duplicateNote.classList.remove('hidden');
    } else {
      duplicateNote.textContent = '';
      duplicateNote.classList.add('hidden');
    }

    envNameInput.focus();
    if (prefill && prefill.name) {
      envNameInput.select();
    }
  }

  function showDuplicateForm(env) {
    showAddForm({
      name: (env.name || 'Unnamed') + ' (copy)',
      authorUrl: env.authorUrl || '',
      publishUrl: env.publishUrl || '',
      isCloud: env.isCloud !== false,
      tier: env.tier || 'dev',
      customLinks: Array.isArray(env.customLinks) ? env.customLinks : [],
      sourceName: env.name || 'Unnamed'
    });
  }

  function hideAddForm() {
    addForm.classList.add('hidden');
    showAddBtn.classList.remove('hidden');
    pendingCustomLinks = [];
    duplicateNote.textContent = '';
    duplicateNote.classList.add('hidden');
  }

  async function handleSaveEnv() {
    const name = envNameInput.value.trim();
    const authorRaw = envAuthorInput.value.trim();
    const publishRaw = envPublishInput.value.trim();
    const isCloud = envIsCloudInput.checked;

    addError.classList.add('hidden');
    addError.textContent = '';

    if (!name) {
      addError.textContent = 'Environment name is required.';
      addError.classList.remove('hidden');
      return;
    }

    const author = validateAndNormalizeUrl(authorRaw);
    if (!author) {
      addError.textContent = 'Invalid Author URL. Must be valid HTTPS (or HTTP for localhost).';
      addError.classList.remove('hidden');
      return;
    }

    let publish = '';
    if (publishRaw) {
      const p = validateAndNormalizeUrl(publishRaw);
      if (!p) {
        addError.textContent = 'Invalid Publish URL. Must be valid HTTPS (or HTTP for localhost).';
        addError.classList.remove('hidden');
        return;
      }
      publish = p;
    } else if (isCloud && author.indexOf('author-') !== -1) {
      // Auto-derive publish only for Cloud author URLs
      publish = author.replace('author-', 'publish-');
    }

    const current = await getEnvironments();
    const newEnv = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      name: name,
      authorUrl: author,
      publishUrl: publish,
      isCloud: isCloud,
      tier: isCloud ? envTierSelect.value : undefined,
      customLinks: pendingCustomLinks.map(function(l) {
        return {
          id: Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
          label: l.label,
          url: l.url
        };
      })
    };
    current.push(newEnv);
    await saveEnvironments(current);
    hideAddForm();
    renderEnvironments();
  }

  // ============================================================
  //  DETECT ACTIVE TAB
  // ============================================================
  function detectActiveTabEnvironment() {
    if (!chrome.tabs || !chrome.tabs.query) return;

    chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) return;

      let origin;
      try {
        origin = new URL(tab.url).origin;
      } catch (_) {
        return;
      }

      const detected = validateAndNormalizeUrl(origin);
      if (!detected) return;

      const envs = await getEnvironments();
      const alreadySaved = envs.some(function(env) {
        return env.authorUrl === detected || env.publishUrl === detected;
      });
      if (alreadySaved) return;

      detectHost.textContent = detected;
      detectBanner.classList.remove('hidden');

      detectAddBtn.onclick = function() {
        detectBanner.classList.add('hidden');
        showAddForm({
          authorUrl: detected,
          isCloud: detected.indexOf('adobeaemcloud.com') !== -1
        });
      };
    });
  }

  // ============================================================
  //  AI: GENERATE COMPONENT
  // ============================================================
  let isGenerating = false;
  let abortController = null;

  async function handleAIGenerate() {
    if (isGenerating) return;

    const prompt = aiPrompt.value.trim();
    if (!prompt) {
      aiStatus.textContent = 'Please describe the component you need.';
      return;
    }

    const config = await getAIConfig();
    if (!config.apiKey) {
      aiOutput.textContent = '❌ API key not configured. Click "Options" above to set it.';
      aiStatus.textContent = '';
      return;
    }

    isGenerating = true;
    aiGenerateBtn.disabled = true;
    aiGenerateBtn.textContent = '⏳ Generating...';
    aiStatus.textContent = 'Calling AI...';
    aiOutput.textContent = '';

    abortController = new AbortController();
    const timeoutId = setTimeout(function() {
      if (abortController) {
        abortController.abort();
      }
    }, 60000);

    try {
      const result = await callAIProvider(config, prompt, abortController.signal);
      clearTimeout(timeoutId);
      displayAIResult(result);
      aiStatus.textContent = '✓ Done';
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        aiStatus.textContent = '⏱ Request timed out. Please try again.';
        aiOutput.textContent = 'Request timed out after 60 seconds.';
      } else {
        aiStatus.textContent = '❌ ' + (err.message || 'Unknown error');
        aiOutput.textContent = 'Error: ' + (err.message || 'Unknown error');
      }
    } finally {
      isGenerating = false;
      aiGenerateBtn.disabled = false;
      aiGenerateBtn.textContent = '⚡ Generate Component Code';
      abortController = null;
    }
  }

  function getDefaultModel(provider) {
    const defaults = {
      openai: 'gpt-3.5-turbo',
      deepseek: 'deepseek-chat',
      gemini: 'gemini-1.5-flash'
    };
    return defaults[provider] || 'gpt-3.5-turbo';
  }

  async function callAIProvider(config, prompt, signal) {
    const provider = config.provider || 'openai';
    const apiKey = config.apiKey;
    const model = config.model || getDefaultModel(provider);

    const systemPrompt = 'You are an expert AEM (Adobe Experience Manager) developer.\n' +
      'Generate a complete component blueprint based on the user\'s description.\n' +
      'Return ONLY valid JSON with these keys:\n' +
      '- "componentName": a short name for the component\n' +
      '- "assumptions": an array of assumptions you made\n' +
      '- "htl": the HTML/Sightly code\n' +
      '- "dialog": the .content.xml dialog structure (XML)\n' +
      '- "slingModel": the Java Sling Model code (or "N/A" if not applicable)\n' +
      '- "warnings": any important warnings\n' +
      'Keep it concise and appropriate for AEM as a Cloud Service.\n' +
      'Use Core Components patterns where applicable.\n' +
      'Do not assume every component needs a Sling Model.';

    let endpoint, body, headers;

    if (provider === 'openai') {
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
      body = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Component description: ' + prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      };
    } else if (provider === 'deepseek') {
      endpoint = 'https://api.deepseek.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
      body = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Component description: ' + prompt }
        ],
        temperature: 0.3
      };
    } else if (provider === 'gemini') {
      endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
      headers = {
        'Content-Type': 'application/json'
      };
      body = {
        contents: [{
          parts: [{
            text: systemPrompt + '\n\nUser description: ' + prompt + '\n\nReturn ONLY valid JSON.'
          }]
        }]
      };
    } else {
      throw new Error('Unsupported AI provider: ' + provider);
    }

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: signal
      });
    } catch (netErr) {
      if (netErr.name === 'AbortError') throw netErr;
      throw new Error('Unable to reach the AI provider.');
    }

    if (!response.ok) {
      let errorMsg = 'HTTP ' + response.status;
      if (response.status === 401 || response.status === 403) {
        errorMsg = 'Authentication failed. Check your API key.';
      } else if (response.status === 429) {
        errorMsg = 'Rate limit reached. Try again later.';
      } else if (response.status === 404) {
        errorMsg = 'The selected model is unavailable.';
      } else if (response.status >= 500) {
        errorMsg = 'The AI provider is experiencing issues. Try again later.';
      }
      throw new Error(errorMsg);
    }

    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw new Error('Malformed response from AI provider.');
    }

    let content = '';
    if (provider === 'gemini') {
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const parts = data.candidates[0].content.parts || [];
        content = parts.map(function(p) { return p.text || ''; }).join('');
      } else {
        throw new Error('Malformed Gemini response.');
      }
    } else {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        content = data.choices[0].message.content || '';
      } else {
        throw new Error('Malformed response from AI provider.');
      }
    }

    // Parse the JSON content robustly
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      // Fallback: extract the outermost JSON object using brace balancing
      const extracted = extractJsonObject(content);
      if (extracted) {
        try {
          parsed = JSON.parse(extracted);
        } catch (_2) {
          throw new Error('The AI returned invalid JSON. Please try again.');
        }
      } else {
        throw new Error('The AI returned invalid JSON. Please try again.');
      }
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('The AI returned an invalid component response.');
    }

    // Coerce string fields
    const stringFields = ['htl', 'dialog', 'slingModel', 'componentName'];
    for (const field of stringFields) {
      if (parsed[field] !== undefined && typeof parsed[field] !== 'string') {
        parsed[field] = String(parsed[field]);
      }
    }
    if (parsed.assumptions !== undefined && !Array.isArray(parsed.assumptions)) {
      parsed.assumptions = [];
    }
    if (parsed.warnings !== undefined && !Array.isArray(parsed.warnings)) {
      parsed.warnings = [];
    }

    return parsed;
  }

  // Extract the first balanced {...} object from a string.
  // Handles nested braces and braces inside strings correctly.
  function extractJsonObject(text) {
    if (!text) return null;
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\') {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }

    return null;
  }

  function displayAIResult(result) {
    let output = '';
    if (result.componentName) {
      output += '📦 ' + result.componentName + '\n';
      output += '='.repeat(result.componentName.length + 2) + '\n\n';
    }
    if (result.assumptions && result.assumptions.length > 0) {
      output += '📌 Assumptions:\n';
      for (const a of result.assumptions) {
        output += '  • ' + a + '\n';
      }
      output += '\n';
    }
    if (result.warnings && result.warnings.length > 0) {
      output += '⚠️ Warnings:\n';
      for (const w of result.warnings) {
        output += '  • ' + w + '\n';
      }
      output += '\n';
    }
    if (result.htl) {
      output += '=== HTL ===\n' + result.htl + '\n\n';
    }
    if (result.dialog) {
      output += '=== DIALOG (content.xml) ===\n' + result.dialog + '\n\n';
    }
    if (result.slingModel && result.slingModel !== 'N/A') {
      output += '=== SLING MODEL ===\n' + result.slingModel;
    } else if (result.slingModel === 'N/A') {
      output += 'No Sling Model required.';
    }
    aiOutput.textContent = output || 'No content generated.';
  }

  // ============================================================
  //  TAB SWITCHING
  // ============================================================
  function setupTabs() {
    const tabs = document.querySelectorAll('[role="tab"]');
    const panels = {
      envs: document.getElementById('panel-envs'),
      ai: document.getElementById('panel-ai')
    };

    for (const tab of tabs) {
      tab.addEventListener('click', function() {
        const target = tab.dataset.tab;
        for (const t of tabs) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        }
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        for (const key of Object.keys(panels)) {
          if (key === target) {
            panels[key].classList.add('active');
          } else {
            panels[key].classList.remove('active');
          }
        }
      });
    }
  }

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    setupTabs();
    await renderEnvironments();
    detectActiveTabEnvironment();

    showAddBtn.addEventListener('click', function() { showAddForm(); });
    cancelAddBtn.addEventListener('click', hideAddForm);
    saveEnvBtn.addEventListener('click', handleSaveEnv);
    envSearchInput.addEventListener('input', renderEnvironments);
    detectDismissBtn.addEventListener('click', function() {
      detectBanner.classList.add('hidden');
    });
    envIsCloudInput.addEventListener('change', function() {
      envTierRow.classList.toggle('hidden', !envIsCloudInput.checked);
    });

    aiGenerateBtn.addEventListener('click', handleAIGenerate);
    aiSettingsLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    });

    envAuthorInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveEnv();
      }
    });
    envNameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        envAuthorInput.focus();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();