import useStore from '@/store/useStore';
import { Button } from '@/components/ui/button';

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
      <Button onClick={increment}>Increment</Button>
      <Button onClick={decrement}>Decrement</Button>
      <Button onClick={reset}>Reset</Button>
    </div>
  );
}

function Home() {
  return (
    <div className="bg-background">
      <h1 className="text-text-primary-strong text-2xl">HOME</h1>
      <h2 className="text-text-primary-weak text-xl mb-4">Zustand test</h2>
      <Counter />
      <CounterButtons />
    </div>
  );
}

export default Home;
