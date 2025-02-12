import { useState, useEffect } from 'react';

export function Person() {
  const [user, setUser] = useState<unknown>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/login/welcome')
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
