Kuule tead oli igav tegin lehe siis tegin appi ja siin ma olen.
https://jutumasin.com/

For each release, update the date (DDMMYYYY) in `version.js` and increment both `build` and the Android `code`. The website and Android package share this release identity. Then run `node scripts/version-assets.cjs` and commit the updated HTML together with the assets. This adds content hashes to asset URLs so browsers load matching styles, translations and code instead of mixing new HTML with cached files. Android packages use the same HTML and assets.
