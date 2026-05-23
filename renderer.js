const API_URL = "http://localhost:3001";

let accessToken = null;

const message = document.getElementById("message");

function showMessage(text) {
  message.textContent = text;
}

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

document.getElementById("signupButton").addEventListener("click", async () => {
  try {
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    const data = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    showMessage(data.message);
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById("loginButton").addEventListener("click", async () => {
  try {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    accessToken = data.accessToken;
    showMessage("Logged in successfully.");
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById("meButton").addEventListener("click", async () => {
  try {
    const data = await api("/auth/me");
    showMessage(`Logged in as ${data.user.email} with role ${data.user.role}`);
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
    accessToken = null;
    showMessage("Logged out.");
  } catch (err) {
    showMessage(err.message);
  }
});
