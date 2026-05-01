// Runes Path Optimizer logic
document.addEventListener('DOMContentLoaded', function () {
    const findPathBtn = document.getElementById('runesFindPathBtn');
    const outputDiv = document.getElementById('runesOutput');
    const progressContainer = document.getElementById('runesPathProgress');
    const progressBar = document.getElementById('runesPathProgressBar');
    const progressText = document.getElementById('runesPathProgressText');
    
    // Timer formatting
    const timerMins = document.getElementById('runesTimerMinutes');
    const timerSecs = document.getElementById('runesTimerSeconds');
    const timerNotifCheckbox = document.getElementById('runesTimerNotification');

    // Store last route data for language switching re-render
    let lastRouteData = null;
    let lastTotalDistance = 0;

    const saveTimerState = () => {
        if (timerMins) localStorage.setItem('runesTimerMinutes', timerMins.value);
        if (timerSecs) localStorage.setItem('runesTimerSeconds', timerSecs.value);
        if (timerNotifCheckbox) localStorage.setItem('runesTimerNotification', timerNotifCheckbox.checked);
    };

    if (timerMins && localStorage.getItem('runesTimerMinutes')) {
        timerMins.value = localStorage.getItem('runesTimerMinutes');
    }
    if (timerSecs && localStorage.getItem('runesTimerSeconds')) {
        timerSecs.value = localStorage.getItem('runesTimerSeconds');
    }
    if (timerNotifCheckbox && localStorage.getItem('runesTimerNotification')) {
        timerNotifCheckbox.checked = localStorage.getItem('runesTimerNotification') === 'true';
    }

    const formatTimerInput = (input, max) => {
        let val = parseInt(input.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > max) val = max;
        input.value = val.toString().padStart(2, '0');
        saveTimerState();
    };

    if (timerMins) {
        timerMins.addEventListener('blur', () => formatTimerInput(timerMins, 99));
        timerMins.addEventListener('change', () => formatTimerInput(timerMins, 99));
    }
    if (timerSecs) {
        timerSecs.addEventListener('blur', () => formatTimerInput(timerSecs, 59));
        timerSecs.addEventListener('change', () => formatTimerInput(timerSecs, 59));
    }

    if (timerNotifCheckbox) {
        timerNotifCheckbox.addEventListener('change', (e) => {
            saveTimerState();
            if (e.target.checked && "Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        });
    }

    let runesActiveTimerInterval = null;
    const activeTimerDisplay = document.getElementById('runesActiveTimerDisplay');

    if (activeTimerDisplay) {
        const initMins = parseInt(timerMins?.value || 5).toString().padStart(2, '0');
        const initSecs = parseInt(timerSecs?.value || 0).toString().padStart(2, '0');
        activeTimerDisplay.textContent = `${initMins}:${initSecs}`;
    }

    const startRunesTimer = () => {
        if (!activeTimerDisplay) return;
        
        const m = parseInt(timerMins?.value) || 0;
        const s = parseInt(timerSecs?.value) || 0;
        let totalSeconds = m * 60 + s;

        if (totalSeconds <= 0) return;

        clearInterval(runesActiveTimerInterval);
        
        const updateDisplay = () => {
            const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
            const secs = (totalSeconds % 60).toString().padStart(2, '0');
            activeTimerDisplay.textContent = `${mins}:${secs}`;
        };

        updateDisplay();

        runesActiveTimerInterval = setInterval(() => {
            totalSeconds--;
            if (totalSeconds <= 0) {
                clearInterval(runesActiveTimerInterval);
                activeTimerDisplay.textContent = "00:00";
                
                if (timerNotifCheckbox && timerNotifCheckbox.checked) {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification(window._t('runes.timer_notify_title'), { body: window._t('runes.timer_notify_body') });
                    } else {
                        alert(window._t('runes.timer_expired'));
                    }
                }
            } else {
                updateDisplay();
            }
        }, 1000);
    };

    const updateProgress = (pct) => {
        const p = Math.min(100, Math.max(0, pct));
        if (progressBar) progressBar.style.width = p + '%';
        if (progressText) progressText.textContent = Math.floor(p) + '%';
    };

    // Translate star type to current language
    const translateStarType = (starType) => {
        if (!starType || starType === 'N/A') return starType;
        return window._t(`star.${starType}`, starType);
    };

    // Get PathfinderGrid (with fallback, similar to solodungeons.js)
    const getPathfinderGrid = () => {
        return (window.PathfinderService && typeof window.PathfinderService.getGrid === 'function')
            ? window.PathfinderService.getGrid()
            : (window.stellarOdysseyPathfinderGrid || null);
    };

    // Calculate distance using PathfinderGrid (with fallback to direct distance)
    // Always compare three routes: direct, via initial star system, via space station, choose shortest
    const calcPathfinderDistance = (x1, y1, x2, y2) => {
        const grid = getPathfinderGrid();
        if (grid && typeof grid.findShortestPath === 'function') {
            try {
                const result = grid.findShortestPath({ x: x1, y: y1 }, { x: x2, y: y2 });
                const directDist = result.directDistance ?? null;
                const starterDist = result.starterSystemOnly?.distance ?? null;
                const stationDist = result.withSpaceStation?.distance ?? null;
                // Always compare all three routes and pick the shortest
                const distances = [];
                if (directDist !== null && isFinite(directDist)) distances.push(directDist);
                if (starterDist !== null && isFinite(starterDist)) distances.push(starterDist);
                if (stationDist !== null && isFinite(stationDist)) distances.push(stationDist);
                if (distances.length > 0) {
                    return Math.min(...distances);
                }
            } catch (e) {
                console.warn('[Runes] Pathfinder failed, fallback to direct:', e);
            }
        }
        // Fallback to direct distance
        return Math.hypot(x2 - x1, y2 - y1) * 10.0;
    };

    // Render the route list with current language
    const renderRouteList = (route, totalDistance) => {
        if (!outputDiv || !route || route.length < 2) return;
        
        outputDiv.innerHTML = '';

        let header = document.createElement('div');
        header.textContent = window._t('runes.optimal_route') + '\n\n';
        outputDiv.appendChild(header);

        const dist = (a, b) => Math.hypot(a.coordinate_x - b.coordinate_x, a.coordinate_y - b.coordinate_y);
        const maxSystems = Math.min(route.length, 16);

        for (let i = 1; i < maxSystems; i++) {
            let d = dist(route[i - 1], route[i]) * 10.0;

            let rowContainer = document.createElement('div');
            rowContainer.style.display = 'flex';
            rowContainer.style.alignItems = 'center';
            rowContainer.style.marginBottom = '0.5em';

            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.margin = '0 1em 0 0';
            checkbox.style.cursor = 'pointer';

            let textSpan = document.createElement('span');
            textSpan.textContent = window._t('runes.route_item', {
                index: i,
                name: route[i].name,
                star: translateStarType(route[i].star),
                x: route[i].coordinate_x,
                y: route[i].coordinate_y,
                dist: d.toFixed(2)
            });
            textSpan.style.transition = 'color 0.2s, text-decoration 0.2s';
            textSpan.style.cursor = 'pointer';

            const toggleVisit = () => {
                if (checkbox.checked) {
                    textSpan.style.textDecoration = 'line-through';
                    textSpan.style.color = '#888888';
                } else {
                    textSpan.style.textDecoration = 'none';
                    textSpan.style.color = '#ffffff';
                }
                startRunesTimer();
            };

            checkbox.addEventListener('change', toggleVisit);
            textSpan.addEventListener('click', () => {
                checkbox.checked = !checkbox.checked;
                toggleVisit();
            });

            rowContainer.appendChild(checkbox);
            rowContainer.appendChild(textSpan);
            outputDiv.appendChild(rowContainer);
        }

        let footer = document.createElement('div');
        footer.textContent = '\n' + window._t('runes.total_distance', { dist: totalDistance.toFixed(2) });
        footer.style.marginTop = '1em';
        outputDiv.appendChild(footer);
    };

    // Listen for language change events to re-render route list
    document.addEventListener('languageChanged', () => {
        if (lastRouteData && lastRouteData.length > 0) {
            renderRouteList(lastRouteData, lastTotalDistance);
        }
    });

    if (findPathBtn && outputDiv) {
        findPathBtn.addEventListener('click', async function () {
            // Try to get API key from inputs or localStorage
            let apiKey = localStorage.getItem('systems_api_key') || localStorage.getItem('api_key');
            const systemsApiKeyInput = document.getElementById('systems_api_key');
            const apiKeyInput = document.getElementById('api_key');
            if (systemsApiKeyInput && systemsApiKeyInput.value) {
                apiKey = systemsApiKeyInput.value;
            } else if (apiKeyInput && apiKeyInput.value) {
                apiKey = apiKeyInput.value;
            }

            if (!apiKey) {
                outputDiv.textContent = window._t('runes.error_no_api_key');
                return;
            }

            findPathBtn.disabled = true;
            outputDiv.textContent = '';
            if (progressContainer) progressContainer.style.display = 'block';
            updateProgress(0);

            try {
                let systemsData = null;
                let journalData = null;
                let userData = null;

                updateProgress(5);
                // Check if data is already loaded in UniverseMap or local cache
                window.runesDataCache = window.runesDataCache || { systems: null, journal: null, user: null };
                const map = window.UniverseMap && window.UniverseMap.getInstance ? window.UniverseMap.getInstance() : null;

                // System Data
                if (window.runesDataCache.systems) {
                    systemsData = window.runesDataCache.systems;
                    updateProgress(35);
                } else if (map && map.systems && map.systems.length > 0) {
                    systemsData = map.systems;
                    window.runesDataCache.systems = systemsData;
                    updateProgress(35);
                } else {
                    const sysRes = await fetch('https://api.stellarodyssey.app/api/public/systems', {
                        headers: { 'Accept': 'application/json', 'sodyssey-api-key': apiKey }
                    });
                    if (!sysRes.ok) throw new Error(`Systems API error: ${sysRes.status}`);
                    systemsData = await sysRes.json();
                    window.runesDataCache.systems = systemsData;
                    updateProgress(35);
                }

                // Always refresh journal Data
                const jourRes = await fetch('https://api.stellarodyssey.app/api/public/journal', {
                    headers: { 'Accept': 'application/json', 'sodyssey-api-key': apiKey }
                });
                if (!jourRes.ok) throw new Error(`Journal API error: ${jourRes.status}`);
                journalData = await jourRes.json();
                window.runesDataCache.journal = journalData;
                updateProgress(65);
                
                // Always refresh user Data
                const userRes = await fetch('https://api.stellarodyssey.app/api/public/user', {
                    headers: { 'Accept': 'application/json', 'sodyssey-api-key': apiKey }
                });
                if (!userRes.ok) throw new Error(`User API error: ${userRes.status}`);
                userData = await userRes.json();
                window.runesDataCache.user = userData;
                updateProgress(85);
                
                // Initialize PathfinderService with user's space stations
                if (window.PathfinderService && typeof window.PathfinderService.ensureInitialized === 'function') {
                    try {
                        await window.PathfinderService.ensureInitialized(apiKey);
                        console.log('[Runes] PathfinderService initialized');
                    } catch (e) {
                        console.warn('[Runes] Failed to initialize PathfinderService:', e);
                    }
                }
                
                // Ensure we have user's current coordinates
                const userSystem = userData?.data?.currentSystem;
                if (!userSystem) {
                    throw new Error(window._t('runes.error_no_position'));
                }

                const userX = userSystem.coordinate_x;
                const userY = userSystem.coordinate_y;

                // Get checked star types from the UI
                const allowedTypes = [];
                if (document.getElementById('runesFilterRingedDwarf').checked) allowedTypes.push('Ringed Dwarf');
                if (document.getElementById('runesFilterBinaryStars').checked) allowedTypes.push('Binary Stars');
                if (document.getElementById('runesFilterBlackHole').checked) allowedTypes.push('Black Hole');
                if (document.getElementById('runesFilterNeutronStar').checked) allowedTypes.push('Neutron Star');

                // Normalize systems array
                const systemsArray = Array.isArray(systemsData) ? systemsData : (systemsData.systems || []);

                // Extract user's visited coordinates to filter out
                const visitedCoords = new Set();
                if (journalData && journalData.fullJournal) {
                    journalData.fullJournal.forEach(entry => {
                        visitedCoords.add(`${entry.coordinate_x},${entry.coordinate_y}`);
                    });
                }

                // Iteratively expand our search zone until we find at least 10 systems, maxing out at a 51x51 square
                let targetSystems = [];
                const searchRadii = [10, 20, 30, 50]; // Represents side lengths 21, 41, 61, 101

                for (let radius of searchRadii) {
                    targetSystems = systemsArray.filter(sys => {
                        // Check if within square (distance <= radius on both axis)
                        if (Math.abs(sys.coordinate_x - userX) <= radius && Math.abs(sys.coordinate_y - userY) <= radius) {
                            // Check if type matches the checkboxes
                            if (allowedTypes.includes(sys.star)) {
                                // Make sure it hasn't been visited by the player
                                if (!visitedCoords.has(`${sys.coordinate_x},${sys.coordinate_y}`)) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    });

                    if (targetSystems.length >= 15) {
                        break;
                    }
                }

                updateProgress(100);

                outputDiv.textContent += window._t('runes.found_stars', { count: targetSystems.length }) + '\n';

                if (targetSystems.length > 0) {
                    // 1. Nearest Neighbor
                    let unvisited = [...targetSystems];
                    let currentPos = { coordinate_x: userX, coordinate_y: userY };
                    let path = [];

                    // Use pathfinder-aware distance function
                    const dist = (a, b) => {
                        // a and b might be objects with coordinate_x/coordinate_y or x/y
                        const ax = a.coordinate_x !== undefined ? a.coordinate_x : a.x;
                        const ay = a.coordinate_y !== undefined ? a.coordinate_y : a.y;
                        const bx = b.coordinate_x !== undefined ? b.coordinate_x : b.x;
                        const by = b.coordinate_y !== undefined ? b.coordinate_y : b.y;
                        return calcPathfinderDistance(ax, ay, bx, by) / 10.0; // divide by 10 to get coordinate distance (not light-years)
                    };

                    while (unvisited.length > 0) {
                        let minDist = Infinity;
                        let bestIdx = -1;
                        for (let i = 0; i < unvisited.length; i++) {
                            let d = dist(currentPos, unvisited[i]);
                            if (d < minDist) {
                                minDist = d;
                                bestIdx = i;
                            }
                        }
                        currentPos = unvisited[bestIdx];
                        path.push(currentPos);
                        unvisited.splice(bestIdx, 1);
                    }

                    // 2. 2-Opt Optimization
                    let route = [{ coordinate_x: userX, coordinate_y: userY, name: window._t('runes.current_location'), star: 'N/A' }, ...path];
                    let improved = true;
                    while (improved) {
                        improved = false;
                        for (let i = 1; i < route.length - 1; i++) {
                            for (let j = i + 1; j < route.length; j++) {
                                let E1 = dist(route[i - 1], route[i]);
                                let E2 = (j < route.length - 1) ? dist(route[j], route[j + 1]) : 0;
                                let N1 = dist(route[i - 1], route[j]);
                                let N2 = (j < route.length - 1) ? dist(route[i], route[j + 1]) : 0;

                                // Swap if the new edges are shorter than the old edges
                                if (N1 + N2 < E1 + E2 - 0.00001) {
                                    let sub = route.slice(i, j + 1).reverse();
                                    route.splice(i, sub.length, ...sub);
                                    improved = true;
                                }
                            }
                        }
                    }

                    // 3. Print resulting optimal path
                    let totalDistance = 0;
                    const maxSystems = Math.min(route.length, 16);
                    for (let i = 1; i < maxSystems; i++) {
                        totalDistance += dist(route[i - 1], route[i]) * 10.0;
                    }
                    
                    // Save route data for language switching
                    lastRouteData = route;
                    lastTotalDistance = totalDistance;
                    
                    // Render with current language
                    renderRouteList(route, totalDistance);

                } else {
                    outputDiv.textContent += window._t('runes.no_stars_found') + '\n';
                }

            } catch (error) {
                outputDiv.textContent += '\n' + window._t('runes.error', { msg: error.message });
            } finally {
                findPathBtn.disabled = false;
            }
        });
    }
});
