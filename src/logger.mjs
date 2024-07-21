/**
 * logger.mjs
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

/*global process */

import {createLogger, format, transports} from 'winston';

const {combine, timestamp, printf} = format;

// Define custom log format
const logFormat = printf(({level, message, timestamp}) => {
    return `${timestamp} - ${level} - ${message}`;
});

const logger = createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: combine(
        timestamp(),
        format.splat(),
        logFormat
    ),
    transports: [
        new transports.Console(),
    ]
});

export default logger;
