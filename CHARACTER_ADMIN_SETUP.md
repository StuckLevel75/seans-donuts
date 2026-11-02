# Character admin setup (one time)

The website is static GitHub Pages, so its admin dashboard requires Firebase for authentication, character data and images.

1. Create a Firebase project at https://console.firebase.google.com/.
2. Add a Web app and copy its Firebase config values into `firebase-config.js`. This file contains public web identifiers only; **never put service account keys or passwords in it**.
3. Enable Authentication > Sign-in method > Email/Password. Create your own admin user in Authentication > Users.
4. Copy that user's UID from Authentication > Users.
5. Enable Cloud Firestore. In Firestore > Rules, paste `firestore.rules`, replace `REPLACE_WITH_YOUR_FIREBASE_USER_UID` with your UID and publish.
6. Enable Firebase Storage. In Storage > Rules, paste `storage.rules`, replace the same UID and publish. Storage may require a billing-enabled project.
7. Under Authentication > Settings > Authorized domains, add `stucklevel75.com` and any other domain used to access the site.
8. Commit the config values to the GitHub repository and visit `https://stucklevel75.com/admin/` to sign in.

**Security:** A tiny hidden-looking link is not access control. Firebase security rules restrict writes to your UID. Never publish rules that allow anyone to write. Public visitors may read character data and images.

**Existing Sean Salazar:** The original static card stays visible until Firestore has deceased character records. Add Sean Salazar through the admin once configured, including his image, so he becomes database-managed. If the Firestore list contains deceased records, those replace the static fallback. Alive characters can be managed in the dashboard but are not displayed in the graveyard.

**Limitations:** Admin login and saving won't work until Firebase is configured. Image storage may have charges. This setup uses CDN Firebase SDK modules and does not require a build process.
