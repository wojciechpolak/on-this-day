/**
 * main.js
 *
 * On This Day (C) 2024 Wojciech Polak
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
 */
function showEvents(events, mode) {
    const container = document.getElementById('events-container');
    container.innerHTML = '';

    const today = new Date();
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

    const title = document.getElementById('title');
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
        const diffYears = today.getUTCFullYear() - eventDate.getUTCFullYear();
        const diffMonths = today.getUTCMonth() - eventDate.getUTCMonth();
        if (diffYears === 0 && diffMonths > 0) {
            return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
        }
        else if (diffYears === 0) {
            return ''; // Event is in the current year
        }
        else if (diffYears > 0) {
            return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`; // Event is in the past
        }
        else {
            const absDiffYears = Math.abs(diffYears);
            return `in ${absDiffYears} year${absDiffYears > 1 ? 's' : ''}`; // Event is in the future
        }
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
            switch (mode) {
                case 'week':
                    title.innerHTML = 'On This Week...';
                    return isEventThisWeek(eventDate);
                case 'month':
                    title.innerHTML = 'On This Month...';
                    return isEventThisMonth(eventDate);
                case 'dayOfMonth':
                    title.innerHTML = 'On This Day of the Month...';
                    return isEventThisDayMonth(eventDate);
                default:
                    title.innerHTML = 'On This Day...';
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
        const eventElement = document.createElement('div');
        eventElement.className = 'event';
        const relativeTime = getRelativeTime(event.DTSTART || event.DTEND);
        eventElement.innerHTML = `
            <h2>${event.SUMMARY} <span class="rel-date">${relativeTime ? `(${relativeTime})</span>` : ''}</h2>
            <p class="description">${parseInputText(event.DESCRIPTION || '')}</p>
            <p><time>${formatEventDateRange(event.DTSTART, event.DTEND || event.DTSTART)}</time></p>
        `;
        container.appendChild(eventElement);
    });
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
 * Function to load iCalendar data
 * @param {string} url
 * @returns {Promise<string>}
 */
async function loadICalData(url) {
    const response = await fetch(url);
    return await response.text();
}

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY_VIEW_MODE = 'otdViewMode';

    // Load the iCalendar data and render the events
    loadICalData('/fetch-ics').then(icalData => {
        const parser = new ICalParser(icalData);
        const events = parser.getEvents();
        console.log('events', events);

        const radioButtons = document.querySelectorAll('input[name="view-mode"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (event) => {
                const viewMode = event.target.value;
                showEvents(events, viewMode);
                localStorage.setItem(STORAGE_KEY_VIEW_MODE, viewMode);
            });
        });

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
        showEvents(events, savedViewMode);
    });
});
