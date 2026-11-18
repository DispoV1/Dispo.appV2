# Activation AdresseComplète

Integration prepared but inactive until a Canada Post browser installation key is supplied.
Create an installation in the owner's Canada Post account. Restrict valid URLs to
https://dispo-demo-investisseurs.info979715.chatgpt.site and set a daily usage limit.
Set the restricted browser key in dist/address-config.js, never a management key.
Republish and test Find, container navigation, Retrieve, French/English, invalid key,
quota exhausted, and the exact requested street before claiming live functionality.

Find v2.10 and Retrieve v2.11 use official HTTPS json3 endpoints. Canadian queries
include city and QC; only retrieved Canadian Quebec addresses are accepted for
population. No silent fallback to Photon. City suggestions remain local.
No live API call was validated without an account key. Automated tests use mocks.
