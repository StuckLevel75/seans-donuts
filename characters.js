import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const graveyard = document.getElementById("graveyard-list");
const living = document.getElementById("living-characters-list");
if (graveyard && living && firebaseConfig.projectId && firebaseConfig.apiKey) {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const fallback = graveyard.innerHTML;
  function renderCharacter(c) {
    const card = document.createElement("article");
    card.className = "character-card";
    if (c.imageUrl && /^https:\/\//i.test(c.imageUrl)) {
      const img = document.createElement("img");
      img.className = "character-photo";
      img.src = c.imageUrl;
      img.alt = (c.name || "Character") + " screenshot";
      img.loading = "lazy";
      card.append(img);
    }
    const details = document.createElement("div");
    details.className = "character-details";
    const status = document.createElement("span");
    status.className = "status " + (c.status === "dead" ? "dead" : "living-status");
    status.textContent = c.status === "dead" ? "Deceased" : "Alive";
    const name = document.createElement("h3");
    name.textContent = c.name || "Unnamed Character";
    const role = document.createElement("div");
    role.className = "character-role";
    role.textContent = c.role || "";
    const description = document.createElement("p");
    description.textContent = c.description || "";
    details.append(status, name, role, description);
    card.append(details);
    return card;
  }
  onSnapshot(collection(db, "characters"), snap => {
    const characters = snap.docs.map(d => d.data());
    const dead = characters.filter(c => c.status === "dead");
    const alive = characters.filter(c => c.status === "alive");
    const sortByName = (a,b) => String(a.name || "").localeCompare(String(b.name || ""));
    dead.sort(sortByName); alive.sort(sortByName);
    if (dead.length) graveyard.replaceChildren(...dead.map(renderCharacter));
    else graveyard.innerHTML = fallback;
    if (alive.length) living.replaceChildren(...alive.map(renderCharacter));
    else {
      const empty = document.createElement("p");
      empty.className = "note";
      empty.textContent = "No living characters added yet.";
      living.replaceChildren(empty);
    }
  }, err => {
    console.error("Unable to load GTA RP characters:", err);
    const error = document.createElement("p");
    error.className = "note";
    error.textContent = "Characters could not load right now. Please try refreshing the page.";
    living.replaceChildren(error);
  });
}
