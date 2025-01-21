import { useEffect, useState } from 'react';

interface User {
  name: string;
  descrition: string;
}

export default function ApiTest() {
  const [data, setData] = useState<User[]>([]);
  useEffect(() => {
    fetch('/api/users')
      .then((response) => response.json())
      .then((data: User[]) => {
        setData(data);
      })
      .catch((err: unknown) => {
        console.error('Error fetching data', err);
      });
  }, []);
  return (
    <div>
      <p>Data from Backend:</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
