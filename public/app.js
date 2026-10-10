const form = document.getElementById('upload-form');
const fileInput = document.getElementById('photo');
const selectedFile = document.getElementById('selected-file');
const status = document.getElementById('status');
const resultCard = document.getElementById('result-card');
const resultContent = document.getElementById('result-content');

fileInput.addEventListener('change', () => {
  selectedFile.textContent = fileInput.files[0]
    ? `Selected file: ${fileInput.files[0].name}`
    : 'No file selected';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  status.textContent = 'Analyzing the image and comparing it with the sample records...';
  resultCard.classList.add('hidden');

  try {
    const response = await fetch('/identify', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to process the photo.');
    }

    const rankedMatches = (data.allMatches || []).map((item, index) => `
      <div class="match-item">
        <span>${index + 1}. ${item.name}</span>
        <strong>${item.score}%</strong>
      </div>
    `).join('');

    resultContent.innerHTML = `
      <p><strong>Name:</strong> ${data.match.name}</p>
      <p><strong>Age:</strong> ${data.match.age}</p>
      <p><strong>Last seen:</strong> ${data.match.lastSeen}</p>
      <p><strong>Region:</strong> ${data.match.region}</p>
      <p><strong>Description:</strong> ${data.match.description}</p>
      <p><strong>Similarity score:</strong> ${data.match.score}%</p>
      <div class="match-list">${rankedMatches}</div>
    `;

    status.textContent = 'Matching complete.';
    resultCard.classList.remove('hidden');
  } catch (error) {
    status.textContent = error.message;
  }
});
