// ==UserScript==
// @name         EH – Page Scrobbler
// @namespace    https://github.com/Meldo-Megimi/EH-Page-Scrobbler/raw/main/PageScrobbler.user.js
// @version      2022.11.08.03
// @description  Visualize GID and add the ability to easily jump or scrobble
// @author       FabulousCupcake, OsenTen, Qserty, Meldo-Megimi
// @license      MIT
// @run-at       document-end
// @match        http://e-hentai.org/*
// @match        https://e-hentai.org/*
// @match        http://exhentai.org/*
// @match        https://exhentai.org/*
// @match        http://exhentai55ld2wyap5juskbm67czulomrouspdacjamjeloj7ugjbsad.onion/*
// @grant        GM_addStyle
// ==/UserScript==

const stylesheet = `
.search-scrobbler {
  width: 730px;
  outline: 1px cyan dashed;
  margin: 0 auto;
  padding: 20px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.search-scrobbler .bar {
  display: block;
  width: 730px;
  height: 25px;
  border: 2px solid #3c3c3c;
  box-sizing: border-box;
  position: relative;
}
.search-scrobbler .bar .bar-cursor {
  height: 100%;
  background: #5FA9CF;
}
.search-scrobbler .bar-wrapper {
  display: flex;
  flex-direction: column;
}
.search-scrobbler .bar-labels {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.search-scrobbler .bar-hover {
  display: block;
  width: 1px;
  height: 100%;
  background: #f0f;
  position: absolute;
}
.search-scrobbler .bar-hovertext {
  position: absolute;
  outline: 1px solid #f0f;
  top: -1.5em;
}
.search-scrobbler,
.search-scrobbler * {
  outline: 0px none !important;
}
.bar-year-labels {
  position:absolute;
  width:inherit;
  opacity:50%;
  pointer-events: none;
}
.bar-year-label {
  position:absolute;
}

.saved-search {
  width: 730px;
  margin: 0 auto;
}

.search-relpager {
  width: 730px;
  margin: 0px auto 0px auto;
  text-align: center;
}
`;

const gidYear = {
    74629:2008,
    190496:2009,
    321076:2010,
    449183:2011,
    553117:2012,
    660230:2013,
    771830:2014,
    888870:2015,
    1012224:2016,
    1162942:2017,
    1338484:2018,
    1543397:2019,
    1813647:2020,
    2100270:2021
};

const injectStylesheet = () => {
    if (typeof GM_addStyle != "undefined") {
        GM_addStyle(stylesheet);
    } else if (typeof addStyle != "undefined") {
        addStyle(stylesheet);
    } else {
        const stylesheetEl = document.createElement("style");
        stylesheetEl.innerHTML = stylesheet;
        document.body.appendChild(stylesheetEl);
    }
}

const hasGalleryListTable = () => {
    return !!document.querySelector(".itg.gltm, .itg.gltc, .itg.glte, .itg.gld");
}

const getMaxGID = doc => {
    let maxGID = 0;

    if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
        maxGID = doc.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1];
    } else if (!!doc.querySelector(".itg tr a")) { // Extended
        maxGID = doc.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1];
    } else { // Thumbnail
        maxGID = doc.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1];
    }

    return maxGID;
}

const tryUpdateKnownMaxGID = GID => {
    if (localStorage.getItem("EHPS-maxGID") === null) {localStorage.setItem("EHPS-maxGID", -1)}

    const url = new URL(location.href);
    if ((url.pathname !== "/") || (url.search !== "")) {
        if (url.pathname == "/popular") return;

        // not on frontpage or searching
        fetch(location.origin, {
            method: 'get'
        }).then((response) => {
            return response.text()
        }).then((res) => {
            let dom = document.implementation.createHTMLDocument("New Document");
            dom.write(res);
            dom.close();

            let maxGID = getMaxGID(dom);
            let currentMaxGID = localStorage.getItem("EHPS-maxGID");
            if ((currentMaxGID === null) || (currentMaxGID < maxGID)) {
                localStorage.setItem("EHPS-maxGID", maxGID);
            }

            updatePageScrobbler();
        }).catch((error) => {
            console.log(error)
        });

    } else {
        // we are on the frontpage
        let maxGID = getMaxGID(document);
        let currentMaxGID = localStorage.getItem("EHPS-maxGID");
        if ((currentMaxGID === null) || (currentMaxGID < maxGID)) {
            localStorage.setItem("EHPS-maxGID", maxGID);
        }
    }
}

const resetPageCounter = () => {
    localStorage.setItem("EHPS-page", 0);
    localStorage.removeItem("EHPS-pages", 0);
    localStorage.removeItem("EHPS-page-endlow");
    localStorage.removeItem("EHPS-page-endhigh");
}

const addPageScrobbler = () => {
    const url = new URL(location.href);
    if (url.pathname == "/popular") return;

    const addInitialElement = () => {
        const hook = document.querySelector(".searchnav");

        if (!document.querySelector(".search-scrobbler")) {
            hook.insertAdjacentHTML("beforebegin", `<div class="search-scrobbler"></div>`);
        }

        if (!document.querySelector(".saved-search")) {
            hook.insertAdjacentHTML("beforebegin", `
<div class="saved-search">
  <input class="search-save-button" id="search-save-button" type="button" value="Save"></input>
  <label class="search-list">Saved searches:</label>
  <select class="search-list" id="search-select">
  </select>
  <input class="search-load-button" id="search-load-button" type="button" value="Load"></input>
  <input class="search-load-button" id="search-delete-button" type="button" value="Remove"></input>
  <span id="current_bookmark"></span>&nbsp&nbsp&nbsp<span id="save_load_text"></span>
</div>`);
        }

        if (!document.querySelector(".search-relpager")) {
            hook.insertAdjacentHTML("afterend", `<div class="search-relpager"><span class="search-relpager-num"></span</div>`);
        }

        updatePageScrobbler();
    }

    const addEventListeners = () => {
        var saveButton = document.getElementById("search-save-button");
        saveButton.addEventListener("click", function () {
            let searchParams = new URLSearchParams(window.location.search);
            if (searchParams.has('f_search')) {
                let f_search = searchParams.get('f_search');
                if (searchParams.has('next')) {
                    let next = searchParams.get('next');
                    localStorage.setItem(f_search, "&next=" + next);
                    document.getElementById('save_load_text').innerHTML = "Saved (next) GID " + next + " for search " + f_search;
                    document.getElementById('current_bookmark').innerHTML = "Bookmark: " + next + "  ";

                    showBookmark();
                } else if (searchParams.has('prev')) {
                    let prev = searchParams.get('prev');
                    localStorage.setItem(f_search, "&prev=" + prev);
                    document.getElementById('save_load_text').innerHTML = "Saved (prev) GID " + prev + " for search " + f_search;
                    document.getElementById('current_bookmark').innerHTML = "Bookmark: " + prev + "  ";

                    showBookmark();
                } else {
                    let next;
                    if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
                        next = document.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1];
                    } else if (!!document.querySelector(".itg tr a")) { // Extended
                        next = document.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1];
                    } else { // Thumbnail
                        next = document.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1];
                    }
                    localStorage.setItem(f_search, "&next=" + (parseInt(next,10)+1));

                    showBookmark();
                }
            }
        }, false);

        var loadButton = document.getElementById("search-load-button");
        loadButton.addEventListener("click", function () {
            let searchSelect = decodeURIComponent(document.getElementById('search-select').value);
            if (searchSelect != null) {
                let gid = localStorage.getItem(searchSelect);
                if (gid) {
                    const parser = new URL(window.location);
                    parser.searchParams.delete("next");
                    parser.searchParams.delete("prev");
                    parser.searchParams.delete("f_search");
                    resetPageCounter();
                    window.location = parser.href + "?f_search=" + encodeURIComponent(searchSelect) + gid;
                } else {
                    document.getElementById('save_load_text').innerHTML = "Nothing to load";
                }
            }
        }, false);

        var deleteButton = document.getElementById("search-delete-button");
        deleteButton.addEventListener("click", function () {
            let searchSelect = decodeURIComponent(document.getElementById('search-select').value);
            if (searchSelect != null) {
                let gid = localStorage.getItem(searchSelect);
                if (gid) {
                    localStorage.removeItem(searchSelect);
                    showBookmark();
                }
            }
        }, false);
    }

    addInitialElement();
    addEventListeners();
}

const updatePageScrobbler = () => {
    const updateInitialElement = () => {
        let maxGID = localStorage.getItem("EHPS-maxGID");
        let firstGID = maxGID, lastGID = 1;
        if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
            firstGID = parseInt(document.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1],10);
            lastGID = parseInt(document.querySelector(".itg tr:last-child .glname a").href.match(/\/(\d+)\//)?.[1],10);
        } else if (!!document.querySelector(".itg tr a")) { // Extended
            firstGID = parseInt(document.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1],10);
            lastGID = parseInt(document.querySelector(".itg tr:last-child a").href.match(/\/(\d+)\//)?.[1],10);
        } else if (!!document.querySelector(".itg .gl1t a")) { // Thumbnail
            firstGID = parseInt(document.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1],10);
            lastGID = parseInt(document.querySelector(".itg .gl1t:last-child a").href.match(/\/(\d+)\//)?.[1],10);
        } else {
            return;
        }

        if (maxGID < firstGID) {
            maxGID = firstGID;
            localStorage.setItem("EHPS-maxGID", maxGID);
        }

        const cursorLeftMargin = (1.0 - firstGID / maxGID) * 100;
        let cursorWidth = ((firstGID - lastGID) / maxGID) * 100;
        if (cursorWidth < 0.2) cursorWidth = 0.2;

        let yearDiv = ``;
        for (var key in gidYear) {
            yearDiv += `<div class="bar-year-label" style="left: ${(1.0 - key / maxGID) * 100}% ">|${gidYear[key]}</div>`;
        }

        document.querySelector(".search-scrobbler").innerHTML = `
  <div class="bar-wrapper bar-full">
    <div class="bar">
      <div class="bar-cursor" style="width: ${cursorWidth}%; margin-left: ${cursorLeftMargin}% ">
        <div class="bar-hovertext">${firstGID}</div>
      </div>
    </div>
    <div class="bar-labels">
      <div class="bar-max">${maxGID}</div>
      <div class="bar-min">1</div>
    </div>
  </div>
  <div class="bar-year-labels">
${yearDiv}
  </div>`;
    }

    const addEventListeners = () => {
        const addHoverElement = offset => {
            if (offset < 2) return;
            document.querySelector(".bar-hover")?.remove();

            const maxGID = localStorage.getItem("EHPS-maxGID");
            const width = 730;
            const hoverGID = ((1.0 - offset / 730) * maxGID).toFixed(0);

            const url = new URL(location.href);
            url.searchParams.set("next", hoverGID);

            const hook = document.querySelector(".bar-full .bar");
            const el = `
<a class="bar-hover" href="${url}" style="left: ${offset - 2}px; width: 2px">
  <div class="bar-hovertext">${hoverGID}</div>
</a>`;
            hook.insertAdjacentHTML("afterbegin", el);
        }

        const handler = e => {
            addHoverElement(e.layerX);

            document.querySelector(".bar-hover").addEventListener("click", function (ev) {
                resetPageCounter();
            }, false);
        }

        const el = document.querySelector(".bar-full .bar");
        if (el !== null) el.addEventListener("mousemove", handler);
    }

    updateInitialElement();
    addEventListeners();
}

const showBookmark = GID => {
    const url = new URL(location.href);
    if (url.pathname == "/popular") return;

    let searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('f_search')) {
        let gid = localStorage.getItem(searchParams.get('f_search'));
        if (gid) {
            document.getElementById('current_bookmark').innerHTML = "Bookmark: " + gid;
        } else {
            document.getElementById('current_bookmark').innerHTML = "No bookmark found for this search.";
        }
        document.querySelectorAll('.search-save-button').forEach(function(key){key.style.display='';});
    } else {
        document.querySelectorAll('.search-save-button').forEach(function(key){key.style.display='none';});
    }

    if (localStorage.length > 1)
    {
        let f_search = searchParams.get('f_search');
        let searchSelect = document.getElementById('search-select');
        searchSelect.options.length=0
        Object.keys(localStorage).forEach(function(key){
            let value = localStorage.getItem(key);
            if (value.startsWith("&next") || value.startsWith("&prev")) {
                let opt = document.createElement('option');
                opt.text = key;
                opt.value = encodeURIComponent(key);
                if (key == f_search) {
                    opt.selected = true;
                }

                searchSelect.add(opt);
            }
        });

        if (searchSelect.options.length !== 0) {
            document.querySelectorAll('.search-list').forEach(function(key){key.style.display='';});
            document.querySelectorAll('.search-load-button').forEach(function(key){key.style.display='';});
        } else {
            document.querySelectorAll('.search-list').forEach(function(key){key.style.display='none';});
            document.querySelectorAll('.search-load-button').forEach(function(key){key.style.display='none';});
        }
    } else {
        document.querySelectorAll('.search-list').forEach(function(key){key.style.display='none';});
        document.querySelectorAll('.search-load-button').forEach(function(key){key.style.display='none';});
    }
}

const addPageCounter = () => {
    if (localStorage.getItem("EHPS-page") === null) resetPageCounter();
    if (document.querySelector(".search-relpager-num") === null) return;

    const currPage = parseInt(localStorage.getItem("EHPS-page"));

    if (document.querySelector(".searchnav #uprev").localName === "span") localStorage.setItem("EHPS-page-endlow", currPage);
    if (document.querySelector(".searchnav #unext").localName === "span") localStorage.setItem("EHPS-page-endhigh", currPage);

    let knownPages = {"min":0,"max":0};
    if (localStorage.getItem("EHPS-pages") != null) knownPages = JSON.parse(localStorage.getItem("EHPS-pages"));

    if (knownPages[`P${currPage}`] == null) {
        if (window.location.search != "") {
            knownPages[`P${currPage}`] = ` ${window.location.search}`;
        } else {
            let maxGID = parseInt(getMaxGID(document), 10) + 1;
            knownPages[`P${currPage}`] = ` ?next=${maxGID}`;
        }

        if (parseInt(knownPages.min) > currPage) knownPages.min = currPage;
        if (parseInt(knownPages.max) < currPage) knownPages.max = currPage;

        localStorage.setItem("EHPS-pages", JSON.stringify(knownPages));
    }

    let pages = "";
    if (localStorage.getItem("EHPS-page-endlow") == null) pages += "<td>?</td>";

    let knownCount = parseInt(knownPages.max) - parseInt(knownPages.min);
    let kl = currPage - parseInt(knownPages.min);
    let ku = parseInt(knownPages.max) - currPage;
    let hidelow = parseInt(knownPages.max) + 1, hidehigh = parseInt(knownPages.min) - 1;

    if (knownCount > 10)
    {
        if (kl > ku) {
            hidelow = parseInt(knownPages.min) + 1;
            hidehigh= hidelow + (knownCount - 10);
        } else {
            hidehigh= parseInt(knownPages.max) - 1;
            hidelow = hidehigh - (knownCount - 10);
        }
    }

    for (let i = parseInt(knownPages.min); i <= parseInt(knownPages.max); i++) {
        if ((i >= hidelow) && (i <= hidehigh)) {
            if (i == hidelow) pages += `<td><a>...</a></td>`;
        } else {
            if (i == currPage) {
                pages += `<td class="ptds" onclick="document.location=this.firstChild.href"><a>${i}</a></td>`;
            } else {
                const parser = new URL(window.location);
                parser.searchParams.delete("prev");
                parser.searchParams.set("next", knownPages[`P${i}`]);

                pages += `<td onclick="document.location=this.firstChild.href"><a href=${knownPages[`P${i}`]}>${i}</a></td>`;
            }
        }
    }

    if (localStorage.getItem("EHPS-page-endhigh") == null) pages += "<td>?</td>";

    document.querySelector(".search-relpager-num").innerHTML = `
  <table class="ptt" style="margin:2px auto 0px">
    <tbody>
      <tr>${pages}</tr>
    </tbody>
  </table>
    `;

    // page buttons
    document.querySelectorAll('.search-relpager-num td').forEach(function(nav){
        nav.addEventListener("click", function (ev) {
            if ((ev.target.innerText != "?") && (ev.target.innerText != "...")) localStorage.setItem("EHPS-page", ev.target.innerText)
        }, false);
    });

    // jump buttons
    document.querySelector(".searchnav #uprev").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        if ((new URLSearchParams(ev.target.href)).has("jump")) {
            resetPageCounter();
        } else {
            localStorage.setItem("EHPS-page", parseInt(localStorage.getItem("EHPS-page")) - 1);
        }
    }, false);

    document.querySelector(".searchnav #dprev").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        if ((new URLSearchParams(ev.target.href)).has("jump")) {
            resetPageCounter();
        } else {
            localStorage.setItem("EHPS-page", parseInt(localStorage.getItem("EHPS-page")) - 1);
        }
    }, false);

    document.querySelector(".searchnav #unext").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        if ((new URLSearchParams(ev.target.href)).has("jump")) {
            resetPageCounter();
        } else {
            localStorage.setItem("EHPS-page", parseInt(localStorage.getItem("EHPS-page")) + 1);
        }
    }, false);

    document.querySelector(".searchnav #dnext").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        if ((new URLSearchParams(ev.target.href)).has("jump")) {
            resetPageCounter();
        } else {
            localStorage.setItem("EHPS-page", parseInt(localStorage.getItem("EHPS-page")) + 1);
        }
    }, false);

    document.querySelector(".searchnav #ufirst").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        resetPageCounter();
    }, false);

    document.querySelector(".searchnav #dfirst").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        resetPageCounter();
    }, false);

    document.querySelector(".searchnav #ulast").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        resetPageCounter();
    }, false);

    document.querySelector(".searchnav #dlast").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        resetPageCounter();
    }, false);

    // search button
    let searchButton = document.querySelector("#searchbox form div input:nth-child(2)");
    if (searchButton !== null) {
        searchButton.addEventListener("click", function (ev) {
            resetPageCounter();
        }, false);
    }

    // site nav
    document.querySelectorAll('#nb a').forEach(function(nav){
        nav.addEventListener("click", function (ev) {
            resetPageCounter();
        }, false);
    });

    document.querySelectorAll('.dp a').forEach(function(nav){
        nav.addEventListener("click", function (ev) {
            resetPageCounter();
        }, false);
    });
}

const main = () => {
    if (!hasGalleryListTable()) return;
    tryUpdateKnownMaxGID();
    injectStylesheet();
    addPageScrobbler();
    showBookmark();
    addPageCounter();
}

main();
