export default function Login() {
  return (
    <>
      <h1>Sign in</h1>
      <form action="/api/login/password" method="post">
        <section>
          <label htmlFor="username">Username</label>
          <input id="username" name="username" type="text" required autoFocus />
        </section>
        <section>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required />
        </section>
        <button type="submit">Sign in</button>
      </form>
    </>
  );
}
