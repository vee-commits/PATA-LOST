const STORAGE_KEY = "patalost_items";

function getItems() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function toggleMenu() {
  document.getElementById("navMenu").classList.toggle("show");
}

function openPost(type) {
  document.getElementById("itemType").value = type;

  document.getElementById("post").scrollIntoView({
    behavior: "smooth"
  });
}

document
  .getElementById("postForm")
  .addEventListener("submit", function(event) {

    event.preventDefault();

    const item = {
      id: Date.now(),

      type: document.getElementById("itemType").value,

      category: document.getElementById("category").value,

      description:
        document.getElementById("description").value.trim(),

      county:
        document.getElementById("county").value,

      location:
        document.getElementById("location").value.trim(),

      date:
        document.getElementById("itemDate").value,

      email:
        document.getElementById("email").value.trim(),

      created:
        new Date().toISOString()
    };

    const items = getItems();

    items.unshift(item);

    saveItems(items);

    alert(
      "Your report has been saved. Your private contact information is not displayed publicly."
    );

    this.reset();

    searchItems();

    document
      .getElementById("search")
      .scrollIntoView({
        behavior: "smooth"
      });
  });


function searchItems() {

  const keyword =
    document
      .getElementById("searchInput")
      .value
      .toLowerCase()
      .trim();

  const county =
    document.getElementById("countyFilter").value;

  const type =
    document.getElementById("typeFilter").value;

  const results =
    document.getElementById("results");

  const items = getItems();

  const filtered = items.filter(item => {

    const text =
      (
        item.description +
        " " +
        item.category +
        " " +
        item.location +
        " " +
        item.county
      ).toLowerCase();

    const keywordMatch =
      !keyword || text.includes(keyword);

    const countyMatch =
      !county || item.county === county;

    const typeMatch =
      !type || item.type === type;

    return keywordMatch &&
           countyMatch &&
           typeMatch;
  });


  if (filtered.length === 0) {

    results.innerHTML = `
      <div class="item-card">
        <h3>No matching reports yet</h3>
        <p>
          Try another search or create a new lost/found report.
        </p>
      </div>
    `;

    return;
  }


  results.innerHTML = filtered.map(item => `

    <div class="item-card">

      <span class="badge">
        ${escapeHTML(item.type)}
      </span>

      <h3>
        ${escapeHTML(item.category)}
      </h3>

      <p>
        ${escapeHTML(item.description)}
      </p>

      <p>
        📍 ${escapeHTML(item.county)},
        ${escapeHTML(item.location)}
      </p>

      <p>
        📅 ${escapeHTML(item.date)}
      </p>

      <p>
        🔒 Contact information protected
      </p>

    </div>

  `).join("");
}


function escapeHTML(text) {

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


searchItems();


if ("serviceWorker" in navigator) {

  window.addEventListener("load", () => {

    navigator.serviceWorker.register("service-worker.js")
      .catch(() => {
        console.log("Service worker not available yet.");
      });

  });

}
