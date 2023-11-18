$(document).ready(function () {
  document.getElementById("copyright-year").textContent =
    new Date().getFullYear();
  const _UNDERSCORE = "_";
  const _PIPE = "|";
  const formContainer = $(".form-container");
  const accordionContainer = $(".accordion-container");

  const constructAccordion = (valArr) => {
    const targetAttribute = 'target="_blank"';
    return `<h3>${valArr[0]}</h3>
      <div>
        <div class="dcf-overflow-x-auto" tabindex="0">
          <table class="dcf-table dcf-table-bordered dcf-w-100%">
            <tbody>
            <tr>
            <th scope="row">Environment Details</th>
            <td data-label="Environment Details"><a href="${valArr[1]}" ${targetAttribute}>${valArr[1]}</a></td>
            <td data-label="Environment Details" class="userName"><span> ${valArr[2]}</span></td>
            <td data-label="Environment Details" class="pwd"><span id="pwd-masked">******</span><span id="pwd-val">${valArr[3]}</span></td>
          </tr>
          <tr>
            <th scope="row">Consoles</th>
            <td data-label="Consoles"><a href=${valArr[1]}/libs/granite/core/content/login.html ${targetAttribute}>Welcome</a></td>
            <td data-label="Consoles"><a href=${valArr[1]}/crx/de/index.jsp ${targetAttribute}>CRXDE</a></td>
            <td data-label="Consoles"><a href=${valArr[1]}/crx/packmgr/index.jsp ${targetAttribute}>Package Manager</a></td>
          </tr>
          <tr>
            <th scope="row">DAM &amp; Sites</th>
            <td data-label="DAM & Sites"><a href=${valArr[1]}/assets.html/content/dam ${targetAttribute}>Assets</a></td>
            <td data-label="DAM & Sites"><a href=${valArr[1]}/sites.html/content ${targetAttribute}>Sites</a></td>
            <td data-label="DAM & Sites"><a href=${valArr[1]}/libs/wcm/core/content/sites/templates.html/conf ${targetAttribute}>Templates</a></td>
          </tr>
          <tr>
            <th scope="row" rowspan="2">Felix Console</th>
            <td data-label="Felix Console"><a href=${valArr[1]}/system/console/bundles ${targetAttribute}>Bundles</a></td>
            <td data-label="Felix Console"><a href=${valArr[1]}/system/console/configMgr ${targetAttribute}>Config Manager </a></td>
            <td data-label="Felix Console"><a href=${valArr[1]}/system/console/status-slinglogs ${targetAttribute}>Logs</a></td>
          </tr>
          <tr>
          <td data-label="Felix Console" colspan="2"><a href=${valArr[1]}/system/console/requests ${targetAttribute}>Recent Requests</a></td>
          
          </tr
          <tr>
            <th scope="row" rowspan="2">Miscellaneous</th>
            <td data-label="Miscellaneous"><a href=${valArr[1]}/libs/granite/ui/content/dumplibs.rebuild.html ${targetAttribute}>Rebuild Client Libraries</a></td>
            <td data-label="Miscellaneous"><a href=${valArr[1]}/libs/cq/search/content/querydebug.html ${targetAttribute}>Querybuilder</a></td>
            <td data-label="Miscellaneous"><a href=${valArr[1]}/libs/cq/workflow/admin/console/content/models.html ${targetAttribute}>Workflows</a></td>
          </tr>
          <tr>                                  
            <td><a href=${valArr[1]}/useradmin ${targetAttribute}>User Admin</a></td>
            <td><a href=${valArr[1]}/miscadmin ${targetAttribute}>Miscadmin</a></td>
            <td><a href=${valArr[1]}/aem/tags ${targetAttribute}>Tag Manager</a></td>
          </tr>
          <tr>
            <td colspan="4"><button class="button-12 del-env" role="button" id="_${valArr[0]}">Remove Environment</button></td>
          </tr>
            </tbody>
          </table>
        </div>
        
      </div>`;
  };

  const generateAccordionsFromChromeStorage = () => {
    chrome.storage.sync.get(null, (all) => {
      const accordions = Object.entries(all)
        .filter(([key, val]) => key.startsWith(_UNDERSCORE))
        .map(([key, val]) => {
          const accordianValues = val.split(_PIPE);
          accordianValues.unshift(key.substring(1, key.length));
          return constructAccordion(accordianValues);
        });
      if (accordionContainer.hasClass("ui-accordion")) {
        accordionContainer.accordion("destroy");
      }

      accordionContainer.html(accordions.join(""));

      accordionContainer.accordion({
        collapsible: true,
        heightStyle: "auto",
      });
    });
  };

  const formatLocalStorageData = () => {
    const envUrl = $("#env-url").val();
    const envUsername = $("#env-username").val();
    const envPassword = $("#env-password").val();
    return `${envUrl}${_PIPE}${envUsername}${_PIPE}${envPassword}`;
  };

  const addDetailsToChromeStorage = () => {
    formContainer.find("p").hide();
    formContainer.find(".add-env").show();
    formContainer.hide();
    accordionContainer.show();
    const envTitle = $("#env-title").val().toLowerCase();
    const envKey = `_${envTitle}`;
    const storageData = { [envKey]: formatLocalStorageData() };
    chrome.storage.sync.set(storageData, () => {
      generateAccordionsFromChromeStorage();
    });
    console.log(storageData);
  };

  formContainer.hide();
  formContainer.find(".add-env").show();
  accordionContainer.show();

  $("#submit").click(function (e) {
    e.preventDefault();
    if (
      $("#env-title").val() === "" ||
      $("#env-url").val() === "" ||
      $("#env-username").val() === "" ||
      $("#env-password").val() === ""
    ) {
      $("#error-message").show();
    } else {
      $("#error-message").hide();
      addDetailsToChromeStorage();
    }
  });

  accordionContainer.on("click", ".del-env", function (e) {
    e.preventDefault();
    const envKey = `${e.target.id}`;
    chrome.storage.sync.remove(envKey, () => {
      window.location.reload();
    });
  });

  formContainer.find(".cancel-form").click((e) => {
    e.preventDefault();
    formContainer.hide();
    formContainer.find(".add-env").show();
    accordionContainer.show();
    $(".add-env").show();
  });

  $("#add-env").click((e) => {
    e.preventDefault();
    formContainer.show();
    formContainer.find(".add-env").hide();
    accordionContainer.hide();
    $(".add-env").hide();
  });

  generateAccordionsFromChromeStorage();

  const copyToClipboard = (text) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  accordionContainer.on(
    "mouseover",
    "td.pwd span, td.userName span",
    function () {
      $(this).css("cursor", "pointer");
    }
  );

  accordionContainer.on("click", "td.pwd span", function () {
    const password = $(this).text();
    copyToClipboard(password);
    alert("Password copied to clipboard!");
  });

  accordionContainer.on("click", "td.userName span", function () {
    const username = $(this).text();
    copyToClipboard(username);
    alert("Username copied to clipboard!");
  });
});
