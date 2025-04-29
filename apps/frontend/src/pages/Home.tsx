import useStore from '@/store/useStore';

function Counter() {
  const counter = useStore((state) => state.count);
  return <h1>{counter} pilatus around here...</h1>;
}

function CounterButtons() {
  const increment = useStore((state) => state.increment);
  const decrement = useStore((state) => state.decrement);
  const reset = useStore((state) => state.reset);
  return (
    <div>
      <button onClick={increment}>Increment</button>
      <button onClick={decrement}>Decrement</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

function Home() {
  return (
    <div className="bg-background">
      <h1 className="text-text-primary-strong text-2xl">HOME</h1>
      <h2 className="text-text-primary-weak text-xl mb-4 bg-red-500">
        Zustand test
      </h2>
      <Counter />
      <CounterButtons />
    </div>
  );
}

export default Home;
