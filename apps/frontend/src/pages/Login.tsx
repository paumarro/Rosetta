import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
interface LoginResponse {
  token: string;
}

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      const response = await fetch('/api/login/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = (await response.json()) as LoginResponse;
        localStorage.setItem('jwt', data.token); // Store the JWT
        console.log('Login successful:', data);
        void navigate('/person'); // Redirect to the home page
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Error during login:', error);
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <>
      <div className="container mx-auto p-4 bg-amber-300">
        <h1>Sign in</h1>
        <form
          onSubmit={(event) => {
            handleLogin(event).catch((error: unknown) => {
              console.error('Error handling login:', error);
            });
          }}
        >
          <section>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoFocus
            />
          </section>
          <section>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </section>
          <button type="submit">Sign in</button>
        </form>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    </>
  );
}
