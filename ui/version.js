// The build number shown on the home screen, in the in-game menu and in every battle log, so a playtest
// can be matched to the code it ran. It is the number of the pull request that made this build:
// bump it in each PR (tests/version.test.js checks it is a whole number and the service worker's cache
// name carries it, so a new build is fetched rather than an old one served from the phone's cache).
export const BUILD = 70;
export const BUILD_DATE = '2026-11-24';
export const buildLabel = () => 'build #' + BUILD + ' · ' + BUILD_DATE;
