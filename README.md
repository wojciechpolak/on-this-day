# On This Day...

**On This Day... (OTD)** is a web application that allows you to see events
from your calendars that occurred on this day, during this week,
or throughout this month in previous years. Whether you want to reminisce
about past events or keep track of annual milestones, this app provides
a convenient way to look back at your personal history.

## Features

- **View Events by Day, Week, Month, or Day of the Month**: Toggle
    between viewing events that happened on this exact day, during
    this week, throughout this month, or on the same day of any month
    in previous years.
- **Multiple Calendar Support**: Fetch and merge events from multiple
    ICS calendar URLs.
- **Tabs for Event Sources**: View events from your personal ICS
    calendars or explore historical events from Wikipedia's "On This
    Day" feature.
  - **Personal Events**: Displays events from your calendars.
  - **Historical Events**: Shows global historical events from
      Wikipedia that happened on this day.
- **Automatic Dark Mode**: Enjoy a user interface that automatically
    adjusts between light and dark mode based on your system
    preferences.
- **Relative Time Display**: Events display how long ago they
    occurred, making it easy to see the time elapsed since each event.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./.screenshots/main-view-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="./.screenshots/main-view-light.png">
  <img alt="Screenshot of On This Day" src="./.screenshots/main-view-light.png">
</picture>

## Running

### Create a `.env` file and add your calendar URL(s):

```env
APP_ICS_URLS="
https://calendar.google.com/calendar/ical/first.ics,
https://calendar.google.com/calendar/ical/second.ics
"
```

Override default Wikipedia settings with:

```env
APP_WIKIPEDIA_LANG=en
APP_WIKIPEDIA_LANG_ENFORCE=1
APP_WIKIPEDIA_SECTIONS=Events,Births
```

### Running with Docker (out of the box)

```shell
docker run -it -p 8080:8080 -v $(pwd)/.env:/app/.env:ro --name otd ghcr.io/wojciechpolak/on-this-day
```

Note: Docker's `--env-file` option does not support multiline values.

### Running with Docker Compose

```shell
curl https://raw.githubusercontent.com/wojciechpolak/on-this-day/master/docker-compose.yml | docker compose -f - up
```

### Running from the source code

1. Clone the repository:
   ```shell
   git clone https://github.com/wojciechpolak/on-this-day.git
   ```

2. Install dependencies:
   ```shell
   cd on-this-day
   npm ci
   ```

3. Start the server:
   ```shell
   npm start
   ```

## License

This project is licensed under the GNU General Public License v3.0.
See the [COPYING](COPYING) file for details.

### Icon Attribution

The icons used in this project are from the [OpenMoji](https://openmoji.org)
project and are licensed under the
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) license.
