/**
 * main.js
 *
 * On This Day (C) 2024-2025 Wojciech Polak
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Function to show events that happened on this day, week, or month
 * @param {Array<IcsEvent>} events
 * @param {string} mode - 'day' or 'week' or 'month' or 'dayOfMonth'
 * @param {boolean} changeTitle
 * @param {Date=} today
 * @param {HTMLElement=} container
 */
function showEvents(events, mode, changeTitle, today, container) {
    container = container || document.getElementById('events-container');
    container.innerHTML = '';

    today = today || new Date();
    const day = today.getUTCDate();
    const month = today.getUTCMonth();
    const year = today.getUTCFullYear();
    const userLang = navigator.language || 'en-GB';
    const dateOptions = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };

    const dateSubtitle = document.getElementById('date-subtitle');
    dateSubtitle.innerHTML = `(${today.toLocaleDateString(userLang, dateOptions)})`;

    /**
     * @param {Date} eventDate - The date of the event
     * @returns {boolean}
     */
    const isEventOnThisDay = (eventDate) =>
        eventDate.getUTCDate() === day &&
        eventDate.getUTCMonth() === month &&
        eventDate.getUTCFullYear() !== year;

    /**
     * @param {Date} eventDate - The date of the event
     * @returns {boolean}
     */
    const isEventThisMonth = (eventDate) =>
        eventDate.getUTCMonth() === month &&
        eventDate.getUTCFullYear() !== year;

    /**
     * @param {Date} eventDate - The date of the event
     * @returns {boolean}
     */
    const isEventThisDayMonth = (eventDate) =>
        eventDate.getUTCDate() === day;

    /**
     * @param {Date} eventDate - The date of the event
     * @returns {boolean}
     */
    const isEventThisWeek = (eventDate) => {
        const startOfWeek = new Date(today);
        startOfWeek.setUTCDate(today.getUTCDate() - today.getUTCDay());
        startOfWeek.setUTCFullYear(eventDate.getUTCFullYear());
        startOfWeek.setUTCHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7);
        endOfWeek.setUTCHours(23, 59, 59);

        return (
            eventDate >= startOfWeek &&
            eventDate <= endOfWeek &&
            eventDate.getUTCFullYear() !== year
        );
    };

    /**
     * @param {Date} eventDate - The date of the event
     * @returns {string} - A string indicating the relative time (e.g., '2 years ago', 'in 1 year')
     */
    const getRelativeTime = (eventDate) => {
        const timeDifference = eventDate - today;
        const secondsDifference = Math.round(timeDifference / 1000);
        const rtf = new Intl.RelativeTimeFormat(userLang, {numeric: 'auto'});
        const thresholds = [
            {unit: 'second', threshold: 60},
            {unit: 'minute', threshold: 60},
            {unit: 'hour', threshold: 24},
            {unit: 'day', threshold: 30},
            {unit: 'month', threshold: 12},
            {unit: 'year', threshold: Number.POSITIVE_INFINITY}
        ];
        function _formatTimestamp(timestamp) {
            let remainingTime = timestamp;
            for (const {unit, threshold} of thresholds) {
                if (Math.abs(remainingTime) < threshold) {
                    const value = Math.round(remainingTime);
                    return rtf.format(Math.round(value), unit);
                }
                remainingTime /= threshold;
            }
            return rtf.format(Math.round(remainingTime), 'year');
        }
        return _formatTimestamp(secondsDifference);
    };

    /**
     * Formats the date range in a human-friendly way.
     * @param {Date} startDate - The event start date.
     * @param {Date} endDate - The event end date.
     * @returns {string} - A human-friendly date range.
     */
    const formatEventDateRange = (startDate, endDate) => {
        // Adjust for all-day events:
        // if end time is exactly midnight the next day, it's a one-day event
        if (endDate.getUTCHours() === 0 &&
            endDate.getUTCMinutes() === 0 &&
            endDate.getUTCSeconds() === 0) {
            const adjustedEndDate = new Date(endDate);
            adjustedEndDate.setUTCDate(endDate.getUTCDate() - 1);

            // If the adjusted end date is the same as the start date,
            // treat it as a single-day event
            if (startDate.toDateString() === adjustedEndDate.toDateString()) {
                return startDate.toLocaleDateString(userLang, dateOptions);
            }
        }
        if (startDate.toDateString() === endDate.toDateString()) {
            return startDate.toLocaleDateString(userLang, dateOptions);
        }
        // If the event spans multiple days, show a range
        return `${startDate.toLocaleDateString(userLang, dateOptions)} – ${endDate.toLocaleDateString(userLang, dateOptions)}`;
    };

    const filteredEvents = events.filter(event => {
        const eventDate = event.DTSTART || event.DTEND;
        if (eventDate) {
            changeTitle && setTitle(mode);
            switch (mode) {
                case 'week':
                    return isEventThisWeek(eventDate);
                case 'month':
                    return isEventThisMonth(eventDate);
                case 'dayOfMonth':
                    return isEventThisDayMonth(eventDate);
                default:
                    return isEventOnThisDay(eventDate);
            }
        }
        else {
            console.log('PROBLEM with', event)
        }
        return false;
    });

    // Sort events by date, newest first
    filteredEvents.sort((a, b) => (b.DTSTART || b.DTEND) - (a.DTSTART || a.DTEND));

    if (filteredEvents.length === 0) {
        const message = document.createElement('div');
        message.className = 'no-events-message';
        message.innerHTML = 'Nothing found. Looks like today is a quiet day in history.';
        container.appendChild(message);
        return;
    }

    filteredEvents.forEach(event => {
        const eventElement = document.createElement('article');
        eventElement.className = 'event';
        const relativeTime = getRelativeTime(event.DTSTART || event.DTEND);
        const description = event['X-ALT-DESC'] || parseInputText(event.DESCRIPTION || '');
        eventElement.innerHTML = `
            <h2>
               <span class="title">${parseInputText(event.SUMMARY)}</span>
               <span class="rel-date">${relativeTime ? `${relativeTime}</span>` : ''}
            </h2>
            <p class="description">${description}</p>
            <footer><time>${formatEventDateRange(event.DTSTART, event.DTEND || event.DTSTART)}</time></footer>
        `;
        container.appendChild(eventElement);
    });
}

/**
 * Set Title
 * @param {string=} mode
 */
function setTitle(mode) {
    const title = document.getElementById('title');
    switch (mode) {
        case 'week':
            title.innerHTML = 'On This Week...';
            break;
        case 'month':
            title.innerHTML = 'On This Month...';
            break;
        case 'dayOfMonth':
            title.innerHTML = 'On This Day of the Month...';
            break;
        default:
            title.innerHTML = 'On This Day...';
    }
}

/**
 * Function that takes an input string, escapes any potentially harmful
 * HTML to prevent XSS attacks, converts URLs into clickable anchor (<a>)
 * tags, and replaces newline characters with <br> tags.
 * @param {string} input
 * @returns {string}
 */
 function parseInputText(input) {
    function escapeHTML(str) {
        const replacements = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return str.replace(/[&<>"']/g, (char) => replacements[char]);
    }

    // Convert URLs to clickable links
    function linkify(str) {
        const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
        return str.replace(urlRegex, function(url) {
            const escapedURL = escapeHTML(url);
            return `<a href="${escapedURL}" target="_blank" rel="noopener noreferrer">${escapedURL}</a>`;
        });
    }

    let escapedText = escapeHTML(input);
    let linkedText = linkify(escapedText);
    return linkedText.replace(/\n/g, '<br>');
}

/**
 * Function to convert ISO date strings to Date objects
 * @param {string} key
 * @param {string} value
 * @returns {string | Date}
 */
function dateReviver(key, value) {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    if (typeof value === 'string' && isoDateRegex.test(value)) {
        return new Date(value);
    }
    return value;
}

/**
 * Function to load iCalendar data
 * @param {string} url
 * @param {HTMLElement=} container
 * @returns {Promise<IcsEvent[]>}
 */
async function loadICalData(url, container) {
    container = container || document.getElementById('events-container');

    const loadingTimeout = setTimeout(() => {
        container.innerHTML = '<div class="loading">Loading...</div>';
    }, 100);

    try {
        const response = await fetch(url);
        const text = await response.text();
        return JSON.parse(text, dateReviver);
    }
    catch (error) {
        throw error;
    }
    finally {
        clearTimeout(loadingTimeout);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY_VIEW_MODE = 'otdViewMode';

    const historyContainer = document.getElementById('history-container');
    const tabContents = document.querySelectorAll('.tab-content');
    const shouldShowHistoryTab = true;
    let selectedTab = 'tab-personal';
    let selectedDate = new Date();

    if (!shouldShowHistoryTab) {
        document.querySelector('.tab[data-tab="tab-history"]').remove();
        document.getElementById('tab-history').remove();
    }

    const tabs = document.querySelectorAll('.tab');

    // Set initial tab event listeners
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            selectedTab = this.getAttribute('data-tab');
            if (selectedTab === 'tab-history') {
                if (!isHistoryLoaded()) {
                    loadWikipediaEvents();
                }
                setTitle();
            }
            else {
                setTitle(localStorage.getItem(STORAGE_KEY_VIEW_MODE));
            }

            tabs.forEach(tab => {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');

            tabContents.forEach(content => {
                if (content.id === selectedTab) {
                    content.style.display = 'block';
                }
                else {
                    content.style.display = 'none';
                }
            });
        });
    });

    // Load the iCalendar data and render the events
    loadICalData('/fetch-ics').then(events => {
        const radioButtons = document.querySelectorAll('input[name="view-mode"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (event) => {
                const viewMode = event.target.value;
                showEvents(events, viewMode, true, selectedDate);
                localStorage.setItem(STORAGE_KEY_VIEW_MODE, viewMode);
            });
        });

        document.querySelector('nav.date button.left').onclick = function() {
            const viewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
            selectedDate.setDate(selectedDate.getDate() - 1);
            showEvents(events, viewMode, true, selectedDate);
            if (isHistoryVisible()) {
                loadWikipediaEvents();
            }
            else {
                historyContainer.innerHTML = '';
            }
        };
        document.querySelector('nav.date button.right').onclick = function() {
            const viewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
            selectedDate.setDate(selectedDate.getDate() + 1);
            showEvents(events, viewMode, true, selectedDate);
            if (isHistoryVisible()) {
                loadWikipediaEvents();
            }
            else {
                historyContainer.innerHTML = '';
            }
        };
        document.querySelector('#date-subtitle').onclick = function() {
            const viewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
            selectedDate = new Date();
            showEvents(events, viewMode, true, selectedDate);
            if (isHistoryVisible()) {
                loadWikipediaEvents();
            }
            else {
                historyContainer.innerHTML = '';
            }
        };

        // Sort events by DTSTART
        events.sort((a, b) => b.DTSTART - a.DTSTART);

        // Read the saved view mode from localStorage or default to 'day'
        const savedViewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE) || 'day';

        // Set the radio button based on the saved view mode
        const defaultRadio = document.querySelector(`input[name="view-mode"][value="${savedViewMode}"]`);
        if (defaultRadio) {
            defaultRadio.checked = true;
        }

        // Show events for the default mode (day)
        showEvents(events, savedViewMode, true, selectedDate);
    });

    function isHistoryVisible() {
        return selectedTab === 'tab-history';
    }

    function isHistoryLoaded() {
        return historyContainer.innerHTML !== '';
    }

    /**
     * Loads Wikipedia events based on date and language
     * @param {string=} lang
     */
    function loadWikipediaEvents(lang) {
        const userLang = (lang || navigator.language || 'en').slice(0, 2);
        let date = selectedDate.toISOString().slice(0, 10);
        // Load the Wikipedia data and render the events
        loadICalData(`/fetch-wikipedia?date=${date}&lang=${userLang}`,
            historyContainer).then(events => {
            // Show events for the default mode (day)
            showEvents(events, 'day', false, selectedDate, historyContainer);
        });
    }
});
