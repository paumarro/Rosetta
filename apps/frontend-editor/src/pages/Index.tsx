import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import logo from '../assets/Rosetta-Editor.png';
import bottomImage from '../assets/Dotted-Bg.png';
import pointer from '../assets/Pointer.png';

export default function Index() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative">
      <div
        className="absolute inset-0 bg-contain bg-bottom mask-radial-[45%_90%] mask-t-from-80% mask-b-from-95% mask-radial-from-90% "
        style={{ backgroundImage: `url(${bottomImage})` }}
      />
      <div className="max-w-4xl w-full relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <img
            src={logo}
            alt="Rosetta Editor"
            className="object-scale-down h-20 mx-auto my-10 mb-4"
          />
          {/* <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Rosetta Editor
          </h1> */}
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Create and Edit Learning Paths in real-time with your team.
          </p>

          <Link to="/diagrams">
            <Button
              size="lg"
              className="my-4 text-lg px-8 py-6 drop-shadow-2xl drop-shadow-white"
            >
              Share your knowledge
            </Button>
          </Link>
        </div>
      </div>
      <img
        src={pointer}
        alt="Rosetta Pointer"
        className="object-scale-down absolute bottom-60 right-120 h-8 mx-auto my-10 mb-4"
      />
    </div>
  );
}
