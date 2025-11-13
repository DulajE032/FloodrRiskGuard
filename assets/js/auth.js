document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
});

function handleSignup(event) {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;
    const telegramChatId = event.target['telegram-chat-id'].value;

    // In a real app, you would send this to a backend for secure storage.
    // For this project, we use localStorage as a simple database.
    const users = JSON.parse(localStorage.getItem('users')) || [];

    // Check if a user with this email already exists
    if (users.some(user => user.email === email)) {
        alert('An account with this email already exists.');
        return;
    }

    // Create the new user object
    const newUser = {
        email,
        password, // WARNING: In a real-world application, this should be hashed on the server!
        telegramChatId: telegramChatId || null // Store the chat ID or null if not provided
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    alert('Signup successful! Please log in.');
    window.location.href = 'login.html';
}

function handleLogin(event) {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        // Create a "safe" user object for the session that does NOT include the password
        const safeUser = {
            email: user.email,
            telegramChatId: user.telegramChatId
        };
        
        // Use sessionStorage to store the logged-in user's data for the current browser session
        sessionStorage.setItem('loggedInUser', JSON.stringify(safeUser));
        window.location.href = 'index.html';
    } else {
        alert('Invalid email or password.');
    }
}