import { useState, useEffect } from 'react';

export function Person() {
  const [user, setUser] = useState<unknown>();
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem('jwt');

  useEffect(() => {
    if (!token) {
      setError('No token found');
      return;
    }
    fetch('/api/login/welcome', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((user) => {
        setUser(user);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
      });
  }, []);
  return (
    <>
      <div>
        <p>Welcome</p>
        {error && <p>{error}</p>}
        <p>{user ? JSON.stringify(user) : 'Loading...'}</p>
      </div>
    </>
  );
}
