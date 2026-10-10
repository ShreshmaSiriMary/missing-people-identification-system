const form = document.getElementById('person-form');
const status = document.getElementById('record-status');
const recordsList = document.getElementById('records-list');

async function loadRecords() {
  const response = await fetch('/api/people');
  const people = await response.json();

  recordsList.innerHTML = people.map((person) => `
    <article class="record-card">
      <h3>${person.name}</h3>
      <p><strong>Age:</strong> ${person.age}</p>
      <p><strong>Last seen:</strong> ${person.lastSeen}</p>
      <p><strong>Region:</strong> ${person.region}</p>
      <p><strong>Description:</strong> ${person.description}</p>
    </article>
  `).join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = Object.fromEntries(new FormData(form).entries());
  status.textContent = 'Saving record...';

  const response = await fetch('/api/people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  status.textContent = data.message || 'Record saved.';
  form.reset();
  loadRecords();
});

loadRecords();
