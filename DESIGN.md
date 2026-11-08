# LibreStream browser direction

Phone and desktop browsers are the primary surfaces. Browse, search, open a title, select a source, watch. Existing Jellyfin clients cover TVs.

Use the official Nuvio desktop/mobile task flow as a reference, not their TV focus engine or native player implementation. Both official clients are Kotlin/Compose apps. This browser source is independent and uses the Stremio addon protocol.

Astryx neutral theme in dark mode keeps surrounding controls subdued during playback. Astryx owns control states, typography, semantic colors and focus behavior. The app adds only poster geometry and responsive navigation. Posters come from configured catalogs; there are no invented film titles or generated promotional images. ENERGY 2 / RHYTHM 2 / MOTION 1. The search field is the focal point of search; title rows are the focal point of browse.

Mobile uses bottom navigation with icons above full text labels, readable source rows and native video controls. Browse uses a house, search a magnifier, saved titles a bookmark and settings a gear. The consistent Lucide outline set is rendered through Astryx Icon; symbols reinforce the adjacent labels. Playback and save actions use the same icon set, and missing artwork gets a clapperboard placeholder. Wider screens move navigation to the header and show larger shelves. Dialogs use native focus trapping, Escape and focus restoration. Keyboard users get a skip link and visible focus.

No Nuvio account flow. Authentik supplies a stable user identifier. Watchlists and progress are browser-local and scoped by that identifier. Shared addon configuration is read by the gateway from a private runtime file, never compiled into assets.
