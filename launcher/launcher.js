(function () {
    'use strict';
    var catalog = window.TV_APPS || [], apps = catalog.slice(0), view = 'home', reorder = false;
    var DEFAULTS = ['org.tizen.netflix-app', 'org.tizen.primevideo', 'MCmYXNxgcu.DisneyPlus', '9Ur5IzDKqV.TizenYouTube', 'com.samsung.tv.aria-video', 'mncompat26.MovieNight', 'SrAoJxGQUf.ARD', 'yPSlpvfeTf.ZDFmediathek', 'aLlph042JZ.arte', 'cg2m3QSB89.7tv', 'rJeHak5zRg.Spotify', 'org.tizen.browser'];
    var KEY = 'tvstart.favorites.v2', favorites = read(KEY, DEFAULTS), selected = read('tvstart.selected', DEFAULTS[0]);
    if (!Array.isArray(favorites)) { favorites = DEFAULTS.slice(0); }
    favorites = favorites.filter(function(id, i, all) { return typeof id === 'string' && all.indexOf(id) === i; });
    if (typeof selected !== 'string') { selected = DEFAULTS[0]; }
    var grid = document.getElementById('grid'), message = document.getElementById('message'), settings = document.getElementById('settings');
    var tiles = [], visible = [], focusIndex = 0, holdTimer = null, held = false, enterDown = false, clockTimer = null, launchTimer = null, pending = null;
    var launches = read('tvstart.launchTimes', {}), lastInput = 0, resets = 0, selectionTimer = null, scrollRow = 0;
    var heroName = document.getElementById('app-name'), heroDescription = document.getElementById('app-description'), heroId = null;
    var fast = read('tvstart.fast', true) !== false;
    function applySpeed() { document.body.classList.toggle('fast', fast); document.getElementById('setting-speed').textContent = 'Schneller Modus: ' + (fast ? 'Ein' : 'Aus'); }
    function flushSelection() { clearTimeout(selectionTimer); store('tvstart.selected', selected); }
    var nav = ['nav-home', 'nav-all', 'nav-order', 'nav-settings'];
    function read(key, fallback) { try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; } }
    function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
    function appById(id) { for (var i = 0; i < apps.length; i++) { if (apps[i].id === id) { return apps[i]; } } return null; }
    function say(s) { message.textContent = s || ''; }
    function saveFavorites() { store(KEY, favorites); }
    function isFavorite(id) { return favorites.indexOf(id) >= 0; }
    function ink(color) { var hex=/^#([0-9a-f]{6})$/i.exec(color||'');if(!hex)return '#ffffff';var rgb=[0,2,4].map(function(i){var c=parseInt(hex[1].slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#141923':'#ffffff'; }
    function fillHero(app) {
        if (!app) { return; }
        selected = app.id;
        clearTimeout(selectionTimer); selectionTimer = setTimeout(flushSelection, 450);
        if (heroId === app.id) { return; } heroId = app.id;
        heroName.textContent = app.name;
        heroDescription.textContent = app.description || 'Deine installierte App direkt oeffnen.';
    }
    function ensureVisible() {
        var row = Math.floor(focusIndex / 6), next = scrollRow;
        if (row < next) { next = row; } else if (row > next + 1) { next = row - 1; }
        if (next !== scrollRow) { scrollRow = next; grid.scrollTop = next * 261; }
    }
    function focusTile(i) {
        if (!tiles.length) { document.getElementById('nav-all').focus(); return; }
        focusIndex = Math.max(0, Math.min(tiles.length - 1, i));
        tiles[focusIndex].focus({preventScroll:true}); ensureVisible();
    }
    function showHint() {
        document.getElementById('hint').textContent = reorder ? 'Reihenfolge: Pfeile verschieben · OK oder Zurueck: fertig' : 'Pfeile zum Auswaehlen · OK zum Oeffnen · OK halten: Favorit aendern';
        document.getElementById('nav-order').textContent = reorder ? 'Fertig' : 'Anordnen';
        document.body.classList.toggle('reorder', reorder);
    }
    function render(focusGrid) {
        scrollRow = 0;
        visible = view === 'all' ? apps.slice(0) : favorites.map(appById).filter(function (a) { return !!a; });
        grid.innerHTML = ''; tiles = [];
        visible.forEach(function (app, i) {
            var button = document.createElement('button'); button.className = 'app'; button.setAttribute('data-id', app.id); button.setAttribute('aria-label', app.name);
            var art = document.createElement('span'); art.className = 'app-art'; art.style.background = app.color || '#242d3c';
            if (app.logo || app.nativeIcon) { var img = document.createElement('img'); img.src = app.nativeIcon || 'assets/' + app.logo; img.alt = ''; img.draggable = false; art.appendChild(img); }
            else { var word = document.createElement('span'); word.className = 'word-logo'; word.style.color=ink(app.color);word.textContent = app.mark || app.name; art.appendChild(word); }
            if (view === 'all' && isFavorite(app.id)) { var pin = document.createElement('span'); pin.className = 'pin'; pin.textContent = '\u2605'; art.appendChild(pin); }
            var label = document.createElement('span'); label.className = 'app-name'; label.textContent = app.name;
            button.appendChild(art); button.appendChild(label);
            button.addEventListener('focus', function () { focusIndex = i; fillHero(app); });
            button.addEventListener('click', function () { if (reorder) { reorder = false; showHint(); } else { launch(app.id); } });
            grid.appendChild(button); tiles.push(button);
        });
        document.getElementById('section-title').textContent = view === 'all' ? 'Alle deine Apps' : 'Deine Favoriten';
        document.getElementById('section-count').textContent = visible.length + ' Apps';
        document.getElementById('nav-home').className = view === 'home' ? 'active' : '';
        document.getElementById('nav-all').className = view === 'all' ? 'active' : '';
        if (!tiles.length) { var empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Waehle unter Alle Apps deine Favoriten: OK gedrueckt halten.'; grid.appendChild(empty); }
        grid.scrollTop = 0;
        showHint();
        if (focusGrid) { var index = visible.map(function (a) { return a.id; }).indexOf(selected); focusTile(index < 0 ? 0 : index); }
    }
    function toggleFavorite() {
        var app = visible[focusIndex]; if (!app) { return; }
        var i = favorites.indexOf(app.id);
        if (i >= 0) { favorites.splice(i, 1); } else { favorites.push(app.id); }
        saveFavorites(); say(app.name + (i >= 0 ? ' aus Favoriten entfernt' : ' zu Favoriten hinzugefuegt'));
        render(true);
    }
    function moveTile(delta) {
        var next = focusIndex + delta;
        if (next < 0 || next >= tiles.length) { return; }
        if (reorder) {
            var first = favorites.indexOf(visible[focusIndex].id), second = favorites.indexOf(visible[next].id);
            var swap = favorites[first]; favorites[first] = favorites[second]; favorites[second] = swap;
            saveFavorites(); render(true);
        } else { focusTile(next); }
    }
    function launch(id) {
        var app = appById(id); if (!app || pending) { return; }
        flushSelection();
        pending = {id: id, at: Date.now()}; say(app.name + ' wird geoeffnet ...');
        store('tvstart.lastApp', id);
        function failed(e) { pending = null; clearTimeout(launchTimer); say(app.name + ' konnte nicht geoeffnet werden (' + (e.name || 'Fehler') + ').'); }
        try { tizen.application.launch(id, function () {
            launchTimer = setTimeout(function () { if (pending) { pending = null; say('Start angefordert. Erneut OK, falls die App nicht erscheint.'); } }, 5000);
        }, failed); } catch (e) { failed({name: typeof tizen === 'undefined' ? 'nur auf dem TV verfuegbar' : e.name}); }
    }
    function clock() {
        clearTimeout(clockTimer);
        var d = new Date(); document.getElementById('clock').textContent = d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
        if (!document.hidden) { clockTimer = setTimeout(clock, 60000 - d.getSeconds() * 1000); }
    }
    function closeSettings() { settings.hidden = true; resets = 0; document.getElementById('nav-settings').focus(); }
    function openSettings() {
        reorder = false; showHint(); settings.hidden = false; document.getElementById('setting-close').focus();
        try { document.getElementById('device-info').textContent = webapis.productinfo.getModel() + ' · ' + webapis.productinfo.getFirmware(); } catch (e) {}
    }
    function launchUtility(id) {
        var guidance = id === 'com.samsung.tv.coba.setting' ? 'Falls kein TV-Menue erscheint: Home auf der Fernbedienung, dann Einstellungen > Allgemein > Smart-Funktionen.' : id === 'qtMHjALHus.TVDeviceCare' ? 'Falls keine Geraetepflege erscheint: Home > Einstellungen > Unterstuetzung > Geraetepflege. Nur Geraetepflege starten waehlen.' : 'Samsung-Browser wird angefordert.';
        document.getElementById('device-info').textContent = guidance;
        try { tizen.application.launch(id, function () {}, function (e) { document.getElementById('device-info').textContent = 'Start fehlgeschlagen: ' + e.name; }); }
        catch (e) { document.getElementById('device-info').textContent = 'Nur auf dem Fernseher verfuegbar.'; }
    }
    document.getElementById('nav-home').onclick = function () { reorder = false; view = 'home'; render(true); };
    document.getElementById('nav-all').onclick = function () { reorder = false; view = 'all'; render(true); };
    document.getElementById('nav-order').onclick = function () { view = 'home'; reorder = !reorder; render(true); };
    document.getElementById('nav-settings').onclick = openSettings;
    document.getElementById('setting-close').onclick = closeSettings;
    document.getElementById('setting-browser').onclick = function () { launchUtility('org.tizen.browser'); };
    document.getElementById('setting-care').onclick = function () { launchUtility('qtMHjALHus.TVDeviceCare'); };
    document.getElementById('setting-native').onclick = function () { launchUtility('com.samsung.tv.coba.setting'); };
    document.getElementById('setting-speed').onclick = function () { fast = !fast; store('tvstart.fast', fast); applySpeed(); };
    document.getElementById('setting-reset').onclick = function () { resets++; if (resets < 2) { document.getElementById('device-info').textContent = 'Noch einmal OK: nur die Favoriten-Reihenfolge wird zurueckgesetzt.'; return; } favorites = DEFAULTS.slice(0); saveFavorites(); closeSettings(); render(true); say('Favoriten zurueckgesetzt.'); };
    document.addEventListener('keydown', function (e) {
        var k = e.keyCode, active = document.activeElement;
        lastInput = Date.now();
        if (k === 13) {
            e.preventDefault(); if (enterDown) { return; } enterDown = true; held = false;
            if (settings.hidden && active.className === 'app' && !reorder) { holdTimer = setTimeout(function () { held = true; toggleFavorite(); }, 700); }
            return;
        }
        if (k === 10009 || k === 27) {
            e.preventDefault(); clearTimeout(holdTimer); enterDown = false;
            if (!settings.hidden) { closeSettings(); }
            else if (reorder) { reorder = false; showHint(); }
            else if (view === 'all') { view = 'home'; render(true); }
            else { document.getElementById('nav-home').focus(); }
            return;
        }
        if (k < 37 || k > 40) { return; }
        e.preventDefault();
        if (!settings.hidden) {
            var options = Array.prototype.slice.call(settings.querySelectorAll('button')), oi = options.indexOf(active);
            var delta = k === 37 ? -1 : k === 39 ? 1 : k === 38 ? -3 : 3;
            options[Math.max(0, Math.min(options.length - 1, oi + delta))].focus();
            return;
        }
        if (active.className !== 'app') {
            var ni = nav.indexOf(active.id);
            if (k === 40) { focusTile(focusIndex); }
            else if (k === 37) { document.getElementById(nav[Math.max(0, ni - 1)]).focus(); }
            else if (k === 39) { document.getElementById(nav[Math.min(nav.length - 1, ni + 1)]).focus(); }
            return;
        }
        if (k === 38 && focusIndex < 6 && !reorder) { document.getElementById(view === 'all' ? 'nav-all' : 'nav-home').focus(); return; }
        if (k === 37 && focusIndex % 6 !== 0) { moveTile(-1); }
        else if (k === 39 && focusIndex % 6 !== 5) { moveTile(1); }
        else if (k === 38) { moveTile(-6); }
        else if (k === 40) { moveTile(Math.min(6, tiles.length - 1 - focusIndex)); }
    });
    document.addEventListener('keyup', function (e) {
        if (e.keyCode !== 13 || !enterDown) { return; }
        e.preventDefault(); clearTimeout(holdTimer); enterDown = false;
        if (!held && document.activeElement && document.activeElement.click) { document.activeElement.click(); }
    });
    window.addEventListener('blur', function () { clearTimeout(holdTimer); enterDown = false; });
    document.addEventListener('visibilitychange', function () {
        clearTimeout(holdTimer); enterDown = false;
        if (document.hidden) {
            flushSelection();
            clearTimeout(clockTimer); clearTimeout(launchTimer);
            if (pending) { launches[pending.id] = Date.now() - pending.at; store('tvstart.launchTimes', launches); pending = null; }
        } else { pending = null; clock(); say(''); focusTile(focusIndex); }
    });
    window.__launcher = {
        launch: launch,
        state: function () { return {view:view,reorder:reorder,selected:selected,visible:visible.map(function(a){return a.id;}),favorites:favorites.slice(0),pending:pending,launchTimes:launches,hidden:document.hidden,dom:document.getElementsByTagName('*').length}; }
    };
    // Render immediately from the TV's captured inventory; reconcile once in the background.
    applySpeed(); render(true); clock();
    try { tizen.application.getAppsInfo(function (installed) {
        var ids = installed.map(function(a){return a.id;});
        var filtered = catalog.filter(function(a){return ids.indexOf(a.id)>=0;});
        if (filtered.length && filtered.length !== apps.length) { apps = filtered; render(settings.hidden && document.activeElement.className === 'app'); }
        installed.forEach(function(info) {
            var app = appById(info.id);
            if (!app || app.logo || !info.iconPath) { return; }
            var image = new Image(), path = 'file://' + info.iconPath;
            image.onload = function() {
                app.nativeIcon = path;
                tiles.forEach(function(tile) {
                    if (tile.getAttribute('data-id') !== app.id) { return; }
                    var art = tile.querySelector('.app-art'), word = art.querySelector('.word-logo');
                    if (word) { art.removeChild(word); var icon = document.createElement('img'); icon.src = path; icon.alt = ''; icon.draggable = false; art.insertBefore(icon, art.firstChild); }
                });
            };
            image.src = path;
        });
    }, function(){}); } catch(e){}
})();
