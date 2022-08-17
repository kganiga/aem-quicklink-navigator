$(document).ready(function () {
  const _UNDERSCORE = "_";
  const _EMPTY = "";
  const _PIPE = "|";
  $(".form-container").hide();
  const constructAccordion = (valArr) => {
    var accordian = `<h3>${valArr[0]}</h3>
                            <div>                          
                            <div class="dcf-overflow-x-auto" tabindex="0">
                            <table class="dcf-table dcf-table-bordered dcf-w-100%">
                              <tbody>
                                <tr>
                                  <th scope="row">Environment Details</th>
                                  <td data-label="Environment Details"><a href="${valArr[1]}" target="_blank">${valArr[1]}</a></td>
                                  <td data-label="Environment Details"><span> ${valArr[2]}</span></td>
                                  <td data-label="Environment Details" class="pwd"><span id="pwd-masked">******</span><span id="pwd-val">${valArr[3]}</span></td>
                                </tr>
                                <tr>
                                  <th scope="row">Consoles</th>
                                  <td data-label="Consoles"><a href=${valArr[1]}/libs/granite/core/content/login.html target="_blank">Welcome</a></td>
                                  <td data-label="Consoles"><a href=${valArr[1]}/crx/de/index.jsp target="_blank">CRXDE</a></td>
                                  <td data-label="Consoles"><a href=${valArr[1]}/crx/packmgr/index.jsp target="_blank">Package Manager</a></td>
                                </tr>
                                <tr>
                                  <th scope="row">DAM &amp; Sites</th>
                                  <td data-label="DAM & Sites"><a href=${valArr[1]}/assets.html/content/dam target="_blank">Assets</a></td>
                                  <td data-label="DAM & Sites"><a href=${valArr[1]}/sites.html/content target="_blank">Sites</a></td>
                                  <td data-label="DAM & Sites"><a href=${valArr[1]}/libs/wcm/core/content/sites/templates.html/conf target="_blank">Templates</a></td>
                                </tr>
                                <tr>
                                  <th scope="row" rowspan="2">Felix Console</th>
                                  <td data-label="Felix Console"><a href=${valArr[1]}/system/console/bundles target="_blank">Bundles</a></td>
                                  <td data-label="Felix Console"><a href=${valArr[1]}/system/console/configMgr target="_blank">Config Manager </a></td>
                                  <td data-label="Felix Console"><a href=${valArr[1]}/system/console/status-slinglogs target="_blank">Logs</a></td>
                                </tr>
                                <tr>
                                <td data-label="Felix Console" colspan="2"><a href=${valArr[1]}/system/console/requests target="_blank">Recent Requests</a></td>
                                
                                </tr
                                <tr>
                                  <th scope="row" rowspan="2">Miscellaneous</th>
                                  <td data-label="Miscellaneous"><a href=${valArr[1]}/libs/granite/ui/content/dumplibs.rebuild.html target="_blank">Rebuild Client Libraries</a></td>
                                  <td data-label="Miscellaneous"><a href=${valArr[1]}/libs/cq/search/content/querydebug.html target="_blank">Querybuilder</a></td>
                                  <td data-label="Miscellaneous"><a href=${valArr[1]}/libs/cq/workflow/admin/console/content/models.html target="_blank">Workflows</a></td>
                                </tr>
                                <tr>                                  
                                  <td><a href=${valArr[1]}/useradmin target="_blank">User Admin</a></td>
                                  <td><a href=${valArr[1]}/miscadmin target="_blank">Miscadmin</a></td>
                                  <td><a href=${valArr[1]}/aem/tags target="_blank">Tag Manager</a></td>
                                </tr>
                              </tbody>
                            </table></div>
                      
                            <button class="button-12 del-env" role="button" id="_${valArr[0]}" >Remove Environment</button>
                            </div>
                           `;
    $(".accordion-container").append(accordian);
  };

  // const setDefaultEnvironments = () => {
  //   chrome.storage.sync.get("_author", function (data) {
  //     if (typeof data._author === "undefined") {
  //       chrome.storage.sync.set({
  //         _author: "http://localhost:4502|admin|admin",
  //       });
  //     } else {
  //       console.log(data._author);
  //     }
  //   });
  // };
  //  setDefaultEnvironments();
  const generateAccordians = () => {
    $(".accordion-container").empty();
    chrome.storage.sync.get((all) => {
      for (const [key, val] of Object.entries(all)) {
        console.log(key, val);
        if (key.startsWith(_UNDERSCORE)) {
          var accordianValues = val.split(_PIPE);
          accordianValues.unshift(key.substring(1, key.length));
          constructAccordion(accordianValues);
        }
      }
      $(".accordion-container").accordion({
        collapsible: true,
        heightStyle: "content",
      });
    });
  };
  const formatLocalStorageData = () => {
    return `${$("#env-url").val()}${_PIPE}${$(
      "#env-username"
    ).val()}${_PIPE}${$("#env-password").val()}`;
  };

  const addDetailsToLocalStorage = () => {
    $("form p").css("display", "none");
    $(".add-env").show();
    $(".form-container").hide();
    $(".accordion-container").show();
    localStorage.setItem(`_${$("#env-title").val()}`, formatLocalStorageData());
    let envKey = `_${$("#env-title").val().toLowerCase()}`;
    chrome.storage.sync.set({
      [envKey]: formatLocalStorageData(),
    });
    window.location.reload();
  };

  const checkIfFieldIsEmpty = (field) => {
    return $(field).val() == _EMPTY;
  };

  generateAccordians();

  $("form input[type=button]").click(() => {
    var inputFields = document.querySelectorAll("form input[type=text]");
    const fieldCount = inputFields.length;
    var validateCount = 0;
    [...inputFields].forEach((ipField) => {
      checkIfFieldIsEmpty(ipField) ? null : validateCount++;
    });
    fieldCount != validateCount
      ? $("form p").css("display", "block")
      : addDetailsToLocalStorage();
  });

  $(".accordion-container").on("click", ".del-env", function (e) {
    e.preventDefault();
    console.log($(this).attr("id"));
    chrome.storage.sync.remove(`${e.target.id}`);
    window.location.reload();
  });

  $(".cancel-form").click((e) => {
    e.preventDefault();
    $(".form-container").css("display", "none");
    $(".add-env").show();
    $(".accordion-container").show();
  }),
    $("#add-env").click((e) => {
      e.preventDefault();
      $(".form-container").show();
      $(".add-env").hide();
      $(".accordion-container").hide();
    });
});
